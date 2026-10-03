"""
app.core.engine.rules.rmr_rules
Reglas de concordancia geomecánica, cruce de corridas y cálculos matemáticos para Validación RMR.
"""

from typing import List, Dict, Any, Optional
from app.core.engine.base_rule import BaseRule
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext
from app.calculator import FILLING_CLASSES, _norm_code

# Tabla de Relleno canónica (admite códigos y nombres descriptivos)
CANONICAL_FILLING_CLASS = {
    # Clase 1: Blando
    "CA": 1, "CALCITA": 1, "SAND": 1, "ARENA": 1, "CH": 1, "CLORITA": 1,
    "CL": 1, "ARCILLA": 1, "GY": 1, "YESO": 1, "RXF": 1, "ROCA TRITURADA": 1,
    "GOU": 1, "PANIZO": 1, "PAT": 1, "PATINAS": 1,
    # Clase 2: Duro
    "FBX": 2, "BRECHA DE FALLA": 2, "SIO": 2, "SILICATOS": 2, "QZ": 2, "CUARZO": 2,
    "SU": 2, "SULFUROS": 2, "OX": 2, "OXIDO DE COBRE": 2, "EP": 2, "EPIDOTA": 2,
    # Clase 3: Sin relleno
    "CWF": 3, "LIMPIA, SIN RELLENO": 3, "SIN RELLENO": 3
}


class RMR_MandatoryFieldsRule(BaseRule):
    """Verifica que los campos obligatorios de Validación RMR no estén vacíos ni contengan -1."""
    code = "R_RMR_MANDATORY"
    name = "Campos Obligatorios de Validación RMR"
    group = "Validación RMR"

    MANDATORY_FIELDS = [
        ("sondaje", "Sondaje"), ("corrida", "Corrida"), ("logueador", "Logueador"),
        ("de", "Desde (m)"), ("a", "Hasta (m)"),
        ("long_corrida", "Long. Corrida (m)"), ("lito1", "Litho 1"), ("rec_m", "Rec (m)"),
        ("rec_pct", "Rec (%)"), ("rqd_m", "RQD (m)"), ("rqd_pct", "RQD (%)"),
        ("lrf_m", "Long. Tramo fracturado (m)"), ("frf", "FRF (zonas trituradas)"),
        ("frac_nat", "Fracturas naturales"), ("total_frac", "Total de Fracturas"),
        ("ff_1m", "FF/1m"), ("espaciamiento_mm", "Espaciamiento (mm)"), ("resistencia", "Resistencia"),
        ("tipo_estructura", "Tipo de Estructura"), ("abertura_mm", "Abertura (mm)"),
        ("rugosidad", "Rugosidad"), ("relleno", "Relleno"), ("clasificacion_relleno", "Clasificación Relleno"),
        ("intemperismo", "Intemperismo"), ("jrc10", "JRC10"), ("espesor_relleno", "Espesor de relleno")
    ]

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        for taladro, rmr_runs in ctx.rmr_by_taladro.items():
            for rmr in rmr_runs:
                r_idx = rmr.get("_fila_excel", 0)
                corrida_num = rmr.get("corrida", 0)
                celda_hija = f"{taladro}-RMR{corrida_num if corrida_num > 0 else r_idx}"
                camp = str(rmr.get("campana") or "N/A")
                tipo_est = str(rmr.get("tipo_estructura") or "").upper().strip()
                is_se = (tipo_est == "SE")

                for field_key, field_lbl in self.MANDATORY_FIELDS:
                    if is_se and field_key in ("relleno", "clasificacion_relleno", "abertura_mm", "espesor_relleno"):
                        continue
                    val_raw = rmr.get(field_key)
                    if val_raw is None or str(val_raw).strip() == "":
                        anomalies.append(Anomaly(
                            rule_code="R101", row_excel=r_idx, celda_padre=taladro, celda_hija=celda_hija,
                            columna=field_key, valor_actual=None, severity=Severity.VACIO,
                            mensaje=f"El campo obligatorio '{field_lbl}' se encuentra vacío.",
                            modulo="Validación RMR", campania=camp
                        ))
                    elif str(val_raw).strip() in ["-1", "-1.0", "-1,0"]:
                        anomalies.append(Anomaly(
                            rule_code="R102", row_excel=r_idx, celda_padre=taladro, celda_hija=celda_hija,
                            columna=field_key, valor_actual=val_raw, severity=Severity.SIN_INFORMACION,
                            mensaje=f"El campo obligatorio '{field_lbl}' no contiene información (-1).",
                            modulo="Validación RMR", campania=camp
                        ))
        return anomalies


