# -*- coding: utf-8 -*-
"""
Real execution of the semantic-entropy (S_c) validation pilot.

The original sc_pilot.py was never actually run in the prior pilot (no
internet access to huggingface.co for distilgpt2 or the NLI model). This
version reuses its clustering/entropy logic verbatim (bidirectional_entails,
cluster_outputs, semantic_entropy) but swaps the generator for the same
Ollama-served instruction-tuned models used in run_experiment_real.py, via
k=5 independent sampling calls at temperature 0.7.
"""
import argparse
import json
import sys

from corpus import CORPUS
from mutation_engine import apply_mutation, compute_sii
from sc_pilot import bidirectional_entails, cluster_outputs, semantic_entropy, load_nli
from stats_analysis import bootstrap_spearman_ci
import ollama_backend

ALPHA = 0.7
K_SAMPLES = 5
DEFAULT_CONDITIONS = [
    "baseline", "noise_typo", "ambiguity_semantic", "negation",
    "reordering", "ambiguity_contradiction",
]


def sample_k_outputs_ollama(model_tag, prompt_text, k=K_SAMPLES, max_new_tokens=64,
                             temperature=0.7):
    outs = []
    for i in range(k):
        resp = ollama_backend.generate(model_tag, prompt_text, max_new_tokens=max_new_tokens,
                                        temperature=temperature, top_p=0.95, seed=None)
        text = resp["response"].strip()
        outs.append(text or "(empty)")
    return outs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=["phi3.5", "gemma2"])
    ap.add_argument("--n_prompts", type=int, default=10)
    ap.add_argument("--conditions", nargs="+", default=DEFAULT_CONDITIONS)
    ap.add_argument("--k", type=int, default=K_SAMPLES)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    model_tag = ollama_backend.MODEL_TAGS[args.model]
    out_path = args.out or f"sc_pilot_results_{args.model}.json"

    ollama_backend.check_server()
    ollama_backend.warm_up(model_tag)
    nli = load_nli()

    prompts = CORPUS[:args.n_prompts]
    records = []
    total = len(prompts) * len(args.conditions)
    done = 0
    for p in prompts:
        for mtype in args.conditions:
            seed = hash((p["id"], mtype, "sc")) % (2 ** 31)
            mutated = apply_mutation(p["text"], mtype, ALPHA, seed=seed)
            sii = compute_sii(mutated, p["text"], mtype, ALPHA)
            outs = sample_k_outputs_ollama(model_tag, mutated, k=args.k)
            clusters = cluster_outputs(nli, outs)
            sc = semantic_entropy(clusters, args.k)
            records.append({
                "prompt_id": p["id"], "mutation_type": mtype, "sii": sii,
                "sc": sc, "n_clusters": len(clusters), "k": args.k,
                "outputs": outs,
            })
            done += 1
            print(f"[{args.model}] [{done}/{total}] {mtype:24s} SII={sii:.3f} Sc={sc:.3f} "
                  f"clusters={len(clusters)}/{args.k}", file=sys.stderr)

    from scipy import stats
    sii_vals = [r["sii"] for r in records]
    sc_vals = [r["sc"] for r in records]
    rho, p_val = stats.spearmanr(sii_vals, sc_vals)
    ci_lo, ci_hi = bootstrap_spearman_ci(sii_vals, sc_vals)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "model": args.model, "ollama_tag": model_tag,
            "records": records,
            "n": len(records),
            "spearman_sii_sc": rho,
            "spearman_sii_sc_p": p_val,
            "spearman_sii_sc_ci": [ci_lo, ci_hi],
            "note": "Real execution (unlike the prior pilot's unrun sc_pilot.py): "
                    f"k={args.k} samples/prompt from an instruction-tuned model served "
                    "via Ollama, real bidirectional-NLI clustering "
                    "(cross-encoder/nli-deberta-v3-xsmall). Small subset "
                    f"({len(prompts)} prompts x {len(args.conditions)} conditions) -- "
                    "a directional proof-of-concept, not a validation against a "
                    "frontier model.",
        }, f, indent=2, default=float)
    print(f"\n[{args.model}] Spearman(SII, Sc) = {rho:.3f}, p = {p_val:.4f}, "
          f"CI=[{ci_lo:.3f},{ci_hi:.3f}], n = {len(records)}")


if __name__ == "__main__":
    main()
