"""
app.core.engine.rules.eoh_rules
Reglas de cruce EOH (End of Hole) entre módulos (LGG, Estructural, Collar y Survey).
Centraliza la tolerancia de cruce y genera la auditoría detallada de concordancia espacial.
Implementa decisiones de negocio D0, D1, D2, D3 y D4 con persistencia acotada (new_sequence).
"""

from typing import List, Dict, Any, Optional, Set, Tuple
from app.services.audit_artifact_store import new_sequence
from app.core.engine.base_rule import BaseRule
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext
from app.core.engine.rules.common import safe_str

# Tolerancia paramétrica centralizada para cruce de profundidades EOH (0.05 metros)
TOLERANCIA_EOH_METROS: float = 0.05


def _extraer_campana_taladro(runs: List[Dict[str, Any]]) -> Tuple[Optional[str], Optional[str]]:
    """
    D4: Determina la campaña de un taladro a partir de sus corridas LGG.
    Retorna (campania_res, extra_msg_si_varias):
    - Si tiene UNA sola campaña numérica válida: (año, "")
    - Si tiene VARIAS campañas: (None, " (Campañas registradas en LGG: 2021, 2022)")
    - Si no tiene campaña o está vacía: (None, "")
    NUNCA retorna "N/A", "NA", "Varias" ni "Sin campaña".
    """
    campanas_encontradas: Set[str] = set()
    for r in runs:
        c_item = r.get("campana")
        if c_item is not None:
            s = str(c_item).strip()
            if s and s.upper() not in ("NONE", "N/A", "NA", "0"):
                try:
                    yr = str(int(float(s)))
                    campanas_encontradas.add(yr)
                except (ValueError, TypeError):
                    campanas_encontradas.add(s)

    if len(campanas_encontradas) == 1:
        return list(campanas_encontradas)[0], ""
    elif len(campanas_encontradas) > 1:
        sorted_camps = sorted(list(campanas_encontradas))
        return None, f" (Campañas registradas en LGG: {', '.join(sorted_camps)})"
    else:
        return None, ""


