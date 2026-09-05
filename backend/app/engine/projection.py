"""Scenario-Based Portfolio Projection Engine for Institutional Treasuries.

DISCLAIMER:
Scenario projection — not a guaranteed forecast.
This module produces scenario-based decision-support ranges derived from the available
empirical return distribution and explicit macroeconomic assumptions.
It DOES NOT claim predictive certainty or audited future market returns.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import numpy as np
import pandas as pd

from app.engine.analytics import calculate_portfolio_return_series
from app.schemas.portfolio import PortfolioConfig, PortfolioMetrics


@dataclass
class ScenarioRange:
    """Projected portfolio capital and percentage return interval under a scenario."""
    scenario_name: str
    min_value: float            # Ending capital lower bound
    max_value: float            # Ending capital upper bound
    min_return_pct: float       # Percentage return lower bound
    max_return_pct: float       # Percentage return upper bound
    assumptions: str


@dataclass
class HorizonProjection:
    """Multi-scenario projection outcomes for a specific forward horizon."""
    horizon_months: int
    horizon_label: str
    conservative: ScenarioRange
    base_case: ScenarioRange
    favorable: ScenarioRange


@dataclass
class PortfolioProjectionResult:
    """Comprehensive portfolio outlook with transparent scenario breakdowns."""
    capital: float
    expected_return_annualized: float
    volatility_annualized: float
    projections: List[HorizonProjection]
    selected_horizon_months: int
    methodology: str
    disclaimer: str


class PortfolioProjectionEngine:
    """Generates scenario-based capital outcome intervals from empirical distributions."""

    SUPPORTED_HORIZONS = [
        {"months": 3, "years": 0.25, "label": "3-Month Horizon (Quarterly)"},
        {"months": 6, "years": 0.50, "label": "6-Month Horizon (Semi-Annual)"},
        {"months": 12, "years": 1.00, "label": "12-Month Horizon (Annual)"},
    ]

    def project(
        self,
        config: PortfolioConfig,
        returns_df: pd.DataFrame,
        metrics: PortfolioMetrics,
        selected_horizon_months: int = 12,
    ) -> PortfolioProjectionResult:
        """Projects scenario-based ranges across standard horizons.

        Parameters
        ----------
        config : PortfolioConfig
            Capital pool and weights.
        returns_df : pd.DataFrame
            Historical/synthetic daily return series.
        metrics : PortfolioMetrics
            Computed baseline return and volatility.
        selected_horizon_months : int
            Primary forward horizon (default 12).
        """
        capital = config.total_capital
        weights = config.weights
        port_returns = calculate_portfolio_return_series(weights, returns_df)

        mu_annual = metrics.expected_return_annualized
        sigma_annual = metrics.volatility_annualized

        horizon_projections: List[HorizonProjection] = []

        for h in self.SUPPORTED_HORIZONS:
            months = h["months"]
            T = h["years"]
            label = h["label"]

            # Scale expected return and volatility for horizon T
            # Horizon expected carry
            h_carry = mu_annual * T
            # Horizon empirical standard deviation
            h_vol = sigma_annual * np.sqrt(T)

            # Scenario 1: Conservative Case
            # Adverse macro environment: yield curve steepening / credit spread widening
            # 10th to 25th percentile empirical trajectory
            cons_ret_min = float(max(-0.15, h_carry - 1.28 * h_vol))
            cons_ret_max = float(max(-0.05, h_carry - 0.40 * h_vol))
            cons_min_val = capital * (1.0 + cons_ret_min)
            cons_max_val = capital * (1.0 + cons_ret_max)

            # Scenario 2: Base Case
            # Central expected trajectory: regular carry reinvestment and normal liquidity spreads
            # 40th to 60th percentile empirical central path
            base_ret_min = float(h_carry - 0.25 * h_vol)
            base_ret_max = float(h_carry + 0.25 * h_vol)
            base_min_val = capital * (1.0 + base_ret_min)
            base_max_val = capital * (1.0 + base_ret_max)

            # Scenario 3: Favorable Case
            # Constructive macro environment: stable inflation, moderate rate softening, tight credit
            # 75th to 90th percentile empirical trajectory
            fav_ret_min = float(h_carry + 0.40 * h_vol)
            fav_ret_max = float(h_carry + 1.28 * h_vol)
            fav_min_val = capital * (1.0 + fav_ret_min)
            fav_max_val = capital * (1.0 + fav_ret_max)

            horizon_projections.append(HorizonProjection(
                horizon_months=months,
                horizon_label=label,
                conservative=ScenarioRange(
                    scenario_name="Conservative Case",
                    min_value=round(cons_min_val, 2),
                    max_value=round(cons_max_val, 2),
                    min_return_pct=round(cons_ret_min, 4),
                    max_return_pct=round(cons_ret_max, 4),
                    assumptions="Adverse macroeconomic headwind, minor credit spread widening, and elevated rate volatility.",
                ),
                base_case=ScenarioRange(
                    scenario_name="Base Case",
                    min_value=round(base_min_val, 2),
                    max_value=round(base_max_val, 2),
                    min_return_pct=round(base_ret_min, 4),
                    max_return_pct=round(base_ret_max, 4),
                    assumptions="Orderly baseline carry accrual with full reinvestment at prevailing repo and T-Bill benchmarks.",
                ),
                favorable=ScenarioRange(
                    scenario_name="Favorable Case",
                    min_value=round(fav_min_val, 2),
                    max_value=round(fav_max_val, 2),
                    min_return_pct=round(fav_ret_min, 4),
                    max_return_pct=round(fav_ret_max, 4),
                    assumptions="Constructive monetary policy easing, duration gains in benchmark G-Secs, and tight corporate spreads.",
                ),
            ))

        return PortfolioProjectionResult(
            capital=capital,
            expected_return_annualized=mu_annual,
            volatility_annualized=sigma_annual,
            projections=horizon_projections,
            selected_horizon_months=selected_horizon_months,
            methodology="Scenario-based projection ranges derived from the available empirical return distribution and explicit assumptions.",
            disclaimer="Scenario projection — not a guaranteed forecast.",
        )
