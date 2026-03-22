"""
Experiment Model
================

Database model for experiment tracking and management.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class ExperimentStatus(str, enum.Enum):
    """Experiment status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Experiment(Base):
    """
    Experiment model for tracking research experiments.
    
    An experiment consists of multiple prompts and their mutations,
    each measured for energy consumption and analyzed for correlations.
    """
    __tablename__ = "experiments"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic Information
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Configuration
    config = Column(JSON, nullable=False, default=dict)
    mutation_types = Column(JSON, nullable=False, default=list)
    
    # Experiment Parameters
    num_prompts = Column(Integer, default=100)
    runs_per_prompt = Column(Integer, default=5)
    warmup_runs = Column(Integer, default=2)
    
    # Status & Progress
    status = Column(Enum(ExperimentStatus), default=ExperimentStatus.PENDING)
    progress = Column(Float, default=0.0)
    current_step = Column(String(255), nullable=True)
    
    # Results Summary
    total_measurements = Column(Integer, default=0)
    total_energy_kwh = Column(Float, nullable=True)
    total_carbon_kg = Column(Float, nullable=True)
    pec_score = Column(Float, nullable=True)  # Prompt Entropy Coefficient
    
    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Metadata
    model_name = Column(String(255), nullable=True)
    hardware_info = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    prompts = relationship("Prompt", back_populates="experiment", cascade="all, delete-orphan")
    measurements = relationship("Measurement", back_populates="experiment", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="experiment", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Experiment(id={self.id}, name='{self.name}', status={self.status})>"
    
    @property
    def duration_seconds(self) -> float:
        """Calculate experiment duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return 0.0
    
    def to_summary_dict(self) -> dict:
        """Convert to summary dictionary for API responses."""
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status.value,
            "progress": self.progress,
            "total_measurements": self.total_measurements,
            "pec_score": self.pec_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "duration_seconds": self.duration_seconds
        }
