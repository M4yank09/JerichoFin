# Jerifin REST API Documentation

## Overview

The Jerifin API exposes institutional capital allocation, portfolio optimization (CVXPY), treasury risk policy auditing (NORMAL, WARNING, BREACH, CRITICAL), defensive rebalancing, and macroeconomic stress testing.

- **Base URL**: `http://127.0.0.1:8000`
- **API Version**: `v1` (`/api/v1`)
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **ReDoc Documentation**: `http://127.0.0.1:8000/redoc`
- **OpenAPI JSON**: `http://127.0.0.1:8000/openapi.json`

> [!NOTE]
> **Dynamic Capital Scaling**: In accordance with institutional requirements, all endpoints performing allocations, optimization, risk auditing, rebalancing, or stress testing require an explicit `capital` input in the request payload. Capital is never silently defaulted or hardcoded, and monetary allocations scale proportionally without altering normalized portfolio weights.

---

## Local Development Setup

To start the FastAPI backend server with hot-reload:

```powershell
# From the project root (c:\Users\mayan\Jerifin):
& "backend\.venv\Scripts\uvicorn.exe" backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## Endpoint Directory

| Method | Endpoint | Group | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Health | Service health check and project metadata |
| `GET` | `/api/v1/portfolio/assets` | Portfolio | Retrieve available demo asset universe and disclaimer |
| `POST` | `/api/v1/portfolio/analyze` | Portfolio | Evaluate portfolio return, vol, VaR, CVaR, MDD, and liquidity |
| `POST` | `/api/v1/optimize` | Optimization | Run CVXPY constrained portfolio optimization |
| `POST` | `/api/v1/risk/evaluate` | Risk Controls | Audit portfolio against institutional treasury policy rules |
| `POST` | `/api/v1/risk/rebalance` | Risk Controls | Compute minimal-turnover defensive rebalancing allocation |
| `GET` | `/api/v1/stress/scenarios` | Stress Testing | List predefined institutional macroeconomic scenarios |
| `POST` | `/api/v1/stress/run` | Stress Testing | Execute single scenario (predefined or custom) & defensive trigger |
| `POST` | `/api/v1/stress/compare` | Stress Testing | Side-by-side comparative stress matrix across scenarios |

---

## Detailed Endpoint Specifications

### 1. Service Health Check

#### `GET /health`
Returns service availability status and metadata.

**Response Example (200 OK):**
```json
{
  "status": "healthy",
  "service": "Jerifin Treasury Risk Platform",
  "version": "1.0.0",
  "environment": "development"
}
```

---

### 2. Portfolio Endpoints

#### `GET /api/v1/portfolio/assets`
Returns the active institutional instrument universe.

**Response Example (200 OK):**
```json
{
  "disclaimer": "DEMO / SYNTHETIC DATA - NOT LIVE MARKET QUOTES",
  "total_assets": 5,
  "assets": [
    {
      "symbol": "USD_CASH",
      "name": "USD Overnight Treasury Cash & Repo",
      "asset_class": "Cash & Equivalents",
      "liquidity_tier": 1,
      "liquidity_score": 1.0,
      "duration": 0.0,
      "currency": "USD",
      "expected_return": 0.045,
      "metadata": {}
    },
    {
      "symbol": "US_TBILL_3M",
      "name": "US 3-Month Treasury Bills",
      "asset_class": "Sovereign Bonds",
      "liquidity_tier": 2,
      "liquidity_score": 0.95,
      "duration": 0.25,
      "currency": "USD",
      "expected_return": 0.048,
      "metadata": {}
    }
  ]
}
```

---

#### `POST /api/v1/portfolio/analyze`
Computes comprehensive risk, liquidity, and monetary allocations for a portfolio.

**Request Body:**
```json
{
  "capital": 1000000000.0,
  "weights": {
    "USD_CASH": 0.20,
    "US_TBILL_3M": 0.40,
    "COMM_PAPER_30D": 0.20,
    "US_CORP_IG": 0.20
  },
  "risk_free_rate": 0.045
}
```

**Response Example (200 OK):**
```json
{
  "capital": 1000000000.0,
  "weights": {
    "USD_CASH": 0.20,
    "US_TBILL_3M": 0.40,
    "COMM_PAPER_30D": 0.20,
    "US_CORP_IG": 0.20
  },
  "monetary_allocations": {
    "USD_CASH": 200000000.0,
    "US_TBILL_3M": 400000000.0,
    "COMM_PAPER_30D": 200000000.0,
    "US_CORP_IG": 200000000.0
  },
  "expected_return": 0.0505,
  "volatility": 0.0152,
  "sharpe_ratio": 0.3618,
  "var_95_historical": 0.0012,
  "cvar_95_historical": 0.0018,
  "var_95_monetary": 1200000.0,
  "cvar_95_monetary": 1800000.0,
  "max_drawdown": 0.0045,
  "hhi_concentration": 0.2800,
  "largest_exposure_asset": "US_TBILL_3M",
  "largest_exposure_weight": 0.40,
  "weighted_liquidity_score": 0.88,
  "tier_breakdown": {
    "1": 0.20,
    "2": 0.60,
    "3": 0.20
  }
}
```

---

### 3. Portfolio Optimization

#### `POST /api/v1/optimize`
Determines optimal weights that maximize expected portfolio return subject to institutional risk limits.

**Request Body:**
```json
{
  "capital": 1000000000.0,
  "constraints": {
    "max_single_asset_weight": 0.35,
    "max_equity_weight": 0.15,
    "min_liquidity_score": 0.70,
    "max_cvar": 0.03,
    "max_drawdown": 0.05,
    "long_only": true
  }
}
```

**Response Example (200 OK):**
```json
{
  "status": "OPTIMAL",
  "capital": 1000000000.0,
  "weights": {
    "USD_CASH": 0.0,
    "US_TBILL_3M": 0.15,
    "COMM_PAPER_30D": 0.35,
    "US_CORP_IG": 0.35,
    "STRAT_YIELD_BUF": 0.15
  },
  "allocations": {
    "USD_CASH": 0.0,
    "US_TBILL_3M": 150000000.0,
    "COMM_PAPER_30D": 350000000.0,
    "US_CORP_IG": 350000000.0,
    "STRAT_YIELD_BUF": 150000000.0
  },
  "expected_return": 0.0588,
  "volatility": 0.0215,
  "var": 0.0022,
  "cvar": 0.0031,
  "max_drawdown": 0.0084,
  "hhi": 0.2900,
  "largest_exposure": ["COMM_PAPER_30D", 0.35],
  "liquidity_score": 0.7275,
  "constraint_checks": [
    {
      "constraint_name": "Maximum Single Asset Weight",
      "actual_value": 0.35,
      "limit": 0.35,
      "passed": true,
      "operator": "<=",
      "description": "Max allocation: 35.00% <= 35.00%"
    }
  ],
  "message": "Optimization converged to optimal solution (Clarabel).",
  "solve_time_seconds": 0.015
}
```

---

### 4. Risk Governance & Rebalancing

#### `POST /api/v1/risk/evaluate`
Audits allocation weights against institutional policy parameters.

**Request Body:**
```json
{
  "weights": {
    "USD_CASH": 0.10,
    "US_TBILL_3M": 0.20,
    "COMM_PAPER_30D": 0.10,
    "US_CORP_IG": 0.20,
    "STRAT_YIELD_BUF": 0.40
  },
  "capital": 1000000000.0
}
```

**Response Example (200 OK):**
```json
{
  "overall_status": "CRITICAL",
  "checks": [
    {
      "name": "Equity Exposure",
      "current_value": 0.40,
      "limit": 0.15,
      "utilization_pct": 266.67,
      "status": "CRITICAL",
      "operator": "<=",
      "explanation": "Critical equity/strategic yield concentration: 40.00% exceeds policy ceiling 15.00%."
    }
  ],
  "breached_checks": ["Portfolio Liquidity", "Equity Exposure", "Single Asset Exposure"],
  "warning_checks": [],
  "requires_rebalance": true,
  "summary_explanation": "CRITICAL RISK STATE: 3 policy limit(s) violated. Severe capital preservation breach requires immediate defensive rebalancing."
}
```

---

#### `POST /api/v1/risk/rebalance`
Calculates minimal-turnover defensive rebalancing weights restoring full compliance.

**Request Body:**
```json
{
  "capital": 1000000000.0,
  "current_weights": {
    "USD_CASH": 0.05,
    "US_TBILL_3M": 0.15,
    "COMM_PAPER_30D": 0.10,
    "US_CORP_IG": 0.30,
    "STRAT_YIELD_BUF": 0.40
  }
}
```

**Response Example (200 OK):**
```json
{
  "status": "SUCCESS",
  "initial_status": "CRITICAL",
  "capital": 1000000000.0,
  "current_weights": { ... },
  "defensive_weights": {
    "USD_CASH": 0.18,
    "US_TBILL_3M": 0.22,
    "COMM_PAPER_30D": 0.20,
    "US_CORP_IG": 0.25,
    "STRAT_YIELD_BUF": 0.15
  },
  "current_allocations": { ... },
  "defensive_allocations": { ... },
  "turnover": 0.25,
  "asset_drifts": [
    {
      "symbol": "STRAT_YIELD_BUF",
      "current_weight": 0.40,
      "target_weight": 0.15,
      "drift": 0.25,
      "drift_monetary": 250000000.0,
      "rebalance_required": true
    }
  ],
  "rebalance_required": true,
  "current_metrics": { "cvar": 0.029, "liquidity": 0.58 },
  "defensive_metrics": { "cvar": 0.018, "liquidity": 0.74 },
  "post_rebalance_status": "NORMAL",
  "post_rebalance_checks": [ ... ],
  "explanation": "Defensive rebalancing successfully restored policy compliance to NORMAL with 25.00% turnover."
}
```

---

### 5. Stress Testing Endpoints

#### `GET /api/v1/stress/scenarios`
Returns the standard 5 institutional macroeconomic shock templates.

---

#### `POST /api/v1/stress/run`
Simulates instantaneous market shock, P&L, post-shock weights, policy audit, and automated defensive rebalancing.

**Request Body:**
```json
{
  "capital": 1000000000.0,
  "weights": {
    "USD_CASH": 0.10,
    "US_TBILL_3M": 0.30,
    "COMM_PAPER_30D": 0.20,
    "US_CORP_IG": 0.20,
    "STRAT_YIELD_BUF": 0.20
  },
  "scenario_id": "COMBINED_MACRO_SHOCK",
  "trigger_defensive_on_breach": true
}
```

**Response Example (200 OK):**
```json
{
  "scenario_id": "COMBINED_MACRO_SHOCK",
  "scenario_name": "Synchronized Stagflationary Macro Crisis",
  "severity": "CRITICAL",
  "assumptions": "Worst-case tail event combining liquidity freeze, rate spike, and equity rout.",
  "base_portfolio_return": 0.054,
  "base_portfolio_value": 1000000000.0,
  "stressed_portfolio_return": -0.076,
  "stressed_pnl": -76000000.0,
  "stressed_portfolio_value": 924000000.0,
  "asset_impacts": [ ... ],
  "stressed_weights": { ... },
  "policy_status": "CRITICAL",
  "breached_constraints": ["Portfolio Liquidity", "Maximum Drawdown"],
  "policy_evaluation": { ... },
  "defensive_response": {
    "status": "SUCCESS",
    "post_rebalance_status": "NORMAL",
    "turnover": 0.18
  },
  "summary": "COMBINED_MACRO_SHOCK caused -7.60% return (-$76.0M P&L). Risk state escalated to CRITICAL. Automated defensive rebalancing calculated."
}
```

---

#### `POST /api/v1/stress/compare`
Evaluates all scenarios concurrently to produce a multi-scenario comparative risk matrix.

---

## Institutional Demo Flow Summary

1. **Enter Capital**: User inputs capital (e.g. ₹100 Cr = `1,000,000,000.0`).
2. **Optimize**: Call `POST /api/v1/optimize` with institutional limits. Receive optimal weights and monetary allocations.
3. **Audit**: Call `POST /api/v1/risk/evaluate` to confirm risk status is `NORMAL`.
4. **Stress Test**: Call `POST /api/v1/stress/run` with `scenario_id="COMBINED_MACRO_SHOCK"`. Stressed portfolio experiences losses and triggers policy `BREACH` / `CRITICAL`.
5. **Defensive Response**: Stressed response returns automated defensive rebalancing that restores compliance to `NORMAL`.
6. **Scale Capital**: Changing capital from ₹100 Cr to ₹500 Cr scales monetary allocations 5x while leaving allocation weights invariant.
