import os
import json
import math
import openpyxl
from typing import List, Dict, Any
from app.core.rules import WEATHERING_COMPATIBILITY, MASTER_ERROR_RULES

# Mapeos de palabras clave para detector heurístico de columnas
LGG_PATTERNS = {
    "corrida": ["id", "corrida"],
    "taladro": ["taladro", "sondaje"],
    "de": ["de:", "de", "desde"],
    "a": ["a:", "a", "hasta"],
    "rec_m": ["recuperada", "rec_m", "rec"],
    "rqd_m": ["rqd", "frag's>10", "fragmentos"],
    "lrf_m": ["roca fracturada", "lrf_m", "lrf"],
    "small_frag_m": ["frf", "small"],
    "frac_nat": ["frac. naturales", "nº de frac", "frac_nat"],
    "lito1": ["lito 1_2023", "lito 1", "litologia 1"],
    "lito2": ["lito 2_2023", "lito 2", "litologia 2"],
    "lito3": ["lito 3_2023", "lito 3", "litologia 3"],
    "resistencia": ["resist. estimada", "resistencia", "isrm"],
    "tipo_est1": ["tipo de estruct.", "estructura"],
    "tipo_est2": ["tipo de estruct. 2"],
    "frac_buz30": ["buz<30", "buz 30"],
    "frac_buz60": ["30°<buz<60", "buz60"],
    "frac_buz90": ["buz>60", "buz90"],
    "abertura": ["abertura"],
    "rugosidad": ["rugosidad (isrm)", "rugosidad"],
    "jrc10": ["jrc10", "jrc"],
    "intemperismo": ["grado intemp.", "intemperismo"],
    "relleno1": ["tipo de relleno 1", "relleno 1"],
    "relleno2": ["tipo de relleno 2", "relleno 2"],
    "espesor": ["espesor relleno", "espesor"],
    "agua_obs": ["presen. agua", "agua"],
    "geologo": ["geotécnico", "geotecnico", "geologo"],
    "comentarios": ["comentarios", "comentario"],
    "campana": ["campaña", "campana"]
}

EST_PATTERNS = {
    "taladro": ["taladro", "sondaje"],
    "de": ["de:", "de", "desde"],
    "a": ["a:", "a", "hasta"],
    "profundidad": ["profundidad"],
    "lito1": ["lito 1", "litologia 1"],
    "lito2": ["lito 2", "litologia 2"],
    "lito3": ["lito 3", "litologia 3"],
    "tipo_estructura": ["tipo de estructura", "estructura"],
    "alfa": ["alpha", "alfa"],
    "beta": ["beta"],
    "dip": ["dip"],
    "azimuth": ["azimuth", "azimut"],
    "forma": ["forma"],
    "rugosidad": ["rugosidad (isrm)", "rugosidad"],
    "jrc10": ["jrc10", "jrc"],
    "abertura": ["abertura"],
    "weathering": ["grado intemperismo", "weathering", "intemperismo"],
    "espesor": ["espesor relleno", "espesor"],
    "relleno1": ["tipo de relleno", "relleno 1", "relleno1"],
    "relleno2": ["tipo de relleno 2", "relleno2"],
    "dureza_pared": ["dureza de la pared", "dureza"],
    "agua": ["presen. agua", "agua"],
    "geotecnico": ["geotécnico", "geotecnico", "geologo"],
    "comentario": ["intervalo", "comentario", "comentarios"],
    "campana": ["campaña", "campana"]
}

# Fallbacks basados en excels_logueo.md
FALLBACK_LGG_MAP = {
    "corrida": 1, "taladro": 2, "de": 3, "a": 4, "rec_m": 5, "rqd_m": 6, "lrf_m": 7, "small_frag_m": 8,
    "frac_nat": 9, "lito1": 10, "lito2": 11, "lito3": 12, "resistencia": 13, "tipo_est1": 14, "tipo_est2": 15,
    "frac_buz30": 16, "frac_buz60": 17, "frac_buz90": 18, "abertura": 19, "rugosidad": 20, "jrc10": 21,
    "intemperismo": 22, "relleno1": 23, "relleno2": 24, "espesor": 25, "agua_obs": 26, "geologo": 27,
    "comentarios": 28, "campana": 29
}

