import os
import json
import math
import unicodedata
import re
import openpyxl
from typing import List, Dict, Any
from app.core.rules import WEATHERING_COMPATIBILITY, MASTER_ERROR_RULES

# Normalización robusta para mapeo de cabeceras (remueve acentos, espacios y especiales)
def normalize_text(text: str) -> str:
    if text is None:
        return ""
    # Reemplazar símbolos de comparación por palabras descriptivas antes de limpiar
    s = str(text).lower()
    s = s.replace("≥", "mayorigual").replace("≤", "menorigual")
    s = s.replace(">=", "mayorigual").replace("<=", "menorigual").replace(">", "mayor").replace("<", "menor")
    s = s.replace("∑", "sum").replace("σ", "sum").replace("ς", "sum").replace("Σ", "sum")
    normalized = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8')
    return re.sub(r'[^a-z0-9]', '', normalized).strip()

# Catálogos estándar de validación
VALID_STRUCTURES = {"JN", "F-10", "SZ", "BED", "VN", "CON", "SE", "F+10", "-1"}
VALID_STRENGTHS = {"R0", "R1", "R2", "R3", "R4", "R5", "R6", "-1"}
VALID_RUGOSITY = {str(x) for x in range(1, 10)}.union({"-1"})
VALID_WEATHERING = {"UWF", "SWD", "MWM", "HWA", "CWC", "RS", "-1"}
VALID_RELLENO = {"ca", "sand", "ch", "cl", "gy", "RXF", "FBX", "GOU", "PAT", "SIO", "QZ", "SU", "OX", "ep", "cwf", "-1"}
VALID_AGUA = {"CDC", "DPH", "WTM", "DGE", "FGF"}
VALID_FORMA = {str(x) for x in range(1, 7)}.union({"-1"})

# Mapeos de sinónimos alineaos al frontend (para coincidencia exacta)
LGG_PATTERNS = {
    "corrida": ["corrida", "id", "numcorrida"],
    "taladro": ["taladro", "sondaje", "drillhole", "holeid", "taladroid"],
    "de": ["de", "desde", "dem", "desdem", "from", "depthfrom"],
    "a": ["a", "hasta", "am", "hastam", "to", "depthto"],
    "rec_m": ["longitudrecuperadam", "recuperacionm", "recm", "recupm", "recuperacion", "recuperada", "longitudrecuperada", "longitudrecuperdadam", "longitudrecuperdada"],
    "rqd_m": ["rqdm", "rqd", "rqdmfragmentos10cm", "frag10cmm", "sumfrags10cm", "rqdsumfrags10cmm", "fragmentos10cmm", "frags10cmm", "fragmayorigual10cmm", "sumfrag10cm", "fragsmayor10cmm", "fragmayor10cmm", "rqdsumfragsmayorigual10cmm", "sumfragsmayorigual10cmm"],
    "lrf_m": ["longitudrocafracturadam", "lrfm", "lrf", "longitudrocafracturada", "rocafracturadam", "rocafracturada"],
    "small_frag_m": ["sumfrags10cmquenoentranalrqd", "smallfragm", "smallfrag", "sumfrags10cmquenoentranalrqdm", "frags10cmquenoentranalrqdm", "fragmenor10cmm", "fragmentosmenores10cm", "fragmenores10cm", "sumfragsmenor10cmquenoentranalrqdm"],
    "frac_nat": ["ndefracnaturales", "nfracnatur", "nfracnaturales", "fracnat", "fracturasnaturales", "naturales"],
    "lito1": ["lito1", "lito12023", "litologia1", "litologia12023", "litologia"],
    "lito2": ["lito2", "lito22023", "litologia2", "litologia22023"],
    "lito3": ["lito3", "lito32023", "litologia3", "litologia32023"],
    "resistencia": ["resistencia", "resistestimadaisrm", "resistmaxestimadaisrm", "resistestimada", "resistmax", "resist", "dureza", "isrm", "durezamaterial", "resistmaxestimada"],
    "tipo_est1": ["tipodeestruct", "tipoestructura1", "tipoest1", "estructura1", "tipodeestruct1"],
    "tipo_est2": ["tipodeestruct2", "tipoestructura2", "tipoest2", "estructura2"],
    "frac_buz30": ["nfracnatbuz30", "nfracnaturalbuz30", "buz30", "naturalesbuz30", "nfracnatbuzmenor30", "nfracnaturalbuzmenor30", "buzmenor30"],
    "frac_buz60": ["nfracn30buz60", "nfracnatural30buz60", "buz3060", "buz30a60", "nfracn30menorigualbuzmenor60", "nfracn30menorigualbuz60", "nfracnatural30menorigualbuzmenor60", "nfracn30menorbuzmenor60", "nfracn30menorbuz60"],
    "frac_buz90": ["nfracnatbuz60", "nfracnaturalbuz60", "buz60", "nfracnatbuz90", "nfracnaturalbuz90", "buz90", "nfracnatbuzmayor60", "nfracnaturalbuzmayor60", "buzmayor60"],
    "abertura": ["aberturamm", "abertura", "abert"],
    "rugosidad": ["rugosidadisrm", "rugosidad", "rugos"],
    "jrc10": ["jrc10", "jrc", "jrc10rugosidad"],
    "intemperismo": ["gradointempisrm", "gradointemp", "intemperismo", "alteracion", "weathering"],
    "relleno1": ["tipoderelleno1", "relleno1", "tiporelleno1"],
    "relleno2": ["tipoderelleno2", "relleno2", "tiporelleno2"],
    "espesor": ["espesorrellenomm", "espesorrelleno", "espesor", "espesormm"],
    "agua_obs": ["presenciadeaguaisrm", "presenaguaisrm", "presenciaagua", "aguaobs", "agua"],
    "geologo": ["geotecnico", "geotécnico", "geologo", "geotecnic", "geot"],
    "comentarios": ["comentarios", "comentario", "observaciones", "observacion", "comments"],
    "campana": ["campana", "anio", "campan", "campaign", "year"],
    "frf": ["frf", "fracturaspormetro", "fracturasmetro"]
}

