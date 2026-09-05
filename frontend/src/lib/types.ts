/**
 * Jerifin Institutional Treasury Platform - Frontend Type Definitions
 * Directly mirrors backend Pydantic API schemas from backend/app/schemas/api.py
 */

export interface AssetItem {
  symbol: string;
  name: string;
  asset_class: string;
  liquidity_tier: number;
  liquidity_score: float;
  duration: number;
  currency: string;
  expected_return?: number;
  metadata?: Record<string, unknown>;
}

export type float = number;

export interface AssetUniverseResponse {
  disclaimer: string;
  total_assets: number;
  assets: AssetItem[];
}

export interface PortfolioAnalysisRequest {
  capital: number;
  weights: Record<string, number>;
  risk_free_rate?: number;
}

export interface PortfolioAnalysisResponse {
  capital: number;
  weights: Record<string, number>;
  monetary_allocations: Record<string, number>;
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  var_95_historical: number;
  cvar_95_historical: number;
  var_95_monetary: number;
  cvar_95_monetary: number;
  max_drawdown: number;
  hhi_concentration: number;
  largest_exposure_asset: string;
  largest_exposure_weight: number;
  weighted_liquidity_score: number;
  tier_breakdown: Record<number, number>;
}

export interface OptimizationConstraintsInput {
  max_single_asset_weight?: number;
  max_equity_weight?: number;
  min_liquidity_score?: number;
  max_cvar?: number;
  cvar_confidence_level?: number;
  max_drawdown?: number;
  long_only?: boolean;
  min_single_asset_weight?: number;
  custom_asset_limits?: Record<string, number>;
}

export interface OptimizationRequest {
  capital: number;
  constraints?: OptimizationConstraintsInput;
  risk_free_rate?: number;
  universe?: string;
}

export interface ConstraintCheckItem {
  constraint_name: string;
  actual_value: number;
  limit: number;
  passed: boolean;
  operator: string;
  description: string;
}

export interface OptimizationResponse {
  status: "OPTIMAL" | "INFEASIBLE" | "ERROR";
  capital: number;
  weights: Record<string, number>;
  allocations: Record<string, number>;
  expected_return: number;
  volatility: number;
  var: number;
  cvar: number;
  max_drawdown: number;
  hhi: number;
  largest_exposure: [string, number];
  liquidity_score: number;
  constraint_checks: ConstraintCheckItem[];
  message: string;
  solve_time_seconds: number;
}

export interface TreasuryPolicyInput {
  min_liquidity_score: number;
  max_equity_weight: number;
  max_single_asset_weight: number;
  max_cvar: number;
  cvar_confidence_level: number;
  max_drawdown: number;
  drift_threshold: number;
  warning_threshold: number;
  critical_multiplier: number;
}

export interface PolicyCheckItem {
  name: string;
  current_value: number;
  limit: number;
  utilization_pct?: number;
  status: "NORMAL" | "WARNING" | "BREACH" | "CRITICAL";
  operator: string;
  explanation: string;
}

export interface RiskEvaluationRequest {
  weights: Record<string, number>;
  capital?: number;
  policy?: TreasuryPolicyInput;
}

export interface RiskEvaluationResponse {
  overall_status: "NORMAL" | "WARNING" | "BREACH" | "CRITICAL";
  checks: PolicyCheckItem[];
  breached_checks: string[];
  warning_checks: string[];
  requires_rebalance: boolean;
  summary_explanation: string;
}

export interface AssetDriftItem {
  symbol: string;
  current_weight: number;
  target_weight: number;
  drift: number;
  drift_monetary: number;
  rebalance_required: boolean;
}

export interface DefensiveRebalanceRequest {
  capital: number;
  current_weights: Record<string, number>;
  policy?: TreasuryPolicyInput;
  risk_free_rate?: number;
}

export interface DefensiveRebalanceResponse {
  status: "SUCCESS" | "NO_ACTION_REQUIRED" | "INFEASIBLE" | "ERROR";
  initial_status: string;
  capital: number;
  current_weights: Record<string, number>;
  defensive_weights: Record<string, number>;
  current_allocations: Record<string, number>;
  defensive_allocations: Record<string, number>;
  turnover: number;
  asset_drifts: AssetDriftItem[];
  rebalance_required: boolean;
  current_metrics: Record<string, number>;
  defensive_metrics: Record<string, number>;
  post_rebalance_status: "NORMAL" | "WARNING" | "BREACH" | "CRITICAL";
  post_rebalance_checks: PolicyCheckItem[];
  explanation: string;
  message: string;
  post_rebalance_capital?: number;
  rebalance_cost?: number;
}

export interface CustomScenarioInput {
  scenario_id: string;
  name: string;
  description?: string;
  asset_class_shocks: Record<string, number>;
  symbol_shocks?: Record<string, number>;
  severity?: "MODERATE" | "SEVERE" | "EXTREME";
  assumptions?: string;
}