FALLBACK_EST_MAP = {
    "taladro": 2, "de": 3, "a": 4, "profundidad": 5, "lito1": 6, "lito2": 7, "lito3": 8, "tipo_estructura": 9,
    "alfa": 10, "beta": 11, "dip": 12, "azimuth": 13, "forma": 14, "rugosidad": 15, "jrc10": 16, "abertura": 17,
    "weathering": 18, "espesor": 19, "relleno1": 20, "relleno2": 21, "dureza_pared": 22, "agua": 23,
    "geotecnico": 24, "comentario": 25, "campana": 26
}

def validate_row_qaqc(data: Dict[str, Any]) -> List[Dict[str, str]]:
    """Ejecuta todos los controles de calidad geomecánicos QA/QC en una corrida de LGG en caliente."""
    alerts = []
    try:
        de = float(data.get("de", 0.0))
        a = float(data.get("a", 0.0))
        perf = round(a - de, 2)
        rec_val = float(data.get("rec_m", 0.0))
        rec_m = 0.0 if rec_val < 0 else rec_val
        rqd_val = float(data.get("rqd_m", 0.0))
        rqd_m = 0.0 if rqd_val < 0 else rqd_val
        lrf_val = float(data.get("lrf_m", 0.0))
        lrf_m = 0.0 if lrf_val < 0 else lrf_val
        small_val = float(data.get("small_frag_m", 0.0))
        small_frag_m = 0.0 if small_val < 0 else small_val
        fn_val = int(data.get("frac_nat", 0))
        frac_nat = 0 if fn_val < 0 else fn_val
        b30_val = int(data.get("frac_buz30", 0))
        buz30 = 0 if b30_val < 0 else b30_val
        buz60_val = int(data.get("frac_buz60", 0))
        buz60 = 0 if buz60_val < 0 else buz60_val
        buz90_val = int(data.get("frac_buz90", 0))
        buz90 = 0 if buz90_val < 0 else buz90_val
        resistencia = data.get("resistencia", "R4")
        weathering = data.get("intemperismo", "UWF")
        aperture = float(data.get("abertura", 0.0))
        thickness = float(data.get("espesor", 0.0))

        if perf <= 0:
            alerts.append({"type": "CRITICAL", "field": "a", "message": f"Profundidad final ({a}m) debe ser mayor a la inicial ({de}m)."})
        elif perf > 1.6:
            alerts.append({"type": "CRITICAL", "field": "a", "message": f"La longitud de corrida ({perf}m) excede el límite máximo de perforación de 1.6m."})
        if rec_m > perf:
            alerts.append({"type": "CRITICAL", "field": "rec_m", "message": f"Longitud recuperada ({rec_m}m) es físicamente mayor que la perforada ({perf}m)."})
        if rqd_m > rec_m:
            alerts.append({"type": "CRITICAL", "field": "rqd_m", "message": f"El metraje de RQD ({rqd_m}m) no puede ser mayor que la longitud recuperada ({rec_m}m)."})
        sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
        if sum_frags > perf:
            alerts.append({"type": "CRITICAL", "field": "rqd_m", "message": f"La suma de fragmentos ({sum_frags}m) supera el avance total de la corrida ({perf}m)."})
        sum_bins = buz30 + buz60 + buz90
        if sum_bins != frac_nat:
            alerts.append({"type": "WARNING", "field": "frac_nat", "message": f"La suma de fracturas naturales clasificadas por buzamiento ({sum_bins}) no coincide con el conteo general ({frac_nat})."})
        if thickness > 0 and aperture <= 0:
            alerts.append({"type": "WARNING", "field": "abertura", "message": f"Se ha registrado un espesor de relleno de {thickness}mm, pero la abertura de junta es 0mm."})
        elif thickness == 0 and aperture > 0:
            alerts.append({"type": "WARNING", "field": "espesor", "message": f"La abertura de junta es {aperture}mm, pero no se ha registrado espesor de relleno."})
        valid_weatherings = WEATHERING_COMPATIBILITY.get(resistencia)
        if valid_weatherings and weathering not in valid_weatherings:
            alerts.append({"type": "WARNING", "field": "intemperismo", "message": f"Incompatibilidad geológica: Roca con resistencia {resistencia} no puede registrar intemperismo {weathering}. Permitidos: {', '.join(valid_weatherings)}."})
    except Exception as e:
        alerts.append({"type": "CRITICAL", "field": "global", "message": f"Error al procesar reglas de consistencia: {str(e)}"})
    return alerts

