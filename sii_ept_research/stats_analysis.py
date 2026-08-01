# -*- coding: utf-8 -*-
"""
Statistical protocol matching the manuscript: Spearman PEC, one-way ANOVA
with eta^2/omega^2, Kruskal-Wallis, Cohen's d, and a bootstrap CI for PEC.
Run on real measured data (no synthetic terms).

Extended for the real-hardware replication (run_experiment_real.py):
  - partial_corr_given_tokens(): the paper's prose says the numpy pilot's
    partial correlation "conditions on input token count", but the
    original run_full_analysis() below actually conditions on wall time.
    Both are now computed and separately labeled -- not conflated.
  - wilcoxon_raw_vs_matched(): a paired test between raw-mutated and
    length-matched EPT for the same (prompt, mutation_type), a more
    direct causal probe of length-mediation than partial correlation.
  - CLI now reads the actual {"meta":...,"records":[...]} file format
    (the original CLI here had a bug: it called json.load(f) expecting a
    bare list, but every file this codebase actually writes wraps records
    in a "meta"/"records" dict) and supports --filter-model/--filter-variant.
"""
import argparse
import json
import sys

import numpy as np
from scipy import stats

from mutation_engine import SII_BASE


def bootstrap_spearman_ci(x, y, n_boot=10000, seed=42):
    rng = np.random.default_rng(seed)
    n = len(x)
    x = np.asarray(x)
    y = np.asarray(y)
    boots = np.empty(n_boot)
    for i in range(n_boot):
        idx = rng.integers(0, n, n)
        rho, _ = stats.spearmanr(x[idx], y[idx])
        boots[i] = rho
    lo, hi = np.percentile(boots, [2.5, 97.5])
    return lo, hi


def cohens_d(a, b):
    a = np.asarray(a); b = np.asarray(b)
    na, nb = len(a), len(b)
    pooled_sd = np.sqrt(((na - 1) * a.var(ddof=1) + (nb - 1) * b.var(ddof=1)) / (na + nb - 2))
    return (a.mean() - b.mean()) / pooled_sd


def eta_omega_squared(groups):
    """groups: list of arrays, one per condition."""
    all_vals = np.concatenate(groups)
    grand_mean = all_vals.mean()
    k = len(groups)
    N = len(all_vals)
    ss_between = sum(len(g) * (g.mean() - grand_mean) ** 2 for g in groups)
    ss_within = sum(((g - g.mean()) ** 2).sum() for g in groups)
    ss_total = ss_between + ss_within
    df_between = k - 1
    df_within = N - k
    ms_between = ss_between / df_between
    ms_within = ss_within / df_within
    F = ms_between / ms_within
    p = stats.f.sf(F, df_between, df_within)
    eta2 = ss_between / ss_total
    omega2 = (ss_between - df_between * ms_within) / (ss_total + ms_within)
    return {
        "ss_between": ss_between, "ss_within": ss_within, "ss_total": ss_total,
        "df_between": df_between, "df_within": df_within,
        "ms_between": ms_between, "ms_within": ms_within,
        "F": F, "p": p, "eta2": eta2, "omega2": omega2,
    }


def _rank_partial_corr(a, b, c):
    """Rank-based partial correlation of a & b, controlling for c."""
    def rankdata(v):
        return stats.rankdata(v)
    r_ab, _ = stats.pearsonr(rankdata(a), rankdata(b))
    r_ac, _ = stats.pearsonr(rankdata(a), rankdata(c))
    r_bc, _ = stats.pearsonr(rankdata(b), rankdata(c))
    denom = np.sqrt((1 - r_ac ** 2) * (1 - r_bc ** 2))
    return (r_ab - r_ac * r_bc) / denom if denom != 0 else float("nan")


def partial_corr_given_tokens(records, sii_key="sii", ept_key="ept"):
    """Partial Spearman(SII, EPT) controlling for INPUT token count
    (n_in_tokens) -- this is what the paper's prose describes, distinct
    from the wall-time partial already computed in run_full_analysis."""
    sii = [r[sii_key] for r in records]
    ept = [r[ept_key] for r in records]
    tokens = [r["n_in_tokens"] for r in records]
    return _rank_partial_corr(sii, ept, tokens)


