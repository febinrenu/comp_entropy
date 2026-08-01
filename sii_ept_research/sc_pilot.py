# -*- coding: utf-8 -*-
"""
Small-scale pilot: does the single-pass SII proxy track actual Computational
Entropy (S_c), measured via semantic-entropy clustering (Kuhn et al. 2023)?

For a reduced subset of prompts (default 20, one per condition x ~2 domains,
matching the reviewer's suggested pilot scale):
  1. Generate k independent samples per (mutated) prompt at temperature 0.7
     with the SAME small model used in run_experiment.py.
  2. Cluster the k samples into semantic-equivalence classes using a
     lightweight NLI entailment model (bidirectional entailment => same
     cluster), following Kuhn et al.'s clustering rule.
  3. Compute S_c(x) = -sum P(C_i|x) log2 P(C_i|x) over the resulting clusters.
  4. Correlate S_c with SII across the subset.

This is explicitly a small, CPU-only, small-model pilot -- not a validation
of SII against a frontier model. It is reported as such.
"""
import argparse
import itertools
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from corpus import CORPUS
from mutation_engine import MUTATION_TYPES, apply_mutation, compute_sii

ALPHA = 0.7
K_SAMPLES = 5
ENTAILMENT_THRESHOLD = 0.5  # P(entailment) above this counts as "entails"


def load_generator(model_name):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    torch.set_num_threads(os.cpu_count() or 1)
    tok = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)
    model.eval()
    return tok, model


def load_nli(model_name="cross-encoder/nli-deberta-v3-xsmall"):
    from sentence_transformers import CrossEncoder
    return CrossEncoder(model_name)


def sample_k_outputs(tok, model, prompt_text, k=K_SAMPLES, max_new_tokens=40, temperature=0.7):
    import torch
    inputs = tok(prompt_text, return_tensors="pt")
    outs = []
    for _ in range(k):
        with torch.no_grad():
            out = model.generate(
                **inputs, max_new_tokens=max_new_tokens, do_sample=True,
                temperature=temperature, top_p=0.95, pad_token_id=tok.eos_token_id,
            )
        text = tok.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
        outs.append(text.strip() or "(empty)")
    return outs


def bidirectional_entails(nli, a, b):
    # cross-encoder/nli-* models return [contradiction, entailment, neutral]
    # or similar; we check both directions and require entailment-like label
    # in each direction above threshold.
    scores_ab = nli.predict([(a, b)])[0]
    scores_ba = nli.predict([(b, a)])[0]
    # label order for nli-deberta-v3-xsmall: ['contradiction','entailment','neutral']
    ent_ab = scores_ab[1]
    ent_ba = scores_ba[1]
    return ent_ab > ENTAILMENT_THRESHOLD and ent_ba > ENTAILMENT_THRESHOLD


def cluster_outputs(nli, outputs):
    clusters = []  # list of lists of indices
    for i, text in enumerate(outputs):
        placed = False
        for cluster in clusters:
            rep = outputs[cluster[0]]
            if bidirectional_entails(nli, text, rep):
                cluster.append(i)
                placed = True
                break
        if not placed:
            clusters.append([i])
    return clusters


def semantic_entropy(clusters, k):
    import math
    probs = [len(c) / k for c in clusters]
    return -sum(p * math.log2(p) for p in probs if p > 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="distilgpt2")
    ap.add_argument("--n_prompts", type=int, default=4,
                     help="base prompts to sample per condition-subset (kept small)")
    ap.add_argument("--conditions", nargs="+", default=[
        "baseline", "noise_typo", "ambiguity_semantic", "negation",
        "reordering", "ambiguity_contradiction",
    ])
    ap.add_argument("--k", type=int, default=K_SAMPLES)
    ap.add_argument("--out", default="sc_pilot_results.json")
    args = ap.parse_args()

    tok, model = load_generator(args.model)
    nli = load_nli()

    prompts = CORPUS[: args.n_prompts]
    records = []
    total = len(prompts) * len(args.conditions)
    done = 0
    for p in prompts:
        for mtype in args.conditions:
            seed = hash((p["id"], mtype, "sc")) % (2**31)
            mutated = apply_mutation(p["text"], mtype, ALPHA, seed=seed)
            sii = compute_sii(mutated, p["text"], mtype, ALPHA)
            outs = sample_k_outputs(tok, model, mutated, k=args.k)
            clusters = cluster_outputs(nli, outs)
            sc = semantic_entropy(clusters, args.k)
            records.append({
                "prompt_id": p["id"], "mutation_type": mtype, "sii": sii,
                "sc": sc, "n_clusters": len(clusters), "k": args.k,
                "outputs": outs,
            })
            done += 1
            print(f"[{done}/{total}] {mtype:24s} SII={sii:.3f} Sc={sc:.3f} "
                  f"clusters={len(clusters)}/{args.k}", file=sys.stderr)

    from scipy import stats
    sii_vals = [r["sii"] for r in records]
    sc_vals = [r["sc"] for r in records]
    rho, p_val = stats.spearmanr(sii_vals, sc_vals)

    with open(args.out, "w") as f:
        json.dump({
            "records": records,
            "n": len(records),
            "spearman_sii_sc": rho,
            "spearman_sii_sc_p": p_val,
            "note": "Small CPU-only pilot with a small open-weight model and "
                    "k={} samples/prompt; NOT a validation against a frontier "
                    "model. Reported as a directional proof-of-concept only.".format(args.k),
        }, f, indent=2, default=float)
    print(f"\nSpearman(SII, Sc) = {rho:.3f}, p = {p_val:.4f}, n = {len(records)}")


if __name__ == "__main__":
    main()