# --- METODOS PARA AUDITORIA DE EXCEL BULK ---

def find_header_row_and_mapping(sheet, keyword_maps) -> tuple:
    best_row = 6  # fallback a la fila estándar
    best_matches = 0
    best_mapping = {}

    for r in range(1, 21):
        matches = 0
        mapping = {}
        for c in range(1, sheet.max_column + 1):
            val = str(sheet.cell(row=r, column=c).value or "").strip().lower()
            if not val:
                continue
            for key, patterns in keyword_maps.items():
                if key in mapping:
                    continue
                for pat in patterns:
                    if pat in val:
                        mapping[key] = c
                        matches += 1
                        break
        if matches > best_matches:
            best_matches = matches
            best_row = r
            best_mapping = mapping
            
    return best_row, best_mapping

def safe_float(val, default=0.0):
    if val is None: return default
    try: return float(val)
    except: return default

def safe_int(val, default=0):
    if val is None: return default
    try: return int(float(val))
    except: return default

def safe_str(val, default=""):
    if val is None: return default
    return str(val).strip()

def sanitize_val(val, target_type):
    if val is None:
        return None
    val_str = str(val).strip()
    val_upper = val_str.upper()
    if val_str == "" or val_upper in ["-1", "-1.0", "N/A", "NAN", "NONE", "-", "-1,0"]:
        return None
    if target_type == str:
        return val_str
    try:
        if target_type == int:
            return int(float(val))
        return target_type(val)
    except:
        return None

def get_row_dict(ws, row_idx, mapping):
    row_data = {}
    is_empty = True
    for key, col_idx in mapping.items():
        cell_val = ws.cell(row=row_idx, column=col_idx).value
        if cell_val is not None and str(cell_val).strip() != "":
            is_empty = False
        row_data[key] = cell_val
    return row_data, is_empty

def validate_logueo_bulk_sheets(file_path: str, lgg_sheet: str, est_sheet: str, output_json_path: str):
    """
    Lee las hojas seleccionadas de LGG y Estructural, y realiza
    las validaciones cruzadas basándose en las reglas centralizadas.
    Guarda los resultados detallados en output_json_path.
    """
    wb = openpyxl.load_workbook(file_path, data_only=True)
    try:
        _validate_logueo_bulk_sheets_core(wb, lgg_sheet, est_sheet, output_json_path)
    finally:
        try: wb.close()
        except: pass

