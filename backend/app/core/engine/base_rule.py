"""
app.core.engine.base_rule
Contrato abstracto BaseRule para la implementación desacoplada de reglas geomecánicas.
"""

from abc import ABC, abstractmethod
from typing import List
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext


class BaseRule(ABC):
    """
    Clase base para toda regla de validación geomecánica (LGG, Estructural, RMR, EOH, Heavy).
    Cada regla implementa su propio código canónico, severidad y lógica de evaluación.
    """
    code: str
    name: str
    severity: Severity = Severity.ALERTA
    group: str = "General"

    def applies_to(self, ctx: ValidationContext) -> bool:
        """Determina si la regla es aplicable al contexto cargado (por ejemplo según formato o módulos presentes)."""
        return True

    @abstractmethod
    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        """
        Ejecuta la regla sobre el contexto y devuelve la lista de anomalías encontradas.
        Si no hay inconsistencias, retorna una lista vacía.
        """
        pass
