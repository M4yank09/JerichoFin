"""Integration tests for TreasuryRiskEngine and Portfolio evaluation."""
import pytest
import pandas as pd

from backend.app.engine.allocator import CapitalAllocationEngine
from backend.app.engine.risk import TreasuryRiskEngine
from backend.app.engine.synthetic_data import (
    DEFAULT_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from backend.app.schemas.portfolio import PortfolioConfig


@pytest.fixture
def sample_portfolio_setup():
    """Provides a deterministic test portfolio and historical returns."""
    assets = DEFAULT_INSTITUTIONAL_ASSETS
    weights = {
        "USD_CASH": 0.30,
        "US_TBILL_3M": 0.30,
        "COMM_PAPER_30D": 0.20,
        "US_CORP_IG": 0.15,
        "STRAT_YIELD_BUF": 0.05,
    }
    config = PortfolioConfig(
        portfolio_id="PORT-INST-001",
        name="Conservative Corporate Treasury Pool",
        assets=assets,
        weights=weights,
        total_capital=50_000_000.0,
        risk_free_rate=0.045,
    )
    returns_df = generate_deterministic_synthetic_returns(assets, n_periods=252, seed=42)
    return config, returns_df


class TestTreasuryRiskEngine:
    """Test suite for TreasuryRiskEngine end-to-end evaluation."""

    def test_evaluate_portfolio_metrics(self, sample_portfolio_setup):
        config, returns_df = sample_portfolio_setup
        engine = TreasuryRiskEngine(confidence_level=0.95, periods_per_year=252)

        metrics = engine.evaluate_portfolio(config, returns_df)

        # 1. Expected return should be positive and realistic for a treasury portfolio (~4.5% to 6%)
        assert 0.04 <= metrics.expected_return_annualized <= 0.07

        # 2. Volatility should be positive and low for high-grade treasury (~0.5% to 3%)
        assert 0.005 <= metrics.volatility_annualized <= 0.030

        # 3. Sharpe ratio is finite
        assert isinstance(metrics.sharpe_ratio, float)

        # 4. VaR and CVaR (95%)
        # In risk management loss convention, VaR and CVaR are positive losses
        assert metrics.var_95_historical > 0.0
        assert metrics.cvar_95_historical > 0.0
        # Fundamental risk law: Tail expected shortfall >= VaR cutoff
        assert metrics.cvar_95_historical >= metrics.var_95_historical

        # Monetary VaR / CVaR
        assert pytest.approx(metrics.var_95_monetary, rel=1e-6) == (
            metrics.var_95_historical * config.total_capital
        )
        assert pytest.approx(metrics.cvar_95_monetary, rel=1e-6) == (
            metrics.cvar_95_historical * config.total_capital
        )

        # 5. Maximum Drawdown must be >= 0
        assert metrics.max_drawdown >= 0.0

        # 6. HHI concentration should match portfolio weights
        expected_hhi = sum(w**2 for w in config.weights.values())
        assert pytest.approx(metrics.hhi_concentration, rel=1e-6) == expected_hhi

        # 7. Largest exposure
        assert metrics.largest_exposure_asset in ["USD_CASH", "US_TBILL_3M"]
        assert pytest.approx(metrics.largest_exposure_weight, rel=1e-6) == 0.30

        # 8. Liquidity score and tier breakdown
        assert 0.80 <= metrics.weighted_liquidity_score <= 1.0
        assert pytest.approx(sum(metrics.tier_breakdown.values()), rel=1e-6) == 1.0

        # 9. Monetary allocations sum exactly to total capital
        assert pytest.approx(sum(metrics.monetary_allocations.values()), rel=1e-6) == config.total_capital

    def test_stress_test_unimplemented_raises(self):
        engine = TreasuryRiskEngine()
        with pytest.raises(NotImplementedError, match="Stress testing simulation to be implemented"):
            engine.run_stress_test({}, {})


class TestCapitalAllocationEngine:
    """Test suite for CapitalAllocationEngine."""

    def test_monetary_allocation(self, sample_portfolio_setup):
        config, _ = sample_portfolio_setup
        allocator = CapitalAllocationEngine(risk_free_rate=0.045)
        allocs = allocator.calculate_monetary_allocation(config)

        assert allocs["USD_CASH"] == 15_000_000.0  # 30% of $50M
        assert allocs["US_TBILL_3M"] == 15_000_000.0
        assert allocs["COMM_PAPER_30D"] == 10_000_000.0
        assert allocs["US_CORP_IG"] == 7_500_000.0
        assert allocs["STRAT_YIELD_BUF"] == 2_500_000.0
        assert sum(allocs.values()) == 50_000_000.0

    def test_optimize_allocation_unimplemented_raises(self):
        allocator = CapitalAllocationEngine()
        with pytest.raises(NotImplementedError, match="Allocation optimizer to be implemented"):
            allocator.optimize_allocation([])
