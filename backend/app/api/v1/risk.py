"""Risk Control, Early Warning, and Defensive Rebalancing API Router."""
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, status

from app.api.v1.mappers import (
    asset_item_to_domain,
    defensive_result_to_response,
    policy_eval_to_response,
    policy_input_to_domain,
)
from app.engine.analytics import validate_weights
from app.engine.early_warning import EarlyWarningEngine
from app.engine.liquidity_outlook import LiquidityOutlookEngine
from app.engine.risk import TreasuryRiskEngine
from app.engine.risk_controller import RiskControlEngine
from app.engine.synthetic_data import (
    ALL_INSTITUTIONAL_ASSETS,
    DEFAULT_INSTITUTIONAL_ASSETS,
    INDIAN_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from app.schemas.api import (
    AssetItem,
    DefensiveRebalanceRequest,
    DefensiveRebalanceResponse,
    EarlyWarningRequest,
    EarlyWarningResponse,
    EarlyWarningSignalItem,
    HorizonDetailItem,
    LiquidityOutlookRequest,
    LiquidityOutlookResponse,
    RecommendationItem,
    RiskEvaluationRequest,
    RiskEvaluationResponse,
    TimelinePointItem,
)
from app.schemas.portfolio import Asset, PortfolioConfig

router = APIRouter(prefix="/risk", tags=["Risk Controls"])


def resolve_asset_universe(weights: Dict[str, float], custom_assets: Optional[List[AssetItem]] = None) -> List[Asset]:
    """Resolves institutional asset universe based on requested instrument tickers."""
    if custom_assets:
        return [asset_item_to_domain(a) for a in custom_assets]
    indian_symbols = {a.symbol for a in INDIAN_INSTITUTIONAL_ASSETS}
    legacy_symbols = {a.symbol for a in DEFAULT_INSTITUTIONAL_ASSETS}
    weight_symbols = set(weights.keys())
    if weight_symbols.issubset(indian_symbols):
        return INDIAN_INSTITUTIONAL_ASSETS
    elif weight_symbols.issubset(legacy_symbols):
        return DEFAULT_INSTITUTIONAL_ASSETS
    else:
        return ALL_INSTITUTIONAL_ASSETS


@router.post(
    "/evaluate",
    response_model=RiskEvaluationResponse,
    summary="Evaluate Portfolio Policy Compliance",
    description=(
        "Audits current portfolio allocations against institutional treasury policy rules "
        "(liquidity floors, single-asset caps, equity limits, CVaR, and max drawdown). "
        "Returns risk governance state: NORMAL, WARNING, BREACH, or CRITICAL."
    ),
)
def evaluate_risk(request: RiskEvaluationRequest) -> RiskEvaluationResponse:
    """Evaluates portfolio risk against institutional policy parameters."""
    capital = request.capital or 10_000_000.0
    if capital <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Capital must be strictly positive (> 0), got {capital}",
        )

    # Resolve assets
    assets = resolve_asset_universe(request.weights, request.custom_assets)
    allowed_symbols = [a.symbol for a in assets]

    # Validate weights
    try:
        validate_weights(request.weights, allowed_symbols=allowed_symbols)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Convert policy
    policy = policy_input_to_domain(request.policy)

    # Compute baseline metrics
    returns_df = generate_deterministic_synthetic_returns(assets=assets)
    config = PortfolioConfig(
        portfolio_id="RISK_EVAL",
        name="Risk Evaluation",
        assets=assets,
        weights=request.weights,
        total_capital=capital,
    )
    risk_engine = TreasuryRiskEngine(confidence_level=policy.cvar_confidence_level)
    metrics = risk_engine.evaluate_portfolio(config, returns_df)

    # Evaluate policy
    controller = RiskControlEngine()
    policy_eval = controller.evaluate_policy(
        portfolio_weights=request.weights,
        assets=assets,
        metrics=metrics,
        policy=policy,
    )

    return policy_eval_to_response(policy_eval)


@router.post(
    "/rebalance",
    response_model=DefensiveRebalanceResponse,
    summary="Execute Defensive Rebalance",
    description=(
        "Calculates an optimal defensive allocation restoring full policy compliance "
        "with minimum portfolio turnover when a policy BREACH or CRITICAL state is detected."
    ),
)
def rebalance_defensive(request: DefensiveRebalanceRequest) -> DefensiveRebalanceResponse:
    """Calculates minimal-turnover defensive rebalancing weights to restore compliance."""
    if request.capital <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Capital must be strictly positive (> 0), got {request.capital}",
        )

    # Resolve assets
    assets = resolve_asset_universe(request.current_weights, request.custom_assets)
    allowed_symbols = [a.symbol for a in assets]

    # Validate weights
    try:
        validate_weights(request.current_weights, allowed_symbols=allowed_symbols)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Convert policy
    policy = policy_input_to_domain(request.policy)
    returns_df = generate_deterministic_synthetic_returns(assets=assets)

    controller = RiskControlEngine()

    try:
        rebal_res = controller.execute_defensive_rebalance(
            current_weights=request.current_weights,
            assets=assets,
            historical_returns=returns_df,
            policy=policy,
            total_capital=request.capital,
            risk_free_rate=request.risk_free_rate,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rebalancing engine error: {str(e)}",
        )

    if rebal_res.status == "INFEASIBLE":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Defensive rebalance is infeasible: {rebal_res.explanation}",
        )

    return defensive_result_to_response(rebal_res, capital=request.capital)