def wilcoxon_raw_vs_matched(records, ept_key="ept"):
    """Paired Wilcoxon signed-rank test between raw-mutated and
    length-matched EPT for the same (prompt_id, mutation_type) pair.
    A direct causal probe of length-mediation: if EPT differences are
    driven by length, raw and length-matched EPT should differ
    systematically for non-baseline conditions."""
    by_key = {}
    for r in records:
        if r.get("mutation_type") == "baseline":
            continue
        key = (r["prompt_id"], r["mutation_type"])
        by_key.setdefault(key, {})[r.get("variant")] = r[ept_key]

    raw_vals, matched_vals = [], []
    for key, variants in by_key.items():
        if "raw" in variants and "length_matched" in variants:
            raw_vals.append(variants["raw"])
            matched_vals.append(variants["length_matched"])

    if len(raw_vals) < 2:
        return {"n_pairs": len(raw_vals), "statistic": None, "p": None,
                "mean_diff_raw_minus_matched": None}

    stat, p = stats.wilcoxon(raw_vals, matched_vals)
    mean_diff = float(np.mean(np.array(raw_vals) - np.array(matched_vals)))
    return {"n_pairs": len(raw_vals), "statistic": float(stat), "p": float(p),
            "mean_diff_raw_minus_matched": mean_diff}


def run_full_analysis(records, sii_key="sii", ept_key="ept", cond_key="mutation_type"):
    sii = [r[sii_key] for r in records]
    ept = [r[ept_key] for r in records]
    tokens = [r["n_out_tokens"] for r in records]
    walltime = [r["wall_time"] for r in records]

    rho, p_pec = stats.spearmanr(sii, ept)
    ci_lo, ci_hi = bootstrap_spearman_ci(sii, ept)

    rho_tokens, p_tokens = stats.spearmanr(tokens, ept)
    rho_time, p_time = stats.spearmanr(walltime, ept)
    rho_sii_tokens, p_sii_tokens = stats.spearmanr(sii, tokens)
    rho_sii_time, p_sii_time = stats.spearmanr(sii, walltime)

    # partial spearman of SII-EPT controlling for wall time (rank partial corr)
    partial_given_time = _rank_partial_corr(sii, ept, walltime)
    # partial spearman of SII-EPT controlling for INPUT token count -- what
    # the paper's prose actually describes; computed separately, not
    # conflated with the wall-time partial above
    partial_given_in_tokens = None
    if all("n_in_tokens" in r for r in records):
        partial_given_in_tokens = partial_corr_given_tokens(records, sii_key, ept_key)

    conditions = sorted(set(r[cond_key] for r in records),
                         key=lambda m: SII_BASE.get(m, 0.0))
    groups = [np.array([r[ept_key] for r in records if r[cond_key] == c]) for c in conditions]
    anova = eta_omega_squared(groups)
    H, p_kw = stats.kruskal(*groups)
    levene_stat, levene_p = stats.levene(*groups)

    baseline_group = np.array([r[ept_key] for r in records if r[cond_key] == "baseline"])
    contra_group = np.array([r[ept_key] for r in records if r[cond_key] == "ambiguity_contradiction"])
    d_baseline_contra = cohens_d(contra_group, baseline_group) if len(contra_group) and len(baseline_group) else None

    means = {c: float(np.mean([r[ept_key] for r in records if r[cond_key] == c])) for c in conditions}
    sds = {c: float(np.std([r[ept_key] for r in records if r[cond_key] == c], ddof=1)) for c in conditions}

    result = {
        "n": len(records),
        "pec": rho, "pec_p": p_pec, "pec_ci": [ci_lo, ci_hi],
        "tokens_ept_rho": rho_tokens, "tokens_ept_p": p_tokens,
        "time_ept_rho": rho_time, "time_ept_p": p_time,
        "sii_tokens_rho": rho_sii_tokens, "sii_tokens_p": p_sii_tokens,
        "sii_time_rho": rho_sii_time, "sii_time_p": p_sii_time,
        "partial_sii_ept_given_time": partial_given_time,
        "partial_sii_ept_given_input_tokens": partial_given_in_tokens,
        "anova": anova, "kruskal_H": H, "kruskal_p": p_kw,
        "levene_stat": levene_stat, "levene_p": levene_p,
        "cohens_d_baseline_vs_contradiction": d_baseline_contra,
        "condition_means": means, "condition_sds": sds,
        "condition_order": conditions,
    }

    if any(r.get("variant") for r in records):
        result["wilcoxon_raw_vs_length_matched"] = wilcoxon_raw_vs_matched(records, ept_key)

    return result


def _load_records(path):
    with open(path) as f:
        data = json.load(f)
    # actual files written by run_experiment_numpy.py / run_experiment_real.py
    # wrap records in {"meta":...,"records":[...]}; support a bare list too
    # for backward compatibility with any hand-built input.
    return data["records"] if isinstance(data, dict) and "records" in data else data


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?", default="measurements.json")
    ap.add_argument("--filter-model", default=None)
    ap.add_argument("--filter-variant", choices=["raw", "length_matched", "all"], default="all")
    args = ap.parse_args()

    records = _load_records(args.path)
    if args.filter_model:
        records = [r for r in records if r.get("model") == args.filter_model]
    if args.filter_variant != "all":
        records = [r for r in records if r.get("variant", "raw") == args.filter_variant
                   or r.get("mutation_type") == "baseline"]

    result = run_full_analysis(records)
    print(json.dumps(result, indent=2, default=float))
