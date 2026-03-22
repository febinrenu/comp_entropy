"""
Export API Endpoints
====================

Data export in various formats for publication.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import csv
import io
from datetime import datetime

from app.core.database import get_db
from app.models import Experiment, Prompt, Measurement, AnalysisResult
router = APIRouter()


def mutation_type_value(mutation_type):
    return mutation_type.value if mutation_type is not None else "baseline"


def csv_string(headers, rows):
    """Build CSV text from headers and row values."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    output.seek(0)
    return output.getvalue()


def safe_float(value):
    """Best-effort float conversion for JSON summaries."""
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


@router.get("/measurements")
async def export_measurements(
    format: str = Query("csv", pattern="^(csv|json)$"),
    experiment_id: int | None = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Export measurements across all experiments or a single experiment.
    """
    query = (
        select(Measurement, Prompt.mutation_type, Prompt.text, Prompt.human_ambiguity_score)
        .join(Prompt, Measurement.prompt_id == Prompt.id)
        .where(Measurement.is_warmup == False)
        .order_by(Measurement.created_at.desc())
    )

    if experiment_id is not None:
        query = query.where(Measurement.experiment_id == experiment_id)

    result = await db.execute(query)
    rows = result.all()

    if format == "json":
        payload = [
            {
                "measurement_id": m.id,
                "experiment_id": m.experiment_id,
                "prompt_id": m.prompt_id,
                "mutation_type": mutation_type_value(mt),
                "prompt_text": text,
                "human_ambiguity_score": ambiguity,
                "run_number": m.run_number,
                "total_energy_joules": m.total_energy_joules,
                "energy_per_token_mj": m.energy_per_token_mj,
                "total_time_seconds": m.total_time_seconds,
                "input_tokens": m.input_tokens,
                "output_tokens": m.output_tokens,
                "tokens_per_second": m.tokens_per_second,
                "carbon_emissions_kg": m.carbon_emissions_kg,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m, mt, text, ambiguity in rows
        ]
        filename = f"measurements_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        return StreamingResponse(
            iter([json.dumps(payload, indent=2)]),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "measurement_id", "experiment_id", "prompt_id", "mutation_type", "prompt_text",
        "human_ambiguity_score", "run_number", "total_energy_joules", "energy_per_token_mj",
        "total_time_seconds", "input_tokens", "output_tokens", "tokens_per_second",
        "carbon_emissions_kg", "created_at"
    ])
    for m, mt, text, ambiguity in rows:
        writer.writerow([
            m.id, m.experiment_id, m.prompt_id, mutation_type_value(mt), text[:100], ambiguity,
            m.run_number, m.total_energy_joules, m.energy_per_token_mj, m.total_time_seconds,
            m.input_tokens, m.output_tokens, m.tokens_per_second, m.carbon_emissions_kg,
            m.created_at.isoformat() if m.created_at else None
        ])

    output.seek(0)
    filename = f"measurements_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/experiment/{experiment_id}/csv")
async def export_csv(
    experiment_id: int,
    data_type: str = Query("measurements", pattern="^(measurements|prompts|analysis|all)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Export experiment data as CSV.
    
    - **data_type**: What to export (measurements, prompts, analysis, all)
    """
    # Verify experiment exists
    exp_result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = exp_result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    output = io.StringIO()
    
    if data_type == "measurements" or data_type == "all":
        # Get measurements with prompt info
        query = (
            select(Measurement, Prompt.mutation_type, Prompt.text, Prompt.human_ambiguity_score)
            .join(Prompt, Measurement.prompt_id == Prompt.id)
            .where(Measurement.experiment_id == experiment_id)
            .where(Measurement.is_warmup == False)
        )
        
        result = await db.execute(query)
        rows = result.all()
        
        writer = csv.writer(output)
        writer.writerow([
            "measurement_id", "prompt_id", "mutation_type", "prompt_text",
            "human_ambiguity_score", "run_number", "total_energy_joules",
            "energy_per_token_mj", "total_time_seconds", "input_tokens",
            "output_tokens", "tokens_per_second", "carbon_emissions_kg"
        ])
        
        for m, mt, text, ambiguity in rows:
            writer.writerow([
                m.id, m.prompt_id, mutation_type_value(mt), text[:100], ambiguity, m.run_number,
                m.total_energy_joules, m.energy_per_token_mj, m.total_time_seconds,
                m.input_tokens, m.output_tokens, m.tokens_per_second, m.carbon_emissions_kg
            ])
    
    output.seek(0)
    
    filename = f"experiment_{experiment_id}_{data_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/experiment/{experiment_id}/json")
