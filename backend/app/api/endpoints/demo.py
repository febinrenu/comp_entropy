"""Demo data and live experiment endpoints."""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from sqlalchemy import select, func
from typing import List, Optional
import random
import asyncio
from datetime import datetime, timedelta
import math

from app.core.database import async_session_maker
from app.models.experiment import Experiment, ExperimentStatus
from app.models.measurement import Measurement
from app.models.prompt import Prompt, MutationType

router = APIRouter()


# Sample prompts with their mutations for demonstration
SAMPLE_PROMPTS = [
    {
        "baseline": "Explain how photosynthesis works.",
        "category": "Science",
        "mutations": [
            (MutationType.NOISE_VERBOSE, "Describe in detail how photosynthesis functions in plants."),
            (MutationType.AMBIGUITY_SEMANTIC, "Can you tell me about the process plants use to convert sunlight into energy?"),
            (MutationType.FORMALITY_SHIFT, "Explain in comprehensive detail how the biological process of photosynthesis works, including all chemical reactions and stages involved."),
            (MutationType.REORDERING, "How do plants make food from sunlight?"),
        ]
    },
    {
        "baseline": "What is machine learning?",
        "category": "Technology",
        "mutations": [
            (MutationType.NOISE_VERBOSE, "What is automated learning?"),
            (MutationType.AMBIGUITY_SEMANTIC, "Could you explain the concept where computers learn from data?"),
            (MutationType.FORMALITY_SHIFT, "What is machine learning, including its various types such as supervised, unsupervised, and reinforcement learning, along with real-world applications?"),
            (MutationType.REORDERING, "How do computers learn things?"),
        ]
    },
    {
        "baseline": "Describe the water cycle.",
        "category": "Science",
        "mutations": [
            (MutationType.NOISE_VERBOSE, "Explain the hydrological cycle."),
            (MutationType.AMBIGUITY_SEMANTIC, "How does water move through the environment in a continuous loop?"),
            (MutationType.FORMALITY_SHIFT, "Describe the complete water cycle including evaporation, condensation, precipitation, collection, and how human activities affect it."),
            (MutationType.REORDERING, "How does rain happen?"),
        ]
    },
    {
        "baseline": "What causes climate change?",
        "category": "Environment",
        "mutations": [
            (MutationType.NOISE_VERBOSE, "What leads to global warming?"),
            (MutationType.AMBIGUITY_SEMANTIC, "What factors contribute to the Earth's temperature increasing over time?"),
            (MutationType.FORMALITY_SHIFT, "What causes climate change, including both natural factors and human activities, and what are the feedback mechanisms involved?"),
            (MutationType.REORDERING, "Why is Earth getting warmer?"),
        ]
    },
    {
        "baseline": "Explain how a neural network works.",
        "category": "Technology",
        "mutations": [
            (MutationType.NOISE_VERBOSE, "Describe how an artificial neural network operates."),
            (MutationType.AMBIGUITY_SEMANTIC, "How do interconnected nodes in AI systems process and learn from information?"),
            (MutationType.FORMALITY_SHIFT, "Explain how a neural network works including input layers, hidden layers, activation functions, backpropagation, and gradient descent optimization."),
            (MutationType.REORDERING, "How does AI learn?"),
        ]
    },
]


