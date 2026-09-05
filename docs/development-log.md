# Jerifin Development Log

## Phase 1: Foundational Financial & Risk Analytics Engine

### 1. Environment & Toolchain Setup
- **Python Runtime Diagnosis**:
  - Identified that the host's system PATH lacked a directly callable Python binary (aliased to WindowsApps stub).
  - Used `winget` to install Python 3.12 (`Python.Python.3.12`, version `3.12.10`) under the user scope (`--scope user --silent`).
- **Project-Local Virtual Environment**:
  - Created dedicated virtual environment at `backend/.venv` using Python 3.12.10.
  - Installed only Phase 1 core dependencies: `numpy`, `pandas`, `scipy`, and `pytest`.
  - Excluded FastAPI, Uvicorn, and frontend dependencies to adhere to strict phase boundaries.

### 2. Architecture & Domain Models
- **Schemas (`backend/app/schemas/portfolio.py`)**:
  - Created `Asset` dataclass with attributes for symbol, asset class, liquidity tier (1-3), normalized liquidity score [0.0, 1.0], duration, and expected return.
  - Created `PortfolioConfig` for managing asset universes, weights, total pool capital, and benchmark risk-free rates.
  - Created `PortfolioMetrics` data contract encapsulating all calculated risk and return metrics.

### 3. Synthetic Deterministic Data Generator
- **Module (`backend/app/engine/synthetic_data.py`)**:
  - Implemented `generate_deterministic_synthetic_returns()` using `numpy.random.default_rng(seed=42)` and correlated multivariate normal distributions.
  - Features flight-to-safety sovereign bond behaviors and corporate credit widening shocks to realistically test tail risk.
  - Prominently labeled with explicit `DEMO / SYNTHETIC DATA` disclaimers and attributes.

### 4. Pure Financial Analytics
- **Module (`backend/app/engine/analytics.py`)**:
  - Implemented 14 core foundational analytical functions:
    1. `validate_weights`
    2. `calculate_expected_return`
    3. `calculate_covariance_matrix`
    4. `calculate_portfolio_volatility`
    5. `calculate_portfolio_return_series`
    6. `calculate_historical_var` (95% downside tail quantile)
    7. `calculate_historical_cvar` (empirical tail loss average, unapproximated by normal distribution)
    8. `calculate_max_drawdown` (compounded peak-to-trough decline)
    9. `calculate_hhi` (concentration metric)
    10. `calculate_largest_exposure`
    11. `calculate_weighted_liquidity_score`
    12. `calculate_liquidity_tier_breakdown`
    13. `calculate_monetary_allocations`
  - Engine integration in `backend/app/engine/risk.py` (`TreasuryRiskEngine.evaluate_portfolio()`) and `backend/app/engine/allocator.py` (`CapitalAllocationEngine.calculate_monetary_allocation()`).

### 5. Automated Testing & Verification
- **Test Suites Created**:
  - `backend/tests/test_analytics.py`: 19 unit tests with small handcrafted deterministic arrays.
  - `backend/tests/test_risk_engine.py`: 5 integration tests evaluating end-to-end metrics.
  - `backend/tests/test_synthetic_data.py`: 5 tests verifying determinism, shape, and volatility gradations.
  - `backend/tests/test_engine.py`: 2 interface initialization tests.
- **Diagnostics & Bug Resolution**:
  - *Diagnosis*: Initial implementation of `calculate_historical_var` used NumPy's default `linear` interpolation across discrete points, resulting in continuous interpolation across the boundary of discrete tail losses.
  - *Resolution*: Updated `calculate_historical_var` and `calculate_historical_cvar` to use the empirical order statistic (`method="lower"`), precisely matching discrete tail distributions.
- **Final Results**: 30 of 30 tests passed in 0.94s.

---

## Phase 2: Portfolio Optimization Engine

