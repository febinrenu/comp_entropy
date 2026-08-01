# Environment (for reviewer reproducibility)

## Hardware

- **CPU**: Intel Core i5-12500H
- **GPU**: NVIDIA GeForce RTX 3050 Laptop GPU, 4096 MiB VRAM, 30W power cap
- **NVIDIA driver**: 595.97, CUDA 13.2 (as reported by `nvidia-smi`)
- **OS**: Windows 11 Home Single Language, build 10.0.26200

## Models

Served locally via Ollama (v0.6.1):

| Local name | Architecture | Params | Quantization | Approx. HF equivalent |
|---|---|---|---|---|
| `phi3.5:3.8b` | phi3 | 3.8B | Q4_0 (GGUF) | `microsoft/Phi-3.5-mini-instruct` |
| `gemma2:2b` | gemma2 | 2.6B | Q4_0 (GGUF) | `google/gemma-2-2b-it` |

Tokenizers loaded directly from Hugging Face (`microsoft/Phi-3.5-mini-instruct`,
`google/gemma-2-2b-it`) via `transformers.AutoTokenizer`, used only for token
counting / length-matching — no full model weights downloaded from HF; all
generation runs through the locally-served Ollama GGUF weights above. Because
the Ollama-served weights are quantized (Q4_0) and the HF tokenizer repo may
be pinned to `main` rather than a specific commit at run time, exact
byte-for-byte tokenizer parity with the GGUF conversion's own vocabulary is
not guaranteed — noted as a limitation.

## Energy measurement methodology

Real hardware energy, not a proxy: NVIDIA NVML (`pynvml`,
`nvmlDeviceGetPowerUsage`) is polled on a background thread throughout each
generation call and integrated via the trapezoidal rule to obtain joules
(`energy_nvml.py:NVMLPowerSampler`). This is genuine measured GPU-package
power — it is **not** a per-process partition (any other GPU load during a
call, e.g. desktop compositing, is included in the integral) and it does
**not** cover CPU energy (Intel RAPL / `/sys/class/powercap` is unavailable
on this Windows machine, same limitation as the prior NumPy-transformer
pilot). Every record in `measurements_real_*.json` carries
`energy_source: "nvml_gpu_real"` explicitly, plus `mean_watts`, `max_watts`,
`n_power_samples`, and `observed_sample_dt` for transparency on sampling
fidelity. No CPU-only fallback (TDP-proxy) path was exercised in this run —
Ollama+NVML succeeded for 100% of generation calls on both models.

## Scale actually run

Reduced from the full 60-prompt x 9-condition protocol to a 15-prompt
stratified subset (3 per domain, 5 domains) x 9 mutation conditions x
{raw, length-matched} per model, to keep total wall-clock time in the tens
of minutes rather than hours. `MAX_NEW_TOKENS_CAP = 96` (a safety ceiling,
not a fixed generation length — see `run_experiment_real.py`); calibration
showed most completions for these instruction-tuned models naturally run
~90-125 tokens, so a large fraction of calls are right-censored at the cap —
recorded per-record via `n_out_capped` and reported plainly as a limitation,
not hidden.