def generate_realistic_measurement(prompt_text: str, mutation_type: str) -> dict:
    """
    Generate realistic measurement data based on prompt characteristics.

    Energy model:
    The core research hypothesis is that *semantically unstable* prompts
    consume more energy.  The ordering (lowest to highest energy) is:

        baseline < reordering < noise_typo < noise_verbose
        < formality_shift < ambiguity_semantic < negation
        < code_switching < ambiguity_contradiction

    Energy per token (EPT) is the primary metric; total energy also
    scales with token count.
    """
    base_word_count = len(prompt_text.split())

    # ---- Energy multipliers aligned with SII ordering ----
    energy_multipliers = {
        "baseline":                 1.00,
        "reordering":               1.12,   # disrupted flow
        "noise_typo":               1.18,   # misspellings
        "noise_verbose":            1.32,   # filler words
        "formality_shift":          1.52,   # elaborate / formal
        "ambiguity_semantic":       1.78,   # vague references
        "negation":                 2.05,   # double negatives
        "code_switching":           2.20,   # foreign insertions
        "ambiguity_contradiction":  2.45,   # conflicting signals
    }

    multiplier = energy_multipliers.get(mutation_type, 1.0)

    # Base energy: proportional to word count
    base_energy = 35.0 + (base_word_count * 2.0)
    energy = base_energy * multiplier

    # Add controlled Gaussian noise (±6%)
    energy *= random.gauss(1.0, 0.03)

    # ---- Output tokens: complex prompts produce more output ----
    base_tokens = 120 + base_word_count * 2
    output_tokens = int(base_tokens * (0.9 + multiplier * 0.15) * random.uniform(0.93, 1.07))
    input_tokens = base_word_count + 10

    total_tokens = input_tokens + output_tokens

    # Time correlates with output tokens and complexity
    inference_time = 0.8 + (output_tokens / 180.0) * multiplier * random.uniform(0.93, 1.07)

    # Power is fairly consistent
    power = 45 + random.random() * 25
    cpu_usage = 30 + random.random() * 40
    gpu_usage = 60 + random.random() * 30

    return {
        "total_energy_joules": round(energy, 4),
        "total_time_seconds": round(inference_time, 4),
        "inference_time_seconds": round(inference_time * 0.92, 4),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "tokens_per_second": round(output_tokens / inference_time, 2),
        # EPT = energy per OUTPUT token (millijoules)
        "energy_per_token_mj": round((energy * 1000) / output_tokens, 4) if output_tokens > 0 else 0,
        "peak_power_watts": round(power, 2),
        "avg_power_watts": round(power * 0.85, 2),
        "cpu_utilization": round(cpu_usage, 1),
        "gpu_utilization": round(gpu_usage, 1),
    }


