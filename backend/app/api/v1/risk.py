"""Risk Control and Defensive Rebalancing API Router."""
from typing import List
from fastapi import APIRouter, HTTPException, status

from backend.app.api.v1.mappers import (
    asset_item_to_domain,
    defensive_result_to_response,
    policy_eval_to_response,
    policy_input_to_domain,
)
from backend.app.engine.analytics import validate_weights
from backend.app.engine.risk import TreasuryRiskEngine
from backend.app.engine.risk_controller import RiskControlEngine
from backend.app.engine.synthetic_data import (
    DEFAULT_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from backend.app.schemas.api import (
    DefensiveRebalanceRequest,
    DefensiveRebalanceResponse,
    RiskEvaluationRequest,
    RiskEvaluationResponse,
)
from backend.app.schemas.portfolio import Asset, PortfolioConfig

router = APIRouter(prefix="/risk", tags=["Risk Controls"])


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
    if request.custom_assets:
        assets: List[Asset] = [asset_item_to_domain(a) for a in request.custom_assets]
    else:
        assets = DEFAULT_INSTITUTIONAL_ASSETS

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
    if request.custom_assets:
        assets: List[Asset] = [asset_item_to_domain(a) for a in request.custom_assets]
    else:
        assets = DEFAULT_INSTITUTIONAL_ASSETS

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
