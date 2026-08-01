# -*- coding: utf-8 -*-
"""
Reproducibility script for the paper's Tier-3 repeated-measures analysis,
multiple-comparisons enumeration, and minimum-detectable-effect power
calculation. Fits:
  (1) mixed-effects model, EPT ~ SII (continuous), random intercept for
      prompt_id -- the paper's actual, theory-matching hypothesis test.
  (2) mixed-effects model, EPT ~ C(mutation_type), random intercept for
      prompt_id, compared to an intercept-only null via a likelihood-ratio
      test -- the categorical, repeated-measures-corrected omnibus test.
  (3) ICC = var(random intercept) / (var(random intercept) + var(residual))
      from the intercept-only null model.
  (4) p-values for the two rank-based partial correlations already computed
      in stats_analysis.py (which reports point estimates only), using the
      standard partial-correlation t-test: t = r*sqrt((n-2-k)/(1-r^2)),
      df = n-2-k, k=1 controlled variable.
  (5) minimum detectable |rho| at alpha=0.05, power=0.80, for n=255 (raw)
      and n=120 (length-matched), via the standard Fisher-z power formula
      (Cohen, 1988) -- no new data required.
Run for both Phi-3.5 and Gemma-2 on the "raw" variant (n=255 each).
"""
import json
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.formula.api as smf
import statsmodels.api as sm

MODELS = {
    "phi3.5": "measurements_real_phi3.5.json",
    "gemma2": "measurements_real_gemma2.json",
}


def load_pooled_df(path):
    """Pooled raw + length-matched records (n=255/model), matching the N
    used for PEC/ANOVA/Kruskal-Wallis/Levene elsewhere in the paper."""
    with open(path) as f:
        data = json.load(f)
    recs = data["records"] if isinstance(data, dict) and "records" in data else data
    df = pd.DataFrame(recs)
    return df


def partial_corr_p(r, n, k=1):
    """t-test for a partial correlation coefficient r, n obs, k controls."""
    df = n - 2 - k
    if abs(r) >= 1.0:
        return 0.0, df
    t = r * np.sqrt(df / (1 - r ** 2))
    p = 2 * stats.t.sf(abs(t), df)
    return p, df


def min_detectable_rho(n, alpha=0.05, power=0.80):
    """Fisher-z power formula (Cohen 1988): n = ((z_a/2+z_b)/C)^2 + 3,
    C = atanh(r). Solve for r given n."""
    z_a = stats.norm.ppf(1 - alpha / 2)
    z_b = stats.norm.ppf(power)
    C = (z_a + z_b) / np.sqrt(n - 3)
    r = np.tanh(C)
    return r


def fit_mixed(df):
    d = df.copy()
    d["sii_c"] = d["sii"] - d["sii"].mean()  # center for interpretability
    # (1) continuous SII fixed effect, random intercept for prompt
    md_cont = smf.mixedlm("ept ~ sii_c", d, groups=d["prompt_id"])
    res_cont = md_cont.fit(reml=False)
    coef = res_cont.params["sii_c"]
    se = res_cont.bse["sii_c"]
    z = res_cont.tvalues["sii_c"]
    p = res_cont.pvalues["sii_c"]
    ci_lo, ci_hi = coef - 1.96 * se, coef + 1.96 * se

    # (2) categorical mutation_type fixed effect, random intercept for prompt
    # reference level = baseline
    d["mutation_type"] = pd.Categorical(
        d["mutation_type"],
        categories=["baseline", "noise_typo", "noise_verbose", "formality_shift",
                    "code_switching", "ambiguity_semantic", "negation",
                    "reordering", "ambiguity_contradiction"],
    )
    md_full = smf.mixedlm("ept ~ C(mutation_type)", d, groups=d["prompt_id"])
    res_full = md_full.fit(reml=False)
    md_null = smf.mixedlm("ept ~ 1", d, groups=d["prompt_id"])
    res_null = md_null.fit(reml=False)
    lr_stat = 2 * (res_full.llf - res_null.llf)
    df_diff = int(res_full.df_modelwc - res_null.df_modelwc)
    lr_p = stats.chi2.sf(lr_stat, df_diff)

    # (3) ICC from null (intercept-only) model
    var_re = float(res_null.cov_re.iloc[0, 0])
    var_resid = float(res_null.scale)
    icc = var_re / (var_re + var_resid)

    return {
        "continuous_sii": {
            "coef": float(coef), "se": float(se), "z": float(z), "p": float(p),
            "ci95": [float(ci_lo), float(ci_hi)],
            "units": "mJ/token per 1-unit increase in (mean-centered) SII",
        },
        "categorical_mutation_type": {
            "lr_chi2": float(lr_stat), "df": df_diff, "p": float(lr_p),
        },
        "icc_prompt_level": float(icc),
    }


if __name__ == "__main__":
    out = {}
    stats_files = {"phi3.5": "stats_results_real_phi3.5.json",
                   "gemma2": "stats_results_real_gemma2.json"}

    for model_name, path in MODELS.items():
        df = load_pooled_df(path)
        n = len(df)
        mixed = fit_mixed(df)

        with open(stats_files[model_name]) as f:
            sres = json.load(f)
        r_partial = sres["partial_sii_ept_given_input_tokens"]
        p_partial, df_partial = partial_corr_p(r_partial, n, k=1)

        out[model_name] = {
            "n_pooled": n,
            "mixed_effects": mixed,
            "partial_corr_given_input_tokens": {
                "r": r_partial, "p": p_partial, "df": df_partial,
            },
        }

    # minimum detectable |rho|, no new data needed
    out["power"] = {
        "n_raw_255": {"min_detectable_abs_rho": float(min_detectable_rho(255))},
        "n_length_matched_120": {"min_detectable_abs_rho": float(min_detectable_rho(120))},
        "alpha": 0.05, "power": 0.80,
        "method": "Fisher z-transform power formula (Cohen, 1988)",
    }

    print(json.dumps(out, indent=2))
    with open("mixed_effects_results.json", "w") as f:
        json.dump(out, f, indent=2)
