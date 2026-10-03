"""
app.core.engine.rules.lgg_rules
Reglas de consistencia geomecánica para el módulo Logueo General (LGG).
"""

import math
from typing import List, Dict, Any, Optional, Set
from app.core.engine.base_rule import BaseRule
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext
from app.core.rules import WEATHERING_COMPATIBILITY
from app.core.engine.rules.common import (
    VALID_STRUCTURES, VALID_STRENGTHS, VALID_RUGOSITY, VALID_WEATHERING,
    VALID_RELLENO, VALID_AGUA, VALID_ORIENTACION, VALID_TURNOS,
    get_canonical_value, sanitize_val, safe_str, safe_int, safe_float,
    is_missing_or_no_info
)


class LGG_MandatoryFieldsRule(BaseRule):
    """Valida presencia de campos obligatorios en LGG (vacíos y sin información -1)."""
    code = "R_LGG_MANDATORY"
    name = "Campos Obligatorios de LGG"
    group = "LGG"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        lgg_cols = ctx.metadata.get("lgg_columns")

        if ctx.is_2026:
            mandatory_lgg = [
                "de", "a", "perf", "rec_m", "rqd_m", "lrf_m", "small_frag_m", "sum_frags_total", "frac_nat", "sum_frac_nat", "lito1", 
                "resistencia", "linea_orientacion", "tipo_est1", "frac_buz30", "frac_buz60", "frac_buz90", 
                "abertura", "rugosidad", "jrc10", "intemperismo", "relleno1", "espesor", 
                "agua_obs", "campana", "geologo", "fecha", "turno", "proyecto"
            ]
        else:
            mandatory_lgg = [
                "corrida", "de", "a", "rec_m", "rqd_m", "lrf_m", "frac_nat", "lito1", "resistencia", "tipo_est1", 
                "frac_buz30", "frac_buz60", "frac_buz90", "abertura", "rugosidad", "jrc10", "intemperismo", 
                "relleno1", "espesor", "agua_obs", "campana", "geologo"
            ]

        for run in ctx.lgg_runs:
            r_idx = run.get("_fila_excel", 0)
            taladro = run.get("taladro", "")
            corrida = run.get("corrida", 0)
            celda_padre = taladro
            celda_hija = run.get("_celda_hija") or f"{taladro}-C{corrida}"
            camp = str(run.get("campana") or "N/A")
            geo = str(run.get("geologo") or "N/A")
            raw_dict = run.get("_raw_dict", run)

            for key in mandatory_lgg:
                if lgg_cols is not None and key not in lgg_cols:
                    continue
                val_raw = raw_dict.get(key)
                if val_raw is None or str(val_raw).strip() == "":
                    anomalies.append(Anomaly(
                        rule_code="R100_EMPTY", row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                        columna=key, valor_actual=None, severity=Severity.VACIO,
                        mensaje=f"El campo obligatorio '{key}' se encuentra vacío.", modulo="LGG",
                        campania=camp, geotecnico=geo
                    ))
                elif str(val_raw).strip() in ["-1", "-1.0", "-1,0"]:
                    anomalies.append(Anomaly(
                        rule_code="R100_NODATA", row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                        columna=key, valor_actual=val_raw, severity=Severity.SIN_INFORMACION,
                        mensaje=f"El campo obligatorio '{key}' no contiene información (-1).", modulo="LGG",
                        campania=camp, geotecnico=geo
                    ))

        return anomalies


