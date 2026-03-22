"""
Analysis Engine
===============

Comprehensive statistical analysis for computational entropy research.
Provides correlation analysis, ANOVA, effect sizes, and publication-ready outputs.
"""

import numpy as np
from scipy import stats
from scipy.stats import pearsonr, spearmanr, kendalltau, f_oneway, kruskal
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import warnings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models import Experiment, Prompt, Measurement, AnalysisResult, AnalysisType


@dataclass
class CorrelationResult:
    """Result of correlation analysis."""
    variable_1: str
    variable_2: str
    method: str
    correlation: float
    p_value: float
    ci_lower: float
    ci_upper: float
    n_samples: int
    is_significant: bool
    
    def to_dict(self) -> Dict:
        return {
            "variable_1": self.variable_1,
            "variable_2": self.variable_2,
            "method": self.method,
            "correlation": self.correlation,
            "p_value": self.p_value,
            "ci_lower": self.ci_lower,
            "ci_upper": self.ci_upper,
            "n_samples": self.n_samples,
            "is_significant": self.is_significant
        }


@dataclass
class EffectSizeResult:
    """Result of effect size calculation."""
    comparison: str
    cohens_d: float
    hedges_g: float
    interpretation: str
    ci_lower: float
    ci_upper: float
    
    def to_dict(self) -> Dict:
        return {
            "comparison": self.comparison,
            "cohens_d": self.cohens_d,
            "hedges_g": self.hedges_g,
            "interpretation": self.interpretation,
            "ci_lower": self.ci_lower,
            "ci_upper": self.ci_upper
        }


