"""Portfolio Analysis and Asset Universe API Router."""
from typing import List
from fastapi import APIRouter, HTTPException, status

from backend.app.api.v1.mappers import asset_domain_to_item, asset_item_to_domain
from backend.app.engine.analytics import validate_weights
from backend.app.engine.risk import TreasuryRiskEngine
from backend.app.engine.synthetic_data import (
    DATA_DISCLAIMER,
    DEFAULT_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from backend.app.schemas.api import (
    AssetUniverseResponse,
    PortfolioAnalysisRequest,
    PortfolioAnalysisResponse,
)
from backend.app.schemas.portfolio import Asset, PortfolioConfig

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


@router.get(
    "/assets",
    response_model=AssetUniverseResponse,
    summary="Get Institutional Asset Universe",
    description=(
        "Retrieves the active institutional investment universe and instrument metadata. "
        "NOTICE: All assets and prices are deterministic synthetic demo data."
    ),
)
def get_assets() -> AssetUniverseResponse:
    """Returns the default institutional asset universe with demo disclaimer."""
    asset_items = [asset_domain_to_item(a) for a in DEFAULT_INSTITUTIONAL_ASSETS]
    return AssetUniverseResponse(
        disclaimer=DATA_DISCLAIMER,
        total_assets=len(asset_items),
        assets=asset_items,
    )


@router.post(
    "/analyze",
    response_model=PortfolioAnalysisResponse,
    summary="Analyze Portfolio Risk & Allocations",
    description=(
        "Performs comprehensive risk, liquidity, and allocation analysis for an institutional portfolio "
        "given allocation weights and total capital pool size."
    ),
)
def analyze_portfolio(request: PortfolioAnalysisRequest) -> PortfolioAnalysisResponse:
    """Evaluates portfolio expected return, volatility, VaR, CVaR, drawdown, and liquidity."""
    if request.capital <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Capital must be strictly positive (> 0), got {request.capital}",
        )

    # Resolve asset universe
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

    # Generate deterministic returns
    returns_df = generate_deterministic_synthetic_returns(assets=assets)

    # Build portfolio config
    config = PortfolioConfig(
        portfolio_id="PORTFOLIO_ANALYSIS",
        name="Institutional Portfolio Analysis",
        assets=assets,
        weights=request.weights,
        total_capital=request.capital,
        risk_free_rate=request.risk_free_rate,
    )

    # Evaluate metrics
    risk_engine = TreasuryRiskEngine()
    metrics = risk_engine.evaluate_portfolio(config, returns_df)

    return PortfolioAnalysisResponse(
        capital=request.capital,
        weights=request.weights,
        monetary_allocations=metrics.monetary_allocations,
        expected_return=metrics.expected_return_annualized,
        volatility=metrics.volatility_annualized,
        sharpe_ratio=metrics.sharpe_ratio,
        var_95_historical=metrics.var_95_historical,
        cvar_95_historical=metrics.cvar_95_historical,
        var_95_monetary=metrics.var_95_monetary,
        cvar_95_monetary=metrics.cvar_95_monetary,
        max_drawdown=metrics.max_drawdown,
        hhi_concentration=metrics.hhi_concentration,
        largest_exposure_asset=metrics.largest_exposure_asset,
        largest_exposure_weight=metrics.largest_exposure_weight,
        weighted_liquidity_score=metrics.weighted_liquidity_score,
        tier_breakdown=metrics.tier_breakdown,
    )
