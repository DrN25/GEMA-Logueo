"""
app.core.engine.rules.est_rules
Reglas de consistencia geomecánica, ángulos 3D y contención espacial para Logueo Estructural.
"""

from typing import List, Dict, Any, Optional, Set
from app.core.engine.base_rule import BaseRule
from app.core.engine.models import Anomaly, Severity
from app.core.engine.context import ValidationContext
from app.core.engine.rules.common import (
    VALID_STRUCTURES, VALID_STRENGTHS, VALID_FORMA, VALID_RELLENO,
    get_canonical_value, sanitize_val, safe_str, safe_int, safe_float
)

STRENGTH_RANK = {"R0": 0, "R1": 1, "R2": 2, "R3": 3, "R4": 4, "R5": 5, "R6": 6}


class Estructural_MandatoryFieldsRule(BaseRule):
    """Valida presencia de campos obligatorios en Logueo Estructural (vacíos y sin información -1)."""
    code = "R_EST_MANDATORY"
    name = "Campos Obligatorios de Estructural"
    group = "Estructural"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        est_cols = ctx.metadata.get("est_columns")

        if ctx.is_2026:
            mandatory_est = [
                "profundidad", "alfa", "beta", "forma", "rugosidad", "jrc10", "abertura", 
                "weathering", "espesor", "relleno1", "dureza_pared", "agua", "geotecnico", "campana",
                "corrida"
            ]
        else:
            mandatory_est = [
                "profundidad", "alfa", "beta", "forma", "rugosidad", "jrc10", "abertura", 
                "weathering", "espesor", "relleno1", "dureza_pared", "agua", "geotecnico", "campana", 
                "dip", "azimuth"
            ]

        for s in ctx.est_structures:
            r_idx = s.get("_fila_excel", 0)
            taladro = s.get("taladro", "")
            celda_padre = taladro
            celda_hija = s.get("_celda_hija") or f"{taladro}-E{r_idx}"
            camp = str(s.get("campana") or "N/A")
            geo = str(s.get("geotecnico") or "N/A")
            raw_dict = s.get("_raw_dict", s)

            for key in mandatory_est:
                if est_cols is not None and key not in est_cols:
                    continue
                val_raw = raw_dict.get(key)
                if val_raw is None or str(val_raw).strip() == "":
                    anomalies.append(Anomaly(
                        rule_code="R200_EMPTY", row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                        columna=key, valor_actual=None, severity=Severity.VACIO,
                        mensaje=f"El campo obligatorio '{key}' se encuentra vacío.", modulo="Estructural",
                        campania=camp, geotecnico=geo
                    ))
                elif str(val_raw).strip() in ["-1", "-1.0", "-1,0"]:
                    anomalies.append(Anomaly(
                        rule_code="R200_NODATA", row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                        columna=key, valor_actual=val_raw, severity=Severity.SIN_INFORMACION,
                        mensaje=f"El campo obligatorio '{key}' no contiene información (-1).", modulo="Estructural",
                        campania=camp, geotecnico=geo
                    ))

        return anomalies


