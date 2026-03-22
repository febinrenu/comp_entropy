"""
Prompt Model
============

Database model for prompts and their mutations.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class MutationType(str, enum.Enum):
    """Mutation type enumeration."""
    BASELINE = "baseline"
    NOISE_TYPO = "noise_typo"
    NOISE_VERBOSE = "noise_verbose"
    AMBIGUITY_SEMANTIC = "ambiguity_semantic"
    AMBIGUITY_CONTRADICTION = "ambiguity_contradiction"
    NEGATION = "negation"
    REORDERING = "reordering"
    FORMALITY_SHIFT = "formality_shift"
    CODE_SWITCHING = "code_switching"


class Prompt(Base):
    """
    Prompt model for storing original prompts and mutations.
    
    Tracks the original text, mutation type, mutation parameters,
    and linguistic metrics for analysis.
    """
    __tablename__ = "prompts"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=True, index=True)
    parent_id = Column(Integer, ForeignKey("prompts.id"), nullable=True)
    
    # Content
    text = Column(Text, nullable=False)
    original_text = Column(Text, nullable=True)  # For mutations, store the original
    
    # Classification
    mutation_type = Column(Enum(MutationType), default=MutationType.BASELINE, index=True)
    mutation_intensity = Column(Float, default=0.0)
    mutation_params = Column(JSON, nullable=True)
    
    # Linguistic Metrics (computed)
    word_count = Column(Integer, nullable=True)
    char_count = Column(Integer, nullable=True)
    avg_word_length = Column(Float, nullable=True)
    sentence_count = Column(Integer, nullable=True)
    
    # Readability Scores
    flesch_reading_ease = Column(Float, nullable=True)
    flesch_kincaid_grade = Column(Float, nullable=True)
    gunning_fog = Column(Float, nullable=True)
    smog_index = Column(Float, nullable=True)
    
    # Complexity Metrics
    lexical_diversity = Column(Float, nullable=True)  # Type-Token Ratio
    syntactic_complexity = Column(Float, nullable=True)
    
    # Human Validation
    human_ambiguity_score = Column(Float, nullable=True)
    human_clarity_score = Column(Float, nullable=True)
    human_rater_count = Column(Integer, default=0)
    validation_status = Column(String(50), default="pending")
    
    # Computed Semantic Instability Index
    semantic_instability_index = Column(Float, nullable=True)
    
    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    experiment = relationship("Experiment", back_populates="prompts")
    parent = relationship("Prompt", remote_side=[id], backref="mutations")
    measurements = relationship("Measurement", back_populates="prompt", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Prompt(id={self.id}, type={self.mutation_type}, text='{self.text[:50]}...')>"

    @property
    def stability_score(self):
        """Return normalized stability score (1.0 = stable, 0.0 = unstable)."""
        if self.semantic_instability_index is None:
            return None
        return max(0.0, min(1.0, 1.0 - (self.semantic_instability_index / 5.0)))

    @property
    def severity_level(self):
        """Expose SII as severity for UI compatibility."""
        return self.semantic_instability_index

    @property
    def token_count(self):
        """Approximate token count using word count when tokenization is unavailable."""
        return self.word_count
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "experiment_id": self.experiment_id,
            "parent_id": self.parent_id,
            "text": self.text,
            "mutation_type": self.mutation_type.value,
            "mutation_intensity": self.mutation_intensity,
            "word_count": self.word_count,
            "human_ambiguity_score": self.human_ambiguity_score,
            "semantic_instability_index": self.semantic_instability_index,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
