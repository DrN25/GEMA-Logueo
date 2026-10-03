"""
app.core.engine.runner
Orquestador del pipeline de evaluación de reglas geomecánicas.
Ejecuta las reglas registradas sobre el ValidationContext y consolida métricas, distribuciones y anomalías.
"""

from collections import defaultdict
from typing import Dict, List, Any, Optional
from app.core.engine.context import ValidationContext
from app.core.engine.models import Anomaly, Severity, GlobalMetrics, ValidationResult
from app.core.engine.registry import RuleRegistry, default_registry


class RuleEngineRunner:
    """Ejecutor del motor de reglas modular."""

    def __init__(self, registry: Optional[RuleRegistry] = None):
        self.registry = registry or default_registry

    def run(self, ctx: ValidationContext, faltantes_no_obligatorios: Optional[Dict[str, Any]] = None) -> ValidationResult:
        """
        Ejecuta todas las reglas aplicables sobre el contexto y produce el ValidationResult
        estructurado compatible con FastAPI y los Dashboards.
        """
        all_anomalies: List[Anomaly] = []
        rules = self.registry.get_all()

        for rule in rules:
            if rule.applies_to(ctx):
                try:
                    anomalies = rule.evaluate(ctx)
                    if anomalies:
                        all_anomalies.extend(anomalies)
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    all_anomalies.append(Anomaly(
                        rule_code="R_SYS_ERR",
                        row_excel=0,
                        celda_padre="SISTEMA",
                        celda_hija="ENGINE",
                        columna="global",
                        valor_actual=None,
                        severity=Severity.ALERTA,
                        mensaje=f"Error interno al evaluar la regla {rule.code} ({rule.name}): {str(e)}",
                        modulo=rule.group
                    ))

        # Contadores y agregaciones por taladro y módulo
        resumen_celdas: Dict[str, Dict[str, Any]] = {}
        filas_por_campana: Dict[str, int] = defaultdict(int)
        filas_por_geotecnico: Dict[str, int] = defaultdict(int)

        total_vacios = 0
        total_sin_informacion = 0
        total_advertencias = 0
        total_alertas = 0

        # Identificar todos los taladros únicos en LGG, Estructural y RMR
        todos_los_taladros = set(ctx.lgg_by_taladro.keys()) | set(ctx.est_by_taladro.keys()) | set(ctx.rmr_by_taladro.keys())
        for t in todos_los_taladros:
            resumen_celdas[t] = {
                "total_hijas": 0,
                "vacios": 0,
                "sin_informacion": 0,
                "advertencias": 0,
                "alertas": 0,
                "estado_celda": "OK",
                "dist_celda": 0.0,
                "campania": "N/A"
            }

        # Contabilizar filas procesadas y distribuciones desde LGG
        for run in ctx.lgg_runs:
            t = run.get("taladro")
            if t and t in resumen_celdas:
                resumen_celdas[t]["total_hijas"] += 1
                camp = str(run.get("campana") or "N/A")
                geo = str(run.get("geologo") or "N/A")
                if camp != "N/A":
                    resumen_celdas[t]["campania"] = camp
                    filas_por_campana[camp] += 1
                if geo != "N/A":
                    filas_por_geotecnico[geo] += 1

        for struct in ctx.est_structures:
            t = struct.get("taladro")
            if t and t in resumen_celdas:
                resumen_celdas[t]["total_hijas"] += 1

        for rmr in ctx.rmr_runs:
            t = rmr.get("sondaje") or rmr.get("taladro")
            if t and t in resumen_celdas:
                resumen_celdas[t]["total_hijas"] += 1

        # Acumular conteos de anomalías
        for anom in all_anomalies:
            t = anom.celda_padre
            sev = anom.severity
            
            if sev == Severity.VACIO:
                total_vacios += 1
                if t in resumen_celdas:
                    resumen_celdas[t]["vacios"] += 1
            elif sev == Severity.SIN_INFORMACION:
                total_sin_informacion += 1
                if t in resumen_celdas:
                    resumen_celdas[t]["sin_informacion"] += 1
            elif sev == Severity.ADVERTENCIA:
                total_advertencias += 1
                if t in resumen_celdas:
                    resumen_celdas[t]["advertencias"] += 1
            elif sev == Severity.ALERTA:
                total_alertas += 1
                if t in resumen_celdas:
                    resumen_celdas[t]["alertas"] += 1

        total_filas = len(ctx.lgg_runs) + len(ctx.est_structures) + len(ctx.rmr_runs)
        total_campos = total_filas * 20

        total_celdas_ok = 0
        total_ok = 0

        for t, r_data in resumen_celdas.items():
            if r_data["alertas"] > 0 or r_data["vacios"] > 0 or r_data["sin_informacion"] > 0:
                r_data["estado_celda"] = "OBSERVADO"
            elif r_data["advertencias"] > 0:
                r_data["estado_celda"] = "ADVERTENCIA"
            else:
                r_data["estado_celda"] = "OK"
                total_celdas_ok += 1

        # Filas sin ninguna incidencia
        filas_con_incidencia = len({(a.celda_padre, a.celda_hija) for a in all_anomalies})
        total_ok = max(0, total_filas - filas_con_incidencia)

        metrics = GlobalMetrics(
            total_celdas_padre=len(resumen_celdas),
            total_celdas_hija_procesadas=total_filas,
            total_ok=total_ok,
            total_vacios=total_vacios,
            total_sin_informacion=total_sin_informacion,
            total_advertencias=total_advertencias,
            total_alertas=total_alertas,
            total_celdas_ok=total_celdas_ok
        )

        # Generar lista de diccionarios de anomalías
        incidencias_dicts = [a.to_dict() for a in all_anomalies]

        return ValidationResult(
            total_filas_procesadas=total_filas,
            total_celdas_evaluadas=total_campos,
            metricas_globales=metrics,
            distribucion_filas_campana=dict(filas_por_campana),
            distribucion_geotecnico=dict(filas_por_geotecnico),
            formato_evaluado=ctx.formato_str,
            incidencias=incidencias_dicts,
            resumen_por_celda_padre=resumen_celdas,
            faltantes_no_obligatorios=faltantes_no_obligatorios or {},
            unique_lgg_runs=[{"taladro": r.get("taladro"), "corrida": r.get("corrida")} for r in ctx.lgg_runs[:500]],
            unique_est_structures=[{"taladro": s.get("taladro"), "profundidad": s.get("profundidad")} for s in ctx.est_structures[:500]]
        )