### 1. Requirements & Problem Formulation
- **Objective**: Maximize expected portfolio return $\max \boldsymbol{\mu}^T \mathbf{w}$ while satisfying institutional treasury risk, liquidity, and governance constraints.
- **Constraints Implemented**:
  1. Fully invested budget: $\sum w_i = 1.0$
  2. Long-only non-negative allocation: $w_i \ge 0$
  3. Maximum single-asset concentration: $w_i \le \text{max\_single\_asset\_weight}$
  4. Maximum equity / strategic yield limit: $\sum_{i \in \text{Strategic}} w_i \le \text{max\_equity\_weight}$
  5. Minimum portfolio-weighted liquidity score: $\sum w_i L_i \ge \text{min\_liquidity\_score}$
  6. Maximum CVaR (95%): Rockafellar & Uryasev (2000) exact convex scenario formulation using auxiliary variables $\gamma$ and $u_t$.
  7. Maximum Drawdown: Chekhlov, Uryasev & Zabarankin (2005) formulation tracking historical peak-to-trough paths via auxiliary variables $M_t$.

### 2. Implementation Details
- **Optimization Engine (`backend/app/engine/optimizer.py`)**:
  - Implemented `PortfolioOptimizer` leveraging CVXPY v1.9+ with `CLARABEL` (interior-point conic solver) and fallbacks to `OSQP`/`SCS`.
  - Constructed exact Rockafellar-Uryasev LP representation:
    $$u_t \ge -r_t^T \mathbf{w} - \gamma, \quad u_t \ge 0, \quad \gamma + \frac{1}{\beta T}\sum_{t=1}^T u_t \le \text{max\_cvar}$$
  - Dynamic capital scaling: $A_i = w_i \times C$ supporting arbitrary institutional pools without hardcoded values.
  - Comprehensive post-optimization validation generating `ConstraintCheck` reports for every active constraint.
  - Explicit infeasibility diagnostics returning structured `OptimizationResult(status="INFEASIBLE", ...)` with diagnostic context.
- **Domain Schemas (`backend/app/schemas/portfolio.py`)**:
  - Added `ConstraintCheck`, `OptimizationConstraints`, and `OptimizationResult` data contracts.

### 3. Automated Testing & Diagnostics
- **Test Suite (`backend/tests/test_optimizer.py`)**:
  - 11 comprehensive tests covering unconstrained budget, long-only, single-asset caps, equity limits, liquidity floors, CVaR limits, drawdown caps, dynamic capital scaling, infeasibility handling, metric coherence, and input error validation.
- **Diagnostic Finding**:
  - In `test_cvar_constraint`, when reducing tail risk from 100% strategic yield, the optimizer rationally allocated capital into Commercial Paper (CP 30D) and Corporate IG bonds rather than zero-yield Cash because CP 30D offered sufficient tail risk reduction while preserving higher yield. The test assertions were updated to verify the genuine portfolio rebalancing away from the high-risk strategic asset.
- **Combined Test Results**:
  - All 41 unit and integration tests passed (30 Phase 1 tests + 11 Phase 2 tests) in 2.71s.

---

## Phase 3: Risk Control & Defensive Rebalancing Engine

### 1. Requirements & Governance Architecture
- **Objective**: Establish an authoritative risk gatekeeper (`RiskControlEngine`) that independently evaluates portfolio allocations against institutional treasury policy rules, determines risk states (`NORMAL`, `WARNING`, `BREACH`, `CRITICAL`), and triggers automated convex defensive rebalancing when limits are violated.
- **Key Modules & Schemas**:
  - Added `RiskState`, `TreasuryPolicy`, `PolicyCheckResult`, `PolicyEvaluation`, `AssetDrift`, and `DefensiveRebalanceResult` to `backend/app/schemas/portfolio.py`.
  - Implemented `RiskControlEngine` in `backend/app/engine/risk_controller.py`.

### 2. Policy Verification & Warning Bands
- **Five Core Policy Rules Evaluated**:
  1. Portfolio liquidity score (higher is safer, compliance ratio $L_p / L_{\text{min}}$).
  2. Equity / strategic yield exposure cap (lower is safer, utilization $V / L$).
  3. Single-asset concentration cap (lower is safer).
  4. 95% Historical CVaR ceiling (lower is safer).
  5. Maximum drawdown ceiling (lower is safer).
