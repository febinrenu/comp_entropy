"""
Prompts API Endpoints
=====================

Prompt management and mutation operations.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.core.database import get_db
from app.models import Prompt, MutationType, Experiment
from app.schemas import PromptCreate, PromptResponse, PromptValidation, PromptList
from app.services.mutation_engine import MutationEngine

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


def normalize_mutation_type(value: Optional[str]) -> Optional[MutationType]:
    """Normalize user-provided mutation type into enum when possible."""
    if value is None:
        return None
    mapped = MUTATION_TYPE_ALIASES.get(value, value)
    try:
        return MutationType(mapped)
    except ValueError:
        return None


@router.get("/", response_model=PromptList)
async def list_all_prompts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    mutation_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List all prompts with pagination.
    """
    query = select(Prompt)
    
    mt = normalize_mutation_type(mutation_type)
    if mt:
        query = query.where(Prompt.mutation_type == mt)
    
    # Get total count
    count_query = select(func.count(Prompt.id))
    if mt:
        count_query = count_query.where(Prompt.mutation_type == mt)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.order_by(Prompt.created_at.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    prompts = result.scalars().all()
    
    return PromptList(
        prompts=[PromptResponse.model_validate(p) for p in prompts],
        total=total
    )


@router.post("/", response_model=PromptResponse, status_code=201)
async def create_prompt(
    prompt_data: PromptCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new prompt in the library.
    """
    # Parse mutation type
    mt = normalize_mutation_type(prompt_data.mutation_type) or MutationType.BASELINE
    
    # Create prompt
    prompt = Prompt(
        text=prompt_data.text,
        mutation_type=mt,
        word_count=len(prompt_data.text.split()),
        experiment_id=None  # Library prompt, not tied to experiment
    )
    
    db.add(prompt)
    await db.commit()
    await db.refresh(prompt)
    
    return PromptResponse.model_validate(prompt)


@router.delete("/{prompt_id}", status_code=204)
async def delete_prompt(
    prompt_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a prompt.
    """
    result = await db.execute(
        select(Prompt).where(Prompt.id == prompt_id)
    )
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    await db.delete(prompt)
    await db.commit()


@router.get("/experiment/{experiment_id}", response_model=List[PromptResponse])
async def list_prompts_for_experiment(
    experiment_id: int,
    mutation_type: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """
    List all prompts for an experiment.
    
    - **mutation_type**: Filter by mutation type (optional)
    - **limit**: Maximum prompts to return (default: 100)
    - **offset**: Number of prompts to skip (default: 0)
    """
    query = select(Prompt).where(Prompt.experiment_id == experiment_id)
    
    if mutation_type:
        mt = normalize_mutation_type(mutation_type)
        if mt:
            query = query.where(Prompt.mutation_type == mt)
    
    query = query.order_by(Prompt.created_at).offset(offset).limit(limit)
    
    result = await db.execute(query)
    prompts = result.scalars().all()
    
    return [PromptResponse.model_validate(p) for p in prompts]


@router.get("/{prompt_id}", response_model=PromptResponse)
async def get_prompt(
    prompt_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed information about a specific prompt.
    """
    result = await db.execute(
        select(Prompt).where(Prompt.id == prompt_id)
    )
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    return PromptResponse.model_validate(prompt)


@router.post("/mutate", response_model=PromptResponse)
async def mutate_prompt(
    original_text: str,
    mutation_type: str,
    intensity: float = Query(0.5, ge=0.0, le=1.0),
    db: AsyncSession = Depends(get_db)
):
    """
    Apply a mutation to a prompt text.
    
    Returns the mutated text without storing it in the database.
    Useful for previewing mutations before running experiments.
    """
    mt = normalize_mutation_type(mutation_type)
    if not mt:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mutation type: {mutation_type}. "
                   f"Valid types: {[e.value for e in MutationType]}"
        )
    
    engine = MutationEngine()
    mutated_text, params = engine.mutate(original_text, mt, intensity)
    
    # Create a temporary prompt object for response
    temp_prompt = Prompt(
        id=0,
        experiment_id=0,
        text=mutated_text,
        original_text=original_text,
        mutation_type=mt,
        mutation_intensity=intensity,
        mutation_params=params
    )
    
    # Compute linguistic metrics
    engine.compute_linguistic_metrics(temp_prompt)
    
    return PromptResponse.model_validate(temp_prompt)


@router.post("/validate", status_code=201)
async def submit_validation(
    validation: PromptValidation,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit human validation scores for a prompt.
    
    Used to gather human judgments on prompt ambiguity and clarity.
    """
    result = await db.execute(
        select(Prompt).where(Prompt.id == validation.prompt_id)
    )
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    # Update running average
    n = prompt.human_rater_count
    if prompt.human_ambiguity_score is not None:
        prompt.human_ambiguity_score = (
            (prompt.human_ambiguity_score * n + validation.ambiguity_score) / (n + 1)
        )
        prompt.human_clarity_score = (
            (prompt.human_clarity_score * n + validation.clarity_score) / (n + 1)
        )
    else:
        prompt.human_ambiguity_score = validation.ambiguity_score
        prompt.human_clarity_score = validation.clarity_score
    
    prompt.human_rater_count = n + 1
    
    await db.commit()
    
    return {
        "status": "success",
        "prompt_id": prompt.id,
        "total_ratings": prompt.human_rater_count,
        "current_ambiguity_score": prompt.human_ambiguity_score
    }


@router.get("/experiment/{experiment_id}/for-validation")
async def get_prompts_for_validation(
    experiment_id: int,
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    """
    Get prompts that need human validation.
    
    Returns prompts with the fewest ratings first.
    """
    # Check experiment exists
    exp_result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    if not exp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Get prompts needing validation
    query = (
        select(Prompt)
        .where(Prompt.experiment_id == experiment_id)
        .order_by(Prompt.human_rater_count.asc())
        .limit(limit)
    )
    
    result = await db.execute(query)
    prompts = result.scalars().all()
    
    return [
        {
            "id": p.id,
            "text": p.text,
            "mutation_type": p.mutation_type.value,
            "current_ratings": p.human_rater_count
        }
        for p in prompts
    ]


@router.get("/experiment/{experiment_id}/statistics")
async def get_prompt_statistics(
    experiment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistical summary of prompts in an experiment.
    """
    # Check experiment exists
    exp_result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    if not exp_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Count by mutation type
    type_counts = await db.execute(
        select(Prompt.mutation_type, func.count(Prompt.id))
        .where(Prompt.experiment_id == experiment_id)
        .group_by(Prompt.mutation_type)
    )
    
    # Average ambiguity by type
    avg_ambiguity = await db.execute(
        select(
            Prompt.mutation_type,
            func.avg(Prompt.human_ambiguity_score),
            func.avg(Prompt.word_count),
            func.avg(Prompt.semantic_instability_index)
        )
        .where(Prompt.experiment_id == experiment_id)
        .group_by(Prompt.mutation_type)
    )
    
    type_counts_dict = {str(t): c for t, c in type_counts.all()}
    
    ambiguity_stats = {}
    for row in avg_ambiguity.all():
        ambiguity_stats[str(row[0])] = {
            "avg_ambiguity_score": row[1],
            "avg_word_count": row[2],
            "avg_semantic_instability": row[3]
        }
    
    return {
        "experiment_id": experiment_id,
        "counts_by_type": type_counts_dict,
        "statistics_by_type": ambiguity_stats
    }
