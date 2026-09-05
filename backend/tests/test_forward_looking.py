"""Tests for Liquidity Outlook and Scenario-Based Portfolio Projections."""
import pytest
from fastapi.testclient import TestClient

from backend.app.engine.liquidity_outlook import LiquidityOutlookEngine
from backend.app.engine.projection import PortfolioProjectionEngine
from backend.app.engine.risk import TreasuryRiskEngine
from backend.app.engine.synthetic_data import (
    INDIAN_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from backend.app.main import app
from backend.app.schemas.portfolio import PortfolioConfig

client = TestClient(app)


@pytest.fixture
def indian_portfolio():
    assets = INDIAN_INSTITUTIONAL_ASSETS
    returns_df = generate_deterministic_synthetic_returns(assets, n_periods=252, seed=42)
    weights = {
        "INR_CASH": 0.20,
        "IN_TBILL_91D": 0.35,
        "IN_GSEC_10Y": 0.15,
        "IN_CP_90D": 0.10,
        "IN_CD_3M": 0.10,
        "IN_CORP_AAA": 0.05,
        "IN_GOLD": 0.05,
    }
    capital = 1_000_000_000.0  # ₹100 Cr
    config = PortfolioConfig(
        portfolio_id="TEST_OUTLOOK",
        name="Test Outlook Portfolio",
        assets=assets,
        weights=weights,
        total_capital=capital,
    )
    risk_engine = TreasuryRiskEngine()
    metrics = risk_engine.evaluate_portfolio(config, returns_df)
    return config, returns_df, metrics, capital, weights


# ==============================================================================
# 1. LIQUIDITY OUTLOOK TESTS
# ==============================================================================

def test_liquidity_outlook_engine_calculations(indian_portfolio):
    """Verifies liquidity coverage ratios across 7D, 30D, 90D, and 180D."""
    config, returns_df, metrics, capital, weights = indian_portfolio
    engine = LiquidityOutlookEngine()
    result = engine.evaluate(config, metrics)

    assert result.capital == capital
    assert len(result.horizons) == 4
    days = [h.horizon_days for h in result.horizons]
    assert days == [7, 30, 90, 180]

    for h in result.horizons:
        assert h.available_liquid_capital > 0.0
        assert h.baseline_outflow_need > 0.0
        assert h.stressed_available_capital <= h.available_liquid_capital
        assert h.stress_coverage_ratio <= h.baseline_coverage_ratio + 1e-4
        assert h.status in ["HEALTHY", "WATCH", "AT_RISK"]
        assert h.policy_minimum_ratio == 1.00


def test_liquidity_outlook_api_endpoint():
    """Verifies POST /api/v1/risk/liquidity-outlook HTTP response."""
    payload = {
        "capital": 1_000_000_000.0,
        "weights": {
            "INR_CASH": 0.20,
            "IN_TBILL_91D": 0.35,
            "IN_GSEC_10Y": 0.15,
            "IN_CP_90D": 0.10,
            "IN_CD_3M": 0.10,
            "IN_CORP_AAA": 0.05,
            "IN_GOLD": 0.05,
        },
        "selected_horizon_days": 30,
    }
    response = client.post("/api/v1/risk/liquidity-outlook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["capital"] == 1_000_000_000.0
    assert len(data["horizons"]) == 4
    h30 = next(h for h in data["horizons"] if h["horizon_days"] == 30)
    assert h30["stress_coverage_ratio"] > 0.5


# ==============================================================================
# 2. PORTFOLIO PROJECTION TESTS
# ==============================================================================

def test_portfolio_projection_engine_calculations(indian_portfolio):
    """Verifies scenario-based range ordering and disclaimers."""
    config, returns_df, metrics, capital, weights = indian_portfolio
    engine = PortfolioProjectionEngine()
    result = engine.project(config, returns_df, metrics, selected_horizon_months=12)

    assert result.capital == capital
    assert result.expected_return_annualized > 0.0
    assert "Scenario projection — not a guaranteed forecast." in result.disclaimer
    assert "Scenario-based projection ranges" in result.methodology

    assert len(result.projections) == 3
    months = [p.horizon_months for p in result.projections]
    assert months == [3, 6, 12]

    for p in result.projections:
        # Conservative bounds
        assert p.conservative.min_value <= p.conservative.max_value
        # Base Case bounds
        assert p.base_case.min_value <= p.base_case.max_value
        # Favorable bounds
        assert p.favorable.min_value <= p.favorable.max_value
        # Ordering across scenarios: conservative min <= base min <= favorable min
        assert p.conservative.min_value <= p.base_case.min_value <= p.favorable.min_value


def test_portfolio_projection_api_endpoint():
    """Verifies POST /api/v1/portfolio/projection HTTP response."""
    payload = {
        "capital": 1_000_000_000.0,
        "weights": {
            "INR_CASH": 0.20,
            "IN_TBILL_91D": 0.35,
            "IN_GSEC_10Y": 0.15,
            "IN_CP_90D": 0.10,
            "IN_CD_3M": 0.10,
            "IN_CORP_AAA": 0.05,
            "IN_GOLD": 0.05,
        },
        "selected_horizon_months": 12,
    }
    response = client.post("/api/v1/portfolio/projection", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["capital"] == 1_000_000_000.0
    assert "disclaimer" in data
    assert "Scenario projection — not a guaranteed forecast." in data["disclaimer"]
    assert len(data["projections"]) == 3
