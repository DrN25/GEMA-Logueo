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
    s = str(text).lower()
    s = s.replace("≥", "mayorigual").replace("≤", "menorigual")
    s = s.replace(">=", "mayorigual").replace("<=", "menorigual").replace(">", "mayor").replace("<", "menor")
    s = s.replace("∑", "sum").replace("σ", "sum").replace("ς", "sum").replace("Σ", "sum")
    normalized = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8')
    return re.sub(r'[^a-z0-9]', '', normalized).strip()

# Catálogos estándar de validación
VALID_STRUCTURES = {"JN", "F", "RF", "F-10", "SZ", "BED", "VN", "CON", "SE", "F+10", "-1"}
VALID_STRENGTHS = {"R0", "R1", "R2", "R3", "R4", "R5", "R6", "-1"}
VALID_RUGOSITY = {str(x) for x in range(1, 10)}.union({"-1"})
VALID_WEATHERING = {"UWF", "SWD", "MWM", "HWA", "CWC", "RS", "-1"}
VALID_RELLENO = {"ca", "sand", "ch", "cl", "gy", "RXF", "FBX", "GOU", "PAT", "SIO", "QZ", "SU", "OX", "ep", "cwf", "-1"}
VALID_AGUA = {"CDC", "DPH", "WTM", "DGE", "FGF"}
VALID_FORMA = {str(x) for x in range(1, 7)}.union({"-1"})

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

COLLAR_PATTERNS = {
    "taladro": ["taladro", "sondaje", "drillhole", "holeid", "taladroid", "hole_id", "hole"],
    "eoh": ["eoh", "profundidad_final", "prof_final", "max_depth", "total_depth"]
}

SURVEY_PATTERNS = {
    "taladro": ["taladro", "sondaje", "drillhole", "holeid", "taladroid", "hole_id", "hole"],
    "depth": ["profundidad", "depth", "depthm", "profundidadm", "prof"]
}

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
    best_row = 6
    best_matches = 0
    best_mapping = {}

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

