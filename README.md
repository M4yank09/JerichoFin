# Jerifin

**Institutional Capital Allocation & Treasury Risk Platform**

Jerifin is a fintech platform designed for institutional treasuries, corporate finance teams, and fund managers to optimize multi-asset capital allocation, stress-test treasury reserves, and manage liquidity and yield exposure under macroeconomic constraints.

---

## High-Level Architecture

The repository is organized as a modular monorepo:

```
Jerifin/
├── backend/
│   ├── app/
│   │   ├── api/            # API routing and versioned endpoints (FastAPI)
│   │   ├── core/           # Configuration, security, and environment settings
│   │   ├── engine/         # Quantitative finance, portfolio optimization & risk engine
│   │   ├── schemas/        # Pydantic data schemas and validation models
│   │   └── main.py         # Application entrypoint
│   ├── tests/              # Test suite (unit, risk calculations, API integration)
│   │   ├── conftest.py     # Pytest fixtures and test configurations
│   │   └── test_engine.py  # Risk engine validation tests
│   ├── requirements.txt    # Python dependencies
│   ├── pyproject.toml      # Backend package and tool configurations
│   └── .env.example        # Backend environment variable templates
├── frontend/               # Next.js web application (Treasury dashboard & analytics UI)
│   └── README.md
├── docs/                   # Platform documentation and architectural specifications
│   ├── architecture.md     # System design and service interactions
│   └── treasury_risk_spec.md# Financial models and risk engine specifications
├── .gitignore              # Monorepo ignore rules for Python, Node, and environments
└── README.md               # Project documentation
```

---

## Core Platform Modules

1. **Capital Allocation Engine (`backend/app/engine/allocator.py`)**
   - Mean-variance optimization, Black-Litterman allocations, risk parity, and asset-liability matching (ALM) tailored for corporate treasuries.

2. **Treasury Risk Engine (`backend/app/engine/risk.py`)**
   - Value at Risk (VaR: Historical, Parametric, Monte Carlo), Expected Shortfall (CVaR), duration matching, and liquidity stress testing.

3. **FastAPI Services (`backend/app/api/`)**
   - High-throughput asynchronous endpoints providing real-time portfolio analytics, rebalancing proposals, and stress testing simulations.

4. **Institutional Dashboard (`frontend/`)**
   - Interactive Next.js interface for corporate treasurers to monitor liquidity tiers, counterparties, yields, and portfolio scenario simulations.

---

## Development Setup

### Backend (Python / FastAPI)
- Python 3.10+
- See `backend/requirements.txt` and `backend/pyproject.toml` for dependencies and configuration.

### Frontend (Next.js)
- Node.js 18+ / npm
- See `frontend/README.md` for client setup instructions.

---

## Current Status: Phases 1, 2, 3, 4 & 5 Completed

### Phase 1: Foundational Financial & Risk Analytics
- **Domain Data Models**: `Asset`, `AssetClass`, `LiquidityTier`, `PortfolioConfig`, `PortfolioMetrics`.
- **Synthetic Deterministic Data Generator**: Correlated historical daily returns with downside credit/liquidity shocks for demo/testing (`backend/app/engine/synthetic_data.py`).
- **Foundational Financial Analytics (`backend/app/engine/analytics.py`)**: Expected return, covariance, volatility, 95% historical VaR, 95% historical CVaR, MDD, HHI, liquidity scoring, and monetary allocations.

### Phase 2: Portfolio Optimization Engine
- **Convex Portfolio Optimizer (`backend/app/engine/optimizer.py`)**:
  - Maximize expected portfolio return $\max \boldsymbol{\mu}^T \mathbf{w}$ subject to single asset limits, equity caps, liquidity floors, scenario-based CVaR, and max drawdown.
  - Fully dynamic capital scaling with structured constraint checks.

