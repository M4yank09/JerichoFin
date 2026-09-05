# Jerifin Financial Model & Risk Methodology Specification

This document details the mathematical models, statistical conventions, assumptions, and algorithmic limitations implemented in the foundational financial engine (Phase 1).

---

## 1. Asset & Portfolio Representations

- **Asset Universe**: Each instrument $i \in \{1, \dots, n\}$ is defined by symbol, asset class, liquidity tier $T_i \in \{1, 2, 3\}$, normalized liquidity score $L_i \in [0.0, 1.0]$, modified duration $D_i \ge 0$, and expected return $\mu_i$.
- **Portfolio Weight Vector**: $\mathbf{w} = [w_1, w_2, \dots, w_n]^T$ subject to:
  $$\sum_{i=1}^n w_i = 1.0 \quad \text{and} \quad w_i \ge 0 \quad (\text{long-only})$$
- **Total Capital**: Scaled capital pool $C \in \mathbb{R}^+$.

---

## 2. Mathematical Formulations

### 2.1 Expected Portfolio Return
$$\mathbb{E}[R_p] = \mathbf{w}^T \boldsymbol{\mu} = \sum_{i=1}^n w_i \mu_i$$
- **Annualization**: When computed from daily historical returns with mean $\bar{R}_i$, annualization applies a standard trading year convention:
  $$\mu_{i, \text{ann}} = \bar{R}_i \times 252$$

### 2.2 Covariance Matrix & Portfolio Volatility
- **Sample Covariance**:
  $$\Sigma_{i,j} = \frac{1}{T-1} \sum_{t=1}^T (R_{i,t} - \bar{R}_i)(R_{j,t} - \bar{R}_j)$$
- **Annualized Covariance**:
  $$\boldsymbol{\Sigma}_{\text{ann}} = \boldsymbol{\Sigma}_{\text{daily}} \times 252$$
- **Annualized Volatility**:
  $$\sigma_p = \sqrt{\mathbf{w}^T \boldsymbol{\Sigma}_{\text{ann}} \mathbf{w}}$$

### 2.3 Historical Value at Risk (VaR 95%)
- **Return Convention vs. Loss Convention**:
  Standard institutional risk reporting defines VaR as a **positive fraction representing loss magnitude**.
- Let $R_{p, t} = \sum_{i=1}^n w_i R_{i, t}$ be the portfolio return at historical day $t$.
- For confidence level $\alpha = 0.95$ (tail probability $1 - \alpha = 0.05$):
  $$q_{0.05} = \text{Quantile}_{0.05}(\{R_{p, t}\}_{t=1}^T)$$
  $$\text{VaR}_{95\%} = -q_{0.05}$$
  - *Quantile Method*: Evaluated using the discrete empirical order statistic (`method="lower"`) to prevent artificial interpolation across discrete return jumps.
- **Monetary VaR**:
  $$\text{VaR}_{\$} = C \times \text{VaR}_{95\%}$$

### 2.4 Historical Conditional Value at Risk (CVaR / Expected Shortfall 95%)
- **Tail Expectation**:
  $$\text{CVaR}_{95\%} = -\mathbb{E}[R_p \mid R_p \le q_{0.05}] = -\frac{1}{|K|} \sum_{t \in K} R_{p, t}$$
  where $K = \{t \mid R_{p, t} \le q_{0.05}\}$.
- **Strict Adherence**: CVaR is evaluated directly from empirical tail losses and is **never** approximated via normal distribution volatility scaling.
- By definition, $\text{CVaR}_{95\%} \ge \text{VaR}_{95\%}$.
- **Monetary CVaR**:
  $$\text{CVaR}_{\$} = C \times \text{CVaR}_{95\%}$$

### 2.5 Maximum Drawdown (MDD)
- Compounded wealth index tracking with $W_0 = 1.0$:
  $$W_t = \prod_{\tau=1}^t (1 + R_{p, \tau})$$
- Peak wealth at or before time $t$:
  $$P_t = \max_{0 \le \tau \le t} W_\tau$$
- Maximum drawdown (positive fraction):
  $$\text{MDD} = \max_{0 \le t \le T} \left( \frac{P_t - W_t}{P_t} \right) = -\min_{0 \le t \le T} \left( \frac{W_t - P_t}{P_t} \right)$$

### 2.6 Herfindahl-Hirschman Index (HHI) Concentration
$$\text{HHI} = \sum_{i=1}^n w_i^2$$
- Bounded in $[1/n, 1.0]$. A lower score represents greater diversification.

### 2.7 Largest Single-Asset Exposure
$$\text{Exposure}_{\text{max}} = \max_{i} w_i, \quad \text{Asset}_{\text{max}} = \arg\max_{i} w_i$$

### 2.8 Weighted Liquidity Score & Tier Distribution
- **Portfolio-Weighted Liquidity Score**:
  $$L_p = \sum_{i=1}^n w_i L_i \quad \in [0.0, 1.0]$$
- **Tier Breakdown**:
  $$w_{\text{Tier } k} = \sum_{i: \text{Tier}_i = k} w_i \quad \text{for } k \in \{1, 2, 3\}$$
  - *Tier 1*: Immediate liquidity (T+0 to T+1)
  - *Tier 2*: Operational liquidity (T+2 to T+30)
  - *Tier 3*: Strategic yield buffer (T+30+)

### 2.9 Capital Scaling (Monetary Allocations)
$$A_i = w_i \times C \quad \text{for each asset } i$$
$$\sum_{i=1}^n A_i = C$$

---

## 3. Assumptions & Methodology

1. **Daily Compounding**: Returns are modeled as discrete daily percentage changes $R_{i, t} = \frac{P_t - P_{t-1}}{P_{t-1}}$.
2. **Annualization Factor**: 252 trading days per calendar year.
3. **Static Weights in Backtest**: Historical VaR/CVaR assumes static asset weights held over the observation window (fixed-weight simulation).
4. **Deterministic Synthetic Baseline**: Synthetic historical returns are generated with fixed seeds (`np.random.default_rng(42)`) and cross-asset correlation matrices reflecting institutional treasury dynamics (e.g., flight to quality during credit stress).

---

## 4. Limitations & Roadmap

1. **Static Rebalancing**: Does not account for intra-period transaction costs, slippage, or rebalancing drift.
2. **Linear Cash Flow Profiling**: Fixed income duration is treated as linear first-order sensitivity; convexity adjustments will be added in subsequent phases.
3. **Historical Window Sensitivity**: VaR and CVaR depend on the length and regime of the historical simulation window (minimum recommended window $T \ge 252$ days for 95% tail confidence).
4. **No Derivative Pricing**: Non-linear derivatives (options, swaptions) are outside the Phase 1 scope.
