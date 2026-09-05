# Jerifin Risk Control & Defensive Rebalancing Engine Specification

This document details the architecture, mathematical formulations, governance states (`NORMAL`, `WARNING`, `BREACH`, `CRITICAL`), policy checking algorithms, defensive rebalancing methodology, and explainability frameworks of the Jerifin Risk Control Engine (Phase 3).

---

## 1. System Architecture & Control Hierarchy

Jerifin decouples **portfolio proposal generation** (Optimizer) from **policy enforcement and risk governance** (Risk Control Engine). 

```
+----------------------------------------------------------------------+
|                     Portfolio Proposal Source                        |
|        (Optimizer Engine / Current Allocation / Proposed Shift)      |
+----------------------------------+-----------------------------------+
                                   |
                                   v
+----------------------------------------------------------------------+
|                       Risk Control Engine                            |
|                                                                      |
|  1. Policy Verification Pipeline:                                    |
|     - Weighted Liquidity Floor        - Single-Asset Cap             |
|     - Equity / Strategic Cap          - 95% CVaR Ceiling             |
|     - Historical Drawdown Ceiling     - Rebalance Drift              |
|                                                                      |
|  2. Governance State Determination:                                  |
|     [NORMAL]  --> Risk comfortably compliant within limits           |
|     [WARNING] --> Metric in warning band (e.g. 85-100% of cap)       |
|     [BREACH]  --> Hard policy limit violated                         |
|     [CRITICAL]--> Multi-limit breach or severe tail shock            |
+----------------------------------+-----------------------------------+
                                   |
           +-----------------------+-----------------------+
           |                                               |
  [NORMAL / WARNING]                              [BREACH / CRITICAL]
           |                                               |
           v                                               v
    Approve Allocation                        Trigger Defensive Rebalancing
    (No Action Needed)                       (Min Turnover Policy Restoration)
```

> [!IMPORTANT]
> The Risk Control Engine operates as an authoritative institutional gatekeeper. The optimizer can **never** bypass or override a hard policy limit.

---

## 2. Risk Governance States

The control engine classifies the portfolio into one of four distinct states:

| Risk State | Definition | Operational Action |
| :--- | :--- | :--- |
| **`NORMAL`** | All risk, liquidity, and exposure metrics are comfortably within policy limits (below the warning band). | Allocation approved. Normal treasury operations. |
| **`WARNING`** | At least one metric is approaching its configured policy limit (within the 85%–100% utilization band). | Flagged for treasury officer review. Rebalancing not mandatory but monitored. |
| **`BREACH`** | Exactly one hard policy constraint is violated ($>100\%$ limit utilization). | Mandatory defensive rebalancing required to restore compliance. |
| **`CRITICAL`** | Multiple policy constraints violated ($\ge 2$ breaches) OR any single metric severely exceeds policy ($>125\%$ limit utilization). | Immediate capital preservation action triggered. |

---

## 3. Policy Checking & Warning Band Methodology

### 3.1 Lower-is-Safer Metrics (Equity Cap, Single-Asset Cap, CVaR, Drawdown)
- **Current Value**: $V \ge 0$
- **Policy Limit**: $L > 0$
- **Utilization Percentage**:
  $$\text{Utilization} = \frac{V}{L} \times 100\%$$
- **Classification Rules**:
  1. $\text{CRITICAL}$: If $V > L \times \text{critical\_multiplier}$ (default $1.25 \times L$, or $>125\%$ utilization).
  2. $\text{BREACH}$: Else if $V > L$ (utilization $>100\%$).
  3. $\text{WARNING}$: Else if $V \ge L \times \text{warning\_threshold}$ (default $0.85 \times L$, or $85\% \dots 100\%$ utilization).
  4. $\text{NORMAL}$: Else $V < 0.85 \times L$.

### 3.2 Higher-is-Safer Metrics (Weighted Portfolio Liquidity Score)
- **Current Score**: $L_p = \sum w_i L_i \in [0.0, 1.0]$
- **Policy Floor**: $L_{\text{min}} \in (0.0, 1.0]$ (e.g. 0.70)
- **Compliance Ratio**:
  $$\text{Compliance} = \frac{L_p}{L_{\text{min}}} \times 100\%$$
- **Classification Rules**:
  1. $\text{CRITICAL}$: If $L_p < L_{\text{min}} \times (2.0 - \text{critical\_multiplier})$ (e.g. $< 0.75 \times L_{\text{min}}$).
  2. $\text{BREACH}$: Else if $L_p < L_{\text{min}}$ (compliance $< 100\%$).
  3. $\text{WARNING}$: Else if $L_p \le L_{\text{min}} \times (1.0 + (1.0 - \text{warning\_threshold}))$ (e.g. within 15% buffer above the floor).
  4. $\text{NORMAL}$: Else $L_p > 1.15 \times L_{\text{min}}$.

