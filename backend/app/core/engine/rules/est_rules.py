"""
app.core.engine.rules.est_rules
Reglas de consistencia geomecánica y contención espacial para Logueo Estructural.
"""

from typing import List, Dict, Any
from app.core.engine.base_rule import BaseRule
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext

STRENGTH_RANK = {"R0": 0, "R1": 1, "R2": 2, "R3": 3, "R4": 4, "R5": 5, "R6": 6}


class Estructural_SpatialContainmentRule(BaseRule):
    """Verifica que cada estructura caiga dentro de una corrida válida de LGG."""
    code = "R_EST_SPATIAL"
    name = "Contención Espacial de Estructuras en Corridas LGG"
    group = "Estructural"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        for taladro, structures in ctx.est_by_taladro.items():
            lgg_runs = ctx.get_lgg_runs(taladro)
            max_lgg_depth = ctx.max_lgg_by_taladro.get(taladro, 0.0)

            for s in structures:
                r_idx = s.get("_fila_excel", 0)
                prof = s.get("profundidad")
                de = s.get("de")
                a = s.get("a")
                celda_hija = f"{taladro}-P{prof if prof is not None else r_idx}"
                camp = str(s.get("campana") or "N/A")
                geo = str(s.get("geotecnico") or "N/A")

                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=taladro, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="Estructural",
                        campania=camp, geotecnico=geo
                    ))

                if prof is not None:
                    # Límite final de LGG
                    if max_lgg_depth > 0 and prof > max_lgg_depth:
                        add_err("R216", "profundidad", prof, Severity.ALERTA,
                                f"La profundidad en logueo estructural ({prof}m) excede el límite final registrado en LGG ({max_lgg_depth}m).")

                    # Huérfana en LGG
                    matching_run = ctx.find_lgg_run_containing_depth(taladro, prof)
                    if not matching_run and lgg_runs:
                        add_err("R201", "profundidad", prof, Severity.ALERTA,
                                f"Profundidad huérfana ({prof}m) no corresponde a ningún tramo de corrida en LGG para el taladro '{taladro}'.")

                # Tramo de corrida declarado en Estructural
                if de is not None and a is not None and lgg_runs:
                    exact_run = ctx.find_matching_lgg_run(taladro, de=de, a=a)
                    if not exact_run:
                        add_err("R202", "de", f"{de}-{a}", Severity.ALERTA,
                                f"La corrida asociada ({de}m - {a}m) no existe de forma exacta en las corridas de LGG para el taladro '{taladro}'.")
                    elif prof is not None and not (de <= prof <= a):
                        add_err("R203", "profundidad", prof, Severity.ALERTA,
                                f"La profundidad ({prof}m) se encuentra fuera del tramo de corrida especificado ({de}m - {a}m).")

        return anomalies


class Estructural_GeometryAndCompatibilityRule(BaseRule):
    """Evalúa ángulos espaciales (Alfa, Beta, Dip, Azimuth), forma de junta y dureza de pared."""
    code = "R_EST_GEOMETRY"
    name = "Geometría 3D y Dureza de Estructuras"
    group = "Estructural"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        for taladro, structures in ctx.est_by_taladro.items():
            for s in structures:
                r_idx = s.get("_fila_excel", 0)
                prof = s.get("profundidad")
                celda_hija = f"{taladro}-P{prof if prof is not None else r_idx}"
                camp = str(s.get("campana") or "N/A")
                geo = str(s.get("geotecnico") or "N/A")

                alfa = s.get("alfa")
                beta = s.get("beta")
                dip = s.get("dip")
                azimuth = s.get("azimuth")
                forma = s.get("forma")
                aperture = s.get("abertura")
                thickness = s.get("espesor")
                tipo_est = str(s.get("tipo_estructura") or "").strip().upper()
                dureza_pared = str(s.get("dureza_pared") or "").strip().upper()

                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=taladro, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="Estructural",
                        campania=camp, geotecnico=geo
                    ))

                # Ángulos
                if alfa is not None and not (0 <= alfa <= 90):
                    add_err("R204", "alfa", alfa, Severity.ALERTA, f"El ángulo Alfa ({alfa}°) es inválido. Debe estar entre 0° y 90°.")
                if beta is not None and not (0 <= beta <= 360):
                    add_err("R206", "beta", beta, Severity.ALERTA, f"El ángulo Beta ({beta}°) es inválido. Debe estar entre 0° y 360°.")
                if dip is not None and not (0 <= dip <= 90):
                    add_err("R208", "dip", dip, Severity.ALERTA, f"El ángulo Dip ({dip}°) es inválido. Debe estar entre 0° y 90°.")
                if azimuth is not None and not (0 <= azimuth <= 360):
                    add_err("R209", "azimuth", azimuth, Severity.ALERTA, f"El ángulo Azimut ({azimuth}°) es inválido. Debe estar entre 0° y 360°.")

                # Forma de junta
                if forma is not None:
                    try:
                        f_int = int(forma)
                        if f_int not in range(1, 7) and f_int != -1:
                            add_err("R210", "forma", forma, Severity.ALERTA, f"Forma de junta '{forma}' no válida. Permitidos: Plano (1) a Irregular (6).")
                    except (ValueError, TypeError):
                        add_err("R210", "forma", forma, Severity.ALERTA, f"Forma de junta '{forma}' no válida. Permitidos: Plano (1) a Irregular (6).")

                # Espesor vs Abertura
                exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}
                if aperture is not None and thickness is not None:
                    if thickness > aperture and tipo_est not in exceptions:
                        add_err("R211", "espesor", thickness, Severity.ALERTA,
                                f"El espesor de relleno ({thickness}mm) no puede ser mayor que la abertura de junta ({aperture}mm) excepto en estructuras F, RF, VN, SZ, F+10 o BED.")

                # Dureza de pared vs resistencia máxima estimada de corrida
                if prof is not None and dureza_pared in STRENGTH_RANK:
                    run = ctx.find_lgg_run_containing_depth(taladro, prof)
                    if run:
                        lgg_res = str(run.get("resistencia") or "").strip().upper()
                        if lgg_res in STRENGTH_RANK:
                            if STRENGTH_RANK[dureza_pared] > STRENGTH_RANK[lgg_res]:
                                add_err("R214", "dureza_pared", dureza_pared, Severity.ADVERTENCIA,
                                        f"Incompatibilidad geológica: Dureza de pared de junta ({dureza_pared}) supera la resistencia máxima estimada de la corrida en LGG ({lgg_res}).")

        return anomalies
