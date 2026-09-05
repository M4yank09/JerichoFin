"""Stress Testing and Macro Scenario Analysis API Router."""
from typing import Dict, List
from fastapi import APIRouter, HTTPException, status

from backend.app.api.v1.mappers import (
    asset_item_to_domain,
    policy_input_to_domain,
    stress_result_to_response,
)
from backend.app.engine.analytics import validate_weights
from backend.app.engine.stress_testing import StressTestingEngine, get_predefined_scenarios
from backend.app.engine.synthetic_data import (
    DEFAULT_INSTITUTIONAL_ASSETS,
    generate_deterministic_synthetic_returns,
)
from backend.app.schemas.api import (
    CustomScenarioInput,
    ScenarioSummaryItem,
    StressCompareRequest,
    StressCompareResponse,
    StressRunRequest,
    StressRunResponse,
)
from backend.app.schemas.portfolio import Asset, StressScenario

router = APIRouter(prefix="/stress", tags=["Stress Testing"])


@router.get(
    "/scenarios",
    response_model=Dict[str, Dict[str, object]],
    summary="List Predefined Stress Scenarios",
    description="Retrieves the catalog of standard institutional macroeconomic stress scenarios.",
)
def list_scenarios() -> Dict[str, Dict[str, object]]:
    """Returns all 5 predefined institutional stress scenarios."""
    scenarios = get_predefined_scenarios()
    return {
        k: {
            "scenario_id": v.scenario_id,
            "name": v.name,
            "description": v.description,
            "severity": v.severity,
            "assumptions": v.assumptions,
            "asset_class_shocks": v.asset_class_shocks,
            "symbol_shocks": v.symbol_shocks,
        }
        for k, v in scenarios.items()
    }


@router.post(
    "/run",
    response_model=StressRunResponse,
    summary="Execute Deterministic Stress Scenario",
    description=(
        "Simulates portfolio return shocks, monetary P&L, ending portfolio value, "
        "and post-shock policy status under a predefined or custom stress scenario. "
        "If stress causes a policy breach, automatically calculates a defensive rebalancing response."
    ),
)
def run_stress_test(request: StressRunRequest) -> StressRunResponse:
    """Executes a single deterministic stress scenario on a portfolio."""
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
        validate_weights(request.weights, allowed_symbols=allowed_symbols)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Resolve scenario
    predefined = get_predefined_scenarios()
    scenario: StressScenario

    if request.scenario_id:
        if request.scenario_id not in predefined:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario '{request.scenario_id}' not found. Available: {list(predefined.keys())}",
            )
        scenario = predefined[request.scenario_id]
    elif request.custom_scenario:
        c_scen = request.custom_scenario
        scenario = StressScenario(
            scenario_id=c_scen.scenario_id,
            name=c_scen.name,
            description=c_scen.description,
            asset_class_shocks=c_scen.asset_class_shocks,
            symbol_shocks=c_scen.symbol_shocks,
            severity=c_scen.severity,
            assumptions=c_scen.assumptions,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must specify either 'scenario_id' or 'custom_scenario'.",
        )

    # Resolve policy
    policy = policy_input_to_domain(request.policy)
    returns_df = generate_deterministic_synthetic_returns(assets=assets)

    engine = StressTestingEngine()

    try:
        stress_res = engine.run_stress_test(
            portfolio_weights=request.weights,
            assets=assets,
            scenario=scenario,
            historical_returns=returns_df,
            policy=policy,
            total_capital=request.capital,
            trigger_defensive_on_breach=request.trigger_defensive_on_breach,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Stress scenario parameter error: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stress testing engine error: {str(e)}",
        )

    return stress_result_to_response(stress_res, capital=request.capital, assumptions=scenario.assumptions)


@router.post(
    "/compare",
    response_model=StressCompareResponse,
    summary="Compare Multiple Stress Scenarios",
    description=(
        "Runs a multi-scenario battery comparing portfolio outcomes (returns, P&L, post-shock value, "
        "policy status, and breaches) side-by-side."
    ),
)
def compare_stress_scenarios(request: StressCompareRequest) -> StressCompareResponse:
    """Executes a comparative battery of stress tests across multiple scenarios."""
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
        validate_weights(request.weights, allowed_symbols=allowed_symbols)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    predefined = get_predefined_scenarios()
    scenarios_to_run: List[StressScenario] = []

    if request.scenario_ids:
        for sid in request.scenario_ids:
            if sid not in predefined:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Scenario '{sid}' not found. Available: {list(predefined.keys())}",
                )
            scenarios_to_run.append(predefined[sid])
    else:
        scenarios_to_run = list(predefined.values())

    policy = policy_input_to_domain(request.policy)
    returns_df = generate_deterministic_synthetic_returns(assets=assets)

    engine = StressTestingEngine()

    try:
        comp_res = engine.run_multi_scenario_comparison(
            portfolio_weights=request.weights,
            assets=assets,
            historical_returns=returns_df,
            scenarios=scenarios_to_run,
            policy=policy,
            total_capital=request.capital,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multi-scenario engine error: {str(e)}",
        )

    summaries = [
        ScenarioSummaryItem(
            scenario_id=s.scenario_id,
            scenario_name=s.scenario_name,
            severity=s.severity,
            stressed_return=s.stressed_return,
            stressed_pnl=s.stressed_pnl,
            stressed_value=s.stressed_value,
            policy_status=s.policy_status,
            num_breached_policies=s.num_breached_policies,
            breached_policies=s.breached_policies,
        )
        for s in comp_res.scenarios
    ]

    detailed = {
        k: stress_result_to_response(
            v,
            capital=request.capital,
            assumptions=predefined.get(k, StressScenario("", "", "", {})).assumptions,
        )
        for k, v in comp_res.detailed_results.items()
    }

    return StressCompareResponse(
        base_capital=comp_res.base_capital,
        base_return=comp_res.base_return,
        scenarios=summaries,
        detailed_results=detailed,
    )
