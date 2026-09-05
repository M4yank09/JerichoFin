"""Multi-Horizon Liquidity Outlook and Cash Coverage Engine for Institutional Treasuries.

Purpose:
Estimates whether the institution can comfortably satisfy its operational liquidity obligations
over forward-looking horizons under baseline and stressed conditions.

Methodology:
- 100% Deterministic: Clear cash tier weighting, empirical haircuts, and modeled treasury commitments.
- Multi-Horizon: 7 Days (Immediate), 30 Days (Operating), 90 Days (Quarterly), 180 Days (Semi-Annual).
- Formula:
    Coverage Ratio = (Available Liquid Capital - Stress Haircut) / Simulated Outflow Need
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional
import numpy as np

from app.schemas.portfolio import (
    Asset,
    PortfolioConfig,
    PortfolioMetrics,
    TreasuryPolicy,
)


class LiquidityOutlookStatus(str, Enum):
    """Institutional liquidity adequacy status."""
    HEALTHY = "HEALTHY"      # Coverage >= 1.25x under stress case
    WATCH = "WATCH"          # Coverage 1.00x - 1.25x under stress case
    AT_RISK = "AT_RISK"      # Coverage < 1.00x (potential liquidity shortfall under stress)


@dataclass
class HorizonLiquidityDetail:
    """Granular coverage report for a specific time horizon."""
    horizon_days: int
    horizon_label: str                    # "7 Days (Immediate)", "30 Days (Operating)", etc.
    available_liquid_capital: float       # Monetarily available liquid reserves
    baseline_outflow_need: float          # Simulated operational obligations
    stress_haircut_monetary: float        # Valuation / liquidation haircut under stress
    stressed_available_capital: float     # Net available reserves under stress
    baseline_coverage_ratio: float        # Available / Outflow
    stress_coverage_ratio: float          # Stressed Available / Outflow
    policy_minimum_ratio: float           # Typically 1.00x (100% coverage)
    status: str                           # "HEALTHY", "WATCH", "AT_RISK"
    tier_contributions: Dict[str, float]  # Liquidity contribution per tier
    explanation: str


@dataclass
class LiquidityOutlookResult:
    """Comprehensive multi-horizon liquidity outlook report."""
    capital: float
    current_liquidity_score: float
    primary_horizon_days: int             # Default selected horizon (e.g. 30 days)
    horizons: List[HorizonLiquidityDetail]
    methodology_notes: str


class LiquidityOutlookEngine:
    """Calculates multi-horizon liquidity coverage and stress haircuts."""

    # Outflow commitments as a fraction of total treasury pool for corporate treasury simulations
    HORIZON_CONFIGS = [
        {"days": 7, "label": "7 Days (Immediate)", "outflow_pct": 0.05, "t1_avail": 1.00, "t2_avail": 0.40, "t3_avail": 0.00, "haircut_base": 0.001, "haircut_stress": 0.015},
        {"days": 30, "label": "30 Days (Operating)", "outflow_pct": 0.15, "t1_avail": 1.00, "t2_avail": 0.85, "t3_avail": 0.10, "haircut_base": 0.003, "haircut_stress": 0.035},
        {"days": 90, "label": "90 Days (Quarterly)", "outflow_pct": 0.35, "t1_avail": 1.00, "t2_avail": 1.00, "t3_avail": 0.40, "haircut_base": 0.006, "haircut_stress": 0.065},
        {"days": 180, "label": "180 Days (Semi-Annual)", "outflow_pct": 0.60, "t1_avail": 1.00, "t2_avail": 1.00, "t3_avail": 0.75, "haircut_base": 0.010, "haircut_stress": 0.100},
    ]

    def evaluate(
        self,
        config: PortfolioConfig,
        metrics: PortfolioMetrics,
        policy: Optional[TreasuryPolicy] = None,
        selected_horizon_days: int = 30,
    ) -> LiquidityOutlookResult:
        """Evaluates liquidity coverage ratios across standard treasury horizons.

        Parameters
        ----------
        config : PortfolioConfig
            Portfolio capital pool and weights.
        metrics : PortfolioMetrics
            Computed metrics with monetary allocations and tier breakdown.
        policy : Optional[TreasuryPolicy]
            Governance parameters.
        selected_horizon_days : int
            Default primary horizon (default 30).
        """
        capital = config.total_capital
        weights = config.weights
        assets = config.assets
        
        # Calculate capital allocated to each liquidity tier
        tier1_capital = metrics.tier_breakdown.get(1, 0.0) * capital
        tier2_capital = metrics.tier_breakdown.get(2, 0.0) * capital
        tier3_capital = metrics.tier_breakdown.get(3, 0.0) * capital

        horizon_reports: List[HorizonLiquidityDetail] = []

        for h in self.HORIZON_CONFIGS:
            days = h["days"]
            label = h["label"]
            outflow_need = h["outflow_pct"] * capital

            # Available liquid capital given realization horizons
            avail_t1 = tier1_capital * h["t1_avail"]
            avail_t2 = tier2_capital * h["t2_avail"]
            avail_t3 = tier3_capital * h["t3_avail"]
            total_avail = avail_t1 + avail_t2 + avail_t3

            # Haircuts
            stress_haircut = (
                avail_t1 * (h["haircut_stress"] * 0.1) +
                avail_t2 * (h["haircut_stress"] * 0.6) +
                avail_t3 * (h["haircut_stress"] * 1.5)
            )
            stressed_avail = max(0.0, total_avail - stress_haircut)

            base_coverage = total_avail / outflow_need if outflow_need > 0 else 99.0
            stress_coverage = stressed_avail / outflow_need if outflow_need > 0 else 99.0

            if stress_coverage >= 1.25:
                status = LiquidityOutlookStatus.HEALTHY.value
                exp = f"Comfortable liquidity surplus ({stress_coverage:.2f}x under stress). Operational buffer exceeds commitments."
            elif stress_coverage >= 1.00:
                status = LiquidityOutlookStatus.WATCH.value
                exp = f"Adequate but tight coverage ({stress_coverage:.2f}x under stress). Approaches policy 1.00x floor."
            else:
                status = LiquidityOutlookStatus.AT_RISK.value
                exp = f"Potential shortfall under stress ({stress_coverage:.2f}x). Reserves may not fully satisfy {days}-day obligations."

            horizon_reports.append(HorizonLiquidityDetail(
                horizon_days=days,
                horizon_label=label,
                available_liquid_capital=round(total_avail, 2),
                baseline_outflow_need=round(outflow_need, 2),
                stress_haircut_monetary=round(stress_haircut, 2),
                stressed_available_capital=round(stressed_avail, 2),
                baseline_coverage_ratio=round(base_coverage, 2),
                stress_coverage_ratio=round(stress_coverage, 2),
                policy_minimum_ratio=1.00,
                status=status,
                tier_contributions={
                    "Tier 1 (Cash/TREPS)": round(avail_t1, 2),
                    "Tier 2 (T-Bills/CP/CD)": round(avail_t2, 2),
                    "Tier 3 (Strategic/Bonds)": round(avail_t3, 2),
                },
                explanation=exp,
            ))

        methodology = (
            "Liquidity Coverage Model assesses liquid capital against modeled corporate operational requirements. "
            "Tier 1 cash/TREPS provides 100% immediate availability; Tier 2 paper provides progressive liquidation "
            "subject to secondary market settlement windows. Stress cases simulate illiquidity widening and bid-ask haircuts."
        )

        return LiquidityOutlookResult(
            capital=capital,
            current_liquidity_score=metrics.weighted_liquidity_score,
            primary_horizon_days=selected_horizon_days,
            horizons=horizon_reports,
            methodology_notes=methodology,
        )