class RMR_CrossCheckWithLGGRule(BaseRule):
    """Verifica que cada corrida de RMR cuadre exactamente con la corrida correspondiente de LGG."""
    code = "R_RMR_LGG_CROSS"
    name = "Cruce Integral Validación RMR vs LGG"
    group = "Validación RMR"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        # 1. Regla global de cantidad total de corridas
        for taladro, lgg_runs in ctx.lgg_by_taladro.items():
            rmr_runs = ctx.get_rmr_runs(taladro)
            if lgg_runs and len(rmr_runs) > 0 and len(rmr_runs) != len(lgg_runs):
                anomalies.append(Anomaly(
                    rule_code="R401", row_excel=0, celda_padre=taladro, celda_hija=taladro,
                    columna="Total Corridas", valor_actual=len(rmr_runs), severity=Severity.ALERTA,
                    mensaje=f"Inconsistencia total de corridas: El taladro '{taladro}' registra {len(rmr_runs)} corridas en Validación RMR vs {len(lgg_runs)} corridas en LGG.",
                    modulo="Validación RMR"
                ))

        # 2. Regla corrida a corrida
        for taladro, rmr_runs in ctx.rmr_by_taladro.items():
            for rmr in rmr_runs:
                r_idx = rmr.get("_fila_excel", 0)
                corrida_num = rmr.get("corrida", 0)
                celda_hija = f"{taladro}-RMR{corrida_num if corrida_num > 0 else r_idx}"
                camp = str(rmr.get("campana") or "N/A")

                de = rmr.get("de")
                a = rmr.get("a")

                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=taladro, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="Validación RMR",
                        campania=camp
                    ))

                lgg_run = ctx.find_matching_lgg_run(taladro, corrida_num=corrida_num, de=de, a=a)
                if not lgg_run:
                    add_err("R401", "corrida", corrida_num, Severity.ALERTA,
                            f"Corrida en Validación RMR (Corrida #{corrida_num}) no coincide con ninguna corrida registrada en LGG para el taladro '{taladro}'.")
                    continue

                # Intervalo Desde/Hasta
                l_de = lgg_run.get("de", 0.0) or 0.0
                l_a = lgg_run.get("a", 0.0) or 0.0
                if de is not None and a is not None:
                    if abs(de - l_de) > 0.001 or abs(a - l_a) > 0.001:
                        add_err("R402", "de", f"{de}-{a}", Severity.ALERTA,
                                f"Intervalo Desde/Hasta ({de}m - {a}m) en RMR no coincide exactamente con el intervalo de LGG ({l_de}m - {l_a}m).")

                # Longitud de corrida
                long_corrida = rmr.get("long_corrida")
                if de is not None and a is not None and long_corrida is not None:
                    expected_long = round(a - de, 2)
                    if long_corrida <= 0:
                        add_err("R425", "long_corrida", long_corrida, Severity.ALERTA, f"La Longitud de Corrida ({long_corrida}m) debe ser mayor a 0.")
                    if abs(long_corrida - expected_long) > 0.1:
                        add_err("R403", "long_corrida", long_corrida, Severity.ALERTA,
                                f"La Longitud de Corrida ({long_corrida}m) no coincide con (Hasta - Desde = {expected_long}m) dentro de la tolerancia de 0.1m.")

                # Litologías
                r_l1, r_l2, r_l3 = str(rmr.get("lito1") or ""), str(rmr.get("lito2") or ""), str(rmr.get("lito3") or "")
                l_l1, l_l2, l_l3 = str(lgg_run.get("lito1") or ""), str(lgg_run.get("lito2") or ""), str(lgg_run.get("lito3") or "")
                if (r_l1 != l_l1) or (r_l2 != l_l2) or (r_l3 != l_l3):
                    add_err("R406", "lito1", f"{r_l1}/{r_l2}/{r_l3}", Severity.ALERTA,
                            f"Combinación litológica en RMR ({r_l1}, {r_l2}, {r_l3}) no coincide con LGG ({l_l1}, {l_l2}, {l_l3}).")

                # Recuperación
                rec_m = rmr.get("rec_m")
                l_rec = lgg_run.get("rec_m", 0.0) or 0.0
                if rec_m is not None and abs(rec_m - l_rec) > 0.001:
                    add_err("R404", "rec_m", rec_m, Severity.ALERTA, f"Rec (m) en RMR ({rec_m}m) no coincide con la Recuperación de LGG ({l_rec}m).")

                # RQD
                rqd_m = rmr.get("rqd_m")
                l_rqd = lgg_run.get("rqd_m", 0.0) or 0.0
                if rqd_m is not None and abs(rqd_m - l_rqd) > 0.001:
                    add_err("R405", "rqd_m", rqd_m, Severity.ALERTA, f"RQD (m) en RMR ({rqd_m}m) no coincide con el RQD de LGG ({l_rqd}m).")

                # LRF
                lrf_m = rmr.get("lrf_m")
                l_lrf = lgg_run.get("lrf_m", 0.0) or 0.0
                if lrf_m is not None and abs(lrf_m - l_lrf) > 0.001:
                    add_err("R412", "lrf_m", lrf_m, Severity.ALERTA, f"Longitud de Tramo Fracturado ({lrf_m}m) no coincide con LRF de LGG ({l_lrf}m).")

                # FRF
                frf = rmr.get("frf")
                l_frf = lgg_run.get("frf")
                if frf is not None and l_frf is not None and frf != l_frf:
                    add_err("R409", "frf", frf, Severity.ALERTA, f"FRF en RMR ({frf}) no coincide con FRF de LGG ({l_frf}).")

                # Fracturas naturales
                fn = rmr.get("frac_nat")
                l_fn = lgg_run.get("frac_nat")
                if fn is not None and l_fn is not None and fn != l_fn:
                    add_err("R408", "frac_nat", fn, Severity.ALERTA, f"Fracturas Naturales en RMR ({fn}) no coincide con Frac Nat de LGG ({l_fn}).")

                # Resistencia
                res = str(rmr.get("resistencia") or "").strip().upper()
                l_res = str(lgg_run.get("resistencia") or "").strip().upper()
                if res and l_res and res != l_res:
                    add_err("R407", "resistencia", res, Severity.ALERTA, f"Resistencia en RMR ({res}) no coincide con LGG ({l_res}).")

                # Tipo estructura
                tipo_est = str(rmr.get("tipo_estructura") or "").strip().upper()
                l_tipo_est = str(lgg_run.get("tipo_est1") or "").strip().upper()
                if tipo_est and l_tipo_est and tipo_est != l_tipo_est:
                    add_err("R419", "tipo_estructura", tipo_est, Severity.ALERTA, f"Tipo de Estructura en RMR ({tipo_est}) no coincide con LGG ({l_tipo_est}).")

                # Abertura
                ab = rmr.get("abertura_mm")
                l_ab = lgg_run.get("abertura", 0.0) or 0.0
                if ab is not None and abs(ab - l_ab) > 0.001:
                    add_err("R413", "abertura_mm", ab, Severity.ALERTA, f"Abertura en RMR ({ab}mm) no coincide con LGG ({l_ab}mm).")

                # Rugosidad
                rug = str(rmr.get("rugosidad") or "").strip()
                l_rug = str(lgg_run.get("rugosidad") or "").strip()
                if rug and l_rug and rug != l_rug:
                    add_err("R414", "rugosidad", rug, Severity.ALERTA, f"Rugosidad en RMR ({rug}) no coincide con LGG ({l_rug}).")

                # Relleno
                rel = str(rmr.get("relleno") or "").strip().lower()
                l_rel = str(lgg_run.get("relleno1") or "").strip().lower()
                if rel and l_rel and rel != l_rel:
                    add_err("R417", "relleno", rel, Severity.ALERTA, f"Relleno en RMR ({rel}) no coincide con LGG ({l_rel}).")

                # Espesor relleno
                esp = rmr.get("espesor_relleno")
                l_esp = lgg_run.get("espesor", 0.0) or 0.0
                if esp is not None and abs(esp - l_esp) > 0.001:
                    add_err("R418", "espesor_relleno", esp, Severity.ALERTA, f"Espesor de relleno en RMR ({esp}mm) no coincide con LGG ({l_esp}mm).")

                # Intemperismo
                weather = str(rmr.get("intemperismo") or "").strip().upper()
                l_weather = str(lgg_run.get("intemperismo") or "").strip().upper()
                if weather and l_weather and weather != l_weather:
                    add_err("R416", "intemperismo", weather, Severity.ALERTA, f"Intemperismo en RMR ({weather}) no coincide con LGG ({l_weather}).")

                # JRC10
                jrc = rmr.get("jrc10")
                l_jrc = lgg_run.get("jrc10")
                if jrc is not None and l_jrc is not None and jrc != l_jrc:
                    add_err("R415", "jrc10", jrc, Severity.ALERTA, f"JRC10 en RMR ({jrc}) no coincide con LGG ({l_jrc}).")

        return anomalies