EST_PATTERNS = {
    "taladro": ["taladro", "sondaje", "drillhole", "holeid", "taladroid"],
    "de": ["de", "desde", "dem", "desdem", "from", "depthfrom"],
    "a": ["a", "hasta", "am", "hastam", "to", "depthto"],
    "profundidad": ["profundidad", "prof", "depth", "profundidadm"],
    "lito1": ["lito1", "lito12023", "litologia1", "litologia12023", "litologia"],
    "lito2": ["lito2", "lito22023", "litologia2", "litologia22023"],
    "lito3": ["lito3", "lito32023", "litologia3", "litologia32023"],
    "tipo_estructura": ["tipodeestructura", "estructura", "tipoest", "tipodeestructu"],
    "alfa": ["alpha", "alfa"],
    "beta": ["beta"],
    "dip": ["dip"],
    "azimuth": ["azimuth", "azimut"],
    "forma": ["forma"],
    "rugosidad": ["rugosidadisrm", "rugosidad", "rugos"],
    "jrc10": ["jrc10", "jrc", "jrc10rugosidad"],
    "abertura": ["aberturamm", "abertura", "abert"],
    "weathering": ["gradointempisrm", "gradointemp", "intemperismo", "alteracion", "weathering", "gradointemperismo"],
    "espesor": ["espesorrellenomm", "espesorrelleno", "espesor", "espesormm"],
    "relleno1": ["tipoderelleno1", "relleno1", "tiporelleno1"],
    "relleno2": ["tipoderelleno2", "relleno2", "tiporelleno2"],
    "dureza_pared": ["durezadepared", "dureza", "durezapared", "durezaestructural", "durezadelapareddeestructura", "durezadelapareddeestructu"],
    "agua": ["presenciadeaguaisrm", "presenaguaisrm", "presenciaagua", "aguaobs", "agua"],
    "geotecnico": ["geotecnico", "geotécnico", "geologo", "geotecnic", "geot"],
    "comentario": ["comentarios", "comentario", "observaciones", "observacion", "comments", "intervalocomentario"],
    "campana": ["campana", "anio", "campan", "campaign", "year"]
}

# Fallbacks basados en excels_logueo.md
FALLBACK_LGG_MAP = {
    "corrida": 1, "taladro": 2, "de": 3, "a": 4, "rec_m": 5, "rqd_m": 6, "lrf_m": 7, "small_frag_m": 8,
    "frac_nat": 9, "lito1": 10, "lito2": 11, "lito3": 12, "resistencia": 13, "tipo_est1": 14, "tipo_est2": 15,
    "frac_buz30": 16, "frac_buz60": 17, "frac_buz90": 18, "abertura": 19, "rugosidad": 20, "jrc10": 21,
    "intemperismo": 22, "relleno1": 23, "relleno2": 24, "espesor": 25, "agua_obs": 26, "geologo": 27,
    "comentarios": 28, "campana": 29, "frf": 30
}

FALLBACK_EST_MAP = {
    "taladro": 2, "de": 3, "a": 4, "profundidad": 5, "lito1": 6, "lito2": 7, "lito3": 8, "tipo_estructura": 9,
    "alfa": 10, "beta": 11, "dip": 12, "azimuth": 13, "forma": 14, "rugosidad": 15, "jrc10": 16, "abertura": 17,
    "weathering": 18, "espesor": 19, "relleno1": 20, "relleno2": 21, "dureza_pared": 22, "agua": 23,
    "geotecnico": 24, "comentario": 25, "campana": 26
}

def find_header_row_and_mapping(sheet, keyword_maps) -> tuple:
    """Busca de forma exacta cabeceras normalizadas para evitar falsos positivos."""
    best_row = 6  # fallback fila estándar
    best_matches = 0
    best_mapping = {}

    # Pre-normalizar los mapas de búsqueda
    cleaned_maps = {}
    for key, patterns in keyword_maps.items():
        cleaned_maps[key] = [normalize_text(p) for p in patterns if p]

    for r in range(1, 21):
        matches = 0
        mapping = {}
        for c in range(1, sheet.max_column + 1):
            val = sheet.cell(row=r, column=c).value
            if val is None:
                continue
            norm_val = normalize_text(str(val))
            if not norm_val:
                continue
            
            for key, patterns in cleaned_maps.items():
                if key in mapping:
                    continue
                # Comparar coincidencia exacta de cabecera normalizada
                if norm_val in patterns:
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