async def export_json(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Export complete experiment data as JSON.
    """
    # Verify experiment exists
    exp_result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = exp_result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Get all prompts
    prompts_result = await db.execute(
        select(Prompt).where(Prompt.experiment_id == experiment_id)
    )
    prompts = prompts_result.scalars().all()
    
    # Get all measurements
    measurements_result = await db.execute(
        select(Measurement)
        .where(Measurement.experiment_id == experiment_id)
        .where(Measurement.is_warmup == False)
    )
    measurements = measurements_result.scalars().all()
    
    # Get all analysis results
    analysis_result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.experiment_id == experiment_id)
    )
    analyses = analysis_result.scalars().all()
    
    export_data = {
        "experiment": {
            "id": experiment.id,
            "name": experiment.name,
            "description": experiment.description,
            "status": experiment.status.value,
            "config": experiment.config,
            "mutation_types": experiment.mutation_types,
            "num_prompts": experiment.num_prompts,
            "runs_per_prompt": experiment.runs_per_prompt,
            "total_measurements": experiment.total_measurements,
            "pec_score": experiment.pec_score,
            "total_energy_kwh": experiment.total_energy_kwh,
            "created_at": experiment.created_at.isoformat() if experiment.created_at else None,
            "completed_at": experiment.completed_at.isoformat() if experiment.completed_at else None
        },
        "prompts": [p.to_dict() for p in prompts],
        "measurements": [m.to_dict() for m in measurements],
        "analysis_results": [a.to_dict() for a in analyses],
        "export_timestamp": datetime.utcnow().isoformat()
    }
    
    filename = f"experiment_{experiment_id}_full_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    return StreamingResponse(
        iter([json.dumps(export_data, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/experiment/{experiment_id}/latex")
async def export_latex(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Export analysis results as LaTeX tables.
    """
    from app.services.analysis_engine import AnalysisEngine
    
    # Verify experiment exists
    exp_result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = exp_result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    engine = AnalysisEngine()
    tables = await engine.generate_latex_tables(experiment_id, "all", db)
    
    # Build LaTeX document
    latex_content = """\\documentclass{article}
\\usepackage{booktabs}
\\usepackage{siunitx}

\\begin{document}

\\title{Computational Entropy Analysis Report}
\\author{Generated by Computational Entropy Lab}
\\date{\\today}
\\maketitle

\\section{Experiment Summary}
"""
    
    pec_score = f"{experiment.pec_score:.4f}" if experiment.pec_score is not None else "N/A"

    latex_content += f"""
\\begin{{table}}[h]
\\centering
\\caption{{Experiment Overview}}
\\begin{{tabular}}{{ll}}
\\toprule
\\textbf{{Property}} & \\textbf{{Value}} \\\\
\\midrule
Experiment ID & {experiment.id} \\\\
Name & {experiment.name} \\\\
Total Prompts & {experiment.num_prompts} \\\\
Total Measurements & {experiment.total_measurements} \\\\
PEC Score & {pec_score} \\\\
\\bottomrule
\\end{{tabular}}
\\end{{table}}
"""
    
    for table_name, table_content in tables.items():
        latex_content += f"\n\\section{{{table_name}}}\n"
        latex_content += table_content
        latex_content += "\n"
    
    latex_content += "\n\\end{document}"
    
    filename = f"experiment_{experiment_id}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.tex"
    
    return StreamingResponse(
        iter([latex_content]),
        media_type="application/x-latex",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/experiment/{experiment_id}/reproducibility-package")
async def export_reproducibility_package(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Export a complete reproducibility package.
    
    Includes:
    - Raw data (CSV)
    - Experiment configuration
    - Analysis scripts
    - Environment information
    """
    import zipfile
    import platform
    import sys
    
    # Verify experiment exists
    exp_result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = exp_result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Create in-memory zip file
    zip_buffer = io.BytesIO()
    
    prompts_result = await db.execute(
        select(Prompt).where(Prompt.experiment_id == experiment_id)
    )
    prompts = prompts_result.scalars().all()

    measurements_result = await db.execute(
        select(Measurement, Prompt.mutation_type, Prompt.text, Prompt.human_ambiguity_score)
        .join(Prompt, Measurement.prompt_id == Prompt.id)
        .where(Measurement.experiment_id == experiment_id)
        .where(Measurement.is_warmup == False)
    )
    measurements = measurements_result.all()

    analyses_result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.experiment_id == experiment_id)
    )
    analyses = analyses_result.scalars().all()

    model_groups = {}
    for m, _, _, _ in measurements:
        key = m.model_name or experiment.model_name or "unknown-model"
        if key not in model_groups:
            model_groups[key] = {"runs": 0, "ept_sum": 0.0, "latency_sum": 0.0}
        model_groups[key]["runs"] += 1
        model_groups[key]["ept_sum"] += safe_float(m.energy_per_token_mj) or 0.0
        model_groups[key]["latency_sum"] += safe_float(m.total_time_seconds) or 0.0

    model_summary = [
        {
            "model_name": model_name,
            "runs": stats["runs"],
            "mean_ept_mj": (stats["ept_sum"] / stats["runs"]) if stats["runs"] else None,
            "mean_latency_s": (stats["latency_sum"] / stats["runs"]) if stats["runs"] else None,
        }
        for model_name, stats in model_groups.items()
    ]

    hardware_info = experiment.hardware_info or {}
    hardware_label = (
        hardware_info.get("hardware_label")
        or hardware_info.get("gpu_name")
        or hardware_info.get("cpu_model")
        or platform.platform()
    )

    hardware_summary = {
        "observed_environment": hardware_label,
        "runs": len(measurements),
        "mean_ept_mj": (
            sum((safe_float(m.energy_per_token_mj) or 0.0) for m, _, _, _ in measurements) / len(measurements)
            if measurements
            else None
        ),
        "mean_latency_s": (
            sum((safe_float(m.total_time_seconds) or 0.0) for m, _, _, _ in measurements) / len(measurements)
            if measurements
            else None
        ),
        "cross_hardware_consistency_rule": "Replicated runs should satisfy |delta PEC| <= 0.10 after EPT normalization.",
    }

    human_rater_protocol = """# Human-Rater Protocol Appendix

## Purpose
Collect reliable human ambiguity/clarity judgments for prompt-level semantic instability analysis.

## Protocol
1. Recruit at least 3 raters per prompt.
2. Blind mutation type labels from raters.
3. Run 15 calibration prompts before production labeling.
4. Score two fields per prompt: `ambiguity_score` (1-5) and `clarity_score` (1-5).
5. Recompute reliability every 50 prompts.

## Reliability thresholds
- Cohen's kappa >= 0.70
- ICC >= 0.75

## API linkage
- Submit: `POST /api/prompts/validate`
- Queue: `GET /api/prompts/experiment/{id}/for-validation`
"""

    multi_model_protocol = """# Multi-Model Replication Protocol

Hold prompt pool, mutation settings, token limits, temperature, and run counts constant while varying only model.

Minimum recommendation:
- >= 300 non-warmup runs per model
- Report PEC, ANOVA p-value, and effect sizes per model
- Compare direction and magnitude consistency against primary model
"""

    cross_hardware_protocol = """# Cross-Hardware Replication Protocol

Evaluate the same model/prompt set across CPU-only, CPU+GPU, and cloud environments.

Normalization:
- EPT (mJ/token) = total_energy_joules * 1000 / output_tokens
- Compare PEC after normalization

Consistency criterion:
- |delta PEC| <= 0.10 across hardware classes
"""

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        readme = f"""# Reproducibility Package

## Experiment: {experiment.name}
Generated: {datetime.utcnow().isoformat()}

## Contents
- data/measurements.csv
- data/prompts.csv
- data/analysis_results.csv
- config/experiment.json
- replication/model_replication_summary.json
- replication/hardware_replication_summary.json
- protocols/multi_model_replication.md
- protocols/cross_hardware_replication.md
- protocols/human_rater_protocol.md
- protocols/human_rating_sheet_template.csv
- environment.json
"""
        zip_file.writestr("README.md", readme)

        env_info = {
            "python_version": sys.version,
            "platform": platform.platform(),
            "timestamp": datetime.utcnow().isoformat(),
        }
        zip_file.writestr("environment.json", json.dumps(env_info, indent=2))

        config = {
            "id": experiment.id,
            "name": experiment.name,
            "description": experiment.description,
            "config": experiment.config,
            "mutation_types": experiment.mutation_types,
            "num_prompts": experiment.num_prompts,
            "runs_per_prompt": experiment.runs_per_prompt,
            "model_name": experiment.model_name,
            "hardware_info": experiment.hardware_info,
        }
        zip_file.writestr("config/experiment.json", json.dumps(config, indent=2))

        measurement_csv = csv_string(
            [
                "measurement_id", "prompt_id", "model_name", "mutation_type", "prompt_text",
                "human_ambiguity_score", "run_number", "total_energy_joules", "energy_per_token_mj",
                "total_time_seconds", "input_tokens", "output_tokens", "tokens_per_second",
                "carbon_emissions_kg", "created_at",
            ],
            [
                [
                    m.id,
                    m.prompt_id,
                    m.model_name or experiment.model_name,
                    mutation_type_value(mt),
                    (text or "")[:120],
                    ambiguity,
                    m.run_number,
                    m.total_energy_joules,
                    m.energy_per_token_mj,
                    m.total_time_seconds,
                    m.input_tokens,
                    m.output_tokens,
                    m.tokens_per_second,
                    m.carbon_emissions_kg,
                    m.created_at.isoformat() if m.created_at else None,
                ]
                for m, mt, text, ambiguity in measurements
            ],
        )
        zip_file.writestr("data/measurements.csv", measurement_csv)

        prompts_csv = csv_string(
            [
                "prompt_id", "parent_id", "mutation_type", "mutation_intensity", "text",
                "semantic_instability_index", "stability_score", "human_ambiguity_score",
                "human_clarity_score", "human_rater_count", "created_at",
            ],
            [
                [
                    p.id,
                    p.parent_id,
                    mutation_type_value(p.mutation_type),
                    p.mutation_intensity,
                    (p.text or "")[:200],
                    p.semantic_instability_index,
                    p.stability_score,
                    p.human_ambiguity_score,
                    p.human_clarity_score,
                    p.human_rater_count,
                    p.created_at.isoformat() if p.created_at else None,
                ]
                for p in prompts
            ],
        )
        zip_file.writestr("data/prompts.csv", prompts_csv)

        analyses_csv = csv_string(
            [
                "analysis_id", "analysis_type", "analysis_name", "statistic_name", "statistic_value",
                "p_value", "effect_size", "effect_size_type", "ci_lower", "ci_upper", "interpretation",
            ],
            [
                [
                    a.id,
                    a.analysis_type.value if a.analysis_type else None,
                    a.analysis_name,
                    a.statistic_name,
                    a.statistic_value,
                    a.p_value,
                    a.effect_size,
                    a.effect_size_type,
                    a.ci_lower,
                    a.ci_upper,
                    a.interpretation,
                ]
                for a in analyses
            ],
        )
        zip_file.writestr("data/analysis_results.csv", analyses_csv)

        zip_file.writestr("replication/model_replication_summary.json", json.dumps(model_summary, indent=2))
        zip_file.writestr("replication/hardware_replication_summary.json", json.dumps(hardware_summary, indent=2))

        zip_file.writestr("protocols/multi_model_replication.md", multi_model_protocol)
        zip_file.writestr("protocols/cross_hardware_replication.md", cross_hardware_protocol)
        zip_file.writestr("protocols/human_rater_protocol.md", human_rater_protocol)
        zip_file.writestr(
            "protocols/human_rating_sheet_template.csv",
            "prompt_id,rater_id,ambiguity_score_1_to_5,clarity_score_1_to_5,notes\n",
        )
    
    zip_buffer.seek(0)
    
    filename = f"reproducibility_package_{experiment_id}_{datetime.now().strftime('%Y%m%d')}.zip"
    
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
