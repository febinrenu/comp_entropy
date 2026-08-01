# -*- coding: utf-8 -*-
"""
Sensitivity analysis for the SII coefficients (gamma, delta, epsilon, b_m).

Uses the REAL measured EPT values from measurements.json (energy does not
change), and only re-derives SII under perturbed coefficients, then
recomputes PEC (Spearman) and the condition-ordering agreement each time.
This directly answers the reviewer request: "vary every coefficient, show
correlation/ordering remains."
"""
import copy
import json
import sys

import numpy as np
from scipy import stats

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from mutation_engine import compute_sii, SII_BASE, GAMMA, DELTA, EPSILON


def recompute_sii_for_records(records, gamma, delta, epsilon, base_scores):
    new_records = []
    for r in records:
        sii = compute_sii(
            r["mutated_text"], r["baseline_text"], r["mutation_type"],
            r["alpha"], gamma=gamma, delta=delta, epsilon=epsilon,
            base_scores=base_scores,
        )
        nr = dict(r)
        nr["sii"] = sii
        new_records.append(nr)
    return new_records


def condition_order_matches(records, base_scores):
    """Spearman rank correlation between condition mean-EPT rank and the
    a priori b_m rank (i.e., does empirical ordering match the assumed
    theoretical ordering under these coefficients)."""
    conds = sorted(base_scores.keys(), key=lambda m: base_scores[m])
    theo_rank = {c: i for i, c in enumerate(conds)}
    means = {}
    for c in conds:
        vals = [r["ept"] for r in records if r["mutation_type"] == c]
        means[c] = float(np.mean(vals)) if vals else float("nan")
    emp_rank_order = sorted(conds, key=lambda c: means[c])
    emp_rank = {c: i for i, c in enumerate(emp_rank_order)}
    theo = [theo_rank[c] for c in conds]
    emp = [emp_rank[c] for c in conds]
    rho, _ = stats.spearmanr(theo, emp)
    n_inversions = sum(1 for c in conds if theo_rank[c] != emp_rank[c])
    return rho, n_inversions, means


def run_sensitivity(records_path, out_path, n_random_draws=200, pct_range=0.3, seed=7):
    with open(records_path) as f:
        data = json.load(f)
    records = data["records"]

    rng = np.random.default_rng(seed)
    results = []

    # 1. Baseline (paper's stated coefficients)
    base_sii_records = recompute_sii_for_records(records, GAMMA, DELTA, EPSILON, SII_BASE)
    rho_base, p_base = stats.spearmanr(
        [r["sii"] for r in base_sii_records], [r["ept"] for r in base_sii_records])
    order_rho_base, inv_base, means_base = condition_order_matches(base_sii_records, SII_BASE)
    results.append({
        "condition": "paper_stated_coefficients",
        "gamma": GAMMA, "delta": DELTA, "epsilon": EPSILON,
        "b_m_scale": 1.0,
        "pec": rho_base, "pec_p": p_base,
        "order_rho": order_rho_base, "n_inversions": inv_base,
    })

    # 2. One-at-a-time perturbations of gamma, delta, epsilon at +/-pct_range
    for name, base_val in [("gamma", GAMMA), ("delta", DELTA), ("epsilon", EPSILON)]:
        for sign, label in [(-1, "minus"), (1, "plus")]:
            kwargs = {"gamma": GAMMA, "delta": DELTA, "epsilon": EPSILON}
            kwargs[name] = base_val * (1 + sign * pct_range)
            recs = recompute_sii_for_records(records, kwargs["gamma"], kwargs["delta"],
                                              kwargs["epsilon"], SII_BASE)
            rho, p = stats.spearmanr([r["sii"] for r in recs], [r["ept"] for r in recs])
            order_rho, inv, _ = condition_order_matches(recs, SII_BASE)
            results.append({
                "condition": f"{name}_{label}{int(pct_range*100)}pct",
                "gamma": kwargs["gamma"], "delta": kwargs["delta"], "epsilon": kwargs["epsilon"],
                "b_m_scale": 1.0,
                "pec": rho, "pec_p": p,
                "order_rho": order_rho, "n_inversions": inv,
            })

    # 3. Perturb all b_m simultaneously by a global scale factor
    for scale in [1 - pct_range, 1 + pct_range]:
        scaled_base = {k: v * scale for k, v in SII_BASE.items()}
        recs = recompute_sii_for_records(records, GAMMA, DELTA, EPSILON, scaled_base)
        rho, p = stats.spearmanr([r["sii"] for r in recs], [r["ept"] for r in recs])
        order_rho, inv, _ = condition_order_matches(recs, scaled_base)
        results.append({
            "condition": f"b_m_scale_{scale:.2f}",
            "gamma": GAMMA, "delta": DELTA, "epsilon": EPSILON,
            "b_m_scale": scale,
            "pec": rho, "pec_p": p,
            "order_rho": order_rho, "n_inversions": inv,
        })

    # 4. Random joint perturbation sweep (Monte Carlo robustness check)
    random_pecs = []
    random_order_rhos = []
    for _ in range(n_random_draws):
        g = GAMMA * (1 + rng.uniform(-pct_range, pct_range))
        d = DELTA * (1 + rng.uniform(-pct_range, pct_range))
        e = EPSILON * (1 + rng.uniform(-pct_range, pct_range))
        b_scaled = {k: v * (1 + rng.uniform(-pct_range, pct_range)) for k, v in SII_BASE.items()}
        recs = recompute_sii_for_records(records, g, d, e, b_scaled)
        rho, p = stats.spearmanr([r["sii"] for r in recs], [r["ept"] for r in recs])
        order_rho, inv, _ = condition_order_matches(recs, b_scaled)
        random_pecs.append(rho)
        random_order_rhos.append(order_rho)

    summary = {
        "per_condition_results": results,
        "baseline_condition_means_ept": means_base,
        "random_sweep": {
            "n_draws": n_random_draws,
            "pct_range": pct_range,
            "pec_mean": float(np.mean(random_pecs)),
            "pec_sd": float(np.std(random_pecs)),
            "pec_min": float(np.min(random_pecs)),
            "pec_max": float(np.max(random_pecs)),
            "order_rho_mean": float(np.mean(random_order_rhos)),
            "order_rho_min": float(np.min(random_order_rhos)),
            "pct_draws_pec_above_0.30": float(np.mean(np.array(random_pecs) > 0.30)),
        },
    }
    with open(out_path, "w") as f:
        json.dump(summary, f, indent=2, default=float)
    print(json.dumps(summary, indent=2, default=float))


if __name__ == "__main__":
    records_path = sys.argv[1] if len(sys.argv) > 1 else "measurements.json"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "sensitivity_results.json"
    run_sensitivity(records_path, out_path)
