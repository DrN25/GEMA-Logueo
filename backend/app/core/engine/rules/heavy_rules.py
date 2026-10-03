"""
app.core.engine.rules.heavy_rules
Reglas geomecánicas avanzadas con lógica contextual multi-corrida, análisis de dependencias y ventanas móviles.
"""

from typing import List, Dict, Any, Optional
from app.core.engine.base_rule import BaseRule
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext


class DependentFieldsIncompleteRule(BaseRule):
    """
    Detecta y agrupa campos calculados erróneos debido a dependencias vacías o mal calculadas en LGG/RMR.
    Aplica a: FRF, Fracturas Naturales, Total de Fracturas, FF/1m, Espaciamiento.
    Aísla la causa raíz para evitar que se reporten como simples 'campos negativos'.
    """
    code = "R_DEP_INCOMPLETE"
    name = "Campo Erróneo Debido a Dependencias Vacías o Mal Calculadas"
    group = "Validación RMR"
    severity = Severity.ALERTA

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        # 1. Evaluación en LGG
        for taladro, runs in ctx.lgg_by_taladro.items():
            for run in runs:
                r_idx = run.get("_fila_excel", 0)
                corrida = run.get("corrida", 0)
                celda_hija = f"{taladro}-C{corrida}"
                camp = str(run.get("campana") or "N/A")
                geo = str(run.get("geologo") or "N/A")

                lrf = run.get("lrf_m")
                frf = run.get("frf")
                fn = run.get("frac_nat")

                # Si FRF o Fracturas Naturales son negativas por dependencias mal ingresadas
                if (frf is not None and frf < 0) or (fn is not None and fn < 0):
                    anomalies.append(Anomaly(
                        rule_code="R130",
                        row_excel=r_idx,
                        celda_padre=taladro,
                        celda_hija=celda_hija,
                        columna="frf" if (frf is not None and frf < 0) else "frac_nat",
                        valor_actual=frf if (frf is not None and frf < 0) else fn,
                        severity=Severity.ALERTA,
                        mensaje="Campo erróneo debido a dependencias vacías o mal calculadas en LGG/RMR. Requiere verificación de LRF y fracturamiento.",
                        modulo="LGG",
                        campania=camp,
                        geotecnico=geo
                    ))

        # 2. Evaluación en RMR
        for taladro, rmr_runs in ctx.rmr_by_taladro.items():
            for rmr in rmr_runs:
                r_idx = rmr.get("_fila_excel", 0)
                corrida_num = rmr.get("corrida", 0)
                celda_hija = f"{taladro}-RMR{corrida_num if corrida_num > 0 else r_idx}"
                camp = str(rmr.get("campana") or "N/A")

                frf = rmr.get("frf")
                fn = rmr.get("frac_nat")
                tot = rmr.get("total_frac")
                ff = rmr.get("ff_1m")
                esp = rmr.get("espaciamiento_mm")

                # Si alguna variable de fractura resulta negativa por dependencias
                neg_vars = []
                if frf is not None and frf < 0: neg_vars.append(("frf", frf))
                if fn is not None and fn < 0: neg_vars.append(("frac_nat", fn))
                if tot is not None and tot < 0: neg_vars.append(("total_frac", tot))
                if ff is not None and ff < 0: neg_vars.append(("ff_1m", ff))
                if esp is not None and esp < 0: neg_vars.append(("espaciamiento_mm", esp))

                if neg_vars:
                    first_col, first_val = neg_vars[0]
                    anomalies.append(Anomaly(
                        rule_code="R130",
                        row_excel=r_idx,
                        celda_padre=taladro,
                        celda_hija=celda_hija,
                        columna=first_col,
                        valor_actual=first_val,
                        severity=Severity.ALERTA,
                        mensaje=f"Campo erróneo debido a dependencias vacías o mal calculadas en LGG/RMR: '{first_col}' ({first_val}) es negativo por insumos de fracturas incongruentes.",
                        modulo="Validación RMR",
                        campania=camp
                    ))

        return anomalies