class Estructural_GeometryAndAnglesRule(BaseRule):
    """Evalúa ángulos espaciales (Alfa, Beta, Dip, Azimuth), forma de junta y relación espesor vs abertura."""
    code = "R_EST_GEOMETRY"
    name = "Geometría 3D y Forma de Estructuras"
    group = "Estructural"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}

        for s in ctx.est_structures:
            r_idx = s.get("_fila_excel", 0)
            taladro = s.get("taladro", "")
            celda_padre = taladro
            celda_hija = s.get("_celda_hija") or f"{taladro}-E{r_idx}"
            camp = str(s.get("campana") or "N/A")
            geo = str(s.get("geotecnico") or "N/A")
            raw_dict = s.get("_raw_dict", s)

            depth = s.get("profundidad")
            abertura = s.get("abertura")
            espesor = s.get("espesor")
            camp_val = s.get("campana")
            dip = s.get("dip")
            azimuth = s.get("azimuth")
            alfa = s.get("alfa")
            beta = s.get("beta")
            jrc10 = s.get("jrc10")
            relleno1 = s.get("relleno1")
            tipo_est = safe_str(s.get("tipo_estructura"))

            def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                anomalies.append(Anomaly(
                    rule_code=code, row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                    columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="Estructural",
                    campania=camp, geotecnico=geo
                ))

            # 1. Valores negativos no permitidos
            raw_depth = raw_dict.get("profundidad")
            if depth is not None and depth < -0.0001:
                add_err("R212", "profundidad", raw_depth, Severity.ALERTA, f"Profundidad ({depth}m) no puede ser negativa.")
            raw_abertura = raw_dict.get("abertura")
            if abertura is not None and abertura < -0.0001:
                add_err("R213", "abertura", raw_abertura, Severity.ALERTA, f"La abertura ({abertura}mm) no puede ser negativa.")
            raw_espesor = raw_dict.get("espesor")
            if espesor is not None and espesor < -0.0001:
                add_err("R214", "espesor", raw_espesor, Severity.ALERTA, f"El espesor de relleno ({espesor}mm) no puede ser negativo.")
            raw_camp = raw_dict.get("campana")
            camp_num = sanitize_val(raw_camp, int)
            if camp_num is not None and camp_num < -0.0001:
                add_err("R215_CAMP", "campana", raw_camp, Severity.ALERTA, f"El año de campaña ({camp_num}) no puede ser negativo.")

            # 2. Ángulos Dip y Azimuth (formato tradicional)
            if not ctx.is_2026:
                raw_dip = raw_dict.get("dip")
                if dip is not None:
                    if dip < 0.0 or dip > 90.0:
                        add_err("R208", "dip", raw_dip, Severity.ALERTA, f"El ángulo Dip es inválido. Datos evaluados -> Dip: {dip}°. Debe estar entre 0° y 90°.")
                raw_azimuth = raw_dict.get("azimuth")
                if azimuth is not None:
                    if azimuth < 0.0 or azimuth > 360.0:
                        add_err("R209", "azimuth", raw_azimuth, Severity.ALERTA, f"El ángulo Azimut es inválido. Datos evaluados -> Azimut: {azimuth}°. Debe estar entre 0° y 360°.")

            # 3. Ángulos Alfa y Beta (todos los formatos)
            if alfa is not None:
                if alfa < 0.0 or alfa > 90.0:
                    add_err("R204", "alfa", alfa, Severity.ALERTA, f"El ángulo Alfa es inválido. Datos evaluados -> Alfa: {alfa}°. Debe estar entre 0° y 90° o ser -1.")
                elif not float(alfa).is_integer():
                    add_err("R205", "alfa", alfa, Severity.ADVERTENCIA, f"El ángulo Alfa debería ser un número entero. Datos evaluados -> Alfa: {alfa}°.")

            if beta is not None:
                if beta < 0.0 or beta > 360.0:
                    add_err("R206", "beta", beta, Severity.ALERTA, f"El ángulo Beta es inválido. Datos evaluados -> Beta: {beta}°. Debe estar entre 0° y 360° o ser -1.")
                elif not float(beta).is_integer():
                    add_err("R207", "beta", beta, Severity.ADVERTENCIA, f"El ángulo Beta debería ser un número entero. Datos evaluados -> Beta: {beta}°.")

            # 4. JRC10
            if jrc10 is not None:
                if jrc10 > 20:
                    add_err("R210", "jrc10", jrc10, Severity.ALERTA, f"El valor de JRC10 es inválido. No se permiten valores mayores a 20. Datos evaluados -> JRC10: {jrc10}.")
                elif jrc10 < 0:
                    add_err("R211", "jrc10", jrc10, Severity.ALERTA, f"El valor de JRC10 no puede ser negativo. Datos evaluados -> JRC10: {jrc10}.")

            # 5. Forma de junta
            raw_forma = sanitize_val(raw_dict.get("forma"), str)
            forma_can = get_canonical_value(raw_forma, VALID_FORMA) if raw_forma is not None else None
            if raw_forma is not None and not forma_can:
                add_err("R210_FORMA", "forma", raw_forma, Severity.ALERTA, f"Forma de junta no válida. Permitidos: Plano (1) a Irregular (6). Datos evaluados -> Forma: '{raw_forma}'.")

            # 6. Espesor vs Abertura de junta
            if espesor is not None and abertura is not None:
                if espesor > abertura and tipo_est not in exceptions:
                    add_err("R211_ESP", "espesor", espesor, Severity.ALERTA, f"El espesor de relleno no puede ser mayor que la abertura de junta excepto en estructuras F, RF, VN, SZ, F+10 o BED. Datos evaluados -> Espesor: {espesor}mm (Tipo Relleno: '{relleno1}'), Abertura de Junta: {abertura}mm, Estructura: '{tipo_est}'.")

                if espesor > 0 and (not relleno1 or relleno1 in ["-1", "cwf"]):
                    add_err("R212_RELL", "relleno1", relleno1, Severity.ADVERTENCIA, f"Se declaró espesor de relleno pero el tipo de relleno está sin definir o es CWF. Datos evaluados -> Espesor: {espesor}mm, Tipo Relleno: '{relleno1}'.")
                elif relleno1 and relleno1 not in ["-1", "cwf"] and abertura <= 0:
                    add_err("R213_RELL", "relleno1", relleno1, Severity.ADVERTENCIA, f"El tipo de relleno está definido pero la abertura de junta es 0mm. Datos evaluados -> Tipo Relleno: '{relleno1}', Abertura de Junta: {abertura}mm, Espesor: {espesor}mm.")

        return anomalies


