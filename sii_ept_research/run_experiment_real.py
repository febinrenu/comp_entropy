# -*- coding: utf-8 -*-
"""
Real-hardware replication: instruction-tuned open-weight models
(phi3.5:3.8b / gemma2:2b, served via Ollama, GGUF Q4_0), real GPU energy
via NVML power sampling, and a length-matched control for every mutated
prompt (see length_control.py).

Unlike run_experiment_numpy.py, MAX_NEW_TOKENS is a safety cap, not a
fixed value -- letting these real, semantically-competent models stop
naturally at EOS avoids the zero-output-length-variance artifact that
produced NaN correlations in the numpy pilot.

Corpus and mutation engine are reused unmodified (corpus.py,
mutation_engine.py). Energy is real NVML-integrated GPU joules
("nvml_gpu_real"); there is no CPU fallback path implemented in this
script -- if Ollama/NVML is unavailable this script raises rather than
silently substituting a TDP proxy.
"""
import argparse
import json
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from corpus import CORPUS
from mutation_engine import MUTATION_TYPES, apply_mutation, compute_sii
from length_control import make_length_matched
import energy_nvml
import ollama_backend

ALPHA = 0.7
MAX_NEW_TOKENS_CAP = 96


def stratified_subset(corpus, n_prompts):
    """Pick n_prompts total, spread evenly across the 5 domains, preserving
    corpus order within each domain (deterministic, no RNG needed)."""
    by_domain = {}
    for p in corpus:
        by_domain.setdefault(p["domain"], []).append(p)
    domains = list(by_domain.keys())
    per_domain = max(1, n_prompts // len(domains))
    out = []
    for d in domains:
        out.extend(by_domain[d][:per_domain])
    return out[:n_prompts] if n_prompts else out


def atomic_write_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=2, default=float)
    os.replace(tmp, path)


def load_checkpoint(path):
    if os.path.exists(path):
        with open(path) as f:
            data = json.load(f)
        return data.get("records", [])
    return []


def build_meta(model_key, n_prompts, records, n_capped):
    return {
        "model": model_key,
        "ollama_tag": ollama_backend.MODEL_TAGS[model_key],
        "hf_tokenizer_repo": ollama_backend.HF_TOKENIZER_REPOS[model_key],
        "backend": "ollama",
        "energy_source": "nvml_gpu_real",
        "alpha": ALPHA,
        "max_new_tokens_cap": MAX_NEW_TOKENS_CAP,
        "max_new_tokens_mode": "varied_eos_stopped",
        "n_prompts": n_prompts,
        "n_measurements": len(records),
        "n_capped_at_max_tokens": n_capped,
        "note": "MAX_NEW_TOKENS is a safety ceiling, not fixed -- models "
                "stop naturally at EOS. This differs deliberately from "
                "run_experiment_numpy.py's fixed 40-token cap, which caused "
                "zero output-length variance (NaN tokens-vs-EPT correlation) "
                "in that pilot.",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=["phi3.5", "gemma2"])
    ap.add_argument("--n_prompts", type=int, default=20)
    ap.add_argument("--checkpoint_every", type=int, default=5)
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    model_key = args.model
    model_tag = ollama_backend.MODEL_TAGS[model_key]
    out_path = args.out or f"measurements_real_{model_key}.json"

    ollama_backend.check_server()

    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(ollama_backend.HF_TOKENIZER_REPOS[model_key])

    print(f"[{model_key}] warming up {model_tag}...", file=sys.stderr)
    ollama_backend.warm_up(model_tag)

    energy_nvml.self_test()

    records = load_checkpoint(out_path) if args.resume else []
    done_keys = {(r["prompt_id"], r["mutation_type"], r["variant"]) for r in records}

    prompts = stratified_subset(CORPUS, args.n_prompts)
    rng = random.Random(1234)

    total_planned = len(prompts) * (1 + (len(MUTATION_TYPES) - 1) * 2)
    n_capped = sum(1 for r in records if r.get("n_out_capped"))
    t_start = time.perf_counter()
    n_done_this_run = 0

    for p in prompts:
        for mtype in MUTATION_TYPES:
            seed = hash((p["id"], mtype)) % (2 ** 31)
            mutated = apply_mutation(p["text"], mtype, ALPHA, seed=seed)
            sii = compute_sii(mutated, p["text"], mtype, ALPHA)

            variants = [("raw", mutated, "n/a", None, None)]
            if mtype != "baseline":
                lm = make_length_matched(tokenizer, p["text"], mutated, rng)
                variants.append(("length_matched", lm["text"], lm["method"],
                                  lm["n_target_tokens"], lm["n_actual_tokens"]))

            for variant_name, text, lm_method, n_tgt, n_act in variants:
                key = (p["id"], mtype, variant_name)
                if key in done_keys:
                    continue

                sampler = energy_nvml.NVMLPowerSampler()
                with sampler:
                    t0 = time.perf_counter()
                    resp = ollama_backend.generate(
                        model_tag, text, max_new_tokens=MAX_NEW_TOKENS_CAP,
                        temperature=0.7, top_p=0.95, seed=seed,
                    )
                    t1 = time.perf_counter()
                sampler.close()

                wall_time = t1 - t0
                n_out = max(resp["eval_count"], 1)
                energy_j = sampler.joules()
                ept = (energy_j / n_out) * 1000.0
                capped = resp["eval_count"] >= MAX_NEW_TOKENS_CAP
                n_capped += int(capped)

                rec = {
                    "model": model_key, "prompt_id": p["id"], "domain": p["domain"],
                    "mutation_type": mtype, "variant": variant_name, "alpha": ALPHA,
                    "baseline_text": p["text"], "mutated_text": mutated,
                    "generated_from_text": text, "sii": sii,
                    "length_match_method": lm_method,
                    "n_target_tokens": n_tgt, "n_actual_tokens_after_match": n_act,
                    "n_in_tokens": resp["prompt_eval_count"],
                    "n_out_tokens": n_out, "n_out_capped": capped,
                    "wall_time": wall_time, "energy_joules": energy_j,
                    "mean_watts": sampler.mean_watts(), "max_watts": sampler.max_watts(),
                    "n_power_samples": sampler.n_samples(),
                    "observed_sample_dt": sampler.observed_sample_dt(),
                    "ept": ept, "energy_source": "nvml_gpu_real", "backend": "ollama",
                    "output_text": resp["response"],
                }
                records.append(rec)
                done_keys.add(key)
                n_done_this_run += 1

                if len(records) % args.checkpoint_every == 0:
                    atomic_write_json(out_path, {
                        "meta": build_meta(model_key, len(prompts), records, n_capped),
                        "records": records})

                elapsed = time.perf_counter() - t_start
                rate = n_done_this_run / elapsed if elapsed > 0 else 0
                remaining = (total_planned - len(records)) / rate if rate > 0 else float("nan")
                print(f"[{model_key}] [{len(records)}/{total_planned}] "
                      f"{mtype}/{variant_name} SII={sii:.3f} EPT={ept:.4f} "
                      f"wall={wall_time:.2f}s eta={remaining/60:.1f}min", file=sys.stderr)

    atomic_write_json(out_path, {
        "meta": build_meta(model_key, len(prompts), records, n_capped),
        "records": records})
    print(f"[{model_key}] Wrote {len(records)} records to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
