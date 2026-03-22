"""
Measurements API Endpoints
==========================

Energy and performance measurement data access.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import Measurement, Prompt, Experiment
from app.schemas import MeasurementResponse, MeasurementAggregation, MeasurementList

router = APIRouter()


@router.get("/", response_model=MeasurementList)
async def list_measurements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    experiment_id: Optional[int] = None,
    include_warmup: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    List measurements with pagination.

    Supports optional filtering by experiment_id.
    """
    query = select(Measurement).options(selectinload(Measurement.prompt))
    count_query = select(func.count(Measurement.id))

    if experiment_id is not None:
        query = query.where(Measurement.experiment_id == experiment_id)
        count_query = count_query.where(Measurement.experiment_id == experiment_id)

    if not include_warmup:
        query = query.where(Measurement.is_warmup == False)
        count_query = count_query.where(Measurement.is_warmup == False)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.order_by(Measurement.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    measurements = result.scalars().all()

    return MeasurementList(
        measurements=[MeasurementResponse.model_validate(m) for m in measurements],
        total=total
    )


@router.get("/experiment/{experiment_id}", response_model=List[MeasurementResponse])
async def list_measurements_for_experiment(
    experiment_id: int,
    include_warmup: bool = False,
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """
    List all measurements for an experiment.
    
    - **include_warmup**: Include warmup runs (default: False)
    - **limit**: Maximum measurements to return
    - **offset**: Number of measurements to skip
    """
    query = (
        select(Measurement)
        .options(selectinload(Measurement.prompt))
        .where(Measurement.experiment_id == experiment_id)
    )
    
    if not include_warmup:
        query = query.where(Measurement.is_warmup == False)
    
    query = query.order_by(Measurement.created_at).offset(offset).limit(limit)
    
    result = await db.execute(query)
    measurements = result.scalars().all()
    
    return [MeasurementResponse.model_validate(m) for m in measurements]


@router.get("/prompt/{prompt_id}", response_model=List[MeasurementResponse])
async def list_measurements_for_prompt(
    prompt_id: int,
    include_warmup: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    List all measurements for a specific prompt.
    """
    query = (
        select(Measurement)
        .options(selectinload(Measurement.prompt))
        .where(Measurement.prompt_id == prompt_id)
    )
    
    if not include_warmup:
        query = query.where(Measurement.is_warmup == False)
    
    query = query.order_by(Measurement.run_number)
    
    result = await db.execute(query)
    measurements = result.scalars().all()
    
    return [MeasurementResponse.model_validate(m) for m in measurements]


@router.get("/{measurement_id}", response_model=MeasurementResponse)
async def get_measurement(
    measurement_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed information about a specific measurement.
    """
    result = await db.execute(
        select(Measurement)
        .options(selectinload(Measurement.prompt))
        .where(Measurement.id == measurement_id)
    )
    measurement = result.scalar_one_or_none()
    
    if not measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")
    
    return MeasurementResponse.model_validate(measurement)


@router.get("/experiment/{experiment_id}/aggregated")
async def get_aggregated_measurements(
    experiment_id: int,
    group_by: str = Query("mutation_type", pattern="^(mutation_type|prompt_id)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated measurement statistics.
    
    - **group_by**: Group results by 'mutation_type' or 'prompt_id'
    """
    # Verify experiment exists
    exp_result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    if not exp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if group_by == "mutation_type":
        query = (
            select(
                Prompt.mutation_type,
                func.count(Measurement.id).label("count"),
                func.avg(Measurement.total_energy_joules).label("mean_energy"),
                func.avg(Measurement.total_time_seconds).label("mean_time"),
                func.avg(Measurement.energy_per_token_mj).label("mean_ept"),
                func.avg(Measurement.tokens_per_second).label("mean_tps")
            )
            .join(Prompt, Measurement.prompt_id == Prompt.id)
            .where(Measurement.experiment_id == experiment_id)
            .where(Measurement.is_warmup == False)
            .group_by(Prompt.mutation_type)
        )
        
        result = await db.execute(query)
        rows = result.all()
        
        return [
            {
                "group_by": "mutation_type",
                "mutation_type": str(row[0].value) if row[0] else "baseline",
                "group_value": str(row[0].value) if row[0] else "baseline",
                "count": row[1],
                "avg_energy": row[2],
                "mean_energy_joules": row[2],
                "std_energy_joules": 0,  # SQLite doesn't support stddev
                "avg_time": row[3],
                "mean_time_seconds": row[3],
                "mean_energy_per_token_mj": row[4],
                "mean_tokens_per_second": row[5]
            }
            for row in rows
        ]
    else:
        # Group by prompt_id
        query = (
            select(
                Measurement.prompt_id,
                func.count(Measurement.id).label("count"),
                func.avg(Measurement.total_energy_joules).label("mean_energy"),
                func.avg(Measurement.total_time_seconds).label("mean_time"),
                func.avg(Measurement.energy_per_token_mj).label("mean_ept"),
                func.avg(Measurement.tokens_per_second).label("mean_tps")
            )
            .where(Measurement.experiment_id == experiment_id)
            .where(Measurement.is_warmup == False)
            .group_by(Measurement.prompt_id)
        )
        
        result = await db.execute(query)
        rows = result.all()
        
        return [
            {
                "group_by": "prompt_id",
                "group_value": str(row[0]),
                "count": row[1],
                "avg_energy": row[2],
                "mean_energy_joules": row[2],
                "std_energy_joules": 0,  # SQLite doesn't support stddev
                "avg_time": row[3],
                "mean_time_seconds": row[3],
                "mean_energy_per_token_mj": row[4],
                "mean_tokens_per_second": row[5]
            }
            for row in rows
        ]


@router.get("/experiment/{experiment_id}/timeline")
async def get_measurement_timeline(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get measurement data formatted for timeline visualization.
    
    Returns data points suitable for time-series charts.
    """
    query = (
        select(
            Measurement.created_at,
            Measurement.total_energy_joules,
            Measurement.energy_per_token_mj,
            Measurement.tokens_per_second,
            Prompt.mutation_type
        )
        .join(Prompt, Measurement.prompt_id == Prompt.id)
        .where(Measurement.experiment_id == experiment_id)
        .where(Measurement.is_warmup == False)
        .order_by(Measurement.created_at)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        {
            "timestamp": row[0].isoformat(),
            "energy_joules": row[1],
            "energy_per_token_mj": row[2],
            "tokens_per_second": row[3],
            "mutation_type": row[4].value if row[4] else "baseline"
        }
        for row in rows
    ]


@router.get("/experiment/{experiment_id}/distribution")
async def get_energy_distribution(
    experiment_id: int,
    bins: int = Query(20, ge=5, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Get energy distribution data for histogram visualization.
    """
    query = (
        select(
            Measurement.total_energy_joules,
            Prompt.mutation_type
        )
        .join(Prompt, Measurement.prompt_id == Prompt.id)
        .where(Measurement.experiment_id == experiment_id)
        .where(Measurement.is_warmup == False)
        .where(Measurement.is_valid == True)
        .where(Measurement.total_energy_joules != None)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    if not rows:
        return {"bins": [], "mutation_types": {}}
    
    # Organize by mutation type
    energy_by_type = {}
    all_energies = []
    
    for energy, m_type in rows:
        m_type_str = m_type.value if m_type else "baseline"
        if m_type_str not in energy_by_type:
            energy_by_type[m_type_str] = []
        energy_by_type[m_type_str].append(energy)
        all_energies.append(energy)
    
    # Calculate bin edges
    min_energy = min(all_energies)
    max_energy = max(all_energies)
    if max_energy == min_energy:
        # Degenerate case: all values are identical
        return {
            "bin_edges": [min_energy, max_energy],
            "bin_centers": [min_energy],
            "mutation_types": {m_type: [len(values)] for m_type, values in energy_by_type.items()}
        }

    bin_width = (max_energy - min_energy) / bins
    bin_edges = [min_energy + i * bin_width for i in range(bins + 1)]
    
    # Calculate histograms
    def histogram(values):
        counts = [0] * bins
        for v in values:
            bin_idx = min(int((v - min_energy) / bin_width), bins - 1)
            counts[bin_idx] += 1
        return counts
    
    mutation_histograms = {
        m_type: histogram(energies)
        for m_type, energies in energy_by_type.items()
    }
    
    return {
        "bin_edges": bin_edges,
        "bin_centers": [(bin_edges[i] + bin_edges[i+1]) / 2 for i in range(bins)],
        "mutation_types": mutation_histograms
    }
