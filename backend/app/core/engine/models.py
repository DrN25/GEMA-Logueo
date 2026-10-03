"""
app.core.engine.models
Entidades, tipos y modelos de datos tipados para el Motor de Reglas de Auditoría Geomecánica.
"""

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Optional, Dict, List


class Severity(str, Enum):
    ALERTA = "ALERTA"
    ADVERTENCIA = "ADVERTENCIA"
    VACIO = "VACIO"
    SIN_INFORMACION = "SIN_INFORMACION"


@dataclass
class Anomaly:
    """Representa una inconsistencia o alerta detectada por una regla geomecánica."""
    rule_code: str
    row_excel: int
    celda_padre: str          # Identificador de Sondaje / Taladro
    celda_hija: str           # Corrida / Tramo / Muestra / ID Hijo
    columna: str              # Nombre de la columna o variable afectada
    valor_actual: Any         # Valor registrado en el archivo
    severity: Severity        # ALERTA | ADVERTENCIA | VACIO | SIN_INFORMACION
    mensaje: str              # Descripción técnica del hallazgo
    modulo: str               # "LGG", "Estructural", "Validación RMR", "Cruce General"
    campania: Optional[str] = "N/A"
    geotecnico: Optional[str] = "N/A"
    sector_geotecnico: Optional[str] = "N/A"

    def to_dict(self) -> Dict[str, Any]:
        """Convierte la anomalía a la estructura exacta esperada por FastAPI y el Frontend."""
        return {
            "fila_excel": self.row_excel,
            "celda_padre": self.celda_padre,
            "celda_hija": self.celda_hija,
            "columna": self.columna,
            "valor_actual": self.valor_actual,
            "tipo_incidencia": self.severity.value if isinstance(self.severity, Severity) else str(self.severity),
            "mensaje": self.mensaje,
            "campania": self.campania or "N/A",
            "geotecnico": self.geotecnico or "N/A",
            "sector_geotecnico": self.sector_geotecnico or "N/A",
            "modulo": self.modulo,
            "rule_code": self.rule_code
        }


@dataclass
class GlobalMetrics:
    total_celdas_padre: int = 0
    total_celdas_hija_procesadas: int = 0
    total_ok: int = 0
    total_vacios: int = 0
    total_sin_informacion: int = 0
    total_advertencias: int = 0
    total_alertas: int = 0
    total_celdas_ok: int = 0

    def to_dict(self) -> Dict[str, int]:
        return asdict(self)


@dataclass
class ValidationResult:
    total_filas_procesadas: int
    total_celdas_evaluadas: int
    metricas_globales: GlobalMetrics
    distribucion_filas_campana: Dict[str, int]
    distribucion_geotecnico: Dict[str, int]
    formato_evaluado: str
    incidencias: List[Dict[str, Any]]
    resumen_por_celda_padre: Dict[str, Dict[str, Any]]
    faltantes_no_obligatorios: Dict[str, Any]
    unique_lgg_runs: List[Dict[str, Any]] = field(default_factory=list)
    unique_est_structures: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_filas_procesadas": self.total_filas_procesadas,
            "total_celdas_evaluadas": self.total_celdas_evaluadas,
            "metricas_globales": self.metricas_globales.to_dict(),
            "distribucion_filas_campana": self.distribucion_filas_campana,
            "distribucion_geotecnico": self.distribucion_geotecnico,
            "formato_evaluado": self.formato_evaluado,
            "incidencias": self.incidencias,
            "resumen_por_celda_padre": self.resumen_por_celda_padre,
            "faltantes_no_obligatorios": self.faltantes_no_obligatorios,
            "unique_lgg_runs": self.unique_lgg_runs,
            "unique_est_structures": self.unique_est_structures
        }
