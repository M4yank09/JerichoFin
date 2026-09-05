"""Version 1 API routes aggregation."""
from fastapi import APIRouter

from app.api.v1.optimize import router as optimize_router
from app.api.v1.portfolio import router as portfolio_router
from app.api.v1.risk import router as risk_router
from app.api.v1.stress import router as stress_router

api_router = APIRouter()

api_router.include_router(portfolio_router)
api_router.include_router(optimize_router)
api_router.include_router(risk_router)
api_router.include_router(stress_router)
