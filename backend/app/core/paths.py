"""
Path helpers for runtime files.
"""

from pathlib import Path


APP_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = APP_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
LOG_DIR = BACKEND_DIR / "logs"
RESULTS_DIR = BACKEND_DIR / "results"
EXPORT_DIR = RESULTS_DIR / "exports"
DB_FILE = DATA_DIR / "entropy_lab.db"


def ensure_runtime_dirs() -> None:
    """Ensure all runtime directories exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