def get_canonical_value(val, valid_set):
    if val is None:
        return None
    s = str(val).strip()
    s_lower = s.lower()
    for code in valid_set:
        if code.lower() == s_lower:
            return code
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
        tipo_est1 = data.get("tipo_est1", "JN")
        tipo_est2 = data.get("tipo_est2", "")

        if perf <= 0:
            alerts.append({"type": "CRITICAL", "field": "a", "message": f"Profundidad final ({a}m) debe ser mayor a la inicial ({de}m)."})
        elif perf > 1.6:
            alerts.append({"type": "CRITICAL", "field": "a", "message": f"La longitud de corrida ({perf}m) excede el límite máximo de perforación de 1.6m."})
        
        if rec_m > perf:
            alerts.append({"type": "CRITICAL", "field": "rec_m", "message": f"Longitud recuperada ({rec_m}m) es físicamente mayor que la perforada ({perf}m)."})
        
        if rqd_m > rec_m:
            alerts.append({"type": "CRITICAL", "field": "rqd_m", "message": f"El metraje de RQD ({rqd_m}m) no puede ser mayor que la longitud recuperada ({rec_m}m)."})
        
        if lrf_m > rec_m:
            alerts.append({"type": "CRITICAL", "field": "lrf_m", "message": f"La longitud de roca fracturada LRF ({lrf_m}m) no puede ser mayor que la longitud recuperada ({rec_m}m)."})
            
        sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
        if sum_frags > perf:
            alerts.append({"type": "CRITICAL", "field": "rqd_m", "message": f"La suma de fragmentos físicos ({sum_frags}m) supera el avance total de la corrida ({perf}m)."})
            
        sum_bins = buz30 + buz60 + buz90
        if sum_bins != frac_nat:
            alerts.append({"type": "WARNING", "field": "frac_nat", "message": f"La suma de fracturas naturales clasificadas por buzamiento ({sum_bins}) no coincide con el conteo general ({frac_nat})."})
            
        # Espesor vs Abertura con excepciones F, RF, VN, SZ, F+10, BED
        exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}
        if thickness > aperture and (tipo_est1 not in exceptions and tipo_est2 not in exceptions):
            alerts.append({"type": "CRITICAL", "field": "espesor", "message": f"El espesor de relleno ({thickness}mm) no puede ser mayor que la abertura de junta ({aperture}mm) excepto en estructuras F, RF, VN, SZ, F+10 o BED."})

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

