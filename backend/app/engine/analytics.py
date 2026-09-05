"""Foundational Financial and Treasury Risk Analytics.

This module provides pure mathematical and statistical calculations for:
- Portfolio return & volatility
- Historical Value at Risk (VaR) & Conditional Value at Risk (CVaR / Expected Shortfall)
- Maximum Drawdown (MDD)
- Herfindahl-Hirschman Index (HHI) concentration
- Single-asset exposure limits
- Weighted liquidity scoring and tier breakdown
- Capital-to-monetary scaling and portfolio validation

All functions are pure, deterministic, and strictly decoupled from API and UI layers.
"""
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd


def validate_weights(
    weights: Dict[str, float],
    allowed_symbols: Optional[List[str]] = None,
    tolerance: float = 1e-4,
    long_only: bool = True,
) -> None:
    """Validates portfolio asset weights.

    Parameters
    ----------
    weights : Dict[str, float]
        Dictionary mapping asset symbols to fractional portfolio weights.
    allowed_symbols : Optional[List[str]]
        If provided, validates that weights only contain symbols from this list.
    tolerance : float
        Allowed floating-point deviation from 1.0 for the weight sum.
    long_only : bool
        If True, validates that all weights are non-negative.

    Raises
    ------
    ValueError
        If weights are empty, don't sum to 1.0, contain invalid symbols,
        or violate the long-only constraint.
    """
    if not weights:
        raise ValueError("Portfolio weights dictionary cannot be empty.")

    if allowed_symbols is not None:
        allowed_set = set(allowed_symbols)
        invalid_symbols = [s for s in weights if s not in allowed_set]
        if invalid_symbols:
            raise ValueError(f"Unknown asset symbols in weights: {invalid_symbols}. Allowed: {allowed_symbols}")

    total_weight = sum(weights.values())
    if abs(total_weight - 1.0) > tolerance:
        raise ValueError(
            f"Portfolio weights must sum to 1.0 within tolerance {tolerance}. "
            f"Current sum: {total_weight:.6f}"
        )

    if long_only:
        negative_weights = {k: v for k, v in weights.items() if v < -tolerance}
        if negative_weights:
            raise ValueError(f"Negative weights detected under long-only constraint: {negative_weights}")


def calculate_expected_return(
    weights: Dict[str, float],
    asset_returns_or_means: Union[pd.DataFrame, Dict[str, float]],
    annualized: bool = True,
    periods_per_year: int = 252,
) -> float:
    """Calculates expected portfolio return.

    Formula:
        E[R_p] = sum_i (w_i * E[R_i])

    Parameters
    ----------
    weights : Dict[str, float]
        Asset symbol to weight mapping.
    asset_returns_or_means : Union[pd.DataFrame, Dict[str, float]]
        Either a DataFrame of periodic historical returns (columns=symbols)
        or a precomputed dictionary of asset mean returns.
    annualized : bool
        If True, annualizes the return by multiplying periodic mean by periods_per_year.
    periods_per_year : int
        Number of compounding/trading periods in a year (default 252 trading days).

    Returns
    -------
    float
        Expected portfolio return.
    """
    validate_weights(weights)

    if isinstance(asset_returns_or_means, pd.DataFrame):
        means = asset_returns_or_means[[s for s in weights.keys()]].mean().to_dict()
        if annualized:
            means = {k: v * periods_per_year for k, v in means.items()}
    else:
        means = asset_returns_or_means

    exp_return = sum(weights[s] * means[s] for s in weights.keys())
    return float(exp_return)


def calculate_covariance_matrix(
    returns_df: pd.DataFrame,
    annualized: bool = True,
    periods_per_year: int = 252,
) -> pd.DataFrame:
    """Calculates the sample covariance matrix of asset returns.

    Formula:
        Sigma_{i,j} = (1 / (T - 1)) * sum_t (R_{i,t} - R_bar_i)(R_{j,t} - R_bar_j)

    Parameters
    ----------
    returns_df : pd.DataFrame
        Historical returns with columns as asset symbols.
    annualized : bool
        If True, scales covariance by periods_per_year.
    periods_per_year : int
        Trading days in a year (default 252).

    Returns
    -------
    pd.DataFrame
        Covariance matrix.
    """
    cov = returns_df.cov()
    if annualized:
        cov = cov * periods_per_year
    return cov