class AnalysisEngine:
    """
    Statistical analysis engine for computational entropy research.
    
    Provides:
    - Correlation analysis (Pearson, Spearman, Kendall)
    - ANOVA with post-hoc tests
    - Effect size calculations (Cohen's d, Hedge's g, η²)
    - Bootstrap confidence intervals
    - Publication-ready LaTeX output
    """
    
    ALPHA = 0.05  # Significance threshold

    @staticmethod
    def mutation_type_to_str(value: Any) -> str:
        """Convert enum/string mutation type to plain string value."""
        return value.value if hasattr(value, "value") else str(value)
    
    @staticmethod
    def interpret_correlation(r: float) -> str:
        """Interpret correlation coefficient magnitude."""
        r_abs = abs(r)
        if r_abs < 0.1:
            return "negligible"
        elif r_abs < 0.3:
            return "weak"
        elif r_abs < 0.5:
            return "moderate"
        elif r_abs < 0.7:
            return "strong"
        else:
            return "very strong"
    
    @staticmethod
    def interpret_cohens_d(d: float) -> str:
        """Interpret Cohen's d effect size."""
        d_abs = abs(d)
        if d_abs < 0.2:
            return "negligible"
        elif d_abs < 0.5:
            return "small"
        elif d_abs < 0.8:
            return "medium"
        else:
            return "large"
    
    @staticmethod
    def cohens_d(group1: np.ndarray, group2: np.ndarray) -> Tuple[float, float, float]:
        """
        Calculate Cohen's d with confidence interval.
        
        Returns: (d, ci_lower, ci_upper)
        """
        n1, n2 = len(group1), len(group2)
        var1, var2 = np.var(group1, ddof=1), np.var(group2, ddof=1)
        
        # Pooled standard deviation
        pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
        
        if pooled_std == 0:
            return 0.0, 0.0, 0.0
        
        d = (np.mean(group1) - np.mean(group2)) / pooled_std
        
        # Confidence interval (approximation)
        se = np.sqrt((n1 + n2) / (n1 * n2) + d**2 / (2 * (n1 + n2)))
        ci_lower = d - 1.96 * se
        ci_upper = d + 1.96 * se
        
        return d, ci_lower, ci_upper
    
    @staticmethod
    def hedges_g(group1: np.ndarray, group2: np.ndarray) -> float:
        """Calculate Hedge's g (bias-corrected Cohen's d)."""
        d, _, _ = AnalysisEngine.cohens_d(group1, group2)
        n = len(group1) + len(group2)
        
        # Correction factor
        correction = 1 - (3 / (4 * n - 9))
        return d * correction
    
    @staticmethod
    def bootstrap_ci(
        data: np.ndarray, 
        statistic_func: callable,
        n_bootstrap: int = 10000,
        ci_level: float = 0.95
    ) -> Tuple[float, float]:
        """
        Calculate bootstrap confidence interval.
        
        Args:
            data: Input data array
            statistic_func: Function to compute statistic
            n_bootstrap: Number of bootstrap samples
            ci_level: Confidence level
            
        Returns:
            (ci_lower, ci_upper)
        """
        n = len(data)
        bootstrap_stats = []
        
        for _ in range(n_bootstrap):
            sample = np.random.choice(data, size=n, replace=True)
            bootstrap_stats.append(statistic_func(sample))
        
        alpha = 1 - ci_level
        ci_lower = np.percentile(bootstrap_stats, alpha / 2 * 100)
        ci_upper = np.percentile(bootstrap_stats, (1 - alpha / 2) * 100)
        
        return ci_lower, ci_upper
    
    @staticmethod
    def correlation_with_ci(
        x: np.ndarray, 
        y: np.ndarray, 
        method: str = "pearson"
    ) -> CorrelationResult:
        """
        Calculate correlation with confidence interval.
        """
        x = np.asarray(x, dtype=float)
        y = np.asarray(y, dtype=float)

        # Align to shortest length if callers passed mismatched arrays.
        if len(x) != len(y):
            n_common = min(len(x), len(y))
            x = x[:n_common]
            y = y[:n_common]

        # Remove NaN pairs
        mask = ~(np.isnan(x) | np.isnan(y))
        x, y = x[mask], y[mask]
        n = len(x)
        
        if n < 3:
            return CorrelationResult(
                variable_1="", variable_2="", method=method,
                correlation=np.nan, p_value=np.nan,
                ci_lower=np.nan, ci_upper=np.nan,
                n_samples=n, is_significant=False
            )
        
        if method == "pearson":
            r, p = pearsonr(x, y)
        elif method == "spearman":
            r, p = spearmanr(x, y)
        elif method == "kendall":
            r, p = kendalltau(x, y)
        else:
            raise ValueError(f"Unknown correlation method: {method}")
        
        # Fisher's z transformation for CI (clip near +/-1 to avoid inf).
        r_safe = float(np.clip(r, -0.999999, 0.999999))
        z = np.arctanh(r_safe)
        se = 1 / np.sqrt(n - 3)
        ci_lower = np.tanh(z - 1.96 * se)
        ci_upper = np.tanh(z + 1.96 * se)
        
        return CorrelationResult(
            variable_1="", variable_2="", method=method,
            correlation=r, p_value=p,
            ci_lower=ci_lower, ci_upper=ci_upper,
            n_samples=n, is_significant=p < AnalysisEngine.ALPHA
        )
    
    async def compute_pec(
        self, 
        experiment_id: int, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Compute Prompt Entropy Coefficient (PEC).
        
        PEC = correlation(semantic_instability_index, energy_per_token)
        """
        # Get data - handle is_valid being True or None (for demo data)
        query = (
            select(
                Prompt.semantic_instability_index,
                Measurement.energy_per_token_mj
            )
            .join(Measurement, Prompt.id == Measurement.prompt_id)
            .where(Measurement.experiment_id == experiment_id)
            .where(Measurement.is_warmup.is_(False))
            .where(or_(Measurement.is_valid.is_(True), Measurement.is_valid.is_(None)))
        )
        
        result = await db.execute(query)
        rows = result.all()
        
        if len(rows) < 10:
            return {
                "error": "Insufficient data for PEC calculation",
                "n_samples": len(rows)
            }
        
        pairs = [
            (float(r[0]), float(r[1]))
            for r in rows
            if r[0] is not None and r[1] is not None
        ]
        if len(pairs) < 10:
            return {
                "error": "Insufficient valid samples for PEC calculation",
                "n_samples": len(pairs)
            }

        sii = np.array([p[0] for p in pairs], dtype=float)
        ept = np.array([p[1] for p in pairs], dtype=float)
        
        # Calculate correlations with multiple methods
        pearson = self.correlation_with_ci(sii, ept, "pearson")
        spearman = self.correlation_with_ci(sii, ept, "spearman")
        
        # Primary PEC is Spearman (more robust to outliers)
        pec = spearman.correlation
        
        # Interpretation with detailed statistical guidance
        if pec > 0.3 and spearman.is_significant:
            interpretation = (
                f"✅ Strong positive relationship (ρ={pec:.3f}, p={spearman.p_value:.4f}): "
                "Higher semantic instability is associated with higher energy consumption. "
                "This supports the computational entropy hypothesis."
            )
            significance_explanation = (
                f"The Spearman correlation coefficient (ρ={pec:.3f}) indicates a strong monotonic relationship. "
                f"The p-value ({spearman.p_value:.4f}) is below the significance threshold (α=0.05), "
                "meaning there is strong statistical evidence that this relationship is not due to chance. "
                "The 95% confidence interval suggests the true correlation lies between "
                f"{spearman.ci_lower:.3f} and {spearman.ci_upper:.3f}."
            )
        elif pec > 0.1 and spearman.is_significant:
            interpretation = (
                f"✓ Moderate positive relationship (ρ={pec:.3f}, p={spearman.p_value:.4f}): "
                "There is evidence of increased energy consumption with semantic instability."
            )
            significance_explanation = (
                f"The correlation (ρ={pec:.3f}) shows a moderate positive trend. "
                f"With p={spearman.p_value:.4f} < 0.05, this relationship is statistically significant, "
                "though the effect is weaker than optimal. Consider increasing sample size or refining measurement methodology."
            )
        elif pec < -0.1 and spearman.is_significant:
            interpretation = (
                f"⚠️ Negative relationship (ρ={pec:.3f}, p={spearman.p_value:.4f}): "
                "Unexpectedly, higher semantic instability is associated with lower energy. "
                "This may indicate optimization effects or requires further investigation."
            )
            significance_explanation = (
                "This negative correlation contradicts the hypothesis. Possible explanations: "
                "(1) Model optimization handles complex prompts more efficiently, "
                "(2) Measurement artifacts, or (3) Confounding variables. Further investigation recommended."
            )
        else:
            interpretation = (
                f"○ No significant relationship detected (ρ={pec:.3f}, p={spearman.p_value:.4f}): "
                "The evidence does not support a strong link between semantic instability and energy consumption."
            )
            significance_explanation = (
                f"Either the p-value ({spearman.p_value:.4f}) exceeds 0.05 or the correlation magnitude is too weak. "
                "This suggests: (1) No real relationship exists, (2) Insufficient statistical power (increase sample size), "
                "or (3) High variability in measurements. Review data quality and experimental design."
            )
        
        return {
            "experiment_id": experiment_id,
            "pec_score": float(pec),
            "pec_method": "spearman",
            "p_value": float(spearman.p_value),
            "ci_lower": float(spearman.ci_lower),
            "ci_upper": float(spearman.ci_upper),
            "n_samples": int(spearman.n_samples),
            "is_significant": bool(spearman.is_significant),
            "interpretation": interpretation,
            "significance_explanation": significance_explanation,
            "statistical_notes": {
                "test_used": "Spearman's rank correlation (non-parametric, robust to outliers)",
                "null_hypothesis": "No monotonic relationship between SII and energy consumption",
                "significance_level": "α = 0.05 (95% confidence)",
                "what_it_means": (
                    "PEC measures how consistently energy increases as semantic instability increases. "
                    f"A value of {pec:.3f} means changes in instability explain approximately {(pec**2)*100:.1f}% of variance in energy consumption."
                )
            },
            "alternative_correlations": {
                "pearson": {
                    "r": float(pearson.correlation),
                    "p": float(pearson.p_value),
                    "ci": [float(pearson.ci_lower), float(pearson.ci_upper)],
                    "note": "Pearson assumes linear relationship; Spearman (used for PEC) detects any monotonic pattern."
                }
            }
        }
    
    async def compute_correlation_matrix(
        self, 
        experiment_id: int, 
        method: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Compute correlation matrix between key variables."""
        query = (
            select(
                Prompt.semantic_instability_index,
                Prompt.human_ambiguity_score,
                Prompt.word_count,
                Prompt.flesch_reading_ease,
                Measurement.energy_per_token_mj,
                Measurement.total_time_seconds,
                Measurement.output_tokens
            )
            .join(Measurement, Prompt.id == Measurement.prompt_id)
            .where(Measurement.experiment_id == experiment_id)
            .where(Measurement.is_warmup.is_(False))
            .where(or_(Measurement.is_valid.is_(True), Measurement.is_valid.is_(None)))
        )
        
        result = await db.execute(query)
        rows = result.all()
        
        # Build arrays, preserving missing values as np.nan.
        def _to_float(value: Any) -> float:
            try:
                return float(value) if value is not None else np.nan
            except (TypeError, ValueError):
                return np.nan

        variables = {
            "semantic_instability": np.array([_to_float(r[0]) for r in rows], dtype=float),
            "human_ambiguity": np.array([_to_float(r[1]) for r in rows], dtype=float),
            "word_count": np.array([_to_float(r[2]) for r in rows], dtype=float),
            "readability": np.array([_to_float(r[3]) for r in rows], dtype=float),
            "energy_per_token": np.array([_to_float(r[4]) for r in rows], dtype=float),
            "inference_time": np.array([_to_float(r[5]) for r in rows], dtype=float),
            "output_tokens": np.array([_to_float(r[6]) for r in rows], dtype=float)
        }
        
        # Compute correlation matrix
        var_names = list(variables.keys())
        n_vars = len(var_names)
        matrix = np.zeros((n_vars, n_vars))
        p_matrix = np.zeros((n_vars, n_vars))
        
        for i, var1 in enumerate(var_names):
            for j, var2 in enumerate(var_names):
                if i == j:
                    matrix[i, j] = 1.0
                    p_matrix[i, j] = 0.0
                else:
                    corr = self.correlation_with_ci(
                        variables[var1], variables[var2], method
                    )
                    matrix[i, j] = corr.correlation if not np.isnan(corr.correlation) else 0
                    p_matrix[i, j] = corr.p_value if not np.isnan(corr.p_value) else 1
        
        return {
            "variables": var_names,
            "correlation_matrix": matrix.tolist(),
            "p_value_matrix": p_matrix.tolist(),
            "method": method,
            "n_samples": len(rows)
        }
    
    async def run_anova(
        self, 
        experiment_id: int, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Run one-way ANOVA comparing mutation types."""
        query = (
            select(
                Prompt.mutation_type,
                Measurement.energy_per_token_mj
            )
            .join(Measurement, Prompt.id == Measurement.prompt_id)
            .where(Measurement.experiment_id == experiment_id)
            .where(Measurement.is_warmup.is_(False))
            .where(or_(Measurement.is_valid.is_(True), Measurement.is_valid.is_(None)))
        )
        
        result = await db.execute(query)
        rows = result.all()
        if not rows:
            return {"error": "Insufficient data for ANOVA"}
        
        # Group by mutation type
        groups = {}
        for mutation_type, ept in rows:
            mt_str = self.mutation_type_to_str(mutation_type)
            if mt_str not in groups:
                groups[mt_str] = []
            if ept is not None:
                groups[mt_str].append(ept)
        
        # Convert to arrays
        group_arrays = [np.array(v) for v in groups.values() if len(v) >= 2]
        group_names = [k for k, v in groups.items() if len(v) >= 2]
        
        if len(group_arrays) < 2:
            return {"error": "Insufficient groups for ANOVA"}
        
        # Parametric ANOVA
        f_stat, p_value = f_oneway(*group_arrays)
        
        # Non-parametric alternative (Kruskal-Wallis)
        h_stat, kw_p = kruskal(*group_arrays)
        
        # Effect size (eta-squared)
        all_data = np.concatenate(group_arrays)
        ss_total = np.sum((all_data - np.mean(all_data))**2)
        
        group_means = [np.mean(g) for g in group_arrays]
        grand_mean = np.mean(all_data)
        ss_between = sum(len(g) * (m - grand_mean)**2 for g, m in zip(group_arrays, group_means))
        
        eta_squared = ss_between / ss_total if ss_total > 0 else 0
        
        # Omega squared (less biased)
        k = len(group_arrays)
        n = len(all_data)
        ms_within = (ss_total - ss_between) / (n - k)
        omega_squared = (ss_between - (k - 1) * ms_within) / (ss_total + ms_within)
        
        # Interpret effect sizes
        if eta_squared < 0.01:
            effect_interpretation = "negligible (η²<0.01)"
            effect_meaning = "Mutation type explains <1% of energy variance - practically no effect."
        elif eta_squared < 0.06:
            effect_interpretation = "small (η²<0.06)"
            effect_meaning = f"Mutation type explains {eta_squared*100:.1f}% of energy variance - small but detectable effect."
        elif eta_squared < 0.14:
            effect_interpretation = "medium (η²<0.14)"
            effect_meaning = f"Mutation type explains {eta_squared*100:.1f}% of energy variance - moderate practical significance."
        else:
            effect_interpretation = f"large (η²={eta_squared:.3f})"
            effect_meaning = f"Mutation type explains {eta_squared*100:.1f}% of energy variance - strong practical impact."
        
        # ANOVA interpretation
        if p_value < 0.001:
            anova_interpretation = f"Extremely significant (p<0.001, F={f_stat:.2f}): Very strong evidence that mutation types have different energy impacts."
        elif p_value < 0.01:
            anova_interpretation = f"Highly significant (p={p_value:.4f}, F={f_stat:.2f}): Strong evidence of differences between mutation types."
        elif p_value < 0.05:
            anova_interpretation = f"Significant (p={p_value:.4f}, F={f_stat:.2f}): Mutation types show statistically different energy consumption."
        else:
            anova_interpretation = f"Not significant (p={p_value:.4f}, F={f_stat:.2f}): No statistically reliable difference between mutation types."
        
        return {
            "experiment_id": experiment_id,
            "dependent_variable": "energy_per_token_mj",
            "factor": "mutation_type",
            "groups": group_names,
            "group_sizes": [len(g) for g in group_arrays],
            "group_means": [float(m) for m in group_means],
            "group_stds": [float(np.std(g)) for g in group_arrays],
            "anova": {
                "f_statistic": float(f_stat),
                "p_value": float(p_value),
                "df_between": k - 1,
                "df_within": n - k,
                "is_significant": bool(p_value < self.ALPHA),
                "interpretation": anova_interpretation
            },
            "kruskal_wallis": {
                "h_statistic": float(h_stat),
                "p_value": float(kw_p),
                "is_significant": bool(kw_p < self.ALPHA),
                "note": "Non-parametric alternative to ANOVA; more robust when data violates normality assumptions."
            },
            "effect_sizes": {
                "eta_squared": float(eta_squared),
                "omega_squared": float(omega_squared),
                "interpretation": effect_interpretation,
                "meaning": effect_meaning
            },
            "statistical_notes": {
                "test_used": "One-way ANOVA (Analysis of Variance)",
                "null_hypothesis": "All mutation types have equal mean energy consumption",
                "assumptions": "Normality, homogeneity of variance, independence",
                "what_f_means": (
                    f"F={f_stat:.2f} is the ratio of between-group variance to within-group variance. "
                    f"Higher F values indicate larger differences between groups relative to variability within groups."
                ),
                "what_pvalue_means": (
                    f"p={p_value:.4f} is the probability of observing these differences if all groups were actually equal. "
                    f"{'Since p<0.05, we reject the null hypothesis.' if p_value < 0.05 else 'Since p≥0.05, we cannot reject the null hypothesis.'}"
                )
            }
        }
    
    async def compute_effect_sizes(
        self, 
        experiment_id: int, 
        db: AsyncSession
    ) -> List[Dict]:
        """Compute pairwise effect sizes between mutation types."""
        query = (
            select(
                Prompt.mutation_type,
                Measurement.energy_per_token_mj
            )
            .join(Measurement, Prompt.id == Measurement.prompt_id)
            .where(Measurement.experiment_id == experiment_id)
            .where(Measurement.is_warmup.is_(False))
            .where(or_(Measurement.is_valid.is_(True), Measurement.is_valid.is_(None)))
        )
        
        result = await db.execute(query)
        rows = result.all()
        
        # Group by mutation type
        groups = {}
        for mutation_type, ept in rows:
            mt_str = self.mutation_type_to_str(mutation_type)
            if mt_str not in groups:
                groups[mt_str] = []
            if ept is not None:
                groups[mt_str].append(ept)

        # Remove empty groups early
        groups = {k: v for k, v in groups.items() if len(v) >= 2}
        if len(groups) < 2:
            return []
        
        # Get baseline for comparison
        baseline_key = [k for k in groups.keys() if "baseline" in k.lower()]
        baseline_key = baseline_key[0] if baseline_key else list(groups.keys())[0]
        baseline_data = np.array(groups[baseline_key])
        if len(baseline_data) == 0:
            return []
        
        effect_sizes = []
        
        for name, data in groups.items():
            if name == baseline_key:
                continue
            
            data_array = np.array(data)
            d, ci_lower, ci_upper = self.cohens_d(data_array, baseline_data)
            g = self.hedges_g(data_array, baseline_data)
            
            effect_sizes.append({
                "comparison": f"{name} vs {baseline_key}",
                "cohens_d": float(d),
                "hedges_g": float(g),
                "ci_lower": float(ci_lower),
                "ci_upper": float(ci_upper),
                "interpretation": self.interpret_cohens_d(d),
                "mean_difference": float(np.mean(data_array) - np.mean(baseline_data)),
                "percent_change": float(((np.mean(data_array) - np.mean(baseline_data)) / np.mean(baseline_data) * 100) if np.mean(baseline_data) != 0 else 0),
                "practical_meaning": self._explain_cohens_d(d, name, baseline_key, np.mean(data_array), np.mean(baseline_data))
            })
        
        return sorted(effect_sizes, key=lambda x: abs(x["cohens_d"]), reverse=True)
    
    @staticmethod
    def _explain_cohens_d(d: float, treatment: str, baseline: str, mean_treat: float, mean_base: float) -> str:
        """Provide practical explanation of Cohen's d."""
        d_abs = abs(d)
        direction = "higher" if mean_treat > mean_base else "lower"
        pct = abs((mean_treat - mean_base) / mean_base * 100)
        
        if d_abs < 0.2:
            return f"{treatment} shows {pct:.1f}% {direction} energy than {baseline} - negligible practical difference."
        elif d_abs < 0.5:
            return f"{treatment} shows {pct:.1f}% {direction} energy than {baseline} - small but measurable effect (d={d:.2f})."
        elif d_abs < 0.8:
            return f"{treatment} shows {pct:.1f}% {direction} energy than {baseline} - medium effect, clearly noticeable in practice (d={d:.2f})."
        else:
            return f"{treatment} shows {pct:.1f}% {direction} energy than {baseline} - large effect with major practical implications (d={d:.2f})."
    
    async def generate_full_report(
        self, 
        experiment_id: int, 
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Generate comprehensive analysis report."""
        # Get experiment info
        exp_result = await db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        experiment = exp_result.scalar_one_or_none()
        
        if not experiment:
            return {"error": "Experiment not found"}
        
        # Gather all analyses
        pec = await self.compute_pec(experiment_id, db)
        anova = await self.run_anova(experiment_id, db)
        effect_sizes = await self.compute_effect_sizes(experiment_id, db)
        correlations = await self.compute_correlation_matrix(experiment_id, "spearman", db)
        
        # Generate recommendations
        recommendations = await self.generate_recommendations(experiment_id, db)
        
        return {
            "experiment": {
                "id": experiment.id,
                "name": experiment.name,
                "total_measurements": experiment.total_measurements,
                "mutation_types": experiment.mutation_types
            },
            "pec_analysis": pec,
            "anova_analysis": anova,
            "effect_sizes": effect_sizes,
            "correlation_matrix": correlations,
            "recommendations": recommendations,
            "statistical_summary": {
                "primary_finding": pec.get("interpretation", "Analysis incomplete"),
                "effect_magnitude": anova.get("effect_sizes", {}).get("interpretation", "unknown"),
                "confidence_level": 0.95
            }
        }
    
    async def generate_recommendations(
        self, 
        experiment_id: int, 
        db: AsyncSession
    ) -> List[str]:
        """Generate data-driven recommendations."""
        recommendations = []
        
        pec = await self.compute_pec(experiment_id, db)
        effect_sizes = await self.compute_effect_sizes(experiment_id, db)
        
        # PEC-based recommendations
        if pec.get("is_significant") and pec.get("pec_score", 0) > 0.2:
            recommendations.append(
                "✅ Strong evidence supports the computational entropy hypothesis. "
                "Semantic instability significantly correlates with energy consumption."
            )
            recommendations.append(
                "💡 Consider implementing prompt clarity scoring in production systems "
                "to optimize energy efficiency."
            )
        
        # Effect size recommendations
        high_impact = [e for e in effect_sizes if abs(e.get("cohens_d", 0)) > 0.5]
        if high_impact:
            worst = max(high_impact, key=lambda x: x.get("percent_change", 0))
            recommendations.append(
                f"⚠️ {worst['comparison']} shows {worst['percent_change']:.1f}% increase in energy. "
                f"Avoid this mutation type in production prompts."
            )
        
        # General recommendations
        recommendations.append(
            "📊 Results can be strengthened by increasing sample size and "
            "including diverse prompt categories."
        )
        
        return recommendations
    
    async def generate_latex_tables(
        self, 
        experiment_id: int, 
        table_type: str,
        db: AsyncSession
    ) -> Dict[str, str]:
        """Generate publication-ready LaTeX tables."""
        tables = {}
        
        if table_type in ["all", "summary"]:
            anova = await self.run_anova(experiment_id, db)
            
            summary_table = """\\begin{table}[h]
\\centering
\\caption{Descriptive Statistics by Mutation Type}
\\begin{tabular}{lrrr}
\\toprule
\\textbf{Mutation Type} & \\textbf{N} & \\textbf{Mean (mJ/token)} & \\textbf{SD} \\\\
\\midrule
"""
            for name, size, mean, std in zip(
                anova.get("groups", []),
                anova.get("group_sizes", []),
                anova.get("group_means", []),
                anova.get("group_stds", [])
            ):
                summary_table += f"{name} & {size} & {mean:.3f} & {std:.3f} \\\\\n"
            
            summary_table += """\\bottomrule
\\end{tabular}
\\end{table}"""
            tables["Summary Statistics"] = summary_table
        
        if table_type in ["all", "anova"]:
            anova = await self.run_anova(experiment_id, db)
            anova_data = anova.get("anova", {})
            
            anova_table = f"""\\begin{{table}}[h]
\\centering
\\caption{{One-way ANOVA Results}}
\\begin{{tabular}}{{lrrrrr}}
\\toprule
\\textbf{{Source}} & \\textbf{{df}} & \\textbf{{F}} & \\textbf{{p}} & \\textbf{{$\\eta^2$}} & \\textbf{{$\\omega^2$}} \\\\
\\midrule
Between Groups & {anova_data.get('df_between', 'N/A')} & {anova_data.get('f_statistic', 0):.2f} & {anova_data.get('p_value', 1):.4f} & {anova.get('effect_sizes', {}).get('eta_squared', 0):.3f} & {anova.get('effect_sizes', {}).get('omega_squared', 0):.3f} \\\\
\\bottomrule
\\end{{tabular}}
\\end{{table}}"""
            tables["ANOVA Results"] = anova_table
        
        if table_type in ["all", "effects"]:
            effect_sizes = await self.compute_effect_sizes(experiment_id, db)
            
            effects_table = """\\begin{table}[h]
\\centering
\\caption{Pairwise Effect Sizes (vs Baseline)}
\\begin{tabular}{lrrrl}
\\toprule
\\textbf{Comparison} & \\textbf{Cohen's d} & \\textbf{95\\% CI} & \\textbf{\\% Change} & \\textbf{Size} \\\\
\\midrule
"""
            for e in effect_sizes:
                effects_table += f"{e['comparison']} & {e['cohens_d']:.3f} & [{e['ci_lower']:.2f}, {e['ci_upper']:.2f}] & {e['percent_change']:.1f}\\% & {e['interpretation']} \\\\\n"
            if not effect_sizes:
                effects_table += "No valid pairwise comparisons & -- & -- & -- & -- \\\\\n"
            
            effects_table += """\\bottomrule
\\end{tabular}
\\end{table}"""
            tables["Effect Sizes"] = effects_table
        
        return tables
    
    @staticmethod
    async def run_full_analysis(experiment_id: int, include_bayesian: bool = False):
        """Run complete analysis and store results (background task)."""
        from app.core.database import async_session_maker
        
        async with async_session_maker() as db:
            engine = AnalysisEngine()
            
            try:
                # Run analyses
                pec = await engine.compute_pec(experiment_id, db)
                anova = await engine.run_anova(experiment_id, db)
                effect_sizes = await engine.compute_effect_sizes(experiment_id, db)
                
                # Store PEC result
                if "pec_score" in pec:
                    pec_result = AnalysisResult(
                        experiment_id=experiment_id,
                        analysis_type=AnalysisType.CORRELATION,
                        analysis_name="Prompt Entropy Coefficient (PEC)",
                        statistic_name="rho",
                        statistic_value=pec["pec_score"],
                        p_value=pec["p_value"],
                        ci_lower=pec["ci_lower"],
                        ci_upper=pec["ci_upper"],
                        sample_size=pec["n_samples"],
                        is_significant="Yes" if pec["is_significant"] else "No",
                        interpretation=pec["interpretation"],
                        detailed_results=pec
                    )
                    db.add(pec_result)
                
                # Store ANOVA result
                if "anova" in anova:
                    anova_result = AnalysisResult(
                        experiment_id=experiment_id,
                        analysis_type=AnalysisType.ANOVA,
                        analysis_name="One-way ANOVA (Mutation Type)",
                        statistic_name="F",
                        statistic_value=anova["anova"]["f_statistic"],
                        p_value=anova["anova"]["p_value"],
                        effect_size=anova["effect_sizes"]["eta_squared"],
                        effect_size_type="eta_squared",
                        effect_size_interpretation=anova["effect_sizes"]["interpretation"],
                        is_significant="Yes" if anova["anova"]["is_significant"] else "No",
                        detailed_results=anova
                    )
                    db.add(anova_result)
                
                # Store effect sizes
                for es in effect_sizes:
                    es_result = AnalysisResult(
                        experiment_id=experiment_id,
                        analysis_type=AnalysisType.EFFECT_SIZE,
                        analysis_name=f"Effect Size: {es['comparison']}",
                        statistic_name="d",
                        statistic_value=es["cohens_d"],
                        ci_lower=es["ci_lower"],
                        ci_upper=es["ci_upper"],
                        effect_size=es["cohens_d"],
                        effect_size_type="cohens_d",
                        effect_size_interpretation=es["interpretation"],
                        detailed_results=es
                    )
                    db.add(es_result)
                
                # Update experiment PEC score
                experiment = await db.execute(
                    select(Experiment).where(Experiment.id == experiment_id)
                )
                exp = experiment.scalar_one_or_none()
                if exp and "pec_score" in pec:
                    exp.pec_score = pec["pec_score"]
                
                await db.commit()
                
            except Exception as e:
                await db.rollback()
                raise e
