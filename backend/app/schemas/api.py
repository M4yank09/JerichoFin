"""Pydantic API Schemas for Jerifin Institutional Treasury Platform.

Defines validation models for API requests and responses, decoupling the HTTP
transport layer from the quantitative engine domain dataclasses.
"""
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, ConfigDict, Field


# ==============================================================================
# 1. ASSET SCHEMAS
# ==============================================================================

class AssetItem(BaseModel):
    """Institutional instrument representation."""
    model_config = ConfigDict(from_attributes=True)

    symbol: str = Field(..., description="Unique asset identifier ticker", examples=["US_TBILL_3M"])
    name: str = Field(..., description="Full descriptive name of the security", examples=["US 3-Month Treasury Bills"])
    asset_class: str = Field(..., description="Asset classification category", examples=["Sovereign Bonds"])
    liquidity_tier: int = Field(default=1, description="Liquidity tier (1: Immediate, 2: Operational, 3: Strategic)", examples=[2])
    liquidity_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Normalized liquidity score [0.0 to 1.0]", examples=[0.95])
    duration: float = Field(default=0.0, ge=0.0, description="Modified / Macaulay duration in years", examples=[0.25])
    currency: str = Field(default="USD", description="Base asset currency", examples=["USD"])
    expected_return: Optional[float] = Field(default=None, description="Annualized expected return rate", examples=[0.048])
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional custom metadata tags")


class AssetUniverseResponse(BaseModel):
    """Available institutional asset universe response."""
    disclaimer: str = Field(..., description="Synthetic / demo data warning disclaimer")
    total_assets: int = Field(..., description="Count of assets returned")
    assets: List[AssetItem] = Field(..., description="List of available instruments")


# ==============================================================================
# 2. PORTFOLIO ANALYSIS SCHEMAS
# ==============================================================================

class PortfolioAnalysisRequest(BaseModel):
    """Request payload for comprehensive portfolio risk and allocation analysis."""
    capital: float = Field(
        ...,
        gt=0,
        description="Total portfolio capital pool size in base currency (strictly required, > 0)",
        examples=[1000000000.0]  # e.g. ₹100 Cr demo capital
    )
    weights: Dict[str, float] = Field(
        ...,
        description="Allocation weights per asset ticker (must sum to 1.0 within numerical tolerance)",
        examples=[{"USD_CASH": 0.20, "US_TBILL_3M": 0.40, "COMM_PAPER_30D": 0.20, "US_CORP_IG": 0.20}]
    )
    risk_free_rate: float = Field(default=0.045, description="Annualized benchmark risk-free rate")
    custom_assets: Optional[List[AssetItem]] = Field(default=None, description="Optional custom asset definitions")


class PortfolioAnalysisResponse(BaseModel):
    """Structured response containing all analytics and risk metrics for a portfolio."""
    capital: float = Field(..., description="Total capital pool evaluated")
    weights: Dict[str, float] = Field(..., description="Asset allocation weights")
    monetary_allocations: Dict[str, float] = Field(..., description="Monetary currency allocated per asset")
    expected_return: float = Field(..., description="Annualized expected portfolio return")
    volatility: float = Field(..., description="Annualized portfolio return volatility")
    sharpe_ratio: float = Field(..., description="Sharpe ratio against configured risk-free rate")
    var_95_historical: float = Field(..., description="95% 1-day historical VaR (positive loss proportion)")
    cvar_95_historical: float = Field(..., description="95% 1-day historical CVaR / Expected Shortfall")
    var_95_monetary: float = Field(..., description="Dollar / currency VaR at 95% confidence")
    cvar_95_monetary: float = Field(..., description="Dollar / currency CVaR at 95% confidence")
    max_drawdown: float = Field(..., description="Historical maximum peak-to-trough decline")
    hhi_concentration: float = Field(..., description="Herfindahl-Hirschman Index [0.0 to 1.0]")
    largest_exposure_asset: str = Field(..., description="Symbol with highest portfolio concentration")
    largest_exposure_weight: float = Field(..., description="Fractional weight of largest exposure")
    weighted_liquidity_score: float = Field(..., description="Portfolio-weighted liquidity score [0.0 to 1.0]")
    tier_breakdown: Dict[int, float] = Field(..., description="Allocation fraction by liquidity tier (Tier 1, 2, 3)")


# ==============================================================================
# 3. OPTIMIZATION SCHEMAS
# ==============================================================================