---

## 4. Automated Defensive Rebalancing Engine

When a portfolio enters `BREACH` or `CRITICAL` state, the defensive rebalancer generates a target allocation that restores compliance while minimizing unnecessary transaction costs and market disruption.

### 4.1 Mathematical Formulation
Rather than hardcoding arbitrary heuristics, the defensive engine solves a **convex minimum-turnover compliance restoration problem**:

$$\min_{\mathbf{w}} \quad \frac{1}{2} \|\mathbf{w} - \mathbf{w}_0\|_1 + \lambda_{\text{tail}} \text{CVaR}_{95\%}(\mathbf{w}) - \lambda_{\text{liq}} \mathbf{L}^T \mathbf{w}$$

Subject to:
1. **Budget & Long-Only**:
   $$\sum_{i=1}^n w_i = 1.0, \quad w_i \ge 0$$
2. **Single-Asset Cap**:
   $$w_i \le \text{policy.max\_single\_asset\_weight} \times \theta, \quad \forall i$$
3. **Equity / Strategic Yield Cap**:
   $$\sum_{i \in \text{Strategic}} w_i \le \text{policy.max\_equity\_weight} \times \theta$$
4. **Liquidity Floor**:
   $$\mathbf{L}^T \mathbf{w} \ge \text{policy.min\_liquidity\_score} \times (1 + (1 - \theta))$$
5. **Exact Scenario CVaR (Rockafellar & Uryasev)**:
   $$u_t \ge -r_t^T \mathbf{w} - \gamma, \quad u_t \ge 0, \quad \gamma + \frac{1}{\beta T}\sum_{t=1}^T u_t \le \text{policy.max\_cvar} \times \theta$$
6. **Maximum Drawdown (Chekhlov et al.)**:
   $$M_t \ge M_{t-1}, \quad M_t \ge y_t, \quad M_t - y_t \le \text{policy.max\_drawdown} \times \theta$$

### 4.2 Two-Stage Target Buffer Strategy
- **Stage 1 ($\theta = \text{warning\_threshold} \times 0.98 \approx 0.83$)**: Targets the safe `NORMAL` zone so the rebalanced portfolio does not immediately sit on the edge of the warning band.
- **Stage 2 ($\theta = 1.0$)**: If market conditions or tight policies render the buffer infeasible, falls back to exact hard policy limits to ensure guaranteed feasibility.
- If even Stage 2 is infeasible, the engine returns `status="INFEASIBLE"` with:
  `"No feasible defensive allocation exists under the current policy constraints."`

---

## 5. Portfolio Turnover & Rebalance Drift

### 5.1 Turnover Metric
Portfolio turnover measures the one-way percentage of capital reallocated:
$$\text{Turnover} = \frac{1}{2} \sum_{i=1}^n |w_i^{\text{target}} - w_i^{\text{current}}| \in [0.0, 1.0]$$

### 5.2 Asset Drift & Rebalance Trigger
For each asset $i$:
$$\text{Drift}_i = |w_i^{\text{target}} - w_i^{\text{current}}|$$
$$\text{Drift}_{\$, i} = \text{Drift}_i \times \text{Total Capital}$$
- Rebalance is flagged as required if $\exists i : \text{Drift}_i > \text{drift\_threshold}$ (default 3%).

---

## 6. Dynamic Explainability

Every defensive recommendation produces a calculation-backed, transparent explanation detailing:
1. **Initial Risk State**: Identifies whether the portfolio was in `BREACH` or `CRITICAL`.
2. **Breached Policy Rules**: Explicitly names which constraints triggered the defensive action.
3. **Reallocation Actions**: Quantifies which high-risk assets were trimmed and which defensive assets were augmented.
4. **Before vs. After Metrics Table**: Shows exact quantitative improvements in CVaR, liquidity score, equity exposure, drawdown, and total turnover required.

---

## 7. Prototype Assumptions vs. Institutional Regulations

- **Prototype Scope**: Policy limits (e.g. 15% equity, 35% single-asset cap, 2.5% CVaR) are illustrative institutional treasury baselines designed to demonstrate governance mechanics in a hackathon setting.
- **Regulatory Frameworks**: Real-world treasury deployments may configure these parameters to comply with Basel III liquidity coverage ratios (LCR), net stable funding ratios (NSFR), or internal corporate Investment Policy Statements (IPS).