class Estructural_SpatialContainmentRule(BaseRule):
    """Verifica contención espacial, profundidades huérfanas y concordancia de corridas en LGG."""
    code = "R_EST_SPATIAL"
    name = "Contención Espacial de Estructuras en Corridas LGG"
    group = "Estructural"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []

        for taladro, structures in ctx.est_by_taladro.items():
            lgg_runs = ctx.get_lgg_runs(taladro)
            lgg_max_for_t = ctx.max_lgg_by_taladro.get(taladro, 0.0)

            for s in structures:
                r_idx = s.get("_fila_excel", 0)
                celda_padre = taladro
                celda_hija = s.get("_celda_hija") or f"{taladro}-E{r_idx}"
                camp = str(s.get("campana") or "N/A")
                geo = str(s.get("geotecnico") or "N/A")
                raw_dict = s.get("_raw_dict", s)

                depth = s.get("profundidad")
                est_de = s.get("de")
                est_a = s.get("a")

                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="Estructural",
                        campania=camp, geotecnico=geo
                    ))

                # Límite final de profundidad
                est_end = est_a if est_a is not None else depth
                if est_end is not None:
                    if lgg_max_for_t > 0 and est_end > lgg_max_for_t:
                        add_err("R216_A", "a", est_end, Severity.ALERTA, f"La profundidad final en logueo estructural ('a:') excede el límite final registrado en LGG. Datos evaluados -> Estructural ('a:'): {est_end}m, Profundidad Máxima LGG: {lgg_max_for_t}m.")

                if depth is not None:
                    if lgg_max_for_t > 0 and depth > lgg_max_for_t:
                        add_err("R216", "profundidad", depth, Severity.ALERTA, f"La profundidad en logueo estructural excede el límite final registrado en LGG. Datos evaluados -> Profundidad Estructural: {depth}m, Profundidad Máxima LGG: {lgg_max_for_t}m.")

                # Buscar corrida asociada
                matching_run = ctx.find_lgg_run_for_structure(taladro, est_de, est_a, depth)
                if depth is not None and matching_run is None:
                    add_err("R201", "profundidad", depth, Severity.ALERTA, f"Profundidad huérfana de junta no corresponde a ningún tramo de corrida en LGG. Datos evaluados -> Profundidad de Junta: {depth}m, Taladro: '{taladro}'.")

                # Tramo de corrida declarado en Estructural
                raw_de = raw_dict.get("de")
                if est_de is not None and est_a is not None:
                    has_exact_match = ctx.has_exact_lgg_run(taladro, est_de, est_a, tol=0.001)
                    if not has_exact_match:
                        add_err("R202", "de", raw_de, Severity.ALERTA, f"La corrida asociada (de/a) no existe de forma exacta en las corridas de LGG para el taladro. Datos evaluados -> Tramo Estructural de corrida: {est_de}m - {est_a}m, Taladro: '{taladro}'.")
                    if depth is not None and (depth < est_de or depth > est_a):
                        add_err("R203", "profundidad", depth, Severity.ALERTA, f"La profundidad se encuentra fuera del tramo de corrida especificado. Datos evaluados -> Profundidad de Junta: {depth}m, Tramo especificado: {est_de}m - {est_a}m.")

        return anomalies