class OptimizationConstraintsInput(BaseModel):
    """Configurable risk and institutional constraints for portfolio optimization."""
    max_single_asset_weight: Optional[float] = Field(default=0.35, description="Maximum single asset concentration cap")
    max_equity_weight: Optional[float] = Field(default=0.15, description="Maximum allocation to equity or strategic yield")
    min_liquidity_score: Optional[float] = Field(default=0.70, description="Minimum weighted portfolio liquidity floor")
    max_cvar: Optional[float] = Field(default=0.03, description="Maximum 95% daily historical CVaR ceiling")
    cvar_confidence_level: float = Field(default=0.95, description="Confidence level for CVaR evaluation")
    max_drawdown: Optional[float] = Field(default=0.05, description="Maximum historical drawdown ceiling")
    long_only: bool = Field(default=True, description="Strict long-only constraint (w_i >= 0)")
    min_single_asset_weight: Optional[float] = Field(default=None, description="Optional minimum floor per instrument")
    custom_asset_limits: Dict[str, float] = Field(default_factory=dict, description="Instrument-specific upper bounds")


class OptimizationRequest(BaseModel):
    """Request payload to optimize portfolio allocation subject to constraints."""
    capital: float = Field(
        ...,
        gt=0,
        description="Total portfolio capital pool size in base currency (strictly required, > 0)",
        examples=[1000000000.0]
    )
    constraints: Optional[OptimizationConstraintsInput] = Field(
        default=None,
        description="Institutional risk and allocation limits"
    )
    risk_free_rate: float = Field(default=0.045, description="Annualized benchmark risk-free rate")
    custom_assets: Optional[List[AssetItem]] = Field(default=None, description="Optional custom asset definitions")


class ConstraintCheckItem(BaseModel):
    """Evaluation status for an individual portfolio constraint."""
    constraint_name: str
    actual_value: float
    limit: float
    passed: bool
    operator: str
    description: str = ""


class OptimizationResponse(BaseModel):
    """Convex optimization solution and validation metrics."""
    status: str = Field(..., description="Optimization status: OPTIMAL, INFEASIBLE, or ERROR")
    capital: float = Field(..., description="Total capital pool size")
    weights: Dict[str, float] = Field(..., description="Optimized asset weights")
    allocations: Dict[str, float] = Field(..., description="Monetary capital allocations per asset")
    expected_return: float = Field(..., description="Annualized expected portfolio return")
    volatility: float = Field(..., description="Annualized volatility")
    var: float = Field(..., description="95% Historical VaR")
    cvar: float = Field(..., description="95% Historical CVaR")
    max_drawdown: float = Field(..., description="Historical maximum drawdown")
    hhi: float = Field(..., description="Herfindahl-Hirschman Index")
    largest_exposure: Tuple[str, float] = Field(..., description="Tuple of (symbol, weight)")
    liquidity_score: float = Field(..., description="Portfolio-weighted liquidity score")
    constraint_checks: List[ConstraintCheckItem] = Field(..., description="Status of all evaluated constraints")
    message: str = Field(default="", description="Optimization diagnostic or status message")
    solve_time_seconds: float = Field(default=0.0, description="Solver execution duration in seconds")


# ==============================================================================
# 4. RISK POLICY & EVALUATION SCHEMAS
# ==============================================================================

class TreasuryPolicyInput(BaseModel):
    """Institutional treasury risk governance parameters."""
    min_liquidity_score: float = Field(default=0.70, description="Minimum weighted liquidity score")
    max_equity_weight: float = Field(default=0.15, description="Maximum allocation to equity or strategic yield")
    max_single_asset_weight: float = Field(default=0.35, description="Maximum single asset concentration")
    max_cvar: float = Field(default=0.025, description="Maximum 95% historical daily CVaR")
    cvar_confidence_level: float = Field(default=0.95, description="Confidence level for CVaR")
    max_drawdown: float = Field(default=0.05, description="Maximum drawdown ceiling")
    drift_threshold: float = Field(default=0.03, description="Weight drift threshold triggering rebalance")
    warning_threshold: float = Field(default=0.85, description="Warning trigger band (% of limit)")
    critical_multiplier: float = Field(default=1.25, description="Critical trigger threshold multiplier")


class PolicyCheckItem(BaseModel):
    """Audit outcome for an individual policy rule."""
    name: str = Field(..., description="Name of the audited policy constraint")
    current_value: float = Field(..., description="Portfolio actual metric value")
    limit: float = Field(..., description="Configured policy limit")
    utilization_pct: Optional[float] = Field(default=None, description="Percentage of policy limit utilized")
    status: str = Field(..., description="Status: NORMAL, WARNING, BREACH, or CRITICAL")
    operator: str = Field(..., description="Comparison operator (<= or >=)")
    explanation: str = Field(..., description="Audit diagnostic explanation")