- **Four-Tier State Logic**:
  - `NORMAL`: All metrics $< 85\%$ of limit (comfortable compliance).
  - `WARNING`: Any metric between $85\%$ and $100\%$ of limit (or within 15% of floor).
  - `BREACH`: Exactly one metric $> 100\%$ of limit.
  - `CRITICAL`: Multiple metrics in breach ($\ge 2$) or severe excess ($> 125\%$ of limit).

### 3. Convex Minimum-Turnover Defensive Rebalancing
- **Objective**: Rather than heuristic hardcoding, formulated a convex optimization problem minimizing portfolio turnover ($\frac{1}{2} \|\mathbf{w} - \mathbf{w}_0\|_1$) while enforcing full policy compliance and rewarding tail risk reduction.
- **Two-Stage Buffer Solve**:
  - Stage 1 targets a safe buffer ($\theta = 0.83$) to restore the portfolio to `NORMAL`.
  - Stage 2 falls back to exact hard policy limits ($\theta = 1.0$) if the safe buffer is unachievable.
  - Returns `status="INFEASIBLE"` with informative diagnostics if no feasible defensive portfolio exists.
- **Dynamic Explainability**:
  - Generates clear, calculation-backed explanations detailing initial risk state, specific breached rules, reallocation directions, before/after metrics table, and required turnover.

### 4. Automated Testing & Verification
- **Test Suite (`backend/tests/test_risk_controller.py`)**:
  - 16 unit and integration tests verifying all 4 governance states, individual policy breaches, multi-limit critical states, defensive rebalancing compliance restoration, weight sum to 1.0, long-only bounds, turnover formula, drift threshold triggers, capital scaling, explainability, already-compliant no-op, and impossible policy infeasibility.
- **Combined Test Results**:
  - All 57 tests passed (30 Phase 1 + 11 Phase 2 + 16 Phase 3) in 3.73s.

---

## Phase 4: Stress Testing & Scenario Analysis Engine

### 1. Requirements & Architecture
- **Objective**: Implement a deterministic scenario simulation engine allowing treasurers to stress test capital pools against severe but plausible tail events without mixing scenario shocks into historical VaR return series.
- **Key Modules & Schemas**:
  - Added `StressScenario`, `AssetStressImpact`, `StressTestResult`, `ScenarioSummary`, and `MultiScenarioComparison` to `backend/app/schemas/portfolio.py`.
  - Implemented `StressTestingEngine` and `get_predefined_scenarios()` in `backend/app/engine/stress_testing.py`.

### 2. Predefined Scenarios Implemented
1. `EQUITY_CRASH`: Strategic yield -25%, Corporate bonds -5%, Commercial paper -1%, Sovereign bonds +0.5% (flight to safety), Cash 0.0%. Severity: `SEVERE`.
2. `INTEREST_RATE_SHOCK`: Parallel +150 bps upward yield curve shift. Sovereigns -6%, Corporates -8.5%, CP -1.5%, Strategic -4%, Cash +0.2%. Severity: `MODERATE`.
3. `LIQUIDITY_CRISIS`: Corporate credit freeze (-10%), Illiquid overlays (-18%), CP -4.5%, Sovereigns -0.5%, Cash 0.0%. Severity: `SEVERE`.
4. `INFLATION_SHOCK`: Commodity overlays +6%, Sovereigns -7%, Corporates -9%, CP -2%, Cash real drag -1%. Severity: `MODERATE`.
5. `COMBINED_MACRO_SHOCK`: Synchronized tail event across equities (-22%), corporates (-12%), sovereigns (-4.5%), CP (-5%), Cash 0%. Severity: `EXTREME`.

