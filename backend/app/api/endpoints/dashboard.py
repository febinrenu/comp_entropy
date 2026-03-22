"""
Dashboard API Endpoints
=======================

Real-time dashboard data and WebSocket support.
"""

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import asyncio
import json

from app.core.database import get_db, async_session_maker
from app.models import Experiment, Prompt, Measurement, ExperimentStatus
from app.schemas import DashboardStats

router = APIRouter()

# Store active WebSocket connections
active_connections: List[WebSocket] = []


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db)
):
    """
    Get overview statistics for the dashboard.
    """
    # Total experiments
    total_exp = await db.execute(select(func.count(Experiment.id)))
    
    # Completed experiments
    completed_exp = await db.execute(
        select(func.count(Experiment.id))
        .where(Experiment.status == ExperimentStatus.COMPLETED)
    )
    
    # Total prompts
    total_prompts = await db.execute(select(func.count(Prompt.id)))
    
    # Total measurements
    total_measurements = await db.execute(
        select(func.count(Measurement.id))
        .where(Measurement.is_warmup == False)
    )
    
    # Total energy
    total_energy = await db.execute(
        select(func.sum(Measurement.total_energy_joules))
        .where(Measurement.is_warmup == False)
    )
    
    # Total carbon
    total_carbon = await db.execute(
        select(func.sum(Measurement.carbon_emissions_kg))
    )
    
    # Average PEC score
    avg_pec = await db.execute(
        select(func.avg(Experiment.pec_score))
        .where(Experiment.pec_score != None)
    )
    
    energy_kwh = (total_energy.scalar() or 0) / 3600000  # Convert joules to kWh
    carbon_kg = total_carbon.scalar() or 0
    
    # Count running experiments
    running_exp = await db.execute(
        select(func.count(Experiment.id))
        .where(Experiment.status == ExperimentStatus.RUNNING)
    )
    
    return DashboardStats(
        total_experiments=total_exp.scalar() or 0,
        completed_experiments=completed_exp.scalar() or 0,
        running_experiments=running_exp.scalar() or 0,
        total_prompts=total_prompts.scalar() or 0,
        total_measurements=total_measurements.scalar() or 0,
        total_energy_kwh=energy_kwh,
        total_carbon_kg=carbon_kg,
        avg_pec_score=avg_pec.scalar()
    )


@router.get("/recent-experiments")
async def get_recent_experiments(
    limit: int = 5,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the most recent experiments.
    """
    query = (
        select(Experiment)
        .order_by(Experiment.created_at.desc())
        .limit(limit)
    )
    
    result = await db.execute(query)
    experiments = result.scalars().all()
    
    return [
        {
            "id": e.id,
            "name": e.name,
            "status": e.status.value,
            "progress": e.progress,
            "pec_score": e.pec_score,
            "created_at": e.created_at.isoformat()
        }
        for e in experiments
    ]


@router.get("/running-experiments")
async def get_running_experiments(
    db: AsyncSession = Depends(get_db)
):
    """
    Get currently running experiments.
    """
    query = (
        select(Experiment)
        .where(Experiment.status == ExperimentStatus.RUNNING)
        .order_by(Experiment.started_at.desc())
    )
    
    result = await db.execute(query)
    experiments = result.scalars().all()
    
    return [
        {
            "id": e.id,
            "name": e.name,
            "progress": e.progress,
            "current_step": e.current_step,
            "started_at": e.started_at.isoformat() if e.started_at else None
        }
        for e in experiments
    ]


@router.get("/energy-over-time")
async def get_energy_timeline(
    days: int = 30,
    db: AsyncSession = Depends(get_db)
):
    """
    Get energy consumption over time for charting.
    """
    from datetime import datetime, timedelta
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = (
        select(
            func.date(Measurement.created_at).label("date"),
            func.sum(Measurement.total_energy_joules).label("total_energy"),
            func.count(Measurement.id).label("num_measurements")
        )
        .where(Measurement.created_at >= start_date)
        .where(Measurement.is_warmup == False)
        .group_by(func.date(Measurement.created_at))
        .order_by(func.date(Measurement.created_at))
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        {
            "date": str(row[0]),
            "energy_kwh": (row[1] or 0) / 3600000,
            "measurements": row[2]
        }
        for row in rows
    ]


@router.get("/mutation-comparison")
async def get_mutation_comparison(
    db: AsyncSession = Depends(get_db)
):
    """
    Get energy comparison across mutation types for bar chart.
    SQLite doesn't support stddev, so we calculate avg only.
    """
    query = (
        select(
            Prompt.mutation_type,
            func.avg(Measurement.energy_per_token_mj).label("avg_ept"),
            func.count(Measurement.id).label("n")
        )
        .join(Prompt, Measurement.prompt_id == Prompt.id)
        .where(Measurement.is_warmup == False)
        .where(Measurement.is_valid == True)
        .group_by(Prompt.mutation_type)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        {
            "mutation_type": row[0].value if row[0] else "baseline",
            "mean_energy_per_token_mj": row[1] or 0,
            "std_energy_per_token_mj": 0,  # SQLite doesn't support stddev
            "sample_size": row[2]
        }
        for row in rows
    ]


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates.
    
    Clients can subscribe to experiment updates.
    """
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "subscribe":
                # Client wants to subscribe to experiment updates
                experiment_id = message.get("experiment_id")
                await websocket.send_json({
                    "type": "subscribed",
                    "experiment_id": experiment_id
                })
            
            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        active_connections.remove(websocket)


async def broadcast_experiment_update(experiment_id: int, update: dict):
    """
    Broadcast experiment update to all connected clients.
    """
    message = {
        "type": "experiment_update",
        "experiment_id": experiment_id,
        **update
    }
    
    for connection in active_connections:
        try:
            await connection.send_json(message)
        except:
            # Remove dead connections
            active_connections.remove(connection)


@router.get("/system-status")
async def get_system_status():
    """
    Get current system status including hardware information.
    """
    import psutil
    
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    
    status = {
        "cpu_percent": cpu_percent,
        "memory_percent": memory.percent,
        "memory_used_gb": memory.used / (1024**3),
        "memory_total_gb": memory.total / (1024**3),
        "active_websockets": len(active_connections)
    }
    
    # Try to get GPU info
    try:
        import GPUtil
        gpus = GPUtil.getGPUs()
        if gpus:
            gpu = gpus[0]
            status["gpu"] = {
                "name": gpu.name,
                "utilization_percent": gpu.load * 100,
                "memory_used_mb": gpu.memoryUsed,
                "memory_total_mb": gpu.memoryTotal,
                "temperature_c": gpu.temperature
            }
    except:
        status["gpu"] = None
    
    return status
