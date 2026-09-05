"""Unit and integration tests for the Risk Control and Defensive Rebalancing Engine (Phase 3).

Validates policy checking (NORMAL, WARNING, BREACH, CRITICAL), dynamic defensive rebalancing,
drift/turnover calculations, capital scaling, and dynamic explainability.
"""
import numpy as np
import pandas as pd
import pytest

from backend.app.engine.risk import TreasuryRiskEngine
from backend.app.engine.risk_controller import RiskControlEngine
from backend.app.engine.synthetic_data import (
    DEFAULT_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from backend.app.schemas.portfolio import (
    Asset,
    AssetClass,
    LiquidityTier,
    PortfolioConfig,
    RiskState,
    TreasuryPolicy,
)


@pytest.fixture
def risk_market():
    """Provides standard institutional assets, deterministic returns, and engines."""
    assets = DEFAULT_INSTITUTIONAL_ASSETS
    returns_df = generate_deterministic_synthetic_returns(assets, n_periods=252, seed=42)
    risk_engine = TreasuryRiskEngine(confidence_level=0.95, periods_per_year=252)
    control_engine = RiskControlEngine(periods_per_year=252)
    return assets, returns_df, risk_engine, control_engine


class TestPolicyEvaluation:
    """Test suite for policy compliance evaluation across risk states."""

    def test_fully_compliant_portfolio_normal(self, risk_market):
        """Test 1: Fully compliant portfolio produces NORMAL state."""
        assets, returns_df, risk_engine, control_engine = risk_market

        # Highly conservative, highly diversified portfolio comfortably within all limits
        weights = {
            "USD_CASH": 0.25,
            "US_TBILL_3M": 0.25,
            "COMM_PAPER_30D": 0.25,
            "US_CORP_IG": 0.15,
            "STRAT_YIELD_BUF": 0.10,  # Below 15% limit * 0.85 = 12.75%
        }
        config = PortfolioConfig(
            portfolio_id="P-NORM", name="Conservative Cash Pool",
            assets=assets, weights=weights, total_capital=10_000_000.0
        )
        metrics = risk_engine.evaluate_portfolio(config, returns_df)

        policy = TreasuryPolicy(
            min_liquidity_score=0.70,
            max_equity_weight=0.15,
            max_single_asset_weight=0.35,
            max_cvar=0.025,
            max_drawdown=0.05,
        )

        evaluation = control_engine.evaluate_policy(weights, assets, metrics, policy)

        assert evaluation.overall_status == RiskState.NORMAL.value
        assert evaluation.requires_rebalance is False
        assert len(evaluation.breached_checks) == 0
        assert len(evaluation.warning_checks) == 0
        assert "NORMAL" in evaluation.summary_explanation

    def test_near_limit_portfolio_warning(self, risk_market):
        """Test 2: Risk metric in the warning band (e.g. 85%-100% of cap) produces WARNING state."""
        assets, returns_df, risk_engine, control_engine = risk_market

        # Place single-asset weight at 33% when limit is 35% (33 / 35 = 94.3% utilization -> in warning band)
        # and equity at 13.5% when limit is 15% (13.5 / 15 = 90% utilization -> in warning band)
        weights = {
            "USD_CASH": 0.33,
            "US_TBILL_3M": 0.285,
            "COMM_PAPER_30D": 0.15,
            "US_CORP_IG": 0.10,
            "STRAT_YIELD_BUF": 0.135,
        }
        config = PortfolioConfig(
            portfolio_id="P-WARN", name="Approaching Cap Pool",
            assets=assets, weights=weights, total_capital=10_000_000.0
        )
        metrics = risk_engine.evaluate_portfolio(config, returns_df)

        policy = TreasuryPolicy(
            min_liquidity_score=0.70,
            max_equity_weight=0.15,
            max_single_asset_weight=0.35,
            warning_threshold=0.85,
        )

        evaluation = control_engine.evaluate_policy(weights, assets, metrics, policy)

        assert evaluation.overall_status == RiskState.WARNING.value
        assert evaluation.requires_rebalance is False
        assert len(evaluation.breached_checks) == 0
        assert len(evaluation.warning_checks) > 0

    def test_equity_exposure_breach(self, risk_market):
        """Test 3: Equity exposure exceeding limit triggers BREACH state."""
        assets, returns_df, risk_engine, control_engine = risk_market

        # 18% strategic yield when limit is 15% (18% <= 15% * 1.30 -> BREACH, not yet critical)
        weights = {
            "USD_CASH": 0.27,
            "US_TBILL_3M": 0.25,
            "COMM_PAPER_30D": 0.15,
            "US_CORP_IG": 0.15,
            "STRAT_YIELD_BUF": 0.18,  # Exceeds 15% cap, sum = 1.0
        }
        config = PortfolioConfig(
            portfolio_id="P-BREACH-EQ", name="Equity Breach Pool",
            assets=assets, weights=weights, total_capital=10_000_000.0
        )
        metrics = risk_engine.evaluate_portfolio(config, returns_df)

        policy = TreasuryPolicy(
            max_equity_weight=0.15,
            max_single_asset_weight=0.35,
            critical_multiplier=1.30,  # 15% * 1.30 = 19.5%
        )

        evaluation = control_engine.evaluate_policy(weights, assets, metrics, policy)

        assert evaluation.overall_status == RiskState.BREACH.value
        assert evaluation.requires_rebalance is True
        assert "Equity Exposure" in evaluation.breached_checks

    def test_single_asset_exposure_breach(self, risk_market):
        """Test 4: Single-asset concentration exceeding cap triggers BREACH state."""
        assets, returns_df, risk_engine, control_engine = risk_market

        # 40% in US_TBILL_3M when single-asset cap is 35%
        weights = {
            "USD_CASH": 0.20,
            "US_TBILL_3M": 0.40,  # Breach
            "COMM_PAPER_30D": 0.20,
            "US_CORP_IG": 0.15,
            "STRAT_YIELD_BUF": 0.05,
        }
        config = PortfolioConfig(
            portfolio_id="P-BREACH-SINGLE", name="Concentration Breach Pool",
            assets=assets, weights=weights, total_capital=10_000_000.0
        )
        metrics = risk_engine.evaluate_portfolio(config, returns_df)

        policy = TreasuryPolicy(
            max_single_asset_weight=0.35,
            critical_multiplier=1.25,  # 35% * 1.25 = 43.75%
        )

        evaluation = control_engine.evaluate_policy(weights, assets, metrics, policy)

        assert evaluation.overall_status == RiskState.BREACH.value
        assert "Single Asset Exposure" in evaluation.breached_checks

    def test_cvar_breach(self, risk_market):
        """Test 5: Portfolio CVaR exceeding maximum risk ceiling triggers BREACH state."""
        assets, returns_df, risk_engine, control_engine = risk_market

        weights = {
            "USD_CASH": 0.10,
            "US_TBILL_3M": 0.10,
            "COMM_PAPER_30D": 0.20,
            "US_CORP_IG": 0.30,
            "STRAT_YIELD_BUF": 0.30,
        }
        config = PortfolioConfig(
            portfolio_id="P-BREACH-CVAR", name="High CVaR Pool",
            assets=assets, weights=weights, total_capital=10_000_000.0
        )
        metrics = risk_engine.evaluate_portfolio(config, returns_df)

        # Set limit slightly below current CVaR so it triggers a breach
        tight_cvar = metrics.cvar_95_historical * 0.90
        policy = TreasuryPolicy(
            max_cvar=tight_cvar,
            critical_multiplier=1.40,
            max_single_asset_weight=0.50,
            max_equity_weight=0.50,
        )

        evaluation = control_engine.evaluate_policy(weights, assets, metrics, policy)

        assert evaluation.overall_status in [RiskState.BREACH.value, RiskState.CRITICAL.value]
        assert "Maximum CVaR" in evaluation.breached_checks

    def test_liquidity_breach(self, risk_market):
        """Test 6: Liquidity score falling below minimum triggers BREACH state."""
        assets, returns_df, risk_engine, control_engine = risk_market

        # Heavy allocation in low-liquidity assets (STRAT_YIELD_BUF liq=0.40, US_CORP_IG liq=0.65)
        weights = {
            "USD_CASH": 0.05,
            "US_TBILL_3M": 0.05,
            "COMM_PAPER_30D": 0.10,
            "US_CORP_IG": 0.40,
            "STRAT_YIELD_BUF": 0.40,
        }
        config = PortfolioConfig(
            portfolio_id="P-BREACH-LIQ", name="Illiquid Pool",
            assets=assets, weights=weights, total_capital=10_000_000.0
        )
        metrics = risk_engine.evaluate_portfolio(config, returns_df)

        # Demand high liquidity (>= 0.85)
        policy = TreasuryPolicy(
            min_liquidity_score=0.85,
            critical_multiplier=1.25,
            max_single_asset_weight=0.50,
            max_equity_weight=0.50,
            max_cvar=0.10,
        )

        evaluation = control_engine.evaluate_policy(weights, assets, metrics, policy)

        assert evaluation.overall_status in [RiskState.BREACH.value, RiskState.CRITICAL.value]
        assert "Portfolio Liquidity" in evaluation.breached_checks

    def test_severe_multi_limit_critical(self, risk_market):
        """Test 7: Multiple limit breaches or severe excess triggers CRITICAL state."""
        assets, returns_df, risk_engine, control_engine = risk_market

        # Severe portfolio: 80% strategic yield (massive breach of equity, single-asset, and cvar)
        weights = {
            "USD_CASH": 0.05,
            "US_TBILL_3M": 0.05,
            "COMM_PAPER_30D": 0.05,
            "US_CORP_IG": 0.05,
            "STRAT_YIELD_BUF": 0.80,  # 80% vs 15% limit -> > 500% utilization!
        }
        config = PortfolioConfig(
            portfolio_id="P-CRIT", name="Severe Risk Pool",
            assets=assets, weights=weights, total_capital=10_000_000.0
        )
        metrics = risk_engine.evaluate_portfolio(config, returns_df)

        policy = TreasuryPolicy(
            max_equity_weight=0.15,
            max_single_asset_weight=0.35,
            min_liquidity_score=0.75,
            max_cvar=0.015,
        )

        evaluation = control_engine.evaluate_policy(weights, assets, metrics, policy)

        assert evaluation.overall_status == RiskState.CRITICAL.value
        assert evaluation.requires_rebalance is True
        assert len(evaluation.breached_checks) >= 2
        assert "CRITICAL" in evaluation.summary_explanation


class TestDefensiveRebalancing:
    """Test suite for automated convex defensive rebalancing engine."""

    def test_defensive_rebalance_restores_compliance(self, risk_market):
        """Test 8: Defensive rebalancing restores compliance to NORMAL state."""
        assets, returns_df, risk_engine, control_engine = risk_market

        # Breach portfolio: 60% in high risk strategic yield
        weights = {
            "USD_CASH": 0.10,
            "US_TBILL_3M": 0.10,
            "COMM_PAPER_30D": 0.10,
            "US_CORP_IG": 0.10,
            "STRAT_YIELD_BUF": 0.60,
        }

        policy = TreasuryPolicy(
            min_liquidity_score=0.75,
            max_equity_weight=0.15,
            max_single_asset_weight=0.35,
            max_cvar=0.015,
            max_drawdown=0.04,
        )

        result = control_engine.execute_defensive_rebalance(
            current_weights=weights,
            assets=assets,
            historical_returns=returns_df,
            policy=policy,
            total_capital=25_000_000.0,
        )

        assert result.status == "SUCCESS"
        assert result.initial_status in [RiskState.BREACH.value, RiskState.CRITICAL.value]
        # Verify that post-rebalance policy is restored to NORMAL
        assert result.post_rebalance_policy.overall_status == RiskState.NORMAL.value
        assert len(result.post_rebalance_policy.breached_checks) == 0

    def test_defensive_weights_sum_to_one(self, risk_market):
        """Test 9: Defensive allocation weights sum to exactly 1.0."""
        assets, returns_df, risk_engine, control_engine = risk_market

        weights = {
            "USD_CASH": 0.05, "US_TBILL_3M": 0.05, "COMM_PAPER_30D": 0.10,
            "US_CORP_IG": 0.30, "STRAT_YIELD_BUF": 0.50,
        }
        policy = TreasuryPolicy(max_equity_weight=0.15, max_single_asset_weight=0.35)

        result = control_engine.execute_defensive_rebalance(weights, assets, returns_df, policy)
        assert result.status == "SUCCESS"
        assert pytest.approx(sum(result.defensive_weights.values()), abs=1e-5) == 1.0

    def test_defensive_weights_remain_non_negative(self, risk_market):
        """Test 10: Defensive allocation enforces long-only mandate (w_i >= 0)."""
        assets, returns_df, risk_engine, control_engine = risk_market

        weights = {
            "USD_CASH": 0.05, "US_TBILL_3M": 0.05, "COMM_PAPER_30D": 0.10,
            "US_CORP_IG": 0.30, "STRAT_YIELD_BUF": 0.50,
        }
        policy = TreasuryPolicy(max_equity_weight=0.15, max_single_asset_weight=0.35)

        result = control_engine.execute_defensive_rebalance(weights, assets, returns_df, policy)
        assert result.status == "SUCCESS"
        for sym, w in result.defensive_weights.items():
            assert w >= -1e-6, f"Asset {sym} received negative weight: {w}"

    def test_turnover_calculation(self, risk_market):
        """Test 11: Portfolio turnover is calculated accurately as 0.5 * sum(|w_new - w_old|)."""
        assets, returns_df, risk_engine, control_engine = risk_market

        weights_a = {"USD_CASH": 0.60, "US_TBILL_3M": 0.40}
        weights_b = {"USD_CASH": 0.30, "US_TBILL_3M": 0.70}
        # Absolute differences: |0.30 - 0.60| = 0.30, |0.70 - 0.40| = 0.30
        # Sum = 0.60, Turnover = 0.5 * 0.60 = 0.30 (30%)
        _, turnover, req = control_engine.calculate_drift(weights_a, weights_b, total_capital=1e7, drift_threshold=0.03)
        assert pytest.approx(turnover, rel=1e-6) == 0.30
        assert req is True

    def test_drift_rebalance_threshold(self, risk_market):
        """Test 12: Rebalance requirement flags assets exceeding drift threshold."""
        assets, returns_df, risk_engine, control_engine = risk_market

        # Drift for CASH is 2% (below 3% threshold), drift for TBILL is 4% (above 3% threshold)
        weights_a = {"CASH": 0.50, "TBILL": 0.50}
        weights_b = {"CASH": 0.52, "TBILL": 0.46}  # Note: 0.02 and 0.04 drift
        drifts, _, req = control_engine.calculate_drift(weights_a, weights_b, total_capital=1e6, drift_threshold=0.03)

        cash_drift = next(d for d in drifts if d.symbol == "CASH")
        tbill_drift = next(d for d in drifts if d.symbol == "TBILL")

        assert cash_drift.rebalance_required is False
        assert tbill_drift.rebalance_required is True
        assert req is True

    def test_capital_scaling(self, risk_market):
        """Test 13: Monetary allocations scale with input capital (e.g. $10M vs $85M)."""
        assets, returns_df, risk_engine, control_engine = risk_market

        weights = {
            "USD_CASH": 0.10, "US_TBILL_3M": 0.10, "COMM_PAPER_30D": 0.10,
            "US_CORP_IG": 0.20, "STRAT_YIELD_BUF": 0.50,
        }
        policy = TreasuryPolicy(max_equity_weight=0.15, max_single_asset_weight=0.35)

        cap = 85_000_000.0  # $85M treasury pool
        result = control_engine.execute_defensive_rebalance(
            weights, assets, returns_df, policy, total_capital=cap
        )

        assert result.status == "SUCCESS"
        assert pytest.approx(sum(result.defensive_allocations.values()), rel=1e-5) == cap
        for sym, w in result.defensive_weights.items():
            assert pytest.approx(result.defensive_allocations[sym], rel=1e-5) == w * cap

    def test_explanation_contains_breached_policy(self, risk_market):
        """Test 14: Dynamic explanation explicitly mentions the breached constraints and actions."""
        assets, returns_df, risk_engine, control_engine = risk_market

        weights = {
            "USD_CASH": 0.10, "US_TBILL_3M": 0.10, "COMM_PAPER_30D": 0.10,
            "US_CORP_IG": 0.20, "STRAT_YIELD_BUF": 0.50,
        }
        policy = TreasuryPolicy(max_equity_weight=0.15, max_single_asset_weight=0.35)

        result = control_engine.execute_defensive_rebalance(weights, assets, returns_df, policy)

        assert result.status == "SUCCESS"
        assert "Equity Exposure" in result.explanation
        assert "Single Asset Exposure" in result.explanation
        assert "Before -> After" in result.explanation
        assert "Defensive reallocation reduces" in result.explanation

    def test_already_compliant_no_action_required(self, risk_market):
        """Test: Already compliant portfolio reports NO_ACTION_REQUIRED."""
        assets, returns_df, risk_engine, control_engine = risk_market

        weights = {
            "USD_CASH": 0.35, "US_TBILL_3M": 0.35, "COMM_PAPER_30D": 0.20,
            "US_CORP_IG": 0.10, "STRAT_YIELD_BUF": 0.00,
        }
        policy = TreasuryPolicy(max_equity_weight=0.15, max_single_asset_weight=0.35)

        result = control_engine.execute_defensive_rebalance(weights, assets, returns_df, policy)

        assert result.status == "NO_ACTION_REQUIRED"
        assert result.turnover == 0.0
        assert result.rebalance_required is False
        assert result.defensive_weights == weights

    def test_infeasible_defensive_policy(self, risk_market):
        """Test: Contradictory policy produces INFEASIBLE result without fabricating numbers."""
        assets, returns_df, risk_engine, control_engine = risk_market

        weights = {
            "USD_CASH": 0.20, "US_TBILL_3M": 0.20, "COMM_PAPER_30D": 0.20,
            "US_CORP_IG": 0.20, "STRAT_YIELD_BUF": 0.20,
        }
        # Impossible policy: 5 assets, max single asset cap 10% (sum <= 50% < 100%)
        impossible_policy = TreasuryPolicy(max_single_asset_weight=0.10)

        result = control_engine.execute_defensive_rebalance(weights, assets, returns_df, impossible_policy)

        assert result.status == "INFEASIBLE"
        assert "No feasible defensive allocation exists" in result.explanation
        assert result.defensive_weights == {}