class LGG_CatalogsAndFormatsRule(BaseRule):
    """Valida códigos de estructura, rugosidad, línea de orientación y turnos contra catálogos."""
    code = "R_LGG_CATALOGS"
    name = "Catálogos y Formatos Estándar LGG"
    group = "LGG"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        for run in ctx.lgg_runs:
            r_idx = run.get("_fila_excel", 0)
            taladro = run.get("taladro", "")
            corrida = run.get("corrida", 0)
            celda_padre = taladro
            celda_hija = run.get("_celda_hija") or f"{taladro}-C{corrida}"
            camp = str(run.get("campana") or "N/A")
            geo = str(run.get("geologo") or "N/A")
            raw_dict = run.get("_raw_dict", run)

            # Estructura 1
            tipo_est1_raw = safe_str(sanitize_val(raw_dict.get("tipo_est1"), str))
            tipo_est1_can = get_canonical_value(tipo_est1_raw, VALID_STRUCTURES)
            if tipo_est1_raw and not tipo_est1_can:
                if tipo_est1_raw.upper() == "J":
                    anomalies.append(Anomaly(
                        rule_code="R111", row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                        columna="tipo_est1", valor_actual="J", severity=Severity.ADVERTENCIA,
                        mensaje="Código de estructura 'J' reconocido como 'JN' (Junta).", modulo="LGG",
                        campania=camp, geotecnico=geo
                    ))
                else:
                    anomalies.append(Anomaly(
                        rule_code="R111_INV", row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                        columna="tipo_est1", valor_actual=tipo_est1_raw, severity=Severity.ALERTA,
                        mensaje=f"Código de estructura 1 no válido. Permitidos: {', '.join(VALID_STRUCTURES)}", modulo="LGG",
                        campania=camp, geotecnico=geo
                    ))

            # Estructura 2
            tipo_est2_raw = safe_str(sanitize_val(raw_dict.get("tipo_est2"), str))
            tipo_est2_can = get_canonical_value(tipo_est2_raw, VALID_STRUCTURES)
            if tipo_est2_raw and not tipo_est2_can:
                anomalies.append(Anomaly(
                    rule_code="R112_INV", row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                    columna="tipo_est2", valor_actual=tipo_est2_raw, severity=Severity.ALERTA,
                    mensaje=f"Código de estructura 2 no válido. Permitidos: {', '.join(VALID_STRUCTURES)}", modulo="LGG",
                    campania=camp, geotecnico=geo
                ))

            # Rugosidad
            raw_rugosidad = raw_dict.get("rugosidad")
            rugosidad_can = get_canonical_value(raw_rugosidad, VALID_RUGOSITY)
            if raw_rugosidad is not None and not rugosidad_can:
                anomalies.append(Anomaly(
                    rule_code="R113_INV", row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                    columna="rugosidad", valor_actual=raw_rugosidad, severity=Severity.ALERTA,
                    mensaje=f"Código de Rugosidad no válido. Permitidos: {', '.join(VALID_RUGOSITY)}", modulo="LGG",
                    campania=camp, geotecnico=geo
                ))

            # Específicos 2026: Línea de Orientación y Turno
            if ctx.is_2026:
                raw_ori = raw_dict.get("linea_orientacion")
                if raw_ori is not None and str(raw_ori).strip() not in ["", "-1"]:
                    ori_str = str(raw_ori).strip().upper()
                    if ori_str not in VALID_ORIENTACION:
                        anomalies.append(Anomaly(
                            rule_code="R114_INV", row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                            columna="linea_orientacion", valor_actual=raw_ori, severity=Severity.ALERTA,
                            mensaje=f"Línea de orientación no válida ('{raw_ori}'). Permitidos: {', '.join(sorted(VALID_ORIENTACION))}.", modulo="LGG",
                            campania=camp, geotecnico=geo
                        ))

                raw_turno = raw_dict.get("turno")
                if raw_turno is not None and str(raw_turno).strip() not in ["", "-1"]:
                    turno_str = str(raw_turno).strip().upper()
                    if turno_str not in VALID_TURNOS:
                        anomalies.append(Anomaly(
                            rule_code="R115_INV", row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                            columna="turno", valor_actual=raw_turno, severity=Severity.ADVERTENCIA,
                            mensaje=f"Turno no válido ('{raw_turno}'). Permitidos: {', '.join(sorted(VALID_TURNOS))}.", modulo="LGG",
                            campania=camp, geotecnico=geo
                        ))

        return anomalies


