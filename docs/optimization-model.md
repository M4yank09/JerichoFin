# Jerifin Portfolio Optimization Engine Specification

This document details the mathematical formulation, decision variables, risk constraints, scenario-based CVaR/drawdown models, solver architecture, and engineering assumptions behind the Jerifin Portfolio Optimization Engine (Phase 2).

---

## 1. Problem Formulation & Objective

The primary objective of the Jerifin Institutional Optimizer is to determine capital allocation weights $\mathbf{w} \in \mathbb{R}^n$ across $n$ institutional assets that maximize the expected annualized portfolio return subject to institutional risk, liquidity, and governance constraints.

### Mathematical Objective
$$\max_{\mathbf{w}} \quad \boldsymbol{\mu}^T \mathbf{w} \iff \min_{\mathbf{w}} \quad -\boldsymbol{\mu}^T \mathbf{w}$$

where:
- $\mathbf{w} = [w_1, w_2, \dots, w_n]^T$ denotes the vector of portfolio weights.
- $\boldsymbol{\mu} = [\mu_1, \mu_2, \dots, \mu_n]^T$ denotes the vector of annualized expected asset returns.

---

## 2. Decision Variables

1. **Portfolio Weights**: $\mathbf{w} \in \mathbb{R}^n$ representing fraction of capital allocated to each asset.
2. **Auxiliary Value-at-Risk Threshold (for CVaR constraint)**: $\gamma \in \mathbb{R}$, a scalar representing the $(1-\alpha)$ quantile of losses.
3. **Auxiliary Scenario Tail Slacks (for CVaR constraint)**: $\mathbf{u} \in \mathbb{R}^T$, where $u_t \ge 0$ captures excess losses beyond the threshold $\gamma$ for scenario $t$.
4. **Auxiliary Running Peaks (for Drawdown constraint)**: $\mathbf{M} \in \mathbb{R}^T$, tracking peak cumulative returns across historical sample paths.

---

## 3. Supported Constraints

### 3.1 Fully Invested Budget
$$\sum_{i=1}^n w_i = 1.0$$
Guarantees 100% of available treasury capital is deployed without leverage.

### 3.2 Long-Only Mandate
$$w_i \ge 0, \quad \forall i \in \{1, \dots, n\}$$
*(Optional floor $w_i \ge w_{\text{min}}$ if minimum nonzero positioning is configured).*

### 3.3 Maximum Single-Asset Exposure
$$w_i \le \text{max\_single\_asset\_weight}, \quad \forall i \in \{1, \dots, n\}$$
Prevents idiosyncratic counterparty or issuer default concentration (e.g. max 35% in any single instrument).

### 3.4 Maximum Equity / Strategic Yield Exposure
$$\sum_{i \in \text{StrategicYield}} w_i \le \text{max\_equity\_weight}$$
Enforces corporate treasury risk policies limiting volatile or illiquid yield overlays.

### 3.5 Minimum Portfolio Liquidity Score
$$\sum_{i=1}^n w_i L_i \ge \text{min\_liquidity\_score}$$
where $L_i \in [0.0, 1.0]$ is the normalized liquidity metric per asset ($1.0 = \text{cash}, 0.95 = \text{T-bills}, 0.65 = \text{Corp IG}, 0.40 = \text{Strategic Yield}$).

---

## 4. Scenario-Based CVaR Formulation (Rockafellar & Uryasev, 2000)

### Why Naive CVaR Linearity is Mathematically Invalid
In financial engineering, Conditional Value-at-Risk ($\text{CVaR}_\alpha$) is **not** a linear function of individual asset CVaRs ($\text{CVaR}_p \ne \sum w_i \text{CVaR}_i$) because it accounts for portfolio diversification and non-linear joint tail dependence. Approximating CVaR using Gaussian volatility scaling ($\mu - k\sigma$) violates fat-tailed empirical reality.

### Exact Convex Scenario Formulation
Let $R \in \mathbb{R}^{T \times n}$ denote the matrix of historical or synthetic scenario returns, where row $t$ is $r_t = [R_{t,1}, \dots, R_{t,n}]^T$.
The portfolio loss at scenario $t$ is:
$$L_t(\mathbf{w}) = -r_t^T \mathbf{w} = -(R\mathbf{w})_t$$