class RiskEvaluationRequest(BaseModel):
    """Request payload for independent risk controller policy audit."""
    weights: Dict[str, float] = Field(..., description="Asset allocation weights to audit")
    capital: Optional[float] = Field(default=10_000_000.0, gt=0, description="Portfolio capital pool")
    policy: Optional[TreasuryPolicyInput] = Field(default=None, description="Custom treasury policy parameters")
    custom_assets: Optional[List[AssetItem]] = Field(default=None, description="Optional custom asset definitions")


class RiskEvaluationResponse(BaseModel):
    """Independent risk controller policy audit report."""
    overall_status: str = Field(..., description="Overall portfolio risk state: NORMAL, WARNING, BREACH, CRITICAL")
    checks: List[PolicyCheckItem] = Field(..., description="Detailed audit of all policy checks")
    breached_checks: List[str] = Field(..., description="List of breached policy rule names")
    warning_checks: List[str] = Field(..., description="List of warning policy rule names")
    requires_rebalance: bool = Field(..., description="True if BREACH or CRITICAL status requires defensive action")
    summary_explanation: str = Field(..., description="Executive risk governance narrative")


# ==============================================================================
# 5. DEFENSIVE REBALANCING SCHEMAS
# ==============================================================================

class AssetDriftItem(BaseModel):
    """Asset-level drift between current and target allocations."""
    symbol: str
    current_weight: float
    target_weight: float
    drift: float
    drift_monetary: float
    rebalance_required: bool


class DefensiveRebalanceRequest(BaseModel):
    """Request payload to calculate defensive allocation restoring policy compliance."""
    capital: float = Field(
        ...,
        gt=0,
        description="Total portfolio capital pool size in base currency (strictly required, > 0)",
        examples=[1000000000.0]
    )
    current_weights: Dict[str, float] = Field(..., description="Current allocation weights")
    policy: Optional[TreasuryPolicyInput] = Field(default=None, description="Treasury governance policy")
    risk_free_rate: float = Field(default=0.045, description="Benchmark risk-free rate")
    custom_assets: Optional[List[AssetItem]] = Field(default=None, description="Optional custom asset definitions")


class DefensiveRebalanceResponse(BaseModel):
    """Defensive rebalancing execution plan and metric comparison."""
    status: str = Field(..., description="Status: SUCCESS, NO_ACTION_REQUIRED, INFEASIBLE, or ERROR")
    initial_status: str = Field(..., description="Risk state prior to rebalancing")
    capital: float = Field(..., description="Capital pool size")
    current_weights: Dict[str, float] = Field(..., description="Pre-rebalance weights")
    defensive_weights: Dict[str, float] = Field(..., description="Recommended defensive weights")
    current_allocations: Dict[str, float] = Field(..., description="Pre-rebalance monetary allocations")
    defensive_allocations: Dict[str, float] = Field(..., description="Recommended monetary allocations")
    turnover: float = Field(..., description="Total portfolio turnover (0.5 * sum(|w_def - w_curr|))")
    asset_drifts: List[AssetDriftItem] = Field(..., description="Per-instrument drift breakdown")
    rebalance_required: bool = Field(..., description="Whether action is required")
    current_metrics: Dict[str, float] = Field(..., description="Pre-rebalance key metrics")
    defensive_metrics: Dict[str, float] = Field(..., description="Post-rebalance key metrics")
    post_rebalance_status: str = Field(..., description="Policy status under defensive allocation")
    post_rebalance_checks: List[PolicyCheckItem] = Field(..., description="Audit results for defensive allocation")
    explanation: str = Field(..., description="Executive rationale and rebalancing summary")
    message: str = Field(default="", description="Diagnostic message")


# ==============================================================================
# 6. STRESS TESTING SCHEMAS
# ==============================================================================

class CustomScenarioInput(BaseModel):
    """User-specified custom macroeconomic stress scenario."""
    scenario_id: str = Field(..., description="Unique scenario identifier", examples=["CUSTOM_STAGFLATION"])
    name: str = Field(..., description="Descriptive scenario title", examples=["Severe Stagflation Shock"])
    description: str = Field(default="", description="Macro narrative context")
    asset_class_shocks: Dict[str, float] = Field(
        default_factory=dict,
        description="Shocks per asset class (e.g. {'Strategic Yield & Hedging': -0.20, 'Corporate Bonds': -0.10})"
    )
    symbol_shocks: Dict[str, float] = Field(
        default_factory=dict,
        description="Optional symbol-specific override shocks"
    )
    severity: str = Field(default="SEVERE", description="Severity tier: MODERATE, SEVERE, or EXTREME")
    assumptions: str = Field(default="", description="Underlying economic assumptions")


