"""Comprehensive unit and integration tests for the Stress Testing & Scenario Analysis Engine (Phase 4).

Validates deterministic scenario evaluation, custom scenario shocks, monetary P&L,
per-asset contributions, post-shock policy evaluation, defensive response integration,
multi-scenario comparative matrices, capital scaling, and input validation.
"""
import numpy as np
import pandas as pd
import pytest

from backend.app.engine.stress_testing import StressTestingEngine, get_predefined_scenarios
from backend.app.engine.synthetic_data import (
    DEFAULT_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from backend.app.schemas.portfolio import (
    Asset,
    AssetClass,
    LiquidityTier,
    RiskState,
    StressScenario,
    TreasuryPolicy,
)


@pytest.fixture
def stress_setup():
    """Provides market assets, deterministic returns, standard policy, and stress engine."""
    assets = DEFAULT_INSTITUTIONAL_ASSETS
    returns_df = generate_deterministic_synthetic_returns(assets, n_periods=252, seed=42)
    engine = StressTestingEngine(periods_per_year=252)
    policy = TreasuryPolicy(
        min_liquidity_score=0.75,
        max_equity_weight=0.15,
        max_single_asset_weight=0.35,
        max_cvar=0.020,
        max_drawdown=0.04,
    )
    # Balanced initial baseline portfolio
    weights = {
        "USD_CASH": 0.25,
        "US_TBILL_3M": 0.25,
        "COMM_PAPER_30D": 0.20,
        "US_CORP_IG": 0.20,
        "STRAT_YIELD_BUF": 0.10,
    }
    return assets, returns_df, engine, policy, weights


class TestDeterministicScenarios:
    """Test suite for the 5 standard macroeconomic stress scenarios."""

    def test_equity_crash_scenario(self, stress_setup):
        """Test 1: Equity crash scenario applies severe drop to strategic yield and minor credit contagion."""
        assets, returns_df, engine, policy, weights = stress_setup
        scenarios = get_predefined_scenarios()
        sc = scenarios["EQUITY_CRASH"]

        result = engine.run_stress_test(
            portfolio_weights=weights,
            assets=assets,
            scenario=sc,
            historical_returns=returns_df,
            policy=policy,
            total_capital=10_000_000.0,
        )

        assert result.scenario_id == "EQUITY_CRASH"
        assert result.severity == "SEVERE"
        # Strategic yield shock is -25%, corp is -5%, CP is -1%, T-bill is +0.5%, cash is 0%
        # Expected return = 0.25(0) + 0.25(0.005) + 0.20(-0.010) + 0.20(-0.050) + 0.10(-0.250)
        #                 = 0 + 0.00125 - 0.002 - 0.010 - 0.025 = -0.03575 (-3.575%)
        assert pytest.approx(result.stressed_portfolio_return, abs=1e-5) == -0.03575
        assert pytest.approx(result.stressed_pnl, rel=1e-5) == -357_500.0
        assert pytest.approx(result.stressed_portfolio_value, rel=1e-5) == 9_642_500.0

    def test_interest_rate_shock_scenario(self, stress_setup):
        """Test 2: Interest rate surge causes duration losses in fixed-income paper."""
        assets, returns_df, engine, policy, weights = stress_setup
        scenarios = get_predefined_scenarios()
        sc = scenarios["INTEREST_RATE_SHOCK"]

        result = engine.run_stress_test(
            portfolio_weights=weights,
            assets=assets,
            scenario=sc,
            historical_returns=returns_df,
            policy=policy,
            total_capital=20_000_000.0,
        )

        assert result.scenario_id == "INTEREST_RATE_SHOCK"
        assert result.stressed_portfolio_return < 0.0
        assert result.stressed_pnl < 0.0
        assert result.stressed_portfolio_value == 20_000_000.0 + result.stressed_pnl

    def test_liquidity_crisis_scenario(self, stress_setup):
        """Test 3: Liquidity crisis penalizes illiquid credit/yield while cash remains protected."""
        assets, returns_df, engine, policy, weights = stress_setup
        scenarios = get_predefined_scenarios()
        sc = scenarios["LIQUIDITY_CRISIS"]

        result = engine.run_stress_test(
            portfolio_weights=weights,
            assets=assets,
            scenario=sc,
            historical_returns=returns_df,
            policy=policy,
            total_capital=10_000_000.0,
        )

        assert result.scenario_id == "LIQUIDITY_CRISIS"
        # Corporate shock (-10%) is larger than Sovereign (-0.5%)
        corp_impact = next(i for i in result.asset_impacts if i.symbol == "US_CORP_IG")
        tbill_impact = next(i for i in result.asset_impacts if i.symbol == "US_TBILL_3M")
        cash_impact = next(i for i in result.asset_impacts if i.symbol == "USD_CASH")

        assert corp_impact.applied_shock < tbill_impact.applied_shock
        assert cash_impact.applied_shock == 0.0

    def test_inflation_commodity_shock_scenario(self, stress_setup):
        """Test 4: Inflation shock erodes fixed-income while real assets / overlays rally."""
        assets, returns_df, engine, policy, weights = stress_setup
        scenarios = get_predefined_scenarios()
        sc = scenarios["INFLATION_SHOCK"]

        result = engine.run_stress_test(
            portfolio_weights=weights,
            assets=assets,
            scenario=sc,
            historical_returns=returns_df,
            policy=policy,
            total_capital=10_000_000.0,
        )

        assert result.scenario_id == "INFLATION_SHOCK"
        strat_impact = next(i for i in result.asset_impacts if i.symbol == "STRAT_YIELD_BUF")
        sovereign_impact = next(i for i in result.asset_impacts if i.symbol == "US_TBILL_3M")

        # Commodity overlay appreciated (+6%) while nominal sovereign lost (-7%)
        assert strat_impact.applied_shock == +0.060
        assert sovereign_impact.applied_shock == -0.070

    def test_combined_macro_shock_scenario(self, stress_setup):
        """Test 5: Combined macro crisis produces severe synchronized portfolio losses."""
        assets, returns_df, engine, policy, weights = stress_setup
        scenarios = get_predefined_scenarios()
        sc = scenarios["COMBINED_MACRO_SHOCK"]

        result = engine.run_stress_test(
            portfolio_weights=weights,
            assets=assets,
            scenario=sc,
            historical_returns=returns_df,
            policy=policy,
            total_capital=10_000_000.0,
        )

        assert result.scenario_id == "COMBINED_MACRO_SHOCK"
        assert result.severity == "EXTREME"
        # Loss must be deeper than individual equity crash
        assert result.stressed_portfolio_return < -0.04


class TestCustomAndCalculationDetails:
    """Test suite for custom scenario definitions, P&L mathematics, and contributions."""

    def test_custom_scenario(self, stress_setup):
        """Test 6: User-configured custom scenario with asset-class shocks and symbol overrides."""
        assets, returns_df, engine, policy, weights = stress_setup

        custom = StressScenario(
            scenario_id="CUSTOM_PANDEMIC",
            name="Pandemic Flash Crash",
            description="Custom simulation with specific overrides",
            asset_class_shocks={
                AssetClass.CASH_EQUIVALENTS.value: 0.0,
                AssetClass.SOVEREIGN_BONDS.value: +0.02,
                AssetClass.COMMERCIAL_PAPER.value: -0.02,
                AssetClass.CORPORATE_BONDS.value: -0.08,
                AssetClass.STRATEGIC_YIELD.value: -0.15,
            },
            symbol_shocks={
                "US_CORP_IG": -0.12,  # Symbol override overriding class default
            },
            severity="SEVERE",
        )

        result = engine.run_stress_test(
            portfolio_weights=weights,
            assets=assets,
            scenario=custom,
            historical_returns=returns_df,
            policy=policy,
            total_capital=10_000_000.0,
        )

        assert result.scenario_id == "CUSTOM_PANDEMIC"
        corp_impact = next(i for i in result.asset_impacts if i.symbol == "US_CORP_IG")
        # Verify symbol override was respected
        assert corp_impact.applied_shock == -0.12

    def test_stressed_return_calculation(self, stress_setup):
        """Test 7: Stressed portfolio return exactly matches sum of weighted shocks."""
        assets, returns_df, engine, policy, _ = stress_setup

        # Simple 2-asset portfolio: 60% Cash, 40% Strategic Yield
        simple_weights = {
            "USD_CASH": 0.60,
            "US_TBILL_3M": 0.0,
            "COMM_PAPER_30D": 0.0,
            "US_CORP_IG": 0.0,
            "STRAT_YIELD_BUF": 0.40,
        }
        sc = StressScenario(
            scenario_id="SIMPLE_TEST",
            name="Simple Test",
            description="Verification",
            asset_class_shocks={
                AssetClass.CASH_EQUIVALENTS.value: +0.01,
                AssetClass.STRATEGIC_YIELD.value: -0.10,
            },
        )

        # Expected: 0.60 * (+0.01) + 0.40 * (-0.10) = +0.006 - 0.040 = -0.034 (-3.40%)
        res = engine.run_stress_test(simple_weights, assets, sc, returns_df, policy, total_capital=1e6)
        assert pytest.approx(res.stressed_portfolio_return, abs=1e-6) == -0.034

    def test_monetary_pnl_calculation(self, stress_setup):
        """Test 8: Monetary P&L is mathematically consistent: PnL = capital * stressed_return."""
        assets, returns_df, engine, policy, weights = stress_setup
        sc = get_predefined_scenarios()["LIQUIDITY_CRISIS"]
        capital = 75_000_000.0

        res = engine.run_stress_test(weights, assets, sc, returns_df, policy, total_capital=capital)
        expected_pnl = capital * res.stressed_portfolio_return
        assert pytest.approx(res.stressed_pnl, rel=1e-6) == expected_pnl
        assert pytest.approx(res.stressed_portfolio_value, rel=1e-6) == capital + expected_pnl

    def test_per_asset_contribution(self, stress_setup):
        """Test 9: Sum of asset return and monetary contributions equals portfolio totals."""
        assets, returns_df, engine, policy, weights = stress_setup
        sc = get_predefined_scenarios()["EQUITY_CRASH"]
        capital = 12_000_000.0

        res = engine.run_stress_test(weights, assets, sc, returns_df, policy, total_capital=capital)

        sum_ret_contrib = sum(i.contribution_return for i in res.asset_impacts)
        sum_pnl_contrib = sum(i.contribution_pnl for i in res.asset_impacts)
        sum_stressed_weights = sum(res.stressed_weights.values())

        assert pytest.approx(sum_ret_contrib, abs=1e-6) == res.stressed_portfolio_return
        assert pytest.approx(sum_pnl_contrib, rel=1e-6) == res.stressed_pnl
        assert pytest.approx(sum_stressed_weights, abs=1e-5) == 1.0


class TestPolicyIntegrationAndDefensiveResponse:
    """Test suite for post-stress policy checks and defensive rebalancing responses."""

    def test_policy_evaluation_after_stress(self, stress_setup):
        """Test 10: Policy controls evaluate post-shock drifting portfolio correctly."""
        assets, returns_df, engine, policy, _ = stress_setup

        # Start with high corporate + strategic yield holdings
        risky_weights = {
            "USD_CASH": 0.05,
            "US_TBILL_3M": 0.05,
            "COMM_PAPER_30D": 0.10,
            "US_CORP_IG": 0.40,
            "STRAT_YIELD_BUF": 0.40,
        }
        sc = get_predefined_scenarios()["COMBINED_MACRO_SHOCK"]

        res = engine.run_stress_test(risky_weights, assets, sc, returns_df, policy, total_capital=10_000_000.0)

        # Extreme shock to risky portfolio triggers BREACH or CRITICAL
        assert res.policy_status in [RiskState.BREACH.value, RiskState.CRITICAL.value]
        assert len(res.breached_constraints) > 0

    def test_multiple_scenario_comparison(self, stress_setup):
        """Test 11: Multi-scenario comparison matrix runs across all scenarios."""
        assets, returns_df, engine, policy, weights = stress_setup

        comp = engine.run_multi_scenario_comparison(
            portfolio_weights=weights,
            assets=assets,
            historical_returns=returns_df,
            policy=policy,
            total_capital=50_000_000.0,
        )

        assert comp.base_capital == 50_000_000.0
        assert len(comp.scenarios) == 5
        assert set(comp.detailed_results.keys()) == set(get_predefined_scenarios().keys())

        # Verify summary items
        for s in comp.scenarios:
            assert isinstance(s.scenario_name, str)
            assert isinstance(s.stressed_return, float)
            assert s.stressed_value == comp.base_capital + s.stressed_pnl

    def test_defensive_response_after_stressed_breach(self, stress_setup):
        """Test 12: Stressed breach triggers Phase 3 defensive rebalance restoring compliance."""
        assets, returns_df, engine, policy, _ = stress_setup

        # Portfolio that triggers a breach under shock
        risky_weights = {
            "USD_CASH": 0.05,
            "US_TBILL_3M": 0.05,
            "COMM_PAPER_30D": 0.10,
            "US_CORP_IG": 0.40,
            "STRAT_YIELD_BUF": 0.40,
        }
        sc = get_predefined_scenarios()["COMBINED_MACRO_SHOCK"]

        res = engine.run_stress_test(
            portfolio_weights=risky_weights,
            assets=assets,
            scenario=sc,
            historical_returns=returns_df,
            policy=policy,
            total_capital=10_000_000.0,
            trigger_defensive_on_breach=True,
        )

        assert res.policy_status in [RiskState.BREACH.value, RiskState.CRITICAL.value]
        assert res.defensive_response is not None
        assert res.defensive_response.status == "SUCCESS"
        assert res.defensive_response.post_rebalance_policy.overall_status == RiskState.NORMAL.value
        assert res.defensive_response.turnover > 0.0
        assert "Before -> After" in res.defensive_response.explanation
        # Assert restored portfolio value reflects execution friction
        assert res.restored_portfolio_value < res.stressed_portfolio_value
        assert pytest.approx(res.restored_portfolio_value, rel=1e-5) == res.defensive_response.post_rebalance_capital
        assert res.restored_status == RiskState.NORMAL.value
        assert res.restored_cvar is not None
        assert res.restored_liquidity is not None

    def test_capital_scaling(self, stress_setup):
        """Test 13: Stress testing scales accurately with capital ($10M vs $100M)."""
        assets, returns_df, engine, policy, weights = stress_setup
        sc = get_predefined_scenarios()["EQUITY_CRASH"]

        res_10m = engine.run_stress_test(weights, assets, sc, returns_df, policy, total_capital=10_000_000.0)
        res_100m = engine.run_stress_test(weights, assets, sc, returns_df, policy, total_capital=100_000_000.0)

        # Percentage returns and stressed weights must be identical
        assert pytest.approx(res_10m.stressed_portfolio_return, abs=1e-7) == res_100m.stressed_portfolio_return
        for s in weights:
            assert pytest.approx(res_10m.stressed_weights[s], abs=1e-6) == res_100m.stressed_weights[s]

        # Monetary figures scale by 10x
        assert pytest.approx(res_100m.stressed_pnl, rel=1e-5) == res_10m.stressed_pnl * 10.0
        assert pytest.approx(res_100m.stressed_portfolio_value, rel=1e-5) == res_10m.stressed_portfolio_value * 10.0

    def test_invalid_scenario_input(self, stress_setup):
        """Test 14: Input validation catches malformed scenarios and invalid shock values."""
        assets, returns_df, engine, policy, weights = stress_setup

        # 1. Shock <= -1.0 (loss of 100% or worse)
        bad_sc_loss = StressScenario(
            scenario_id="BAD_1", name="Bad", description="Bad",
            asset_class_shocks={"Equity": -1.05},
        )
        with pytest.raises(ValueError, match="must be > -1.0"):
            engine.run_stress_test(weights, assets, bad_sc_loss, returns_df, policy)

        # 2. Shock > +200%
        bad_sc_gain = StressScenario(
            scenario_id="BAD_2", name="Bad", description="Bad",
            asset_class_shocks={"Equity": 2.50},
        )
        with pytest.raises(ValueError, match="exceeding realistic upper bound"):
            engine.run_stress_test(weights, assets, bad_sc_gain, returns_df, policy)

        # 3. Empty scenario name
        bad_sc_name = StressScenario(
            scenario_id="BAD_3", name="", description="Bad",
            asset_class_shocks={"Equity": -0.10},
        )
        with pytest.raises(ValueError, match="Scenario name must be a non-empty string"):
            engine.run_stress_test(weights, assets, bad_sc_name, returns_df, policy)

        # 4. Negative total capital
        good_sc = get_predefined_scenarios()["EQUITY_CRASH"]
        with pytest.raises(ValueError, match="total_capital must be strictly positive"):
            engine.run_stress_test(weights, assets, good_sc, returns_df, policy, total_capital=-100.0)
