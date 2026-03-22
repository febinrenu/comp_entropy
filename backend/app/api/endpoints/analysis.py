"""
Analysis API Endpoints
======================

Statistical analysis and reporting endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from app.core.database import get_db
from app.models import Experiment, AnalysisResult, AnalysisType
from app.schemas import AnalysisResponse, FullAnalysisReport
from app.services.analysis_engine import AnalysisEngine

router = APIRouter()


@router.get("/experiment/{experiment_id}", response_model=List[AnalysisResponse])
async def list_analysis_results(
    experiment_id: int,
    analysis_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List all analysis results for an experiment.
    
    - **analysis_type**: Filter by type (correlation, anova, etc.)
    """
    # Verify experiment exists
    exp_result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    if not exp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    query = select(AnalysisResult).where(AnalysisResult.experiment_id == experiment_id)
    
    if analysis_type:
        try:
            at = AnalysisType(analysis_type)
            query = query.where(AnalysisResult.analysis_type == at)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid analysis type: {analysis_type}"
            )
    
    query = query.order_by(AnalysisResult.created_at.desc())
    
    result = await db.execute(query)
    analyses = result.scalars().all()
    
    return [AnalysisResponse.model_validate(a) for a in analyses]


@router.post("/experiment/{experiment_id}/run")
async def run_analysis(
    experiment_id: int,
    background_tasks: BackgroundTasks,
    include_bayesian: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    Run full statistical analysis on an experiment.
    
    This includes:
    - Correlation analysis (Pearson, Spearman, Kendall)
    - ANOVA with post-hoc tests
    - Effect size calculations
    - Bootstrap confidence intervals
    - Optionally: Bayesian hypothesis testing
    """
    # Verify experiment exists and has data
    exp_result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = exp_result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    if experiment.total_measurements < 10:
        raise HTTPException(
            status_code=400,
            detail="Insufficient data for analysis. Need at least 10 measurements."
        )
    
    # Run analysis in background
    background_tasks.add_task(
        AnalysisEngine.run_full_analysis,
        experiment_id,
        include_bayesian
    )
    
    return {
        "status": "started",
        "experiment_id": experiment_id,
        "message": "Analysis started. Results will be available shortly."
    }


@router.get("/experiment/{experiment_id}/pec")
async def get_pec_analysis(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the Prompt Entropy Coefficient (PEC) analysis.
    
    PEC measures the correlation between semantic instability
    and energy consumption.
    """
    # Get correlation analysis for PEC
    query = (
        select(AnalysisResult)
        .where(AnalysisResult.experiment_id == experiment_id)
        .where(AnalysisResult.analysis_type == AnalysisType.CORRELATION)
        .where(AnalysisResult.analysis_name.like("%PEC%"))
        .order_by(AnalysisResult.created_at.desc())
        .limit(1)
    )
    
    result = await db.execute(query)
    pec_analysis = result.scalars().first()
    
    if not pec_analysis:
        # Compute on-the-fly
        engine = AnalysisEngine()
        pec_result = await engine.compute_pec(experiment_id, db)
        return pec_result
    
    is_significant = pec_analysis.is_significant
    if isinstance(is_significant, str):
        is_significant = is_significant.strip().lower() in {"yes", "true", "1", "significant"}

    return {
        "experiment_id": experiment_id,
        "pec_score": pec_analysis.statistic_value,
        "p_value": pec_analysis.p_value,
        "ci_lower": pec_analysis.ci_lower,
        "ci_upper": pec_analysis.ci_upper,
        "interpretation": pec_analysis.interpretation,
        "is_significant": is_significant
    }


@router.get("/experiment/{experiment_id}/correlations")
async def get_correlation_matrix(
    experiment_id: int,
    method: str = Query("pearson", pattern="^(pearson|spearman|kendall)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get correlation matrix between key variables.
    
    Variables include:
    - semantic_instability_index
    - energy_per_token
    - inference_time
    - output_length
    - human_ambiguity_score
    """
    engine = AnalysisEngine()
    matrix = await engine.compute_correlation_matrix(experiment_id, method, db)
    return matrix


@router.get("/experiment/{experiment_id}/anova")
async def get_anova_results(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get ANOVA results comparing mutation types.
    """
    query = (
        select(AnalysisResult)
        .where(AnalysisResult.experiment_id == experiment_id)
        .where(AnalysisResult.analysis_type == AnalysisType.ANOVA)
    )
    
    result = await db.execute(query)
    anova_results = result.scalars().all()
    
    if not anova_results:
        # Compute on-the-fly
        engine = AnalysisEngine()
        anova_result = await engine.run_anova(experiment_id, db)
        return anova_result

    # Prefer the stored detailed ANOVA payload if available.
    first = anova_results[0]
    if first.detailed_results:
        return first.detailed_results

    return {
        "experiment_id": experiment_id,
        "anova": {
            "f_statistic": first.statistic_value,
            "p_value": first.p_value,
            "is_significant": str(first.is_significant).lower() in {"yes", "true", "1"},
        },
        "effect_sizes": {
            "eta_squared": first.effect_size,
            "interpretation": first.effect_size_interpretation,
        },
    }


@router.get("/experiment/{experiment_id}/effect-sizes")
async def get_effect_sizes(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get effect size comparisons between mutation types.
    """
    engine = AnalysisEngine()
    effect_sizes = await engine.compute_effect_sizes(experiment_id, db)
    return effect_sizes


@router.get("/experiment/{experiment_id}/report")
async def get_full_report(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive analysis report for publication.
    
    Includes all statistical analyses, interpretations, and
    recommendations formatted for academic writing.
    """
    # Verify experiment exists
    exp_result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    experiment = exp_result.scalar_one_or_none()
    
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    engine = AnalysisEngine()
    report = await engine.generate_full_report(experiment_id, db)
    
    return report


@router.get("/experiment/{experiment_id}/latex-tables")
async def get_latex_tables(
    experiment_id: int,
    table_type: str = Query("all", pattern="^(all|summary|correlations|anova|effects)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get publication-ready LaTeX tables.
    
    - **table_type**: Which tables to generate
    """
    engine = AnalysisEngine()
    tables = await engine.generate_latex_tables(experiment_id, table_type, db)
    
    return {
        "experiment_id": experiment_id,
        "tables": tables
    }


@router.get("/experiment/{experiment_id}/recommendations")
async def get_recommendations(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get data-driven recommendations based on analysis.
    """
    engine = AnalysisEngine()
    recommendations = await engine.generate_recommendations(experiment_id, db)
    
    return {
        "experiment_id": experiment_id,
        "recommendations": recommendations
    }
