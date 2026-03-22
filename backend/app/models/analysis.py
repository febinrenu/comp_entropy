"""
Analysis Result Model
=====================

Database model for statistical analysis results.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class AnalysisType(str, enum.Enum):
    """Analysis type enumeration."""
    CORRELATION = "correlation"
    ANOVA = "anova"
    REGRESSION = "regression"
    EFFECT_SIZE = "effect_size"
    BOOTSTRAP = "bootstrap"
    BAYESIAN = "bayesian"
    SUMMARY = "summary"


class AnalysisResult(Base):
    """
    Analysis result model for storing statistical analysis outputs.
    
    Stores various types of statistical analyses performed on
    experiment data, including correlations, ANOVA, effect sizes, etc.
    """
    __tablename__ = "analysis_results"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=False, index=True)
    
    # Analysis Information
    analysis_type = Column(Enum(AnalysisType), nullable=False, index=True)
    analysis_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Variables Analyzed
    independent_var = Column(String(255), nullable=True)
    dependent_var = Column(String(255), nullable=True)
    control_vars = Column(JSON, nullable=True)
    
    # Core Results
    statistic_value = Column(Float, nullable=True)
    statistic_name = Column(String(50), nullable=True)  # e.g., "r", "F", "t", "χ²"
    p_value = Column(Float, nullable=True)
    
    # Confidence Intervals
    ci_lower = Column(Float, nullable=True)
    ci_upper = Column(Float, nullable=True)
    ci_level = Column(Float, default=0.95)
    
    # Effect Size
    effect_size = Column(Float, nullable=True)
    effect_size_type = Column(String(50), nullable=True)  # e.g., "cohen_d", "eta_squared", "r_squared"
    effect_size_interpretation = Column(String(50), nullable=True)  # "small", "medium", "large"
    
    # Sample Information
    sample_size = Column(Integer, nullable=True)
    degrees_of_freedom = Column(Float, nullable=True)
    
    # Power Analysis
    statistical_power = Column(Float, nullable=True)
    
    # Extended Results (JSON for complex outputs)
    detailed_results = Column(JSON, nullable=True)
    
    # Interpretation
    is_significant = Column(String(10), nullable=True)  # Yes/No/Marginal
    interpretation = Column(Text, nullable=True)
    
    # Metadata
    method = Column(String(255), nullable=True)
    assumptions_met = Column(JSON, nullable=True)
    warnings = Column(JSON, nullable=True)
    
    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    computation_time_seconds = Column(Float, nullable=True)
    
    # Relationships
    experiment = relationship("Experiment", back_populates="analysis_results")
    
    def __repr__(self):
        return f"<AnalysisResult(id={self.id}, type={self.analysis_type}, name='{self.analysis_name}')>"
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "experiment_id": self.experiment_id,
            "analysis_type": self.analysis_type.value,
            "analysis_name": self.analysis_name,
            "statistic_name": self.statistic_name,
            "statistic_value": self.statistic_value,
            "p_value": self.p_value,
            "ci_lower": self.ci_lower,
            "ci_upper": self.ci_upper,
            "effect_size": self.effect_size,
            "effect_size_type": self.effect_size_type,
            "is_significant": self.is_significant,
            "interpretation": self.interpretation,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    def to_latex_row(self) -> str:
        """Format as LaTeX table row for publications."""
        p_str = f"{self.p_value:.4f}" if self.p_value else "—"
        stat_str = f"{self.statistic_value:.3f}" if self.statistic_value else "—"
        effect_str = f"{self.effect_size:.3f}" if self.effect_size else "—"
        ci_str = f"[{self.ci_lower:.3f}, {self.ci_upper:.3f}]" if self.ci_lower and self.ci_upper else "—"
        
        return f"{self.analysis_name} & {stat_str} & {p_str} & {effect_str} & {ci_str} \\\\"