class CrossModule_EOHRule(BaseRule):
    """
    Verifica que las profundidades finales coincidan entre LGG, Estructural, Collar y Survey.
    Cruce cuádruple con tolerancia de 0.05m.
    Aplica D0, D1, D2, D3, D4 y genera la estructura de diagnóstico 'cruce_collar_survey'.
    """
    code = "R301"
    name = "Consistencia de Profundidad Final (EOH)"
    group = "Cruce General"
    tolerance: float = TOLERANCIA_EOH_METROS

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = new_sequence()

        max_lgg = ctx.max_lgg_by_taladro or ctx.metadata.get("max_lgg", {})
        max_est = ctx.max_est_by_taladro or ctx.metadata.get("max_est", {})
        eoh_collar: Dict[str, Optional[float]] = ctx.collar_data or {}
        max_survey: Dict[str, Optional[float]] = ctx.survey_data or {}

        has_collar_file = ctx.metadata.get("has_collar", bool(eoh_collar))
        has_survey_file = ctx.metadata.get("has_survey", bool(max_survey))

        collar_meta = ctx.metadata.get("collar_meta", {})
        survey_meta = ctx.metadata.get("survey_meta", {})
        collar_dups_discrepant = collar_meta.get("duplicates_discrepant", {})

        cruce_dict: Dict[str, Any] = {
            "archivos": {
                "collar": {
                    "cargado": has_collar_file,
                    "status": collar_meta.get("status", "ok" if has_collar_file else "no_cargado"),
                    "total_taladros": collar_meta.get("total_taladros", len(eoh_collar)),
                    "error": collar_meta.get("error"),
                    "warning": collar_meta.get("warning"),
                    "hoja": collar_meta.get("sheet_name")
                },
                "survey": {
                    "cargado": has_survey_file,
                    "status": survey_meta.get("status", "ok" if has_survey_file else "no_cargado"),
                    "total_taladros": survey_meta.get("total_taladros", len(max_survey)),
                    "error": survey_meta.get("error"),
                    "warning": survey_meta.get("warning"),
                    "hoja": survey_meta.get("sheet_name")
                }
            },
            "tolerancia_metros": self.tolerance,
            "resumen": {
                "total_taladros_evaluados": 0,
                "coinciden_total": 0,
                "discrepancias_total": 0,
                "sin_referencia_total": 0
            },
            "taladros": {}
        }

        # D3: El LGG es la lista maestra de taladros.
        taladros_lgg = sorted(list(max_lgg.keys()))

        # D3: Detectar taladros con Estructural o Validación RMR pero SIN LGG -> ALERTA R307
        todos_taladros_aux = set(list(max_est.keys())) | set(list(ctx.rmr_by_taladro.keys()))
        for t_aux in sorted(todos_taladros_aux):
            if t_aux not in max_lgg or max_lgg.get(t_aux, 0.0) <= 0.0:
                modulos_afectados = []
                if t_aux in max_est:
                    modulos_afectados.append("Logueo Estructural")
                if t_aux in ctx.rmr_by_taladro:
                    modulos_afectados.append("Validación RMR")
                modulos_str = " y ".join(modulos_afectados) if modulos_afectados else "módulos secundarios"

                # Registrar ALERTA D3
                anomalies.append(Anomaly(
                    rule_code="R307",
                    row_excel=0,
                    celda_padre=t_aux,
                    celda_hija=t_aux,
                    columna="Taladro",
                    valor_actual=t_aux,
                    severity=Severity.ALERTA,
                    mensaje=f"Taladro sin LGG: el taladro '{t_aux}' registra datos en {modulos_str} pero no existe en Logueo General (LGG).",
                    modulo="Cruce General",
                    campania=None,
                    geotecnico="N/A",
                    sector_geotecnico="N/A"
                ))

                # En cruce queda como SIN_REFERENCIA y NO emite R301
                cruce_dict["taladros"][t_aux] = {
                    "taladro": t_aux,
                    "campania": None,
                    "lgg_max": 0.0,
                    "est_max": max_est.get(t_aux),
                    "collar_eoh": eoh_collar.get(t_aux) if has_collar_file else None,
                    "survey_max": max_survey.get(t_aux) if has_survey_file else None,
                    "comparaciones": {
                        "lgg_vs_collar": {"estado": "NO_CARGADO" if not has_collar_file else "SIN_REFERENCIA", "delta_m": None},
                        "lgg_vs_survey": {"estado": "NO_CARGADO" if not has_survey_file else "SIN_REFERENCIA", "delta_m": None},
                        "lgg_vs_est": {"estado": "SIN_REFERENCIA", "delta_m": None}
                    },
                    "estado_global": "SIN_REFERENCIA"
                }
                cruce_dict["resumen"]["total_taladros_evaluados"] += 1
                cruce_dict["resumen"]["sin_referencia_total"] += 1

        # Evaluación principal de cruce sobre la lista maestra de LGG
        for t in taladros_lgg:
            l_val = max_lgg.get(t, 0.0)
            e_val = max_est.get(t, 0.0)

            # D4: Recuperar campaña del taladro desde sus corridas LGG
            runs = ctx.get_lgg_runs(t)
            campania_res, campania_msg_extra = _extraer_campana_taladro(runs)

            geotecnicos_encontrados = {
                str(r.get("geotecnico") or r.get("geologo")).strip()
                for r in runs
                if (r.get("geotecnico") or r.get("geologo")) and str(r.get("geotecnico") or r.get("geologo")).strip().upper() not in ("", "NONE", "N/A")
            }
            geotecnico_res = list(geotecnicos_encontrados)[0] if geotecnicos_encontrados else "N/A"

            # 1. LGG vs Collar (D0, D1, D2)
            c_val = None
            if not has_collar_file:
                # D0: Collar no cargado -> NO_CARGADO, sin warning ni error
                comp_collar = {"estado": "NO_CARGADO", "delta_m": None}
            elif t not in eoh_collar:
                # D1a: Taladro del LGG ausente en Collar -> ALERTA R302
                comp_collar = {"estado": "SIN_REFERENCIA", "delta_m": None}
                anomalies.append(Anomaly(
                    rule_code="R302",
                    row_excel=0,
                    celda_padre=t,
                    celda_hija=t,
                    columna="Collar EOH",
                    valor_actual=None,
                    severity=Severity.ALERTA,
                    mensaje=f"No existe Collar para el taladro {t}.",
                    modulo="Cruce General",
                    campania=campania_res,
                    geotecnico=geotecnico_res,
                    sector_geotecnico="N/A"
                ))
            elif t in collar_dups_discrepant:
                # D2: Collar duplicado con EOH distintos -> ALERTA R306, sin elegir ninguno; SIN_REFERENCIA
                comp_collar = {"estado": "SIN_REFERENCIA", "delta_m": None}
                vals_str = ", ".join(str(v) for v in collar_dups_discrepant[t])
                anomalies.append(Anomaly(
                    rule_code="R306",
                    row_excel=0,
                    celda_padre=t,
                    celda_hija=t,
                    columna="Collar EOH",
                    valor_actual=vals_str,
                    severity=Severity.ALERTA,
                    mensaje=f"Taladro duplicado en Collar con profundidades EOH discrepantes ({vals_str}) para el taladro {t}.",
                    modulo="Cruce General",
                    campania=campania_res,
                    geotecnico=geotecnico_res,
                    sector_geotecnico="N/A"
                ))
            elif eoh_collar.get(t) is None:
                # D1b: Celda EOH vacía o no numérica en Collar -> VACÍO R304, SIN_REFERENCIA
                comp_collar = {"estado": "SIN_REFERENCIA", "delta_m": None}
                anomalies.append(Anomaly(
                    rule_code="R304",
                    row_excel=0,
                    celda_padre=t,
                    celda_hija=t,
                    columna="Collar EOH",
                    valor_actual=None,
                    severity=Severity.VACIO,
                    mensaje=f"Profundidad final (EOH) vacía o no numérica en Collar para el taladro {t}.",
                    modulo="Cruce General",
                    campania=campania_res,
                    geotecnico=geotecnico_res,
                    sector_geotecnico="N/A"
                ))
            else:
                c_val = eoh_collar.get(t)
                delta_c = round(l_val - c_val, 4)
                comp_collar = {
                    "estado": "COINCIDE" if abs(delta_c) <= self.tolerance else "DISCREPANCIA",
                    "delta_m": delta_c
                }

            # 2. LGG vs Survey (D0, D1)
            s_val = None
            if not has_survey_file:
                # D0: Survey no cargado -> NO_CARGADO, sin warning ni error
                comp_survey = {"estado": "NO_CARGADO", "delta_m": None}
            elif t not in max_survey:
                # D1a: Taladro del LGG ausente en Survey -> ALERTA R303
                comp_survey = {"estado": "SIN_REFERENCIA", "delta_m": None}
                anomalies.append(Anomaly(
                    rule_code="R303",
                    row_excel=0,
                    celda_padre=t,
                    celda_hija=t,
                    columna="Survey Depth",
                    valor_actual=None,
                    severity=Severity.ALERTA,
                    mensaje=f"No existe Survey para el taladro {t}.",
                    modulo="Cruce General",
                    campania=campania_res,
                    geotecnico=geotecnico_res,
                    sector_geotecnico="N/A"
                ))
            elif max_survey.get(t) is None:
                # D1b: TODAS las profundidades de Survey vacías o no numéricas -> VACÍO R305, SIN_REFERENCIA
                comp_survey = {"estado": "SIN_REFERENCIA", "delta_m": None}
                anomalies.append(Anomaly(
                    rule_code="R305",
                    row_excel=0,
                    celda_padre=t,
                    celda_hija=t,
                    columna="Survey Depth",
                    valor_actual=None,
                    severity=Severity.VACIO,
                    mensaje=f"Todas las profundidades (Depth) están vacías o no son numéricas en Survey para el taladro {t}.",
                    modulo="Cruce General",
                    campania=campania_res,
                    geotecnico=geotecnico_res,
                    sector_geotecnico="N/A"
                ))
            else:
                s_val = max_survey.get(t)
                delta_s = round(l_val - s_val, 4)
                comp_survey = {
                    "estado": "COINCIDE" if abs(delta_s) <= self.tolerance else "DISCREPANCIA",
                    "delta_m": delta_s
                }

            # 3. LGG vs Estructural
            if e_val <= 0.0 or t not in max_est:
                comp_est = {"estado": "SIN_REFERENCIA", "delta_m": None}
            else:
                delta_e = round(l_val - e_val, 4)
                comp_est = {
                    "estado": "COINCIDE" if abs(delta_e) <= self.tolerance else "DISCREPANCIA",
                    "delta_m": delta_e
                }

            # 4. D0: Resolución del Estado Global por Taladro
            # Los estados NO_CARGADO no tienen efecto en el estado global
            evaluaciones_activas = [
                c["estado"] for c in (comp_collar, comp_survey, comp_est)
                if c["estado"] not in ("NO_CARGADO", "SIN_REFERENCIA")
            ]

            if "DISCREPANCIA" in evaluaciones_activas:
                estado_global = "DISCREPANCIA"
            elif "COINCIDE" in evaluaciones_activas:
                estado_global = "COINCIDE"
            else:
                estado_global = "SIN_REFERENCIA"

            cruce_dict["taladros"][t] = {
                "taladro": t,
                "campania": campania_res,
                "lgg_max": l_val,
                "est_max": e_val if (e_val > 0.0 and t in max_est) else None,
                "collar_eoh": c_val,
                "survey_max": s_val,
                "comparaciones": {
                    "lgg_vs_collar": comp_collar,
                    "lgg_vs_survey": comp_survey,
                    "lgg_vs_est": comp_est
                },
                "estado_global": estado_global
            }

            cruce_dict["resumen"]["total_taladros_evaluados"] += 1
            if estado_global == "COINCIDE":
                cruce_dict["resumen"]["coinciden_total"] += 1
            elif estado_global == "DISCREPANCIA":
                cruce_dict["resumen"]["discrepancias_total"] += 1
            else:
                cruce_dict["resumen"]["sin_referencia_total"] += 1

            # 5. D0 + D4: Emisión de R301 solo ante DISCREPANCIA real
            if estado_global == "DISCREPANCIA":
                partes_datos = [f"LGG Max: {l_val}m"]
                if t in max_est and e_val > 0.0:
                    partes_datos.append(f"Estructural Max: {e_val}m")
                elif t in max_est:
                    partes_datos.append("Estructural Max: Sin Datos")

                # Solo incluir Collar / Survey si el archivo fue cargado (D0)
                if has_collar_file:
                    c_str = f"{c_val}m" if c_val is not None else "Sin Referencia"
                    partes_datos.append(f"Collar EOH: {c_str}")

                if has_survey_file:
                    s_str = f"{s_val}m" if s_val is not None else "Sin Referencia"
                    partes_datos.append(f"Survey Max: {s_str}")

                datos_str = ", ".join(partes_datos)
                msg = (
                    f"Las profundidades finales del taladro no coinciden entre módulos (LGG, Estructural, Collar, Survey). "
                    f"Datos evaluados -> {datos_str}.{campania_msg_extra}"
                )

                anomalies.append(Anomaly(
                    rule_code="R301",
                    row_excel=0,
                    celda_padre=t,
                    celda_hija=t,
                    columna="Profundidad Final EOH",
                    valor_actual=l_val,
                    severity=Severity.ALERTA,
                    mensaje=msg,
                    modulo="Cruce General",
                    campania=campania_res,
                    geotecnico=geotecnico_res,
                    sector_geotecnico="N/A"
                ))

        ctx.metadata["cruce_collar_survey"] = cruce_dict
        return anomalies