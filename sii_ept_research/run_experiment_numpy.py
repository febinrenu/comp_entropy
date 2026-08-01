# -*- coding: utf-8 -*-
"""
Real pilot replication using the NumPy Transformer (numpy_transformer.py)
in place of a pretrained HF model, because this sandbox blocks
huggingface.co / pytorch.org at the network layer (confirmed 403
"blocked-by-allowlist") and the torch wheel (>500MB) does not fit this
sandbox's per-command time budget.

Every timing number below comes from an actual executed forward pass on
this machine's real CPU (time.perf_counter + resource.getrusage). Nothing
here is simulated or invented. The explicit limitation -- random,
untrained weights, so outputs are not semantically meaningful -- is
carried into the paper writeup, not hidden.
"""
import argparse
import json
import os
import resource
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from corpus import CORPUS
from mutation_engine import MUTATION_TYPES, apply_mutation, compute_sii
import numpy_transformer as nt

ALPHA = 0.7
P_TDP_WATTS = 65.0
MAX_NEW_TOKENS = 40


def generate_and_measure(prompt_text, seed, n_cores):
    ru_before = resource.getrusage(resource.RUSAGE_SELF)
    t0 = time.perf_counter()
    result = nt.generate(prompt_text, max_new_tokens=MAX_NEW_TOKENS,
                          temperature=0.7, top_p=0.95, seed=seed)
    t1 = time.perf_counter()
    ru_after = resource.getrusage(resource.RUSAGE_SELF)

    wall_time = t1 - t0
    cpu_time = (ru_after.ru_utime - ru_before.ru_utime) + (ru_after.ru_stime - ru_before.ru_stime)
    n_out_tokens = max(result["n_out_tokens"], 1)
    f_cpu = min(cpu_time / (wall_time * n_cores), 1.0) if wall_time > 0 else 0.0
    energy_joules = P_TDP_WATTS * f_cpu * wall_time
    ept = (energy_joules / n_out_tokens) * 1000.0

    return {
        "n_in_tokens": result["n_in_tokens"],
        "n_out_tokens": n_out_tokens,
        "wall_time": wall_time,
        "cpu_time": cpu_time,
        "f_cpu": f_cpu,
        "energy_joules": energy_joules,
        "ept": ept,
        "output_text": result["output_text"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n_prompts", type=int, default=60)
    ap.add_argument("--out", default="measurements_numpy.json")
    args = ap.parse_args()

    n_cores = os.cpu_count() or 1
    prompts = CORPUS[:args.n_prompts]
    records = []
    total = len(prompts) * len(MUTATION_TYPES)
    done = 0
    t_start = time.perf_counter()
    for p in prompts:
        for mtype in MUTATION_TYPES:
            seed = hash((p["id"], mtype)) % (2**31)
            mutated = apply_mutation(p["text"], mtype, ALPHA, seed=seed)
            sii = compute_sii(mutated, p["text"], mtype, ALPHA)
            meas = generate_and_measure(mutated, seed=seed, n_cores=n_cores)
            rec = {
                "prompt_id": p["id"], "domain": p["domain"], "mutation_type": mtype,
                "alpha": ALPHA, "baseline_text": p["text"], "mutated_text": mutated,
                "sii": sii, **meas,
            }
            records.append(rec)
            done += 1
            if done % 60 == 0 or done == total:
                elapsed = time.perf_counter() - t_start
                print(f"[{done}/{total}] elapsed={elapsed:.1f}s last_mtype={mtype} "
                      f"SII={sii:.3f} EPT={meas['ept']:.4f}", file=sys.stderr)

    meta = {
        "model": "numpy_transformer (random-init, untrained; see numpy_transformer.py docstring)",
        "n_cores": n_cores,
        "p_tdp_watts_caveat": "generic illustrative figure; sandbox CPU is a virtualized "
                               "cloud host, not a verified physical chip with a published TDP",
        "alpha": ALPHA, "max_new_tokens": MAX_NEW_TOKENS,
        "n_prompts": len(prompts), "n_measurements": len(records),
        "limitation": "weights are randomly initialised; no internet access to pretrained "
                      "model hubs (huggingface.co / pytorch.org) was available in this "
                      "sandboxed environment. Results test the architectural/context-length "
                      "component of EPT, not semantic-understanding effects.",
    }
    with open(args.out, "w") as f:
        json.dump({"meta": meta, "records": records}, f, indent=2)
    total_elapsed = time.perf_counter() - t_start
    print(f"Wrote {len(records)} records to {args.out} in {total_elapsed:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
