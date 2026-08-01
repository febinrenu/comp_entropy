# -*- coding: utf-8 -*-
"""
Thin wrapper over Ollama's local HTTP API for generation.

Used instead of loading Phi-3.5-mini-instruct / Gemma-2-2b-it directly via
transformers+bitsandbytes 4-bit quantization, because (a) both models are
already pulled and validated to run on this machine's 4GB GPU via Ollama,
and (b) bitsandbytes 4-bit on Windows CUDA is a real, well-known source of
wheel/ABI failures that would risk losing hours of a multi-hour run for no
measurement benefit. Ollama serves the same GGUF-quantized weights already
resident on this GPU.
"""
import time

import requests

OLLAMA_URL = "http://localhost:11434/api/generate"

MODEL_TAGS = {
    "phi3.5": "phi3.5:3.8b",
    "gemma2": "gemma2:2b",
}

HF_TOKENIZER_REPOS = {
    "phi3.5": "microsoft/Phi-3.5-mini-instruct",
    # google/gemma-2-2b-it is gated on HF and requires authenticated ToS
    # acceptance; unsloth/gemma-2-2b-it is an ungated mirror with an
    # identical tokenizer/vocabulary, used here for token counting only
    # (no model weights are loaded from either repo -- generation is via
    # the locally-served Ollama GGUF weights).
    "gemma2": "unsloth/gemma-2-2b-it",
}


def generate(model_tag, prompt, max_new_tokens=128, temperature=0.7, top_p=0.95,
             seed=None, timeout=120):
    payload = {
        "model": model_tag,
        "prompt": prompt,
        "stream": False,
        "options": {
            "num_predict": max_new_tokens,
            "temperature": temperature,
            "top_p": top_p,
        },
    }
    if seed is not None:
        payload["options"]["seed"] = int(seed) % (2 ** 31)
    resp = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    return {
        "response": data.get("response", ""),
        "prompt_eval_count": data.get("prompt_eval_count", 0),
        "eval_count": data.get("eval_count", 0),
        "total_duration_ns": data.get("total_duration", 0),
        "eval_duration_ns": data.get("eval_duration", 0),
        "done_reason": data.get("done_reason"),
    }


def warm_up(model_tag, n_calls=2):
    """Force the model into VRAM and JIT/cache warm-up before timed
    measurement starts, so the first real record isn't contaminated by
    one-time model-load latency/power."""
    for _ in range(n_calls):
        generate(model_tag, "Say hello in one short sentence.", max_new_tokens=16)


def check_server():
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=5)
        r.raise_for_status()
        names = [m["name"] for m in r.json().get("models", [])]
        return names
    except Exception as e:
        raise RuntimeError(f"Ollama server not reachable at {OLLAMA_URL}: {e}") from e


if __name__ == "__main__":
    print("Models available:", check_server())
    t0 = time.perf_counter()
    out = generate(MODEL_TAGS["gemma2"], "What is the capital of France?", max_new_tokens=32)
    print({k: (v.encode("ascii", "replace").decode() if isinstance(v, str) else v)
           for k, v in out.items()})
    print("elapsed", time.perf_counter() - t0)