@router.post("/seed")
async def seed_demo_data(force: bool = False):
    """Seed the database with sample experiments and measurements for demonstration.
    
    Args:
        force: If True, delete existing demo data and re-seed with corrected values.
    """
    async with async_session_maker() as session:
        try:
            # Check if data already exists
            result = await session.execute(select(func.count(Experiment.id)))
            existing_count = result.scalar()
            
            if existing_count and existing_count > 3 and not force:
                return {"message": f"Demo data already exists ({existing_count} experiments). Use ?force=true to re-seed.", "seeded": False}
            
            # If force re-seed, delete existing data
            if force and existing_count and existing_count > 0:
                from app.models.measurement import Measurement as M_
                from app.models.prompt import Prompt as P_
                from app.models.experiment import Experiment as E_
                await session.execute(M_.__table__.delete())
                await session.execute(P_.__table__.delete())
                await session.execute(E_.__table__.delete())
                await session.commit()
            
            experiments_created = 0
            measurements_created = 0
            prompts_created = 0
            
            # Create experiments with measurements
            for i, prompt_data in enumerate(SAMPLE_PROMPTS):
                # Create experiment
                experiment = Experiment(
                    name=f"Demo Experiment: {prompt_data['category']} #{i+1}",
                    description=f"Demonstration of energy measurement for {prompt_data['category'].lower()} prompts with various mutations.",
                    config={"baseline_prompt": prompt_data["baseline"]},
                    model_name="gpt-3.5-turbo",
                    status=ExperimentStatus.COMPLETED,
                    mutation_types=["baseline", "noise_typo", "noise_verbose", "ambiguity_semantic", 
                                   "ambiguity_contradiction", "negation", "reordering", 
                                   "formality_shift", "code_switching"],
                    num_prompts=5,
                    runs_per_prompt=5,
                    created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                )
                session.add(experiment)
                await session.flush()
                experiments_created += 1
                
                # Create prompts - use MutationEngine to generate all 9 mutation types
                from app.services.mutation_engine import MutationEngine, MutationConfig
                
                mutation_engine = MutationEngine(MutationConfig(seed=42 + i))
                all_mutation_types = [
                    MutationType.BASELINE,
                    MutationType.NOISE_TYPO,
                    MutationType.NOISE_VERBOSE,
                    MutationType.AMBIGUITY_SEMANTIC,
                    MutationType.AMBIGUITY_CONTRADICTION,
                    MutationType.NEGATION,
                    MutationType.REORDERING,
                    MutationType.FORMALITY_SHIFT,
                    MutationType.CODE_SWITCHING,
                ]
                
                prompts_to_measure = []
                for mut_type in all_mutation_types:
                    if mut_type == MutationType.BASELINE:
                        prompts_to_measure.append((mut_type, prompt_data["baseline"]))
                    else:
                        # Generate mutation using MutationEngine
                        mutated_text, _ = mutation_engine.mutate(prompt_data["baseline"], mut_type, 0.5)
                        prompts_to_measure.append((mut_type, mutated_text))
                
                experiment_sii_ept = []  # Collect (SII, EPT) pairs for PEC
                
                for mutation_type, prompt_text in prompts_to_measure:
                    # Calculate semantic instability index based on mutation type.
                    # Values aligned with MutationEngine.SII_BASE so everything
                    # is consistent across demo data and real experiments.
                    instability_values = {
                        MutationType.BASELINE:                0.12 + random.random() * 0.08,
                        MutationType.REORDERING:              0.80 + random.random() * 0.20,
                        MutationType.NOISE_TYPO:              0.45 + random.random() * 0.20,
                        MutationType.NOISE_VERBOSE:           1.05 + random.random() * 0.30,
                        MutationType.FORMALITY_SHIFT:         1.40 + random.random() * 0.40,
                        MutationType.AMBIGUITY_SEMANTIC:      2.10 + random.random() * 0.60,
                        MutationType.NEGATION:                2.90 + random.random() * 0.60,
                        MutationType.CODE_SWITCHING:          2.50 + random.random() * 0.60,
                        MutationType.AMBIGUITY_CONTRADICTION: 3.50 + random.random() * 0.60,
                    }
                    semantic_instability = instability_values.get(mutation_type, 0.3)
                    
                    # Create prompt with all required fields
                    prompt = Prompt(
                        text=prompt_text,
                        original_text=prompt_data["baseline"] if mutation_type != MutationType.BASELINE else None,
                        experiment_id=experiment.id,
                        mutation_type=mutation_type,
                        mutation_intensity=0.5 if mutation_type != MutationType.BASELINE else 0.0,
                        word_count=len(prompt_text.split()),
                        semantic_instability_index=semantic_instability,
                        human_ambiguity_score=semantic_instability * 0.8 + random.random() * 0.1,
                        flesch_reading_ease=60 - (semantic_instability * 30) + random.random() * 10,
                    )
                    session.add(prompt)
                    await session.flush()
                    prompts_created += 1
                    
                    # Create multiple measurements (runs) with is_valid set
                    for run in range(5):
                        measurement_data = generate_realistic_measurement(prompt_text, mutation_type.value)
                        measurement = Measurement(
                            experiment_id=experiment.id,
                            prompt_id=prompt.id,
                            run_number=run + 1,
                            is_warmup=(run < 2),
                            is_valid=True,  # Important: set is_valid for analysis
                            model_name="gpt-3.5-turbo",
                            **measurement_data,
                        )
                        session.add(measurement)
                        measurements_created += 1

                        # Collect SII/EPT pairs for PEC computation
                        if not measurement.is_warmup:
                            experiment_sii_ept.append(
                                (semantic_instability, measurement_data["energy_per_token_mj"])
                            )
                
                # Compute PEC score (Spearman correlation) for this experiment
                if len(experiment_sii_ept) >= 5:
                    from scipy.stats import spearmanr as _sp
                    _sii = [p[0] for p in experiment_sii_ept]
                    _ept = [p[1] for p in experiment_sii_ept]
                    rho, _ = _sp(_sii, _ept)
                    experiment.pec_score = round(float(rho), 4)
                else:
                    experiment.pec_score = 0.0

                # Update experiment stats
                experiment.completed_at = datetime.utcnow() - timedelta(days=random.randint(0, 5))
                experiment.started_at = experiment.completed_at - timedelta(hours=1)
                experiment.total_measurements = len(prompts_to_measure) * 5
                experiment.progress = 100.0
            
            await session.commit()
            
            return {
                "message": "Demo data seeded successfully!",
                "seeded": True,
                "experiments_created": experiments_created,
                "prompts_created": prompts_created,
                "measurements_created": measurements_created,
            }
            
        except Exception as e:
            await session.rollback()
            raise HTTPException(status_code=500, detail=f"Error seeding data: {str(e)}")


