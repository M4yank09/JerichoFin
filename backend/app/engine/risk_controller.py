"""Risk Control and Defensive Rebalancing Engine.

Provides independent institutional risk policy evaluation (NORMAL, WARNING, BREACH, CRITICAL)
and automated convex defensive rebalancing to restore policy compliance while minimizing turnover.
"""
from typing import Dict, List, Optional, Tuple
import cvxpy as cp
import numpy as np
import pandas as pd

from app.engine.analytics import (
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
    validate_weights,
)
from app.schemas.portfolio import (
    Asset,
    AssetClass,
    AssetDrift,
    DefensiveRebalanceResult,
    PolicyCheckResult,
    PolicyEvaluation,
    PortfolioMetrics,
    RiskState,
    TreasuryPolicy,
)


class RiskControlEngine:
    """Evaluates institutional portfolios against policy rules and generates defensive rebalancing plans."""

    def __init__(self, periods_per_year: int = 252) -> None:
        """Initializes risk controller with annualization convention."""
        self.periods_per_year = periods_per_year

    def evaluate_policy(
        self,
        portfolio_weights: Dict[str, float],
        assets: List[Asset],
        metrics: PortfolioMetrics,
        policy: Optional[TreasuryPolicy] = None,
    ) -> PolicyEvaluation:
        """Evaluates a portfolio against institutional risk policy limits.

        Parameters
        ----------
        portfolio_weights : Dict[str, float]
            Asset symbol to weight mapping.
        assets : List[Asset]
            List of institutional assets.
        metrics : PortfolioMetrics
            Calculated portfolio metrics.
        policy : Optional[TreasuryPolicy]
            Configured treasury policy parameters.

        Returns
        -------
        PolicyEvaluation
            Detailed evaluation of all checks, breach statuses, and overall risk state.
        """
        pol = policy or TreasuryPolicy()
        checks: List[PolicyCheckResult] = []
        breached_checks: List[str] = []
        warning_checks: List[str] = []

        # 1. Check: Portfolio Liquidity Score (Higher is safer: current >= limit)
        liq_score = metrics.weighted_liquidity_score
        liq_limit = pol.min_liquidity_score
        liq_utilization = (liq_score / liq_limit) if liq_limit > 0 else 1.0

        # Critical floor: if liquidity falls below 75% of limit
        crit_floor = liq_limit * (2.0 - pol.critical_multiplier)
        warn_floor = liq_limit * (1.0 + (1.0 - pol.warning_threshold))

        if liq_score < crit_floor:
            liq_status = RiskState.CRITICAL.value
            liq_exp = f"Critical liquidity deficiency: {liq_score:.2f} is far below minimum policy threshold {liq_limit:.2f}."
            breached_checks.append("Portfolio Liquidity")
        elif liq_score < liq_limit:
            liq_status = RiskState.BREACH.value
            liq_exp = f"Liquidity floor breached: {liq_score:.2f} is below policy minimum {liq_limit:.2f}."
            breached_checks.append("Portfolio Liquidity")
        elif liq_score <= warn_floor:
            liq_status = RiskState.WARNING.value
            liq_exp = f"Liquidity approaching minimum threshold: {liq_score:.2f} is near floor {liq_limit:.2f}."
            warning_checks.append("Portfolio Liquidity")
        else:
            liq_status = RiskState.NORMAL.value
            liq_exp = f"Liquidity comfortably compliant: {liq_score:.2f} exceeds minimum {liq_limit:.2f}."

        checks.append(PolicyCheckResult(
            name="Portfolio Liquidity",
            current_value=liq_score,
            limit=liq_limit,
            utilization_pct=liq_utilization * 100.0,
            status=liq_status,
            operator=">=",
            explanation=liq_exp,
        ))

        # 2. Check: Equity / Strategic Exposure (Lower is safer: current <= limit)
        equity_symbols = [
            a.symbol for a in assets
            if a.asset_class in [AssetClass.STRATEGIC_YIELD.value, "Equity", "Equities"]
            or "equity" in a.asset_class.lower()
            or "strategic" in a.asset_class.lower()
        ]
        equity_exposure = sum(portfolio_weights.get(s, 0.0) for s in equity_symbols)
        eq_limit = pol.max_equity_weight
        eq_util = (equity_exposure / eq_limit) if eq_limit > 0 else 0.0

        if equity_exposure > eq_limit * pol.critical_multiplier:
            eq_status = RiskState.CRITICAL.value
            eq_exp = f"Critical equity exposure: {equity_exposure:.1%} severely exceeds policy cap {eq_limit:.1%}."
            breached_checks.append("Equity Exposure")
        elif equity_exposure > eq_limit + 1e-5:
            eq_status = RiskState.BREACH.value
            eq_exp = f"Equity exposure breached: {equity_exposure:.1%} exceeds maximum policy limit {eq_limit:.1%}."
            breached_checks.append("Equity Exposure")
        elif equity_exposure >= eq_limit * pol.warning_threshold:
            eq_status = RiskState.WARNING.value
            eq_exp = f"Equity exposure in warning band: {equity_exposure:.1%} is at {eq_util:.0%} of limit {eq_limit:.1%}."
            warning_checks.append("Equity Exposure")
        else:
            eq_status = RiskState.NORMAL.value
            eq_exp = f"Equity exposure compliant: {equity_exposure:.1%} is within limit {eq_limit:.1%}."

        checks.append(PolicyCheckResult(
            name="Equity Exposure",
            current_value=equity_exposure,
            limit=eq_limit,
            utilization_pct=eq_util * 100.0,
            status=eq_status,
            operator="<=",
            explanation=eq_exp,
        ))

        # 3. Check: Largest Single-Asset Exposure (Lower is safer: current <= limit)
        top_weight = metrics.largest_exposure_weight
        top_symbol = metrics.largest_exposure_asset
        single_limit = pol.max_single_asset_weight
        single_util = (top_weight / single_limit) if single_limit > 0 else 0.0

        if top_weight > single_limit * pol.critical_multiplier:
            single_status = RiskState.CRITICAL.value
            single_exp = f"Critical concentration: [{top_symbol}] allocation {top_weight:.1%} severely exceeds single-asset limit {single_limit:.1%}."
            breached_checks.append("Single Asset Exposure")
        elif top_weight > single_limit + 1e-5:
            single_status = RiskState.BREACH.value
            single_exp = f"Single-asset concentration breached: [{top_symbol}] allocation {top_weight:.1%} exceeds cap {single_limit:.1%}."
            breached_checks.append("Single Asset Exposure")
        elif top_weight >= single_limit * pol.warning_threshold:
            single_status = RiskState.WARNING.value
            single_exp = f"Single-asset exposure in warning band: [{top_symbol}] allocation {top_weight:.1%} is at {single_util:.0%} of limit {single_limit:.1%}."
            warning_checks.append("Single Asset Exposure")
        else:
            single_status = RiskState.NORMAL.value
            single_exp = f"Single-asset concentration compliant: max asset [{top_symbol}] allocation {top_weight:.1%} is within limit {single_limit:.1%}."

        checks.append(PolicyCheckResult(
            name="Single Asset Exposure",
            current_value=top_weight,
            limit=single_limit,
            utilization_pct=single_util * 100.0,
            status=single_status,
            operator="<=",
            explanation=single_exp,
        ))

        # 4. Check: Portfolio CVaR 95% (Lower is safer: current <= limit)
        cvar_val = metrics.cvar_95_historical
        cvar_limit = pol.max_cvar
        cvar_util = (cvar_val / cvar_limit) if cvar_limit > 0 else 0.0

        if cvar_val > cvar_limit * pol.critical_multiplier:
            cvar_status = RiskState.CRITICAL.value
            cvar_exp = f"Critical tail risk: 95% CVaR of {cvar_val:.2%} severely exceeds policy ceiling {cvar_limit:.2%}."
            breached_checks.append("Maximum CVaR")
        elif cvar_val > cvar_limit + 1e-5:
            cvar_status = RiskState.BREACH.value
            cvar_exp = f"Maximum CVaR breached: 95% CVaR of {cvar_val:.2%} exceeds risk ceiling {cvar_limit:.2%}."
            breached_checks.append("Maximum CVaR")
        elif cvar_val >= cvar_limit * pol.warning_threshold:
            cvar_status = RiskState.WARNING.value
            cvar_exp = f"Tail risk in warning band: 95% CVaR of {cvar_val:.2%} is at {cvar_util:.0%} of limit {cvar_limit:.2%}."
            warning_checks.append("Maximum CVaR")
        else:
            cvar_status = RiskState.NORMAL.value
            cvar_exp = f"Tail risk compliant: 95% CVaR of {cvar_val:.2%} is within risk ceiling {cvar_limit:.2%}."

        checks.append(PolicyCheckResult(
            name="Maximum CVaR",
            current_value=cvar_val,
            limit=cvar_limit,
            utilization_pct=cvar_util * 100.0,
            status=cvar_status,
            operator="<=",
            explanation=cvar_exp,
        ))

        # 5. Check: Maximum Drawdown (Lower is safer: current <= limit)
        mdd_val = metrics.max_drawdown
        mdd_limit = pol.max_drawdown
        mdd_util = (mdd_val / mdd_limit) if mdd_limit > 0 else 0.0

        if mdd_val > mdd_limit * pol.critical_multiplier:
            mdd_status = RiskState.CRITICAL.value
            mdd_exp = f"Critical drawdown: historical drawdown {mdd_val:.2%} severely exceeds ceiling {mdd_limit:.2%}."
            breached_checks.append("Maximum Drawdown")
        elif mdd_val > mdd_limit + 1e-4:
            mdd_status = RiskState.BREACH.value
            mdd_exp = f"Maximum drawdown breached: historical drawdown {mdd_val:.2%} exceeds ceiling {mdd_limit:.2%}."
            breached_checks.append("Maximum Drawdown")
        elif mdd_val >= mdd_limit * pol.warning_threshold:
            mdd_status = RiskState.WARNING.value
            mdd_exp = f"Drawdown in warning band: historical drawdown {mdd_val:.2%} is at {mdd_util:.0%} of limit {mdd_limit:.2%}."
            warning_checks.append("Maximum Drawdown")
        else:
            mdd_status = RiskState.NORMAL.value
            mdd_exp = f"Drawdown compliant: historical drawdown {mdd_val:.2%} is within ceiling {mdd_limit:.2%}."

        checks.append(PolicyCheckResult(
            name="Maximum Drawdown",
            current_value=mdd_val,
            limit=mdd_limit,
            utilization_pct=mdd_util * 100.0,
            status=mdd_status,
            operator="<=",
            explanation=mdd_exp,
        ))

        # Determine Overall Status
        statuses = [c.status for c in checks]
        has_critical = any(s == RiskState.CRITICAL.value for s in statuses)
        num_breaches = sum(1 for s in statuses if s in [RiskState.BREACH.value, RiskState.CRITICAL.value])

        if has_critical or num_breaches >= 2:
            overall = RiskState.CRITICAL.value
            summary = (
                f"CRITICAL RISK STATE: {num_breaches} policy limit(s) violated. "
                "Severe capital preservation breach requires immediate defensive rebalancing."
            )
        elif num_breaches == 1:
            overall = RiskState.BREACH.value
            summary = (
                f"POLICY BREACH: Constraint '{breached_checks[0]}' violated. "
                "Defensive rebalancing required to restore compliance."
            )
        elif any(s == RiskState.WARNING.value for s in statuses):
            overall = RiskState.WARNING.value
            summary = (
                f"WARNING STATE: {len(warning_checks)} metric(s) approaching policy limit: {', '.join(warning_checks)}. "
                "Monitoring advised."
            )
        else:
            overall = RiskState.NORMAL.value
            summary = "NORMAL STATE: All risk, liquidity, and concentration metrics are compliant within policy limits."

        return PolicyEvaluation(
            overall_status=overall,
            checks=checks,
            breached_checks=breached_checks,
            warning_checks=warning_checks,
            requires_rebalance=overall in [RiskState.BREACH.value, RiskState.CRITICAL.value],
            summary_explanation=summary,
        )

    def calculate_drift(
        self,
        current_weights: Dict[str, float],
        target_weights: Dict[str, float],
        total_capital: float,
        drift_threshold: float = 0.03,
    ) -> Tuple[List[AssetDrift], float, bool]:
        """Calculates asset-level drift and total portfolio turnover.

        Formula:
            Drift_i = |w_target_i - w_current_i|
            Turnover = 0.5 * sum_i |w_target_i - w_current_i|

        Parameters
        ----------
        current_weights : Dict[str, float]
            Current portfolio weights.
        target_weights : Dict[str, float]
            Proposed/target portfolio weights.
        total_capital : float
            Capital pool size.
        drift_threshold : float
            Threshold exceeding which rebalancing is required.

        Returns
        -------
        Tuple[List[AssetDrift], float, bool]
            (asset_drifts, turnover, rebalance_required)
        """
        all_symbols = sorted(set(current_weights.keys()).union(set(target_weights.keys())))
        drifts: List[AssetDrift] = []
        turnover_sum = 0.0
        rebalance_required = False

        for sym in all_symbols:
            w_curr = current_weights.get(sym, 0.0)
            w_tgt = target_weights.get(sym, 0.0)
            diff = abs(w_tgt - w_curr)
            turnover_sum += diff
            needed = diff > drift_threshold
            if needed:
                rebalance_required = True

            drifts.append(AssetDrift(
                symbol=sym,
                current_weight=w_curr,
                target_weight=w_tgt,
                drift=diff,
                drift_monetary=diff * total_capital,
                rebalance_required=needed,
            ))

        turnover = 0.5 * turnover_sum
        return drifts, turnover, rebalance_required

    def execute_defensive_rebalance(
        self,
        current_weights: Dict[str, float],
        assets: List[Asset],
        historical_returns: pd.DataFrame,
        policy: Optional[TreasuryPolicy] = None,
        total_capital: float = 10_000_000.0,
        risk_free_rate: float = 0.045,
    ) -> DefensiveRebalanceResult:
        """Calculates a defensive rebalancing allocation to restore compliance with minimal turnover.

        Parameters
        ----------
        current_weights : Dict[str, float]
            Current allocation weights.
        assets : List[Asset]
            Asset universe.
        historical_returns : pd.DataFrame
            Historical daily percentage returns.
        policy : Optional[TreasuryPolicy]
            Treasury risk governance policy.
        total_capital : float
            Total capital pool size.
        risk_free_rate : float
            Annualized risk-free rate.

        Returns
        -------
        DefensiveRebalanceResult
            Defensive allocation recommendation and before/after risk profile.
        """
        validate_weights(current_weights, allowed_symbols=[a.symbol for a in assets])
        pol = policy or TreasuryPolicy()

        # 1. Evaluate current portfolio
        symbols = [a.symbol for a in assets]
        n_assets = len(assets)
        T_scenarios = len(historical_returns)

        # Baseline metrics calculation
        curr_metrics = self._compute_portfolio_metrics(
            current_weights, assets, historical_returns, pol.cvar_confidence_level
        )
        pre_policy = self.evaluate_policy(current_weights, assets, curr_metrics, pol)

        # If already compliant, no action needed
        if not pre_policy.requires_rebalance:
            drifts, turnover, _ = self.calculate_drift(
                current_weights, current_weights, total_capital, pol.drift_threshold
            )
            allocs = calculate_monetary_allocations(current_weights, total_capital)
            return DefensiveRebalanceResult(
                status="NO_ACTION_REQUIRED",
                initial_status=pre_policy.overall_status,
                current_weights=current_weights,
                defensive_weights=current_weights,
                current_allocations=allocs,
                defensive_allocations=allocs,
                turnover=0.0,
                asset_drifts=drifts,
                rebalance_required=False,
                current_metrics=self._metrics_to_dict(curr_metrics),
                defensive_metrics=self._metrics_to_dict(curr_metrics),
                post_rebalance_policy=pre_policy,
                explanation="Portfolio is currently compliant with institutional policy. No defensive rebalancing required.",
                message="No defensive action needed.",
                post_rebalance_capital=total_capital,
                rebalance_cost=0.0,
            )

        # 2. Formulate Defensive Optimization Problem
        # Two-stage approach:
        # Stage 1: Attempt to rebalance into the safe NORMAL zone (using buffer factor = warning_threshold * 0.98)
        # Stage 2: Fallback to exact hard policy limits if the safe buffer is unachievable
        w = cp.Variable(n_assets, name="defensive_weights")
        w_curr_vec = np.array([current_weights.get(s, 0.0) for s in symbols])
        turnover_expr = 0.5 * cp.norm1(w - w_curr_vec)

        R_mat = historical_returns[symbols].values
        alpha = pol.cvar_confidence_level
        beta = 1.0 - alpha
        liq_scores = np.array([a.liquidity_score for a in assets])
        C_mat = np.cumsum(R_mat, axis=0)
        equity_indices = [
            i for i, a in enumerate(assets)
            if a.asset_class in [AssetClass.STRATEGIC_YIELD.value, "Equity", "Equities"]
            or "equity" in a.asset_class.lower()
            or "strategic" in a.asset_class.lower()
        ]

        def _build_and_solve(buffer_factor: Optional[float] = None) -> Tuple[str, Optional[np.ndarray]]:
            b_factor = buffer_factor or 1.0
            # For lower-is-safer metrics: limit * b_factor
            # For higher-is-safer metrics (liquidity): limit * (1.0 + (1.0 - b_factor))
            inv_b_factor = 1.0 + (1.0 - b_factor)

            cvx_constraints = [
                cp.sum(w) == 1.0,
                w >= 0.0,
                w <= pol.max_single_asset_weight * b_factor,
            ]
            if equity_indices:
                cvx_constraints.append(cp.sum(w[equity_indices]) <= pol.max_equity_weight * b_factor)

            cvx_constraints.append(liq_scores @ w >= pol.min_liquidity_score * inv_b_factor)

            gamma = cp.Variable()
            u = cp.Variable(T_scenarios)
            cvx_constraints.append(u >= -R_mat @ w - gamma)
            cvx_constraints.append(u >= 0)
            cvar_expr = gamma + (1.0 / (beta * T_scenarios)) * cp.sum(u)
            cvx_constraints.append(cvar_expr <= pol.max_cvar * b_factor)

            y = C_mat @ w
            M = cp.Variable(T_scenarios)
            cvx_constraints.append(M[0] >= 0)
            cvx_constraints.append(M[0] >= y[0])
            cvx_constraints.append(M[1:] >= M[:-1])
            cvx_constraints.append(M >= y)
            cvx_constraints.append(M - y <= pol.max_drawdown * b_factor)

            objective = cp.Minimize(turnover_expr + 0.05 * cvar_expr - 0.05 * (liq_scores @ w))
            prob = cp.Problem(objective, cvx_constraints)
            try:
                prob.solve(solver=cp.CLARABEL)
                if prob.status in [cp.OPTIMAL, cp.OPTIMAL_INACCURATE]:
                    return prob.status, w.value
            except Exception:
                pass
            try:
                prob.solve(solver=cp.OSQP)
                if prob.status in [cp.OPTIMAL, cp.OPTIMAL_INACCURATE]:
                    return prob.status, w.value
            except Exception:
                pass
            return prob.status, None

        # Try Stage 1 (Safe zone target to restore to NORMAL)
        stage1_status, solved_weights = _build_and_solve(buffer_factor=pol.warning_threshold * 0.98)
        if solved_weights is None:
            # Fallback to Stage 2 (Hard policy limits)
            stage2_status, solved_weights = _build_and_solve(buffer_factor=1.0)
            if solved_weights is None:
                # Infeasible policy set
                drifts, _, _ = self.calculate_drift(current_weights, current_weights, total_capital)
                curr_allocs = calculate_monetary_allocations(current_weights, total_capital)
                return DefensiveRebalanceResult(
                    status="INFEASIBLE",
                    initial_status=pre_policy.overall_status,
                    current_weights=current_weights,
                    defensive_weights={},
                    current_allocations=curr_allocs,
                    defensive_allocations={},
                    turnover=0.0,
                    asset_drifts=drifts,
                    rebalance_required=True,
                    current_metrics=self._metrics_to_dict(curr_metrics),
                    defensive_metrics={},
                    post_rebalance_policy=pre_policy,
                    explanation="No feasible defensive allocation exists under the current policy constraints.",
                    message="No feasible defensive allocation exists under the current policy constraints.",
                    post_rebalance_capital=total_capital,
                    rebalance_cost=0.0,
                )

        # 3. Extract Defensive Weights & Normalize
        raw_w = np.array(solved_weights).flatten()
        raw_w[raw_w < 1e-7] = 0.0
        raw_w = raw_w / np.sum(raw_w)
        defensive_weights = {symbols[i]: float(raw_w[i]) for i in range(n_assets)}

        # 4. Re-calculate Defensive Metrics & Post-Rebalance Policy
        def_metrics = self._compute_portfolio_metrics(
            defensive_weights, assets, historical_returns, pol.cvar_confidence_level
        )
        post_policy = self.evaluate_policy(defensive_weights, assets, def_metrics, pol)

        # 5. Calculate Drift & Turnover
        drifts, turnover, rebalance_req = self.calculate_drift(
            current_weights, defensive_weights, total_capital, pol.drift_threshold
        )

        rebalance_cost = turnover * total_capital * 0.0010
        post_rebalance_capital = total_capital - rebalance_cost

        curr_allocs = calculate_monetary_allocations(current_weights, total_capital)
        def_allocs = calculate_monetary_allocations(defensive_weights, total_capital)

        # 6. Generate Dynamic Human-Readable Explanation
        explanation = self._generate_explanation(
            pre_policy=pre_policy,
            current_weights=current_weights,
            defensive_weights=defensive_weights,
            curr_metrics=curr_metrics,
            def_metrics=def_metrics,
            assets=assets,
            turnover=turnover,
        )

        return DefensiveRebalanceResult(
            status="SUCCESS",
            initial_status=pre_policy.overall_status,
            current_weights=current_weights,
            defensive_weights=defensive_weights,
            current_allocations=curr_allocs,
            defensive_allocations=def_allocs,
            turnover=turnover,
            asset_drifts=drifts,
            rebalance_required=rebalance_req,
            current_metrics=self._metrics_to_dict(curr_metrics),
            defensive_metrics=self._metrics_to_dict(def_metrics),
            post_rebalance_policy=post_policy,
            explanation=explanation,
            message="Defensive reallocation successfully restored compliance with institutional policy.",
            post_rebalance_capital=post_rebalance_capital,
            rebalance_cost=rebalance_cost,
        )

    def _compute_portfolio_metrics(
        self,
        weights: Dict[str, float],
        assets: List[Asset],
        historical_returns: pd.DataFrame,
        confidence_level: float,
    ) -> PortfolioMetrics:
        """Internal helper to compute complete portfolio metrics."""
        symbols = list(weights.keys())
        p_returns = calculate_portfolio_return_series(weights, historical_returns)
        exp_ret = calculate_expected_return(
            weights, historical_returns, annualized=True, periods_per_year=self.periods_per_year
        )
        cov_matrix = calculate_covariance_matrix(
            historical_returns[symbols], annualized=True, periods_per_year=self.periods_per_year
        )
        vol = calculate_portfolio_volatility(
            weights, cov_matrix, annualized=True, periods_per_year=self.periods_per_year
        )
        var_95 = calculate_historical_var(p_returns, confidence_level=confidence_level)
        cvar_95 = calculate_historical_cvar(p_returns, confidence_level=confidence_level)
        mdd = calculate_max_drawdown(p_returns)
        hhi = calculate_hhi(weights)
        top_sym, top_w = calculate_largest_exposure(weights)
        liq_scores = {a.symbol: a.liquidity_score for a in assets}
        liq_score = calculate_weighted_liquidity_score(weights, liq_scores)
        liq_tiers = {a.symbol: a.liquidity_tier for a in assets}
        from app.engine.analytics import calculate_liquidity_tier_breakdown
        tier_breakdown = calculate_liquidity_tier_breakdown(weights, liq_tiers)

        return PortfolioMetrics(
            expected_return_annualized=exp_ret,
            volatility_annualized=vol,
            sharpe_ratio=(exp_ret - 0.045) / vol if vol > 1e-8 else 0.0,
            var_95_historical=var_95,
            cvar_95_historical=cvar_95,
            var_95_monetary=var_95 * 10_000_000.0,
            cvar_95_monetary=cvar_95 * 10_000_000.0,
            max_drawdown=mdd,
            hhi_concentration=hhi,
            largest_exposure_asset=top_sym,
            largest_exposure_weight=top_w,
            weighted_liquidity_score=liq_score,
            tier_breakdown=tier_breakdown,
            monetary_allocations={},
        )

    def _metrics_to_dict(self, m: PortfolioMetrics) -> Dict[str, float]:
        """Flattens metrics into a key-value dictionary for reporting."""
        return {
            "expected_return": m.expected_return_annualized,
            "volatility": m.volatility_annualized,
            "var_95": m.var_95_historical,
            "cvar_95": m.cvar_95_historical,
            "max_drawdown": m.max_drawdown,
            "hhi": m.hhi_concentration,
            "largest_exposure": m.largest_exposure_weight,
            "liquidity_score": m.weighted_liquidity_score,
        }

    def _generate_explanation(
        self,
        pre_policy: PolicyEvaluation,
        current_weights: Dict[str, float],
        defensive_weights: Dict[str, float],
        curr_metrics: PortfolioMetrics,
        def_metrics: PortfolioMetrics,
        assets: List[Asset],
        turnover: float,
    ) -> str:
        """Constructs human-readable narrative of the defensive rebalance decision."""
        lines = []

        # 1. State identified breaches
        lines.append(f"Portfolio Risk State: {pre_policy.overall_status}")
        for b_name in pre_policy.breached_checks:
            check = next(c for c in pre_policy.checks if c.name == b_name)
            lines.append(f"- {b_name} is above the configured maximum limit ({check.current_value:.2%} vs limit {check.limit:.2%}).")

        # 2. Describe reallocation actions
        reduced_assets = [
            f"{s} ({defensive_weights[s] - current_weights.get(s, 0.0):+.1%})"
            for s in current_weights
            if defensive_weights.get(s, 0.0) < current_weights.get(s, 0.0) - 0.005
        ]
        increased_assets = [
            f"{s} ({defensive_weights[s] - current_weights.get(s, 0.0):+.1%})"
            for s in defensive_weights
            if defensive_weights.get(s, 0.0) > current_weights.get(s, 0.0) + 0.005
        ]

        if reduced_assets and increased_assets:
            lines.append(
                f"Defensive reallocation reduces high-risk exposure in [{', '.join(reduced_assets)}] "
                f"and increases defensive allocation into liquid fixed-income/cash [{', '.join(increased_assets)}]."
            )

        # 3. Before/After comparisons
        equity_symbols = [
            a.symbol for a in assets
            if a.asset_class in [AssetClass.STRATEGIC_YIELD.value, "Equity", "Equities"]
            or "equity" in a.asset_class.lower()
            or "strategic" in a.asset_class.lower()
        ]
        curr_eq = sum(current_weights.get(s, 0.0) for s in equity_symbols)
        def_eq = sum(defensive_weights.get(s, 0.0) for s in equity_symbols)

        lines.append("\nKey Policy Metrics (Before -> After):")
        lines.append(f"- CVaR (95%): {curr_metrics.cvar_95_historical:.2%} -> {def_metrics.cvar_95_historical:.2%}")
        lines.append(f"- Liquidity Score: {curr_metrics.weighted_liquidity_score:.2f} -> {def_metrics.weighted_liquidity_score:.2f}")
        lines.append(f"- Equity / Strategic Exposure: {curr_eq:.1%} -> {def_eq:.1%}")
        lines.append(f"- Maximum Drawdown: {curr_metrics.max_drawdown:.2%} -> {def_metrics.max_drawdown:.2%}")
        lines.append(f"- Required Portfolio Turnover: {turnover:.1%}")

        return "\n".join(lines)
