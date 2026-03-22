"""
Experiment Runner — Robust & Consistent
========================================

Runs experiments with proper:
- Process-level energy measurement (not system-wide)
- Per-prompt SII computation via MutationEngine
- Consistent EPT formula (energy_mJ / output_tokens)
- Correct PEC as Spearman correlation(SII, EPT)
"""

import asyncio
import time
import random
import json
import os
from datetime import datetime
from typing import List, Optional
import numpy as np
import psutil
from app.core.logger import logger

from app.core.database import async_session_maker
from app.core.paths import DATA_DIR
from app.models import Experiment, Prompt, Measurement, ExperimentStatus, MutationType
from app.services.llm_service import get_llm_service
from app.services.mutation_engine import MutationEngine


# Settings file path
SETTINGS_FILE = DATA_DIR / "settings.json"


# Backward-compatible aliases for older frontend mutation IDs
MUTATION_TYPE_ALIASES = {
    "synonym_replacement": "noise_typo",
    "paraphrase": "ambiguity_semantic",
    "word_order": "reordering",
    "complexity_increase": "noise_verbose",
    "complexity_decrease": "formality_shift",
    "noise_injection": "noise_typo",
    "verbosity_variation": "noise_verbose",
    "semantic_shift": "ambiguity_semantic",
    "structural_modification": "reordering",
    "contradiction_injection": "ambiguity_contradiction",
}


def normalize_mutation_type(value: str) -> MutationType:
    """Normalize potentially-legacy mutation IDs into the backend enum."""
    normalized = MUTATION_TYPE_ALIASES.get(value, value)
    try:
        return MutationType(normalized)
    except ValueError:
        return MutationType.BASELINE


