"""Jerifin Institutional Capital Allocation & Treasury Risk Platform - FastAPI Entrypoint."""
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.v1 import api_router
from backend.app.core.config import settings


def create_app() -> FastAPI:
    """Application factory initializing FastAPI, CORS middleware, and API routes."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=(
            "Institutional Capital Allocation & Treasury Risk Decision-Support Platform. "
            "Provides deterministic portfolio analytics, convex optimization (CVXPY), "
            "independent policy governance (NORMAL, WARNING, BREACH, CRITICAL), "
            "defensive rebalancing, and macroeconomic stress testing."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --------------------------------------------------------------------------
    # Global Exception Handlers
    # --------------------------------------------------------------------------
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": "HTTPException",
                "detail": exc.detail,
                "code": exc.status_code,
            },
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": "ValidationError",
                "detail": str(exc),
                "code": status.HTTP_400_BAD_REQUEST,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        # Format Pydantic validation errors clearly
        errors = exc.errors()
        messages = []
        for err in errors:
            loc = " -> ".join(str(l) for l in err.get("loc", []))
            msg = err.get("msg", "Invalid value")
            messages.append(f"{loc}: {msg}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "RequestValidationError",
                "detail": "; ".join(messages),
                "code": status.HTTP_422_UNPROCESSABLE_ENTITY,
            },
        )

    # --------------------------------------------------------------------------
    # Health Check
    # --------------------------------------------------------------------------
    @app.get(
        "/health",
        tags=["Health"],
        summary="Service Health Check",
        description="Returns service health status, project metadata, and environment mode.",
    )
    def health_check():
        return {
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
        }

    # --------------------------------------------------------------------------
    # Register API v1 Routers
    # --------------------------------------------------------------------------
    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    print(f"Starting {settings.PROJECT_NAME} on http://127.0.0.1:8000 ...")
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
