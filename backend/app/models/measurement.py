"""
Measurement Model
=================

Database model for energy and performance measurements.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Measurement(Base):
    """
    Measurement model for storing energy and performance data.
    
    Each measurement captures a single LLM inference run with
    detailed energy, timing, and output metrics.
    """
    __tablename__ = "measurements"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False, index=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id"), nullable=False, index=True)
    
    # Run Information
    run_number = Column(Integer, nullable=False)
    is_warmup = Column(Boolean, default=False)
    
    # Energy Metrics (in Joules unless specified)
    total_energy_joules = Column(Float, nullable=True)
    cpu_energy_joules = Column(Float, nullable=True)
    gpu_energy_joules = Column(Float, nullable=True)
    ram_energy_joules = Column(Float, nullable=True)
    
    # Power Metrics (in Watts)
    avg_power_watts = Column(Float, nullable=True)
    peak_power_watts = Column(Float, nullable=True)
    
    # Carbon Metrics
    carbon_emissions_kg = Column(Float, nullable=True)
    
    # Timing Metrics (in seconds)
    total_time_seconds = Column(Float, nullable=True)
    time_to_first_token = Column(Float, nullable=True)
    inference_time_seconds = Column(Float, nullable=True)
    
    # Token Metrics
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    
    # Computed Efficiency Metrics
    energy_per_token_mj = Column(Float, nullable=True)  # millijoules
    tokens_per_second = Column(Float, nullable=True)
    energy_per_second = Column(Float, nullable=True)
    
    # Output Information
    output_text = Column(Text, nullable=True)
    output_length = Column(Integer, nullable=True)
    
    # Hardware State
    gpu_utilization = Column(Float, nullable=True)
    gpu_memory_used_mb = Column(Float, nullable=True)
    cpu_utilization = Column(Float, nullable=True)
    ram_used_mb = Column(Float, nullable=True)
    
    # Temperature
    gpu_temperature_c = Column(Float, nullable=True)
    cpu_temperature_c = Column(Float, nullable=True)
    
    # Model Information
    model_name = Column(String(255), nullable=True)
    model_params = Column(JSON, nullable=True)
    
    # Quality Flags
    is_valid = Column(Boolean, default=True)
    quality_flags = Column(JSON, nullable=True)  # Any issues detected
    
    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    experiment = relationship("Experiment", back_populates="measurements")
    prompt = relationship("Prompt", back_populates="measurements")
    
    def __repr__(self):
        return f"<Measurement(id={self.id}, prompt_id={self.prompt_id}, energy={self.total_energy_joules}J)>"
    
    def compute_derived_metrics(self):
        """Compute derived efficiency metrics.

        EPT = energy (mJ) / output_tokens.  This is the canonical
        definition used throughout the project – experiment runner,
        demo data generator, and analysis engine all agree on it.
        """
        if self.output_tokens and self.output_tokens > 0:
            if self.total_energy_joules is not None:
                self.energy_per_token_mj = (self.total_energy_joules * 1000) / self.output_tokens
            if self.inference_time_seconds and self.inference_time_seconds > 0:
                self.tokens_per_second = self.output_tokens / self.inference_time_seconds
            elif self.total_time_seconds and self.total_time_seconds > 0:
                self.tokens_per_second = self.output_tokens / self.total_time_seconds
        
        if self.total_time_seconds and self.total_time_seconds > 0 and self.total_energy_joules:
            self.energy_per_second = self.total_energy_joules / self.total_time_seconds
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "experiment_id": self.experiment_id,
            "prompt_id": self.prompt_id,
            "run_number": self.run_number,
            "is_warmup": self.is_warmup,
            "total_energy_joules": self.total_energy_joules,
            "total_time_seconds": self.total_time_seconds,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "energy_per_token_mj": self.energy_per_token_mj,
            "tokens_per_second": self.tokens_per_second,
            "is_valid": self.is_valid,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
