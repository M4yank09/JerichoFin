"""Comprehensive unit and integration tests for the Portfolio Optimization Engine (Phase 2).

All tests use deterministic synthetic data and assert that mathematical constraints
are strictly satisfied in the resulting allocations.
"""
import numpy as np
import pandas as pd
import pytest

from backend.app.engine.optimizer import PortfolioOptimizer
from backend.app.engine.synthetic_data import (
    DEFAULT_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from backend.app.schemas.portfolio import (
    Asset,
    AssetClass,
    LiquidityTier,
    OptimizationConstraints,
    OptimizationResult,
)


@pytest.fixture
def test_market():
    """Provides standard institutional assets and deterministic historical returns."""
    assets = DEFAULT_INSTITUTIONAL_ASSETS
    # Generate 252 periods of deterministic synthetic returns (seed 42)
    returns_df = generate_deterministic_synthetic_returns(assets, n_periods=252, seed=42)
    return assets, returns_df


class TestPortfolioOptimizer:
    """Test suite for PortfolioOptimizer core constraints and behavior."""

    def test_basic_optimization_budget(self, test_market):
        """Test 1: Basic unconstrained (long-only) optimization produces weights summing to 1.0."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        # Optimize without restrictive caps
        result = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=OptimizationConstraints(long_only=True),
            total_capital=10_000_000.0,
        )

        assert result.status == "OPTIMAL"
        assert len(result.weights) == len(assets)
        total_w = sum(result.weights.values())
        assert pytest.approx(total_w, abs=1e-5) == 1.0

        # Without risk caps, optimizer should allocate 100% to highest return asset (STRAT_YIELD_BUF)
        assert result.largest_exposure[0] == "STRAT_YIELD_BUF"
        assert pytest.approx(result.largest_exposure[1], abs=1e-4) == 1.0

    def test_long_only_constraint(self, test_market):
        """Test 2: Long-only constraint strictly enforces w_i >= 0."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        result = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=OptimizationConstraints(long_only=True),
        )

        assert result.status == "OPTIMAL"
        for sym, w in result.weights.items():
            assert w >= -1e-6, f"Negative weight detected for {sym}: {w}"

    def test_single_asset_maximum_constraint(self, test_market):
        """Test 3: Maximum single-asset exposure w_i <= max_single_asset_weight."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        max_cap = 0.35  # Cap every asset to at most 35%
        constraints = OptimizationConstraints(
            long_only=True,
            max_single_asset_weight=max_cap,
        )

        result = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=constraints,
        )

        assert result.status == "OPTIMAL"
        assert result.largest_exposure[1] <= max_cap + 1e-5
        for sym, w in result.weights.items():
            assert w <= max_cap + 1e-5, f"Asset {sym} weight {w} exceeded cap {max_cap}"

        # Verify constraint check reported passed
        cap_check = next(c for c in result.constraint_checks if c.constraint_name == "Max Single Asset Exposure")
        assert cap_check.passed is True
        assert cap_check.actual_value <= max_cap + 1e-5

    def test_equity_allocation_limit(self, test_market):
        """Test 4: Maximum equity/strategic exposure sum(weights of equity) <= max_equity_weight."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        # Strategic yield asset is the highest expected return asset
        # Cap it to at most 15%
        max_equity = 0.15
        constraints = OptimizationConstraints(
            long_only=True,
            max_equity_weight=max_equity,
        )

        result = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=constraints,
        )

        assert result.status == "OPTIMAL"
        strat_weight = result.weights.get("STRAT_YIELD_BUF", 0.0)
        assert strat_weight <= max_equity + 1e-5

        eq_check = next(c for c in result.constraint_checks if c.constraint_name == "Max Equity Exposure")
        assert eq_check.passed is True
        assert eq_check.actual_value <= max_equity + 1e-5

    def test_minimum_liquidity_constraint(self, test_market):
        """Test 5: Weighted portfolio liquidity score must satisfy configured minimum."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        # Demand a high liquidity score (e.g. >= 0.85)
        # STRAT_YIELD_BUF has liquidity score 0.40, US_CORP_IG has 0.65, USD_CASH has 1.0
        min_liq = 0.85
        constraints = OptimizationConstraints(
            long_only=True,
            min_liquidity_score=min_liq,
        )

        result = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=constraints,
        )

        assert result.status == "OPTIMAL"
        assert result.liquidity_score >= min_liq - 1e-5

        liq_check = next(c for c in result.constraint_checks if c.constraint_name == "Minimum Liquidity Score")
        assert liq_check.passed is True
        assert liq_check.actual_value >= min_liq - 1e-5

    def test_cvar_constraint(self, test_market):
        """Test 6: Portfolio CVaR must remain below configured maximum using Rockafellar-Uryasev formulation."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        # Evaluate unconstrained CVaR (100% strategic yield has high tail risk)
        unconstrained = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=OptimizationConstraints(long_only=True),
        )
        high_cvar = unconstrained.cvar

        # Impose a strict CVaR ceiling significantly below the unconstrained CVaR
        target_cvar = high_cvar * 0.40  # 60% reduction in tail risk
        constraints = OptimizationConstraints(
            long_only=True,
            max_cvar=target_cvar,
            cvar_confidence_level=0.95,
        )

        result = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=constraints,
        )

        assert result.status == "OPTIMAL"
        assert result.cvar <= target_cvar + 1e-4
        assert result.cvar < high_cvar * 0.50
        # Verify tail risk reduction forced reallocation away from 100% strategic yield
        assert result.weights["STRAT_YIELD_BUF"] < 0.50
        assert result.weights["COMM_PAPER_30D"] + result.weights["USD_CASH"] + result.weights["US_TBILL_3M"] > 0.40

        cvar_check = next(c for c in result.constraint_checks if c.constraint_name == "Maximum CVaR (95%)")
        assert cvar_check.passed is True

    def test_drawdown_constraint(self, test_market):
        """Test 7a: Maximum drawdown constraint enforces portfolio peak-to-trough drop <= limit."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        # Unconstrained drawdown
        unconstrained = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=OptimizationConstraints(long_only=True),
        )
        high_dd = unconstrained.max_drawdown

        # Enforce max drawdown constraint
        target_dd = high_dd * 0.50
        constraints = OptimizationConstraints(
            long_only=True,
            max_drawdown=target_dd,
        )

        result = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=constraints,
        )

        assert result.status == "OPTIMAL"
        assert result.max_drawdown <= target_dd + 1e-3

        dd_check = next(c for c in result.constraint_checks if c.constraint_name == "Maximum Drawdown")
        assert dd_check.passed is True

    def test_capital_scaling(self, test_market):
        """Test 7b: Monetary allocations scale dynamically with capital pool (not hardcoded)."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        constraints = OptimizationConstraints(
            long_only=True,
            max_single_asset_weight=0.40,
        )

        # Test with $25 Million
        cap1 = 25_000_000.0
        res1 = optimizer.optimize(assets, returns_df, constraints, total_capital=cap1)
        assert pytest.approx(sum(res1.allocations.values()), rel=1e-5) == cap1
        for sym, w in res1.weights.items():
            assert pytest.approx(res1.allocations[sym], rel=1e-5) == w * cap1

        # Test with ₹100 Crore ($100M or arbitrary non-standard amount e.g. $73.5M)
        cap2 = 73_500_000.0
        res2 = optimizer.optimize(assets, returns_df, constraints, total_capital=cap2)
        assert pytest.approx(sum(res2.allocations.values()), rel=1e-5) == cap2
        for sym, w in res2.weights.items():
            assert pytest.approx(res2.allocations[sym], rel=1e-5) == w * cap2

    def test_infeasible_constraint_set(self, test_market):
        """Test 8: Conflicting constraints return INFEASIBLE status without crashing."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        # Infeasible setup: 5 assets, max single asset cap 10% (sum <= 50% < 100%)
        impossible_constraints = OptimizationConstraints(
            long_only=True,
            max_single_asset_weight=0.10,  # Impossible to sum to 1.0 with 5 assets
        )

        result = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=impossible_constraints,
        )

        assert result.status == "INFEASIBLE"
        assert result.weights == {}
        assert result.allocations == {}
        assert "infeasible" in result.message.lower()
        # Verify failed constraint check was returned
        assert len(result.constraint_checks) > 0
        assert any(c.passed is False for c in result.constraint_checks)

    def test_internally_consistent_metrics(self, test_market):
        """Test 9: Optimized portfolio metrics are internally consistent and mathematically coherent."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        constraints = OptimizationConstraints(
            long_only=True,
            max_single_asset_weight=0.35,
            min_liquidity_score=0.75,
        )

        result = optimizer.optimize(assets, returns_df, constraints)

        assert result.status == "OPTIMAL"
        # 1. Expected return is positive and reasonable
        assert 0.04 <= result.expected_return <= 0.08
        # 2. Volatility is positive
        assert result.volatility > 0.0
        # 3. VaR and CVaR coherent: CVaR >= VaR
        assert result.var > 0.0
        assert result.cvar >= result.var - 1e-6
        # 4. Max drawdown non-negative
        assert result.max_drawdown >= 0.0
        # 5. HHI matches weight squares
        expected_hhi = sum(w**2 for w in result.weights.values())
        assert pytest.approx(result.hhi, rel=1e-5) == expected_hhi
        # 6. Largest exposure matches maximum weight
        max_sym, max_w = result.largest_exposure
        assert result.weights[max_sym] == max_w
        assert max_w == max(result.weights.values())
        # 7. Monetary allocations match total capital
        assert pytest.approx(sum(result.allocations.values()), rel=1e-5) == 10_000_000.0

    def test_input_validation_errors(self, test_market):
        """Test input error handling for invalid assets, capital, and data."""
        assets, returns_df = test_market
        optimizer = PortfolioOptimizer()

        # Empty assets
        with pytest.raises(ValueError, match="Asset universe cannot be empty"):
            optimizer.optimize([], returns_df)

        # Non-positive capital
        with pytest.raises(ValueError, match="total_capital must be strictly positive"):
            optimizer.optimize(assets, returns_df, total_capital=-500.0)

        # Missing asset columns in returns
        bad_returns = returns_df.drop(columns=["USD_CASH"])
        with pytest.raises(ValueError, match="missing required asset columns"):
            optimizer.optimize(assets, bad_returns)

        # Insufficient historical scenarios (< 20)
        tiny_returns = returns_df.iloc[:10]
        with pytest.raises(ValueError, match="Insufficient historical return scenarios"):
            optimizer.optimize(assets, tiny_returns)