class Estructural_CrossCheckWithLGGRule(BaseRule):
    """Evalúa consistencia entre estructuras y corrida: avance, litología, orientación y dureza de pared."""
    code = "R_EST_CROSS_LGG"
    name = "Cruce de Consistencia Estructural vs LGG"
    group = "Estructural"

    def evaluate(self, ctx: ValidationContext) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        r_levels = {"R0": 0, "R1": 1, "R2": 2, "R3": 3, "R4": 4, "R5": 5, "R6": 6}

        for taladro, structures in ctx.est_by_taladro.items():
            for s in structures:
                r_idx = s.get("_fila_excel", 0)
                celda_padre = taladro
                celda_hija = s.get("_celda_hija") or f"{taladro}-E{r_idx}"
                camp = str(s.get("campana") or "N/A")
                geo = str(s.get("geotecnico") or "N/A")
                raw_dict = s.get("_raw_dict", s)

                depth = s.get("profundidad")
                est_de = s.get("de")
                est_a = s.get("a")
                beta = s.get("beta")

                def add_err(code: str, col: str, val: Any, sev: Severity, msg: str):
                    anomalies.append(Anomaly(
                        rule_code=code, row_excel=r_idx, celda_padre=celda_padre, celda_hija=celda_hija,
                        columna=col, valor_actual=val, severity=sev, mensaje=msg, modulo="Estructural",
                        campania=camp, geotecnico=geo
                    ))

                matching_run = ctx.find_lgg_run_for_structure(taladro, est_de, est_a, depth)

                # 1. Corrida Avance (formato 2026)
                if ctx.is_2026:
                    raw_corr_av = raw_dict.get("corrida_avance")
                    if raw_corr_av is not None and str(raw_corr_av).strip() not in ["", "-1"]:
                        av_val = sanitize_val(raw_corr_av, float)
                        if av_val is not None:
                            if av_val <= 0:
                                add_err("R218", "corrida_avance", raw_corr_av, Severity.ALERTA, f"Longitud de corrida perforada debe ser positiva. Datos evaluados -> Avance: {av_val}m.")
                            elif round(av_val, 2) > 1.6:
                                add_err("R219", "corrida_avance", raw_corr_av, Severity.ALERTA, f"Longitud de corrida perforada excede el límite crítico de 1.6m. Datos evaluados -> Avance: {av_val}m.")
                            if matching_run and matching_run.get("de") is not None and matching_run.get("a") is not None:
                                lgg_perf = round(matching_run["a"] - matching_run["de"], 2)
                                if abs(av_val - lgg_perf) > 0.02:
                                    add_err("R220", "corrida_avance", raw_corr_av, Severity.ALERTA, f"Discrepancia en longitud de avance de corrida: Estructural ({av_val}m) vs LGG ({lgg_perf}m, {matching_run['de']}m - {matching_run['a']}m).")

                if matching_run:
                    # 2. Litología entre corrida y junta
                    est_l1 = safe_str(raw_dict.get("lito1"))
                    if ctx.is_2026:
                        if est_l1 and est_l1.upper() not in ("-1", "NAN", "", "NONE"):
                            litos_lgg = {
                                safe_str(matching_run.get(k)).strip().upper()
                                for k in ("lito1", "lito2", "lito3")
                                if safe_str(matching_run.get(k)).strip().upper() not in ("-1", "NAN", "", "NONE")
                            }
                            if litos_lgg and est_l1.strip().upper() not in litos_lgg:
                                lito_lgg_str = "/".join(sorted(litos_lgg))
                                add_err("R215", "lito1", est_l1, Severity.ADVERTENCIA, f"Litología de junta '{est_l1}' no coincide con las litologías registradas en LGG para la corrida ({lito_lgg_str}).")
                    else:
                        est_l2 = safe_str(raw_dict.get("lito2"))
                        est_l3 = safe_str(raw_dict.get("lito3"))
                        lgg_l1 = safe_str(matching_run.get("lito1"))
                        lgg_l2 = safe_str(matching_run.get("lito2"))
                        lgg_l3 = safe_str(matching_run.get("lito3"))
                        if est_l1 and est_l1.upper() not in ("-1", "NAN", "", "NONE") and lgg_l1 and lgg_l1.upper() not in ("-1", "NAN", "", "NONE"):
                            if est_l1.strip().upper() != lgg_l1.strip().upper() or (est_l2 and lgg_l2 and est_l2.strip().upper() not in ("-1", "NAN", "") and est_l2.strip().upper() != lgg_l2.strip().upper()):
                                lito_est_str = f"{est_l1}/{est_l2}/{est_l3}".strip("/")
                                lito_lgg_str = f"{lgg_l1}/{lgg_l2}/{lgg_l3}".strip("/")
                                add_err("R215", "lito1", lito_est_str, Severity.ADVERTENCIA, f"Incompatibilidad de litología entre la corrida y la junta. Datos evaluados -> Estructural: '{lito_est_str}', LGG: '{lito_lgg_str}'.")

                    # 3. Coherencia línea de orientación (2026)
                    if ctx.is_2026:
                        lgg_ori = matching_run.get("linea_orientacion")
                        if lgg_ori == "N" and beta is not None and beta >= 0:
                            add_err("R222", "beta", beta, Severity.ADVERTENCIA, f"Registro de estructura orientada (Beta={beta}°) en corrida con línea de orientación 'N' (no orientada).")

                    # 4. Dureza de pared de junta vs resistencia máxima estimada de corrida
                    raw_dureza = sanitize_val(raw_dict.get("dureza_pared"), str)
                    dureza_can = get_canonical_value(raw_dureza, VALID_STRENGTHS) if raw_dureza is not None else None
                    if raw_dureza is not None and not dureza_can:
                        add_err("R223", "dureza_pared", raw_dureza, Severity.ALERTA, f"Código de Resistencia ISRM no válido. Permitidos: {', '.join(VALID_STRENGTHS)}")

                    dureza_pared = dureza_can
                    if dureza_pared and dureza_pared != "-1":
                        res_matriz = matching_run.get("resistencia")
                        if res_matriz and res_matriz != "-1" and dureza_pared in r_levels and res_matriz in r_levels:
                            if r_levels[dureza_pared] > r_levels[res_matriz]:
                                add_err("R214", "dureza_pared", raw_dureza, Severity.ADVERTENCIA, f"Incompatibilidad geológica (Dureza de pared de junta supera la resistencia maxima estimada de la corrida). Datos evaluados -> Dureza de Pared de Junta en Estructural: {dureza_pared}, Resistencia Maxima Estimada en LGG: {res_matriz}.")

        return anomalies
