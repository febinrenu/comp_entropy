"""
Application Configuration
=========================

Centralized configuration management using Pydantic Settings.
"""

from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache
import os

from app.core.paths import DB_FILE, EXPORT_DIR as _EXPORT_DIR_PATH


def _default_database_url() -> str:
    """Build a stable SQLite URL that does not depend on current working dir."""
    return f"sqlite+aiosqlite:///{DB_FILE.as_posix()}"


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application
    APP_NAME: str = "Computational Entropy Lab"
    APP_VERSION: str = "1.0.0"
    # bool/int fields are left as plain typed defaults (not manually
    # os.getenv-parsed) so pydantic-settings is the single source of truth
    # for env-var coercion -- a hand-rolled `os.getenv(...).lower()=="true"`
    # default expression here would double-parse the DEBUG env var against
    # a second, possibly-inconsistent coercion rule.
    DEBUG: bool = False
    PORT: int = 8000

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", _default_database_url())

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-super-secret-key-change-in-production")

    # LLM Provider Configuration
    # Supported: "ollama" (default -- real local models via a running
    # Ollama server), "openai", "anthropic", "simulation" (explicit,
    # clearly-labeled synthetic fallback -- see llm_service.py).
    LLM_PROVIDER: str = "ollama"

    # Ollama Settings (default provider)
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "phi3.5:3.8b"

    # OpenAI Settings
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-3.5-turbo"

    # Anthropic Settings
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-haiku-20240307"

    # Generation Settings
    MAX_TOKENS: int = 256
    TEMPERATURE: float = 0.7

    # Energy Monitoring
    # ENABLE_GPU_MONITORING actually gates the NVML init attempt in
    # energy_monitor.py -- previously this flag existed but nothing read it.
    ENABLE_GPU_MONITORING: bool = True
    ENERGY_MEASUREMENT_INTERVAL: float = 0.1
    # Nominal CPU TDP (watts) used only for the explicit, labeled
    # tdp_proxy fallback path when NVML/GPU energy isn't available -- not
    # a real hardware measurement. Shared by energy_monitor.py and
    # experiment_runner.py so the two CPU-proxy formulas can't drift.
    CPU_TDP_WATTS: float = 65.0

    # Experiment Defaults
    DEFAULT_RUNS_PER_PROMPT: int = 3
    DEFAULT_WARMUP_RUNS: int = 1

    # Export -- single source of truth; app/core/paths.py computes the
    # actual absolute path (anchored to the backend directory), this
    # field just mirrors it as a string for anything that wants to read
    # export dir from settings rather than paths.
    EXPORT_DIR: str = str(_EXPORT_DIR_PATH)

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
