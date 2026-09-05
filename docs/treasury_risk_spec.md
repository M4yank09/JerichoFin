# Treasury Risk & Allocation Engine Specifications

## 1. Capital Allocation Scope
The engine targets institutional treasury scenarios, allocating capital across:
- **Cash & Cash Equivalents**: Overnight deposits, repo, commercial paper.
- **Fixed Income**: Sovereign bonds, investment-grade corporate paper, short/medium-term duration notes.
- **Hedging / Yield Assets**: FX hedges, inflation-linked instruments, money market funds.

## 2. Risk Metrics & Stress Testing
- **Value-at-Risk (VaR)**: 95% and 99% confidence intervals across standard holding periods (1-day, 10-day, 30-day).
- **Conditional Value-at-Risk (CVaR / Expected Shortfall)**: Tail risk measurement for liquidity black swans.
- **Liquidity Tiers**: Tier 1 (immediate cash), Tier 2 (operational liquidity < 30 days), Tier 3 (strategic yield buffer).
- **Interest Rate Shock Tests**: Shifts in yield curves (parallel and non-parallel twists).