def validate_logueo_bulk_sheets(file_path: str, lgg_sheet: str, est_sheet: str, output_json_path: str):
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
    
    total_vacios = 0
    total_advertencias = 0
    total_alertas = 0
    total_ok = 0

    resumen_celdas = {}
    filas_por_campana = {}
    filas_por_geotecnico = {}
    last_a_by_taladro = {}

    print(f"[*] Iniciando escaneo de LGG. Fila inicial: {lgg_header + 1}, Fila máxima detectada: {ws_lgg.max_row}", flush=True)
    empty_streak_lgg = 0
    current_taladro_lgg = None
    
    for r in range(lgg_header + 1, ws_lgg.max_row + 1):
        if r % 50 == 0:
            print(f"  ... [LGG] Procesando fila {r} / {ws_lgg.max_row}", flush=True)
            
        row_dict, is_empty = get_row_dict(ws_lgg, r, lgg_map)
        
        t_val = row_dict.get("taladro")
        if t_val is not None and str(t_val).strip() != "":
            current_taladro_lgg = safe_str(t_val)
        else:
            row_dict["taladro"] = current_taladro_lgg
            
        if is_empty:
            empty_streak_lgg += 1
            if empty_streak_lgg >= 20:
                print(f"[*] [LGG] Se detectaron 20 filas vacías consecutivas. Terminando lectura de LGG en la fila {r}.", flush=True)
                break
            continue
            
        if not current_taladro_lgg:
            continue
            
        empty_streak_lgg = 0
        total_lgg_filas += 1
        
        taladro = current_taladro_lgg
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

        de = sanitize_val(row_dict.get("de"), float)
        a = sanitize_val(row_dict.get("a"), float)

        rec_m = sanitize_val(row_dict.get("rec_m"), float)
        rqd_m = sanitize_val(row_dict.get("rqd_m"), float)
        lrf_m = sanitize_val(row_dict.get("lrf_m"), float)
        small_frag_m = sanitize_val(row_dict.get("small_frag_m"), float)

        frac_nat = sanitize_val(row_dict.get("frac_nat"), int)
        b30 = sanitize_val(row_dict.get("frac_buz30"), int)
        b60 = sanitize_val(row_dict.get("frac_buz60"), int)
        b90 = sanitize_val(row_dict.get("frac_buz90"), int)

        abertura = sanitize_val(row_dict.get("abertura"), float)
        espesor = sanitize_val(row_dict.get("espesor"), float)

        # Validaciones de valores negativos (se ejecutan solo si el valor existe)
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

        raw_abertura = row_dict.get("abertura")
        if abertura is not None and abertura < 0:
            registrar_lgg_error("abertura", raw_abertura, "ALERTA", f"La abertura de junta ({abertura}mm) no puede ser negativa.")
        raw_espesor = row_dict.get("espesor")
        if espesor is not None and espesor < 0:
            registrar_lgg_error("espesor", raw_espesor, "ALERTA", f"El espesor de relleno ({espesor}mm) no puede ser negativo.")
        raw_camp = row_dict.get("campana")
        if camp is not None and camp < 0:
            registrar_lgg_error("campana", raw_camp, "ALERTA", f"El año de campaña ({camp}) no puede ser negativo.")

        for key, val_raw in [("frac_nat", raw_frac_nat), ("frac_buz30", raw_b30), ("frac_buz60", raw_b60), ("frac_buz90", raw_b90)]:
            if val_raw is not None and val_raw != -1:
                try:
                    f_val = float(val_raw)
                    if not f_val.is_integer():
                        registrar_lgg_error(key, val_raw, "ALERTA", f"El campo '{key}' ({val_raw}) debe ser un número entero.")
                except ValueError:
                    pass

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
                if lrf_m is not None:
                    calc_frf = math.floor(round(lrf_m * 100) / 5) if lrf_m > 0 else 0
                    if frf_val != calc_frf:
                        registrar_lgg_error("frf", frf_raw, "ALERTA", f"El valor de FRF ({frf_val}) no coincide con el calculado por la fórmula ({calc_frf}) basado en LRF ({lrf_m}m).")

        if a is not None:
            resumen_celdas[celda_padre]["dist_celda"] = max(resumen_celdas[celda_padre]["dist_celda"], a)

        if de is not None and celda_padre in last_a_by_taladro:
            prev_a = last_a_by_taladro[celda_padre]
            if abs(de - prev_a) > 0.001:
                gap = round(abs(de - prev_a), 4)
                registrar_lgg_error("de", de, "ALERTA", f"Ruptura de continuidad espacial detectada. Datos evaluados -> Profundidad de inicio 'De': {de}m, Profundidad final anterior 'A': {prev_a}m (Brecha calculada: {gap}m).")
        if a is not None:
            last_a_by_taladro[celda_padre] = a

        if de is not None and a is not None:
            perf = round(a - de, 2)
            if perf <= 0:
                registrar_lgg_error("a", a, "ALERTA", f"Longitud de corrida perforada debe ser positiva. Datos evaluados -> De: {de}m, A: {a}m, Avance calculado: {perf}m.")
            
            if rec_m is not None and round(rec_m, 4) > round(perf, 4):
                registrar_lgg_error("rec_m", rec_m, "ALERTA", f"La longitud recuperada es mayor que el avance perforado. Datos evaluados -> Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")
                
            if rqd_m is not None and rec_m is not None and round(rqd_m, 4) > round(rec_m, 4):
                registrar_lgg_error("rqd_m", rqd_m, "ALERTA", f"Metraje RQD es mayor que la longitud recuperada. Datos evaluados -> RQD: {rqd_m}m, Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")

            if lrf_m is not None and rec_m is not None and round(lrf_m, 4) > round(rec_m, 4):
                registrar_lgg_error("lrf_m", lrf_m, "ALERTA", f"La longitud de roca fracturada LRF es mayor que la longitud recuperada. Datos evaluados -> LRF: {lrf_m}m, Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")

            if rqd_m is not None and lrf_m is not None and small_frag_m is not None:
                sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
                if round(sum_frags, 4) > round(perf, 4):
                    registrar_lgg_error("rqd_m", rqd_m, "ALERTA", f"La suma de fragmentos físicos supera el avance perforado. Datos evaluados -> Suma de fragmentos: {sum_frags}m (RQD: {rqd_m}m + LRF: {lrf_m}m + <10cm: {small_frag_m}m), Avance de corrida: {perf}m (De: {de}m, A: {a}m), Longitud Recuperada: {rec_m}m.")

        if b30 is not None and b60 is not None and b90 is not None and frac_nat is not None:
            sum_bins = b30 + b60 + b90
            if sum_bins != frac_nat:
                registrar_lgg_error("frac_nat", frac_nat, "ADVERTENCIA", f"La sumatoria de fracturas por buzamiento no coincide con el conteo general. Datos evaluados -> Conteo General (Frac_Nat): {frac_nat}, Suma por buzamiento: {sum_bins} (Buz <30°: {b30} + 30°-60°: {b60} + >60°: {b90}).")

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

        for key, val_raw in [("frac_nat", raw_frac_nat), ("frac_buz30", raw_b30), ("frac_buz60", raw_b60), ("frac_buz90", raw_b90)]:
            if val_raw is not None and val_raw != -1:
                try:
                    f_val = float(val_raw)
                    if not f_val.is_integer():
                        registrar_lgg_error(key, val_raw, "ALERTA", f"El campo '{key}' ({val_raw}) debe ser un número entero.")
                except ValueError:
                    pass

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
                calc_frf = math.floor(round(lrf_m * 100) / 5) if lrf_m > 0 else 0
                if frf_val != calc_frf:
                    registrar_lgg_error("frf", frf_raw, "ALERTA", f"El valor de FRF ({frf_val}) no coincide con el calculado por la fórmula ({calc_frf}) basado en LRF ({lrf_m}m).")

        resumen_celdas[celda_padre]["dist_celda"] = max(resumen_celdas[celda_padre]["dist_celda"], a)

        if celda_padre in last_a_by_taladro:
            prev_a = last_a_by_taladro[celda_padre]
            if abs(de - prev_a) > 0.001:
                gap = round(abs(de - prev_a), 4)
                registrar_lgg_error("de", de, "ALERTA", f"Ruptura de continuidad espacial detectada. Datos evaluados -> Profundidad de inicio 'De': {de}m, Profundidad final anterior 'A': {prev_a}m (Brecha calculada: {gap}m).")
        last_a_by_taladro[celda_padre] = a

        if perf <= 0:
            registrar_lgg_error("a", a, "ALERTA", f"Longitud de corrida perforada debe ser positiva. Datos evaluados -> De: {de}m, A: {a}m, Avance calculado: {perf}m.")
        elif perf > 1.6:
            registrar_lgg_error("a", a, "ALERTA", f"Longitud de corrida perforada excede el límite crítico de 1.6m. Datos evaluados -> De: {de}m, A: {a}m, Avance calculado: {perf}m.")
        
        if rec_m > perf:
            registrar_lgg_error("rec_m", rec_m, "ALERTA", f"La longitud recuperada es mayor que el avance perforado. Datos evaluados -> Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")
            
        if rqd_m > rec_m:
            registrar_lgg_error("rqd_m", rqd_m, "ALERTA", f"Metraje RQD es mayor que la longitud recuperada. Datos evaluados -> RQD: {rqd_m}m, Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")

        if lrf_m > rec_m:
            registrar_lgg_error("lrf_m", lrf_m, "ALERTA", f"La longitud de roca fracturada LRF es mayor que la longitud recuperada. Datos evaluados -> LRF: {lrf_m}m, Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")

        sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
        if sum_frags > perf:
            registrar_lgg_error("rqd_m", rqd_m, "ALERTA", f"La suma de fragmentos físicos supera el avance perforado. Datos evaluados -> Suma de fragmentos: {sum_frags}m (RQD: {rqd_m}m + LRF: {lrf_m}m + <10cm: {small_frag_m}m), Avance de corrida: {perf}m (De: {de}m, A: {a}m), Longitud Recuperada: {rec_m}m.")

        sum_bins = b30 + b60 + b90
        if sum_bins != frac_nat:
            registrar_lgg_error("frac_nat", frac_nat, "ADVERTENCIA", f"La sumatoria de fracturas por buzamiento no coincide con el conteo general. Datos evaluados -> Conteo General (Frac_Nat): {frac_nat}, Suma por buzamiento: {sum_bins} (Buz <30°: {b30} + 30°-60°: {b60} + >60°: {b90}).")

        tipo_est1 = safe_str(sanitize_val(row_dict.get("tipo_est1"), str))
        tipo_est2 = safe_str(sanitize_val(row_dict.get("tipo_est2"), str))
        
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
            relleno1 = None
        else:
            relleno1 = relleno1_can

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

        exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}
        if espesor > abertura and (tipo_est1 not in exceptions and tipo_est2 not in exceptions):
            registrar_lgg_error("espesor", espesor, "ALERTA", f"El espesor de relleno no puede ser mayor que la abertura de junta excepto en estructuras F, RF, VN, SZ, F+10 o BED. Datos evaluados -> Espesor: {espesor}mm (Tipo Relleno: '{relleno1}'), Abertura de Junta: {abertura}mm, Estructuras: '{tipo_est1}' / '{tipo_est2}'.")

        if espesor > 0 and abertura <= 0:
            registrar_lgg_error("abertura", abertura, "ADVERTENCIA", f"Se declaró espesor de relleno de junta pero la abertura es 0mm. Datos evaluados -> Espesor: {espesor}mm (Tipo Relleno: '{relleno1}'), Abertura de Junta: {abertura}mm.")
        elif espesor == 0 and abertura > 0 and relleno1 not in [None, "-1"]:
            registrar_lgg_error("espesor", espesor, "ADVERTENCIA", f"La abertura de junta es mayor a 0mm pero no se ha registrado espesor de relleno. Datos evaluados -> Abertura de Junta: {abertura}mm, Espesor: {espesor}mm (Tipo Relleno: '{relleno1}').")

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
    current_taladro_est = None
    
    for r in range(est_header + 1, ws_est.max_row + 1):
        if r % 50 == 0:
            print(f"  ... [EST] Procesando fila {r} / {ws_est.max_row}", flush=True)
            
        row_dict, is_empty = get_row_dict(ws_est, r, est_map)
        
        t_val = row_dict.get("taladro")
        if t_val is not None and str(t_val).strip() != "":
            current_taladro_est = safe_str(t_val)
        else:
            row_dict["taladro"] = current_taladro_est
            
        if is_empty:
            empty_streak_est += 1
            if empty_streak_est >= 20:
                print(f"[*] [EST] Se detectaron 20 filas vacías consecutivas. Terminando lectura de Estructural en la fila {r}.", flush=True)
                break
            continue

        if not current_taladro_est:
            continue

        empty_streak_est = 0
        total_est_filas += 1
        taladro = current_taladro_est
        
        # --- PARSEO Y SANITIZACIÓN INMEDIATA (ESTRUCTURAL) ---
        depth = sanitize_val(row_dict.get("profundidad"), float)
        camp = sanitize_val(row_dict.get("campana"), int)
        geo = sanitize_val(row_dict.get("geotecnico"), str)
        
        abertura = sanitize_val(row_dict.get("abertura"), float)
        espesor = sanitize_val(row_dict.get("espesor"), float)
        
        dip = sanitize_val(row_dict.get("dip"), float)
        azimuth = sanitize_val(row_dict.get("azimuth"), float)
        
        est_de = sanitize_val(row_dict.get("de"), float)
        est_a = sanitize_val(row_dict.get("a"), float)
        
        alfa = sanitize_val(row_dict.get("alfa"), float)
        beta = sanitize_val(row_dict.get("beta"), float)
        jrc10 = sanitize_val(row_dict.get("jrc10"), int)
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

        mandatory_est = [
            "profundidad", "alfa", "beta", "forma", "rugosidad", "jrc10", "abertura", 
            "weathering", "espesor", "relleno1", "dureza_pared", "agua", "geotecnico", "campana"
        ]
        for key in mandatory_est:
            v_san = sanitize_val(row_dict.get(key), str)
            if v_san is None:
                registrar_est_error(key, None, "VACIO", f"El campo obligatorio '{key}' se encuentra vacío o es -1.")

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

        raw_dip = row_dict.get("dip")
        if dip is not None:
            if dip < 0.0 or dip > 90.0:
                registrar_est_error("dip", raw_dip, "ALERTA", f"El ángulo Dip es inválido. Datos evaluados -> Dip: {dip}°. Debe estar entre 0° y 90°.")

        raw_azimuth = row_dict.get("azimuth")
        if azimuth is not None:
            if azimuth < 0.0 or azimuth > 360.0:
                registrar_est_error("azimuth", raw_azimuth, "ALERTA", f"El ángulo Azimut es inválido. Datos evaluados -> Azimut: {azimuth}°. Debe estar entre 0° y 360°.")

        matching_run = None
        if depth is not None:
            for run in lgg_runs:
                if run["taladro"] == taladro and run["de"] <= depth <= run["a"]:
                    matching_run = run
                    break

            if matching_run is None:
                registrar_est_error("profundidad", depth, "ALERTA", f"Profundidad huérfana de junta no corresponde a ningún tramo de corrida en LGG. Datos evaluados -> Profundidad de Junta: {depth}m, Taladro: '{taladro}'.")

        if est_de is not None and est_a is not None:
            has_exact_match = False
            for run in lgg_runs:
                if run["taladro"] == taladro and abs(run["de"] - est_de) < 0.001 and abs(run["a"] - est_a) < 0.001:
                    has_exact_match = True
                    break
            if not has_exact_match:
                registrar_est_error("de", raw_de, "ALERTA", f"La corrida asociada (de/a) no existe de forma exacta en las corridas de LGG para el taladro. Datos evaluados -> Tramo Estructural de corrida: {est_de}m - {est_a}m, Taladro: '{taladro}'.")
            if depth is not None and (depth < est_de or depth > est_a):
                registrar_est_error("profundidad", depth, "ALERTA", f"La profundidad se encuentra fuera del tramo de corrida especificado. Datos evaluados -> Profundidad de Junta: {depth}m, Tramo especificado: {est_de}m - {est_a}m.")

        if alfa is not None:
            if alfa < 0.0 or alfa > 90.0:
                registrar_est_error("alfa", alfa, "ALERTA", f"El ángulo Alfa es inválido. Datos evaluados -> Alfa: {alfa}°. Debe estar entre 0° y 90° o ser -1.")
            elif not float(alfa).is_integer():
                registrar_est_error("alfa", alfa, "ADVERTENCIA", f"El ángulo Alfa debería ser un número entero. Datos evaluados -> Alfa: {alfa}°.")

        if beta is not None:
            if beta < 0.0 or beta > 360.0:
                registrar_est_error("beta", beta, "ALERTA", f"El ángulo Beta es inválido. Datos evaluados -> Beta: {beta}°. Debe estar entre 0° y 360° o ser -1.")
            elif not float(beta).is_integer():
                registrar_est_error("beta", beta, "ADVERTENCIA", f"El ángulo Beta debería ser un número entero. Datos evaluados -> Beta: {beta}°.")

        if jrc10 is not None:
            if jrc10 > 20:
                registrar_est_error("jrc10", jrc10, "ALERTA", f"El valor de JRC10 es inválido. No se permiten valores mayores a 20. Datos evaluados -> JRC10: {jrc10}.")
            elif jrc10 < 0:
                registrar_est_error("jrc10", jrc10, "ALERTA", f"El valor de JRC10 no puede ser negativo. Datos evaluados -> JRC10: {jrc10}.")

        raw_forma = sanitize_val(row_dict.get("forma"), str)
        if raw_forma is not None:
            forma_can = get_canonical_value(raw_forma, VALID_FORMA)
            if not forma_can:
                registrar_est_error("forma", raw_forma, "ALERTA", f"Forma de junta no válida. Permitidos: Plano (1) a Irregular (6). Datos evaluados -> Forma: '{raw_forma}'.")

        tipo_est = safe_str(sanitize_val(row_dict.get("tipo_estructura"), str))
        if espesor is not None and abertura is not None:
            if espesor > abertura and tipo_est not in exceptions:
                registrar_est_error("espesor", espesor, "ALERTA", f"El espesor de relleno no puede ser mayor que la abertura de junta excepto en estructuras F, RF, VN, SZ, F+10 o BED. Datos evaluados -> Espesor: {espesor}mm (Tipo Relleno: '{relleno1}'), Abertura de Junta: {abertura}mm, Estructura: '{tipo_est}'.")

            raw_relleno1 = row_dict.get("relleno1")
            relleno1_can = get_canonical_value(raw_relleno1, VALID_RELLENO)
            if raw_relleno1 is not None and not relleno1_can:
                registrar_est_error("relleno1", raw_relleno1, "ALERTA", f"Código de Tipo de Relleno no válido. Permitidos: {', '.join(VALID_RELLENO)}")
                relleno1 = None
            else:
                relleno1 = relleno1_can

            if espesor > 0 and (not relleno1 or relleno1 in ["-1"]):
                registrar_est_error("relleno1", relleno1, "ADVERTENCIA", f"Se declaró espesor de relleno pero el tipo de relleno está sin definir. Datos evaluados -> Espesor: {espesor}mm, Tipo Relleno: '{relleno1}'.")
            elif relleno1 and relleno1 not in ["-1"] and abertura <= 0:
                registrar_est_error("relleno1", relleno1, "ADVERTENCIA", f"El tipo de relleno está definido pero la abertura de junta es 0mm. Datos evaluados -> Tipo Relleno: '{relleno1}', Abertura de Junta: {abertura}mm, Espesor: {espesor}mm.")

        if matching_run:
            raw_dureza = sanitize_val(row_dict.get("dureza_pared"), str)
            if raw_dureza is not None:
                dureza_can = get_canonical_value(raw_dureza, VALID_STRENGTHS)
                if not dureza_can:
                    registrar_est_error("dureza_pared", raw_dureza, "ALERTA", f"Código de Resistencia ISRM no válido. Permitidos: {', '.join(VALID_STRENGTHS)}")
                    dureza_pared = "R4"
                else:
                    dureza_pared = dureza_can
            else:
                dureza_pared = "R4"

            res_matriz = matching_run["resistencia"]
            r_levels = {"R0":0, "R1":1, "R2":2, "R3":3, "R4":4, "R5":5, "R6":6}
            if dureza_pared in r_levels and res_matriz in r_levels:
                if r_levels[dureza_pared] > r_levels[res_matriz]:
                    registrar_est_error("dureza_pared", raw_dureza, "ADVERTENCIA", f"Incompatibilidad geológica (Dureza de pared de junta supera la resistencia maxima estimada de la corrida). Datos evaluados -> Dureza de Pared de Junta en Estructural: {dureza_pared}, Resistencia Maxima Estimada en LGG: {res_matriz}.")

        if not row_has_errors:
            total_ok += 1

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
    total_campos = total_filas * 20

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

    tmp_path = output_json_path + ".tmp"
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(output_json, f, ensure_ascii=False)
    
    os.replace(tmp_path, output_json_path)


