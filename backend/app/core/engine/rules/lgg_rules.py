"""
app.core.engine.rules.lgg_rules
Reglas de consistencia geomecánica para el módulo Logueo General (LGG).
"""

import math
from typing import List, Dict, Any
from app.core.engine.base_rule import BaseRule
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext
from app.core.rules import WEATHERING_COMPATIBILITY

VALID_STRUCTURES = {"JN", "F", "RF", "F-10", "SZ", "BED", "VN", "CON", "SE", "F+10", "-1"}
VALID_STRENGTHS = {"R0", "R1", "R2", "R3", "R4", "R5", "R6", "-1"}
VALID_RUGOSITY = {str(x) for x in range(1, 10)}.union({"-1"})
VALID_WEATHERING = {"UWF", "SWD", "MWM", "HWA", "CWC", "RS", "-1"}
VALID_RELLENO = {"ca", "sand", "ch", "cl", "gy", "RXF", "FBX", "GOU", "PAT", "SIO", "QZ", "SU", "OX", "ep", "cwf", "-1"}
VALID_AGUA = {"CDC", "DPH", "WTM", "DGE", "FGF"}
VALID_ORIENTACION = {"S", "N", "PU", "PT", "PT/PU", "BUENA", "REGULAR", "MALA", "NO APLICA", "NO REGISTRA", "S/O", "-1"}
VALID_TURNOS = {"TD", "TN", "D", "N", "DIA", "NOCHE"}


class LGG_PhysicalAndGeometricRule(BaseRule):
    """Evalúa consistencia de avances, recuperaciones, metrajes y continuidad espacial."""
    code = "R_LGG_PHYSICAL"
    name = "Consistencia Física y Espacial de Corridas LGG"
    group = "LGG"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        for taladro, runs in ctx.lgg_by_taladro.items():
            last_a = None

            for run in runs:
                r_idx = run.get("_fila_excel", 0)
                corrida = run.get("corrida", 0)
                celda_hija = f"{taladro}-C{corrida}"
                camp = str(run.get("campana") or "N/A")
                geo = str(run.get("geologo") or "N/A")

                de = run.get("de")
                a = run.get("a")
                perf = run.get("perf")
                rec_m = run.get("rec_m")
                rqd_m = run.get("rqd_m")
                lrf_m = run.get("lrf_m")
                small_frag_m = run.get("small_frag_m")

                # Helper local
                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=taladro, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="LGG",
                        campania=camp, geotecnico=geo
                    ))

                # 1. Validación de avance
                if de is not None and a is not None:
                    calc_perf = round(a - de, 2)
                    if calc_perf <= 0:
                        add_err("R101", "a", a, Severity.ALERTA, f"Longitud de corrida perforada ({calc_perf}m) debe ser positiva.")
                    elif calc_perf > 1.6:
                        add_err("R102", "a", a, Severity.ALERTA, f"Longitud de corrida perforada ({calc_perf}m) excede el límite crítico de 1.6m.")

                    if perf is not None and abs(perf - calc_perf) > 0.05:
                        add_err("R150", "perf", perf, Severity.ALERTA, f"Discrepancia en avance reportado ({perf}m) vs intervalo perforado ({calc_perf}m).")

                    # Continuidad espacial
                    if last_a is not None and abs(de - last_a) > 0.001:
                        add_err("R122", "de", de, Severity.ALERTA, f"Ruptura de continuidad espacial detectada: Corrida inicia en {de}m pero la corrida anterior finalizó en {last_a}m.")
                    last_a = a

                # 2. Conservación de fragmentos físicos
                if rec_m is not None and perf is not None and perf > 0:
                    if rec_m > perf:
                        add_err("R103", "rec_m", rec_m, Severity.ALERTA, f"La longitud recuperada ({rec_m}m) es mayor que el avance perforado ({perf}m).")

                if rqd_m is not None and rec_m is not None:
                    if rqd_m > rec_m:
                        add_err("R104", "rqd_m", rqd_m, Severity.ALERTA, f"Metraje RQD ({rqd_m}m) es mayor que la longitud recuperada ({rec_m}m).")

                if lrf_m is not None and rec_m is not None:
                    if lrf_m > rec_m:
                        add_err("R105", "lrf_m", lrf_m, Severity.ALERTA, f"La longitud de roca fracturada LRF ({lrf_m}m) es mayor que la longitud recuperada ({rec_m}m).")

                # Suma de fragmentos
                if rqd_m is not None and lrf_m is not None and small_frag_m is not None:
                    sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
                    if perf is not None and perf > 0 and sum_frags > perf:
                        add_err("R106", "rqd_m", sum_frags, Severity.ALERTA, f"La suma de fragmentos físicos ({sum_frags}m) supera el avance perforado ({perf}m).")
                    if rec_m is not None and rec_m > 0 and sum_frags > rec_m:
                        add_err("R106B", "rqd_m", sum_frags, Severity.ALERTA, f"La suma de fragmentos físicos ({sum_frags}m) supera la longitud recuperada ({rec_m}m).")

                # 3. Campos negativos no permitidos
                for col_name, val_num, code in [
                    ("de", de, "R124"), ("a", a, "R125"), ("rec_m", rec_m, "R126"),
                    ("rqd_m", rqd_m, "R127"), ("lrf_m", lrf_m, "R128"), ("small_frag_m", small_frag_m, "R129")
                ]:
                    if val_num is not None and val_num < 0:
                        add_err(code, col_name, val_num, Severity.ALERTA, f"El valor de '{col_name}' ({val_num}) no puede ser negativo.")

        return anomalies


