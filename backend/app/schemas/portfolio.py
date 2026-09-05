"""Data schemas and domain models for portfolio assets, configurations, and risk metrics."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class AssetClass(str, Enum):
    """Institutional asset classifications."""
    CASH_EQUIVALENTS = "Cash & Equivalents"
    SOVEREIGN_BONDS = "Sovereign Bonds"
    CORPORATE_BONDS = "Corporate Bonds"
    COMMERCIAL_PAPER = "Commercial Paper"
    STRATEGIC_YIELD = "Strategic Yield & Hedging"


class LiquidityTier(int, Enum):
    """Treasury liquidity tiers based on liquidation horizon."""
    TIER_1_IMMEDIATE = 1   # T+0 to T+1 (Overnight repo, cash deposits)
    TIER_2_OPERATIONAL = 2 # T+2 to T+30 (Treasury bills, high-grade commercial paper)
    TIER_3_STRATEGIC = 3   # T+30+ (Medium-term notes, corporate bonds, yield buffer)


@dataclass
class Asset:
    """Institutional asset specification."""
    symbol: str
    name: str
    asset_class: str
    liquidity_tier: int = 1
    liquidity_score: float = 1.0  # Normalized liquidity score: 0.0 (illiquid) to 1.0 (cash)
    duration: float = 0.0         # Macaulay/Modified duration in years
    currency: str = "USD"
    expected_return: Optional[float] = None  # Annualized expected return if predetermined
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not (0.0 <= self.liquidity_score <= 1.0):
            raise ValueError(f"liquidity_score for {self.symbol} must be between 0.0 and 1.0, got {self.liquidity_score}")
        if self.duration < 0.0:
            raise ValueError(f"duration for {self.symbol} must be non-negative, got {self.duration}")


@dataclass
class AssetHolding:
    """Holding position in a portfolio."""
    symbol: str
    asset_class: str
    market_value: float
    duration: Optional[float] = None
    currency: str = "USD"


@dataclass
class PortfolioConfig:
    """Portfolio allocation configuration and constraints."""
    portfolio_id: str
    name: str
    assets: List[Asset]
    weights: Dict[str, float]
    total_capital: float = 10_000_000.0  # Default $10M treasury pool
    risk_free_rate: float = 0.045         # Annualized risk-free rate (e.g. 4.5% US SOFR / T-Bill)
    description: str = ""


@dataclass
class PortfolioMetrics:
    """Comprehensive portfolio analytics and risk metrics."""
    expected_return_annualized: float
    volatility_annualized: float
    sharpe_ratio: float
    var_95_historical: float         # 95% Historical VaR (expressed as positive loss proportion)
    cvar_95_historical: float        # 95% Historical CVaR / Expected Shortfall (positive loss proportion)
    var_95_monetary: float           # Dollar VaR at 95% confidence
    cvar_95_monetary: float          # Dollar CVaR at 95% confidence
    max_drawdown: float              # Maximum peak-to-trough decline (positive proportion)
    hhi_concentration: float         # Herfindahl-Hirschman Index [0.0 to 1.0]
    largest_exposure_asset: str      # Asset symbol with highest allocation
    largest_exposure_weight: float   # Weight of largest allocation
    weighted_liquidity_score: float  # Portfolio-weighted liquidity score [0.0 to 1.0]
    tier_breakdown: Dict[int, float] # Allocation % by liquidity tier (Tier 1, 2, 3)
    monetary_allocations: Dict[str, float]  # Cash allocated per asset


@dataclass
class ConstraintCheck:
    """Detailed evaluation record for an individual portfolio constraint."""
    constraint_name: str
    actual_value: float
    limit: float
    passed: bool
    operator: str  # "<=", ">=", "=="
    description: str = ""


@dataclass
class OptimizationConstraints:
    """Configurable constraints for the institutional portfolio optimizer."""
    max_single_asset_weight: Optional[float] = None  # e.g., 0.35 (35% max single asset)
    max_equity_weight: Optional[float] = None        # e.g., 0.15 (15% max equity/strategic yield)
    min_liquidity_score: Optional[float] = None      # e.g., 0.70 min portfolio-weighted liquidity
    max_cvar: Optional[float] = None                 # e.g., 0.03 (3.0% max daily CVaR)
    cvar_confidence_level: float = 0.95              # Confidence level for CVaR (default 0.95)
    max_drawdown: Optional[float] = None             # e.g., 0.05 (5.0% max historical drawdown)
    long_only: bool = True                           # Long-only constraint (w_i >= 0)
    min_single_asset_weight: Optional[float] = None  # Optional minimum floor for all assets
    custom_asset_limits: Dict[str, float] = field(default_factory=dict) # Symbol-specific upper bounds


@dataclass
class OptimizationResult:
    """Comprehensive typed result model returned by PortfolioOptimizer."""
    status: str                                       # "OPTIMAL", "INFEASIBLE", "ERROR"
    weights: Dict[str, float]                         # Optimized weights (empty if infeasible)
    allocations: Dict[str, float]                     # Monetary capital allocation per asset
    expected_return: float                            # Annualized expected return
    volatility: float                                 # Annualized volatility
    var: float                                        # 95% Historical VaR
    cvar: float                                       # 95% Historical CVaR
    max_drawdown: float                               # Historical maximum drawdown
    hhi: float                                        # Herfindahl-Hirschman Index
    largest_exposure: Tuple[str, float]               # (asset_symbol, weight)
    liquidity_score: float                            # Portfolio-weighted liquidity score
    constraint_checks: List[ConstraintCheck]          # Status of all evaluated constraints
    message: str = ""                                 # Informative status or diagnostic message
    solve_time_seconds: float = 0.0


class RiskState(str, Enum):
    """Institutional treasury risk governance states."""
    NORMAL = "NORMAL"        # All metrics compliant and comfortably within limits
    WARNING = "WARNING"      # Risk is approaching configured policy limit
    BREACH = "BREACH"        # At least one hard policy limit violated
    CRITICAL = "CRITICAL"    # Severe breach or multi-limit violation requiring defensive rebalancing


@dataclass
class TreasuryPolicy:
    """Institutional treasury risk policy parameters and tolerance bands."""
    min_liquidity_score: float = 0.70         # Minimum weighted liquidity score (0.0 to 1.0)
    max_equity_weight: float = 0.15           # Maximum allocation to equity / strategic yield
    max_single_asset_weight: float = 0.35     # Maximum single instrument concentration
    max_cvar: float = 0.025                   # Maximum 95% historical CVaR (daily loss limit)
    cvar_confidence_level: float = 0.95       # Confidence level for CVaR evaluation
    max_drawdown: float = 0.05                # Maximum historical drawdown ceiling
    drift_threshold: float = 0.03             # Maximum allowed weight deviation before rebalancing (3%)
    warning_threshold: float = 0.85           # Warning triggered when utilization reaches 85% of limit
    critical_multiplier: float = 1.25         # Critical state triggered when breach exceeds 125% of limit


@dataclass
class PolicyCheckResult:
    """Individual policy rule evaluation."""
    name: str
    current_value: float
    limit: float
    utilization_pct: Optional[float]
    status: str                               # "NORMAL", "WARNING", "BREACH", "CRITICAL"
    operator: str                             # "<=" or ">="
    explanation: str


@dataclass
class PolicyEvaluation:
    """Overall evaluation of a portfolio against institutional treasury policy."""
    overall_status: str                       # "NORMAL", "WARNING", "BREACH", "CRITICAL"
    checks: List[PolicyCheckResult]
    breached_checks: List[str]                # Names of breached checks
    warning_checks: List[str]                 # Names of warning checks
    requires_rebalance: bool                  # True if BREACH or CRITICAL
    summary_explanation: str


@dataclass
class AssetDrift:
    """Asset-level rebalancing drift measurement."""
    symbol: str
    current_weight: float
    target_weight: float
    drift: float                              # abs(target_weight - current_weight)
    drift_monetary: float                     # drift * total_capital
    rebalance_required: bool                  # True if drift > drift_threshold


@dataclass
class DefensiveRebalanceResult:
    """Result of a policy-driven defensive rebalancing operation."""
    status: str                               # "SUCCESS", "NO_ACTION_REQUIRED", "INFEASIBLE", "ERROR"
    initial_status: str                       # Pre-rebalance risk state (e.g. "BREACH", "CRITICAL")
    current_weights: Dict[str, float]
    defensive_weights: Dict[str, float]
    current_allocations: Dict[str, float]
    defensive_allocations: Dict[str, float]
    turnover: float                           # 0.5 * sum(|w_new - w_old|)
    asset_drifts: List[AssetDrift]
    rebalance_required: bool
    current_metrics: Dict[str, float]
    defensive_metrics: Dict[str, float]
    post_rebalance_policy: PolicyEvaluation
    explanation: str                          # Human-readable before/after explanation
    message: str = ""
    post_rebalance_capital: float = 0.0
    rebalance_cost: float = 0.0


@dataclass
class StressScenario:
    """Deterministic macroeconomic stress scenario specification."""
    scenario_id: str
    name: str
    description: str
    asset_class_shocks: Dict[str, float]      # Percentage shock per asset class (e.g. {"Equity": -0.25})
    symbol_shocks: Dict[str, float] = field(default_factory=dict) # Specific symbol overrides
    severity: str = "SEVERE"                  # "MODERATE", "SEVERE", "EXTREME"
    assumptions: str = ""


@dataclass
class AssetStressImpact:
    """Detailed stress test impact per asset."""
    symbol: str
    asset_class: str
    initial_weight: float
    applied_shock: float
    contribution_return: float                # initial_weight * applied_shock
    contribution_pnl: float                   # capital * initial_weight * applied_shock
    stressed_value: float                     # post-shock dollar value
    stressed_weight: float                    # post-shock fractional weight


@dataclass
class StressTestResult:
    """Comprehensive outcome of a stress test evaluation."""
    scenario_id: str
    scenario_name: str
    severity: str
    base_portfolio_return: float
    base_portfolio_value: float
    stressed_portfolio_return: float
    stressed_pnl: float                       # Net dollar gain / loss
    stressed_portfolio_value: float           # Ending capital
    asset_impacts: List[AssetStressImpact]
    stressed_weights: Dict[str, float]        # Normalized post-shock weights
    policy_status: str                        # "NORMAL", "WARNING", "BREACH", "CRITICAL"
    breached_constraints: List[str]
    policy_evaluation: PolicyEvaluation
    defensive_response: Optional[DefensiveRebalanceResult] = None
    summary: str = ""
    restored_portfolio_value: float = 0.0     # Ending post-rebalance / restored capital net of friction
    restored_cvar: Optional[float] = None     # Post-restoration 95% CVaR
    restored_liquidity: Optional[float] = None # Post-restoration weighted liquidity
    restored_status: str = "NORMAL"           # Post-restoration policy state


@dataclass
class ScenarioSummary:
    """High-level summary row for multi-scenario comparative analytics."""
    scenario_id: str
    scenario_name: str
    severity: str
    stressed_return: float
    stressed_pnl: float
    stressed_value: float
    policy_status: str
    num_breached_policies: int
    breached_policies: List[str]


@dataclass
class MultiScenarioComparison:
    """Comprehensive multi-scenario comparative stress report."""
    base_capital: float
    base_return: float
    scenarios: List[ScenarioSummary]
    detailed_results: Dict[str, StressTestResult]