class StressRunRequest(BaseModel):
    """Request payload to simulate a stress scenario on a portfolio."""
    capital: float = Field(
        ...,
        gt=0,
        description="Total portfolio capital pool size in base currency (strictly required, > 0)",
        examples=[1000000000.0]
    )
    weights: Dict[str, float] = Field(..., description="Portfolio allocation weights")
    scenario_id: Optional[str] = Field(default=None, description="Predefined scenario ID (e.g. EQUITY_CRASH)")
    custom_scenario: Optional[CustomScenarioInput] = Field(default=None, description="Custom scenario specification")
    policy: Optional[TreasuryPolicyInput] = Field(default=None, description="Optional custom treasury policy")
    trigger_defensive_on_breach: bool = Field(default=True, description="Whether to trigger defensive rebalance on breach")
    custom_assets: Optional[List[AssetItem]] = Field(default=None, description="Optional custom asset definitions")


class AssetStressImpactItem(BaseModel):
    """Asset-level stress test impact."""
    symbol: str
    asset_class: str
    initial_weight: float
    applied_shock: float
    contribution_return: float
    contribution_pnl: float
    stressed_value: float
    stressed_weight: float


class StressRunResponse(BaseModel):
    """Comprehensive stress test simulation outcome."""
    scenario_id: str = Field(..., description="Scenario identifier")
    scenario_name: str = Field(..., description="Descriptive scenario name")
    severity: str = Field(..., description="Severity tier")
    assumptions: str = Field(default="", description="Scenario assumptions")
    base_portfolio_return: float = Field(..., description="Baseline portfolio expected return")
    base_portfolio_value: float = Field(..., description="Starting capital value")
    stressed_portfolio_return: float = Field(..., description="Portfolio instantaneous shock return")
    stressed_pnl: float = Field(..., description="Monetary gain or loss under stress")
    stressed_portfolio_value: float = Field(..., description="Post-shock ending capital")
    asset_impacts: List[AssetStressImpactItem] = Field(..., description="Per-asset shock contributions")
    stressed_weights: Dict[str, float] = Field(..., description="Post-shock normalized drifted weights")
    policy_status: str = Field(..., description="Policy status under stressed state (NORMAL, WARNING, BREACH, CRITICAL)")
    breached_constraints: List[str] = Field(..., description="List of breached constraints post-stress")
    policy_evaluation: RiskEvaluationResponse = Field(..., description="Full policy audit report post-stress")
    defensive_response: Optional[DefensiveRebalanceResponse] = Field(default=None, description="Defensive rebalancing if triggered")
    summary: str = Field(default="", description="Executive scenario impact narrative")


class ScenarioSummaryItem(BaseModel):
    """Comparative row in a multi-scenario matrix."""
    scenario_id: str
    scenario_name: str
    severity: str
    stressed_return: float
    stressed_pnl: float
    stressed_value: float
    policy_status: str
    num_breached_policies: int
    breached_policies: List[str]


class StressCompareRequest(BaseModel):
    """Request payload to execute a battery of stress scenarios."""
    capital: float = Field(
        ...,
        gt=0,
        description="Total portfolio capital pool size in base currency (strictly required, > 0)",
        examples=[1000000000.0]
    )
    weights: Dict[str, float] = Field(..., description="Portfolio allocation weights")
    scenario_ids: Optional[List[str]] = Field(default=None, description="List of scenario IDs to evaluate (defaults to all 5)")
    policy: Optional[TreasuryPolicyInput] = Field(default=None, description="Optional custom treasury policy")
    custom_assets: Optional[List[AssetItem]] = Field(default=None, description="Optional custom asset definitions")


class StressCompareResponse(BaseModel):
    """Multi-scenario comparative stress test matrix."""
    base_capital: float = Field(..., description="Baseline capital pool size")
    base_return: float = Field(..., description="Baseline portfolio expected return")
    scenarios: List[ScenarioSummaryItem] = Field(..., description="Summary rows for all evaluated scenarios")
    detailed_results: Dict[str, StressRunResponse] = Field(..., description="Full detailed results keyed by scenario ID")


# ==============================================================================
# 7. ERROR RESPONSE SCHEMA
# ==============================================================================

class ErrorResponse(BaseModel):
    """Standardized institutional API error envelope."""
    error: str = Field(..., description="Error category / name")
    detail: str = Field(..., description="Human-readable diagnostic error message")
    code: int = Field(..., description="HTTP status code")