def _validate_logueo_bulk_sheets_core(wb, lgg_sheet: str, est_sheet: str, output_json_path: str):
    if lgg_sheet not in wb.sheetnames:
        raise ValueError(f"La hoja de LGG '{lgg_sheet}' no existe en el archivo.")
    if est_sheet not in wb.sheetnames:
        raise ValueError(f"La hoja de Estructural '{est_sheet}' no existe en el archivo.")
        
    ws_lgg = wb[lgg_sheet]
    ws_est = wb[est_sheet]

    # Heurística de Cabeceras
    lgg_header, lgg_map = find_header_row_and_mapping(ws_lgg, LGG_PATTERNS)
    for k, v in FALLBACK_LGG_MAP.items():
        if k not in lgg_map:
            lgg_map[k] = v

    est_header, est_map = find_header_row_and_mapping(ws_est, EST_PATTERNS)
    for k, v in FALLBACK_EST_MAP.items():
        if k not in est_map:
            est_map[k] = v

    incidencias = []
    lgg_runs = []
    
    total_lgg_filas = 0
    total_est_filas = 0
    
    # Contadores de error globales
    total_vacios = 0
    total_advertencias = 0
    total_alertas = 0
    total_ok = 0

    resumen_celdas = {}  # taladro -> estadísticas
    filas_por_campana = {}
    filas_por_geotecnico = {}

    # 1. VALIDAR HOJA LGG
    for r in range(lgg_header + 1, ws_lgg.max_row + 1):
        row_dict, is_empty = get_row_dict(ws_lgg, r, lgg_map)
        if is_empty or not row_dict.get("taladro"):
            continue
            
        total_lgg_filas += 1
        taladro = safe_str(row_dict["taladro"])
        corrida_num = safe_int(row_dict["corrida"])
        camp = sanitize_val(row_dict.get("campana"), int)
        geo = sanitize_val(row_dict.get("geologo"), str)
        sector = "N/A"
        
        celda_padre = taladro
        celda_hija = f"{taladro}-C{corrida_num}"

        if camp: filas_por_campana[str(camp)] = filas_por_campana.get(str(camp), 0) + 1
        if geo: filas_por_geotecnico[geo] = filas_por_geotecnico.get(geo, 0) + 1

        if celda_padre not in resumen_celdas:
            resumen_celdas[celda_padre] = {
                "total_hijas": 0, "vacios": 0, "advertencias": 0, "alertas": 0,
                "estado_celda": "OK", "dist_celda": 0.0, "campania": str(camp) if camp else "N/A"
            }

        resumen_celdas[celda_padre]["total_hijas"] += 1
        row_has_errors = False

        def registrar_lgg_error(col, val, tipo, msg):
            nonlocal total_vacios, total_advertencias, total_alertas, row_has_errors
            incidencias.append({
                "fila_excel": r, "celda_padre": celda_padre, "celda_hija": celda_hija,
                "columna": col, "valor_actual": val, "tipo_incidencia": tipo, "mensaje": msg,
                "campania": str(camp) if camp else "N/A", "geotecnico": geo if geo else "N/A", "sector_geotecnico": sector,
                "modulo": "LGG"
            })
            if tipo == "VACIO":
                total_vacios += 1
                resumen_celdas[celda_padre]["vacios"] += 1
            elif tipo == "ADVERTENCIA":
                total_advertencias += 1
                resumen_celdas[celda_padre]["advertencias"] += 1
            elif tipo == "ALERTA":
                total_alertas += 1
                resumen_celdas[celda_padre]["alertas"] += 1
                row_has_errors = True

        # Validar campos vacíos
        mandatory_lgg = ["corrida", "de", "a", "rec_m", "rqd_m", "lito1", "resistencia", "agua_obs", "campana", "geologo"]
        for key in mandatory_lgg:
            v_san = sanitize_val(row_dict.get(key), str)
            if v_san is None:
                registrar_lgg_error(key, None, "VACIO", f"El campo obligatorio '{key}' se encuentra vacío.")

        # Consistencia física LGG
        de = safe_float(sanitize_val(row_dict.get("de"), float))
        a = safe_float(sanitize_val(row_dict.get("a"), float))
        perf = round(a - de, 2)
        rec_m = safe_float(sanitize_val(row_dict.get("rec_m"), float))
        rqd_m = safe_float(sanitize_val(row_dict.get("rqd_m"), float))
        lrf_m = safe_float(sanitize_val(row_dict.get("lrf_m"), float))
        small_frag_m = safe_float(sanitize_val(row_dict.get("small_frag_m"), float))

        resumen_celdas[celda_padre]["dist_celda"] = max(resumen_celdas[celda_padre]["dist_celda"], a)

        if perf <= 0:
            registrar_lgg_error("a", a, "ALERTA", f"Longitud de corrida perforada es no positiva (De: {de}m, A: {a}m, Avance: {perf}m). Debe ser > 0.")
        elif perf > 1.6:
            registrar_lgg_error("a", a, "ALERTA", f"Longitud de corrida perforada excede el límite crítico de 1.6m (De: {de}m, A: {a}m, Avance: {perf}m).")
        
        if rec_m > perf:
            registrar_lgg_error("rec_m", rec_m, "ALERTA", f"La longitud recuperada ({rec_m}m) es mayor que el avance perforado ({perf}m).")
            
        if rqd_m > rec_m:
            registrar_lgg_error("rqd_m", rqd_m, "ALERTA", f"El metraje RQD ({rqd_m}m) es mayor que la longitud recuperada ({rec_m}m).")

        sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
        if sum_frags > perf + 0.05:
            registrar_lgg_error("rqd_m", rqd_m, "ALERTA", f"La suma de fragmentos físicos (RQD: {rqd_m}m + LRF: {lrf_m}m + <10cm: {small_frag_m}m) es {sum_frags}m, superando el avance perforado ({perf}m).")

        # Conteo de fracturas
        frac_nat = safe_int(sanitize_val(row_dict.get("frac_nat"), int))
        b30 = safe_int(sanitize_val(row_dict.get("frac_buz30"), int))
        b60 = safe_int(sanitize_val(row_dict.get("frac_buz60"), int))
        b90 = safe_int(sanitize_val(row_dict.get("frac_buz90"), int))
        if b30 + b60 + b90 != frac_nat:
            registrar_lgg_error("frac_nat", frac_nat, "ADVERTENCIA", f"La sumatoria de fracturas por buzamiento (Buz <30°: {b30} + 30°-60°: {b60} + >60°: {b90}) da {b30+b60+b90}, no coincide con el conteo general ({frac_nat}).")

        # Abertura vs Relleno
        abertura = safe_float(sanitize_val(row_dict.get("abertura"), float))
        espesor = safe_float(sanitize_val(row_dict.get("espesor"), float))
        if espesor > 0 and abertura <= 0:
            registrar_lgg_error("abertura", abertura, "ADVERTENCIA", f"Se declaró espesor de relleno de junta ({espesor}mm) mayor a 0 pero la abertura es {abertura}mm.")
        elif espesor == 0 and abertura > 0:
            registrar_lgg_error("espesor", espesor, "ADVERTENCIA", f"La abertura de junta es {abertura}mm (> 0) pero no se ha registrado espesor de relleno (es 0 o no definido).")

        # Resistencia vs Intemperismo
        resistencia = safe_str(sanitize_val(row_dict.get("resistencia"), str))
        intemperismo = safe_str(sanitize_val(row_dict.get("intemperismo"), str))
        if resistencia in WEATHERING_COMPATIBILITY:
            valid_w = WEATHERING_COMPATIBILITY[resistencia]
            if intemperismo and intemperismo not in valid_w:
                registrar_lgg_error("intemperismo", intemperismo, "ADVERTENCIA", f"Incompatibilidad geológica: Resistencia '{resistencia}' vs Intemperismo '{intemperismo}'. Valores permitidos para resistencia intacta {resistencia}: {', '.join(valid_w)}.")

        # Guardar en memoria para validaciones cruzadas
        lgg_runs.append({
            "taladro": taladro, "de": de, "a": a, "corrida": corrida_num,
            "resistencia": resistencia, "lito1": safe_str(row_dict.get("lito1")),
            "lito2": safe_str(row_dict.get("lito2")), "lito3": safe_str(row_dict.get("lito3"))
        })

        if not row_has_errors:
            total_ok += 1

    # 2. VALIDAR HOJA ESTRUCTURAL
    for r in range(est_header + 1, ws_est.max_row + 1):
        row_dict, is_empty = get_row_dict(ws_est, r, est_map)
        if is_empty or not row_dict.get("taladro"):
            continue

        total_est_filas += 1
        taladro = safe_str(row_dict["taladro"])
        depth = safe_float(sanitize_val(row_dict.get("profundidad"), float))
        camp = sanitize_val(row_dict.get("campana"), int)
        geo = sanitize_val(row_dict.get("geotecnico"), str)
        sector = "N/A"

        celda_padre = taladro
        celda_hija = f"{taladro}-E{r}"

        if camp: filas_por_campana[str(camp)] = filas_por_campana.get(str(camp), 0) + 1
        if geo: filas_por_geotecnico[geo] = filas_por_geotecnico.get(geo, 0) + 1

        if celda_padre not in resumen_celdas:
            resumen_celdas[celda_padre] = {
                "total_hijas": 0, "vacios": 0, "advertencias": 0, "alertas": 0,
                "estado_celda": "OK", "dist_celda": 0.0, "campania": str(camp) if camp else "N/A"
            }

        resumen_celdas[celda_padre]["total_hijas"] += 1
        row_has_errors = False

        def registrar_est_error(col, val, tipo, msg):
            nonlocal total_vacios, total_advertencias, total_alertas, row_has_errors
            incidencias.append({
                "fila_excel": r, "celda_padre": celda_padre, "celda_hija": celda_hija,
                "columna": col, "valor_actual": val, "tipo_incidencia": tipo, "mensaje": msg,
                "campania": str(camp) if camp else "N/A", "geotecnico": geo if geo else "N/A", "sector_geotecnico": sector,
                "modulo": "Estructural"
            })
            if tipo == "VACIO":
                total_vacios += 1
                resumen_celdas[celda_padre]["vacios"] += 1
            elif tipo == "ADVERTENCIA":
                total_advertencias += 1
                resumen_celdas[celda_padre]["advertencias"] += 1
            elif tipo == "ALERTA":
                total_alertas += 1
                resumen_celdas[celda_padre]["alertas"] += 1
                row_has_errors = True

        # Validar campos vacíos
        mandatory_est = ["profundidad", "alfa", "beta", "forma", "rugosidad", "jrc10", "abertura", "weathering", "relleno1", "dureza_pared", "agua", "geotecnico", "campana"]
        for key in mandatory_est:
            v_san = sanitize_val(row_dict.get(key), str)
            if v_san is None:
                registrar_est_error(key, None, "VACIO", f"El campo obligatorio '{key}' se encuentra vacío.")

        # Buscar corrida coincidente (VALIDACIÓN CRUZADA)
        matching_run = None
        for run in lgg_runs:
            if run["taladro"] == taladro and run["de"] <= depth <= run["a"]:
                matching_run = run
                break

        if matching_run is None:
            registrar_est_error("profundidad", depth, "ALERTA", f"Profundidad huérfana ({depth}m) no corresponde a ningún tramo de corrida de LGG para el taladro '{taladro}'.")
        
        # Limites Alfa & Beta
        alfa = safe_float(sanitize_val(row_dict.get("alfa"), float), -1.0)
        if alfa != -1.0 and (alfa < 0.0 or alfa > 90.0):
            registrar_est_error("alfa", alfa, "ALERTA", f"El ángulo Alfa es inválido ({alfa}°). Debe estar entre 0° y 90° o ser -1.")

        beta = safe_float(sanitize_val(row_dict.get("beta"), float), -1.0)
        if beta != -1.0 and (beta < 0.0 or beta > 360.0):
            registrar_est_error("beta", beta, "ALERTA", f"El ángulo Beta es inválido ({beta}°). Debe estar entre 0° y 360° o ser -1.")

        # JRC10
        jrc10 = safe_int(sanitize_val(row_dict.get("jrc10"), int), -1)
        if jrc10 != -1:
            if jrc10 > 20:
                registrar_est_error("jrc10", jrc10, "ALERTA", f"El valor de JRC10 es inválido ({jrc10}). No se permiten valores mayores a 20.")
            elif jrc10 < 0:
                registrar_est_error("jrc10", jrc10, "ADVERTENCIA", f"El valor de JRC10 ({jrc10}) debe estar en el rango de 0 a 20.")

        # Espesor vs Abertura
        abertura = safe_float(sanitize_val(row_dict.get("abertura"), float))
        espesor = safe_float(sanitize_val(row_dict.get("espesor"), float))
        if espesor > abertura:
            registrar_est_error("espesor", espesor, "ADVERTENCIA", f"El espesor de relleno ({espesor}mm) no puede ser mayor que la abertura de junta ({abertura}mm).")

        # Consistencia Relleno
        relleno1 = safe_str(sanitize_val(row_dict.get("relleno1"), str))
        if espesor > 0 and (not relleno1 or relleno1 in ["cwf", "-1"]):
            registrar_est_error("relleno1", relleno1, "ADVERTENCIA", f"Se declaró espesor de relleno ({espesor}mm) pero el tipo de relleno está sin definir (es '{relleno1}').")
        elif relleno1 and relleno1 not in ["cwf", "-1"] and abertura <= 0:
            registrar_est_error("relleno1", relleno1, "ADVERTENCIA", f"El tipo de relleno está definido ('{relleno1}') pero la abertura de junta es {abertura}mm.")

        # Validación cruzada de resistencia (dureza de pared vs matriz)
        if matching_run:
            dureza_pared = safe_str(sanitize_val(row_dict.get("dureza_pared"), str))
            res_matriz = matching_run["resistencia"]
            
            # Map values R0-R6
            r_levels = {"R0":0, "R1":1, "R2":2, "R3":3, "R4":4, "R5":5, "R6":6}
            if dureza_pared in r_levels and res_matriz in r_levels:
                if r_levels[dureza_pared] > r_levels[res_matriz]:
                    registrar_est_error("dureza_pared", dureza_pared, "ADVERTENCIA", f"Incompatibilidad geológica: Dureza de pared de junta ({dureza_pared}) supera la resistencia intacta de la corrida ({res_matriz}) en el tramo ({matching_run['de']}m - {matching_run['a']}m).")

            # Mismatch de litología
            lito_junta = safe_str(sanitize_val(row_dict.get("lito1"), str))
            run_litos = [matching_run["lito1"], matching_run.get("lito2"), matching_run.get("lito3")]
            if lito_junta and lito_junta not in run_litos:
                registrar_est_error("lito1", lito_junta, "ADVERTENCIA", f"Incompatibilidad de litología: Junta tiene '{lito_junta}' pero la corrida ({matching_run['de']}m - {matching_run['a']}m) tiene litologías '{', '.join(filter(None, run_litos))}'.")

        if not row_has_errors:
            total_ok += 1

    # Clasificar celdas
    total_celdas_ok = 0
    for celda, data in resumen_celdas.items():
        if data["alertas"] > 0:
            data["estado_celda"] = "ALERTA"
        elif data["vacios"] > 0 or data["advertencias"] > 0:
            data["estado_celda"] = "ADVERTENCIA"
        else:
            data["estado_celda"] = "OK"
            total_celdas_ok += 1

    total_filas = total_lgg_filas + total_est_filas
    total_campos = total_filas * 15  # promedio de campos evaluados por fila

    output_json = {
        "total_filas_procesadas": total_filas,
        "total_celdas_evaluadas": total_campos,
        "metricas_globales": {
            "total_celdas_padre": len(resumen_celdas),
            "total_celdas_hija_procesadas": total_filas,
            "total_ok": total_ok,
            "total_vacios": total_vacios,
            "total_advertencias": total_advertencias,
            "total_alertas": total_alertas,
            "total_celdas_ok": total_celdas_ok
        },
        "distribucion_filas_campana": filas_por_campana,
        "distribucion_geotecnico": filas_por_geotecnico,
        "incidencias": incidencias,
        "resumen_por_celda_padre": resumen_celdas
    }

    # Guardar en archivo JSON de diagnóstico
    tmp_path = output_json_path + ".tmp"
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(output_json, f, ensure_ascii=False)
    
    os.replace(tmp_path, output_json_path)