def calculate_portfolio_volatility(
    weights: Dict[str, float],
    cov_matrix: pd.DataFrame,
    annualized: bool = True,
    periods_per_year: int = 252,
) -> float:
    """Calculates portfolio volatility (standard deviation).

    Formula:
        sigma_p = sqrt(w^T * Sigma * w)

    Parameters
    ----------
    weights : Dict[str, float]
        Asset symbol to weight mapping.
    cov_matrix : pd.DataFrame
        Covariance matrix of returns.
    annualized : bool
        Whether the returned volatility is annualized.
    periods_per_year : int
        Trading days in a year.

    Returns
    -------
    float
        Annualized or periodic portfolio volatility.
    """
    validate_weights(weights)

    symbols = list(weights.keys())
    sub_cov = cov_matrix.loc[symbols, symbols].values
    w_vec = np.array([weights[s] for s in symbols])

    variance = float(np.dot(w_vec.T, np.dot(sub_cov, w_vec)))
    variance = max(0.0, variance)  # Guard against minute numerical precision issues
    return float(np.sqrt(variance))


def calculate_portfolio_return_series(
    weights: Dict[str, float],
    returns_df: pd.DataFrame,
) -> pd.Series:
    """Calculates the historical portfolio return series for each period t.

    Formula:
        R_{p, t} = sum_i (w_i * R_{i, t})

    Parameters
    ----------
    weights : Dict[str, float]
        Asset symbol to weight mapping.
    returns_df : pd.DataFrame
        Asset periodic returns DataFrame.

    Returns
    -------
    pd.Series
        Historical periodic portfolio return series.
    """
    validate_weights(weights)
    symbols = list(weights.keys())
    sub_returns = returns_df[symbols]
    w_vec = pd.Series([weights[s] for s in symbols], index=symbols)
    return sub_returns.dot(w_vec)


def calculate_historical_var(
    portfolio_returns: Union[pd.Series, np.ndarray],
    confidence_level: float = 0.95,
    method: str = "lower",
) -> float:
    """Calculates Historical Value at Risk (VaR).

    Convention:
        - Downside threshold is the (1 - confidence_level) quantile of portfolio returns.
        - Standard Institutional Loss Convention: VaR is expressed as a POSITIVE
          fraction representing the loss magnitude.
          E.g. If the 5th percentile return is -0.024 (-2.4%), VaR_95 = 0.024 (2.4% loss).

    Formula:
        q_{alpha} = Quantile_{1 - confidence_level}(R_p)
        VaR = -q_{alpha}

    Parameters
    ----------
    portfolio_returns : Union[pd.Series, np.ndarray]
        Empirical historical portfolio return distribution.
    confidence_level : float
        Confidence level (e.g. 0.95 for 95% VaR).
    method : str
        Quantile calculation method (default 'lower' for empirical discrete distribution).

    Returns
    -------
    float
        Historical VaR expressed as a positive loss proportion.
    """
    if not (0.0 < confidence_level < 1.0):
        raise ValueError(f"Confidence level must be between 0 and 1, got {confidence_level}")

    returns_arr = np.asarray(portfolio_returns)
    if len(returns_arr) == 0:
        raise ValueError("portfolio_returns cannot be empty.")

    tail_prob = (1.0 - confidence_level) * 100.0
    downside_cutoff = float(np.percentile(returns_arr, tail_prob, method=method))

    # Loss convention: loss is positive
    return -downside_cutoff


def calculate_historical_cvar(
    portfolio_returns: Union[pd.Series, np.ndarray],
    confidence_level: float = 0.95,
    method: str = "lower",
) -> float:
    """Calculates Historical Conditional Value at Risk (CVaR / Expected Shortfall).

    Convention:
        - CVaR represents the conditional expectation of loss given that the return
          is less than or equal to the downside VaR threshold (the worst 5% tail).
        - Stated under the standard Institutional Loss Convention (POSITIVE number).
        - STRICT IMPLEMENTATION: Computed directly from empirical tail losses,
          NEVER approximated via volatility or normal distribution.

    Formula:
        q_{alpha} = Quantile_{1 - confidence_level}(R_p)
        CVaR = -E[R_p | R_p <= q_{alpha}]

    Parameters
    ----------
    portfolio_returns : Union[pd.Series, np.ndarray]
        Empirical historical portfolio return distribution.
    confidence_level : float
        Confidence level (e.g. 0.95).
    method : str
        Quantile calculation method (default 'lower' for empirical discrete distribution).

    Returns
    -------
    float
        Historical CVaR expressed as a positive loss proportion.
    """
    if not (0.0 < confidence_level < 1.0):
        raise ValueError(f"Confidence level must be between 0 and 1, got {confidence_level}")

    returns_arr = np.asarray(portfolio_returns)
    if len(returns_arr) == 0:
        raise ValueError("portfolio_returns cannot be empty.")

    tail_prob = (1.0 - confidence_level) * 100.0
    cutoff = float(np.percentile(returns_arr, tail_prob, method=method))

    # Empirical tail returns
    tail_returns = returns_arr[returns_arr <= cutoff]
    if len(tail_returns) == 0:
        return -cutoff

    mean_tail_return = float(np.mean(tail_returns))
    return -mean_tail_return


