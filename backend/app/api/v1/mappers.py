"""Mappers and converters between domain dataclasses and API Pydantic schemas."""
from typing import List, Optional

from backend.app.schemas.api import (
    AssetDriftItem,
    AssetItem,
    AssetStressImpactItem,
    DefensiveRebalanceResponse,
    OptimizationConstraintsInput,
    PolicyCheckItem,
    RiskEvaluationResponse,
    StressRunResponse,
    TreasuryPolicyInput,
)
from backend.app.schemas.portfolio import (
    Asset,
    DefensiveRebalanceResult,
    OptimizationConstraints,
    PolicyEvaluation,
    StressTestResult,
    TreasuryPolicy,
)


def asset_item_to_domain(item: AssetItem) -> Asset:
    """Converts Pydantic AssetItem to domain Asset dataclass."""
    return Asset(
        symbol=item.symbol,
        name=item.name,
        asset_class=item.asset_class,
        liquidity_tier=item.liquidity_tier,
        liquidity_score=item.liquidity_score,
        duration=item.duration,
        currency=item.currency,
        expected_return=item.expected_return,
        metadata=item.metadata,
    )


def asset_domain_to_item(asset: Asset) -> AssetItem:
    """Converts domain Asset dataclass to Pydantic AssetItem."""
    return AssetItem(
        symbol=asset.symbol,
        name=asset.name,
        asset_class=asset.asset_class,
        liquidity_tier=asset.liquidity_tier,
        liquidity_score=asset.liquidity_score,
        duration=asset.duration,
        currency=asset.currency,
        expected_return=asset.expected_return,
        metadata=asset.metadata,
    )


def policy_input_to_domain(inp: Optional[TreasuryPolicyInput]) -> TreasuryPolicy:
    """Converts Pydantic TreasuryPolicyInput to domain TreasuryPolicy."""
    if inp is None:
        return TreasuryPolicy()
    return TreasuryPolicy(
        min_liquidity_score=inp.min_liquidity_score,
        max_equity_weight=inp.max_equity_weight,
        max_single_asset_weight=inp.max_single_asset_weight,
        max_cvar=inp.max_cvar,
        cvar_confidence_level=inp.cvar_confidence_level,
        max_drawdown=inp.max_drawdown,
        drift_threshold=inp.drift_threshold,
        warning_threshold=inp.warning_threshold,
        critical_multiplier=inp.critical_multiplier,
    )


def constraints_input_to_domain(inp: Optional[OptimizationConstraintsInput]) -> OptimizationConstraints:
    """Converts Pydantic OptimizationConstraintsInput to domain OptimizationConstraints."""
    if inp is None:
        return OptimizationConstraints()
    return OptimizationConstraints(
        max_single_asset_weight=inp.max_single_asset_weight,
        max_equity_weight=inp.max_equity_weight,
        min_liquidity_score=inp.min_liquidity_score,
        max_cvar=inp.max_cvar,
        cvar_confidence_level=inp.cvar_confidence_level,
        max_drawdown=inp.max_drawdown,
        long_only=inp.long_only,
        min_single_asset_weight=inp.min_single_asset_weight,
        custom_asset_limits=inp.custom_asset_limits,
    )


def policy_eval_to_response(eval_res: PolicyEvaluation) -> RiskEvaluationResponse:
    """Converts domain PolicyEvaluation to Pydantic RiskEvaluationResponse."""
    checks = [
        PolicyCheckItem(
            name=c.name,
            current_value=c.current_value,
            limit=c.limit,
            utilization_pct=c.utilization_pct,
            status=c.status,
            operator=c.operator,
            explanation=c.explanation,
        )
        for c in eval_res.checks
    ]
    return RiskEvaluationResponse(
        overall_status=eval_res.overall_status,
        checks=checks,
        breached_checks=eval_res.breached_checks,
        warning_checks=eval_res.warning_checks,
        requires_rebalance=eval_res.requires_rebalance,
        summary_explanation=eval_res.summary_explanation,
    )


def defensive_result_to_response(
    res: DefensiveRebalanceResult,
    capital: float,
) -> DefensiveRebalanceResponse:
    """Converts domain DefensiveRebalanceResult to Pydantic DefensiveRebalanceResponse."""
    drifts = [
        AssetDriftItem(
            symbol=d.symbol,
            current_weight=d.current_weight,
            target_weight=d.target_weight,
            drift=d.drift,
            drift_monetary=d.drift_monetary,
            rebalance_required=d.rebalance_required,
        )
        for d in res.asset_drifts
    ]
    post_checks = [
        PolicyCheckItem(
            name=c.name,
            current_value=c.current_value,
            limit=c.limit,
            utilization_pct=c.utilization_pct,
            status=c.status,
            operator=c.operator,
            explanation=c.explanation,
        )
        for c in res.post_rebalance_policy.checks
    ]
    return DefensiveRebalanceResponse(
        status=res.status,
        initial_status=res.initial_status,
        capital=capital,
        current_weights=res.current_weights,
        defensive_weights=res.defensive_weights,
        current_allocations=res.current_allocations,
        defensive_allocations=res.defensive_allocations,
        turnover=res.turnover,
        asset_drifts=drifts,
        rebalance_required=res.rebalance_required,
        current_metrics=res.current_metrics,
        defensive_metrics=res.defensive_metrics,
        post_rebalance_status=res.post_rebalance_policy.overall_status,
        post_rebalance_checks=post_checks,
        explanation=res.explanation,
        message=res.message,
    )


def stress_result_to_response(
    res: StressTestResult,
    capital: float,
    assumptions: str = "",
) -> StressRunResponse:
    """Converts domain StressTestResult to Pydantic StressRunResponse."""
    impacts = [
        AssetStressImpactItem(
            symbol=i.symbol,
            asset_class=i.asset_class,
            initial_weight=i.initial_weight,
            applied_shock=i.applied_shock,
            contribution_return=i.contribution_return,
            contribution_pnl=i.contribution_pnl,
            stressed_value=i.stressed_value,
            stressed_weight=i.stressed_weight,
        )
        for i in res.asset_impacts
    ]
    defensive_resp = (
        defensive_result_to_response(res.defensive_response, res.stressed_portfolio_value)
        if res.defensive_response else None
    )
    return StressRunResponse(
        scenario_id=res.scenario_id,
        scenario_name=res.scenario_name,
        severity=res.severity,
        assumptions=assumptions,
        base_portfolio_return=res.base_portfolio_return,
        base_portfolio_value=res.base_portfolio_value,
        stressed_portfolio_return=res.stressed_portfolio_return,
        stressed_pnl=res.stressed_pnl,
        stressed_portfolio_value=res.stressed_portfolio_value,
        asset_impacts=impacts,
        stressed_weights=res.stressed_weights,
        policy_status=res.policy_status,
        breached_constraints=res.breached_constraints,
        policy_evaluation=policy_eval_to_response(res.policy_evaluation),
        defensive_response=defensive_resp,
        summary=res.summary,
    )