### Phase 3: Risk Control & Defensive Rebalancing Engine
- **Risk Control Engine (`backend/app/engine/risk_controller.py`)**:
  - Independent risk governance across four states: `NORMAL`, `WARNING`, `BREACH`, `CRITICAL`.
  - Automated convex defensive rebalancer minimizing portfolio turnover:
    $$\min_{\mathbf{w}} \quad \frac{1}{2} \|\mathbf{w} - \mathbf{w}_0\|_1 + \lambda_{\text{tail}} \text{CVaR}_{95\%}(\mathbf{w}) - \lambda_{\text{liq}} \mathbf{L}^T \mathbf{w}$$

### Phase 4: Stress Testing & Scenario Analysis Engine
- **Stress Testing Engine (`backend/app/engine/stress_testing.py`)**:
  - Predefined deterministic macroeconomic scenarios (`EQUITY_CRASH`, `INTEREST_RATE_SHOCK`, `LIQUIDITY_CRISIS`, `INFLATION_SHOCK`, `COMBINED_MACRO_SHOCK`).
  - Stressed P&L, post-shock drifting weights, policy audits, and automated defensive rebalancing triggers.

### Phase 5: FastAPI Backend API Layer
- **REST API Endpoints (`backend/app/api/v1/`)**:
  - `GET /health`: Service availability and version metadata.
  - `GET /api/v1/portfolio/assets`: Demo asset universe with prominent synthetic data disclaimer.
  - `POST /api/v1/portfolio/analyze`: Comprehensive portfolio risk and liquidity analysis.
  - `POST /api/v1/optimize`: Constrained CVXPY optimization returning weights and allocations.
  - `POST /api/v1/risk/evaluate`: Independent policy audit returning risk state (`NORMAL`, `WARNING`, `BREACH`, `CRITICAL`).
  - `POST /api/v1/risk/rebalance`: Minimal-turnover defensive rebalancing plan.
  - `GET /api/v1/stress/scenarios`: Predefined institutional macroeconomic scenario catalog.
  - `POST /api/v1/stress/run`: Instantaneous shock simulation, P&L, and defensive response.
  - `POST /api/v1/stress/compare`: Side-by-side comparative scenario matrix.
- **Interactive Documentation**: Available at `http://127.0.0.1:8000/docs` (Swagger) and `/redoc`.
- **Dynamic Capital Requirement**: Capital is strictly required as an input on all allocation/optimization/stress operations and scales monetary values without altering weights.

---

### Running the API Server

From the repository root:
```powershell
& "backend/.venv/Scripts/uvicorn.exe" backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive API documentation will be available at `http://127.0.0.1:8000/docs`.

### Running Tests
From the repository root:
```powershell
& "backend/.venv/Scripts/python.exe" -m pytest backend/tests -v
```
All **91 tests** pass across unit analytics, optimization, risk controls, stress testing, and API integration.

---

### Documentation
- [docs/api.md](file:///c:/Users/mayan/Jerifin/docs/api.md): Complete REST API documentation with endpoint contracts and example payloads.
- [docs/stress-testing.md](file:///c:/Users/mayan/Jerifin/docs/stress-testing.md): Stress testing architecture, predefined scenario assumptions, mathematical methodology, and distinction from historical VaR.
- [docs/risk-controls.md](file:///c:/Users/mayan/Jerifin/docs/risk-controls.md): Risk governance architecture, NORMAL/WARNING/BREACH/CRITICAL state logic, policy checking, defensive rebalancing, and explainability.
- [docs/optimization-model.md](file:///c:/Users/mayan/Jerifin/docs/optimization-model.md): Mathematical optimization formulation, constraints, decision variables, solver details, and limitations.
- [docs/financial-model.md](file:///c:/Users/mayan/Jerifin/docs/financial-model.md): Mathematical formulations, loss/return conventions, assumptions, and limitations.
- [docs/development-log.md](file:///c:/Users/mayan/Jerifin/docs/development-log.md): Development log detailing environment setup, engineering decisions, diagnostics, and test results.
- [docs/architecture.md](file:///c:/Users/mayan/Jerifin/docs/architecture.md): System architecture and data flow.
- [docs/treasury_risk_spec.md](file:///c:/Users/mayan/Jerifin/docs/treasury_risk_spec.md): Treasury risk specification.

---

## License
Proprietary / Hackathon Project



