"""Constrained Portfolio Optimization Engine for Institutional Treasuries.

Mathematical Formulation:
--------------------------
Primary Objective: Maximize expected portfolio return
    maximize:  mu^T * w
    subject to:
        1. Fully invested: sum_i(w_i) == 1
        2. Long-only:      w_i >= 0  for all i
        3. Single asset:   w_i <= max_single_asset_weight  for all i
        4. Equity limit:   sum_{i in equity}(w_i) <= max_equity_weight
        5. Min liquidity:  sum_i(w_i * L_i) >= min_liquidity_score
        6. CVaR 95% (Rockafellar & Uryasev 2000 Scenario Formulation):
               u_t >= -r_t^T * w - gamma,   u_t >= 0,  for all t in 1..T
               gamma + (1 / ((1 - alpha) * T)) * sum(u_t) <= max_cvar
        7. Max Drawdown (Chekhlov, Uryasev & Zabarankin 2005 Formulation):
               y_t = (sum_{tau=1}^t r_tau)^T * w
               M_t >= M_{t-1},  M_t >= y_t,  M_t - y_t <= max_drawdown

This scenario-based CVaR formulation directly operates on historical / synthetic
discrete return paths without normal approximations or linearity assumptions.
"""
import time
from typing import Dict, List, Optional, Tuple, Union
import cvxpy as cp
import numpy as np
import pandas as pd

from backend.app.engine.analytics import (
    calculate_covariance_matrix,
    calculate_expected_return,
    calculate_hhi,
    calculate_historical_cvar,
    calculate_historical_var,
    calculate_largest_exposure,
    calculate_max_drawdown,
    calculate_monetary_allocations,
    calculate_portfolio_return_series,
    calculate_portfolio_volatility,
    calculate_weighted_liquidity_score,
)
from backend.app.schemas.portfolio import (
    Asset,
    AssetClass,
    ConstraintCheck,
    OptimizationConstraints,
    OptimizationResult,
)