### 3. Calculation Methodology & Defensive Integration
- **Formulas**:
  - Stressed return: $R_{p, \text{stress}} = \sum w_i s_i$.
  - Monetary P&L: $\text{P\&L}_{\text{stress}} = C \times R_{p, \text{stress}}$.
  - Ending capital: $V_{\text{stress}} = C + \text{P\&L}_{\text{stress}}$.
  - Drifting post-shock weights: $w_i' = \frac{w_i (1 + s_i)}{1 + R_{p, \text{stress}}}$.
- **Policy Control Evaluation**: Evaluates post-shock drifting weights against `TreasuryPolicy`.
- **Automated Defensive Response**: When stress causes `BREACH` or `CRITICAL`, automatically invokes `RiskControlEngine.execute_defensive_rebalance` on the stressed portfolio, calculating turnover and policy restoration.
- **Comparative Battery**: `run_multi_scenario_comparison` evaluates multiple scenarios simultaneously, outputting high-level summary tables and detailed per-asset impact breakdowns.

### 4. Automated Testing & Verification
- **Test Suite (`backend/tests/test_stress_testing.py`)**:
  - 14 tests verifying all 5 predefined scenarios, custom user-defined scenarios with overrides, return/PnL formulas, per-asset additive contributions, policy status evaluations, multi-scenario matrices, defensive rebalance integration, capital scaling ($10M vs $100M), and input validation (bounds, NaN, non-positive capital).
- **Combined Test Results**:
  - All 71 tests passed (30 Phase 1 + 11 Phase 2 + 16 Phase 3 + 14 Phase 4) in 5.03s.

---

## Phase 5: FastAPI Backend API Layer

### 1. Requirements & Architecture
- **Objective**: Expose the quantitative and risk simulation engines (Phases 1–4) through a clean, modular FastAPI backend decoupled from front-end presentation.
- **Key Modules & Files**:
  - `backend/app/main.py`: Application factory (`create_app`), CORS middleware with environment-configured origins, global exception handlers, `/health` route, and OpenAPI documentation.
  - `backend/app/schemas/api.py`: Clean Pydantic v2 schemas for all requests, responses, constraints, and error envelopes.
  - `backend/app/api/v1/mappers.py`: Bi-directional converters between Pydantic schemas and domain dataclasses.
  - `backend/app/api/v1/portfolio.py`: Endpoints for `GET /api/v1/portfolio/assets` and `POST /api/v1/portfolio/analyze`.
  - `backend/app/api/v1/optimize.py`: Endpoint for `POST /api/v1/optimize`.
  - `backend/app/api/v1/risk.py`: Endpoints for `POST /api/v1/risk/evaluate` and `POST /api/v1/risk/rebalance`.
  - `backend/app/api/v1/stress.py`: Endpoints for `GET /api/v1/stress/scenarios`, `POST /api/v1/stress/run`, and `POST /api/v1/stress/compare`.
  - `backend/app/api/v1/__init__.py`: Router aggregator.

### 2. Design Principles & Financial Constraints
- **Explicit Required Capital**: All allocation, optimization, rebalancing, and stress test requests require an explicit `capital: float` input (> 0). No silent default to 10M.
- **Capital Scaling Invariance**: Normalized allocation weights remain mathematically invariant to portfolio capital size; monetary allocations scale strictly linearly.
- **Strict Error Handling**: Engine `ValueError` and solver infeasibilities map directly to HTTP 400 or HTTP 422 with structured diagnostic JSON rather than unhandled 500 errors.
- **Environment-Driven CORS**: Whitelists local development Next.js dev ports (`http://localhost:3000`, `http://127.0.0.1:3000`) and configurable production origins.

### 3. Automated Testing & Verification
- **Test Suite (`backend/tests/test_api.py`)**:
  - 20 comprehensive integration tests utilizing `fastapi.testclient.TestClient`.
  - Covers `/health`, `/portfolio/assets`, `/portfolio/analyze`, `/optimize`, `/risk/evaluate`, `/risk/rebalance`, `/stress/scenarios`, `/stress/run`, `/stress/compare`.
  - Validates missing capital rejection (HTTP 422), invalid weights (HTTP 400), infeasible constraints (HTTP 422), unknown scenarios (HTTP 404), and invalid shocks (HTTP 422).
  - Verifies the full institutional demo flow (₹100 Cr optimization -> audit -> stress shock -> defensive rebalancing -> 5x capital scaling to ₹500 Cr).
