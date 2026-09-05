"""Portfolio Analysis, Asset Universe, and Projections API Router."""
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from backend.app.api.v1.mappers import asset_domain_to_item, asset_item_to_domain
from backend.app.engine.analytics import validate_weights
from backend.app.engine.projection import PortfolioProjectionEngine
from backend.app.engine.risk import TreasuryRiskEngine
from backend.app.engine.synthetic_data import (
    ALL_INSTITUTIONAL_ASSETS,
    DATA_DISCLAIMER,
    DEFAULT_INSTITUTIONAL_ASSETS,
    INDIAN_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from backend.app.schemas.api import (
    AssetItem,
    AssetUniverseResponse,
    HorizonProjectionItem,
    PortfolioAnalysisRequest,
    PortfolioAnalysisResponse,
    PortfolioProjectionRequest,
    PortfolioProjectionResponse,
    ScenarioRangeItem,
)
from backend.app.schemas.portfolio import Asset, PortfolioConfig

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


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


@router.get(
    "/assets",
    response_model=AssetUniverseResponse,
    summary="Get Institutional Asset Universe",
    description=(
        "Retrieves the active institutional investment universe and instrument metadata. "
        "Supports query parameter `universe=indian` or `universe=legacy`. "
        "NOTICE: All assets and prices are deterministic synthetic demo data."
    ),
)
def get_assets(universe: Optional[str] = Query(default=None)) -> AssetUniverseResponse:
    """Returns the institutional asset universe with demo disclaimer."""
    if universe == "indian":
        asset_list = INDIAN_INSTITUTIONAL_ASSETS
    elif universe in ["legacy", "us"]:
        asset_list = DEFAULT_INSTITUTIONAL_ASSETS
    else:
        asset_list = ALL_INSTITUTIONAL_ASSETS

    asset_items = [asset_domain_to_item(a) for a in asset_list]
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


@router.post(
    "/projection",
    response_model=PortfolioProjectionResponse,
    summary="Generate Scenario-Based Portfolio Projections",
    description=(
        "Produces scenario-based forward-looking ranges (Conservative, Base Case, Favorable) "
        "across 3M, 6M, and 12M horizons derived from empirical distributions and explicit assumptions. "
        "DISCLAIMER: Scenario projection — not a guaranteed forecast."
    ),
)
def project_portfolio(request: PortfolioProjectionRequest) -> PortfolioProjectionResponse:
    """Generates scenario-based future outcome ranges across horizons."""
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

    returns_df = generate_deterministic_synthetic_returns(assets=assets)
    config = PortfolioConfig(
        portfolio_id="PORTFOLIO_PROJECTION",
        name="Portfolio Projection",
        assets=assets,
        weights=request.weights,
        total_capital=request.capital,
    )

    risk_engine = TreasuryRiskEngine()
    metrics = risk_engine.evaluate_portfolio(config, returns_df)

    proj_engine = PortfolioProjectionEngine()
    result = proj_engine.project(
        config=config,
        returns_df=returns_df,
        metrics=metrics,
        selected_horizon_months=request.selected_horizon_months,
    )

    return PortfolioProjectionResponse(
        capital=result.capital,
        expected_return_annualized=result.expected_return_annualized,
        volatility_annualized=result.volatility_annualized,
        selected_horizon_months=result.selected_horizon_months,
        methodology=result.methodology,
        disclaimer=result.disclaimer,
        projections=[
            HorizonProjectionItem(
                horizon_months=h.horizon_months,
                horizon_label=h.horizon_label,
                conservative=ScenarioRangeItem(
                    scenario_name=h.conservative.scenario_name,
                    min_value=h.conservative.min_value,
                    max_value=h.conservative.max_value,
                    min_return_pct=h.conservative.min_return_pct,
                    max_return_pct=h.conservative.max_return_pct,
                    assumptions=h.conservative.assumptions,
                ),
                base_case=ScenarioRangeItem(
                    scenario_name=h.base_case.scenario_name,
                    min_value=h.base_case.min_value,
                    max_value=h.base_case.max_value,
                    min_return_pct=h.base_case.min_return_pct,
                    max_return_pct=h.base_case.max_return_pct,
                    assumptions=h.base_case.assumptions,
                ),
                favorable=ScenarioRangeItem(
                    scenario_name=h.favorable.scenario_name,
                    min_value=h.favorable.min_value,
                    max_value=h.favorable.max_value,
                    min_return_pct=h.favorable.min_return_pct,
                    max_return_pct=h.favorable.max_return_pct,
                    assumptions=h.favorable.assumptions,
                ),
            )
            for h in result.projections
        ],
    )