class LGG_PhysicalAndGeometricRule(BaseRule):
    """Evalúa consistencia física de avances, recuperaciones, metrajes y continuidad espacial."""
    code = "R_LGG_PHYSICAL"
    name = "Consistencia Física y Espacial de Corridas LGG"
    group = "LGG"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        skip_max_advance = ctx.metadata.get("skip_lgg_max_advance", False)

        for taladro, runs in ctx.lgg_by_taladro.items():
            last_a_by_taladro: Dict[str, float] = {}

            for run in runs:
                r_idx = run.get("_fila_excel", 0)
                corrida = run.get("corrida", 0)
                celda_padre = taladro
                celda_hija = run.get("_celda_hija") or f"{taladro}-C{corrida}"
                camp = str(run.get("campana") or "N/A")
                geo = str(run.get("geologo") or "N/A")
                raw_dict = run.get("_raw_dict", run)

                de = run.get("de")
                a = run.get("a")
                rec_m = run.get("rec_m")
                rqd_m = run.get("rqd_m")
                lrf_m = run.get("lrf_m")
                small_frag_m = run.get("small_frag_m")

                frac_nat = run.get("frac_nat")
                b30 = run.get("frac_buz30")
                b60 = run.get("frac_buz60")
                b90 = run.get("frac_buz90")
                abertura = run.get("abertura")
                espesor = run.get("espesor")
                camp_val = run.get("campana")

                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="LGG",
                        campania=camp, geotecnico=geo
                    ))

                # 1. Valores negativos no permitidos
                raw_de = raw_dict.get("de")
                if de is not None and de < -0.0001:
                    add_err("R124", "de", raw_de, Severity.ALERTA, f"El valor de 'de:' ({de}m) no puede ser negativo.")
                raw_a = raw_dict.get("a")
                if a is not None and a < -0.0001:
                    add_err("R125", "a", raw_a, Severity.ALERTA, f"El valor de 'a:' ({a}m) no puede ser negativo.")
                raw_rec = raw_dict.get("rec_m")
                if rec_m is not None and rec_m < -0.0001:
                    add_err("R126", "rec_m", raw_rec, Severity.ALERTA, f"La longitud recuperada ({rec_m}m) no puede ser negativa.")
                raw_rqd = raw_dict.get("rqd_m")
                if rqd_m is not None and rqd_m < -0.0001:
                    add_err("R127", "rqd_m", raw_rqd, Severity.ALERTA, f"El metraje RQD ({rqd_m}m) no puede ser negativo.")
                raw_lrf = raw_dict.get("lrf_m")
                if lrf_m is not None and lrf_m < -0.0001:
                    add_err("R128", "lrf_m", raw_lrf, Severity.ALERTA, f"La longitud de roca fracturada LRF ({lrf_m}m) no puede ser negativa.")
                raw_small = raw_dict.get("small_frag_m")
                if small_frag_m is not None and small_frag_m < -0.0001:
                    add_err("R129", "small_frag_m", raw_small, Severity.ALERTA, f"El metraje de fragmentos <10cm ({small_frag_m}m) no puede ser negativo.")

                raw_fn = raw_dict.get("frac_nat")
                if frac_nat is not None and frac_nat < -0.0001:
                    raw_b30 = raw_dict.get("frac_buz30")
                    raw_b60 = raw_dict.get("frac_buz60")
                    raw_b90 = raw_dict.get("frac_buz90")
                    if is_missing_or_no_info(raw_b30) or is_missing_or_no_info(raw_b60) or is_missing_or_no_info(raw_b90):
                        add_err("R130", "frac_nat", raw_fn, Severity.ALERTA,
                                f"Campo calculado 'frac_nat' ({frac_nat}) resulta negativo debido a que los insumos de fracturas por buzamiento están vacíos o sin información (-1).")
                    else:
                        add_err("R130", "frac_nat", raw_fn, Severity.ALERTA,
                                f"El número de fracturas naturales ({frac_nat}) no puede ser negativo.")
                raw_b30 = raw_dict.get("frac_buz30")
                if b30 is not None and b30 < -0.0001:
                    add_err("R131", "frac_buz30", raw_b30, Severity.ALERTA, f"El número de fracturas en Buz<30° ({b30}) no puede ser negativo.")
                raw_b60 = raw_dict.get("frac_buz60")
                if b60 is not None and b60 < -0.0001:
                    add_err("R132", "frac_buz60", raw_b60, Severity.ALERTA, f"El número de fracturas en 30°-60° ({b60}) no puede ser negativo.")
                raw_b90 = raw_dict.get("frac_buz90")
                if b90 is not None and b90 < -0.0001:
                    add_err("R133", "frac_buz90", raw_b90, Severity.ALERTA, f"El número de fracturas en Buz>60° ({b90}) no puede ser negativo.")

                raw_abertura = raw_dict.get("abertura")
                if abertura is not None and abertura < -0.0001:
                    add_err("R134", "abertura", raw_abertura, Severity.ALERTA, f"La abertura de junta ({abertura}mm) no puede ser negativa.")
                raw_espesor = raw_dict.get("espesor")
                if espesor is not None and espesor < -0.0001:
                    add_err("R135", "espesor", raw_espesor, Severity.ALERTA, f"El espesor de relleno ({espesor}mm) no puede ser negativo.")
                raw_camp = raw_dict.get("campana")
                camp_num = sanitize_val(raw_camp, int)
                if camp_num is not None and camp_num < -0.0001:
                    add_err("R136", "campana", raw_camp, Severity.ALERTA, f"El año de campaña ({camp_num}) no puede ser negativo.")

                # 2. Validación de número entero para conteos de fracturas
                for key, val_raw in [("frac_nat", raw_fn), ("frac_buz30", raw_b30), ("frac_buz60", raw_b60), ("frac_buz90", raw_b90)]:
                    if val_raw is not None and val_raw != -1:
                        try:
                            f_val = float(val_raw)
                            if not f_val.is_integer():
                                add_err("R137", key, val_raw, Severity.ALERTA, f"El campo '{key}' ({val_raw}) debe ser un número entero.")
                        except (ValueError, TypeError):
                            pass

                # 3. Continuidad espacial por taladro
                if de is not None and celda_padre in last_a_by_taladro:
                    prev_a = last_a_by_taladro[celda_padre]
                    if abs(de - prev_a) > 0.001:
                        gap = round(abs(de - prev_a), 4)
                        add_err("R122", "de", de, Severity.ALERTA, f"Ruptura de continuidad espacial detectada. Datos evaluados -> Profundidad de inicio 'De': {de}m, Profundidad final anterior 'A': {prev_a}m (Brecha calculada: {gap}m).")
                if a is not None:
                    last_a_by_taladro[celda_padre] = a

                # 4. Longitud de corrida perforada y consistencia de fragmentos
                if de is not None and a is not None:
                    perf = round(a - de, 2)
                    if perf <= 0:
                        add_err("R101", "a", a, Severity.ALERTA, f"Longitud de corrida perforada debe ser positiva. Datos evaluados -> De: {de}m, A: {a}m, Avance calculado: {perf}m.")
                    elif not skip_max_advance and perf > 1.6:
                        add_err("R102", "a", a, Severity.ALERTA, f"Longitud de corrida perforada ({perf}m) excede el límite crítico de 1.6m.")

                    if rec_m is not None and round(rec_m, 4) > round(perf, 4):
                        add_err("R103", "rec_m", rec_m, Severity.ALERTA, f"La longitud recuperada es mayor que el avance perforado. Datos evaluados -> Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")
                    if rqd_m is not None and rec_m is not None and round(rqd_m, 4) > round(rec_m, 4):
                        add_err("R104", "rqd_m", rqd_m, Severity.ALERTA, f"Metraje RQD es mayor que la longitud recuperada. Datos evaluados -> RQD: {rqd_m}m, Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")
                    if lrf_m is not None and rec_m is not None and round(lrf_m, 4) > round(rec_m, 4):
                        add_err("R105", "lrf_m", lrf_m, Severity.ALERTA, f"La longitud de roca fracturada LRF es mayor que la longitud recuperada. Datos evaluados -> LRF: {lrf_m}m, Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")

                    if rqd_m is not None and lrf_m is not None and small_frag_m is not None:
                        sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
                        if rec_m is not None and round(sum_frags, 2) > round(rec_m, 2) + 0.02:
                            add_err("R106B", "rqd_m", rqd_m, Severity.ALERTA, f"La suma de fragmentos físicos supera la longitud recuperada. Datos evaluados -> Suma: {sum_frags}m (RQD: {rqd_m}m + LRF: {lrf_m}m + <10cm: {small_frag_m}m), Longitud Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")
                        elif round(sum_frags, 4) > round(perf, 4):
                            add_err("R106", "rqd_m", rqd_m, Severity.ALERTA, f"La suma de fragmentos físicos supera el avance perforado. Datos evaluados -> Suma de fragmentos: {sum_frags}m (RQD: {rqd_m}m + LRF: {lrf_m}m + <10cm: {small_frag_m}m), Avance de corrida: {perf}m (De: {de}m, A: {a}m), Longitud Recuperada: {rec_m}m.")

                # 5. Formato 2026 específico
                if ctx.is_2026:
                    raw_perf_col = raw_dict.get("perf")
                    perf_val = sanitize_val(raw_perf_col, float)
                    if perf_val is not None and de is not None and a is not None:
                        calc_perf = round(a - de, 2)
                        if abs(perf_val - calc_perf) > 0.01:
                            add_err("R150", "perf", raw_perf_col, Severity.ALERTA, f"El valor de Perf. ({perf_val}m) no coincide con el avance calculado A - De ({calc_perf}m).")

                    raw_sum_frags = raw_dict.get("sum_frags_total")
                    sum_frags_col = sanitize_val(raw_sum_frags, float)
                    if sum_frags_col is not None:
                        if rqd_m is not None and lrf_m is not None and small_frag_m is not None:
                            calc_sum = round(rqd_m + lrf_m + small_frag_m, 2)
                            if abs(sum_frags_col - calc_sum) > 0.01:
                                add_err("R151", "sum_frags_total", raw_sum_frags, Severity.ALERTA, f"La suma de fragmentos ({sum_frags_col}m) no coincide con RQD+LRF+Frag<10cm ({calc_sum}m).")
                        if de is not None and a is not None:
                            calc_perf = round(a - de, 2)
                            if round(sum_frags_col, 4) > round(calc_perf, 4):
                                add_err("R152", "sum_frags_total", raw_sum_frags, Severity.ALERTA, f"La suma de fragmentos ({sum_frags_col}m) excede el avance perforado ({calc_perf}m).")

                    raw_r = raw_dict.get("r_indice")
                    if raw_r is not None and str(raw_r).strip() not in ["", "-1", "-1.0"]:
                        r_val = sanitize_val(raw_r, int)
                        raw_res = raw_dict.get("resistencia")
                        if r_val is not None and raw_res:
                            res_upper = str(raw_res).upper().strip()
                            if res_upper.startswith("R") and len(res_upper) > 1 and res_upper[1].isdigit():
                                if r_val != int(res_upper[1]):
                                    add_err("R153", "r_indice", raw_r, Severity.ALERTA, f"El índice R ({r_val}) no coincide con el código ISRM registrado en Resistencia ({raw_res}).")

                    raw_off = raw_dict.get("offset")
                    if raw_off is not None and str(raw_off).strip() not in ["", "-", "-1"]:
                        off_val = sanitize_val(raw_off, float)
                        if off_val is not None and (off_val < 0.0 or off_val > 360.0):
                            add_err("R154", "offset", raw_off, Severity.ALERTA, f"El valor de Offset ({off_val}°) debe estar entre 0° y 360°.")

                    raw_sum_fn = raw_dict.get("sum_frac_nat")
                    if raw_sum_fn is not None and str(raw_sum_fn).strip() not in ["", "-1"]:
                        sum_fn_val = sanitize_val(raw_sum_fn, int)
                        if sum_fn_val is not None and frac_nat is not None:
                            if sum_fn_val != frac_nat:
                                add_err("R155", "sum_frac_nat", raw_sum_fn, Severity.ALERTA, f"La suma de fracturas naturales ({sum_fn_val}) no coincide con el número de fracturas naturales registrado ({frac_nat}).")

        return anomalies


