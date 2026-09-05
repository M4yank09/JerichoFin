"""Unit tests for foundational financial analytics functions.

Tests use small, handcrafted deterministic datasets with exact analytical solutions.
"""
import numpy as np
import pandas as pd
import pytest

from backend.app.engine.analytics import (
    calculate_covariance_matrix,
    calculate_expected_return,
    calculate_hhi,
    calculate_historical_cvar,
    calculate_historical_var,
    calculate_largest_exposure,
    calculate_liquidity_tier_breakdown,
    calculate_max_drawdown,
    calculate_monetary_allocations,
    calculate_portfolio_return_series,
    calculate_portfolio_volatility,
    calculate_weighted_liquidity_score,
    validate_weights,
)


class TestWeightValidation:
    """Test suite for portfolio weight validation rules."""

    def test_valid_weights(self):
        weights = {"USD_CASH": 0.40, "US_TBILL": 0.35, "US_CORP": 0.25}
        # Should execute cleanly without error
        validate_weights(weights, allowed_symbols=["USD_CASH", "US_TBILL", "US_CORP"])

    def test_weights_sum_violation_raises(self):
        weights = {"USD_CASH": 0.50, "US_TBILL": 0.40}  # Sum = 0.90
        with pytest.raises(ValueError, match="must sum to 1.0"):
            validate_weights(weights)

    def test_negative_weights_long_only_raises(self):
        weights = {"USD_CASH": 1.20, "US_TBILL": -0.20}
        with pytest.raises(ValueError, match="Negative weights detected"):
            validate_weights(weights, long_only=True)

    def test_empty_weights_raises(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            validate_weights({})

    def test_unknown_symbol_raises(self):
        weights = {"USD_CASH": 0.50, "UNKNOWN_ASSET": 0.50}
        with pytest.raises(ValueError, match="Unknown asset symbols"):
            validate_weights(weights, allowed_symbols=["USD_CASH", "US_TBILL"])


class TestExpectedReturn:
    """Test suite for expected portfolio return calculation."""

    def test_expected_return_from_dict(self):
        weights = {"ASSET_A": 0.60, "ASSET_B": 0.40}
        means = {"ASSET_A": 0.05, "ASSET_B": 0.10}
        # 0.60 * 0.05 + 0.40 * 0.10 = 0.030 + 0.040 = 0.070
        expected = calculate_expected_return(weights, means, annualized=False)
        assert pytest.approx(expected, rel=1e-6) == 0.070

    def test_expected_return_from_dataframe_annualized(self):
        # 4 periods, daily returns
        data = {
            "ASSET_A": [0.001, 0.002, 0.001, 0.002],  # Mean = 0.0015
            "ASSET_B": [0.002, 0.004, 0.002, 0.004],  # Mean = 0.0030
        }
        df = pd.DataFrame(data)
        weights = {"ASSET_A": 0.50, "ASSET_B": 0.50}
        # Daily expected return = 0.5 * 0.0015 + 0.5 * 0.0030 = 0.00225
        # Annualized (252 periods) = 0.00225 * 252 = 0.567
        ret = calculate_expected_return(weights, df, annualized=True, periods_per_year=252)
        assert pytest.approx(ret, rel=1e-6) == 0.567


class TestCovarianceAndVolatility:
    """Test suite for covariance matrix and portfolio volatility."""

    def test_handcrafted_covariance_and_volatility(self):
        # 3 periods:
        # Asset A: [0.01, 0.02, 0.03], Mean = 0.02, Deviations = [-0.01, 0.0, 0.01]
        # Asset B: [0.02, 0.04, 0.06], Mean = 0.04, Deviations = [-0.02, 0.0, 0.02]
        # Var(A) = 0.0002 / 2 = 0.0001
        # Var(B) = 0.0008 / 2 = 0.0004
        # Cov(A, B) = 0.0004 / 2 = 0.0002
        df = pd.DataFrame({
            "A": [0.01, 0.02, 0.03],
            "B": [0.02, 0.04, 0.06],
        })
        cov = calculate_covariance_matrix(df, annualized=False)
        assert pytest.approx(cov.loc["A", "A"], rel=1e-6) == 0.0001
        assert pytest.approx(cov.loc["B", "B"], rel=1e-6) == 0.0004
        assert pytest.approx(cov.loc["A", "B"], rel=1e-6) == 0.0002

        # Weights: 50% A, 50% B
        # Portfolio returns: [0.015, 0.030, 0.045]
        # Var_p = 0.5^2 * 0.0001 + 2 * 0.5 * 0.5 * 0.0002 + 0.5^2 * 0.0004
        #       = 0.000025 + 0.000100 + 0.000100 = 0.000225
        # Vol_p = sqrt(0.000225) = 0.015
        weights = {"A": 0.50, "B": 0.50}
        vol = calculate_portfolio_volatility(weights, cov, annualized=False)
        assert pytest.approx(vol, rel=1e-6) == 0.015


class TestVaRAndCVaR:
    """Test suite for Historical VaR and CVaR (Expected Shortfall)."""

    def test_handcrafted_var_and_cvar(self):
        # Construct 100 deterministic observations
        # Worst 5 returns: -0.10, -0.09, -0.08, -0.07, -0.06
        # Remaining 95 returns: all +0.01
        returns = [-0.10, -0.09, -0.08, -0.07, -0.06] + [0.01] * 95

        # 95% VaR: 5% lower tail quantile of 100 observations
        # The 5th percentile is -0.06
        # Under loss convention, VaR_95 = -(-0.06) = 0.06 (6% loss)
        var_95 = calculate_historical_var(returns, confidence_level=0.95)
        assert pytest.approx(var_95, abs=1e-4) == 0.06

        # 95% CVaR: Average of the worst 5 returns:
        # (-0.10 + -0.09 + -0.08 + -0.07 + -0.06) / 5 = -0.40 / 5 = -0.08
        # Under loss convention, CVaR_95 = -(-0.08) = 0.08 (8% loss)
        cvar_95 = calculate_historical_cvar(returns, confidence_level=0.95)
        assert pytest.approx(cvar_95, abs=1e-4) == 0.08

        # Inherent financial property: CVaR must be strictly greater than or equal to VaR
        assert cvar_95 >= var_95

    def test_var_invalid_confidence_raises(self):
        with pytest.raises(ValueError, match="Confidence level"):
            calculate_historical_var([0.01, -0.02], confidence_level=1.5)


class TestMaxDrawdown:
    """Test suite for Maximum Drawdown calculation."""

    def test_handcrafted_max_drawdown(self):
        # Sequence: +10%, -20%, +5%, -10%
        # Wealth index:
        # W0 = 1.0000
        # W1 = 1.1000 (Peak = 1.1000)
        # W2 = 0.8800 (Peak = 1.1000, Drawdown = -20.00%)
        # W3 = 0.9240 (Peak = 1.1000, Drawdown = -16.00%)
        # W4 = 0.8316 (Peak = 1.1000, Drawdown = (0.8316 - 1.10) / 1.10 = -24.40%)
        returns = [0.10, -0.20, 0.05, -0.10]
        mdd = calculate_max_drawdown(returns)
        assert pytest.approx(mdd, rel=1e-5) == 0.244

    def test_max_drawdown_no_decline(self):
        # All positive returns -> MDD is 0.0
        returns = [0.01, 0.02, 0.03, 0.01]
        mdd = calculate_max_drawdown(returns)
        assert mdd == 0.0


class TestConcentrationAndLiquidity:
    """Test suite for HHI concentration and liquidity scoring."""

    def test_hhi_equal_weights(self):
        # 4 equal assets: 4 * (0.25^2) = 0.25
        weights = {"A": 0.25, "B": 0.25, "C": 0.25, "D": 0.25}
        assert pytest.approx(calculate_hhi(weights), rel=1e-6) == 0.25

    def test_hhi_single_asset(self):
        # 100% single asset: 1.0^2 = 1.0
        weights = {"A": 1.0}
        assert pytest.approx(calculate_hhi(weights), rel=1e-6) == 1.0

    def test_largest_exposure(self):
        weights = {"A": 0.15, "B": 0.55, "C": 0.30}
        symbol, weight = calculate_largest_exposure(weights)
        assert symbol == "B"
        assert pytest.approx(weight, rel=1e-6) == 0.55

    def test_weighted_liquidity_score(self):
        weights = {"CASH": 0.40, "TBILL": 0.40, "CORP": 0.20}
        scores = {"CASH": 1.00, "TBILL": 0.90, "CORP": 0.60}
        # 0.40 * 1.00 + 0.40 * 0.90 + 0.20 * 0.60 = 0.40 + 0.36 + 0.12 = 0.88
        liq = calculate_weighted_liquidity_score(weights, scores)
        assert pytest.approx(liq, rel=1e-6) == 0.88

    def test_liquidity_tier_breakdown(self):
        weights = {"CASH": 0.30, "TBILL": 0.45, "CORP": 0.25}
        tiers = {"CASH": 1, "TBILL": 2, "CORP": 3}
        breakdown = calculate_liquidity_tier_breakdown(weights, tiers)
        assert pytest.approx(breakdown[1], rel=1e-6) == 0.30
        assert pytest.approx(breakdown[2], rel=1e-6) == 0.45
        assert pytest.approx(breakdown[3], rel=1e-6) == 0.25


class TestCapitalScaling:
    """Test suite for capital-to-monetary scaling."""

    def test_monetary_allocation(self):
        weights = {"USD_CASH": 0.60, "US_CORP": 0.40}
        total_capital = 25_000_000.0  # $25 Million
        alloc = calculate_monetary_allocations(weights, total_capital)

        assert pytest.approx(alloc["USD_CASH"], rel=1e-6) == 15_000_000.0
        assert pytest.approx(alloc["US_CORP"], rel=1e-6) == 10_000_000.0
        assert pytest.approx(sum(alloc.values()), rel=1e-6) == total_capital

    def test_negative_capital_raises(self):
        weights = {"USD_CASH": 1.0}
        with pytest.raises(ValueError, match="total_capital must be non-negative"):
            calculate_monetary_allocations(weights, total_capital=-1000.0)
