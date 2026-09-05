# Jerifin

> **Institutional Capital Allocation & Treasury Risk Platform**

Jerifin is an institutional treasury intelligence platform built to help organizations make **risk-aware capital allocation decisions** across multi-asset portfolios.

Instead of treating portfolio optimization, liquidity, stress testing, and risk governance as separate workflows, Jerifin brings them together into a single decision-support system.

It combines **quantitative portfolio optimization, institutional risk controls, liquidity analysis, scenario-based stress testing, and defensive rebalancing** into one interactive platform.

---

## The Problem

Institutional treasuries need to answer questions such as:

- How should available capital be allocated across asset classes?
- Is the current portfolio compliant with risk and liquidity policies?
- What happens if equities crash or interest rates suddenly rise?
- How much liquidity remains available over different time horizons?
- When does a portfolio move from acceptable risk into a warning or breach state?
- What is the minimum-change rebalance required to restore compliance?

Traditional workflows often require separate spreadsheets, risk models, scenario tools, and manual analysis.

**Jerifin connects these decisions into one quantitative workflow.**

---

## What Jerifin Does

### 1. Portfolio Analysis

Analyze a portfolio across key institutional risk and performance metrics:

- Expected return
- Portfolio volatility
- Historical VaR
- CVaR / Expected Shortfall
- Maximum drawdown
- Concentration / HHI
- Liquidity scoring
- Monetary allocation breakdown

---

### 2. Constrained Portfolio Optimization

Jerifin uses **CVXPY-based convex optimization** to generate portfolio allocations subject to institutional constraints.

The optimizer can incorporate:

- Individual asset limits
- Equity exposure caps
- Liquidity floors
- Scenario-based CVaR constraints
- Maximum drawdown constraints
- Dynamic capital scaling

The objective is to improve expected portfolio return while respecting the defined risk and liquidity policy.

---

### 3. Institutional Risk Governance

The platform independently evaluates portfolios against policy rules and classifies their condition into four states:

```text
NORMAL
WARNING
BREACH
CRITICAL
