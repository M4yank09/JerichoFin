"""Tests for the Early Warning Engine and Proactive Decision Support."""
import pytest
from fastapi.testclient import TestClient

from backend.app.engine.early_warning import EarlyWarningEngine, EarlyWarningState
from backend.app.engine.risk import TreasuryRiskEngine
from backend.app.engine.synthetic_data import (
    DEFAULT_INSTITUTIONAL_ASSETS,
    INDIAN_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from backend.app.main import app
from backend.app.schemas.portfolio import PortfolioConfig, TreasuryPolicy

client = TestClient(app)


@pytest.fixture
def indian_market():
    assets = INDIAN_INSTITUTIONAL_ASSETS
    returns_df = generate_deterministic_synthetic_returns(assets, n_periods=252, seed=42)
    config = PortfolioConfig(
        portfolio_id="TEST_INDIAN_EW",
        name="Test Indian Early Warning",
        assets=assets,
        weights={
            "INR_CASH": 0.25,
            "IN_TBILL_91D": 0.25,
            "IN_GSEC_10Y": 0.15,
            "IN_CP_90D": 0.15,
            "IN_CD_3M": 0.10,
            "IN_CORP_AAA": 0.05,
            "IN_GOLD": 0.05,
        },
        total_capital=1_000_000_000.0,
    )
    risk_engine = TreasuryRiskEngine()
    metrics = risk_engine.evaluate_portfolio(config, returns_df)
    return assets, returns_df, config, metrics


def test_early_warning_engine_stable_portfolio(indian_market):
    """Verifies that a conservative, well-diversified portfolio produces STABLE state."""
    assets, returns_df, config, metrics = indian_market
    engine = EarlyWarningEngine()
    result = engine.evaluate(config, returns_df, metrics)

    assert result.overall_status in [EarlyWarningState.STABLE.value, EarlyWarningState.WATCH.value]
    assert len(result.signals) >= 5
    assert len(result.timeline) == 30
    assert result.timeline[0].day == 1
    assert result.timeline[-1].day == 30
    assert result.timeline[0].cvar > 0.0
    assert result.recommendation.title is not None
    assert len(result.recommendation.expected_effects) > 0


def test_early_warning_detects_high_concentration(indian_market):
    """Verifies that single-asset exposure near ceiling triggers a concentration warning."""
    assets, returns_df, config, metrics = indian_market
    
    # Concentrate 34% in one asset (near 35% cap, warning threshold 85% = 29.75%)
    concentrated_weights = {
        "INR_CASH": 0.05,
        "IN_TBILL_91D": 0.34,  # Near 35% limit
        "IN_GSEC_10Y": 0.15,
        "IN_CP_90D": 0.16,
        "IN_CD_3M": 0.15,
        "IN_CORP_AAA": 0.10,
        "IN_GOLD": 0.05,
    }
    config.weights = concentrated_weights
    risk_engine = TreasuryRiskEngine()
    new_metrics = risk_engine.evaluate_portfolio(config, returns_df)

    engine = EarlyWarningEngine()
    result = engine.evaluate(config, returns_df, new_metrics)

    conc_signal = next(s for s in result.signals if s.signal_id == "CONCENTRATION_DRIFT")
    assert conc_signal.severity in ["MEDIUM", "HIGH"]
    assert "IN_TBILL_91D" in conc_signal.explanation
    assert result.overall_status in [EarlyWarningState.WATCH.value, EarlyWarningState.ELEVATED.value]


def test_early_warning_api_endpoint():
    """Verifies POST /api/v1/risk/early-warning HTTP API contract and outputs."""
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
    }
    response = client.post("/api/v1/risk/early-warning", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] in ["STABLE", "WATCH", "ELEVATED", "DEFENSIVE"]
    assert len(data["signals"]) >= 5
    assert len(data["timeline"]) == 30
    assert "recommendation" in data
    assert "title" in data["recommendation"]
    assert "recommended_action" in data["recommendation"]