def validate_logueo_bulk_sheets(file_path: str, lgg_sheet: str, est_sheet: str, output_json_path: str):
    """
    Lee las hojas seleccionadas de LGG y Estructural, y realiza
    las validaciones cruzadas basándose en las reglas de Reglas_Tablas.md.
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
    # FORZAR FALLBACK SI FALTAN COLUMNAS CRÍTICAS
    for k, v in FALLBACK_LGG_MAP.items():
        if k not in lgg_map:
            lgg_map[k] = v

    est_header, est_map = find_header_row_and_mapping(ws_est, EST_PATTERNS)
    # FORZAR FALLBACK SI FALTAN COLUMNAS CRÍTICAS
    for k, v in FALLBACK_EST_MAP.items():
        if k not in est_map:
            est_map[k] = v

    incidencias = []
    lgg_runs = []
    
    total_lgg_filas = 0
    total_est_filas = 0
    
    total_vacios = 0
    total_advertencias = 0
    total_alertas = 0
    total_ok = 0

    resumen_celdas = {}  # taladro -> estadísticas
    filas_por_campana = {}
    filas_por_geotecnico = {}
    
    # Seguimiento de continuidad espacial de corridas por taladro
    last_a_by_taladro = {}

    # 1. VALIDAR HOJA LGG
    print(f"[*] Iniciando escaneo de LGG. Fila inicial: {lgg_header + 1}, Fila máxima detectada: {ws_lgg.max_row}", flush=True)
    empty_streak_lgg = 0
    
    for r in range(lgg_header + 1, ws_lgg.max_row + 1):
        if r % 50 == 0:
            print(f"  ... [LGG] Procesando fila {r} / {ws_lgg.max_row}", flush=True)
            
        row_dict, is_empty = get_row_dict(ws_lgg, r, lgg_map)
        taladro_val = row_dict.get("taladro")
        
        # Freno de emergencia para "filas fantasma"
        if is_empty or not taladro_val:
            empty_streak_lgg += 1
            if empty_streak_lgg >= 20:
                print(f"[*] [LGG] Se detectaron 20 filas vacías consecutivas. Terminando lectura de LGG en la fila {r}.", flush=True)
                break
            continue
            
        empty_streak_lgg = 0
        total_lgg_filas += 1
        
        taladro = safe_str(taladro_val)
        corrida_num = safe_int(row_dict.get("corrida", 0))
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

        # Validar campos obligatorios (excluyendo tipo_est2, relleno2 y comentarios)
        mandatory_lgg = [
            "corrida", "de", "a", "rec_m", "rqd_m", "lrf_m", "small_frag_m", "frac_nat", "lito1", 
            "resistencia", "tipo_est1", "frac_buz30", "frac_buz60", "frac_buz90", 
            "abertura", "rugosidad", "jrc10", "intemperismo", "relleno1", "espesor", 
            "agua_obs", "campana", "geologo"
        ]
        for key in mandatory_lgg:
            v_san = sanitize_val(row_dict.get(key), str)
            if v_san is None:
                registrar_lgg_error(key, None, "VACIO", f"El campo obligatorio '{key}' se encuentra vacío o es -1.")

        # Consistencia física LGG
        de = safe_float(sanitize_val(row_dict.get("de"), float))
        a = safe_float(sanitize_val(row_dict.get("a"), float))
        perf = round(a - de, 2)
        
        rec_m = safe_float(sanitize_val(row_dict.get("rec_m"), float))
        rqd_m = safe_float(sanitize_val(row_dict.get("rqd_m"), float))
        lrf_m = safe_float(sanitize_val(row_dict.get("lrf_m"), float))
        small_frag_m = safe_float(sanitize_val(row_dict.get("small_frag_m"), float))

        # Validaciones de valores negativos (Reglas_Tablas.md)
        raw_de = row_dict.get("de")
        if de is not None and de < 0:
            registrar_lgg_error("de", raw_de, "ALERTA", f"El valor de 'de:' ({de}m) no puede ser negativo.")
        raw_a = row_dict.get("a")
        if a is not None and a < 0:
            registrar_lgg_error("a", raw_a, "ALERTA", f"El valor de 'a:' ({a}m) no puede ser negativo.")
        raw_rec = row_dict.get("rec_m")
        if rec_m is not None and rec_m < 0:
            registrar_lgg_error("rec_m", raw_rec, "ALERTA", f"La longitud recuperada ({rec_m}m) no puede ser negativa.")
        raw_rqd = row_dict.get("rqd_m")
        if rqd_m is not None and rqd_m < 0:
            registrar_lgg_error("rqd_m", raw_rqd, "ALERTA", f"El metraje RQD ({rqd_m}m) no puede ser negativo.")
        raw_lrf = row_dict.get("lrf_m")
        if lrf_m is not None and lrf_m < 0:
            registrar_lgg_error("lrf_m", raw_lrf, "ALERTA", f"La longitud de roca fracturada LRF ({lrf_m}m) no puede ser negativa.")
        raw_small = row_dict.get("small_frag_m")
        if small_frag_m is not None and small_frag_m < 0:
            registrar_lgg_error("small_frag_m", raw_small, "ALERTA", f"El metraje de fragmentos <10cm ({small_frag_m}m) no puede ser negativo.")

        frac_nat = safe_int(sanitize_val(row_dict.get("frac_nat"), int))
        b30 = safe_int(sanitize_val(row_dict.get("frac_buz30"), int))
        b60 = safe_int(sanitize_val(row_dict.get("frac_buz60"), int))
        b90 = safe_int(sanitize_val(row_dict.get("frac_buz90"), int))

        raw_frac_nat = row_dict.get("frac_nat")
        if frac_nat is not None and frac_nat < 0:
            registrar_lgg_error("frac_nat", raw_frac_nat, "ALERTA", f"El número de fracturas naturales ({frac_nat}) no puede ser negativo.")
        raw_b30 = row_dict.get("frac_buz30")
        if b30 is not None and b30 < 0:
            registrar_lgg_error("frac_buz30", raw_b30, "ALERTA", f"El número de fracturas en Buz<30° ({b30}) no puede ser negativo.")
        raw_b60 = row_dict.get("frac_buz60")
        if b60 is not None and b60 < 0:
            registrar_lgg_error("frac_buz60", raw_b60, "ALERTA", f"El número de fracturas en 30°-60° ({b60}) no puede ser negativo.")
        raw_b90 = row_dict.get("frac_buz90")
        if b90 is not None and b90 < 0:
            registrar_lgg_error("frac_buz90", raw_b90, "ALERTA", f"El número de fracturas en Buz>60° ({b90}) no puede ser negativo.")

        abertura = safe_float(sanitize_val(row_dict.get("abertura"), float))
        espesor = safe_float(sanitize_val(row_dict.get("espesor"), float))

        raw_abertura = row_dict.get("abertura")
        if abertura is not None and abertura < 0:
            registrar_lgg_error("abertura", raw_abertura, "ALERTA", f"La abertura de junta ({abertura}mm) no puede ser negativa.")
        raw_espesor = row_dict.get("espesor")
        if espesor is not None and espesor < 0:
            registrar_lgg_error("espesor", raw_espesor, "ALERTA", f"El espesor de relleno ({espesor}mm) no puede ser negativo.")
        raw_camp = row_dict.get("campana")
        if camp is not None and camp < 0:
            registrar_lgg_error("campana", raw_camp, "ALERTA", f"El año de campaña ({camp}) no puede ser negativo.")

        # Validaciones de enteros
        for key, val_raw in [("frac_nat", raw_frac_nat), ("frac_buz30", raw_b30), ("frac_buz60", raw_b60), ("frac_buz90", raw_b90)]:
            if val_raw is not None and val_raw != -1:
                try:
                    f_val = float(val_raw)
                    if not f_val.is_integer():
                        registrar_lgg_error(key, val_raw, "ALERTA", f"El campo '{key}' ({val_raw}) debe ser un número entero.")
                except ValueError:
                    pass

        # Validación FRF
        if "frf" in lgg_map:
            frf_raw = row_dict.get("frf")
            frf_val = sanitize_val(frf_raw, int)
            if frf_val is not None and frf_val != -1:
                if frf_val < 0:
                    registrar_lgg_error("frf", frf_raw, "ALERTA", f"El valor de FRF ({frf_val}) no puede ser negativo.")
                try:
                    f_frf = float(frf_raw)
                    if not f_frf.is_integer():
                        registrar_lgg_error("frf", frf_raw, "ALERTA", f"El valor de FRF ({frf_raw}) debe ser un número entero.")
                except ValueError:
                    pass
                calc_frf = math.floor(round(lrf_m * 100) / 5) + 1 if lrf_m > 0 else 0
                if frf_val != calc_frf:
                    registrar_lgg_error("frf", frf_raw, "ALERTA", f"El valor de FRF ({frf_val}) no coincide con el calculado por la fórmula ({calc_frf}) basado en LRF ({lrf_m}m).")

        # Actualizar máxima profundidad final (metros logueados) para el taladro
        resumen_celdas[celda_padre]["dist_celda"] = max(resumen_celdas[celda_padre]["dist_celda"], a)

        # Regla: Continuidad Espacial de Corridas
        if celda_padre in last_a_by_taladro:
            prev_a = last_a_by_taladro[celda_padre]
            if abs(de - prev_a) > 0.001:
                registrar_lgg_error("de", de, "ALERTA", f"Ruptura de continuidad espacial detectada: el valor de 'de:' ({de}m) difiere de la profundidad final anterior ({prev_a}m).")
        last_a_by_taladro[celda_padre] = a

        if perf <= 0:
            registrar_lgg_error("a", a, "ALERTA", f"Longitud de corrida perforada es no positiva (De: {de}m, A: {a}m, Avance: {perf}m). Debe ser > 0.")
        elif perf > 1.6:
            registrar_lgg_error("a", a, "ALERTA", f"Longitud de corrida perforada excede el límite crítico de 1.6m (De: {de}m, A: {a}m, Avance: {perf}m).")
        
        if rec_m > perf:
            registrar_lgg_error("rec_m", rec_m, "ALERTA", f"La longitud recuperada ({rec_m}m) es mayor que el avance perforado ({perf}m) en tramo ({de}m - {a}m).")
            
        if rqd_m > rec_m:
            registrar_lgg_error("rqd_m", rqd_m, "ALERTA", f"El metraje RQD ({rqd_m}m) es mayor que la longitud recuperada ({rec_m}m) (Avance: {perf}m).")

        if lrf_m > rec_m:
            registrar_lgg_error("lrf_m", lrf_m, "ALERTA", f"La longitud de roca fracturada LRF ({lrf_m}m) es mayor que la longitud recuperada ({rec_m}m) (Avance: {perf}m).")

        sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
        if sum_frags > perf:
            registrar_lgg_error("rqd_m", rqd_m, "ALERTA", f"La suma de fragmentos físicos (RQD: {rqd_m}m + LRF: {lrf_m}m + <10cm: {small_frag_m}m) es {sum_frags}m, superando el avance perforado ({perf}m) (Recuperada: {rec_m}m).")

        if b30 + b60 + b90 != frac_nat:
            registrar_lgg_error("frac_nat", frac_nat, "ADVERTENCIA", f"La sumatoria de fracturas por buzamiento (Buz <30°: {b30} + 30°-60°: {b60} + >60°: {b90}) da {b30+b60+b90}, no coincide con el conteo general ({frac_nat}).")

        tipo_est1 = safe_str(sanitize_val(row_dict.get("tipo_est1"), str))
        tipo_est2 = safe_str(sanitize_val(row_dict.get("tipo_est2"), str))
        
        # Validaciones de catálogos permitidos ANTES de utilizarlas en la lógica relacional
        raw_resistencia = row_dict.get("resistencia")
        resistencia_can = get_canonical_value(raw_resistencia, VALID_STRENGTHS)
        if raw_resistencia is not None and not resistencia_can:
            registrar_lgg_error("resistencia", raw_resistencia, "ALERTA", f"Código de Resistencia ISRM no válido. Permitidos: {', '.join(VALID_STRENGTHS)}")
            resistencia = "R4"
        else:
            resistencia = resistencia_can or "R4"

        raw_intemperismo = row_dict.get("intemperismo")
        intemperismo_can = get_canonical_value(raw_intemperismo, VALID_WEATHERING)
        if raw_intemperismo is not None and not intemperismo_can:
            registrar_lgg_error("intemperismo", raw_intemperismo, "ALERTA", f"Código de Meteorización no válido. Permitidos: {', '.join(VALID_WEATHERING)}")
            weathering = "UWF"
        else:
            weathering = intemperismo_can or "UWF"

        raw_relleno1 = row_dict.get("relleno1")
        relleno1_can = get_canonical_value(raw_relleno1, VALID_RELLENO)
        if raw_relleno1 is not None and not relleno1_can:
            registrar_lgg_error("relleno1", raw_relleno1, "ALERTA", f"Código de Tipo de Relleno no válido. Permitidos: {', '.join(VALID_RELLENO)}")
            relleno1 = "cwf"
        else:
            relleno1 = relleno1_can or "cwf"

        raw_agua_obs = row_dict.get("agua_obs")
        agua_obs_can = get_canonical_value(raw_agua_obs, VALID_AGUA)
        if raw_agua_obs is not None and not agua_obs_can:
            registrar_lgg_error("agua_obs", raw_agua_obs, "ALERTA", f"Código de Presencia de Agua no válido. Permitidos: {', '.join(VALID_AGUA)}")

        jrc10 = safe_int(sanitize_val(row_dict.get("jrc10"), int), -1)
        if jrc10 != -1 and (jrc10 < 0 or jrc10 > 20):
            registrar_lgg_error("jrc10", jrc10, "ALERTA", "El valor de JRC10 es inválido. No se permiten valores mayores a 20.")
            
        raw_rugosidad = row_dict.get("rugosidad")
        rugosidad_can = get_canonical_value(raw_rugosidad, VALID_RUGOSITY)
        if raw_rugosidad is not None and not rugosidad_can:
            registrar_lgg_error("rugosidad", raw_rugosidad, "ALERTA", f"Código de Rugosidad no válido. Permitidos: {', '.join(VALID_RUGOSITY)}")

        tipo_est1_can = get_canonical_value(tipo_est1, VALID_STRUCTURES)
        if tipo_est1 and not tipo_est1_can:
            if tipo_est1.upper() == "J":
                tipo_est1 = "JN"
                registrar_lgg_error("tipo_est1", "J", "ADVERTENCIA", "Código de estructura 'J' reconocido como 'JN' (Junta).")
            else:
                registrar_lgg_error("tipo_est1", tipo_est1, "ALERTA", f"Código de estructura 1 no válido. Permitidos: {', '.join(VALID_STRUCTURES)}")
                tipo_est1 = "JN"
        else:
            tipo_est1 = tipo_est1_can or "JN"

        tipo_est2_can = get_canonical_value(tipo_est2, VALID_STRUCTURES)
        if tipo_est2 and not tipo_est2_can:
            registrar_lgg_error("tipo_est2", tipo_est2, "ALERTA", f"Código de estructura 2 no válido. Permitidos: {', '.join(VALID_STRUCTURES)}")
            tipo_est2 = ""
        else:
            tipo_est2 = tipo_est2_can or ""

        # Abertura vs Espesor con excepciones F, RF, VN, SZ, F+10, BED
        exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}
        if espesor > abertura and (tipo_est1 not in exceptions and tipo_est2 not in exceptions):
            registrar_lgg_error("espesor", espesor, "ALERTA", f"El espesor de relleno ({espesor}mm) y tipo ('{relleno1}') con estructura ('{tipo_est1}' / '{tipo_est2}') supera a la abertura ({abertura}mm) sin pertenecer a estructuras exceptuadas (F, RF, VN, SZ, F+10, BED).")

        if espesor > 0 and abertura <= 0:
            registrar_lgg_error("abertura", abertura, "ADVERTENCIA", f"Se declaró espesor de relleno de junta ({espesor}mm) y tipo ('{relleno1}') mayor a 0 pero la abertura es {abertura}mm.")
        elif espesor == 0 and abertura > 0:
            registrar_lgg_error("espesor", espesor, "ADVERTENCIA", f"La abertura de junta es {abertura}mm (> 0) pero el espesor de relleno es {espesor}mm (tipo de relleno: '{relleno1}').")

        # Resistencia vs Intemperismo
        if resistencia in WEATHERING_COMPATIBILITY:
            valid_w = WEATHERING_COMPATIBILITY[resistencia]
            if weathering and weathering not in valid_w:
                registrar_lgg_error("intemperismo", weathering, "ADVERTENCIA", "Incompatibilidad geológica (Resistencia vs Intemperismo de corrida).")

        # Guardar en memoria para validaciones cruzadas
        lgg_runs.append({
            "taladro": taladro, "de": de, "a": a, "corrida": corrida_num,
            "resistencia": resistencia, "lito1": safe_str(row_dict.get("lito1")),
            "lito2": safe_str(row_dict.get("lito2")), "lito3": safe_str(row_dict.get("lito3"))
        })

        if not row_has_errors:
            total_ok += 1

    # 2. VALIDAR HOJA ESTRUCTURAL
    print(f"[*] Iniciando escaneo de Estructural. Fila inicial: {est_header + 1}, Fila máxima detectada: {ws_est.max_row}", flush=True)
    empty_streak_est = 0
    
    for r in range(est_header + 1, ws_est.max_row + 1):
        if r % 50 == 0:
            print(f"  ... [EST] Procesando fila {r} / {ws_est.max_row}", flush=True)
            
        row_dict, is_empty = get_row_dict(ws_est, r, est_map)
        taladro_val = row_dict.get("taladro")
        
        if is_empty or not taladro_val:
            empty_streak_est += 1
            if empty_streak_est >= 20:
                print(f"[*] [EST] Se detectaron 20 filas vacías consecutivas. Terminando lectura de Estructural en la fila {r}.", flush=True)
                break
            continue

        empty_streak_est = 0
        total_est_filas += 1
        
        taladro = safe_str(taladro_val)
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

        # Validar campos vacíos (relleno2 y comentarios son opcionales)
        mandatory_est = [
            "profundidad", "alfa", "beta", "forma", "rugosidad", "jrc10", "abertura", 
            "weathering", "espesor", "relleno1", "dureza_pared", "agua", "geotecnico", "campana"
        ]
        for key in mandatory_est:
            v_san = sanitize_val(row_dict.get(key), str)
            if v_san is None:
                registrar_est_error(key, None, "VACIO", f"El campo obligatorio '{key}' se encuentra vacío o es -1.")

        # Limites y consistencia física Estructural
        abertura = safe_float(sanitize_val(row_dict.get("abertura"), float))
        espesor = safe_float(sanitize_val(row_dict.get("espesor"), float))

        # Validar valores negativos (Reglas_Tablas.md)
        raw_depth = row_dict.get("profundidad")
        if depth is not None and depth < 0:
            registrar_est_error("profundidad", raw_depth, "ALERTA", f"Profundidad ({depth}m) no puede ser negativa.")
        raw_abertura = row_dict.get("abertura")
        if abertura is not None and abertura < 0:
            registrar_est_error("abertura", raw_abertura, "ALERTA", f"La abertura ({abertura}mm) no puede ser negativa.")
        raw_espesor = row_dict.get("espesor")
        if espesor is not None and espesor < 0:
            registrar_est_error("espesor", raw_espesor, "ALERTA", f"El espesor de relleno ({espesor}mm) no puede ser negativo.")
        raw_camp = row_dict.get("campana")
        if camp is not None and camp < 0:
            registrar_est_error("campana", raw_camp, "ALERTA", f"El año de campaña ({camp}) no puede ser negativo.")

        # Dip & Azimuth validations (Reglas_Tablas.md)
        dip = safe_float(sanitize_val(row_dict.get("dip"), float))
        raw_dip = row_dict.get("dip")
        if dip is not None:
            if dip < 0.0 or dip > 90.0:
                registrar_est_error("dip", raw_dip, "ALERTA", f"El ángulo Dip es inválido ({dip}°). Debe estar entre 0° y 90°.")

        azimuth = safe_float(sanitize_val(row_dict.get("azimuth"), float))
        raw_azimuth = row_dict.get("azimuth")
        if azimuth is not None:
            if azimuth < 0.0 or azimuth > 360.0:
                registrar_est_error("azimuth", raw_azimuth, "ALERTA", f"El ángulo Azimut es inválido ({azimuth}°). Debe estar entre 0° y 360°.")

        # Buscar corrida coincidente (VALIDACIÓN CRUZADA)
        matching_run = None
        for run in lgg_runs:
            if run["taladro"] == taladro and run["de"] <= depth <= run["a"]:
                matching_run = run
                break

        if matching_run is None:
            registrar_est_error("profundidad", depth, "ALERTA", f"Profundidad huérfana ({depth}m) no corresponde a ningún tramo de corrida de LGG para el taladro '{taladro}'.")

        # de: y a: exact pair matching
        est_de = safe_float(sanitize_val(row_dict.get("de"), float))
        est_a = safe_float(sanitize_val(row_dict.get("a"), float))
        raw_de = row_dict.get("de")
        raw_a = row_dict.get("a")
        if est_de is not None and est_a is not None:
            has_exact_match = False
            for run in lgg_runs:
                if run["taladro"] == taladro and abs(run["de"] - est_de) < 0.001 and abs(run["a"] - est_a) < 0.001:
                    has_exact_match = True
                    break
            if not has_exact_match:
                registrar_est_error("de", raw_de, "ALERTA", f"El par de corrida de: {est_de}m y a: {est_a}m no existe de forma exacta en las corridas de LGG para el taladro '{taladro}'.")
            if depth is not None and (depth < est_de or depth > est_a):
                registrar_est_error("profundidad", depth, "ALERTA", f"La profundidad ({depth}m) se encuentra fuera del tramo de corrida especificado (de: {est_de}m, a: {est_a}m).")

        # Limites Alfa & Beta
        alfa = safe_float(sanitize_val(row_dict.get("alfa"), float), -1.0)
        if alfa != -1.0:
            if alfa < 0.0 or alfa > 90.0:
                registrar_est_error("alfa", alfa, "ALERTA", f"El ángulo Alfa es inválido ({alfa}°). Debe estar entre 0° y 90°.")
            elif not float(alfa).is_integer():
                registrar_est_error("alfa", alfa, "ADVERTENCIA", f"El ángulo Alfa ({alfa}°) debería ser un número entero.")

        beta = safe_float(sanitize_val(row_dict.get("beta"), float), -1.0)
        if beta != -1.0:
            if beta < 0.0 or beta > 360.0:
                registrar_est_error("beta", beta, "ALERTA", f"El ángulo Beta es inválido ({beta}°). Debe estar entre 0° y 360°.")
            elif not float(beta).is_integer():
                registrar_est_error("beta", beta, "ADVERTENCIA", f"El ángulo Beta ({beta}°) debería ser un número entero.")

        # JRC10
        jrc10 = safe_int(sanitize_val(row_dict.get("jrc10"), int), -1)
        if jrc10 != -1:
            if jrc10 > 20:
                registrar_est_error("jrc10", jrc10, "ALERTA", "El valor de JRC10 es inválido. No se permiten valores mayores a 20.")
            elif jrc10 < 0:
                registrar_est_error("jrc10", jrc10, "ALERTA", "El valor de JRC10 no puede ser negativo.")

        # Forma de juntas
        raw_forma = row_dict.get("forma")
        forma_can = get_canonical_value(raw_forma, VALID_FORMA)
        if raw_forma is not None and not forma_can:
            registrar_est_error("forma", raw_forma, "ALERTA", "Forma de junta no válida. Permitidos: Plano (1) a Irregular (6).")
        else:
            forma = forma_can or "Plano"

        # Consistencia Relleno ANTES de verificar contra espesor/abertura
        raw_relleno1 = row_dict.get("relleno1")
        relleno1_can = get_canonical_value(raw_relleno1, VALID_RELLENO)
        if raw_relleno1 is not None and not relleno1_can:
            registrar_est_error("relleno1", raw_relleno1, "ALERTA", f"Código de Tipo de Relleno no válido. Permitidos: {', '.join(VALID_RELLENO)}")
            relleno1 = "cwf"
        else:
            relleno1 = relleno1_can or "cwf"

        # Espesor vs Abertura con excepciones F, RF, VN, SZ, F+10, BED
        tipo_est = safe_str(sanitize_val(row_dict.get("tipo_estructura"), str))
        exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}
        if espesor > abertura and tipo_est not in exceptions:
            registrar_est_error("espesor", espesor, "ALERTA", f"El espesor de relleno ({espesor}mm) y tipo ('{relleno1}') con estructura ('{tipo_est}') supera a la abertura de junta ({abertura}mm) sin pertenecer a estructuras exceptuadas (F, RF, VN, SZ, F+10, BED).")

        if espesor > 0 and (not relleno1 or relleno1 in ["cwf", "-1"]):
            registrar_est_error("relleno1", relleno1, "ADVERTENCIA", f"Se declaró espesor de relleno ({espesor}mm) pero el tipo de relleno ('{relleno1}') está sin definir / limpio.")
        elif relleno1 and relleno1 not in ["cwf", "-1"] and abertura <= 0:
            registrar_est_error("relleno1", relleno1, "ADVERTENCIA", f"El tipo de relleno está definido ('{relleno1}') pero la abertura de junta es {abertura}mm y espesor es {espesor}mm.")

        # Validación cruzada de resistencia (dureza de pared vs matriz)
        if matching_run:
            raw_dureza = row_dict.get("dureza_pared")
            dureza_can = get_canonical_value(raw_dureza, VALID_STRENGTHS)
            if raw_dureza is not None and not dureza_can:
                registrar_est_error("dureza_pared", raw_dureza, "ALERTA", f"Código de Resistencia ISRM no válido. Permitidos: {', '.join(VALID_STRENGTHS)}")
                dureza_pared = "R4"
            else:
                dureza_pared = dureza_can or "R4"

            res_matriz = matching_run["resistencia"]
            r_levels = {"R0":0, "R1":1, "R2":2, "R3":3, "R4":4, "R5":5, "R6":6}
            if dureza_pared in r_levels and res_matriz in r_levels:
                if r_levels[dureza_pared] > r_levels[res_matriz]:
                    registrar_est_error("dureza_pared", raw_dureza, "ADVERTENCIA", "Incompatibilidad geológica (Dureza de pared de junta supera la resistencia intacta de la corrida).")

            # Mismatch de litología
            lito_junta = safe_str(sanitize_val(row_dict.get("lito1"), str))
            run_litos = [matching_run["lito1"], matching_run.get("lito2"), matching_run.get("lito3")]
            if lito_junta and lito_junta not in run_litos:
                registrar_est_error("lito1", lito_junta, "ADVERTENCIA", "Incompatibilidad de litología entre la corrida y la junta.")

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
    total_campos = total_filas * 20  # alineado

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