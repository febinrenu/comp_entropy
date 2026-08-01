"""
Settings API Endpoints
======================

Manage application settings including LLM provider configuration.
"""

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
import json

import httpx

from app.schemas import SettingsUpdate, SettingsResponse, TestConnectionRequest
from app.core.paths import DATA_DIR
from app.core.config import settings as app_settings

router = APIRouter()

# Settings file path
SETTINGS_FILE = DATA_DIR / "settings.json"


def load_settings() -> dict:
    """Load settings from file."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "provider": app_settings.LLM_PROVIDER,
        "ollama_host": app_settings.OLLAMA_HOST,
        "ollama_model": app_settings.OLLAMA_MODEL,
        "openai_api_key": None,
        "openai_model": "gpt-3.5-turbo",
        "anthropic_api_key": None,
        "anthropic_model": "claude-3-haiku-20240307",
        "temperature": 0.7,
        "max_tokens": 256
    }


def save_settings(data: dict):
    """Save settings to file."""
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)


@router.get("/", response_model=SettingsResponse)
async def get_settings():
    """
    Get current application settings.

    Returns settings without exposing full API keys.
    """
    data = load_settings()

    return SettingsResponse(
        provider=data.get("provider", app_settings.LLM_PROVIDER),
        ollama_host=data.get("ollama_host", app_settings.OLLAMA_HOST),
        ollama_model=data.get("ollama_model", app_settings.OLLAMA_MODEL),
        openai_model=data.get("openai_model", "gpt-3.5-turbo"),
        anthropic_model=data.get("anthropic_model", "claude-3-haiku-20240307"),
        has_openai_key=bool(data.get("openai_api_key")),
        has_anthropic_key=bool(data.get("anthropic_api_key")),
        temperature=data.get("temperature", 0.7),
        max_tokens=data.get("max_tokens", 256)
    )


@router.patch("/", response_model=SettingsResponse)
async def update_settings(update: SettingsUpdate):
    """
    Update application settings.

    Can update:
    - LLM provider (ollama, openai, anthropic, simulation)
    - Ollama host/model
    - API keys
    - Model names
    - Temperature and max tokens
    """
    data = load_settings()

    if update.provider is not None:
        if update.provider not in ["ollama", "openai", "anthropic", "simulation"]:
            raise HTTPException(
                status_code=400,
                detail="Provider must be 'ollama', 'openai', 'anthropic', or 'simulation'"
            )
        data["provider"] = update.provider

    if update.ollama_host is not None:
        data["ollama_host"] = update.ollama_host

    if update.ollama_model is not None:
        data["ollama_model"] = update.ollama_model

    if update.openai_api_key is not None:
        data["openai_api_key"] = update.openai_api_key if update.openai_api_key else None

    if update.openai_model is not None:
        data["openai_model"] = update.openai_model

    if update.anthropic_api_key is not None:
        data["anthropic_api_key"] = update.anthropic_api_key if update.anthropic_api_key else None

    if update.anthropic_model is not None:
        data["anthropic_model"] = update.anthropic_model

    if update.temperature is not None:
        if not (0.0 <= update.temperature <= 2.0):
            raise HTTPException(status_code=400, detail="Temperature must be between 0.0 and 2.0")
        data["temperature"] = update.temperature

    if update.max_tokens is not None:
        if not (1 <= update.max_tokens <= 4096):
            raise HTTPException(status_code=400, detail="Max tokens must be between 1 and 4096")
        data["max_tokens"] = update.max_tokens

    save_settings(data)

    return SettingsResponse(
        provider=data.get("provider", app_settings.LLM_PROVIDER),
        ollama_host=data.get("ollama_host", app_settings.OLLAMA_HOST),
        ollama_model=data.get("ollama_model", app_settings.OLLAMA_MODEL),
        openai_model=data["openai_model"],
        anthropic_model=data["anthropic_model"],
        has_openai_key=bool(data.get("openai_api_key")),
        has_anthropic_key=bool(data.get("anthropic_api_key")),
        temperature=data["temperature"],
        max_tokens=data["max_tokens"]
    )


@router.get("/providers")
async def list_providers():
    """
    List available LLM providers and their status.
    """
    data = load_settings()

    return {
        "providers": [
            {
                "id": "ollama",
                "name": "Ollama (default)",
                "description": "Real local open-weight models via a running Ollama server -- real generation, real energy measurement",
                "configured": True,  # availability is checked live via /test-connection
                "models": [data.get("ollama_model", app_settings.OLLAMA_MODEL)]
            },
            {
                "id": "openai",
                "name": "OpenAI",
                "description": "GPT-3.5, GPT-4 and other OpenAI models",
                "configured": bool(data.get("openai_api_key")),
                "models": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini"]
            },
            {
                "id": "anthropic",
                "name": "Anthropic",
                "description": "Claude 3 and other Anthropic models",
                "configured": bool(data.get("anthropic_api_key")),
                "models": ["claude-3-haiku-20240307", "claude-3-sonnet-20240229", "claude-3-opus-20240229"]
            },
            {
                "id": "simulation",
                "name": "Simulation Mode",
                "description": "Explicit synthetic fallback for testing -- NOT a real model, NOT real energy",
                "configured": True,
                "models": ["simulation-model"]
            },
        ]
    }


@router.post("/test-connection")
async def test_connection(request: TestConnectionRequest):
    """
    Test connection to an LLM provider.

    Returns success/failure and helpful error messages.
    """
    provider = request.provider
    data = load_settings()

    if provider == "simulation":
        return {"success": True, "message": "Simulation mode is always available (synthetic, not a real model)"}

    if provider == "ollama":
        host = data.get("ollama_host", app_settings.OLLAMA_HOST)
        model = data.get("ollama_model", app_settings.OLLAMA_MODEL)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{host}/api/tags")
                resp.raise_for_status()
                models = [m["name"] for m in resp.json().get("models", [])]
            if model in models:
                return {"success": True, "message": f"Ollama reachable at {host}; model '{model}' is pulled"}
            return {
                "success": False,
                "message": f"Ollama reachable at {host}, but model '{model}' is not pulled. "
                           f"Available: {models}. Run: ollama pull {model}"
            }
        except Exception as e:
            return {"success": False, "message": f"Could not reach Ollama at {host}: {str(e)[:150]}"}

    if provider == "openai":
        api_key = data.get("openai_api_key")
        if not api_key:
            return {"success": False, "message": "OpenAI API key not configured"}

        try:
            import openai
            client = openai.OpenAI(api_key=api_key)
            # The official SDK client is synchronous -- run it off the
            # event loop thread so this request doesn't block every other
            # concurrent request to the server for the duration of the
            # network call.
            models = await run_in_threadpool(client.models.list)
            return {"success": True, "message": f"OpenAI connection successful. Found {len(models.data)} available models"}
        except ImportError:
            return {
                "success": False,
                "message": "openai package not installed. Run: pip install openai"
            }
        except Exception as e:
            error_str = str(e)
            if "401" in error_str or "unauthorized" in error_str.lower() or "invalid api key" in error_str.lower():
                return {"success": False, "message": "Invalid OpenAI API key"}
            if "insufficient" in error_str.lower():
                return {"success": False, "message": "API key insufficient permissions or quota exceeded"}
            if "timeout" in error_str.lower():
                return {"success": False, "message": "Connection timeout - check internet and OpenAI status"}
            return {"success": False, "message": f"Connection failed: {error_str[:100]}"}

    if provider == "anthropic":
        api_key = data.get("anthropic_api_key")
        if not api_key:
            return {"success": False, "message": "Anthropic API key not configured"}

        # Use the user's actually-configured model, not a hardcoded one --
        # previously this always tested claude-3-haiku-20240307 regardless
        # of what model was configured, so a successful test here didn't
        # actually validate the model that would be used for real runs.
        model = data.get("anthropic_model", "claude-3-haiku-20240307")

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            await run_in_threadpool(
                client.messages.create,
                model=model,
                max_tokens=10,
                messages=[{"role": "user", "content": "test"}],
            )
            return {"success": True, "message": f"Anthropic connection successful using model: {model}"}
        except ImportError:
            return {
                "success": False,
                "message": "anthropic package not installed. Run: pip install anthropic"
            }
        except Exception as e:
            error_str = str(e)
            if "401" in error_str or "unauthorized" in error_str.lower():
                return {"success": False, "message": "Invalid Anthropic API key - unauthorized"}
            if "overloaded" in error_str.lower():
                return {"success": False, "message": "Anthropic API temporarily overloaded"}
            if "timeout" in error_str.lower():
                return {"success": False, "message": "Connection timeout - check internet"}
            if "not_found" in error_str.lower() or "404" in error_str:
                return {"success": False, "message": f"Model '{model}' not found or not accessible with this key"}
            return {"success": False, "message": f"Connection failed: {error_str[:100]}"}

    return {"success": False, "message": f"Unknown provider: {provider}"}