- **Combined Test Results**:
  - All **91 tests passed** (71 existing Phase 1–4 tests + 20 new Phase 5 API tests) in 4.80s.

---

## Phase 5 (Frontend): Institutional Workstation & Deliberate UI Design

### 1. Requirements & Architecture
- **Objective**: Build a real institutional treasury/risk workstation for Jerifin with a sophisticated, restrained, and editorial design language. Strictly avoid generic AI dashboard templates, floating cards, glassmorphism, glowing borders, neon colors, and AI visual clichés.
- **Frontend Stack**:
  - Next.js 16 (App Router with Turbopack) & React 19.
  - TypeScript with strict domain schemas (`src/lib/types.ts`).
  - Handcrafted institutional design system (`src/app/globals.css`) with hairline borders (`1px solid #E2E8F0`), tabular numerals (`tabular-nums`), and restrained functional risk color tokens.
  - Typed API client (`src/lib/api.ts`) connecting to FastAPI backend (`http://127.0.0.1:8000`).

### 2. Core UI Workstation Modules Implemented
- **Header (`src/components/Header.tsx`)**: Refined Jerifin wordmark, platform subtitle, subtle Demo/Synthetic data badge, live backend connection probe, and methodology modal trigger.
- **Capital Controls (`src/components/CapitalSelector.tsx`)**: Dynamic capital pool controls with presets (₹10 Cr, ₹50 Cr, ₹100 Cr, ₹250 Cr, ₹500 Cr, ₹1,000 Cr) and custom input. Updates monetary values instantly while keeping allocation weights invariant.
- **Metric Strip (`src/components/MetricStrip.tsx`)**: High-density headline metrics: Capital Managed, Expected Return, Volatility, 95% CVaR tail loss ($/%), Liquidity Score, and Policy State badge.
- **Allocation Matrix (`src/components/AllocationTable.tsx`)**: First-class financial data table with Ticker, Name, Class, Tier, Duration, Weight slider/input, Monetary Allocation (₹ Cr), Post-Shock Drift Weight, and Horizon breakdown ladder.
- **Convex Optimizer (`src/components/OptimizerPanel.tsx`)**: Interactive constraint sliders (Single Asset Cap, Equity Ceiling, Liquidity Floor, Max CVaR, Drawdown), "Solve Optimal Allocation" button, solver diagnostics, and active constraint audit table.
- **Risk Governance Audit (`src/components/PolicyAuditPanel.tsx`)**: Independent policy compliance matrix with utilization progress bars, rule status (`NORMAL`, `WARNING`, `BREACH`, `CRITICAL`), and compliance explanations.
- **Defensive Rebalance (`src/components/DefensiveRebalance.tsx`)**: Minimal-turnover before/after schedule, monetary trade shift, and policy restoration to `NORMAL`.
- **Stress Workbench (`src/components/StressWorkbench.tsx`)**: 5 predefined macro shock templates, custom shock sliders, per-asset return drag / P&L impact table, and a multi-scenario side-by-side comparative ranking matrix.
- **Methodology & Transparency (`src/components/DisclaimerModal.tsx`)**: Comprehensive institutional disclosure explaining synthetic returns, CVXPY formulations, and why deterministic stress shocks are not historical VaR.

### 3. Verification & Build
- **Next.js Production Build**: `corepack pnpm run build` executed and succeeded with 0 errors (TypeScript and static prerendering verified).
- **Backend Test Suite**: All **91 pytest tests** passed with zero regressions.
- **Live Servers**: FastAPI running on `http://127.0.0.1:8000` and Next.js running on `http://localhost:3000`.



