"""
app.core.engine.rules.eoh_rules
Reglas de cruce EOH (End of Hole) entre módulos (LGG, Estructural, Collar y Survey).
"""

from typing import List, Dict, Any, Optional
from app.core.engine.base_rule import BaseRule
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext


class CrossModule_EOHRule(BaseRule):
    """
    Verifica que las profundidades finales coincidan entre LGG, Estructural, Collar y Survey.
    Cruce cuádruple con tolerancia de 0.05m.
    """
    code = "R301"
    name = "Consistencia de Profundidad Final (EOH)"
    group = "Cruce General"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        max_lgg = ctx.max_lgg_by_taladro or ctx.metadata.get("max_lgg", {})
        max_est = ctx.max_est_by_taladro or ctx.metadata.get("max_est", {})
        eoh_collar = ctx.collar_data or ctx.metadata.get("eoh_collar", {})
        max_survey = ctx.survey_data or ctx.metadata.get("max_survey", {})
        has_collar_file = ctx.metadata.get("has_collar", bool(eoh_collar))
        has_survey_file = ctx.metadata.get("has_survey", bool(max_survey))

        taladros_procesados = set(list(max_lgg.keys()) + list(max_est.keys()))
        for t in sorted(taladros_procesados):
            l_val = max_lgg.get(t, 0.0)
            e_val = max_est.get(t, 0.0)

            has_collar = has_collar_file and t in eoh_collar
            has_survey = has_survey_file and t in max_survey

            c_val = eoh_collar.get(t, l_val) if has_collar else l_val
            s_val = max_survey.get(t, l_val) if has_survey else l_val

            has_conflict = False

            if l_val > 0 and e_val > 0 and abs(l_val - e_val) > 0.05:
                has_conflict = True

            if has_collar and abs(l_val - c_val) > 0.05:
                has_conflict = True

            if has_survey and abs(l_val - s_val) > 0.05:
                has_conflict = True

            if has_conflict:
                c_str = f"{c_val}m" if has_collar else "No Cargado"
                s_str = f"{s_val}m" if has_survey else "No Cargado"

                msg = (
                    f"Las profundidades finales del taladro no coinciden entre módulos (LGG, Estructural, Collar, Survey). "
                    f"Datos evaluados -> LGG Max: {l_val}m, Estructural Max: {e_val}m, Collar EOH: {c_str}, Survey Max: {s_str}."
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
                    campania="N/A",
                    geotecnico="N/A",
                    sector_geotecnico="N/A"
                ))

        return anomalies