@router.post(
    "/early-warning",
    response_model=EarlyWarningResponse,
    summary="Evaluate Early Warning Risk Signals",
    description=(
        "Evaluates transparent deterministic warning indicators (CVaR drift, liquidity compression, "
        "concentration ceilings, drawdown acceleration) to detect risk degradation before hard policy breaches."
    ),
)
def evaluate_early_warning(request: EarlyWarningRequest) -> EarlyWarningResponse:
    """Evaluates forward-looking warning signals and 30-day risk trend."""
    if request.capital <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Capital must be strictly positive (> 0), got {request.capital}",
        )

    assets = resolve_asset_universe(request.weights, request.custom_assets)
    allowed_symbols = [a.symbol for a in assets]

    try:
        validate_weights(request.weights, allowed_symbols=allowed_symbols)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    policy = policy_input_to_domain(request.policy)
    returns_df = generate_deterministic_synthetic_returns(assets=assets)
    config = PortfolioConfig(
        portfolio_id="EARLY_WARNING",
        name="Early Warning Evaluation",
        assets=assets,
        weights=request.weights,
        total_capital=request.capital,
    )
    risk_engine = TreasuryRiskEngine(confidence_level=policy.cvar_confidence_level)
    metrics = risk_engine.evaluate_portfolio(config, returns_df)

    ew_engine = EarlyWarningEngine()
    result = ew_engine.evaluate(config=config, returns_df=returns_df, metrics=metrics, policy=policy)

    return EarlyWarningResponse(
        overall_status=result.overall_status,
        warning_count=result.warning_count,
        summary=result.summary,
        timeline_summary=result.timeline_summary,
        signals=[
            EarlyWarningSignalItem(
                signal_id=s.signal_id,
                name=s.name,
                severity=s.severity,
                trend=s.trend,
                current_value=s.current_value,
                threshold=s.threshold,
                operator=s.operator,
                explanation=s.explanation,
                recommended_action=s.recommended_action,
            )
            for s in result.signals
        ],
        timeline=[
            TimelinePointItem(
                day=p.day,
                cvar=p.cvar,
                liquidity=p.liquidity,
                volatility=p.volatility,
                drawdown=p.drawdown,
            )
            for p in result.timeline
        ],
        recommendation=RecommendationItem(
            status=result.recommendation.status,
            title=result.recommendation.title,
            reason=result.recommendation.reason,
            recommended_action=result.recommendation.recommended_action,
            expected_effects=result.recommendation.expected_effects,
            priority=result.recommendation.priority,
        ),
    )


@router.post(
    "/liquidity-outlook",
    response_model=LiquidityOutlookResponse,
    summary="Evaluate Forward Liquidity Coverage Ratios",
    description=(
        "Simulates operational liquidity coverage across 7D, 30D, 90D, and 180D horizons "
        "under baseline and adverse stress haircut conditions."
    ),
)
def evaluate_liquidity_outlook(request: LiquidityOutlookRequest) -> LiquidityOutlookResponse:
    """Simulates liquidity coverage across standard corporate treasury horizons."""
    if request.capital <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Capital must be strictly positive (> 0), got {request.capital}",
        )

    assets = resolve_asset_universe(request.weights, request.custom_assets)
    allowed_symbols = [a.symbol for a in assets]

    try:
        validate_weights(request.weights, allowed_symbols=allowed_symbols)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    policy = policy_input_to_domain(request.policy)
    returns_df = generate_deterministic_synthetic_returns(assets=assets)
    config = PortfolioConfig(
        portfolio_id="LIQUIDITY_OUTLOOK",
        name="Liquidity Outlook Evaluation",
        assets=assets,
        weights=request.weights,
        total_capital=request.capital,
    )
    risk_engine = TreasuryRiskEngine(confidence_level=policy.cvar_confidence_level)
    metrics = risk_engine.evaluate_portfolio(config, returns_df)

    liq_engine = LiquidityOutlookEngine()
    result = liq_engine.evaluate(
        config=config,
        metrics=metrics,
        policy=policy,
        selected_horizon_days=request.selected_horizon_days,
    )

    return LiquidityOutlookResponse(
        capital=result.capital,
        current_liquidity_score=result.current_liquidity_score,
        primary_horizon_days=result.primary_horizon_days,
        horizons=[
            HorizonDetailItem(
                horizon_days=h.horizon_days,
                horizon_label=h.horizon_label,
                available_liquid_capital=h.available_liquid_capital,
                baseline_outflow_need=h.baseline_outflow_need,
                stress_haircut_monetary=h.stress_haircut_monetary,
                stressed_available_capital=h.stressed_available_capital,
                baseline_coverage_ratio=h.baseline_coverage_ratio,
                stress_coverage_ratio=h.stress_coverage_ratio,
                policy_minimum_ratio=h.policy_minimum_ratio,
                status=h.status,
                tier_contributions=h.tier_contributions,
                explanation=h.explanation,
            )
            for h in result.horizons
        ],
        methodology_notes=result.methodology_notes,
    )

