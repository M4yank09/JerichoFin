# Jerifin Stress Testing & Scenario Analysis Engine Specification

This document details the architecture, deterministic scenario methodology, shock assumptions, P&L calculations, policy integration, and regulatory disclaimers for the Jerifin Stress Testing Engine (Phase 4).

---

> [!CAUTION]
> **DISCLAIMER: HACKATHON SIMULATION ENGINE — NOT A PREDICTIVE FORECASTING TOOL**
> The macroeconomic stress scenarios, asset-class shocks, and resulting P&L projections documented herein represent deterministic, illustrative tail scenarios designed solely for institutional decision-support and policy compliance testing. They **do not** constitute probabilistic market forecasts, economic certainties, or audited regulatory submissions (e.g. CCAR/DFAST/EBA).

---

## 1. Goal & Architecture

The Stress Testing Engine enables institutional treasuries and corporate finance teams to answer:
> *"What happens to the institution's portfolio if a severe but plausible macroeconomic shock occurs?"*

```
+-------------------------------------------------------------------------+
|                           Baseline Portfolio                            |
|             (Capital C, Weights w_0, Assets Universe A)                 |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         Stress Testing Engine                           |
|                                                                         |
|  1. Scenario Selection (Predefined / Custom):                           |
|     - EQUITY_CRASH              - LIQUIDITY_CRISIS                      |
|     - INTEREST_RATE_SHOCK       - INFLATION_SHOCK                       |
|     - COMBINED_MACRO_SHOCK                                              |
|                                                                         |
|  2. Shock Application & P&L Calculation:                                |
|     - Asset-specific return shock: s_i                                  |
|     - Stressed portfolio return: R_{p, stress} = sum(w_i * s_i)         |
|     - Monetary P&L: PnL = C * R_{p, stress}                             |
|     - Ending capital: V_{stress} = C * (1 + R_{p, stress})              |
|                                                                         |
|  3. Post-Shock Portfolio Drifting Weights:                              |
|     - w_i' = w_i * (1 + s_i) / (1 + R_{p, stress})                      |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         Policy Control Engine                           |
|             Evaluate Drifting Portfolio Against Hard Limits             |
|                  (Liquidity, Equity, CVaR, Drawdown)                    |
+------------------------------------+------------------------------------+
                                     |
                +--------------------+--------------------+
                |                                         |
         [NORMAL / WARNING]                      [BREACH / CRITICAL]
                |                                         |
                v                                         v
        Stress Test Report                    Trigger Phase 3 Defensive
         (Approved State)                            Rebalancer
                                             (Restore Policy Compliance)
```

---

## 2. Deterministic Scenarios & Shock Assumptions

All predefined scenarios apply deterministic percentage return shocks $s_i \in (-1.0, 2.0]$ across asset classes:

| Scenario ID | Severity | Asset Class / Instrument | Return Shock ($s_i$) | Economic Rationale & Assumptions |
| :--- | :--- | :--- | :---: | :--- |
| **`EQUITY_CRASH`** | `SEVERE` | Strategic Yield / Equity<br>Corporate Bonds<br>Commercial Paper<br>Sovereign Bonds<br>Cash & Repo | -25.0%<br>-5.0%<br>-1.0%<br>+0.5%<br>0.0% | Severe equity de-risking; minor credit spread widening; flight-to-quality duration rally protects government paper; cash remains unaffected. |
| **`INTEREST_RATE_SHOCK`** | `MODERATE` | Cash & Equivalents<br>Commercial Paper<br>Strategic Yield<br>Sovereign Bonds<br>Corporate Bonds | +0.2%<br>-1.5%<br>-4.0%<br>-6.0%<br>-8.5% | Parallel upward shift (+150 bps) across the yield curve. Fixed income suffers capital losses proportional to modified duration; cash reinvestment yield resets higher. |
| **`LIQUIDITY_CRISIS`** | `SEVERE` | Cash & Overnight<br>Sovereign Bonds<br>Commercial Paper<br>Corporate Bonds<br>Strategic Yield Buffer | 0.0%<br>-0.5%<br>-4.5%<br>-10.0%<br>-18.0% | Wholesale liquidity freeze. Secondary dealer market depth evaporates; Tier 1 cash is preserved, while illiquid credit and strategic overlays take fire-sale discounts. |
| **`INFLATION_SHOCK`** | `MODERATE` | Strategic Yield / Commodity<br>Cash & Equivalents<br>Commercial Paper<br>Sovereign Bonds<br>Corporate Bonds | +6.0%<br>-1.0%<br>-2.0%<br>-7.0%<br>-9.0% | Stagflationary impulse. Commodity and inflation overlays appreciate; nominal bonds experience heavy term-premium discounts; cash suffers real purchasing power erosion. |
| **`COMBINED_MACRO_SHOCK`** | `EXTREME` | Cash & Equivalents<br>Sovereign Bonds<br>Commercial Paper<br>Corporate Bonds<br>Strategic Yield | 0.0%<br>-4.5%<br>-5.0%<br>-12.0%<br>-22.0% | Synchronized systemic crisis combining rate hikes, credit freeze, and equity rout. Worst-case tail stress scenario. |