class ContinuousCrushedZoneAnomalyRule(BaseRule):
    """
    Regla pesada contextual multi-corrida:
    Detecta zonas continuas altamente trituradas (LRF > 0.8m o RQD = 0% a lo largo de 3 o más
    corridas consecutivas) sin reporte de estructura mayor (F, RF, SZ) en el intervalo.
    """
    code = "R_HVY_CRUSHED_ZONE"
    name = "Zona Triturada Continua sin Estructura Mayor Asociada"
    group = "LGG"
    severity = Severity.ADVERTENCIA

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        for taladro, runs in ctx.lgg_by_taladro.items():
            if len(runs) < 3:
                continue

            consecutive_crushed: List[Dict[str, Any]] = []

            for run in runs:
                lrf = run.get("lrf_m", 0.0) or 0.0
                rqd = run.get("rqd_m", 0.0) or 0.0
                perf = run.get("perf", 1.0) or (run.get("a", 1.0) - run.get("de", 0.0))

                is_crushed = (lrf >= 0.8) or (perf > 0 and rqd == 0.0)

                if is_crushed:
                    consecutive_crushed.append(run)
                else:
                    if len(consecutive_crushed) >= 3:
                        anomalies.extend(self._check_crushed_interval(taladro, consecutive_crushed, ctx))
                    consecutive_crushed = []

            if len(consecutive_crushed) >= 3:
                anomalies.extend(self._check_crushed_interval(taladro, consecutive_crushed, ctx))

        return anomalies

    def _check_crushed_interval(self, taladro: str, crushed_runs: List[Dict[str, Any]], ctx: ValidationContext) -> List[Anomaly]:
        start_de = crushed_runs[0].get("de", 0.0)
        end_a = crushed_runs[-1].get("a", 0.0)
        total_len = round(end_a - start_de, 2)

        # Verificar si en Estructural se reportó alguna estructura mayor en este intervalo
        major_structures = {"F", "RF", "SZ", "FBX", "BED"}
        structures_in_interval = [
            s for s in ctx.get_est_structures(taladro)
            if start_de <= (s.get("profundidad", -1) or -1) <= end_a
            and str(s.get("tipo_estructura") or "").strip().upper() in major_structures
        ]

        if not structures_in_interval:
            first_run = crushed_runs[0]
            r_idx = first_run.get("_fila_excel", 0)
            return [Anomaly(
                rule_code=self.code,
                row_excel=r_idx,
                celda_padre=taladro,
                celda_hija=f"{taladro}-C{first_run.get('corrida')}",
                columna="lrf_m",
                valor_actual=f"{len(crushed_runs)} corridas ({total_len}m)",
                severity=Severity.ADVERTENCIA,
                mensaje=f"Alerta Geomecánica Contextual: Macizo altamente triturado durante {len(crushed_runs)} corridas consecutivas ({start_de}m a {end_a}m, {total_len}m de avance) sin registro de estructura mayor (F, RF, SZ) en Logueo Estructural.",
                modulo="LGG",
                campania=str(first_run.get("campana") or "N/A"),
                geotecnico=str(first_run.get("geologo") or "N/A")
            )]
        return []


class AbruptCompetenceDropRule(BaseRule):
    """
    Regla pesada contextual:
    Evalúa una ventana móvil de 3 corridas en una misma litología dominante.
    Alerta caídas bruscas y anómalas de competencia (RQD cae > 50% de golpe) en roca uniforme.
    """
    code = "R_HVY_COMPETENCE_DROP"
    name = "Caída Abrupta de Competencia Geomecánica en Litología Homogénea"
    group = "LGG"
    severity = Severity.ADVERTENCIA

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        for taladro, runs in ctx.lgg_by_taladro.items():
            if len(runs) < 2:
                continue

            for i in range(1, len(runs)):
                prev = runs[i - 1]
                curr = runs[i]

                p_lito = str(prev.get("lito1") or "").strip().upper()
                c_lito = str(curr.get("lito1") or "").strip().upper()

                # Mismo tipo litológico principal
                if p_lito and c_lito and p_lito == c_lito and p_lito != "-1":
                    p_perf = prev.get("perf") or ((prev.get("a", 1.0) or 1.0) - (prev.get("de", 0.0) or 0.0))
                    c_perf = curr.get("perf") or ((curr.get("a", 1.0) or 1.0) - (curr.get("de", 0.0) or 0.0))

                    if p_perf > 0 and c_perf > 0:
                        p_rqd_pct = ((prev.get("rqd_m") or 0.0) / p_perf) * 100
                        c_rqd_pct = ((curr.get("rqd_m") or 0.0) / c_perf) * 100

                        # Caída de más de 55 puntos porcentuales de RQD
                        if p_rqd_pct >= 65 and c_rqd_pct <= 10:
                            r_idx = curr.get("_fila_excel", 0)
                            anomalies.append(Anomaly(
                                rule_code=self.code,
                                row_excel=r_idx,
                                celda_padre=taladro,
                                celda_hija=f"{taladro}-C{curr.get('corrida')}",
                                columna="rqd_m",
                                valor_actual=f"{round(p_rqd_pct)}% -> {round(c_rqd_pct)}%",
                                severity=Severity.ADVERTENCIA,
                                mensaje=f"Caída abrupta de competencia geomecánica en litología homogénea '{c_lito}': RQD cae de {round(p_rqd_pct)}% a {round(c_rqd_pct)}% en corrida #{curr.get('corrida')} ({curr.get('de')}m - {curr.get('a')}m). Revisar posibles zonas de cizalla o alteración.",
                                modulo="LGG",
                                campania=str(curr.get("campana") or "N/A"),
                                geotecnico=str(curr.get("geologo") or "N/A")
                            ))

        return anomalies