class RMR_FormulasAndRatingsRule(BaseRule):
    """Evalúa fórmulas matemáticas de RMR (Rec%, RQD%, Spacing, FRF+Fn, Agua teórica y Descuadre RMR 76/89)."""
    code = "R_RMR_FORMULAS"
    name = "Fórmulas Matemáticas y Descuadres de RMR"
    group = "Validación RMR"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        for taladro, rmr_runs in ctx.rmr_by_taladro.items():
            for rmr in rmr_runs:
                r_idx = rmr.get("_fila_excel", 0)
                corrida_num = rmr.get("corrida", 0)
                celda_hija = f"{taladro}-RMR{corrida_num if corrida_num > 0 else r_idx}"
                camp = str(rmr.get("campana") or "N/A")

                a = rmr.get("a")
                long_corrida = rmr.get("long_corrida")
                rec_m = rmr.get("rec_m")
                rec_pct = rmr.get("rec_pct")
                rqd_m = rmr.get("rqd_m")
                rqd_pct = rmr.get("rqd_pct")
                frf = rmr.get("frf")
                fn = rmr.get("frac_nat")
                total_frac = rmr.get("total_frac")
                ff_1m = rmr.get("ff_1m")
                espaciamiento = rmr.get("espaciamiento_mm")
                relleno = str(rmr.get("relleno") or "").strip()
                clasif_relleno = rmr.get("clasificacion_relleno")
                pres_agua = str(rmr.get("presencia_agua") or "").strip().upper()

                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=taladro, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="Validación RMR",
                        campania=camp
                    ))

                # 1. Rec (%)
                if rec_m is not None and long_corrida is not None and long_corrida > 0 and rec_pct is not None:
                    exp_rec_pct = round((rec_m / long_corrida) * 100)
                    if abs(rec_pct - exp_rec_pct) > 1.0:
                        add_err("R423", "rec_pct", rec_pct, Severity.ALERTA,
                                f"Rec (%) en RMR ({rec_pct}%) no coincide con la fórmula Rec(m)/Long.Corrida(m). Datos evaluados -> Rec({rec_m}m) / Long.Corrida({long_corrida}m) * 100 = {exp_rec_pct}%.")

                # 2. RQD (%)
                if rqd_m is not None and long_corrida is not None and long_corrida > 0 and rqd_pct is not None:
                    exp_rqd_pct = round((rqd_m / long_corrida) * 100)
                    if abs(rqd_pct - exp_rqd_pct) > 1.0:
                        add_err("R422", "rqd_pct", rqd_pct, Severity.ALERTA,
                                f"RQD (%) en RMR ({rqd_pct}%) no coincide con la fórmula RQD(m)/Long.Corrida(m). Datos evaluados -> RQD({rqd_m}m) / Long.Corrida({long_corrida}m) * 100 = {exp_rqd_pct}%.")

                # 3. Total de Fracturas = FRF + FracNat
                if frf is not None and fn is not None and total_frac is not None:
                    exp_tot = round(frf + fn)
                    if abs(total_frac - exp_tot) > 0.01:
                        add_err("R410", "total_frac", total_frac, Severity.ALERTA,
                                f"Total de Fracturas en RMR ({total_frac}) no coincide con FRF + FracNat. Datos evaluados -> FRF({frf}) + FracNat({fn}) = {exp_tot}.")

                # 4. FF/1m
                if total_frac is not None and long_corrida is not None and long_corrida > 0 and ff_1m is not None:
                    exp_ff = round(total_frac / long_corrida)
                    if abs(ff_1m - exp_ff) > 1.0:
                        add_err("R424", "ff_1m", ff_1m, Severity.ALERTA,
                                f"FF/1m en RMR ({ff_1m}) no coincide con TotalFracturas / Long.Corrida. Datos evaluados -> TotalFracturas({total_frac}) / Long.Corrida({long_corrida}m) = {exp_ff}.")

                # 5. Espaciamiento
                if total_frac is not None and long_corrida is not None and long_corrida > 0 and espaciamiento is not None:
                    exp_esp = round(long_corrida * 1000) if round(total_frac) == 0 else round(long_corrida * 1000 / total_frac)
                    if abs(espaciamiento - exp_esp) > 2.0:
                        add_err("R411", "espaciamiento_mm", espaciamiento, Severity.ALERTA,
                                f"Espaciamiento ({espaciamiento}mm) no coincide con la fórmula calculada. Datos evaluados -> Long.Corrida({long_corrida}m) * 1000 / TotalFracturas({total_frac}) = {exp_esp}mm.")

                # 6. Clasificación de Relleno (Normalización robusta)
                if relleno:
                    norm_r = _norm_code(relleno)
                    exp_class = CANONICAL_FILLING_CLASS.get(norm_r, FILLING_CLASSES.get(norm_r, 1))
                    if clasif_relleno is not None and clasif_relleno != exp_class:
                        add_err("R421", "clasificacion_relleno", clasif_relleno, Severity.ALERTA,
                                f"Clasificación de Relleno ({clasif_relleno}) no coincide con el código '{relleno}' (Clase esperada: {exp_class}).")

                # 7. Presencia de Agua Teórica según profundidad
                if a is not None and pres_agua and pres_agua != "-1":
                    expected_water = "CDC" if a < 92.0 else ("DPH" if a < 97.0 else "WTM")
                    if pres_agua not in ("CDC", "DPH", "WTM", "DGE", "FGF"):
                        add_err("R114", "presencia_agua", pres_agua, Severity.ALERTA,
                                f"Código de Presencia de Agua en RMR ('{pres_agua}') no es válido según norma ISRM.")
                    elif pres_agua != expected_water:
                        add_err("R310", "presencia_agua", pres_agua, Severity.ALERTA,
                                f"Presencia de Agua ({pres_agua}) no coincide con tabla teórica (esperado {expected_water} según profundidad {a}m).")

                # 8. Descuadre RMR'76 (Suma directa de sub-ratings registrados, vacíos = 0.0)
                rmr76_excel = rmr.get("rmr76")
                r76_res = rmr.get("r76_resistencia") or 0.0
                r76_rqd = rmr.get("r76_rqd") or 0.0
                r76_esp = rmr.get("r76_espaciamiento") or 0.0
                r76_juntas = rmr.get("r76_juntas") or 0.0
                r76_agua = rmr.get("r76_agua") or 0.0
                expected_rmr76 = r76_res + r76_rqd + r76_esp + r76_juntas + r76_agua

                if rmr76_excel is not None:
                    if rmr76_excel < 0 or rmr76_excel > 100:
                        add_err("R_RMR76_RANGE", "rmr76", rmr76_excel, Severity.ALERTA,
                                f"Puntaje RMR'76 ({rmr76_excel}) fuera del rango permitido de 0 a 100.")
                    elif abs(rmr76_excel - expected_rmr76) > 0.5:
                        add_err("R_RMR76_MISMATCH", "rmr76", rmr76_excel, Severity.ALERTA,
                                f"Descuadre en RMR'76: Excel registra {rmr76_excel}, pero la suma de sub-ratings registrados es {expected_rmr76}. Desglose -> Resistencia({r76_res}) + RQD({r76_rqd}) + Espaciamiento({r76_esp}) + Condición de Juntas({r76_juntas}) + Presencia de Agua({r76_agua}) = {expected_rmr76}.")

                # 9. Descuadre RMR'89 (Suma directa de sub-ratings registrados, vacíos = 0.0)
                rmr89_excel = rmr.get("rmr89")
                r89_res = rmr.get("r89_resistencia") or 0.0
                r89_rqd = rmr.get("r89_rqd") or 0.0
                r89_esp = rmr.get("r89_espaciamiento") or 0.0
                r89_juntas = rmr.get("r89_juntas") or 0.0
                r89_agua = rmr.get("r89_agua") or 0.0
                expected_rmr89 = r89_res + r89_rqd + r89_esp + r89_juntas + r89_agua

                if rmr89_excel is not None:
                    if rmr89_excel < 0 or rmr89_excel > 100:
                        add_err("R_RMR89_RANGE", "rmr89", rmr89_excel, Severity.ALERTA,
                                f"Puntaje RMR'89 ({rmr89_excel}) fuera del rango permitido de 0 a 100.")
                    elif abs(rmr89_excel - expected_rmr89) > 0.5:
                        add_err("R_RMR89_MISMATCH", "rmr89", rmr89_excel, Severity.ALERTA,
                                f"Descuadre en RMR'89: Excel registra {rmr89_excel}, pero la suma de sub-ratings registrados es {expected_rmr89}. Desglose -> Resistencia({r89_res}) + RQD({r89_rqd}) + Espaciamiento({r89_esp}) + Condición de Juntas({r89_juntas}) + Presencia de Agua({r89_agua}) = {expected_rmr89}.")

        return anomalies