class LGG_FracturesAndFRFRule(BaseRule):
    """Evalúa fracturas naturales, buzamientos y cálculo de FRF (Zonas trituradas)."""
    code = "R_LGG_FRACTURES"
    name = "Validación de Fracturas y FRF en LGG"
    group = "LGG"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        for taladro, runs in ctx.lgg_by_taladro.items():
            for run in runs:
                r_idx = run.get("_fila_excel", 0)
                corrida = run.get("corrida", 0)
                celda_hija = f"{taladro}-C{corrida}"
                camp = str(run.get("campana") or "N/A")
                geo = str(run.get("geologo") or "N/A")

                fn = run.get("frac_nat")
                b30 = run.get("frac_buz30")
                b60 = run.get("frac_buz60")
                b90 = run.get("frac_buz90")
                frf = run.get("frf")
                lrf_m = run.get("lrf_m", 0.0) or 0.0

                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=taladro, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="LGG",
                        campania=camp, geotecnico=geo
                    ))

                # Sumatoria de buzamientos vs fracturas naturales
                if b30 is not None and b60 is not None and b90 is not None and fn is not None:
                    sum_b = b30 + b60 + b90
                    if sum_b != fn:
                        add_err("R107", "frac_nat", fn, Severity.ADVERTENCIA,
                                f"La sumatoria de fracturas por buzamiento ({sum_b}) no coincide con el conteo general ({fn}).")

                # Fórmula oficial de FRF
                if frf is not None and frf >= 0:
                    calc_frf = math.floor(round(lrf_m * 100) / 5) + 1 if lrf_m > 0 else 0
                    if frf != calc_frf:
                        add_err("R120", "frf", frf, Severity.ALERTA,
                                f"El valor de FRF ({frf}) no coincide con el calculado por la fórmula: FRF = PISO(REDOND(LRF*100)/5)+1 (si LRF>0, sino 0). Calculado: {calc_frf} basado en LRF ({lrf_m}m).")

                # Negativos
                for col_name, val_num, code in [
                    ("frac_buz30", b30, "R131"), ("frac_buz60", b60, "R132"), ("frac_buz90", b90, "R133")
                ]:
                    if val_num is not None and val_num < 0:
                        add_err(code, col_name, val_num, Severity.ALERTA, f"El número de fracturas en '{col_name}' ({val_num}) no puede ser negativo.")

        return anomalies


class LGG_GeomechanicalCompatibilityRule(BaseRule):
    """Evalúa compatibilidad geológica de resistencia vs intemperismo y juntas en corrida."""
    code = "R_LGG_COMPATIBILITY"
    name = "Compatibilidad Geomecánica y Juntas LGG"
    group = "LGG"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        for taladro, runs in ctx.lgg_by_taladro.items():
            for run in runs:
                r_idx = run.get("_fila_excel", 0)
                corrida = run.get("corrida", 0)
                celda_hija = f"{taladro}-C{corrida}"
                camp = str(run.get("campana") or "N/A")
                geo = str(run.get("geologo") or "N/A")

                resistencia = str(run.get("resistencia") or "").strip().upper()
                weathering = str(run.get("intemperismo") or "").strip().upper()
                aperture = run.get("abertura")
                thickness = run.get("espesor")
                tipo_est1 = str(run.get("tipo_est1") or "").strip().upper()
                tipo_est2 = str(run.get("tipo_est2") or "").strip().upper()

                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=taladro, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="LGG",
                        campania=camp, geotecnico=geo
                    ))

                # Relación abertura vs espesor de relleno
                exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}
                if aperture is not None and thickness is not None:
                    if thickness > aperture and (tipo_est1 not in exceptions and tipo_est2 not in exceptions):
                        add_err("R108", "espesor", thickness, Severity.ALERTA,
                                f"El espesor de relleno ({thickness}mm) no puede ser mayor que la abertura de junta ({aperture}mm) excepto en estructuras F, RF, VN, SZ, F+10 o BED.")

                    if thickness > 0 and aperture <= 0:
                        add_err("R109", "abertura", aperture, Severity.ADVERTENCIA,
                                f"Se declaró espesor de relleno de junta ({thickness}mm) pero la abertura es 0mm.")
                    elif thickness == 0 and aperture > 0:
                        add_err("R110", "espesor", thickness, Severity.ADVERTENCIA,
                                f"La abertura de junta es mayor a 0mm ({aperture}mm) pero no se ha registrado espesor de relleno.")

                # Incompatibilidad Resistencia vs Meteorización
                if resistencia in WEATHERING_COMPATIBILITY:
                    valid_weathers = WEATHERING_COMPATIBILITY[resistencia]
                    if weathering and weathering not in valid_weathers and weathering != "-1":
                        add_err("R121", "intemperismo", weathering, Severity.ADVERTENCIA,
                                f"Incompatibilidad geológica: Roca con resistencia {resistencia} no puede registrar intemperismo {weathering}. Permitidos: {', '.join(valid_weathers)}.")

        return anomalies
