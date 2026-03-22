"""
Experiments API Endpoints
=========================

CRUD operations and experiment management.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models import Experiment, ExperimentStatus, Prompt, Measurement, MutationType
from app.schemas import (
    ExperimentCreate, ExperimentUpdate, ExperimentResponse,
    ExperimentSummary, ExperimentList
)
from app.services.experiment_runner import run_experiment_pipeline

router = APIRouter()


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


def normalize_mutation_types(mutation_types: List[str]) -> List[str]:
    """Normalize old mutation IDs and keep only supported values."""
    normalized: List[str] = []
    for value in mutation_types:
        mapped = MUTATION_TYPE_ALIASES.get(value, value)
        try:
            normalized_value = MutationType(mapped).value
        except ValueError:
            normalized_value = MutationType.BASELINE.value
        if normalized_value not in normalized:
            normalized.append(normalized_value)
    return normalized or [MutationType.BASELINE.value]


@router.get("/", response_model=ExperimentList)
async def list_experiments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List all experiments with pagination.
    
    - **page**: Page number (default: 1)
    - **page_size**: Items per page (default: 20)
    - **status**: Filter by status (optional)
    """
    query = select(Experiment).order_by(Experiment.created_at.desc())
    
    if status:
        query = query.where(Experiment.status == status)
    
    # Get total count
    count_query = select(func.count(Experiment.id))
    if status:
        count_query = count_query.where(Experiment.status == status)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    result = await db.execute(query)
    experiments = result.scalars().all()
    
    return ExperimentList(
        experiments=[ExperimentSummary.model_validate(e) for e in experiments],
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("/", response_model=ExperimentResponse, status_code=201)
async def create_experiment(
    experiment: ExperimentCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new experiment.
    
    Configure mutation types, number of prompts, and runs per prompt.
    The experiment will be created in PENDING status.
    """
    # mutation_types are already strings from the frontend
    mutation_types = normalize_mutation_types(
        experiment.mutation_types if experiment.mutation_types else [MutationType.BASELINE.value]
    )
    
    db_experiment = Experiment(
        name=experiment.name,
        description=experiment.description,
        mutation_types=mutation_types,
        num_prompts=experiment.num_prompts,
        runs_per_prompt=experiment.runs_per_prompt,
        warmup_runs=experiment.warmup_runs,
        config=experiment.config.model_dump() if experiment.config else {},
        status=ExperimentStatus.PENDING
    )
    
    db.add(db_experiment)
    await db.commit()
    await db.refresh(db_experiment)
    
    return ExperimentResponse.model_validate(db_experiment)


@router.get("/{experiment_id}", response_model=ExperimentResponse)
async def get_experiment(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed information about a specific experiment.
    """
    result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    return ExperimentResponse.model_validate(experiment)


@router.patch("/{experiment_id}", response_model=ExperimentResponse)
async def update_experiment(
    experiment_id: int,
    experiment_update: ExperimentUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update experiment details.
    
    Only name, description, and status can be updated.
    """
    result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    update_data = experiment_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(experiment, key, value)
    
    await db.commit()
    await db.refresh(experiment)
    
    return ExperimentResponse.model_validate(experiment)


@router.delete("/{experiment_id}", status_code=204)
async def delete_experiment(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete an experiment and all associated data.
    
    This action cannot be undone.
    """
    result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if experiment.status == ExperimentStatus.RUNNING:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a running experiment. Cancel it first."
        )
    
    await db.delete(experiment)
    await db.commit()


@router.post("/{experiment_id}/run", response_model=ExperimentResponse)
async def run_experiment(
    experiment_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Start running an experiment.
    
    The experiment will run in the background. Use WebSocket or
    polling to monitor progress.
    """
    result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if experiment.status == ExperimentStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Experiment is already running")
    
    if experiment.status == ExperimentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Experiment already completed")
    
    # Update status
    experiment.status = ExperimentStatus.RUNNING
    experiment.started_at = datetime.utcnow()
    experiment.progress = 0.0
    experiment.current_step = "Initializing..."
    
    await db.commit()
    await db.refresh(experiment)
    
    # Run in background
    background_tasks.add_task(run_experiment_pipeline, experiment_id)
    
    return ExperimentResponse.model_validate(experiment)


@router.post("/{experiment_id}/cancel", response_model=ExperimentResponse)
async def cancel_experiment(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel a running experiment.
    """
    result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if experiment.status != ExperimentStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Experiment is not running")
    
    experiment.status = ExperimentStatus.CANCELLED
    experiment.current_step = "Cancelled by user"
    
    await db.commit()
    await db.refresh(experiment)
    
    return ExperimentResponse.model_validate(experiment)


@router.get("/{experiment_id}/stats")
async def get_experiment_stats(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed statistics for an experiment.
    """
    result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Count prompts by type
    prompt_counts = await db.execute(
        select(Prompt.mutation_type, func.count(Prompt.id))
        .where(Prompt.experiment_id == experiment_id)
        .group_by(Prompt.mutation_type)
    )
    
    # Count measurements
    measurement_count = await db.execute(
        select(func.count(Measurement.id))
        .where(Measurement.experiment_id == experiment_id)
        .where(Measurement.is_warmup == False)
    )
    
    # Calculate energy stats
    energy_stats = await db.execute(
        select(
            func.sum(Measurement.total_energy_joules),
            func.avg(Measurement.total_energy_joules),
            func.min(Measurement.total_energy_joules),
            func.max(Measurement.total_energy_joules)
        )
        .where(Measurement.experiment_id == experiment_id)
        .where(Measurement.is_warmup == False)
    )
    energy_row = energy_stats.first()
    
    return {
        "experiment_id": experiment_id,
        "prompt_counts": dict(prompt_counts.all()),
        "total_measurements": measurement_count.scalar(),
        "energy_stats": {
            "total_joules": energy_row[0],
            "mean_joules": energy_row[1],
            "min_joules": energy_row[2],
            "max_joules": energy_row[3]
        },
        "duration_seconds": experiment.duration_seconds,
        "pec_score": experiment.pec_score
    }
