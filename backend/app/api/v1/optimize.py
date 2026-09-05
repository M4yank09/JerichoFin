"""Portfolio Optimization API Router."""
from typing import List
from fastapi import APIRouter, HTTPException, status

from app.api.v1.mappers import (
    asset_item_to_domain,
    constraints_input_to_domain,
)
from app.engine.optimizer import PortfolioOptimizer
from app.engine.synthetic_data import (
    DEFAULT_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from app.schemas.api import (
    ConstraintCheckItem,
    OptimizationRequest,
    OptimizationResponse,
)
from app.schemas.portfolio import Asset

router = APIRouter(prefix="/optimize", tags=["Optimization"])


@router.post(
    "",
    response_model=OptimizationResponse,
    summary="Optimize Portfolio Allocation",
    description=(
        "Computes optimal asset allocation weights maximizing expected return subject to institutional "
        "treasury risk constraints (single-asset limits, liquidity floors, CVaR, and max drawdown)."
    ),
)
def optimize_portfolio(request: OptimizationRequest) -> OptimizationResponse:
    """Solves the constrained convex portfolio optimization problem using CVXPY."""
    if request.capital <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Capital must be strictly positive (> 0), got {request.capital}",
        )

    # Resolve assets
    if request.custom_assets:
        assets: List[Asset] = [asset_item_to_domain(a) for a in request.custom_assets]
    elif getattr(request, "universe", None) == "indian":
        from app.engine.synthetic_data import INDIAN_INSTITUTIONAL_ASSETS
        assets = INDIAN_INSTITUTIONAL_ASSETS
    else:
        assets = DEFAULT_INSTITUTIONAL_ASSETS

    # Convert constraints
    domain_constraints = constraints_input_to_domain(request.constraints)

    # Generate returns matrix
    returns_df = generate_deterministic_synthetic_returns(assets=assets)

    optimizer = PortfolioOptimizer()

    try:
        opt_res = optimizer.optimize(
            assets=assets,
            historical_returns=returns_df,
            constraints=domain_constraints,
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
            detail=f"Optimization engine error: {str(e)}",
        )

    # Handle Infeasible constraints
    if opt_res.status == "INFEASIBLE":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Optimization problem is infeasible: {opt_res.message}. "
                "The requested constraint combination cannot be mathematically satisfied."
            ),
        )

    checks = [
        ConstraintCheckItem(
            constraint_name=c.constraint_name,
            actual_value=c.actual_value,
            limit=c.limit,
            passed=c.passed,
            operator=c.operator,
            description=c.description,
        )
        for c in opt_res.constraint_checks
    ]

    return OptimizationResponse(
        status=opt_res.status,
        capital=request.capital,
        weights=opt_res.weights,
        allocations=opt_res.allocations,
        expected_return=opt_res.expected_return,
        volatility=opt_res.volatility,
        var=opt_res.var,
        cvar=opt_res.cvar,
        max_drawdown=opt_res.max_drawdown,
        hhi=opt_res.hhi,
        largest_exposure=opt_res.largest_exposure,
        liquidity_score=opt_res.liquidity_score,
        constraint_checks=checks,
        message=opt_res.message,
        solve_time_seconds=opt_res.solve_time_seconds,
    )
