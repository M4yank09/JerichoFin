"""Comprehensive Integration Tests for FastAPI API Layer (Phase 5).

Verifies endpoints, request/response models, error handling, CORS headers,
health checks, and the complete institutional treasury demo flow with dynamic capital scaling.
"""
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


# ==============================================================================
# 1. HEALTH AND ASSETS ENDPOINTS
# ==============================================================================

def test_health_endpoint():
    """Verifies GET /health returns service status and project metadata."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Jerifin" in data["service"]
    assert "version" in data
    assert "environment" in data


def test_get_assets_endpoint():
    """Verifies GET /api/v1/portfolio/assets returns institutional universe with disclaimer."""
    response = client.get("/api/v1/portfolio/assets")
    assert response.status_code == 200
    data = response.json()
    assert "disclaimer" in data
    assert "DEMO" in data["disclaimer"]
    assert data["total_assets"] >= 5
    symbols = [a["symbol"] for a in data["assets"]]
    assert "USD_CASH" in symbols
    assert "US_TBILL_3M" in symbols
    assert "COMM_PAPER_30D" in symbols
    assert "US_CORP_IG" in symbols
    assert "STRAT_YIELD_BUF" in symbols


# ==============================================================================
# 2. PORTFOLIO ANALYSIS ENDPOINTS
# ==============================================================================

def test_portfolio_analyze_valid():
    """Verifies POST /api/v1/portfolio/analyze calculates metrics and scales allocations."""
    payload = {
        "capital": 100_000_000.0,
        "weights": {
            "USD_CASH": 0.20,
            "US_TBILL_3M": 0.40,
            "COMM_PAPER_30D": 0.20,
            "US_CORP_IG": 0.20,
        },
    }
    response = client.post("/api/v1/portfolio/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["capital"] == 100_000_000.0
    assert data["expected_return"] > 0.0
    assert data["volatility"] > 0.0
    assert data["var_95_historical"] >= 0.0
    assert data["cvar_95_historical"] >= data["var_95_historical"]
    assert pytest.approx(sum(data["monetary_allocations"].values()), rel=1e-4) == 100_000_000.0
    assert data["monetary_allocations"]["USD_CASH"] == 20_000_000.0


def test_portfolio_analyze_invalid_weights_sum():
    """Verifies weights not summing to 1.0 returns HTTP 400."""
    payload = {
        "capital": 10_000_000.0,
        "weights": {
            "USD_CASH": 0.50,
            "US_TBILL_3M": 0.20,  # Sums to 0.70
        },
    }
    response = client.post("/api/v1/portfolio/analyze", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert "error" in data


def test_portfolio_analyze_negative_capital():
    """Verifies non-positive capital returns validation error."""
    payload = {
        "capital": -1000.0,
        "weights": {"USD_CASH": 1.0},
    }
    response = client.post("/api/v1/portfolio/analyze", json=payload)
    assert response.status_code in (400, 422)


def test_portfolio_analyze_missing_capital_rejected():
    """Verifies that omitting required capital returns HTTP 422."""
    payload = {
        "weights": {"USD_CASH": 1.0},
    }
    response = client.post("/api/v1/portfolio/analyze", json=payload)
    assert response.status_code == 422


# ==============================================================================
# 3. PORTFOLIO OPTIMIZATION ENDPOINTS
# ==============================================================================

def test_optimize_endpoint_optimal():
    """Verifies POST /api/v1/optimize produces feasible optimal weights."""
    capital = 1_000_000_000.0  # ₹100 Cr
    payload = {
        "capital": capital,
        "constraints": {
            "max_single_asset_weight": 0.40,
            "max_equity_weight": 0.15,
            "min_liquidity_score": 0.70,
            "max_cvar": 0.05,
        },
    }
    response = client.post("/api/v1/optimize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OPTIMAL"
    assert data["capital"] == capital
    assert pytest.approx(sum(data["weights"].values()), abs=1e-5) == 1.0
    assert pytest.approx(sum(data["allocations"].values()), abs=1.0) == capital
    assert all(w <= 0.4001 for w in data["weights"].values())
    assert data["weights"].get("STRAT_YIELD_BUF", 0.0) <= 0.1501
    assert data["liquidity_score"] >= 0.6999


def test_optimize_endpoint_infeasible_returns_422():
    """Verifies mutually conflicting optimization constraints return HTTP 422."""
    payload = {
        "capital": 10_000_000.0,
        "constraints": {
            "max_single_asset_weight": 0.10,  # 5 assets * 0.10 = 0.50 max total (cannot sum to 1.0)
            "long_only": True,
        },
    }
    response = client.post("/api/v1/optimize", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert "infeasible" in data["detail"].lower()


def test_optimize_missing_capital_rejected():
    """Verifies omitting capital in optimization returns HTTP 422."""
    payload = {
        "constraints": {"max_single_asset_weight": 0.35},
    }
    response = client.post("/api/v1/optimize", json=payload)
    assert response.status_code == 422


# ==============================================================================
# 4. RISK EVALUATION AND REBALANCING ENDPOINTS
# ==============================================================================

def test_risk_evaluate_compliant_normal():
    """Verifies conservative portfolio returns NORMAL status."""
    payload = {
        "weights": {
            "USD_CASH": 0.25,
            "US_TBILL_3M": 0.25,
            "COMM_PAPER_30D": 0.25,
            "US_CORP_IG": 0.15,
            "STRAT_YIELD_BUF": 0.10,
        },
        "capital": 50_000_000.0,
    }
    response = client.post("/api/v1/risk/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] == "NORMAL"
    assert data["requires_rebalance"] is False
    assert len(data["breached_checks"]) == 0


def test_risk_evaluate_equity_breach():
    """Verifies exceeding equity limit triggers BREACH or CRITICAL."""
    payload = {
        "weights": {
            "USD_CASH": 0.10,
            "US_TBILL_3M": 0.20,
            "COMM_PAPER_30D": 0.10,
            "US_CORP_IG": 0.20,
            "STRAT_YIELD_BUF": 0.40,  # 40% equity/yield vs 15% limit
        },
        "capital": 50_000_000.0,
    }
    response = client.post("/api/v1/risk/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_status"] in ("BREACH", "CRITICAL")
    assert data["requires_rebalance"] is True
    assert "Equity Exposure" in data["breached_checks"]


def test_risk_rebalance_defensive_endpoint():
    """Verifies POST /api/v1/risk/rebalance restores compliance with minimal turnover."""
    capital = 1_000_000_000.0
    payload = {
        "capital": capital,
        "current_weights": {
            "USD_CASH": 0.05,
            "US_TBILL_3M": 0.15,
            "COMM_PAPER_30D": 0.10,
            "US_CORP_IG": 0.30,
            "STRAT_YIELD_BUF": 0.40,  # Severe breach
        },
    }
    response = client.post("/api/v1/risk/rebalance", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["initial_status"] in ("BREACH", "CRITICAL")
    assert data["post_rebalance_status"] == "NORMAL"
    assert data["turnover"] > 0.0
    assert pytest.approx(sum(data["defensive_weights"].values()), abs=1e-5) == 1.0
    assert pytest.approx(sum(data["defensive_allocations"].values()), abs=1.0) == capital
    assert data["defensive_weights"]["STRAT_YIELD_BUF"] <= 0.1501


def test_risk_rebalance_missing_capital_rejected():
    """Verifies omitting capital in rebalancing returns HTTP 422."""
    payload = {
        "current_weights": {"USD_CASH": 1.0},
    }
    response = client.post("/api/v1/risk/rebalance", json=payload)
    assert response.status_code == 422


# ==============================================================================
# 5. STRESS TESTING ENDPOINTS
# ==============================================================================

def test_stress_scenarios_listing():
    """Verifies GET /api/v1/stress/scenarios returns all 5 predefined scenarios."""
    response = client.get("/api/v1/stress/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    for expected_id in [
        "EQUITY_CRASH",
        "INTEREST_RATE_SHOCK",
        "LIQUIDITY_CRISIS",
        "INFLATION_SHOCK",
        "COMBINED_MACRO_SHOCK",
    ]:
        assert expected_id in data
        assert "name" in data[expected_id]
        assert "asset_class_shocks" in data[expected_id]


def test_stress_run_predefined_equity_crash():
    """Verifies POST /api/v1/stress/run evaluates equity crash and returns P&L."""
    capital = 1_000_000_000.0  # ₹100 Cr
    payload = {
        "capital": capital,
        "weights": {
            "USD_CASH": 0.10,
            "US_TBILL_3M": 0.30,
            "COMM_PAPER_30D": 0.20,
            "US_CORP_IG": 0.20,
            "STRAT_YIELD_BUF": 0.20,
        },
        "scenario_id": "EQUITY_CRASH",
    }
    response = client.post("/api/v1/stress/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_id"] == "EQUITY_CRASH"
    assert data["stressed_pnl"] < 0.0
    assert data["stressed_portfolio_value"] < capital
    assert pytest.approx(data["base_portfolio_value"] + data["stressed_pnl"], abs=1.0) == data["stressed_portfolio_value"]
    assert len(data["asset_impacts"]) == 5
    assert "policy_status" in data


def test_stress_run_custom_scenario():
    """Verifies custom user-defined scenario execution."""
    payload = {
        "capital": 500_000_000.0,
        "weights": {
            "USD_CASH": 0.20,
            "US_TBILL_3M": 0.30,
            "COMM_PAPER_30D": 0.20,
            "US_CORP_IG": 0.30,
        },
        "custom_scenario": {
            "scenario_id": "CUSTOM_DELEVERAGING",
            "name": "Custom Credit Deleveraging",
            "asset_class_shocks": {
                "Corporate Bonds": -0.12,
                "Commercial Paper": -0.04,
            },
            "severity": "SEVERE",
        },
    }
    response = client.post("/api/v1/stress/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_id"] == "CUSTOM_DELEVERAGING"
    assert data["stressed_pnl"] < 0.0


def test_stress_run_unknown_scenario_returns_404():
    """Verifies unknown scenario ID returns HTTP 404."""
    payload = {
        "capital": 10_000_000.0,
        "weights": {"USD_CASH": 1.0},
        "scenario_id": "NON_EXISTENT_SCENARIO",
    }
    response = client.post("/api/v1/stress/run", json=payload)
    assert response.status_code == 404


def test_stress_run_invalid_custom_shock_returns_422():
    """Verifies shock <= -1.0 (-100% loss) returns HTTP 422."""
    payload = {
        "capital": 10_000_000.0,
        "weights": {"USD_CASH": 1.0},
        "custom_scenario": {
            "scenario_id": "INSOLVENCY_SHOCK",
            "name": "Invalid Insolvency Shock",
            "asset_class_shocks": {"Cash & Equivalents": -1.25},
        },
    }
    response = client.post("/api/v1/stress/run", json=payload)
    assert response.status_code == 422


def test_stress_compare_endpoint():
    """Verifies POST /api/v1/stress/compare produces comparative matrix."""
    payload = {
        "capital": 1_000_000_000.0,
        "weights": {
            "USD_CASH": 0.20,
            "US_TBILL_3M": 0.40,
            "COMM_PAPER_30D": 0.20,
            "US_CORP_IG": 0.20,
        },
    }
    response = client.post("/api/v1/stress/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["base_capital"] == 1_000_000_000.0
    assert len(data["scenarios"]) == 5
    assert len(data["detailed_results"]) == 5
    first_scen = data["scenarios"][0]
    assert "restored_value" in first_scen
    assert first_scen["restored_value"] > 0


# ==============================================================================
# 6. COMPLETE INSTITUTIONAL DEMO FLOW & CAPITAL SCALING
# ==============================================================================

def test_complete_demo_flow_and_capital_scaling():
    """Simulates the full institutional user journey:

    1. User enters capital = ₹100 Cr (1,000,000,000).
    2. User configures portfolio/risk limits.
    3. API returns optimized allocation.
    4. User sees risk metrics (NORMAL).
    5. User selects a severe stress scenario (COMBINED_MACRO_SHOCK).
    6. API calculates stressed outcome.
    7. Policy controller determines state.
    8. If breached, API returns a defensive allocation.
    9. Capital scaling test: Changing capital from ₹100 Cr to ₹500 Cr must scale monetary
       allocations exactly 5x without altering portfolio weights.
    """
    # 1 & 2: User sets capital = ₹100 Cr and constraints
    capital_100_cr = 1_000_000_000.0
    opt_payload = {
        "capital": capital_100_cr,
        "constraints": {
            "max_single_asset_weight": 0.35,
            "max_equity_weight": 0.15,
            "min_liquidity_score": 0.70,
            "max_cvar": 0.03,
        },
    }

    # 3: Optimize allocation
    opt_resp = client.post("/api/v1/optimize", json=opt_payload)
    assert opt_resp.status_code == 200
    opt_data = opt_resp.json()
    assert opt_data["status"] == "OPTIMAL"
    optimized_weights = opt_data["weights"]
    assert pytest.approx(sum(optimized_weights.values()), abs=1e-5) == 1.0
    assert pytest.approx(sum(opt_data["allocations"].values()), abs=1.0) == capital_100_cr

    # 4: Verify initial risk state is compliant
    risk_resp = client.post(
        "/api/v1/risk/evaluate",
        json={"weights": optimized_weights, "capital": capital_100_cr},
    )
    assert risk_resp.status_code == 200
    assert risk_resp.json()["overall_status"] in ("NORMAL", "WARNING")

    # 5 & 6: Run severe stress test (COMBINED_MACRO_SHOCK)
    stress_payload = {
        "capital": capital_100_cr,
        "weights": optimized_weights,
        "scenario_id": "COMBINED_MACRO_SHOCK",
        "trigger_defensive_on_breach": True,
    }
    stress_resp = client.post("/api/v1/stress/run", json=stress_payload)
    assert stress_resp.status_code == 200
    stress_data = stress_resp.json()
    assert stress_data["stressed_pnl"] < 0.0
    assert stress_data["stressed_portfolio_value"] < capital_100_cr
    assert "restored_portfolio_value" in stress_data
    assert "base_cvar" in stress_data
    assert "base_liquidity_score" in stress_data
    assert "stressed_cvar" in stress_data
    assert "stressed_liquidity_score" in stress_data
    assert "restored_cvar" in stress_data
    assert "restored_liquidity_score" in stress_data
    assert "restored_status" in stress_data
    assert stress_data["restored_portfolio_value"] > 0

    # 7 & 8: Verify policy status and defensive response if breached
    if stress_data["policy_status"] in ("BREACH", "CRITICAL"):
        assert stress_data["defensive_response"] is not None
        assert stress_data["defensive_response"]["status"] == "SUCCESS"
        assert stress_data["defensive_response"]["post_rebalance_status"] == "NORMAL"
        assert stress_data["restored_portfolio_value"] < stress_data["stressed_portfolio_value"]
    else:
        assert stress_data["restored_portfolio_value"] == stress_data["stressed_portfolio_value"]

    # 9: Capital Scaling Invariance Test
    # Scale capital 5x to ₹500 Cr (5,000,000,000)
    capital_500_cr = 5_000_000_000.0
    scale_payload = {
        "capital": capital_500_cr,
        "constraints": {
            "max_single_asset_weight": 0.35,
            "max_equity_weight": 0.15,
            "min_liquidity_score": 0.70,
            "max_cvar": 0.03,
        },
    }
    scale_resp = client.post("/api/v1/optimize", json=scale_payload)
    assert scale_resp.status_code == 200
    scale_data = scale_resp.json()

    # Weights must be identical (invariant to capital pool size)
    for sym, w in optimized_weights.items():
        assert pytest.approx(scale_data["weights"][sym], abs=1e-5) == w

    # Monetary allocations must scale exactly 5x
    for sym, alloc_100 in opt_data["allocations"].items():
        assert pytest.approx(scale_data["allocations"][sym], rel=1e-4) == alloc_100 * 5.0