class LGG_FracturesAndFRFRule(BaseRule):
    """Evalúa fracturas naturales, sumatoria de buzamientos y cálculo de FRF."""
    code = "R_LGG_FRACTURES"
    name = "Validación de Fracturas y FRF en LGG"
    group = "LGG"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        lgg_cols = ctx.metadata.get("lgg_columns")

        for taladro, runs in ctx.lgg_by_taladro.items():
            for run in runs:
                r_idx = run.get("_fila_excel", 0)
                corrida = run.get("corrida", 0)
                celda_padre = taladro
                celda_hija = run.get("_celda_hija") or f"{taladro}-C{corrida}"
                camp = str(run.get("campana") or "N/A")
                geo = str(run.get("geologo") or "N/A")
                raw_dict = run.get("_raw_dict", run)

                fn = run.get("frac_nat")
                b30 = run.get("frac_buz30")
                b60 = run.get("frac_buz60")
                b90 = run.get("frac_buz90")
                lrf_m = run.get("lrf_m")

                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="LGG",
                        campania=camp, geotecnico=geo
                    ))

                # Sumatoria de buzamientos vs fracturas naturales
                if b30 is not None and b60 is not None and b90 is not None and fn is not None:
                    sum_bins = b30 + b60 + b90
                    if sum_bins != fn:
                        add_err("R107", "frac_nat", fn, Severity.ADVERTENCIA, f"La sumatoria de fracturas por buzamiento no coincide con el conteo general. Datos evaluados -> Conteo General (Frac_Nat): {fn}, Suma por buzamiento: {sum_bins} (Buz <30°: {b30} + 30°-60°: {b60} + >60°: {b90}).")

                # FRF
                if lgg_cols is None or "frf" in lgg_cols:
                    frf_raw = raw_dict.get("frf")
                    frf_val = sanitize_val(frf_raw, int)
                    if frf_val is not None and frf_val != -1:
                        if frf_val < 0:
                            raw_lrf = raw_dict.get("lrf_m")
                            if is_missing_or_no_info(raw_lrf):
                                add_err("R130", "frf", frf_raw, Severity.ALERTA,
                                        f"El valor de FRF ({frf_val}) es negativo porque el insumo de metraje LRF está vacío o sin información (-1).")
                            else:
                                add_err("R118", "frf", frf_raw, Severity.ALERTA,
                                        f"El valor de FRF no puede ser negativo. Datos evaluados -> FRF: {frf_val}.")
                        try:
                            f_frf = float(frf_raw)
                            if not f_frf.is_integer():
                                add_err("R119", "frf", frf_raw, Severity.ALERTA, f"El valor de FRF debe ser un número entero. Datos evaluados -> FRF: {frf_raw}.")
                        except (ValueError, TypeError):
                            pass
                        if lrf_m is not None:
                            calc_frf = math.floor(round(lrf_m * 100) / 5) + 1 if lrf_m > 0 else 0
                            if frf_val != calc_frf:
                                add_err("R120", "frf", frf_raw, Severity.ALERTA, f"El valor de FRF ({frf_val}) no coincide con el calculado por la fórmula: FRF = PISO( REDOND(LRF * 100) / 5 ) + 1 (si LRF > 0, sino 0). Calculado: {calc_frf} basado en LRF ({lrf_m}m).")

        return anomalies


