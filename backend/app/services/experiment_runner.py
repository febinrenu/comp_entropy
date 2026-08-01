"""
Experiment Runner — Robust & Consistent
========================================

Runs experiments with:
- Real energy measurement (NVML GPU wattage when available, via
  energy_monitor.py) instead of a from-scratch ad hoc CPU-TDP estimate.
  Simulation-mode measurements use an explicit, clearly-labeled synthetic
  formula instead -- never silently blended with real readings.
- Per-prompt SII computation via MutationEngine.
- A length-matched variant of every non-baseline mutation, so a
  length confound can be tested for rather than assumed away.
- Consistent EPT formula (energy_mJ / output_tokens).
- Correct PEC as Spearman correlation(SII, EPT), computed only over
  valid (non-failed) measurements.
- Real cancellation: the run loop re-checks the experiment's DB status
  periodically and stops (without overwriting to COMPLETED) if cancelled.
"""

import asyncio
import json
import random
from datetime import datetime
from typing import List, Optional

import numpy as np
from app.core.logger import logger

from app.core.database import async_session_maker
from app.core.paths import DATA_DIR
from app.models import (
    Experiment, Prompt, Measurement, ExperimentStatus, MutationType,
    MeasurementSource, MeasurementVariant,
)
from app.services.corpus import PROMPT_CORPUS
from app.services.llm_service import get_llm_service
from app.services.mutation_engine import MutationEngine, length_match, word_count_tokenizer
from app.services.energy_monitor import energy_monitor


# Settings file path
SETTINGS_FILE = DATA_DIR / "settings.json"

# Serializes hardware energy measurement across concurrently-running
# experiments -- energy_monitor is a single process-wide instance, so two
# overlapping start()/stop() windows would corrupt each other's readings.
_energy_measurement_lock = asyncio.Lock()


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
        "provider": "ollama",
        "ollama_host": "http://localhost:11434",
        "ollama_model": "phi3.5:3.8b",
        "openai_api_key": None,
        "openai_model": "gpt-3.5-turbo",
        "anthropic_api_key": None,
        "anthropic_model": "claude-3-haiku-20240307",
        "temperature": 0.7,
        "max_tokens": 256,
    }


async def _generate_and_measure(llm, prompt_text: str, max_tokens: int, temperature: float):
    """Run one generation call wrapped in real energy measurement.

    Returns (response_dict, energy_joules, measurement_source, energy_result).
    For simulation-mode/fallback responses, hardware readings taken during
    the call are not meaningful (the simulation path just sleeps rather
    than doing real computational work), so a clearly-labeled synthetic
    energy formula is used instead of the energy_monitor result.
    """
    async with _energy_measurement_lock:
        energy_monitor.start()
        try:
            response = await llm.generate(
                prompt=prompt_text, max_tokens=max_tokens, temperature=temperature
            )
        finally:
            energy_result = energy_monitor.stop()

    used_simulation = response.get("used_simulation_fallback", False)
    sim_complexity = response.get("_complexity")

    if used_simulation or sim_complexity is not None:
        input_tokens = response.get("input_tokens", len(prompt_text.split()))
        output_tokens = response.get("output_tokens", 30)
        per_token_base_j = 0.035
        complexity_factor = sim_complexity if sim_complexity else 1.0
        synthetic_energy = per_token_base_j * (input_tokens + output_tokens) * complexity_factor
        synthetic_energy *= random.gauss(1.0, 0.025)
        energy_joules = max(synthetic_energy, 1e-6)
        source = MeasurementSource.SYNTHETIC_SIMULATION
    else:
        energy_joules = energy_result["total_energy_joules"]
        source = (
            MeasurementSource.NVML_REAL
            if energy_result["is_gpu_energy_real"]
            else MeasurementSource.TDP_PROXY
        )

    return response, energy_joules, source, energy_result


async def _refresh_status(db, experiment_id: int) -> Optional[ExperimentStatus]:
    """Re-fetch the experiment's status from the DB. Needed because
    cancel_experiment() runs in a different request/session -- the
    in-memory `experiment` object in this coroutine's session won't
    otherwise observe a status change committed elsewhere."""
    from sqlalchemy import select

    result = await db.execute(
        select(Experiment.status).where(Experiment.id == experiment_id)
    )
    row = result.first()
    return row[0] if row else None


