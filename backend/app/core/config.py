"""
Application Configuration
=========================

Centralized configuration management using Pydantic Settings.
"""

from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache
import os

from app.core.paths import DB_FILE


def _default_database_url() -> str:
    """Build a stable SQLite URL that does not depend on current working dir."""
    return f"sqlite+aiosqlite:///{DB_FILE.as_posix()}"


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application
    APP_NAME: str = "Computational Entropy Lab"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", _default_database_url())
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-super-secret-key-change-in-production")
    
    # LLM Provider Configuration
    # Supported: "openai", "anthropic", "simulation"
    LLM_PROVIDER: str = "simulation"
    
    # OpenAI Settings
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-3.5-turbo"
    
    # Anthropic Settings
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-haiku-20240307"
    
    # Local Model Settings
    MODEL_PATH: Optional[str] = None
    MODEL_NAME: str = "simulation"
    
    # Generation Settings
    MAX_TOKENS: int = 256
    TEMPERATURE: float = 0.7
    
    # Energy Monitoring
    ENABLE_GPU_MONITORING: bool = False
    ENERGY_MEASUREMENT_INTERVAL: float = 0.1
    
    # Experiment Defaults
    DEFAULT_RUNS_PER_PROMPT: int = 3
    DEFAULT_WARMUP_RUNS: int = 1
    
    # Export
    EXPORT_DIR: str = "./results/exports"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