class LGG_GeomechanicalCompatibilityRule(BaseRule):
    """Evalúa compatibilidad de espesor de relleno vs abertura de juntas."""
    code = "R_LGG_COMPATIBILITY"
    name = "Compatibilidad Geomecánica y Juntas LGG"
    group = "LGG"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}

        for run in ctx.lgg_runs:
            r_idx = run.get("_fila_excel", 0)
            taladro = run.get("taladro", "")
            corrida = run.get("corrida", 0)
            celda_padre = taladro
            celda_hija = run.get("_celda_hija") or f"{taladro}-C{corrida}"
            camp = str(run.get("campana") or "N/A")
            geo = str(run.get("geologo") or "N/A")

            abertura = run.get("abertura")
            espesor = run.get("espesor")
            relleno1 = run.get("relleno1")
            tipo_est1 = str(run.get("tipo_est1") or "").strip().upper()
            tipo_est2 = str(run.get("tipo_est2") or "").strip().upper()

            def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                anomalies.append(Anomaly(
                    rule_code=code, row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                    columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="LGG",
                    campania=camp, geotecnico=geo
                ))

            if espesor is not None and abertura is not None:
                if espesor > abertura and (tipo_est1 not in exceptions and tipo_est2 not in exceptions):
                    add_err("R108", "espesor", espesor, Severity.ALERTA, f"El espesor de relleno no puede ser mayor que la abertura de junta. Datos evaluados -> Espesor: {espesor}mm (Tipo Relleno: '{relleno1}'), Abertura de Junta: {abertura}mm, Estructuras: '{tipo_est1}' / '{tipo_est2}'.")

                if espesor > 0 and abertura <= 0:
                    add_err("R109", "abertura", abertura, Severity.ADVERTENCIA, f"Se declaró espesor de relleno de junta pero la abertura es 0mm. Datos evaluados -> Espesor: {espesor}mm (Tipo Relleno: '{relleno1}'), Abertura de Junta: {abertura}mm.")
                elif espesor == 0 and abertura > 0 and relleno1 not in [None, "-1"]:
                    add_err("R110", "espesor", espesor, Severity.ADVERTENCIA, f"La abertura de junta es mayor a 0mm pero no se ha registrado espesor de relleno. Datos evaluados -> Abertura de Junta: {abertura}mm, Espesor: {espesor}mm (Tipo Relleno: '{relleno1}').")

            # R141: Incompatibilidad geomecánica en RQD (Roca blanda R0-R1 o meteorización intensa IV-VI no debe computar RQD)
            rqd_m = run.get("rqd_m")
            if rqd_m is not None and rqd_m > 0.001:
                raw_dict = run.get("_raw_dict", run)
                raw_res = raw_dict.get("resistencia")
                raw_wth = raw_dict.get("intemperismo")
                res_can = get_canonical_value(raw_res, VALID_STRENGTHS)
                wth_can = get_canonical_value(raw_wth, VALID_WEATHERING)

                is_weak = res_can in ("R0", "R1")
                is_weathered = wth_can in ("HWA", "CWC", "RS")

                if is_weak and is_weathered:
                    add_err("R141", "rqd_m", rqd_m, Severity.ADVERTENCIA,
                            f"Incompatibilidad geomecánica en RQD: Tramos con baja resistencia ('{res_can}') y meteorización intensa ('{wth_can}') no deben aportar al cómputo de RQD por desmoronamiento y falta de competencia estructural (se registró RQD={rqd_m}m).")
                elif is_weak:
                    add_err("R141", "rqd_m", rqd_m, Severity.ADVERTENCIA,
                            f"Incompatibilidad geomecánica en RQD: Tramos con resistencia '{res_can}' (<= 5 MPa) no deben aportar al cómputo de RQD por tratarse de roca extremadamente blanda (se registró RQD={rqd_m}m).")
                elif is_weathered:
                    add_err("R141", "rqd_m", rqd_m, Severity.ADVERTENCIA,
                            f"Incompatibilidad geomecánica en RQD: Tramos con grado de meteorización IV o superior ('{wth_can}') deben ser excluidos del cómputo de RQD por desmoronamiento o descomposición (se registró RQD={rqd_m}m).")

        return anomalies
