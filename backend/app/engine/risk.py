"""Treasury Risk Engine.

Evaluates institutional portfolio risk, liquidity, and allocation metrics
using historical return distributions and modern portfolio analytics.
"""
from typing import Any, Dict, Optional, Union
import numpy as np
import pandas as pd

from app.engine.analytics import (
    calculate_covariance_matrix,
    calculate_expected_return,
    calculate_hhi,
    calculate_historical_cvar,
    calculate_historical_var,
    calculate_largest_exposure,
    calculate_liquidity_tier_breakdown,
    calculate_max_drawdown,
    calculate_monetary_allocations,
    calculate_portfolio_return_series,
    calculate_portfolio_volatility,
    calculate_weighted_liquidity_score,
    validate_weights,
)
from app.schemas.portfolio import PortfolioConfig, PortfolioMetrics


class TreasuryRiskEngine:
    """Evaluates institutional treasury portfolio risk and compliance metrics."""

    def __init__(
        self,
        confidence_level: float = 0.95,
        periods_per_year: int = 252,
    ) -> None:
        """Initializes the risk engine.

        Parameters
        ----------
        confidence_level : float
            Confidence level for VaR/CVaR calculations (default 0.95 for 95%).
        periods_per_year : int
            Number of trading/compounding periods per year (default 252).
        """
        self.confidence_level = confidence_level
        self.periods_per_year = periods_per_year

    def calculate_var(
        self,
        portfolio_returns: Union[pd.Series, np.ndarray],
        confidence_level: Optional[float] = None,
    ) -> float:
        """Calculates Historical Value at Risk under the positive loss convention."""
        level = confidence_level or self.confidence_level
        return calculate_historical_var(portfolio_returns, confidence_level=level)

    def calculate_cvar(
        self,
        portfolio_returns: Union[pd.Series, np.ndarray],
        confidence_level: Optional[float] = None,
    ) -> float:
        """Calculates Historical CVaR / Expected Shortfall in worst tail."""
        level = confidence_level or self.confidence_level
        return calculate_historical_cvar(portfolio_returns, confidence_level=level)

    def evaluate_portfolio(
        self,
        config: PortfolioConfig,
        returns_df: pd.DataFrame,
    ) -> PortfolioMetrics:
        """Performs comprehensive Phase 1 risk and allocation analysis for a portfolio.

        Parameters
        ----------
        config : PortfolioConfig
            Portfolio configuration with assets, weights, and capital pool size.
        returns_df : pd.DataFrame
            Historical returns matrix containing columns for each portfolio asset.

        Returns
        -------
        PortfolioMetrics
            Structured summary of all portfolio analytics.
        """
        allowed_symbols = [a.symbol for a in config.assets]
        validate_weights(config.weights, allowed_symbols=allowed_symbols)

        # 1. Historical portfolio returns series
        p_returns = calculate_portfolio_return_series(config.weights, returns_df)

        # 2. Expected return and covariance
        exp_return = calculate_expected_return(
            config.weights,
            returns_df,
            annualized=True,
            periods_per_year=self.periods_per_year,
        )
        cov_matrix = calculate_covariance_matrix(
            returns_df,
            annualized=True,
            periods_per_year=self.periods_per_year,
        )

        # 3. Volatility & Sharpe
        volatility = calculate_portfolio_volatility(
            config.weights,
            cov_matrix,
            annualized=True,
            periods_per_year=self.periods_per_year,
        )
        excess_return = exp_return - config.risk_free_rate
        sharpe = excess_return / volatility if volatility > 1e-8 else 0.0

        # 4. VaR & CVaR (Historical)
        var_95 = self.calculate_var(p_returns)
        cvar_95 = self.calculate_cvar(p_returns)
        var_dollar = var_95 * config.total_capital
        cvar_dollar = cvar_95 * config.total_capital

        # 5. Maximum Drawdown
        max_dd = calculate_max_drawdown(p_returns)

        # 6. Concentration & Exposures
        hhi = calculate_hhi(config.weights)
        largest_sym, largest_w = calculate_largest_exposure(config.weights)

        # 7. Liquidity Scores & Tiers
        liq_scores = {a.symbol: a.liquidity_score for a in config.assets}
        liq_tiers = {a.symbol: a.liquidity_tier for a in config.assets}
        weighted_liq = calculate_weighted_liquidity_score(config.weights, liq_scores)
        tier_breakdown = calculate_liquidity_tier_breakdown(config.weights, liq_tiers)

        # 8. Monetary Allocations
        monetary_allocs = calculate_monetary_allocations(config.weights, config.total_capital)

        return PortfolioMetrics(
            expected_return_annualized=exp_return,
            volatility_annualized=volatility,
            sharpe_ratio=sharpe,
            var_95_historical=var_95,
            cvar_95_historical=cvar_95,
            var_95_monetary=var_dollar,
            cvar_95_monetary=cvar_dollar,
            max_drawdown=max_dd,
            hhi_concentration=hhi,
            largest_exposure_asset=largest_sym,
            largest_exposure_weight=largest_w,
            weighted_liquidity_score=weighted_liq,
            tier_breakdown=tier_breakdown,
            monetary_allocations=monetary_allocs,
        )

    def run_stress_test(
        self,
        portfolio: Dict[str, Any],
        scenario: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Simulates portfolio impact under macroeconomic stress scenarios.

        Note: To be implemented in a subsequent phase per platform roadmap.
        """
        raise NotImplementedError("Stress testing simulation to be implemented in a subsequent phase.")