---

## 3. Mathematical Calculation Methodology

### 3.1 Stressed Portfolio Return
$$R_{p, \text{stress}} = \sum_{i=1}^n w_i s_i = \mathbf{w}^T \mathbf{s}$$
where $w_i$ is the initial baseline weight and $s_i$ is the applied shock.

### 3.2 Monetary P&L and Stressed Portfolio Value
$$\text{P\&L}_{\text{stress}} = C \times R_{p, \text{stress}}$$
$$V_{\text{stress}} = C + \text{P\&L}_{\text{stress}} = C \times (1 + R_{p, \text{stress}})$$

### 3.3 Post-Shock Drifting Portfolio Weights
As asset values shift during a crisis, their portfolio proportions naturally drift:
$$v_i' = C \times w_i \times (1 + s_i)$$
$$w_i' = \frac{v_i'}{V_{\text{stress}}} = \frac{w_i (1 + s_i)}{1 + R_{p, \text{stress}}}$$
If $V_{\text{stress}} > 0$, then $\sum w_i' = 1.0$ and $w_i' \ge 0$.

### 3.4 Per-Asset Contribution
- **Return Contribution**: $\text{Contrib}_{R, i} = w_i \times s_i$
- **Monetary P&L Contribution**: $\text{Contrib}_{\$, i} = C \times w_i \times s_i$
$$\sum_{i=1}^n \text{Contrib}_{R, i} = R_{p, \text{stress}}, \quad \sum_{i=1}^n \text{Contrib}_{\$, i} = \text{P\&L}_{\text{stress}}$$

---

## 4. Distinction: Stress Testing vs. Historical VaR

It is critical in financial engineering to maintain separation between statistical risk metrics and deterministic scenario analysis:

| Characteristic | Historical Value-at-Risk (VaR / CVaR) | Deterministic Scenario Analysis (Stress Testing) |
| :--- | :--- | :--- |
| **Nature** | Probabilistic, statistical quantile ($q_{0.05}$). | Deterministic "What-If" scenario simulation. |
| **Input Data** | Empirical historical daily return distribution ($T \ge 252$). | Prescribed macroeconomic shocks ($s_i$). |
| **Probability Assumption** | Assumes historical sample represents future distributions. | No probability assigned; evaluates survival under extreme tail conditions. |
| **Output Format** | Loss threshold at 95% confidence over 1-day horizon. | Total instantaneous capital drawdown and post-shock drift. |

> [!NOTE]
> A scenario shock is **never** mixed into the historical return dataset, nor is it reported as VaR.

---

## 5. Defensive Response Integration

When a stress scenario pushes the post-shock portfolio into **`BREACH`** or **`CRITICAL`** status (e.g. liquidity drains below the 70% floor, or single-asset concentration spikes due to relative price changes), the engine invokes the Phase 3 `RiskControlEngine.execute_defensive_rebalance`:
1. Inputs the stressed portfolio weights $\mathbf{w}'$ and ending capital $V_{\text{stress}}$.
2. Solves the convex minimum-turnover problem restoring hard policy compliance.
3. Quantifies required turnover and displays dynamic before/after metrics.

---

## 6. Custom Scenario Validation

Custom scenarios allow institutional treasurers to test proprietary hypothetical events. The engine strictly validates:
- Non-empty scenario identifiers and human-readable names.
- Valid numeric shock values: strictly $s_i > -1.0$ (assets cannot lose more than 100% of capital) and $s_i \le +2.0$.
- No `NaN` or `Inf` entries.