export interface AssetStressImpactItem {
  symbol: string;
  asset_class: string;
  initial_weight: number;
  applied_shock: number;
  contribution_return: number;
  contribution_pnl: number;
  stressed_value: number;
  stressed_weight: number;
}

export interface StressRunRequest {
  capital: number;
  weights: Record<string, number>;
  scenario_id?: string;
  custom_scenario?: CustomScenarioInput;
  policy?: TreasuryPolicyInput;
  trigger_defensive_on_breach?: boolean;
}

export interface StressRunResponse {
  scenario_id: string;
  scenario_name: string;
  severity: string;
  assumptions: string;
  base_portfolio_return: number;
  base_portfolio_value: number;
  base_cvar?: number;
  base_liquidity_score?: number;
  stressed_portfolio_return: number;
  stressed_pnl: number;
  stressed_portfolio_value: number;
  stressed_cvar?: number;
  stressed_liquidity_score?: number;
  asset_impacts: AssetStressImpactItem[];
  stressed_weights: Record<string, number>;
  policy_status: "NORMAL" | "WARNING" | "BREACH" | "CRITICAL";
  breached_constraints: string[];
  policy_evaluation: RiskEvaluationResponse;
  defensive_response?: DefensiveRebalanceResponse;
  summary: string;
  restored_portfolio_value: number;
  restored_cvar?: number;
  restored_liquidity_score?: number;
  restored_status?: "NORMAL" | "WARNING" | "BREACH" | "CRITICAL";
}

export interface ScenarioSummaryItem {
  scenario_id: string;
  scenario_name: string;
  severity: string;
  stressed_return: number;
  stressed_pnl: number;
  stressed_value: number;
  restored_value?: number;
  policy_status: string;
  num_breached_policies: number;
  breached_policies: string[];
}

export interface StressCompareRequest {
  capital: number;
  weights: Record<string, number>;
  scenario_ids?: string[];
  policy?: TreasuryPolicyInput;
}

export interface StressCompareResponse {
  base_capital: number;
  base_return: number;
  scenarios: ScenarioSummaryItem[];
  detailed_results: Record<string, StressRunResponse>;
}

// ==============================================================================
// 8. EARLY WARNING INTERFACES
// ==============================================================================

export interface EarlyWarningSignalItem {
  signal_id: string;
  name: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  trend: "IMPROVING" | "STABLE" | "DETERIORATING";
  current_value: number;
  threshold: number;
  operator: string;
  explanation: string;
  recommended_action: string;
}

export interface TimelinePointItem {
  day: number;
  cvar: number;
  liquidity: number;
  volatility: number;
  drawdown: number;
}

export interface RecommendationItem {
  status: "STABLE" | "WATCH" | "ELEVATED" | "DEFENSIVE" | string;
  title: string;
  reason: string;
  recommended_action: string;
  expected_effects: string[];
  priority: "ROUTINE" | "ELEVATED" | "URGENT";
}

export interface EarlyWarningResponse {
  overall_status: "STABLE" | "WATCH" | "ELEVATED" | "DEFENSIVE";
  warning_count: number;
  summary: string;
  timeline_summary: string;
  signals: EarlyWarningSignalItem[];
  timeline: TimelinePointItem[];
  recommendation: RecommendationItem;
}

// ==============================================================================
// 9. LIQUIDITY OUTLOOK INTERFACES
// ==============================================================================

export interface HorizonDetailItem {
  horizon_days: number;
  horizon_label: string;
  available_liquid_capital: number;
  baseline_outflow_need: number;
  stress_haircut_monetary: number;
  stressed_available_capital: number;
  baseline_coverage_ratio: number;
  stress_coverage_ratio: number;
  policy_minimum_ratio: number;
  status: "HEALTHY" | "WATCH" | "AT_RISK";
  tier_contributions: Record<string, number>;
  explanation: string;
}

export interface LiquidityOutlookResponse {
  capital: number;
  current_liquidity_score: number;
  primary_horizon_days: number;
  horizons: HorizonDetailItem[];
  methodology_notes: string;
}

// ==============================================================================
// 10. PORTFOLIO PROJECTION INTERFACES
// ==============================================================================

export interface ScenarioRangeItem {
  scenario_name: string;
  min_value: number;
  max_value: number;
  min_return_pct: number;
  max_return_pct: number;
  assumptions: string;
}

export interface HorizonProjectionItem {
  horizon_months: number;
  horizon_label: string;
  conservative: ScenarioRangeItem;
  base_case: ScenarioRangeItem;
  favorable: ScenarioRangeItem;
}

export interface PortfolioProjectionResponse {
  capital: number;
  expected_return_annualized: number;
  volatility_annualized: number;
  selected_horizon_months: number;
  projections: HorizonProjectionItem[];
  methodology: string;
  disclaimer: string;
}

