"""
app.core.engine
Paquete del Motor de Reglas Modular de Auditoría Geomecánica.
"""

from app.core.engine.models import Anomaly, Severity, GlobalMetrics, ValidationResult
from app.core.engine.base_rule import BaseRule
from app.core.engine.context import ValidationContext
from app.core.engine.registry import RuleRegistry, default_registry
from app.core.engine.runner import RuleEngineRunner

__all__ = [
    "Anomaly",
    "Severity",
    "GlobalMetrics",
    "ValidationResult",
    "BaseRule",
    "ValidationContext",
    "RuleRegistry",
    "default_registry",
    "RuleEngineRunner",
]
