# SII-EPT Real-Hardware Replication

Follow-up to the NumPy-transformer pilot (`numpy_transformer.py`, `run_experiment_numpy.py`,
`measurements_numpy.json`, kept in this folder for provenance). That pilot used a
from-scratch, randomly-initialized, untrained transformer (because the original
sandbox had no internet access) and a TDP-based timing proxy for energy (no
Intel RAPL / NVIDIA NVML access there). This replication uses two real,
semantically-competent, open-weight instruction-tuned models and real GPU
energy measurement.

## What's real here vs. proxy

- **Generation**: real `phi3.5:3.8b` and `gemma2:2b` (GGUF, Q4_0 quantization),
  served locally via Ollama. Outputs are coherent, on-topic text — not the
  byte-garbage the untrained numpy transformer produced.
- **Energy**: real NVIDIA NVML-sampled GPU power (`nvmlDeviceGetPowerUsage`),
  integrated over each generation call's wall-clock window to get joules.
  This measures whole-GPU-package power, not a per-process partition — see
  `ENVIRONMENT.md` and the new paper.tex section for that caveat.
- **CPU energy / Intel RAPL**: still not available. This is a Windows machine
  without root/Linux access, so `/sys/class/powercap` is unreachable, same as
  the original pilot. No CPU-only fallback path was needed or exercised in
  this run (Ollama+NVML on GPU worked for 100% of calls) — if it ever were,
  it would reuse the numpy pilot's TDP-proxy formula and be labeled
  `energy_source: "tdp_proxy_cpu"`, never silently substituted for real NVML
  numbers (`energy_source: "nvml_gpu_real"`).

## Setup

```bash
# 1. Models already pulled via Ollama (confirm with `ollama list`):
ollama pull phi3.5:3.8b
ollama pull gemma2:2b

# 2. Python deps (a dedicated venv is recommended; CPU-only torch wheel is
#    sufficient since torch/transformers are only used for tokenization,
#    not generation):
python -m venv venv
./venv/Scripts/python.exe -m pip install -r requirements.txt
```

Ollama must be running as a local server (`http://localhost:11434`) before
running any script here.

## Rerun steps

```bash
# Calibration (get a real per-call timing estimate before committing to a
# full run; ~1-2 min):
./venv/Scripts/python.exe run_experiment_real.py --model phi3.5 --n_prompts 2 --out calib.json

# Full reduced-scale run per model (~15-20 min each on an RTX 3050 4GB
# laptop GPU; checkpointed every 5 records, safe to interrupt and resume):
./venv/Scripts/python.exe run_experiment_real.py --model phi3.5 --n_prompts 16 \
    --checkpoint_every 5 --out measurements_real_phi3.5.json
./venv/Scripts/python.exe run_experiment_real.py --model gemma2 --n_prompts 16 \
    --checkpoint_every 5 --out measurements_real_gemma2.json
# add --resume to continue an interrupted run from its last checkpoint

# Statistical analysis (Spearman PEC, both partial correlations, ANOVA,
# Cohen's d, paired Wilcoxon raw-vs-length-matched):
./venv/Scripts/python.exe stats_analysis.py measurements_real_phi3.5.json
./venv/Scripts/python.exe stats_analysis.py measurements_real_phi3.5.json --filter-variant raw
./venv/Scripts/python.exe stats_analysis.py measurements_real_phi3.5.json --filter-variant length_matched
./venv/Scripts/python.exe stats_analysis.py measurements_real_gemma2.json

# SII-coefficient sensitivity analysis (reused unmodified):
./venv/Scripts/python.exe sensitivity_analysis.py measurements_real_phi3.5.json sensitivity_real_phi3.5.json
./venv/Scripts/python.exe sensitivity_analysis.py measurements_real_gemma2.json sensitivity_real_gemma2.json

# Semantic-entropy validation pilot (real execution, ~20-25 min each):
./venv/Scripts/python.exe sc_pilot_real.py --model phi3.5 --n_prompts 10
./venv/Scripts/python.exe sc_pilot_real.py --model gemma2 --n_prompts 10
```

## Results obtained (this run)

| Model | PEC raw | PEC length-matched | Partial (given tokens) | ANOVA | SII vs S_c |
|---|---|---|---|---|---|
| Phi-3.5 | -0.050 (p=0.56) | -0.045 (p=0.60) | -0.035 / -0.046 | F=0.60, p=0.78 | rho=-0.173 (p=0.19) |
| Gemma-2 | -0.066 (p=0.45) | +0.030 (p=0.73) | -0.055 / +0.030 | F=1.16, p=0.32 | rho=+0.345 (p=0.007) |

Both real models show a null SII-EPT relationship, before *and* after
length matching -- unlike the numpy pilot, where there was a real
correlation to explain away via length. The semantic-entropy result is
mixed across models (significant for Gemma-2, not for Phi-3.5). See
`paper.tex`, Section "Real-Instruction-Tuned-Model Replication on
Consumer GPU Hardware", for the full writeup and all caveats.

## Files

| File | Role |
|---|---|
| `corpus.py`, `mutation_engine.py` | Unmodified from the prior pilot: 60-prompt corpus, 9 mutation conditions, SII formula |
| `numpy_transformer.py`, `run_experiment_numpy.py`, `measurements_numpy.json`, `stats_results_numpy.json`, `sensitivity_results_numpy.json` | Prior pilot, kept for provenance/comparison |
| `energy_nvml.py` | Real GPU power sampling (NVML) + trapezoidal joule integration; TDP-proxy fallback formula (unused in this run) |
| `ollama_backend.py` | Thin wrapper over Ollama's local HTTP API |
| `length_control.py` | Token-count-matched pad/truncate control, using each model's real tokenizer |
| `run_experiment_real.py` | Main experiment orchestrator: real generation + real energy + length-matched variant |
| `stats_analysis.py` | Fixed + extended: Spearman PEC, both partial correlations (wall-time and input-tokens), ANOVA, Wilcoxon raw-vs-matched |
| `sensitivity_analysis.py` | Unmodified: SII-coefficient robustness, run against real data |
| `sc_pilot.py` | Unmodified clustering/entropy logic (never executed in the prior pilot) |
| `sc_pilot_real.py` | Real execution of the S_c validation pilot via Ollama |
| `ENVIRONMENT.md` | Exact model/hardware/driver versions and energy methodology, for reviewers |
