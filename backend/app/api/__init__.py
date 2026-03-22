"""
API Routes Module
=================

FastAPI router configuration for all API endpoints.
"""

from fastapi import APIRouter
from app.api.endpoints import experiments, prompts, measurements, analysis, dashboard, export, settings, demo

router = APIRouter()

# Include all endpoint routers
router.include_router(
    experiments.router,
    prefix="/experiments",
    tags=["Experiments"]
)

router.include_router(
    prompts.router,
    prefix="/prompts",
    tags=["Prompts"]
)

router.include_router(
    measurements.router,
    prefix="/measurements",
    tags=["Measurements"]
)

router.include_router(
    analysis.router,
    prefix="/analysis",
    tags=["Analysis"]
)

router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["Dashboard"]
)

router.include_router(
    export.router,
    prefix="/export",
    tags=["Export"]
)

router.include_router(
    settings.router,
    prefix="/settings",
    tags=["Settings"]
)

router.include_router(
    demo.router,
    prefix="/demo",
    tags=["Demo"]
)