def validate_revision_bulk_v2(file_paths: dict, config: dict, output_json_path: str):
    """
    Versión 2.0 que confía estrictamente en el JSON Configuration del Frontend,
    soportando 3 archivos (LGG/EST, Collar y Survey) y verificando el cruce cuádruple EOH,
    con todas las validaciones geomecánicas completas de V1.
    """
    import time
    
    wb_main = openpyxl.load_workbook(file_paths["lgg_est"], data_only=True)
    wb_col = openpyxl.load_workbook(file_paths["collar"], data_only=True) if file_paths.get("collar") else None
    wb_sur = openpyxl.load_workbook(file_paths["survey"], data_only=True) if file_paths.get("survey") else None

    incidencias = []
    lgg_runs = []
    total_lgg_filas = 0
    total_est_filas = 0
    
    total_vacios = 0
    total_advertencias = 0
    total_alertas = 0
    total_ok = 0

    resumen_celdas = {} 
    filas_por_campana = {}
    filas_por_geotecnico = {}
    last_a_by_taladro = {}

    max_lgg = {}
    max_est = {}
    eoh_collar = {}
    max_survey = {}

    # --- 1. PROCESAR LGG ---
    conf_lgg = config.get("lgg")
    if conf_lgg:
        ws_lgg = wb_main[conf_lgg["sheet"]]
        h_idx, l_map = find_header_row_and_mapping(ws_lgg, LGG_PATTERNS)
        for k, v in FALLBACK_LGG_MAP.items():
            if k not in l_map: l_map[k] = v
            
        print(f"[*] Iniciando escaneo de LGG V2. Fila inicial: {h_idx + 1}, Fila máxima: {ws_lgg.max_row}", flush=True)
        
        empty_streak = 0
        current_taladro = None
        
        for r in range(h_idx + 1, ws_lgg.max_row + 1):
            if r % 500 == 0: print(f"  ... [LGG V2] Fila {r} / {ws_lgg.max_row}", flush=True)
            row_dict, is_empty = get_row_dict(ws_lgg, r, l_map)
            
            t_val = row_dict.get("taladro")
            if t_val is not None and str(t_val).strip() != "":
                current_taladro = safe_str(t_val)
            else:
                row_dict["taladro"] = current_taladro
                
            if is_empty:
                empty_streak += 1
                if empty_streak >= 20:
                    print(f"[*] [LGG V2] Freno de emergencia en fila {r}.", flush=True)
                    break
                continue
            
            if not current_taladro: continue
            
            empty_streak = 0
            total_lgg_filas += 1
            taladro = current_taladro
            
            corrida_num = safe_int(row_dict.get("corrida", 0))
            camp = sanitize_val(row_dict.get("campana"), int)
            geo = sanitize_val(row_dict.get("geologo"), str)
            celda_padre = taladro
            celda_hija = f"{taladro}-C{corrida_num}"

            if camp: filas_por_campana[str(camp)] = filas_por_campana.get(str(camp), 0) + 1
            if geo: filas_por_geotecnico[geo] = filas_por_geotecnico.get(geo, 0) + 1

            if celda_padre not in resumen_celdas:
                resumen_celdas[celda_padre] = {"total_hijas": 0, "vacios": 0, "advertencias": 0, "alertas": 0, "estado_celda": "OK", "dist_celda": 0.0, "campania": str(camp) if camp else "N/A"}

            resumen_celdas[celda_padre]["total_hijas"] += 1
            row_has_errors = False

            def reg_err(col, val, tipo, msg, mod="LGG", hija=celda_hija):
                nonlocal total_vacios, total_advertencias, total_alertas, row_has_errors
                incidencias.append({"fila_excel": r, "celda_padre": celda_padre, "celda_hija": hija, "columna": col, "valor_actual": val, "tipo_incidencia": tipo, "mensaje": msg, "campania": str(camp) if camp else "N/A", "geotecnico": geo if geo else "N/A", "sector_geotecnico": "N/A", "modulo": mod})
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

            # --- 1. PARSEO Y SANITIZACIÓN INMEDIATA ---
            de = sanitize_val(row_dict.get("de"), float)
            a = sanitize_val(row_dict.get("a"), float)

            rec_m = sanitize_val(row_dict.get("rec_m"), float)
            rqd_m = sanitize_val(row_dict.get("rqd_m"), float)
            lrf_m = sanitize_val(row_dict.get("lrf_m"), float)
            small_frag_m = sanitize_val(row_dict.get("small_frag_m"), float)

            frac_nat = sanitize_val(row_dict.get("frac_nat"), int)
            b30 = sanitize_val(row_dict.get("frac_buz30"), int)
            b60 = sanitize_val(row_dict.get("frac_buz60"), int)
            b90 = sanitize_val(row_dict.get("frac_buz90"), int)

            abertura = sanitize_val(row_dict.get("abertura"), float)
            espesor = sanitize_val(row_dict.get("espesor"), float)

            raw_resistencia = row_dict.get("resistencia")
            resistencia_can = get_canonical_value(raw_resistencia, VALID_STRENGTHS)
            resistencia = resistencia_can or "R4"

            raw_intemperismo = row_dict.get("intemperismo")
            intemperismo_can = get_canonical_value(raw_intemperismo, VALID_WEATHERING)
            weathering = intemperismo_can or "UWF"

            raw_relleno1 = row_dict.get("relleno1")
            relleno1_can = get_canonical_value(raw_relleno1, VALID_RELLENO)
            relleno1 = relleno1_can

            raw_agua_obs = row_dict.get("agua_obs")
            agua_obs_can = get_canonical_value(raw_agua_obs, VALID_AGUA)

            jrc10 = safe_int(sanitize_val(row_dict.get("jrc10"), int))

            raw_rugosidad = row_dict.get("rugosidad")
            rugosidad_can = get_canonical_value(raw_rugosidad, VALID_RUGOSITY)

            tipo_est1_raw = safe_str(sanitize_val(row_dict.get("tipo_est1"), str))
            tipo_est2_raw = safe_str(sanitize_val(row_dict.get("tipo_est2"), str))

            # --- 2. VALIDAR CAMPOS OBLIGATORIOS VACÍOS ---
            mandatory_lgg = ["corrida", "de", "a", "rec_m", "rqd_m", "lrf_m", "small_frag_m", "frac_nat", "lito1", "resistencia", "tipo_est1", "frac_buz30", "frac_buz60", "frac_buz90", "abertura", "rugosidad", "jrc10", "intemperismo", "relleno1", "espesor", "agua_obs", "campana", "geologo"]
            for key in mandatory_lgg:
                if key not in l_map: continue
                v_san = sanitize_val(row_dict.get(key), str)
                if v_san is None: reg_err(key, None, "VACIO", f"El campo obligatorio '{key}' se encuentra vacío o es -1.")

            # --- 3. VALIDACIÓN DE CATÁLOGOS ---
            tipo_est1_can = get_canonical_value(tipo_est1_raw, VALID_STRUCTURES)
            if tipo_est1_raw and not tipo_est1_can:
                if tipo_est1_raw.upper() == "J":
                    tipo_est1 = "JN"
                    reg_err("tipo_est1", "J", "ADVERTENCIA", "Código de estructura 'J' reconocido como 'JN' (Junta).")
                else:
                    reg_err("tipo_est1", tipo_est1_raw, "ALERTA", f"Código de estructura 1 no válido. Permitidos: {', '.join(VALID_STRUCTURES)}")
                    tipo_est1 = "JN"
            else:
                tipo_est1 = tipo_est1_can or "JN"

            tipo_est2_can = get_canonical_value(tipo_est2_raw, VALID_STRUCTURES)
            if tipo_est2_raw and not tipo_est2_can:
                reg_err("tipo_est2", tipo_est2_raw, "ALERTA", f"Código de estructura 2 no válido. Permitidos: {', '.join(VALID_STRUCTURES)}")
                tipo_est2 = ""
            else:
                tipo_est2 = tipo_est2_can or ""

            # --- 4. REGLAS DE CONSISTENCIA GEOMECÁNICA ---
            if a is not None:
                max_lgg[taladro] = max(max_lgg.get(taladro, 0.0), a)
                resumen_celdas[celda_padre]["dist_celda"] = max(resumen_celdas[celda_padre]["dist_celda"], a)

            raw_de = row_dict.get("de")
            if de is not None and de < 0:
                reg_err("de", raw_de, "ALERTA", f"El valor de 'de:' ({de}m) no puede ser negativo.")
            raw_a = row_dict.get("a")
            if a is not None and a < 0:
                reg_err("a", raw_a, "ALERTA", f"El valor de 'a:' ({a}m) no puede ser negativo.")
            raw_rec = row_dict.get("rec_m")
            if rec_m is not None and rec_m < 0:
                reg_err("rec_m", raw_rec, "ALERTA", f"La longitud recuperada ({rec_m}m) no puede ser negativa.")
            raw_rqd = row_dict.get("rqd_m")
            if rqd_m is not None and rqd_m < 0:
                reg_err("rqd_m", raw_rqd, "ALERTA", f"El metraje RQD ({rqd_m}m) no puede ser negativo.")
            raw_lrf = row_dict.get("lrf_m")
            if lrf_m is not None and lrf_m < 0:
                reg_err("lrf_m", raw_lrf, "ALERTA", f"La longitud de roca fracturada LRF ({lrf_m}m) no puede ser negativa.")
            raw_small = row_dict.get("small_frag_m")
            if small_frag_m is not None and small_frag_m < 0:
                reg_err("small_frag_m", raw_small, "ALERTA", f"El metraje de fragmentos <10cm ({small_frag_m}m) no puede ser negativo.")

            raw_frac_nat = row_dict.get("frac_nat")
            if frac_nat is not None and frac_nat < 0:
                reg_err("frac_nat", raw_frac_nat, "ALERTA", f"El número de fracturas naturales ({frac_nat}) no puede ser negativo.")
            raw_b30 = row_dict.get("frac_buz30")
            if b30 is not None and b30 < 0:
                reg_err("frac_buz30", raw_b30, "ALERTA", f"El número de fracturas en Buz<30° ({b30}) no puede ser negativo.")
            raw_b60 = row_dict.get("frac_buz60")
            if b60 is not None and b60 < 0:
                reg_err("frac_buz60", raw_b60, "ALERTA", f"El número de fracturas en 30°-60° ({b60}) no puede ser negativo.")
            raw_b90 = row_dict.get("frac_buz90")
            if b90 is not None and b90 < 0:
                reg_err("frac_buz90", raw_b90, "ALERTA", f"El número de fracturas en Buz>60° ({b90}) no puede ser negativo.")

            raw_abertura = row_dict.get("abertura")
            if abertura is not None and abertura < 0:
                reg_err("abertura", raw_abertura, "ALERTA", f"La abertura de junta ({abertura}mm) no puede ser negativa.")
            raw_espesor = row_dict.get("espesor")
            if espesor is not None and espesor < 0:
                reg_err("espesor", raw_espesor, "ALERTA", f"El espesor de relleno ({espesor}mm) no puede ser negativo.")
            raw_camp = row_dict.get("campana")
            if camp is not None and camp < 0:
                reg_err("campana", raw_camp, "ALERTA", f"El año de campaña ({camp}) no puede ser negativo.")

            for key, val_raw in [("frac_nat", raw_frac_nat), ("frac_buz30", raw_b30), ("frac_buz60", raw_b60), ("frac_buz90", raw_b90)]:
                if val_raw is not None and val_raw != -1:
                    try:
                        f_val = float(val_raw)
                        if not f_val.is_integer():
                            reg_err(key, val_raw, "ALERTA", f"El campo '{key}' ({val_raw}) debe ser un número entero.")
                    except ValueError:
                        pass

            if "frf" in l_map:
                frf_raw = row_dict.get("frf")
                frf_val = sanitize_val(frf_raw, int)
                if frf_val is not None and frf_val != -1:
                    if frf_val < 0:
                        reg_err("frf", frf_raw, "ALERTA", f"El valor de FRF no puede ser negativo. Datos evaluados -> FRF: {frf_val}.")
                    try:
                        f_frf = float(frf_raw)
                        if not f_frf.is_integer():
                            reg_err("frf", frf_raw, "ALERTA", f"El valor de FRF debe ser un número entero. Datos evaluados -> FRF: {frf_raw}.")
                    except ValueError:
                        pass
                    if lrf_m is not None:
                        calc_frf = math.floor(round(lrf_m * 100) / 5) if lrf_m > 0 else 0
                        if frf_val != calc_frf:
                            reg_err("frf", frf_raw, "ALERTA", f"El valor de FRF no coincide con el calculado por la fórmula. Datos evaluados -> FRF: {frf_val}, Calculado: {calc_frf} basado en LRF ({lrf_m}m).")

            if de is not None and celda_padre in last_a_by_taladro:
                prev_a = last_a_by_taladro[celda_padre]
                if abs(de - prev_a) > 0.001:
                    gap = round(abs(de - prev_a), 4)
                    reg_err("de", de, "ALERTA", f"Ruptura de continuidad espacial detectada. Datos evaluados -> Profundidad de inicio 'De': {de}m, Profundidad final anterior 'A': {prev_a}m (Brecha calculada: {gap}m).")
            if a is not None:
                last_a_by_taladro[celda_padre] = a

            if de is not None and a is not None:
                perf = round(a - de, 2)
                if perf <= 0: reg_err("a", a, "ALERTA", f"Longitud de corrida perforada debe ser positiva. Datos evaluados -> De: {de}m, A: {a}m, Avance calculado: {perf}m.")
                
                if rec_m is not None and round(rec_m, 4) > round(perf, 4): reg_err("rec_m", rec_m, "ALERTA", f"La longitud recuperada es mayor que el avance perforado. Datos evaluados -> Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")
                if rqd_m is not None and rec_m is not None and round(rqd_m, 4) > round(rec_m, 4): reg_err("rqd_m", rqd_m, "ALERTA", f"Metraje RQD es mayor que la longitud recuperada. Datos evaluados -> RQD: {rqd_m}m, Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")
                if lrf_m is not None and rec_m is not None and round(lrf_m, 4) > round(rec_m, 4): reg_err("lrf_m", lrf_m, "ALERTA", f"La longitud de roca fracturada LRF es mayor que la longitud recuperada. Datos evaluados -> LRF: {lrf_m}m, Recuperada: {rec_m}m, Avance de corrida: {perf}m (De: {de}m, A: {a}m).")

                if rqd_m is not None and lrf_m is not None and small_frag_m is not None:
                    sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
                    if round(sum_frags, 4) > round(perf, 4): reg_err("rqd_m", rqd_m, "ALERTA", f"La suma de fragmentos físicos supera el avance perforado. Datos evaluados -> Suma de fragmentos: {sum_frags}m (RQD: {rqd_m}m + LRF: {lrf_m}m + <10cm: {small_frag_m}m), Avance de corrida: {perf}m (De: {de}m, A: {a}m), Longitud Recuperada: {rec_m}m.")

            if b30 is not None and b60 is not None and b90 is not None and frac_nat is not None:
                sum_bins = b30 + b60 + b90
                if sum_bins != frac_nat:
                    reg_err("frac_nat", frac_nat, "ADVERTENCIA", f"La sumatoria de fracturas por buzamiento no coincide con el conteo general. Datos evaluados -> Conteo General (Frac_Nat): {frac_nat}, Suma por buzamiento: {sum_bins} (Buz <30°: {b30} + 30°-60°: {b60} + >60°: {b90}).")

            exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}
            if espesor is not None and abertura is not None:
                if espesor > abertura and (tipo_est1 not in exceptions and tipo_est2 not in exceptions):
                    reg_err("espesor", espesor, "ALERTA", f"El espesor de relleno no puede ser mayor que la abertura de junta. Datos evaluados -> Espesor: {espesor}mm (Tipo Relleno: '{relleno1}'), Abertura de Junta: {abertura}mm, Estructuras: '{tipo_est1}' / '{tipo_est2}'.")

                if espesor > 0 and abertura <= 0:
                    reg_err("abertura", abertura, "ADVERTENCIA", f"Se declaró espesor de relleno de junta pero la abertura es 0mm. Datos evaluados -> Espesor: {espesor}mm (Tipo Relleno: '{relleno1}'), Abertura de Junta: {abertura}mm.")
                elif espesor == 0 and abertura > 0 and relleno1 not in [None, "-1"]: 
                    reg_err("espesor", espesor, "ADVERTENCIA", f"La abertura de junta es mayor a 0mm pero no se ha registrado espesor de relleno. Datos evaluados -> Abertura de Junta: {abertura}mm, Espesor: {espesor}mm (Tipo Relleno: '{relleno1}').")

            if raw_resistencia is not None and not resistencia_can:
                pass
            if raw_intemperismo is not None and not intemperismo_can:
                pass
            if raw_relleno1 is not None and not relleno1_can:
                pass
            if raw_agua_obs is not None and not agua_obs_can:
                pass
            if raw_rugosidad is not None and not rugosidad_can:
                reg_err("rugosidad", raw_rugosidad, "ALERTA", f"Código de Rugosidad no válido. Permitidos: {', '.join(VALID_RUGOSITY)}")

            lgg_runs.append({
                "taladro": taladro, "de": de, "a": a, "corrida": corrida_num,
                "resistencia": resistencia, "lito1": safe_str(row_dict.get("lito1")),
                "lito2": safe_str(row_dict.get("lito2")), "lito3": safe_str(row_dict.get("lito3"))
            })
            if not row_has_errors: total_ok += 1

    # --- 2. PROCESAR ESTRUCTURAL ---
    conf_est = config.get("est")
    if conf_est:
        ws_est = wb_main[conf_est["sheet"]]
        h_idx, e_map = find_header_row_and_mapping(ws_est, EST_PATTERNS)
        for k, v in FALLBACK_EST_MAP.items():
            if k not in e_map: e_map[k] = v
            
        print(f"[*] Iniciando escaneo de EST V2. Fila inicial: {h_idx + 1}, Fila máxima: {ws_est.max_row}", flush=True)
        
        empty_streak = 0
        current_taladro_est = None
        
        for r in range(h_idx + 1, ws_est.max_row + 1):
            if r % 500 == 0: print(f"  ... [EST V2] Fila {r} / {ws_est.max_row}", flush=True)
            row_dict, is_empty = get_row_dict(ws_est, r, e_map)
            
            t_val = row_dict.get("taladro")
            if t_val is not None and str(t_val).strip() != "":
                current_taladro_est = safe_str(t_val)
            else:
                row_dict["taladro"] = current_taladro_est
                
            if is_empty:
                empty_streak += 1
                if empty_streak >= 20:
                    print(f"[*] [EST V2] Freno de emergencia en fila {r}.", flush=True)
                    break
                continue
            
            if not current_taladro_est: continue
            
            empty_streak = 0
            total_est_filas += 1
            taladro = current_taladro_est
            celda_padre = taladro
            celda_hija = f"{taladro}-E{r}"

            if celda_padre not in resumen_celdas:
                resumen_celdas[celda_padre] = {"total_hijas": 0, "vacios": 0, "advertencias": 0, "alertas": 0, "estado_celda": "OK", "dist_celda": 0.0, "campania": "N/A"}
            
            resumen_celdas[celda_padre]["total_hijas"] += 1
            row_has_errors = False

            def reg_err_est(col, val, tipo, msg):
                nonlocal total_vacios, total_advertencias, total_alertas, row_has_errors
                incidencias.append({"fila_excel": r, "celda_padre": celda_padre, "celda_hija": celda_hija, "columna": col, "valor_actual": val, "tipo_incidencia": tipo, "mensaje": msg, "campania": str(camp) if camp else "N/A", "geotecnico": geo if geo else "N/A", "sector_geotecnico": "N/A", "modulo": "Estructural"})
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

            # --- 1. PARSEO Y SANITIZACIÓN INMEDIATA (ESTRUCTURAL) ---
            depth = sanitize_val(row_dict.get("profundidad"), float)
            camp = sanitize_val(row_dict.get("campana"), int)
            geo = sanitize_val(row_dict.get("geotecnico"), str)

            abertura = sanitize_val(row_dict.get("abertura"), float)
            espesor = sanitize_val(row_dict.get("espesor"), float)

            dip = sanitize_val(row_dict.get("dip"), float)
            azimuth = sanitize_val(row_dict.get("azimuth"), float)

            est_de = sanitize_val(row_dict.get("de"), float)
            est_a = sanitize_val(row_dict.get("a"), float)

            alfa = sanitize_val(row_dict.get("alfa"), float)
            beta = sanitize_val(row_dict.get("beta"), float)
            jrc10 = sanitize_val(row_dict.get("jrc10"), int)
            
            raw_forma = sanitize_val(row_dict.get("forma"), str)
            forma_can = get_canonical_value(raw_forma, VALID_FORMA) if raw_forma is not None else None
            
            tipo_est = safe_str(sanitize_val(row_dict.get("tipo_estructura"), str))
            
            raw_relleno1 = row_dict.get("relleno1")
            relleno1_can = get_canonical_value(raw_relleno1, VALID_RELLENO)
            relleno1 = relleno1_can

            raw_dureza = sanitize_val(row_dict.get("dureza_pared"), str)
            dureza_can = get_canonical_value(raw_dureza, VALID_STRENGTHS) if raw_dureza is not None else None
            dureza_pared = dureza_can or "R4"

            # --- 2. VALIDACIONES MAESTRAS (EST) ---
            if depth is not None:
                max_est[taladro] = max(max_est.get(taladro, 0.0), depth)
                
                lgg_max_for_t = max_lgg.get(taladro, 0.0)
                if lgg_max_for_t > 0 and depth > lgg_max_for_t:
                    reg_err_est("profundidad", depth, "ALERTA", f"La profundidad en logueo estructural excede el límite final registrado en LGG. Datos evaluados -> Profundidad Estructural: {depth}m, Profundidad Máxima LGG: {lgg_max_for_t}m.")

            if camp:
                resumen_celdas[celda_padre]["campania"] = str(camp)

            mandatory_est = ["profundidad", "alfa", "beta", "forma", "rugosidad", "jrc10", "abertura", "weathering", "espesor", "relleno1", "dureza_pared", "agua", "geotecnico", "campana"]
            for key in mandatory_est:
                if key not in e_map: continue
                v_san = sanitize_val(row_dict.get(key), str)
                if v_san is None: reg_err_est(key, None, "VACIO", f"El campo obligatorio '{key}' se encuentra vacío o es -1.")

            raw_depth = row_dict.get("profundidad")
            if depth is not None and depth < 0:
                reg_err_est("profundidad", raw_depth, "ALERTA", f"Profundidad ({depth}m) no puede ser negativa.")
            raw_abertura = row_dict.get("abertura")
            if abertura is not None and abertura < 0:
                reg_err_est("abertura", raw_abertura, "ALERTA", f"La abertura ({abertura}mm) no puede ser negativa.")
            raw_espesor = row_dict.get("espesor")
            if espesor is not None and espesor < 0:
                reg_err_est("espesor", raw_espesor, "ALERTA", f"El espesor de relleno ({espesor}mm) no puede ser negativo.")
            raw_camp = row_dict.get("campana")
            if camp is not None and camp < 0:
                reg_err_est("campana", raw_camp, "ALERTA", f"El año de campaña ({camp}) no puede ser negativo.")

            raw_dip = row_dict.get("dip")
            if dip is not None:
                if dip < 0.0 or dip > 90.0:
                    reg_err_est("dip", raw_dip, "ALERTA", f"El ángulo Dip es inválido. Datos evaluados -> Dip: {dip}°. Debe estar entre 0° y 90°.")

            raw_azimuth = row_dict.get("azimuth")
            if azimuth is not None:
                if azimuth < 0.0 or azimuth > 360.0:
                    reg_err_est("azimuth", raw_azimuth, "ALERTA", f"El ángulo Azimut es inválido. Datos evaluados -> Azimut: {azimuth}°. Debe estar entre 0° y 360°.")

            matching_run = None
            if depth is not None:
                for run in lgg_runs:
                    if run["taladro"] == taladro and run["de"] <= depth <= run["a"]:
                        matching_run = run
                        break

                if matching_run is None:
                    reg_err_est("profundidad", depth, "ALERTA", f"Profundidad huérfana de junta no corresponde a ningún tramo de corrida en LGG. Datos evaluados -> Profundidad de Junta: {depth}m, Taladro: '{taladro}'.")

            raw_de = row_dict.get("de")
            raw_a = row_dict.get("a")
            if est_de is not None and est_a is not None:
                has_exact_match = False
                for run in lgg_runs:
                    if run["taladro"] == taladro and abs(run["de"] - est_de) < 0.001 and abs(run["a"] - est_a) < 0.001:
                        has_exact_match = True
                        break
                if not has_exact_match:
                    reg_err_est("de", raw_de, "ALERTA", f"La corrida asociada (de/a) no existe de forma exacta en las corridas de LGG para el taladro. Datos evaluados -> Tramo Estructural de corrida: {est_de}m - {est_a}m, Taladro: '{taladro}'.")
                if depth is not None and (depth < est_de or depth > est_a):
                    reg_err_est("profundidad", depth, "ALERTA", f"La profundidad se encuentra fuera del tramo de corrida especificado. Datos evaluados -> Profundidad de Junta: {depth}m, Tramo especificado: {est_de}m - {est_a}m.")

            if alfa is not None:
                if alfa < 0.0 or alfa > 90.0:
                    reg_err_est("alfa", alfa, "ALERTA", f"El ángulo Alfa es inválido. Datos evaluados -> Alfa: {alfa}°. Debe estar entre 0° y 90° o ser -1.")
                elif not float(alfa).is_integer():
                    reg_err_est("alfa", alfa, "ADVERTENCIA", f"El ángulo Alfa debería ser un número entero. Datos evaluados -> Alfa: {alfa}°.")

            if beta is not None:
                if beta < 0.0 or beta > 360.0:
                    reg_err_est("beta", beta, "ALERTA", f"El ángulo Beta es inválido. Datos evaluados -> Beta: {beta}°. Debe estar entre 0° y 360° o ser -1.")
                elif not float(beta).is_integer():
                    reg_err_est("beta", beta, "ADVERTENCIA", f"El ángulo Beta debería ser un número entero. Datos evaluados -> Beta: {beta}°.")

            if jrc10 is not None:
                if jrc10 > 20:
                    reg_err_est("jrc10", jrc10, "ALERTA", f"El valor de JRC10 es inválido. No se permiten valores mayores a 20. Datos evaluados -> JRC10: {jrc10}.")
                elif jrc10 < 0:
                    reg_err_est("jrc10", jrc10, "ALERTA", f"El valor de JRC10 no puede ser negativo. Datos evaluados -> JRC10: {jrc10}.")

            if raw_forma is not None and not forma_can:
                reg_err_est("forma", raw_forma, "ALERTA", f"Forma de junta no válida. Permitidos: Plano (1) a Irregular (6). Datos evaluados -> Forma: '{raw_forma}'.")

            exceptions = {"F", "RF", "VN", "SZ", "F+10", "BED"}
            if espesor is not None and abertura is not None:
                if espesor > abertura and tipo_est not in exceptions:
                    reg_err_est("espesor", espesor, "ALERTA", f"El espesor de relleno no puede ser mayor que la abertura de junta excepto en estructuras F, RF, VN, SZ, F+10 o BED. Datos evaluados -> Espesor: {espesor}mm (Tipo Relleno: '{relleno1}'), Abertura de Junta: {abertura}mm, Estructura: '{tipo_est}'.")

                if espesor > 0 and (not relleno1 or relleno1 in ["-1"]):
                    reg_err_est("relleno1", relleno1, "ADVERTENCIA", f"Se declaró espesor de relleno pero el tipo de relleno está sin definir. Datos evaluados -> Espesor: {espesor}mm, Tipo Relleno: '{relleno1}'.")
                elif relleno1 and relleno1 not in ["-1"] and abertura <= 0:
                    reg_err_est("relleno1", relleno1, "ADVERTENCIA", f"El tipo de relleno está definido pero la abertura de junta es 0mm. Datos evaluados -> Tipo Relleno: '{relleno1}', Abertura de Junta: {abertura}mm, Espesor: {espesor}mm.")

            if matching_run:
                if raw_dureza is not None and not dureza_can:
                    reg_err_est("dureza_pared", raw_dureza, "ALERTA", f"Código de Resistencia ISRM no válido.")
                
                res_matriz = matching_run["resistencia"]
                r_levels = {"R0":0, "R1":1, "R2":2, "R3":3, "R4":4, "R5":5, "R6":6}
                if dureza_pared in r_levels and res_matriz in r_levels:
                    if r_levels[dureza_pared] > r_levels[res_matriz]:
                        reg_err_est("dureza_pared", raw_dureza, "ADVERTENCIA", f"Incompatibilidad geológica (Dureza de pared de junta supera la resistencia maxima estimada de la corrida). Datos evaluados -> Dureza de Pared de Junta en Estructural: {dureza_pared}, Resistencia Maxima Estimada en LGG: {res_matriz}.")

            if not row_has_errors: total_ok += 1

    # --- 3. PROCESAR COLLAR PARA EOH ---
    conf_col = config.get("collar")
    if wb_col and conf_col:
        ws_col = wb_col[conf_col["sheet"]]
        h_idx, c_map = find_header_row_and_mapping(ws_col, COLLAR_PATTERNS)
        
        print(f"[*] Escaneando Collar. Fila {h_idx + 1} a {ws_col.max_row}", flush=True)
        for r in range(h_idx + 1, ws_col.max_row + 1):
            row_dict, _ = get_row_dict(ws_col, r, c_map)
            t_val = row_dict.get("taladro")
            e_val = row_dict.get("eoh")
            if not t_val: continue
            
            t_str = safe_str(t_val)
            e_float = safe_float(sanitize_val(e_val, float))
            eoh_collar[t_str] = e_float

    # --- 4. PROCESAR SURVEY PARA DEPTH ---
    conf_sur = config.get("survey")
    if wb_sur and conf_sur:
        ws_sur = wb_sur[conf_sur["sheet"]]
        h_idx, s_map = find_header_row_and_mapping(ws_sur, SURVEY_PATTERNS)
        
        print(f"[*] Escaneando Survey. Fila {h_idx + 1} a {ws_sur.max_row}", flush=True)
        for r in range(h_idx + 1, ws_sur.max_row + 1):
            row_dict, _ = get_row_dict(ws_sur, r, s_map)
            t_val = row_dict.get("taladro")
            d_val = row_dict.get("depth")
            if not t_val: continue
            
            t_str = safe_str(t_val)
            d_float = safe_float(sanitize_val(d_val, float))
            max_survey[t_str] = max(max_survey.get(t_str, 0.0), d_float)

    # --- 5. CRUCE CUÁDRUPLE (REGLA CRÍTICA DE PROFUNDIDAD FINAL) ---
    taladros_procesados = set(list(max_lgg.keys()) + list(max_est.keys()))
    for t in taladros_procesados:
        l_val = max_lgg.get(t, 0.0)
        e_val = max_est.get(t, 0.0)
        
        has_collar = wb_col and t in eoh_collar
        has_survey = wb_sur and t in max_survey
        
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
            
            msg = f"Las profundidades finales del taladro no coinciden entre módulos (LGG, Estructural, Collar, Survey). Datos evaluados -> LGG Max: {l_val}m, Estructural Max: {e_val}m, Collar EOH: {c_str}, Survey Max: {s_str}."
            
            incidencias.append({
                "fila_excel": 0, "celda_padre": t, "celda_hija": t,
                "columna": "Profundidad Final EOH", "valor_actual": l_val, 
                "tipo_incidencia": "ALERTA", "mensaje": msg,
                "campania": "N/A", "geotecnico": "N/A", "sector_geotecnico": "N/A",
                "modulo": "Cruce General"
            })
            if t in resumen_celdas:
                resumen_celdas[t]["alertas"] += 1
                total_alertas += 1

    total_celdas_ok = 0
    for celda, data in resumen_celdas.items():
        if data["alertas"] > 0: data["estado_celda"] = "ALERTA"
        elif data["vacios"] > 0 or data["advertencias"] > 0: data["estado_celda"] = "ADVERTENCIA"
        else:
            data["estado_celda"] = "OK"
            total_celdas_ok += 1

    total_filas = total_lgg_filas + total_est_filas
    total_campos = total_filas * 20

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

    tmp_path = output_json_path + ".tmp"
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(output_json, f, ensure_ascii=False)
    os.replace(tmp_path, output_json_path)

    if wb_col: wb_col.close()
    if wb_sur: wb_sur.close()