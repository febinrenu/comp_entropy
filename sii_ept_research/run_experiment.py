# -*- coding: utf-8 -*-
"""
Real small-model pilot replication.

For each (prompt, mutation_type) pair at alpha=0.7:
  1. Mutate the prompt with mutation_engine.apply_mutation
  2. Compute SII with mutation_engine.compute_sii
  3. Run ACTUAL inference with a small CPU-only open-weight model
  4. Measure ACTUAL process CPU time (resource.getrusage) and wall time
     (time.perf_counter) -- no synthetic lambda term, no simulation mode.
  5. Estimate energy via the same TDP-proxy formula as the manuscript,
     using an explicitly-labelled generic per-core TDP figure (see caveat
     in output metadata: this sandbox is a virtualized cloud CPU, so this
     is NOT a manufacturer-verified figure for a specific physical chip).

Everything printed/saved is measured by actually running this code.
"""
import argparse
import json
import os
import resource
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from corpus import CORPUS
from mutation_engine import MUTATION_TYPES, apply_mutation, compute_sii, SII_BASE

ALPHA = 0.7
P_TDP_WATTS = 65.0  # generic illustrative figure; see caveat above
MAX_NEW_TOKENS = 40


def load_model(model_name):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    torch.set_num_threads(os.cpu_count() or 1)
    tok = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)
    model.eval()
    return tok, model


def generate_and_measure(tok, model, prompt_text, max_new_tokens=MAX_NEW_TOKENS,
                          temperature=0.7, n_cores=None):
    import torch
    n_cores = n_cores or (os.cpu_count() or 1)
    inputs = tok(prompt_text, return_tensors="pt")
    n_in_tokens = inputs["input_ids"].shape[1]

    ru_before = resource.getrusage(resource.RUSAGE_SELF)
    t0 = time.perf_counter()
    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=temperature,
            top_p=0.95,
            pad_token_id=tok.eos_token_id,
        )
    t1 = time.perf_counter()
    ru_after = resource.getrusage(resource.RUSAGE_SELF)

    wall_time = t1 - t0
    cpu_user = ru_after.ru_utime - ru_before.ru_utime
    cpu_sys = ru_after.ru_stime - ru_before.ru_stime
    cpu_time = cpu_user + cpu_sys

    n_out_tokens = out.shape[1] - n_in_tokens
    n_out_tokens = max(n_out_tokens, 1)

    f_cpu = min(cpu_time / (wall_time * n_cores), 1.0) if wall_time > 0 else 0.0
    energy_joules = P_TDP_WATTS * f_cpu * wall_time
    ept_mj_per_tok = (energy_joules / n_out_tokens) * 1000.0

    text_out = tok.decode(out[0][n_in_tokens:], skip_special_tokens=True)

    return {
        "n_in_tokens": int(n_in_tokens),
        "n_out_tokens": int(n_out_tokens),
        "wall_time": wall_time,
        "cpu_time": cpu_time,
        "f_cpu": f_cpu,
        "energy_joules": energy_joules,
        "ept": ept_mj_per_tok,
        "output_text": text_out,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="distilgpt2")
    ap.add_argument("--n_prompts", type=int, default=60,
                     help="number of base prompts to use (<=60)")
    ap.add_argument("--out", default="measurements.json")
    args = ap.parse_args()

    n_cores = os.cpu_count() or 1
    tok, model = load_model(args.model)

    prompts = CORPUS[:args.n_prompts]
    records = []
    total = len(prompts) * len(MUTATION_TYPES)
    done = 0
    for p in prompts:
        for mtype in MUTATION_TYPES:
            seed = hash((p["id"], mtype)) % (2**31)
            mutated = apply_mutation(p["text"], mtype, ALPHA, seed=seed)
            sii = compute_sii(mutated, p["text"], mtype, ALPHA)
            meas = generate_and_measure(tok, model, mutated, n_cores=n_cores)
            rec = {
                "prompt_id": p["id"],
                "domain": p["domain"],
                "mutation_type": mtype,
                "alpha": ALPHA,
                "baseline_text": p["text"],
                "mutated_text": mutated,
                "sii": sii,
                **meas,
            }
            records.append(rec)
            done += 1
            if done % 20 == 0 or done == total:
                print(f"[{done}/{total}] {mtype:28s} SII={sii:.3f} EPT={meas['ept']:.2f} "
                      f"wall={meas['wall_time']:.3f}s", file=sys.stderr)

    meta = {
        "model": args.model,
        "n_cores": n_cores,
        "p_tdp_watts_caveat": "generic illustrative figure; sandbox CPU is a "
                               "virtualized cloud host, not a verified physical "
                               "chip with a published datasheet TDP",
        "alpha": ALPHA,
        "max_new_tokens": MAX_NEW_TOKENS,
        "n_prompts": len(prompts),
        "n_measurements": len(records),
    }
    with open(args.out, "w") as f:
        json.dump({"meta": meta, "records": records}, f, indent=2)
    print(f"Wrote {len(records)} records to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