@router.get("/stats")
async def get_demo_stats():
    """Get aggregated statistics for demonstration."""
    async with async_session_maker() as session:
        # Get measurement stats by mutation type
        result = await session.execute(
            select(
                Prompt.mutation_type,
                func.avg(Measurement.total_energy_joules).label("avg_energy"),
                func.avg(Measurement.total_time_seconds).label("avg_time"),
                func.avg(Measurement.output_tokens).label("avg_tokens"),
                func.count(Measurement.id).label("count"),
            )
            .join(Measurement, Measurement.prompt_id == Prompt.id)
            .group_by(Prompt.mutation_type)
        )
        
        stats_by_type = {}
        baseline_energy = 0
        
        for row in result:
            mutation_type = row.mutation_type.value if row.mutation_type else "baseline"
            stats_by_type[mutation_type] = {
                "avg_energy": round(row.avg_energy, 2) if row.avg_energy else 0,
                "avg_time": round(row.avg_time, 3) if row.avg_time else 0,
                "avg_tokens": round(row.avg_tokens, 0) if row.avg_tokens else 0,
                "count": row.count,
            }
            if mutation_type == "baseline":
                baseline_energy = row.avg_energy or 1
        
        # Calculate percentage changes from baseline
        for mutation_type, stats in stats_by_type.items():
            if mutation_type != "baseline" and baseline_energy > 0:
                change = ((stats["avg_energy"] - baseline_energy) / baseline_energy) * 100
                stats["energy_change_percent"] = round(change, 1)
        
        # Get total experiments and measurements
        exp_count = await session.execute(select(func.count(Experiment.id)))
        measurement_count = await session.execute(select(func.count(Measurement.id)))
        
        # Compute PEC (Spearman correlation between SII and EPT) from actual data
        pec_result = await session.execute(
            select(Prompt.semantic_instability_index, Measurement.energy_per_token_mj)
            .join(Measurement, Measurement.prompt_id == Prompt.id)
            .where(Prompt.semantic_instability_index.isnot(None))
            .where(Measurement.energy_per_token_mj.isnot(None))
        )
        pec_rows = pec_result.all()
        if len(pec_rows) >= 5:
            from scipy.stats import spearmanr as _spearmanr
            sii_vals = [r[0] for r in pec_rows]
            ept_vals = [r[1] for r in pec_rows]
            rho, p_val = _spearmanr(sii_vals, ept_vals)
            correlation_coeff = round(float(rho), 3)
            p_value = round(float(p_val), 4)
            effect_size = round(float(rho ** 2), 3)  # R-squared as effect size
        else:
            correlation_coeff = 0.0
            p_value = 1.0
            effect_size = 0.0

        return {
            "stats_by_mutation_type": stats_by_type,
            "total_experiments": exp_count.scalar() or 0,
            "total_measurements": measurement_count.scalar() or 0,
            "key_finding": {
                "highest_energy_increase": stats_by_type.get("ambiguity_contradiction", {}).get("energy_change_percent", 145),
                "lowest_energy_increase": stats_by_type.get("reordering", {}).get("energy_change_percent", 15),
                "correlation_coefficient": correlation_coeff,
                "p_value": p_value,
                "effect_size": effect_size,
            }
        }


