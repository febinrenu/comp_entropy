"""
Computational Entropy Lab - FastAPI Backend Application
========================================================

A research platform for quantifying the energy cost of semantic instability
in Large Language Models.

Author: Computational Entropy Research Team
Version: 1.0.0
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sys

from app.core.config import settings
from app.core.paths import ensure_runtime_dirs, LOG_DIR
from app.core.logger import logger
from app.core.database import init_db
from app.api import router as api_router


# Configure logging
ensure_runtime_dirs()

logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    str(LOG_DIR / "app.log"),
    rotation="10 MB",
    retention="30 days",
    level="DEBUG"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    # Startup
    logger.info("Starting Computational Entropy Lab Backend...")
    await init_db()
    logger.info("Database initialized successfully")
    logger.info(f"API documentation available at: http://localhost:{settings.PORT}/docs")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Computational Entropy Lab Backend...")


# Create FastAPI application
app = FastAPI(
    title="Computational Entropy Lab API",
    description="""
## 🔬 Research Platform for Energy-Semantic Analysis

This API provides endpoints for:
- 🧬 **Prompt Mutation**: Generate controlled semantic variations
- ⚡ **Energy Measurement**: Track computational resource usage  
- 📊 **Statistical Analysis**: Compute correlations and significance
- 📈 **Experiment Management**: CRUD operations for experiments
- 📁 **Data Export**: Export results in multiple formats

### Key Concepts
- **PEC (Prompt Entropy Coefficient)**: Correlation between prompt ambiguity and energy consumption
- **EPT (Energy Per Token)**: Normalized energy metric for comparison
- **SII (Semantic Instability Index)**: Composite measure of prompt clarity
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - API health check and information."""
    return {
        "status": "online",
        "name": "Computational Entropy Lab API",
        "version": "1.0.0",
        "documentation": "/docs",
        "research_focus": "Quantifying the Energy Cost of Semantic Instability in LLMs"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "database": "connected",
        "services": {
            "mutation_engine": "ready",
            "energy_monitor": "ready",
            "analysis_engine": "ready"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True
    )