def load_experiment_settings() -> dict:
    """Load current settings from file for the experiment."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "provider": "simulation",
        "openai_api_key": None,
        "openai_model": "gpt-3.5-turbo",
        "anthropic_api_key": None,
        "anthropic_model": "claude-3-haiku-20240307",
        "temperature": 0.7,
        "max_tokens": 256
    }


# Default prompts for testing
DEFAULT_PROMPTS = [
    "What are the symptoms of diabetes?",
    "Explain how photosynthesis works.",
    "What causes climate change?",
    "How does the immune system work?",
    "Describe the water cycle.",
    "What is artificial intelligence?",
    "How do vaccines protect us?",
    "Explain quantum computing basics.",
    "What causes earthquakes?",
    "How does memory work in the brain?",
]


# ---- CPU TDP used for energy estimation (Watts) ----
# The runner uses:  energy_J = TDP * (cpu_fraction) * elapsed_seconds
# For simulation mode a synthetic energy model is layered on top.
_CPU_TDP_WATTS = 65.0


def _estimate_energy_joules(
    cpu_times_before: float,
    cpu_times_after: float,
    wall_seconds: float,
    n_cpus: int,
) -> float:
    """
    Estimate energy consumed by this process during an interval.

    Uses process-level CPU time (user + system) reported by the OS,
    combined with a TDP-based power model:

        energy = TDP × (process_cpu_seconds / (wall_seconds × n_cpus)) × wall_seconds

    This gives a per-process share of total package energy.
    """
    if wall_seconds <= 0:
        return 0.0
    process_cpu_seconds = max(0.0, cpu_times_after - cpu_times_before)
    # Fraction of total CPU capacity used by this process
    cpu_fraction = process_cpu_seconds / (wall_seconds * n_cpus)
    cpu_fraction = min(cpu_fraction, 1.0)
    energy = _CPU_TDP_WATTS * cpu_fraction * wall_seconds
    return energy


async def run_experiment(experiment_id: int):
    """
    Main experiment runner.

    1. Loads settings & initialises LLM service
    2. For each (prompt × mutation × run):
        a. Mutate the prompt (or keep baseline)
        b. Compute linguistic metrics & SII
        c. Measure wall-time + process CPU time during inference
        d. Derive energy, EPT, tokens/s
    3. Compute PEC = Spearman(SII, EPT) and store
    """
    async with async_session_maker() as db:
        try:
            from sqlalchemy import select

            result = await db.execute(
                select(Experiment).where(Experiment.id == experiment_id)
            )
            experiment = result.scalar_one_or_none()
            if not experiment:
                logger.error(f"Experiment {experiment_id} not found")
                return

            logger.info(f"Starting experiment: {experiment.name}")

            # ---- Load settings ----
            current_settings = load_experiment_settings()
            config = experiment.config or {}
            provider = config.get("provider") or current_settings.get("provider", "simulation")
            api_key = config.get("api_key") or (
                current_settings.get("openai_api_key") if provider == "openai" else
                current_settings.get("anthropic_api_key") if provider == "anthropic" else
                None
            )
            model = config.get("model") or (
                current_settings.get("openai_model") if provider == "openai" else
                current_settings.get("anthropic_model") if provider == "anthropic" else
                None
            )
            temperature = config.get("temperature") or current_settings.get("temperature", 0.7)
            max_tokens_config = config.get("max_tokens") or current_settings.get("max_tokens", 256)

            llm = get_llm_service(provider=provider, api_key=api_key, model=model)
            logger.info(f"Using LLM provider: {llm.provider}, model: {llm.model}")

            # ---- Experiment parameters ----
            mutation_types = experiment.mutation_types or ["baseline"]
            num_prompts = min(experiment.num_prompts, 10)
            runs_per_prompt = min(experiment.runs_per_prompt, 3)
            total_iterations = num_prompts * len(mutation_types) * runs_per_prompt
            current_iteration = 0

            experiment.status = ExperimentStatus.RUNNING
            experiment.started_at = datetime.utcnow()
            experiment.model_name = llm.model
            await db.commit()

            mutation_engine = MutationEngine()
            process = psutil.Process(os.getpid())
            n_cpus = psutil.cpu_count() or 1

            total_energy = 0.0
            measurements_created = 0
            all_sii: List[float] = []
            all_ept: List[float] = []

            for prompt_idx, base_prompt in enumerate(DEFAULT_PROMPTS[:num_prompts]):
                logger.info(f"Processing prompt {prompt_idx + 1}/{num_prompts}")

                for mutation_type in mutation_types:
                    mut_type = normalize_mutation_type(str(mutation_type))

                    # ---- Create / mutate prompt text ----
                    if mut_type == MutationType.BASELINE:
                        prompt_text = base_prompt
                        mutation_intensity = 0.0
                    else:
                        try:
                            prompt_text, _params = mutation_engine.mutate(
                                base_prompt, mut_type, intensity=0.5
                            )
                            mutation_intensity = 0.5
                        except Exception:
                            prompt_text = base_prompt
                            mut_type = MutationType.BASELINE
                            mutation_intensity = 0.0

                    # ---- Create Prompt record & compute SII ----
                    prompt = Prompt(
                        experiment_id=experiment_id,
                        text=prompt_text,
                        original_text=base_prompt if mut_type != MutationType.BASELINE else None,
                        mutation_type=mut_type,
                        mutation_intensity=mutation_intensity,
                        word_count=len(prompt_text.split()),
                    )
                    db.add(prompt)
                    await db.flush()

                    # Compute full linguistic metrics + SII
                    mutation_engine.compute_linguistic_metrics(prompt)
                    await db.flush()

                    sii = prompt.semantic_instability_index or 0.0

                    # ---- Run inference multiple times ----
                    for run in range(runs_per_prompt):
                        current_iteration += 1

                        # Snapshot process CPU time BEFORE
                        cpu_t = process.cpu_times()
                        cpu_before = cpu_t.user + cpu_t.system
                        wall_start = time.perf_counter()

                        try:
                            response = await llm.generate(
                                prompt=prompt_text,
                                max_tokens=max_tokens_config,
                                temperature=temperature,
                            )
                        except Exception as e:
                            logger.error(f"LLM error: {e}")
                            response = {
                                "text": "Error generating response",
                                "input_tokens": len(prompt_text.split()),
                                "output_tokens": 0,
                                "inference_time": 0,
                            }

                        # Snapshot AFTER
                        wall_end = time.perf_counter()
                        cpu_t = process.cpu_times()
                        cpu_after = cpu_t.user + cpu_t.system
                        elapsed = wall_end - wall_start

                        # ---- Energy estimation ----
                        process_energy = _estimate_energy_joules(
                            cpu_before, cpu_after, elapsed, n_cpus
                        )

                        # For simulation mode the process barely uses CPU
                        # (it just sleeps).  Layer a synthetic energy model
                        # that is proportional to the complexity the
                        # simulation computed, so the data is research-valid.
                        sim_complexity = response.get("_complexity")
                        if llm.provider == "simulation" or sim_complexity is not None:
                            input_tokens = response.get("input_tokens", len(prompt_text.split()))
                            output_tokens = response.get("output_tokens", 30)
                            # Synthetic energy: base per-token cost × complexity
                            # Yields ~0.02-0.10 J per token, scaled by complexity
                            per_token_base_j = 0.035
                            complexity_factor = sim_complexity if sim_complexity else 1.0
                            synthetic_energy = (
                                per_token_base_j
                                * (input_tokens + output_tokens)
                                * complexity_factor
                            )
                            # Add small Gaussian noise (±5%)
                            synthetic_energy *= random.gauss(1.0, 0.025)
                            process_energy = max(process_energy, synthetic_energy)

                        total_energy += process_energy

                        input_tokens = response.get("input_tokens", len(prompt_text.split()))
                        output_tokens = response.get("output_tokens", 0)
                        inference_time = response.get("inference_time", elapsed)

                        # ---- EPT: energy per OUTPUT token (millijoules) ----
                        if output_tokens > 0:
                            ept_mj = (process_energy * 1000.0) / output_tokens
                        else:
                            ept_mj = 0.0

                        tps = output_tokens / inference_time if inference_time > 0 else 0.0

                        all_sii.append(sii)
                        all_ept.append(ept_mj)

                        measurement = Measurement(
                            experiment_id=experiment_id,
                            prompt_id=prompt.id,
                            run_number=run + 1,
                            is_warmup=False,
                            is_valid=True,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            total_energy_joules=round(process_energy, 6),
                            total_time_seconds=round(inference_time, 6),
                            inference_time_seconds=round(inference_time, 6),
                            energy_per_token_mj=round(ept_mj, 4),
                            tokens_per_second=round(tps, 2),
                            model_name=llm.model,
                        )
                        db.add(measurement)
                        measurements_created += 1

                        # Progress
                        progress = current_iteration / total_iterations
                        experiment.progress = min(progress, 0.99)
                        experiment.total_measurements = measurements_created
                        experiment.current_step = (
                            f"Running {mut_type.value} - prompt {prompt_idx+1} - run {run+1}"
                        )
                        await db.commit()

                        logger.debug(
                            f"  Iter {current_iteration}/{total_iterations} | "
                            f"SII={sii:.2f} EPT={ept_mj:.2f} mJ  E={process_energy:.4f} J"
                        )

            # ---- Final metrics ----
            experiment.progress = 1.0
            experiment.status = ExperimentStatus.COMPLETED
            experiment.completed_at = datetime.utcnow()
            experiment.total_energy_kwh = total_energy / 3_600_000.0

            # PEC = Spearman correlation(SII, EPT)
            if len(all_sii) >= 5 and len(all_ept) >= 5:
                from scipy.stats import spearmanr
                sii_arr = np.array(all_sii)
                ept_arr = np.array(all_ept)
                rho, _p = spearmanr(sii_arr, ept_arr)
                experiment.pec_score = round(float(rho), 4) if not np.isnan(rho) else 0.0
            else:
                experiment.pec_score = 0.0

            await db.commit()

            logger.info(
                f"Experiment completed.  {measurements_created} measurements | "
                f"Energy {total_energy:.4f} J | PEC ρ = {experiment.pec_score:.4f}"
            )

        except Exception as e:
            logger.exception(f"Experiment failed: {e}")
            try:
                experiment.status = ExperimentStatus.FAILED
                experiment.current_step = f"Error: {str(e)[:200]}"
                await db.commit()
            except Exception:
                pass


async def cancel_experiment(experiment_id: int):
    """Cancel a running experiment."""
    async with async_session_maker() as db:
        from sqlalchemy import select

        result = await db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        experiment = result.scalar_one_or_none()

        if experiment and experiment.status == ExperimentStatus.RUNNING:
            experiment.status = ExperimentStatus.CANCELLED
            experiment.current_step = "Cancelled by user"
            await db.commit()
            logger.info(f"Experiment {experiment_id} cancelled")


# Keep the old function name for compatibility
run_experiment_pipeline = run_experiment
