"""
Pydantic Schemas - Simplified for Frontend
==========================================
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ==================== Enums ====================

class ExperimentStatusEnum(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MutationTypeEnum(str, Enum):
    BASELINE = "baseline"
    NOISE_TYPO = "noise_typo"
    NOISE_VERBOSE = "noise_verbose"
    AMBIGUITY_SEMANTIC = "ambiguity_semantic"
    AMBIGUITY_CONTRADICTION = "ambiguity_contradiction"
    NEGATION = "negation"
    REORDERING = "reordering"
    FORMALITY_SHIFT = "formality_shift"
    CODE_SWITCHING = "code_switching"


# ==================== Settings Schemas ====================

class LLMSettings(BaseModel):
    """LLM Provider Settings."""
    provider: str = Field(default="simulation", description="openai, anthropic, or simulation")
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-3.5-turbo"
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "claude-3-haiku-20240307"


class SettingsUpdate(BaseModel):
    """Settings update request."""
    provider: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_model: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    anthropic_model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class SettingsResponse(BaseModel):
    """Settings response."""
    provider: str
    openai_model: str
    anthropic_model: str
    has_openai_key: bool
    has_anthropic_key: bool
    temperature: float
    max_tokens: int


# ==================== Experiment Schemas ====================

class ExperimentConfig(BaseModel):
    """Configuration for experiment."""
    provider: str = Field(default="simulation")
    model: Optional[str] = None
    api_key: Optional[str] = None
    max_tokens: int = Field(default=256, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


class ExperimentCreate(BaseModel):
    """Schema for creating a new experiment."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    mutation_types: List[str] = Field(default=["baseline", "noise_verbose"])
    num_prompts: int = Field(default=5, ge=1, le=50)
    runs_per_prompt: int = Field(default=3, ge=1, le=10)
    warmup_runs: int = Field(default=1, ge=0, le=5)
    config: Optional[ExperimentConfig] = None


class ExperimentUpdate(BaseModel):
    """Schema for updating an experiment."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[ExperimentStatusEnum] = None


class ExperimentResponse(BaseModel):
    """Schema for experiment response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    description: Optional[str] = None
    status: str
    progress: float = 0.0
    current_step: Optional[str] = None
    num_prompts: int = 5
    runs_per_prompt: int = 3
    total_measurements: int = 0
    pec_score: Optional[float] = None
    total_energy_kwh: Optional[float] = None
    total_carbon_kg: Optional[float] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    model_name: Optional[str] = None


class ExperimentSummary(BaseModel):
    """Brief summary of an experiment."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    status: str
    progress: float = 0.0
    total_measurements: int = 0
    pec_score: Optional[float] = None
    created_at: datetime


class ExperimentList(BaseModel):
    """List of experiments with pagination."""
    experiments: List[ExperimentSummary]
    total: int
    page: int
    page_size: int


# ==================== Prompt Schemas ====================

class PromptCreate(BaseModel):
    """Schema for creating a prompt."""
    text: str = Field(..., min_length=1)
    mutation_type: str = Field(default="baseline")


class PromptResponse(BaseModel):
    """Schema for prompt response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    experiment_id: Optional[int] = None
    parent_id: Optional[int] = None
    text: str
    mutation_type: str
    mutation_intensity: float = 0.0
    word_count: Optional[int] = None
    human_ambiguity_score: Optional[float] = None
    semantic_instability_index: Optional[float] = None
    stability_score: Optional[float] = None
    severity_level: Optional[float] = None
    token_count: Optional[int] = None
    created_at: datetime


class PromptList(BaseModel):
    """List of prompts."""
    prompts: List[PromptResponse]
    total: int


class PromptValidation(BaseModel):
    """Schema for human validation of prompts."""
    prompt_id: int
    ambiguity_score: float = Field(..., ge=1.0, le=5.0)
    clarity_score: float = Field(..., ge=1.0, le=5.0)
    rater_id: Optional[str] = None


# ==================== Measurement Schemas ====================

class MeasurementResponse(BaseModel):
    """Schema for measurement response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    experiment_id: int
    prompt_id: int
    run_number: int = 1
    is_warmup: bool = False
    total_energy_joules: Optional[float] = None
    total_time_seconds: Optional[float] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    energy_per_token_mj: Optional[float] = None
    tokens_per_second: Optional[float] = None
    is_valid: bool = True
    created_at: datetime
    prompt: Optional[PromptResponse] = None
    
    # Computed fields for frontend
    @property
    def energy_joules(self) -> Optional[float]:
        return self.total_energy_joules
    
    @property
    def inference_time(self) -> Optional[float]:
        return self.total_time_seconds
    
    @property
    def total_tokens(self) -> Optional[int]:
        if self.input_tokens and self.output_tokens:
            return self.input_tokens + self.output_tokens
        return None


class MeasurementList(BaseModel):
    """List of measurements."""
    measurements: List[MeasurementResponse]
    total: int


class MeasurementAggregation(BaseModel):
    """Aggregated measurements for a prompt or mutation type."""
    group_by: str
    group_value: str
    count: int
    mean_energy_joules: float = 0.0
    std_energy_joules: float = 0.0
    mean_time_seconds: float = 0.0
    mean_energy_per_token_mj: float = 0.0
    mean_tokens_per_second: float = 0.0


# ==================== Analysis Schemas ====================

class AnalysisRequest(BaseModel):
    """Request for analysis."""
    experiment_id: Optional[int] = None
    analysis_type: str = "summary"


class StatisticalSummary(BaseModel):
    """Statistical summary."""
    count: int
    mean_energy: float
    std_energy: float
    min_energy: float
    max_energy: float
    mean_time: float
    mean_tokens_per_second: float
    pec_score: float


class AnalysisResponse(BaseModel):
    """Analysis response."""
    model_config = ConfigDict(from_attributes=True)

    experiment_id: Optional[int] = None
    summary: Optional[StatisticalSummary] = None
    mutation_breakdown: Dict[str, Any] = {}
    energy_timeline: List[Dict[str, Any]] = []


class FullAnalysisReport(BaseModel):
    """Full analysis report with all details."""
    experiment_id: int
    experiment_name: str
    summary: StatisticalSummary
    mutation_breakdown: Dict[str, Any] = {}
    correlations: Dict[str, Any] = {}
    effect_sizes: List[Dict[str, Any]] = []
    recommendations: List[str] = []


# ==================== Dashboard Schemas ====================

class DashboardStats(BaseModel):
    """Dashboard statistics."""
    total_experiments: int = 0
    total_measurements: int = 0
    total_prompts: int = 0
    total_energy_kwh: float = 0.0
    total_carbon_kg: float = 0.0
    avg_pec_score: Optional[float] = None
    running_experiments: int = 0
    completed_experiments: int = 0


class MutationComparison(BaseModel):
    """Mutation type comparison."""
    mutation_type: str
    avg_energy: float
    count: int


# ==================== Export Schemas ====================

class ExportRequest(BaseModel):
    """Export request."""
    experiment_id: Optional[int] = None
    format: str = Field(default="csv", pattern="^(csv|json|pdf)$")
    include_prompts: bool = True
    include_measurements: bool = True
    include_analysis: bool = True
