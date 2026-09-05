# Jerifin System Architecture

## Overview
Jerifin provides institutional-grade capital allocation and treasury risk analytics. The system decouples heavy quantitative financial simulations from user-facing interactive visualization.

```
+-------------------------------------------------------------+
|                     Next.js Frontend                        |
|   (Treasury Dashboard, Allocation Matrix, Risk Scenarios)   |
+------------------------------+------------------------------+
                               | REST / HTTP JSON
                               v
+-------------------------------------------------------------+
|                     FastAPI Gateway (Phase 5)               |
|   - CORS Middleware & Configurable Origins                  |
|   - Request/Response Validation via Pydantic v2             |
|   - Standardized Error Handling (400, 422, 404, 500)        |
|   - OpenAPI / Swagger Documentation (/docs, /redoc)         |
|   - Modular API v1 Routers:                                 |
|       * /portfolio: Asset universe & risk/liquidity metrics |
|       * /optimize: CVXPY constrained portfolio allocation   |
|       * /risk: Policy evaluation & defensive rebalance      |
|       * /stress: Macro scenario simulations & comparisons   |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                Quantitative Financial Engine                |
|   +--------------------------+  +-------------------------+ |
|   | Capital Allocation       |  | Treasury Risk Engine    | |
|   | - CVXPY Optimizer        |  | - Historical VaR / CVaR | |
|   | - Defensive Rebalancer   |  | - Liquidity scoring     | |
|   | - Turnover Minimization  |  | - Stress Testing Engine | |
|   +--------------------------+  +-------------------------+ |
+-------------------------------------------------------------+
```

## Layers

1. **Presentation Tier (`frontend/`)**
   - Built on Next.js.
   - Real-time visualization of treasury portfolios, liquidity ladders, and risk metrics.

2. **API & Orchestration Tier (`backend/app/api/` - Phase 5)**
   - **Framework**: FastAPI with Uvicorn ASGI server.
   - **Validation**: Pydantic v2 schemas for all request/response models. Capital is strictly dynamic and required for all allocation/optimization operations.
   - **CORS**: Environment-configurable origin whitelisting for local development (`http://localhost:3000`) and Vercel cloud deployments.
   - **Error Handling**: Dedicated exception handlers mapping engine validation errors (`ValueError`) and solver infeasibility to actionable HTTP 400 and 422 JSON envelopes.

3. **Quantitative Financial Engine (`backend/app/engine/`)**
   - Pure Python / NumPy / SciPy / CVXPY computing layer.
   - **Analytics & Risk**: Deterministic metrics including expected return, annualized volatility, 95% historical VaR/CVaR, maximum drawdown, HHI, and weighted liquidity scores.
   - **Optimizer**: Conic convex optimization maximizing expected return subject to policy ceilings, floors, liquidity constraints, CVaR, and drawdown.
   - **Risk Controller**: Independent policy governance evaluating limits and executing convex defensive rebalancing with minimal turnover.
   - **Stress Engine**: Macroeconomic scenario simulation calculating post-shock weight drift, monetary P&L, and automatic defensive response triggers.
