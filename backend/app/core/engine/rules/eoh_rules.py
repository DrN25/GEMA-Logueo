"""
app.core.engine.rules.eoh_rules
Reglas de cruce EOH (End of Hole) entre módulos (LGG, Estructural, Collar y Survey).
"""

from typing import List
from app.core.engine.base_rule import BaseRule
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext


class CrossModule_EOHRule(BaseRule):
    """Verifica que las profundidades finales coincidan entre LGG, Estructural, Collar y Survey."""
    code = "R301"
    name = "Consistencia de Profundidad Final (EOH)"
    group = "Cruce General"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        all_drillholes = set(ctx.max_lgg_by_taladro.keys()) | set(ctx.collar_data.keys()) | set(ctx.survey_data.keys())

        for taladro in all_drillholes:
            lgg_depth = ctx.max_lgg_by_taladro.get(taladro)
            col_depth = ctx.collar_data.get(taladro)
            sur_depth = ctx.survey_data.get(taladro)

            # Cruce LGG vs Collar
            if lgg_depth is not None and col_depth is not None:
                if abs(lgg_depth - col_depth) > 0.05:
                    anomalies.append(Anomaly(
                        rule_code="R301",
                        row_excel=0,
                        celda_padre=taladro,
                        celda_hija=taladro,
                        columna="EOH / Profundidad Final",
                        valor_actual=f"LGG: {lgg_depth}m vs Collar: {col_depth}m",
                        severity=Severity.ALERTA,
                        mensaje=f"Discrepancia en EOH: Profundidad final en LGG ({lgg_depth}m) no coincide con Collar ({col_depth}m) para el sondaje '{taladro}'.",
                        modulo="Cruce General"
                    ))

            # Cruce LGG vs Survey
            if lgg_depth is not None and sur_depth is not None:
                if abs(lgg_depth - sur_depth) > 0.05:
                    anomalies.append(Anomaly(
                        rule_code="R301",
                        row_excel=0,
                        celda_padre=taladro,
                        celda_hija=taladro,
                        columna="Profundidad Final Survey",
                        valor_actual=f"LGG: {lgg_depth}m vs Survey: {sur_depth}m",
                        severity=Severity.ALERTA,
                        mensaje=f"Discrepancia en Survey: Profundidad máxima en LGG ({lgg_depth}m) no coincide con Survey ({sur_depth}m) para el sondaje '{taladro}'.",
                        modulo="Cruce General"
                    ))

        return anomalies