def calculate_max_drawdown(
    portfolio_returns: Union[pd.Series, np.ndarray],
) -> float:
    """Calculates Maximum Drawdown (MDD) from compounding return series.

    Formula:
        W_t = prod_{tau=1}^t (1 + R_tau)
        Peak_t = max_{0 <= tau <= t} W_tau
        Drawdown_t = (W_t - Peak_t) / Peak_t
        MDD = max_t (Peak_t - W_t) / Peak_t = -min_t (Drawdown_t)

    Parameters
    ----------
    portfolio_returns : Union[pd.Series, np.ndarray]
        Sequence of periodic portfolio returns.

    Returns
    -------
    float
        Maximum drawdown expressed as a positive percentage/fraction [0.0 to 1.0].
    """
    returns_arr = np.asarray(portfolio_returns)
    if len(returns_arr) == 0:
        return 0.0

    wealth_index = np.cumprod(1.0 + returns_arr)
    wealth_index = np.insert(wealth_index, 0, 1.0)  # Initial capital = 1.0

    running_peak = np.maximum.accumulate(wealth_index)
    drawdowns = (wealth_index - running_peak) / running_peak

    max_dd = -float(np.min(drawdowns))
    return max(0.0, max_dd)


def calculate_hhi(weights: Dict[str, float]) -> float:
    """Calculates Herfindahl-Hirschman Index (HHI) concentration metric.

    Formula:
        HHI = sum_i (w_i^2)

    Scale:
        Normalized between 1/n (perfectly diversified) and 1.0 (100% single asset).

    Parameters
    ----------
    weights : Dict[str, float]
        Asset weights.

    Returns
    -------
    float
        HHI value between 0.0 and 1.0.
    """
    validate_weights(weights)
    return float(sum(w**2 for w in weights.values()))


def calculate_largest_exposure(weights: Dict[str, float]) -> Tuple[str, float]:
    """Identifies the single asset with the largest exposure and its weight.

    Parameters
    ----------
    weights : Dict[str, float]
        Asset weights.

    Returns
    -------
    Tuple[str, float]
        (asset_symbol, weight)
    """
    validate_weights(weights)
    top_symbol = max(weights, key=weights.get)
    return top_symbol, float(weights[top_symbol])


def calculate_weighted_liquidity_score(
    weights: Dict[str, float],
    liquidity_scores: Dict[str, float],
) -> float:
    """Calculates portfolio-weighted liquidity score.

    Formula:
        L_p = sum_i (w_i * L_i)

    Parameters
    ----------
    weights : Dict[str, float]
        Asset weights.
    liquidity_scores : Dict[str, float]
        Asset symbol to normalized liquidity score [0.0, 1.0].

    Returns
    -------
    float
        Portfolio weighted liquidity score [0.0 to 1.0].
    """
    validate_weights(weights)
    score = sum(weights[s] * liquidity_scores[s] for s in weights.keys())
    return float(score)


def calculate_liquidity_tier_breakdown(
    weights: Dict[str, float],
    liquidity_tiers: Dict[str, int],
) -> Dict[int, float]:
    """Aggregates portfolio allocation percentages by institutional liquidity tier.

    Tiers:
        - Tier 1: Immediate cash & overnight repo (T+0 to T+1)
        - Tier 2: Operational liquidity (T+2 to T+30)
        - Tier 3: Strategic yield buffer (T+30+)

    Parameters
    ----------
    weights : Dict[str, float]
        Asset weights.
    liquidity_tiers : Dict[str, int]
        Mapping from asset symbol to tier integer (1, 2, 3).

    Returns
    -------
    Dict[int, float]
        Dictionary mapping tier integer to aggregated portfolio weight.
    """
    validate_weights(weights)
    tier_sums: Dict[int, float] = {1: 0.0, 2: 0.0, 3: 0.0}

    for s, w in weights.items():
        tier = liquidity_tiers.get(s, 3)
        tier_sums[tier] = tier_sums.get(tier, 0.0) + w

    return tier_sums


def calculate_monetary_allocations(
    weights: Dict[str, float],
    total_capital: float,
) -> Dict[str, float]:
    """Calculates monetary capital allocation per asset.

    Formula:
        Allocation_i = w_i * Total_Capital

    Parameters
    ----------
    weights : Dict[str, float]
        Asset weights.
    total_capital : float
        Total fund / pool capital.

    Returns
    -------
    Dict[str, float]
        Mapping of asset symbol to dollar allocation amount.
    """
    if total_capital < 0:
        raise ValueError(f"total_capital must be non-negative, got {total_capital}")
    validate_weights(weights)
    return {s: float(w * total_capital) for s, w in weights.items()}