class PortfolioOptimizer:
    """Constrained convex portfolio optimization engine using CVXPY."""

    def __init__(self, periods_per_year: int = 252) -> None:
        """Initializes optimizer with annualization frequency."""
        self.periods_per_year = periods_per_year

    def optimize(
        self,
        assets: List[Asset],
        historical_returns: pd.DataFrame,
        constraints: Optional[OptimizationConstraints] = None,
        total_capital: float = 10_000_000.0,
        risk_free_rate: float = 0.045,
    ) -> OptimizationResult:
        """Optimizes portfolio weights subject to institutional risk and policy constraints.

        Parameters
        ----------
        assets : List[Asset]
            Universe of available institutional instruments.
        historical_returns : pd.DataFrame
            Historical/synthetic daily percentage returns with columns matching asset symbols.
        constraints : Optional[OptimizationConstraints]
            Risk policy constraints (single-asset caps, liquidity floors, CVaR limits, MDD limits).
        total_capital : float
            Total capital pool to be allocated across assets.
        risk_free_rate : float
            Annualized risk-free rate.

        Returns
        -------
        OptimizationResult
            Comprehensive optimization outcome including status, weights, monetary allocations,
            risk metrics, and constraint validation status.

        Raises
        ------
        ValueError
            If input data is invalid, missing, or insufficient.
        """
        start_time = time.perf_counter()

        # 1. Input Validation
        self._validate_inputs(assets, historical_returns, total_capital)

        if constraints is None:
            constraints = OptimizationConstraints()

        n_assets = len(assets)
        symbols = [a.symbol for a in assets]
        T_scenarios = len(historical_returns)

        # 2. Expected Returns Vector (mu)
        mu_annual = np.array([
            a.expected_return if a.expected_return is not None
            else float(historical_returns[a.symbol].mean() * self.periods_per_year)
            for a in assets
        ])

        # 3. Decision Variables
        w = cp.Variable(n_assets, name="weights")
        cvx_constraints = []

        # 4. Budget Constraint: sum(w) == 1
        cvx_constraints.append(cp.sum(w) == 1.0)

        # 5. Long-Only Constraint: w_i >= 0
        if constraints.long_only:
            floor = constraints.min_single_asset_weight or 0.0
            cvx_constraints.append(w >= floor)

        # 6. Maximum Single-Asset Exposure
        if constraints.max_single_asset_weight is not None:
            cvx_constraints.append(w <= constraints.max_single_asset_weight)

        # 7. Custom Asset Limits
        for sym, limit in constraints.custom_asset_limits.items():
            if sym in symbols:
                idx = symbols.index(sym)
                cvx_constraints.append(w[idx] <= limit)

        # 8. Maximum Equity / Strategic Yield Exposure
        if constraints.max_equity_weight is not None:
            equity_indices = [
                i for i, a in enumerate(assets)
                if a.asset_class in [AssetClass.STRATEGIC_YIELD.value, "Equity", "Equities"]
                or "equity" in a.asset_class.lower()
                or "strategic" in a.asset_class.lower()
            ]
            if equity_indices:
                cvx_constraints.append(cp.sum(w[equity_indices]) <= constraints.max_equity_weight)

        # 9. Minimum Portfolio Liquidity Score
        if constraints.min_liquidity_score is not None:
            liq_scores = np.array([a.liquidity_score for a in assets])
            cvx_constraints.append(liq_scores @ w >= constraints.min_liquidity_score)

        # 10. Maximum CVaR Constraint (Rockafellar-Uryasev 2000 Scenario Formulation)
        R_mat = historical_returns[symbols].values  # Shape: (T, n)
        if constraints.max_cvar is not None:
            alpha = constraints.cvar_confidence_level
            beta = 1.0 - alpha
            gamma = cp.Variable(name="cvar_var_threshold")
            u = cp.Variable(T_scenarios, name="cvar_tail_slacks")

            # Loss at scenario t is -R_t * w
            cvx_constraints.append(u >= -R_mat @ w - gamma)
            cvx_constraints.append(u >= 0)
            cvar_expr = gamma + (1.0 / (beta * T_scenarios)) * cp.sum(u)
            cvx_constraints.append(cvar_expr <= constraints.max_cvar)

        # 11. Maximum Drawdown Constraint (Chekhlov, Uryasev & Zabarankin Formulation)
        if constraints.max_drawdown is not None:
            # Cumulative returns per asset path
            C_mat = np.cumsum(R_mat, axis=0)  # Shape: (T, n)
            y = C_mat @ w                      # Portfolio cumulative return path
            M = cp.Variable(T_scenarios, name="running_peaks")

            cvx_constraints.append(M[0] >= 0)
            cvx_constraints.append(M[0] >= y[0])
            cvx_constraints.append(M[1:] >= M[:-1])
            cvx_constraints.append(M >= y)
            cvx_constraints.append(M - y <= constraints.max_drawdown)

        # 12. Objective: Maximize expected return
        objective = cp.Maximize(mu_annual @ w)
        problem = cp.Problem(objective, cvx_constraints)

        # 13. Solve Problem
        solve_error = ""
        try:
            # Clarabel is the primary interior-point conic solver; fall back to OSQP / SCS if needed
            problem.solve(solver=cp.CLARABEL)
        except Exception as e:
            solve_error = str(e)
            try:
                problem.solve(solver=cp.OSQP)
            except Exception as e2:
                solve_error += f" | OSQP fallback: {e2}"

        solve_duration = time.perf_counter() - start_time

        # 14. Handle Non-Optimal Solutions (Infeasible / Error)
        if problem.status not in [cp.OPTIMAL, cp.OPTIMAL_INACCURATE]:
            return self._handle_infeasible_or_error(
                problem.status,
                constraints,
                solve_error,
                solve_duration,
            )

        # 15. Process Solution Weights
        raw_weights = np.array(w.value).flatten()
        # Clean minute numerical precision artifacts
        raw_weights[raw_weights < 1e-7] = 0.0
        weight_sum = np.sum(raw_weights)
        if weight_sum > 0:
            raw_weights = raw_weights / weight_sum
        else:
            return self._handle_infeasible_or_error(
                "INFEASIBLE", constraints, "Solver returned zero weight vector", solve_duration
            )

        opt_weights = {symbols[i]: float(raw_weights[i]) for i in range(n_assets)}

        # 16. Calculate Post-Optimization Metrics & Constraint Validations
        return self._build_successful_result(
            opt_weights=opt_weights,
            assets=assets,
            historical_returns=historical_returns,
            constraints=constraints,
            total_capital=total_capital,
            solve_duration=solve_duration,
        )

    def _validate_inputs(
        self,
        assets: List[Asset],
        historical_returns: pd.DataFrame,
        total_capital: float,
    ) -> None:
        """Validates optimization inputs for completeness and numerical sanity."""
        if not assets:
            raise ValueError("Asset universe cannot be empty.")

        if total_capital <= 0:
            raise ValueError(f"total_capital must be strictly positive, got {total_capital}")

        if historical_returns is None or historical_returns.empty:
            raise ValueError("historical_returns DataFrame cannot be empty.")

        missing_symbols = [a.symbol for a in assets if a.symbol not in historical_returns.columns]
        if missing_symbols:
            raise ValueError(
                f"historical_returns is missing required asset columns: {missing_symbols}"
            )

        if len(historical_returns) < 20:
            raise ValueError(
                f"Insufficient historical return scenarios ({len(historical_returns)}). "
                "Minimum 20 scenarios required for statistical tail risk modeling."
            )

        sub_df = historical_returns[[a.symbol for a in assets]]
        if sub_df.isna().any().any():
            raise ValueError("historical_returns contains NaN values in required asset columns.")
        if np.isinf(sub_df.values).any():
            raise ValueError("historical_returns contains infinite values.")

    def _build_successful_result(
        self,
        opt_weights: Dict[str, float],
        assets: List[Asset],
        historical_returns: pd.DataFrame,
        constraints: OptimizationConstraints,
        total_capital: float,
        solve_duration: float,
    ) -> OptimizationResult:
        """Calculates derived metrics and evaluates constraint checks for optimal solutions."""
        symbols = list(opt_weights.keys())

        # 1. Monetary Allocations: Capital * Weight
        monetary_allocations = calculate_monetary_allocations(opt_weights, total_capital)

        # 2. Risk & Performance Metrics
        p_returns = calculate_portfolio_return_series(opt_weights, historical_returns)
        exp_ret = calculate_expected_return(
            opt_weights, historical_returns, annualized=True, periods_per_year=self.periods_per_year
        )
        cov_matrix = calculate_covariance_matrix(
            historical_returns[symbols], annualized=True, periods_per_year=self.periods_per_year
        )
        vol = calculate_portfolio_volatility(
            opt_weights, cov_matrix, annualized=True, periods_per_year=self.periods_per_year
        )
        var_95 = calculate_historical_var(
            p_returns, confidence_level=constraints.cvar_confidence_level
        )
        cvar_95 = calculate_historical_cvar(
            p_returns, confidence_level=constraints.cvar_confidence_level
        )
        mdd = calculate_max_drawdown(p_returns)
        hhi = calculate_hhi(opt_weights)
        top_sym, top_w = calculate_largest_exposure(opt_weights)
        liq_scores = {a.symbol: a.liquidity_score for a in assets}
        liq_score = calculate_weighted_liquidity_score(opt_weights, liq_scores)

        # 3. Comprehensive Constraint Checks
        checks: List[ConstraintCheck] = []

        # Check 1: Budget (fully invested)
        weight_sum = sum(opt_weights.values())
        checks.append(ConstraintCheck(
            constraint_name="Fully Invested Budget",
            actual_value=weight_sum,
            limit=1.0,
            passed=abs(weight_sum - 1.0) <= 1e-4,
            operator="==",
            description="Portfolio weights must sum to 100%",
        ))

        # Check 2: Long-Only
        min_w = min(opt_weights.values())
        checks.append(ConstraintCheck(
            constraint_name="Long-Only Constraint",
            actual_value=min_w,
            limit=0.0,
            passed=min_w >= -1e-6,
            operator=">=",
            description="No negative weights allowed",
        ))

        # Check 3: Max Single Asset
        if constraints.max_single_asset_weight is not None:
            checks.append(ConstraintCheck(
                constraint_name="Max Single Asset Exposure",
                actual_value=top_w,
                limit=constraints.max_single_asset_weight,
                passed=top_w <= constraints.max_single_asset_weight + 1e-4,
                operator="<=",
                description=f"Max weight in any asset <= {constraints.max_single_asset_weight:.1%}",
            ))

        # Check 4: Max Equity Exposure
        if constraints.max_equity_weight is not None:
            equity_symbols = [
                a.symbol for a in assets
                if a.asset_class in [AssetClass.STRATEGIC_YIELD.value, "Equity", "Equities"]
                or "equity" in a.asset_class.lower()
                or "strategic" in a.asset_class.lower()
            ]
            equity_alloc = sum(opt_weights.get(s, 0.0) for s in equity_symbols)
            checks.append(ConstraintCheck(
                constraint_name="Max Equity Exposure",
                actual_value=equity_alloc,
                limit=constraints.max_equity_weight,
                passed=equity_alloc <= constraints.max_equity_weight + 1e-4,
                operator="<=",
                description=f"Total equity/strategic weight <= {constraints.max_equity_weight:.1%}",
            ))

        # Check 5: Minimum Liquidity
        if constraints.min_liquidity_score is not None:
            checks.append(ConstraintCheck(
                constraint_name="Minimum Liquidity Score",
                actual_value=liq_score,
                limit=constraints.min_liquidity_score,
                passed=liq_score >= constraints.min_liquidity_score - 1e-4,
                operator=">=",
                description=f"Weighted liquidity score >= {constraints.min_liquidity_score:.2f}",
            ))

        # Check 6: Maximum CVaR
        if constraints.max_cvar is not None:
            checks.append(ConstraintCheck(
                constraint_name="Maximum CVaR (95%)",
                actual_value=cvar_95,
                limit=constraints.max_cvar,
                passed=cvar_95 <= constraints.max_cvar + 1e-4,
                operator="<=",
                description=f"Historical CVaR <= {constraints.max_cvar:.2%}",
            ))

        # Check 7: Maximum Drawdown
        if constraints.max_drawdown is not None:
            checks.append(ConstraintCheck(
                constraint_name="Maximum Drawdown",
                actual_value=mdd,
                limit=constraints.max_drawdown,
                passed=mdd <= constraints.max_drawdown + 1e-3,
                operator="<=",
                description=f"Max peak-to-trough drawdown <= {constraints.max_drawdown:.2%}",
            ))

        return OptimizationResult(
            status="OPTIMAL",
            weights=opt_weights,
            allocations=monetary_allocations,
            expected_return=exp_ret,
            volatility=vol,
            var=var_95,
            cvar=cvar_95,
            max_drawdown=mdd,
            hhi=hhi,
            largest_exposure=(top_sym, top_w),
            liquidity_score=liq_score,
            constraint_checks=checks,
            message="Optimization converged successfully satisfying all constraints.",
            solve_time_seconds=solve_duration,
        )

    def _handle_infeasible_or_error(
        self,
        status: str,
        constraints: OptimizationConstraints,
        details: str,
        solve_duration: float,
    ) -> OptimizationResult:
        """Constructs an informative failure result when constraints cannot be satisfied."""
        status_clean = "INFEASIBLE" if "infeasible" in status.lower() else "ERROR"
        msg = (
            "Optimization failed: The problem is mathematically infeasible. "
            "The configured risk, liquidity, and allocation constraints cannot be satisfied simultaneously."
        ) if status_clean == "INFEASIBLE" else f"Optimization failed with solver status: {status}. {details}"

        # Populate failed constraint checks showing limits that triggered conflict
        checks: List[ConstraintCheck] = []
        if constraints.max_single_asset_weight is not None:
            checks.append(ConstraintCheck(
                constraint_name="Max Single Asset Exposure",
                actual_value=float("nan"),
                limit=constraints.max_single_asset_weight,
                passed=False,
                operator="<=",
                description="Constraint active in infeasible set",
            ))
        if constraints.min_liquidity_score is not None:
            checks.append(ConstraintCheck(
                constraint_name="Minimum Liquidity Score",
                actual_value=float("nan"),
                limit=constraints.min_liquidity_score,
                passed=False,
                operator=">=",
                description="Constraint active in infeasible set",
            ))
        if constraints.max_cvar is not None:
            checks.append(ConstraintCheck(
                constraint_name="Maximum CVaR",
                actual_value=float("nan"),
                limit=constraints.max_cvar,
                passed=False,
                operator="<=",
                description="Constraint active in infeasible set",
            ))

        return OptimizationResult(
            status=status_clean,
            weights={},
            allocations={},
            expected_return=0.0,
            volatility=0.0,
            var=0.0,
            cvar=0.0,
            max_drawdown=0.0,
            hhi=0.0,
            largest_exposure=("", 0.0),
            liquidity_score=0.0,
            constraint_checks=checks,
            message=msg,
            solve_time_seconds=solve_duration,
        )