async def run_experiment(experiment_id: int):
    """
    Main experiment runner.

    1. Loads settings & initialises LLM service (default: Ollama, real
       local model, real GPU energy where available).
    2. For each (prompt x mutation x {raw, length_matched} x run):
        a. Mutate the prompt (or keep baseline)
        b. Compute linguistic metrics & SII
        c. Measure real energy (NVML) around the generation call
        d. Derive EPT, tokens/s
    3. Compute PEC = Spearman(SII, EPT) over valid measurements and store.
    """
    async with async_session_maker() as db:
        experiment = None
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
            provider = config.get("provider") or current_settings.get("provider", "ollama")
            api_key = config.get("api_key") or (
                current_settings.get("openai_api_key") if provider == "openai" else
                current_settings.get("anthropic_api_key") if provider == "anthropic" else
                None
            )
            model = config.get("model") or (
                current_settings.get("openai_model") if provider == "openai" else
                current_settings.get("anthropic_model") if provider == "anthropic" else
                current_settings.get("ollama_model") if provider == "ollama" else
                None
            )
            temperature = config.get("temperature") or current_settings.get("temperature", 0.7)
            max_tokens_config = config.get("max_tokens") or current_settings.get("max_tokens", 256)

            llm = get_llm_service(provider=provider, api_key=api_key, model=model)
            logger.info(f"Using LLM provider: {llm.provider}, model: {llm.model}")

            # ---- Experiment parameters ----
            # Capped only by the real prompt corpus size and the schema's
            # own advertised limits (ExperimentCreate: num_prompts<=50,
            # runs_per_prompt<=10) -- not by an arbitrary, undocumented,
            # silently-applied ceiling.
            mutation_types = experiment.mutation_types or ["baseline"]
            num_prompts = min(experiment.num_prompts, len(PROMPT_CORPUS))
            runs_per_prompt = min(experiment.runs_per_prompt, 10)
            warmup_runs = max(0, min(experiment.warmup_runs, 5))

            # Every non-baseline mutation also gets a length-matched
            # variant measured alongside the raw one (baseline's matched
            # variant would be identical to itself, so it's not duplicated).
            variants_per_condition = 2
            total_iterations = num_prompts * (
                runs_per_prompt  # baseline: 1 variant
                + (len(mutation_types) - (1 if "baseline" in mutation_types else 0))
                * variants_per_condition * runs_per_prompt
            )
            current_iteration = 0

            experiment.status = ExperimentStatus.RUNNING
            experiment.started_at = datetime.utcnow()
            experiment.model_name = llm.model
            await db.commit()

            mutation_engine = MutationEngine()

            total_energy = 0.0
            measurements_created = 0
            all_sii: List[float] = []
            all_ept: List[float] = []
            cancelled = False

            for prompt_idx, corpus_item in enumerate(PROMPT_CORPUS[:num_prompts]):
                base_prompt = corpus_item["text"]
                logger.info(f"Processing prompt {prompt_idx + 1}/{num_prompts}")

                # Check for cancellation between prompts, not just at the
                # very end -- previously the loop never re-checked status,
                # so a cancelled experiment silently flipped back to
                # COMPLETED once the loop finished naturally regardless.
                current_status = await _refresh_status(db, experiment_id)
                if current_status == ExperimentStatus.CANCELLED:
                    cancelled = True
                    break

                for mutation_type in mutation_types:
                    if cancelled:
                        break
                    mut_type = normalize_mutation_type(str(mutation_type))

                    # ---- Build the variant list: raw (+ length-matched
                    # for non-baseline conditions) ----
                    variants = []
                    if mut_type == MutationType.BASELINE:
                        variants.append((MeasurementVariant.RAW, base_prompt, 0.0))
                    else:
                        mutated_text, _params = mutation_engine.mutate(
                            base_prompt, mut_type, intensity=0.5
                        )
                        variants.append((MeasurementVariant.RAW, mutated_text, 0.5))

                        # Length-matched variant. Note: length matching
                        # here uses a whitespace word-count approximation
                        # (word_count_tokenizer), not the real model
                        # tokenizer -- Ollama's HTTP API doesn't expose a
                        # standalone tokenize call, and loading a full HF
                        # tokenizer just for counting is out of scope here.
                        # This is a coarser length match than the
                        # standalone research pipeline's real-tokenizer
                        # version; the *recorded* input/output token
                        # counts on the Measurement row are still the
                        # real counts Ollama reports post-generation.
                        matched = length_match(word_count_tokenizer, base_prompt, mutated_text)
                        variants.append((MeasurementVariant.LENGTH_MATCHED, matched["text"], 0.5))

                    for variant_label, prompt_text, mutation_intensity in variants:
                        if cancelled:
                            break

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

                        mutation_engine.compute_linguistic_metrics(prompt)
                        await db.flush()

                        sii = prompt.semantic_instability_index or 0.0

                        # ---- Warmup runs: discarded from stats, flagged
                        # is_warmup=True, not counted toward progress ----
                        for _ in range(warmup_runs):
                            try:
                                await _generate_and_measure(
                                    llm, prompt_text, max_tokens_config, temperature
                                )
                            except Exception as e:
                                logger.warning(f"Warmup call failed (ignored): {e}")

                        # ---- Timed runs ----
                        for run in range(runs_per_prompt):
                            current_iteration += 1

                            call_failed = False
                            energy_result = None
                            try:
                                response, energy_joules, source, energy_result = (
                                    await _generate_and_measure(
                                        llm, prompt_text, max_tokens_config, temperature
                                    )
                                )
                                inference_time = response.get("inference_time", energy_result["duration_seconds"])
                                input_tokens = response.get("input_tokens", len(prompt_text.split()))
                                output_tokens = response.get("output_tokens", 0)
                                output_text = response.get("text", "")
                            except Exception as e:
                                logger.error(f"LLM error, marking measurement invalid: {e}")
                                call_failed = True
                                energy_joules = 0.0
                                source = MeasurementSource.TDP_PROXY
                                inference_time = 0.0
                                input_tokens = len(prompt_text.split())
                                output_tokens = 0
                                output_text = None

                            # Per-component breakdown from energy_monitor,
                            # when this measurement actually used it (i.e.
                            # not the synthetic-simulation override, whose
                            # hardware readings during a sleep() aren't
                            # representative of anything and are left null
                            # rather than stored as if real).
                            has_real_breakdown = (
                                energy_result is not None and source != MeasurementSource.SYNTHETIC_SIMULATION
                            )

                            total_energy += energy_joules

                            # EPT: energy per OUTPUT token (millijoules).
                            # A failed call has no meaningful EPT -- it is
                            # marked is_valid=False and excluded from the
                            # SII/EPT correlation arrays below, rather
                            # than being recorded as "0 energy per token"
                            # (which would silently bias the statistics
                            # toward under-estimating energy).
                            is_valid = not call_failed and output_tokens > 0
                            ept_mj = (energy_joules * 1000.0) / output_tokens if is_valid else None
                            tps = (output_tokens / inference_time) if (is_valid and inference_time > 0) else None

                            if is_valid:
                                all_sii.append(sii)
                                all_ept.append(ept_mj)

                            measurement = Measurement(
                                experiment_id=experiment_id,
                                prompt_id=prompt.id,
                                run_number=run + 1,
                                is_warmup=False,
                                is_valid=is_valid,
                                variant=variant_label,
                                measurement_source=source,
                                input_tokens=input_tokens,
                                output_tokens=output_tokens,
                                total_tokens=(input_tokens + output_tokens) if is_valid else None,
                                total_energy_joules=round(energy_joules, 6),
                                cpu_energy_joules=round(energy_result["cpu_energy_joules"], 6) if has_real_breakdown else None,
                                gpu_energy_joules=round(energy_result["gpu_energy_joules"], 6) if has_real_breakdown else None,
                                ram_energy_joules=round(energy_result["ram_energy_joules"], 6) if has_real_breakdown else None,
                                avg_power_watts=round(energy_result["avg_power_watts"], 4) if has_real_breakdown else None,
                                peak_power_watts=round(energy_result["peak_power_watts"], 4) if has_real_breakdown else None,
                                carbon_emissions_kg=energy_result["carbon_kg"] if has_real_breakdown else None,
                                gpu_utilization=energy_result["gpu_utilization"] if has_real_breakdown else None,
                                gpu_memory_used_mb=energy_result["gpu_memory_mb"] if has_real_breakdown else None,
                                cpu_utilization=energy_result["cpu_utilization"] if has_real_breakdown else None,
                                ram_used_mb=energy_result["ram_used_mb"] if has_real_breakdown else None,
                                gpu_temperature_c=energy_result["gpu_temp_c"] if has_real_breakdown else None,
                                total_time_seconds=round(inference_time, 6),
                                inference_time_seconds=round(inference_time, 6),
                                energy_per_token_mj=round(ept_mj, 4) if ept_mj is not None else None,
                                tokens_per_second=round(tps, 2) if tps is not None else None,
                                output_text=output_text,
                                output_length=len(output_text) if output_text else None,
                                model_name=llm.model,
                                quality_flags={"llm_call_failed": True} if call_failed else None,
                            )
                            db.add(measurement)
                            measurements_created += 1

                            progress = current_iteration / total_iterations if total_iterations else 1.0
                            experiment.progress = min(progress, 0.99)
                            experiment.total_measurements = measurements_created
                            experiment.current_step = (
                                f"Running {mut_type.value}/{variant_label.value} - "
                                f"prompt {prompt_idx+1} - run {run+1}"
                            )
                            await db.commit()

                            # Push a real progress update to any connected
                            # Live Monitor WebSocket clients. Previously
                            # this function existed but was never called
                            # anywhere -- the frontend's "Live Monitor"
                            # had nothing real to subscribe to and faked
                            # its own random data instead. A broadcast
                            # failure must never abort the experiment run.
                            try:
                                from app.api.endpoints.dashboard import broadcast_experiment_update
                                await broadcast_experiment_update(experiment_id, {
                                    "status": experiment.status.value,
                                    "progress": experiment.progress,
                                    "current_step": experiment.current_step,
                                    "total_measurements": measurements_created,
                                    "last_sii": sii,
                                    "last_ept_mj": ept_mj,
                                    "last_tokens_per_second": tps,
                                    "last_measurement_source": source.value,
                                })
                            except Exception as e:
                                logger.debug(f"WebSocket broadcast skipped: {e}")

                            logger.debug(
                                f"  Iter {current_iteration}/{total_iterations} | "
                                f"SII={sii:.2f} EPT={ept_mj} mJ  E={energy_joules:.4f} J "
                                f"source={source.value} valid={is_valid}"
                            )

                            # Periodic cancellation check inside the innermost
                            # loop too, so a long runs_per_prompt doesn't
                            # delay honoring a cancel request.
                            if current_iteration % 5 == 0:
                                current_status = await _refresh_status(db, experiment_id)
                                if current_status == ExperimentStatus.CANCELLED:
                                    cancelled = True
                                    break

            # ---- Final metrics ----
            if cancelled:
                experiment.status = ExperimentStatus.CANCELLED
                experiment.current_step = "Cancelled by user"
                experiment.completed_at = datetime.utcnow()
            else:
                experiment.progress = 1.0
                experiment.status = ExperimentStatus.COMPLETED
                experiment.completed_at = datetime.utcnow()

            experiment.total_energy_kwh = total_energy / 3_600_000.0

            # PEC = Spearman correlation(SII, EPT), valid measurements only
            if len(all_sii) >= 5 and len(all_ept) >= 5:
                from scipy.stats import spearmanr
                rho, _p = spearmanr(np.array(all_sii), np.array(all_ept))
                experiment.pec_score = round(float(rho), 4) if not np.isnan(rho) else 0.0
            else:
                experiment.pec_score = 0.0

            await db.commit()

            logger.info(
                f"Experiment {'cancelled' if cancelled else 'completed'}. "
                f"{measurements_created} measurements | "
                f"Energy {total_energy:.4f} J | PEC rho = {experiment.pec_score:.4f}"
            )

        except Exception as e:
            logger.exception(f"Experiment failed: {e}")
            if experiment is not None:
                try:
                    experiment.status = ExperimentStatus.FAILED
                    experiment.current_step = f"Error: {str(e)[:200]}"
                    await db.commit()
                except Exception:
                    pass


async def cancel_experiment(experiment_id: int):
    """Cancel a running experiment. run_experiment()'s loop re-checks this
    status periodically (see _refresh_status calls above) and will stop
    without overwriting it back to COMPLETED -- previously the run loop
    never re-checked status at all, so this call had no real effect on an
    already-started run."""
    async with async_session_maker() as db:
        from sqlalchemy import select

        result = await db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        experiment = result.scalar_one_or_none()

        if experiment and experiment.status in (ExperimentStatus.RUNNING, ExperimentStatus.PENDING):
            experiment.status = ExperimentStatus.CANCELLED
            experiment.current_step = "Cancelled by user"
            await db.commit()
            logger.info(f"Experiment {experiment_id} cancelled")


# Keep the old function name for compatibility
run_experiment_pipeline = run_experiment