Under the Rockafellar-Uryasev (2000) theorem, for confidence level $\alpha = 0.95$ (tail probability $\beta = 1 - \alpha = 0.05$):
$$\text{CVaR}_\alpha(\mathbf{w}) = \min_{\gamma \in \mathbb{R}} \left\{ \gamma + \frac{1}{\beta T} \sum_{t=1}^T [L_t(\mathbf{w}) - \gamma]^+ \right\}$$

By introducing auxiliary slack vector $\mathbf{u} \in \mathbb{R}^T$, the constraint $\text{CVaR}_\alpha(\mathbf{w}) \le \text{max\_cvar}$ is expressed as a set of linear inequalities:
$$u_t \ge -r_t^T \mathbf{w} - \gamma, \quad \forall t \in \{1, \dots, T\}$$
$$u_t \ge 0, \quad \forall t \in \{1, \dots, T\}$$
$$\gamma + \frac{1}{\beta T} \sum_{t=1}^T u_t \le \text{max\_cvar}$$

This representation is exact, convex, operates directly on historical empirical scenarios, and is solvable via interior-point conic and linear solvers.

---

## 5. Scenario-Based Maximum Drawdown Formulation (Chekhlov et al., 2005)

Cumulative return along the historical sample path at period $t$:
$$y_t = \sum_{\tau=1}^t r_\tau^T \mathbf{w} = \left(\sum_{\tau=1}^t r_\tau\right)^T \mathbf{w}$$

Let $M_t$ be the running peak cumulative return up to period $t$:
$$M_0 \ge 0, \quad M_0 \ge y_0$$
$$M_t \ge M_{t-1}, \quad M_t \ge y_t, \quad \forall t \in \{1, \dots, T-1\}$$
Drawdown at period $t$: $D_t = M_t - y_t \ge 0$.
The constraint enforces:
$$M_t - y_t \le \text{max\_drawdown}, \quad \forall t \in \{1, \dots, T\}$$

---

## 6. Solvers & Architecture

- **Modeling Framework**: [CVXPY](https://www.cvxpy.org/) (v1.9+).
- **Primary Solver**: `CLARABEL` (high-performance interior-point conic solver).
- **Fallback Solvers**: `HIGHS` / `OSQP` / `SCS`.
- **Performance**: Typical solve duration is $< 50$ milliseconds for $n=5$ assets over $T=252$ daily historical scenarios.

---

## 7. Failure Handling & Infeasibility Diagnostics

When a constraint set is contradictory (e.g. sum of individual caps $< 1.0$, or minimum liquidity floor incompatible with CVaR ceiling):
1. The solver flags the problem status as `INFEASIBLE`.
2. The optimizer catches this and returns a structured `OptimizationResult` with `status="INFEASIBLE"`, empty weights (`{}`), and zero allocations.
3. Detailed `ConstraintCheck` records identify which limits were active in the infeasible set.
4. An informative message is provided to guide the treasurer on constraint relaxation.

---

## 8. Why This Model is Appropriate for the Hackathon Prototype

1. **Institutional Credibility**: Corporate treasurers demand rigorous, explainable risk management (CVaR tail protection, liquidity buffers, hard single-issuer caps) rather than black-box heuristic algorithms.
2. **Speed & Convexity**: Formulating the problem within a convex linear/conic framework guarantees mathematical optimality without local minima traps, converging in milliseconds.
3. **Capital Scaling**: Monetary allocation scales dynamically with total capital pool $C$ ($A_i = w_i \times C$) without hardcoding arbitrary amounts.
4. **Decoupled Architecture**: Financial optimization is independent from presentation and API layers, enabling reliable reuse across CLI, REST endpoints, and future UI components.

---

## 9. Current Limitations & Roadmap

- **Transaction Costs & Turnover**: Current formulation assumes frictionless rebalancing. Transaction cost penalty terms ($\lambda \|\mathbf{w} - \mathbf{w}_0\|_1$) can be added in subsequent phases.
- **Dynamic Regime Switching**: Scenarios are drawn from static historical lookbacks; future extensions may incorporate forward-looking scenario generator trees.