@router.post("/quick-experiment")
async def run_quick_experiment(prompt: str, mutation_type: str = "all"):
    """Run a quick simulated experiment on a single prompt."""
    from app.services.mutation_engine import MutationEngine, MutationConfig

    mutations_to_test = ["baseline", "noise_typo", "noise_verbose",
                         "ambiguity_semantic", "formality_shift", "reordering",
                         "negation", "code_switching", "ambiguity_contradiction"]
    if mutation_type != "all" and mutation_type in mutations_to_test:
        mutations_to_test = ["baseline", mutation_type]

    engine = MutationEngine(MutationConfig(seed=random.randint(0, 10000)))
    results = []

    for mt in mutations_to_test:
        # Use the real mutation engine for consistency
        if mt == "baseline":
            mutated_text = prompt
        else:
            try:
                mt_enum = MutationType(mt)
                mutated_text, _ = engine.mutate(prompt, mt_enum, intensity=0.5)
            except Exception:
                mutated_text = prompt

        measurement = generate_realistic_measurement(mutated_text, mt)
        results.append({
            "mutation_type": mt,
            "prompt": mutated_text,
            "energy_consumed": measurement["total_energy_joules"],
            "energy_per_token_mj": measurement["energy_per_token_mj"],
            "tokens_generated": measurement["output_tokens"],
            "inference_time": measurement["total_time_seconds"],
            "tokens_per_second": measurement["tokens_per_second"],
        })

        await asyncio.sleep(0.05)

    # Calculate summary
    baseline_energy = results[0]["energy_consumed"]
    for r in results[1:]:
        r["energy_change_percent"] = round(
            ((r["energy_consumed"] - baseline_energy) / baseline_energy) * 100, 1
        )

    return {
        "original_prompt": prompt,
        "results": results,
        "summary": {
            "most_efficient": min(results, key=lambda x: x["energy_consumed"])["mutation_type"],
            "least_efficient": max(results, key=lambda x: x["energy_consumed"])["mutation_type"],
            "potential_savings_percent": round(
                (1 - min(r["energy_consumed"] for r in results) /
                 max(r["energy_consumed"] for r in results)) * 100, 1
            ),
        }
    }


@router.get("/correlation-data")
async def get_correlation_data():
    """Get data for correlation analysis visualization."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(
                Prompt.text,
                Prompt.mutation_type,
                Measurement.total_energy_joules,
                Measurement.output_tokens,
                Measurement.total_time_seconds,
            )
            .join(Measurement, Measurement.prompt_id == Prompt.id)
            .limit(100)
        )
        
        data_points = []
        for row in result:
            word_count = len(row.text.split())
            data_points.append({
                "word_count": word_count,
                "energy": round(row.total_energy_joules, 2) if row.total_energy_joules else 0,
                "tokens": row.output_tokens or 0,
                "time": round(row.total_time_seconds, 3) if row.total_time_seconds else 0,
                "mutation_type": row.mutation_type.value if row.mutation_type else "baseline",
            })
        
        # Calculate correlation coefficient
        if data_points:
            x = [d["word_count"] for d in data_points]
            y = [d["energy"] for d in data_points]
            n = len(x)
            
            mean_x = sum(x) / n
            mean_y = sum(y) / n
            
            numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
            denominator = math.sqrt(sum((xi - mean_x) ** 2 for xi in x) * sum((yi - mean_y) ** 2 for yi in y))
            
            correlation = numerator / denominator if denominator != 0 else 0
        else:
            correlation = 0
        
        return {
            "data_points": data_points,
            "correlation_coefficient": round(correlation, 3),
            "sample_size": len(data_points),
        }
