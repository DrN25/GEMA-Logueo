import os
import json
import math
import unicodedata
import re
import openpyxl
from collections import defaultdict
from typing import List, Dict, Any, Optional
from app.core.rules import WEATHERING_COMPATIBILITY, MASTER_ERROR_RULES
from app.core.report_config import CAMPOS_EXTRA_A_CAPTURAR
from app.calculator import (
    STRENGTH_RATINGS, WEATHERING_RATINGS_76, WEATHERING_RATINGS_89,
    ROUGHNESS_RATINGS_76, ROUGHNESS_RATINGS_89, FILLING_CLASSES, _norm_code,
    calculate_rqd_rating, calculate_spacing_rating_76, calculate_spacing_rating_89,
    calculate_aperture_rating_76, calculate_aperture_rating_89,
    calculate_filling_rating_76, calculate_filling_rating_89,
    calculate_water_rating, get_rock_class
)

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
VALID_ORIENTACION = {"S", "N", "PU", "PT", "PT/PU", "BUENA", "REGULAR", "MALA", "NO APLICA", "NO REGISTRA", "S/O", "-1"}
VALID_TURNOS = {"TD", "TN", "D", "N", "DIA", "NOCHE"}

def get_sheet_safe(wb, sheet_hint=None, default_keywords=None):
    """Obtiene una hoja de cálculo sin fallar por discrepancias de mayúsculas o nombres inexactos."""
    if not wb or not wb.sheetnames:
        return None
    if sheet_hint and sheet_hint in wb.sheetnames:
        return wb[sheet_hint]
    if sheet_hint:
        hint_norm = normalize_text(sheet_hint)
        for s in wb.sheetnames:
            if normalize_text(s) == hint_norm:
                return wb[s]
    if default_keywords:
        for kw in default_keywords:
            kw_norm = normalize_text(kw)
            for s in wb.sheetnames:
                if kw_norm in normalize_text(s):
                    return wb[s]
    return wb[wb.sheetnames[0]]

LGG_PATTERNS = {
    "corrida": ["corrida", "id", "numcorrida"],
    "taladro": ["taladro", "sondaje", "drillhole", "holeid", "taladroid"],
    "de": ["de", "desde", "dem", "desdem", "from", "depthfrom"],
    "a": ["a", "hasta", "am", "hastam", "to", "depthto"],
    "perf": ["perf", "perforacion", "longitudperforada", "longperforada", "avance"],
    "rec_m": ["longitudrecuperadam", "recuperacionm", "recm", "recupm", "recuperacion", "recuperada", "longitudrecuperada", "longitudrecuperdadam", "longitudrecuperdada"],
    "rqd_m": ["rqdm", "rqd", "rqdmfragmentos10cm", "frag10cmm", "sumfrags10cm", "rqdsumfrags10cmm", "fragmentos10cmm", "frags10cmm", "fragmayorigual10cmm", "sumfrag10cm", "fragsmayor10cmm", "fragmayor10cmm", "rqdsumfragsmayorigual10cmm", "sumfragsmayorigual10cmm", "sumfragsmayor10cmm"],
    "lrf_m": ["longitudrocafracturadam", "lrfm", "lrf", "longitudrocafracturada", "rocafracturadam", "rocafracturada"],
    "small_frag_m": ["sumfrags10cmquenoentranalrqd", "smallfragm", "smallfrag", "sumfrags10cmquenoentranalrqdm", "frags10cmquenoentranalrqdm", "fragmenor10cmm", "fragmentosmenores10cm", "fragmenores10cm", "sumfragsmenor10cmquenoentranalrqdm"],
    "sum_frags_total": ["sumrqdlrfsumfragsmenor10cm", "sumrqdlrfsumfrags10cm", "sumrqdlrfsmallfrag", "sumrqdlrfsumfrags10cmm"],
    "frf": ["frf", "fracturaspormetro", "fracturasmetro"],
    "frac_nat": ["ndefracnaturales", "nfracnatur", "nfracnaturales", "fracnat", "fracturasnaturales", "naturales"],
    "lito1": ["lito1", "lito12023", "litologia1", "litologia12023", "litologia"],
    "lito2": ["lito2", "lito22023", "litologia2", "litologia22023"],
    "lito3": ["lito3", "lito32023", "litologia3", "litologia32023"],
    "r_indice": ["r", "indicer"],
    "resistencia": ["resistencia", "resistestimadaisrm", "resistmaxestimadaisrm", "resistestimada", "resistmax", "resist", "dureza", "isrm", "durezamaterial", "resistmaxestimada"],
    "linea_orientacion": ["lineadeorientacion", "lineaorientacion", "orientacion"],
    "offset": ["desplazamiento0360offsetoffset", "desplazamiento0360offset", "offset", "desplazamiento"],
    "tipo_est1": ["tipodeestruct", "tipoestructura1", "tipoest1", "estructura1", "tipodeestruct1"],
    "tipo_est2": ["tipodeestruct2", "tipoestructura2", "tipoest2", "estructura2"],
    "frac_buz30": ["nfracnatbuz30", "nfracnaturalbuz30", "buz30", "naturalesbuz30", "nfracnatbuzmenor30", "nfracnaturalbuzmenor30", "buzmenor30"],
    "frac_buz60": ["nfracn30buz60", "nfracnatural30buz60", "buz3060", "buz30a60", "nfracn30menorigualbuzmenor60", "nfracn30menorigualbuz60", "nfracnatural30menorigualbuzmenor60", "nfracn30menorbuzmenor60", "nfracn30menorbuz60"],
    "frac_buz90": ["nfracnatbuz60", "nfracnaturalbuz60", "buz60", "nfracnatbuz90", "nfracnaturalbuz90", "buz90", "nfracnatbuzmayor60", "nfracnaturalbuzmayor60", "buzmayor60"],
    "sum_frac_nat": ["sumfracturasnaturales", "sumfracnat", "sumatorianaturales"],
    "abertura": ["aberturamm", "abertura", "abert"],
    "rugosidad": ["rugosidadisrm", "rugosidad", "rugos"],
    "jrc10": ["jrc10", "jrc", "jrc10rugosidad"],
    "intemperismo": ["gradointempisrm", "gradointemp", "intemperismo", "alteracion", "weathering"],
    "relleno1": ["tipoderelleno1", "relleno1", "tiporelleno1"],
    "relleno2": ["tipoderelleno2", "relleno2", "tiporelleno2"],
    "espesor": ["espesorrellenomm", "espesorrelleno", "espesor", "espesormm"],
    "agua_obs": ["presenciadeaguaisrm", "presenaguaisrm", "presenciaagua", "aguaobs", "agua"],
    "geologo": ["geotecnico", "geotécnico", "geologo", "geotecnic", "geot"],
    "fecha": ["fecha", "date", "fechadelogueo"],
    "turno": ["turno", "shift"],
    "comentarios": ["comentarios", "comentario", "observaciones", "observacion", "comments"],
    "campana": ["campana", "anio", "campan", "campaign", "year"],
    "proyecto": ["proyecto", "project"]
}

EST_PATTERNS = {
    "corrida_avance": ["corrida"],
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
    "jrc10": ["jrc10", "jrc", "jrc10rugosidad", "jnrc10"],
    "abertura": ["aberturamm", "abertura", "abert"],
    "weathering": ["gradointempisrm", "gradointemp", "intemperismo", "alteracion", "weathering", "gradointemperismo"],
    "espesor": ["espesorrellenomm", "espesorrelleno", "espesor", "espesormm"],
    "relleno1": ["tipoderelleno1", "relleno1", "tiporelleno1"],
    "relleno2": ["tipoderelleno2", "relleno2", "tiporelleno2"],
    "dureza_pared": ["durezadepared", "dureza", "durezapared", "durezaestructural", "durezadelapareddeestructura", "durezadelapareddeestructu"],
    "agua": ["presenciadeaguaisrm", "presenaguaisrm", "presenciaagua", "aguaobs", "agua"],
    "geotecnico": ["geotecnico", "geotécnico", "geologo", "geotecnic", "geot"],
    "comentario": ["comentarios", "comentario", "observaciones", "observacion", "comments", "intervalocomentario"],
    "corrida": ["corrida", "id", "numcorrida"],
    "campana": ["campana", "anio", "campan", "campaign", "year"],
    "proyecto": ["proyecto", "project"]
}

RMR_PATTERNS = {
    "sondaje": ["sondaje", "taladro", "drillhole", "holeid"],
    "corrida": ["corrida", "id", "numcorrida"],
    "lito1": ["litho1", "lito1", "litologia1"],
    "lito2": ["litho2", "lito2", "litologia2"],
    "lito3": ["litho3", "lito3", "litologia3"],
    "de": ["desde", "desdem", "de", "from"],
    "a": ["hasta", "hastam", "a", "to"],
    "long_corrida": ["longcorrida", "longcorridam", "longitudcorrida"],
    "rec_m": ["recm", "recupm", "recuperacionm", "longitudrecuperada"],
    "rec_pct": ["recpct", "recporcentaje"],
    "rqd_m": ["rqdm", "rqd"],
    "rqd_pct": ["rqdpct", "rqdporcentaje"],
    "lrf_m": ["longtramofracturadom", "lrfm", "lrf", "longitudrocafracturada"],
    "frf": ["frfzonastrituradas", "frf"],
    "frac_nat": ["fracturasnaturales", "nfracnaturales", "fracnat"],
    "total_frac": ["toraldefracturas", "totaldefracturas", "totalfracturas"],
    "ff_1m": ["ff1m", "ffm"],
    "espaciamiento_mm": ["espaciamientomm", "espaciamiento"],
    "resistencia": ["resistencia", "resistenciainput"],
    "tipo_estructura": ["tipodeestructura", "tipoest"],
    "abertura_mm": ["aberturamm", "abertura"],
    "rugosidad": ["rugosidad"],
    "relleno": ["relleno"],
    "clasificacion_relleno": ["clasificacionrelleno"],
    "intemperismo": ["intemperismo"],
    "jrc10": ["jrc10"],
    "espesor_relleno": ["espesorderelleno", "espesorrelleno"],
    "presencia_agua": ["presenciadeagua", "presenciaagua"],
    "rmr76": ["rmr76", "rmr76total"],
    "rmr89": ["rmr89", "rmr89total"],
    "campana": ["campana", "anio"]
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
    "corrida": 1, "taladro": 2, "de": 3, "a": 4, "rec_m": 5, "rqd_m": 6, "lrf_m": 7, "frf": 8,
    "frac_nat": 9, "lito1": 10, "lito2": 11, "lito3": 12, "resistencia": 13, "tipo_est1": 14, "tipo_est2": 15,
    "frac_buz30": 16, "frac_buz60": 17, "frac_buz90": 18, "abertura": 19, "rugosidad": 20, "jrc10": 21,
    "intemperismo": 22, "relleno1": 23, "relleno2": 24, "espesor": 25, "agua_obs": 26, "geologo": 27,
    "comentarios": 28, "campana": 29
}

FALLBACK_LGG_MAP_2026 = {
    "taladro": 2, "de": 3, "a": 4, "perf": 5, "rec_m": 7, "rqd_m": 8, "lrf_m": 9, "small_frag_m": 10,
    "sum_frags_total": 11, "frf": 13, "frac_nat": 14, "lito1": 15, "lito2": 16, "lito3": 17,
    "r_indice": 18, "resistencia": 19, "linea_orientacion": 20, "offset": 21, "tipo_est1": 22, "tipo_est2": 23,
    "frac_buz30": 24, "frac_buz60": 25, "frac_buz90": 26, "sum_frac_nat": 27, "abertura": 29, "rugosidad": 30,
    "jrc10": 31, "intemperismo": 33, "relleno1": 35, "relleno2": 36, "espesor": 37, "agua_obs": 39,
    "geologo": 40, "fecha": 41, "turno": 42, "comentarios": 43, "campana": 44, "proyecto": 45
}

FALLBACK_EST_MAP = {
    "taladro": 2, "de": 3, "a": 4, "profundidad": 5, "lito1": 6, "lito2": 7, "lito3": 8, "tipo_estructura": 9,
    "alfa": 10, "beta": 11, "dip": 12, "azimuth": 13, "forma": 14, "rugosidad": 15, "jrc10": 16, "abertura": 17,
    "weathering": 18, "espesor": 19, "relleno1": 20, "relleno2": 21, "dureza_pared": 22, "agua": 23,
    "geotecnico": 24, "comentario": 25, "campana": 26
}

FALLBACK_EST_MAP_2026 = {
    "taladro": 2, "de": 3, "a": 4, "corrida_avance": 5, "profundidad": 6, "lito1": 7, "tipo_estructura": 8,
    "alfa": 9, "beta": 10, "forma": 11, "rugosidad": 14, "jrc10": 15, "abertura": 16,
    "weathering": 17, "espesor": 18, "relleno1": 19, "relleno2": 20, "dureza_pared": 21, "agua": 22,
    "geotecnico": 23, "comentario": 24, "corrida": 25, "campana": 26, "proyecto": 27
}

FALLBACK_RMR_MAP = {
    "sondaje": 1, "fecha": 2, "logueador": 3, "corrida": 4, "lito1": 5, "lito2": 6, "lito3": 7,
    "de": 8, "a": 9, "long_corrida": 10, "rec_m": 11, "rec_pct": 12, "rqd_m": 13, "rqd_pct": 14,
    "lrf_m": 15, "frf": 16, "frac_nat": 17, "total_frac": 18, "ff_1m": 19, "espaciamiento_mm": 20,
    "resistencia": 21, "tipo_estructura": 22, "abertura_mm": 23, "rugosidad": 24, "relleno": 25,
    "clasificacion_relleno": 26, "intemperismo": 27, "jrc10": 28, "espesor_relleno": 29, "presencia_agua": 30,
    "r76_resistencia": 32, "r76_rqd": 33, "r76_espaciamiento": 34, "r76_abertura": 35,
    "r76_rugosidad": 36, "r76_relleno": 37, "r76_intemperismo": 38, "r76_persistencia": 39,
    "r76_juntas": 40, "r76_agua": 41, "rmr76": 42, "r76_calidad_roca": 43, "r76_litologia": 44,
    "r89_resistencia": 46, "r89_rqd": 47, "r89_espaciamiento": 48, "r89_abertura": 49,
    "r89_rugosidad": 50, "r89_relleno": 51, "r89_intemperismo": 52, "r89_persistencia": 53,
    "r89_juntas": 54, "r89_agua": 55, "rmr89": 56, "r89_calidad_roca": 57, "campana": 58
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

class FaltantesCollector:
    def __init__(self):
        self._registros = []

    def registrar(self, modulo, fila_excel, celda_padre, celda_hija, columna, valor_raw, campania, geotecnico):
        if valor_raw is None:
            tipo = "VACIO"
        else:
            txt = str(valor_raw).strip()
            if txt == "":
                tipo = "VACIO"
            elif txt in ("-1", "-1.0", "-1,0"):
                tipo = "SIN_INFORMACION"
            else:
                return
        self._registros.append({
            "fila_excel": fila_excel,
            "celda_padre": celda_padre,
            "celda_hija": celda_hija,
            "columna": columna,
            "tipo_incidencia": tipo,
            "campania": str(campania) if campania not in (None, "") else "N/A",
            "geotecnico": geotecnico if geotecnico else "N/A",
            "sector_geotecnico": "N/A",
            "modulo": modulo,
        })

    def dump(self):
        return list(self._registros)

def capturar_faltantes_extra(collector, modulo, row_dict, claves, fila_excel, celda_padre, celda_hija, campania, geotecnico):
    if collector is None:
        return
    for clave in claves:
        if clave not in row_dict:
            continue
        collector.registrar(modulo, fila_excel, celda_padre, celda_hija, clave,
                            row_dict.get(clave), campania, geotecnico)

def sanitize_val(val, target_type):
    if val is None:
        return None
    val_str = str(val).strip()
    val_upper = val_str.upper()
    if val_str == "" or val_upper in ["-1", "-1.0", "N/A", "NAN", "NONE", "-", "—", "-1,0"]:
        return None
    if target_type == str:
        return val_str
    try:
        if target_type == int:
            return int(round(float(val)))
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

from collections import defaultdict

def find_rmr_sheet_name(sheetnames: list) -> Optional[str]:
    # 1. Prioridad: hojas con 'validacion' en el nombre (ej. 'Validación_Logueo', 'Validación_RMR')
    for s in sheetnames:
        norm = normalize_text(s)
        if 'validacion' in norm:
            return s
    # 2. Secundaria: coincidencia con 'rmr', 'bdrmr', 'logueormr' (sin coincidir tablas como rmr76 o rmr89)
    for s in sheetnames:
        norm = normalize_text(s)
        if norm in ['rmr', 'bdrmr', 'bd_rmr', 'logueormr', 'logueo_rmr']:
            return s
    return None

def validate_rmr_sheet_data(
    ws_rmr,
    lgg_runs: list,
    resumen_celdas: dict,
    incidencias: list,
    r_counters: dict,
    custom_map: dict = None,
    collector: FaltantesCollector = None
) -> int:
    """
    Realiza el escaneo y auditoría geomecánica masiva de la hoja 'Validación_RMR' (o similar)
    verificando la congruencia de los 48 campos contra LGG y las reglas de Reglas.md.
    Clasifica datos ausentes en:
    - 'VACIO': Celda sin contenido (None o '').
    - 'SIN_INFORMACION': Celda con valor '-1' (Sin dato registrado).
    """
    h_idx, rmr_map = find_header_row_and_mapping(ws_rmr, RMR_PATTERNS)
    # ponytail: saltar si no contiene cabeceras mínimas de logueo de sondaje (ej. RMR76/89)
    if not (("sondaje" in rmr_map or "taladro" in rmr_map) and ("de" in rmr_map or "a" in rmr_map)):
        print(f"[*] [RMR] Hoja '{ws_rmr.title}' no contiene columnas de datos de sondaje. Omitiendo.", flush=True)
        return 0

    for k, v in FALLBACK_RMR_MAP.items():
        if k not in rmr_map:
            rmr_map[k] = v
    if custom_map:
        for k, v in custom_map.items():
            if v is not None and isinstance(v, int) and v >= 0:
                rmr_map[k] = v + 1

    rmr_extra = list(CAMPOS_EXTRA_A_CAPTURAR["Validación RMR"])

    print(f"[*] Iniciando escaneo de Validación_RMR. Fila inicial: {h_idx + 1}, Fila máxima: {ws_rmr.max_row}", flush=True)

    lgg_by_taladro = defaultdict(list)
    for run in lgg_runs:
        t_name = run.get("taladro")
        if t_name:
            lgg_by_taladro[t_name].append(run)

    rmr_by_taladro = defaultdict(list)
    all_rmr_runs = []
    empty_streak = 0
    current_taladro = None
    total_rmr_filas = 0

    dry_thresh = 75.0
    nf_thresh = 80.0
    wb_parent = getattr(ws_rmr, "parent", None)
    if wb_parent:
        for sname in wb_parent.sheetnames:
            if "DATOS" in sname.upper() and "LG" in sname.upper():
                try:
                    ws_datos = wb_parent[sname]
                    for r_chk in ws_datos.iter_rows(max_row=15, values_only=True):
                        for c_i, val_c in enumerate(r_chk):
                            t_u = str(val_c or "").strip().upper()
                            if t_u in ("SECO", "SECO:"):
                                for c_val in r_chk[c_i+1:c_i+5]:
                                    try:
                                        f_val = float(c_val)
                                        if 0 < f_val < 500: dry_thresh = f_val; break
                                    except (ValueError, TypeError): pass
                            if t_u in ("HÚMEDO", "HUMEDO", "HÚMEDO:", "HUMEDO:"):
                                for c_val in r_chk[c_i+1:c_i+5]:
                                    try:
                                        f_val = float(c_val)
                                        if 0 < f_val < 500: nf_thresh = f_val; break
                                    except (ValueError, TypeError): pass
                except Exception:
                    pass
                break

    for r in range(h_idx + 1, ws_rmr.max_row + 1):
        if r % 500 == 0:
            print(f"  ... [RMR] Fila {r} / {ws_rmr.max_row}", flush=True)
            
        row_dict, is_empty = get_row_dict(ws_rmr, r, rmr_map)

        t_val = row_dict.get("sondaje") or row_dict.get("taladro")
        if t_val is not None and str(t_val).strip() != "":
            current_taladro = safe_str(t_val)
        else:
            row_dict["sondaje"] = current_taladro

        if is_empty:
            empty_streak += 1
            if empty_streak >= 20:
                print(f"[*] [RMR] Freno de emergencia en fila {r}.", flush=True)
                break
            continue

        if not current_taladro:
            continue

        empty_streak = 0
        total_rmr_filas += 1
        taladro = current_taladro
        corrida_num = safe_int(row_dict.get("corrida", 0))
        celda_padre = taladro
        celda_hija = f"{taladro}-RMR{corrida_num if corrida_num > 0 else r}"

        if isinstance(resumen_celdas, dict):
            if celda_padre not in resumen_celdas:
                resumen_celdas[celda_padre] = {
                    "total_hijas": 0, "vacios": 0, "sin_informacion": 0,
                    "advertencias": 0, "alertas": 0, "estado_celda": "OK",
                    "dist_celda": 0.0, "campania": "N/A"
                }
            resumen_celdas[celda_padre]["total_hijas"] += 1

        row_dict["_fila_excel"] = r
        row_dict["_celda_padre"] = celda_padre
        row_dict["_celda_hija"] = celda_hija

        # Sanitizar campos numéricos para el contexto
        for k in ["de", "a", "long_corrida", "rec_m", "rec_pct", "rqd_m", "rqd_pct", "lrf_m", "total_frac", "ff_1m", "espaciamiento_mm", "abertura_mm", "espesor_relleno", "rmr76", "r76_resistencia", "r76_rqd", "r76_espaciamiento", "r76_juntas", "r76_agua", "rmr89", "r89_resistencia", "r89_rqd", "r89_espaciamiento", "r89_juntas", "r89_agua"]:
            if k in row_dict:
                row_dict[k] = sanitize_val(row_dict[k], float)
        for k in ["corrida", "frf", "frac_nat", "clasificacion_relleno", "jrc10"]:
            if k in row_dict:
                row_dict[k] = sanitize_val(row_dict[k], int)

        capturar_faltantes_extra(collector, "Validación RMR", row_dict, rmr_extra, r,
                                 celda_padre, celda_hija, row_dict.get("campana"), None)

        rmr_by_taladro[taladro].append(row_dict)
        all_rmr_runs.append(row_dict)

    # --- DELEGACIÓN AL MOTOR DE REGLAS MODULAR (app.core.engine) ---
    from app.core.engine.context import ValidationContext
    from app.core.engine.rules.rmr_rules import (
        RMR_MandatoryFieldsRule,
        RMR_CrossCheckWithLGGRule,
        RMR_FormulasAndRatingsRule
    )

    ctx = ValidationContext(
        lgg_runs=lgg_runs,
        lgg_by_taladro=lgg_by_taladro,
        rmr_runs=all_rmr_runs,
        rmr_by_taladro=rmr_by_taladro
    )

    rows_with_alert = set()
    rmr_rules = [RMR_MandatoryFieldsRule(), RMR_CrossCheckWithLGGRule(), RMR_FormulasAndRatingsRule()]
    for rule in rmr_rules:
        anomalies = rule.evaluate(ctx)
        for anom in anomalies:
            incidencias.append({
                "fila_excel": anom.row_excel,
                "celda_padre": anom.celda_padre,
                "celda_hija": anom.celda_hija,
                "columna": anom.columna,
                "valor_actual": anom.valor_actual,
                "tipo_incidencia": anom.severity.value,
                "mensaje": anom.mensaje,
                "campania": safe_str(anom.campania) or "N/A",
                "geotecnico": safe_str(anom.geotecnico) or "N/A",
                "sector_geotecnico": safe_str(anom.sector_geotecnico) or "N/A",
                "modulo": anom.modulo
            })
            sev_val = anom.severity.value
            if sev_val == "VACIO":
                r_counters["total_vacios"] += 1
                if isinstance(resumen_celdas, dict) and anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["vacios"] += 1
            elif sev_val == "SIN_INFORMACION":
                r_counters["total_sin_informacion"] += 1
                if isinstance(resumen_celdas, dict) and anom.celda_padre in resumen_celdas:
                    if "sin_informacion" not in resumen_celdas[anom.celda_padre]:
                        resumen_celdas[anom.celda_padre]["sin_informacion"] = 0
                    resumen_celdas[anom.celda_padre]["sin_informacion"] += 1
            elif sev_val == "ADVERTENCIA":
                r_counters["total_advertencias"] += 1
                if isinstance(resumen_celdas, dict) and anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["advertencias"] += 1
            elif sev_val == "ALERTA":
                r_counters["total_alertas"] += 1
                if isinstance(resumen_celdas, dict) and anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["alertas"] += 1
                if anom.row_excel > 0:
                    rows_with_alert.add(anom.row_excel)

    r_counters["total_ok"] += (total_rmr_filas - len(rows_with_alert))
    return total_rmr_filas



def validate_lgg_sheet_data(
    ws_lgg,
    is_2026: bool,
    resumen_celdas: dict,
    incidencias: list,
    l_counters: dict,
    collector: FaltantesCollector = None,
    filas_por_campana: dict = None,
    filas_por_geotecnico: dict = None,
    max_lgg: dict = None
):
    """
    Escanea la hoja LGG, extrae corridas y evalúa las reglas geomecánicas desacopladas (app.core.engine.rules.lgg_rules).
    """
    from app.core.engine.context import ValidationContext
    from app.core.engine.rules.lgg_rules import (
        LGG_MandatoryFieldsRule,
        LGG_CatalogsAndFormatsRule,
        LGG_PhysicalAndGeometricRule,
        LGG_FracturesAndFRFRule,
        LGG_GeomechanicalCompatibilityRule
    )

    h_idx, l_map = find_header_row_and_mapping(ws_lgg, LGG_PATTERNS)
    lgg_claves_detectadas = set(l_map.keys())
    fallback_lgg = FALLBACK_LGG_MAP_2026 if is_2026 else FALLBACK_LGG_MAP
    for k, v in fallback_lgg.items():
        if k not in l_map:
            l_map[k] = v

    lgg_extra = [k for k in CAMPOS_EXTRA_A_CAPTURAR["LGG"] if k in lgg_claves_detectadas]

    print(f"[*] Iniciando escaneo de LGG V2. Fila inicial: {h_idx + 1}, Fila máxima: {ws_lgg.max_row}", flush=True)

    lgg_runs = []
    lgg_runs_by_taladro = defaultdict(list)
    if max_lgg is None:
        max_lgg = {}
    unique_lgg_runs = []
    empty_streak = 0
    current_taladro = None
    total_lgg_filas = 0

    for r in range(h_idx + 1, ws_lgg.max_row + 1):
        if r % 500 == 0:
            print(f"  ... [LGG V2] Fila {r} / {ws_lgg.max_row}", flush=True)
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

        if not current_taladro:
            continue

        empty_streak = 0
        total_lgg_filas += 1
        taladro = current_taladro
        corrida_num = safe_int(row_dict.get("corrida", 0))
        camp = sanitize_val(row_dict.get("campana"), int)
        geo = sanitize_val(row_dict.get("geologo"), str)
        celda_padre = taladro
        celda_hija = f"{taladro}-C{corrida_num}"

        if camp and filas_por_campana is not None:
            filas_por_campana[str(camp)] = filas_por_campana.get(str(camp), 0) + 1
        if geo and filas_por_geotecnico is not None:
            filas_por_geotecnico[geo] = filas_por_geotecnico.get(geo, 0) + 1

        if celda_padre not in resumen_celdas:
            resumen_celdas[celda_padre] = {
                "total_hijas": 0, "vacios": 0, "advertencias": 0, "alertas": 0,
                "estado_celda": "OK", "dist_celda": 0.0, "campania": str(camp) if camp else "N/A"
            }

        resumen_celdas[celda_padre]["total_hijas"] += 1

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
        jrc10 = safe_int(sanitize_val(row_dict.get("jrc10"), int))

        raw_resistencia = row_dict.get("resistencia")
        resistencia_can = get_canonical_value(raw_resistencia, VALID_STRENGTHS)
        resistencia = resistencia_can or "R4"

        raw_intemperismo = row_dict.get("intemperismo")
        intemperismo_can = get_canonical_value(raw_intemperismo, VALID_WEATHERING)
        weathering = intemperismo_can or "UWF"

        raw_relleno1 = row_dict.get("relleno1")
        relleno1 = get_canonical_value(raw_relleno1, VALID_RELLENO)

        tipo_est1_raw = safe_str(sanitize_val(row_dict.get("tipo_est1"), str))
        tipo_est1_can = get_canonical_value(tipo_est1_raw, VALID_STRUCTURES)
        tipo_est1 = "JN" if tipo_est1_raw.upper() == "J" else (tipo_est1_can or "JN")

        tipo_est2_raw = safe_str(sanitize_val(row_dict.get("tipo_est2"), str))
        tipo_est2_can = get_canonical_value(tipo_est2_raw, VALID_STRUCTURES)
        tipo_est2 = tipo_est2_can or ""

        if a is not None:
            max_lgg[taladro] = max(max_lgg.get(taladro, 0.0), a)
            resumen_celdas[celda_padre]["dist_celda"] = max(resumen_celdas[celda_padre]["dist_celda"], a)

        capturar_faltantes_extra(collector, "LGG", row_dict, lgg_extra, r, celda_padre, celda_hija, camp, geo)

        frf_val = sanitize_val(row_dict.get("frf"), int) if "frf" in l_map else None

        lgg_run_entry = {
            "_fila_excel": r,
            "_celda_padre": celda_padre,
            "_celda_hija": celda_hija,
            "_raw_dict": row_dict,
            "taladro": taladro, "de": de, "a": a, "corrida": corrida_num,
            "resistencia": resistencia,
            "lito1": safe_str(row_dict.get("lito1")),
            "lito2": safe_str(row_dict.get("lito2")),
            "lito3": safe_str(row_dict.get("lito3")),
            "rec_m": rec_m,
            "rqd_m": rqd_m,
            "lrf_m": lrf_m,
            "small_frag_m": small_frag_m,
            "frac_nat": frac_nat,
            "frac_buz30": b30,
            "frac_buz60": b60,
            "frac_buz90": b90,
            "frf": frf_val,
            "abertura": abertura,
            "rugosidad": row_dict.get("rugosidad"),
            "jrc10": jrc10,
            "intemperismo": weathering,
            "relleno1": relleno1,
            "espesor": espesor,
            "tipo_est1": tipo_est1,
            "tipo_est2": tipo_est2,
            "linea_orientacion": str(row_dict.get("linea_orientacion")).strip().upper() if row_dict.get("linea_orientacion") else None,
            "proyecto": safe_str(row_dict.get("proyecto")),
            "campana": camp,
            "geologo": geo
        }
        lgg_runs.append(lgg_run_entry)
        lgg_runs_by_taladro[taladro].append(lgg_run_entry)

    # --- EVALUACIÓN DE REGLAS LGG DESACOPLADAS ---
    ctx = ValidationContext(
        lgg_runs=lgg_runs,
        lgg_by_taladro=lgg_runs_by_taladro,
        is_2026=is_2026,
        metadata={"lgg_columns": set(l_map.keys()), "skip_lgg_max_advance": True}
    )

    rows_with_alert = set()
    lgg_rules = [
        LGG_MandatoryFieldsRule(),
        LGG_CatalogsAndFormatsRule(),
        LGG_PhysicalAndGeometricRule(),
        LGG_FracturesAndFRFRule(),
        LGG_GeomechanicalCompatibilityRule()
    ]

    for rule in lgg_rules:
        anomalies = rule.evaluate(ctx)
        for anom in anomalies:
            incidencias.append({
                "fila_excel": anom.row_excel,
                "celda_padre": anom.celda_padre,
                "celda_hija": anom.celda_hija,
                "columna": anom.columna,
                "valor_actual": anom.valor_actual,
                "tipo_incidencia": anom.severity.value,
                "mensaje": anom.mensaje,
                "campania": safe_str(anom.campania) or "N/A",
                "geotecnico": safe_str(anom.geotecnico) or "N/A",
                "sector_geotecnico": safe_str(anom.sector_geotecnico) or "N/A",
                "modulo": anom.modulo
            })
            sev_val = anom.severity.value
            if sev_val == "VACIO":
                l_counters["total_vacios"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["vacios"] += 1
            elif sev_val == "SIN_INFORMACION":
                l_counters["total_sin_informacion"] += 1
                if anom.celda_padre in resumen_celdas:
                    if "sin_informacion" not in resumen_celdas[anom.celda_padre]:
                        resumen_celdas[anom.celda_padre]["sin_informacion"] = 0
                    resumen_celdas[anom.celda_padre]["sin_informacion"] += 1
            elif sev_val == "ADVERTENCIA":
                l_counters["total_advertencias"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["advertencias"] += 1
            elif sev_val == "ALERTA":
                l_counters["total_alertas"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["alertas"] += 1
                if anom.row_excel > 0:
                    rows_with_alert.add(anom.row_excel)

    l_counters["total_ok"] += (total_lgg_filas - len(rows_with_alert))

    for run in lgg_runs:
        r = run["_fila_excel"]
        has_err = r in rows_with_alert
        de_val = run.get("de")
        a_val = run.get("a")
        c_num = run.get("corrida")
        unique_lgg_runs.append({
            "fila_excel": r,
            "taladro": run.get("taladro"),
            "de": de_val,
            "a": a_val,
            "corrida": f"{de_val:.2f} - {a_val:.2f}" if (de_val is not None and a_val is not None) else f"C{c_num}",
            "longitud": round(a_val - de_val, 2) if (de_val is not None and a_val is not None) else 0.0,
            "rec_m": run.get("rec_m"),
            "rqd_m": run.get("rqd_m"),
            "lito1": run.get("lito1"),
            "lito2": run.get("lito2"),
            "lito3": run.get("lito3"),
            "resistencia": run.get("resistencia"),
            "estado": "NO CONFORME" if has_err else "CONFORME"
        })

    return total_lgg_filas, lgg_runs, lgg_runs_by_taladro, max_lgg, unique_lgg_runs


def validate_est_sheet_data(
    ws_est,
    is_2026: bool,
    lgg_runs: list,
    lgg_runs_by_taladro: dict,
    max_lgg: dict,
    resumen_celdas: dict,
    incidencias: list,
    e_counters: dict,
    collector: FaltantesCollector = None,
    max_est: dict = None
):
    """
    Escanea la hoja Estructural, extrae estructuras y evalúa las reglas geomecánicas desacopladas (app.core.engine.rules.est_rules).
    """
    from app.core.engine.context import ValidationContext
    from app.core.engine.rules.est_rules import (
        Estructural_MandatoryFieldsRule,
        Estructural_GeometryAndAnglesRule,
        Estructural_SpatialContainmentRule,
        Estructural_CrossCheckWithLGGRule
    )

    h_idx, e_map = find_header_row_and_mapping(ws_est, EST_PATTERNS)
    est_claves_detectadas = set(e_map.keys())
    fallback_est = FALLBACK_EST_MAP_2026 if is_2026 else FALLBACK_EST_MAP
    for k, v in fallback_est.items():
        if k not in e_map:
            e_map[k] = v

    est_extra = [k for k in CAMPOS_EXTRA_A_CAPTURAR["Estructural"] if k in est_claves_detectadas]

    print(f"[*] Iniciando escaneo de EST V2. Fila inicial: {h_idx + 1}, Fila máxima: {ws_est.max_row}", flush=True)

    est_structures = []
    est_by_taladro = defaultdict(list)
    if max_est is None:
        max_est = {}
    unique_est_structures = []
    empty_streak = 0
    current_taladro_est = None
    total_est_filas = 0

    for r in range(h_idx + 1, ws_est.max_row + 1):
        if r % 500 == 0:
            print(f"  ... [EST V2] Fila {r} / {ws_est.max_row}", flush=True)
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

        if not current_taladro_est:
            continue

        empty_streak = 0
        total_est_filas += 1
        taladro = current_taladro_est
        celda_padre = taladro
        celda_hija = f"{taladro}-E{r}"

        if celda_padre not in resumen_celdas:
            resumen_celdas[celda_padre] = {
                "total_hijas": 0, "vacios": 0, "advertencias": 0, "alertas": 0,
                "estado_celda": "OK", "dist_celda": 0.0, "campania": "N/A"
            }

        resumen_celdas[celda_padre]["total_hijas"] += 1

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
        tipo_est = safe_str(sanitize_val(row_dict.get("tipo_estructura"), str))

        raw_relleno1 = row_dict.get("relleno1")
        relleno1 = get_canonical_value(raw_relleno1, VALID_RELLENO)

        raw_dureza = sanitize_val(row_dict.get("dureza_pared"), str)
        dureza_pared = get_canonical_value(raw_dureza, VALID_STRENGTHS) if raw_dureza is not None else None

        est_end = est_a if est_a is not None else depth
        if est_end is not None:
            max_est[taladro] = max(max_est.get(taladro, 0.0), est_end)

        if camp:
            resumen_celdas[celda_padre]["campania"] = str(camp)

        capturar_faltantes_extra(collector, "Estructural", row_dict, est_extra, r, celda_padre, celda_hija, camp, geo)

        est_entry = {
            "_fila_excel": r,
            "_celda_padre": celda_padre,
            "_celda_hija": celda_hija,
            "_raw_dict": row_dict,
            "taladro": taladro,
            "profundidad": depth,
            "de": est_de,
            "a": est_a,
            "alfa": alfa,
            "beta": beta,
            "dip": dip,
            "azimuth": azimuth,
            "abertura": abertura,
            "espesor": espesor,
            "jrc10": jrc10,
            "forma": raw_forma,
            "tipo_estructura": tipo_est,
            "relleno1": relleno1,
            "dureza_pared": dureza_pared,
            "campana": camp,
            "geotecnico": geo,
            "corrida": row_dict.get("corrida"),
            "corrida_avance": row_dict.get("corrida_avance"),
            "lito1": safe_str(row_dict.get("lito1")),
            "lito2": safe_str(row_dict.get("lito2")),
            "lito3": safe_str(row_dict.get("lito3")),
        }
        est_structures.append(est_entry)
        est_by_taladro[taladro].append(est_entry)

    # --- EVALUACIÓN DE REGLAS ESTRUCTURAL DESACOPLADAS ---
    ctx = ValidationContext(
        lgg_runs=lgg_runs,
        lgg_by_taladro=lgg_runs_by_taladro,
        est_structures=est_structures,
        est_by_taladro=est_by_taladro,
        is_2026=is_2026,
        metadata={"est_columns": set(e_map.keys()), "max_lgg": max_lgg}
    )

    rows_with_alert = set()
    est_rules = [
        Estructural_MandatoryFieldsRule(),
        Estructural_GeometryAndAnglesRule(),
        Estructural_SpatialContainmentRule(),
        Estructural_CrossCheckWithLGGRule()
    ]

    for rule in est_rules:
        anomalies = rule.evaluate(ctx)
        for anom in anomalies:
            incidencias.append({
                "fila_excel": anom.row_excel,
                "celda_padre": anom.celda_padre,
                "celda_hija": anom.celda_hija,
                "columna": anom.columna,
                "valor_actual": anom.valor_actual,
                "tipo_incidencia": anom.severity.value,
                "mensaje": anom.mensaje,
                "campania": safe_str(anom.campania) or "N/A",
                "geotecnico": safe_str(anom.geotecnico) or "N/A",
                "sector_geotecnico": safe_str(anom.sector_geotecnico) or "N/A",
                "modulo": anom.modulo
            })
            sev_val = anom.severity.value
            if sev_val == "VACIO":
                e_counters["total_vacios"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["vacios"] += 1
            elif sev_val == "SIN_INFORMACION":
                e_counters["total_sin_informacion"] += 1
                if anom.celda_padre in resumen_celdas:
                    if "sin_informacion" not in resumen_celdas[anom.celda_padre]:
                        resumen_celdas[anom.celda_padre]["sin_informacion"] = 0
                    resumen_celdas[anom.celda_padre]["sin_informacion"] += 1
            elif sev_val == "ADVERTENCIA":
                e_counters["total_advertencias"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["advertencias"] += 1
            elif sev_val == "ALERTA":
                e_counters["total_alertas"] += 1
                if anom.celda_padre in resumen_celdas:
                    resumen_celdas[anom.celda_padre]["alertas"] += 1
                if anom.row_excel > 0:
                    rows_with_alert.add(anom.row_excel)

    e_counters["total_ok"] += (total_est_filas - len(rows_with_alert))

    for s in est_structures:
        r = s["_fila_excel"]
        has_err = r in rows_with_alert
        est_de = s.get("de")
        est_a = s.get("a")
        unique_est_structures.append({
            "fila_excel": r,
            "taladro": s.get("taladro"),
            "de": est_de,
            "a": est_a,
            "profundidad": s.get("profundidad"),
            "corrida": f"{est_de:.2f} - {est_a:.2f}" if (est_de is not None and est_a is not None) else (f"C{s.get('corrida')}" if s.get("corrida") else "N/A"),
            "tipo_est": s.get("tipo_estructura"),
            "alfa": s.get("alfa"),
            "beta": s.get("beta"),
            "dip": s.get("dip") if not is_2026 else None,
            "azimuth": s.get("azimuth") if not is_2026 else None,
            "abertura": s.get("abertura"),
            "espesor": s.get("espesor"),
            "relleno": s.get("relleno1"),
            "dureza_pared": s.get("dureza_pared"),
            "lito1": s.get("lito1"),
            "lito2": s.get("lito2") if not is_2026 else None,
            "lito3": s.get("lito3") if not is_2026 else None,
            "estado": "NO CONFORME" if has_err else "CONFORME"
        })

    return total_est_filas, unique_est_structures, max_est


def validate_logueo_bulk_sheets(file_path: str, lgg_sheet: str, est_sheet: str, output_json_path: str, formato: str = "auto"):
    """
    Función de compatibilidad unificada que delega la ejecución de archivo único al motor V2.
    """
    file_paths = {"lgg_est": file_path}
    config = {
        "formato": formato,
        "lgg": {"sheet": lgg_sheet},
        "est": {"sheet": est_sheet}
    }
    return validate_revision_bulk_v2(file_paths, config, output_json_path)


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
    lgg_runs_by_taladro = defaultdict(list)
    unique_lgg_runs = []
    unique_est_structures = []
    total_lgg_filas = 0
    total_est_filas = 0
    
    total_vacios = 0
    total_sin_informacion = 0
    total_advertencias = 0
    total_alertas = 0
    total_ok = 0

    resumen_celdas = {} 
    filas_por_campana = {}
    filas_por_geotecnico = {}
    last_a_by_taladro = {}

    collector = FaltantesCollector()

    max_lgg = {}
    max_est = {}
    eoh_collar = {}
    max_survey = {}

    conf_lgg = config.get("lgg")
    conf_est = config.get("est")

    # Determinar formato: si viene explícito en config desde la UI, respetar la decisión del usuario
    formato_param = config.get("formato", "auto")
    if formato_param == "2026":
        is_2026 = True
    elif formato_param == "tradicional":
        is_2026 = False
    else:
        # Fallback de autodetección solo si se seleccionó "auto" o no se especificó
        is_2026 = False
        if conf_lgg and conf_lgg.get("sheet") in wb_main.sheetnames:
            _, l_map_pre = find_header_row_and_mapping(wb_main[conf_lgg["sheet"]], LGG_PATTERNS)
            if "perf" in l_map_pre or "sum_frags_total" in l_map_pre or "linea_orientacion" in l_map_pre:
                is_2026 = True
        if not is_2026 and conf_est and conf_est.get("sheet") in wb_main.sheetnames:
            _, e_map_pre = find_header_row_and_mapping(wb_main[conf_est["sheet"]], EST_PATTERNS)
            if "corrida_avance" in e_map_pre or ("dip" not in e_map_pre and "azimuth" not in e_map_pre and "alfa" in e_map_pre):
                is_2026 = True


    # --- 1. PROCESAR LGG (MOTOR DESACOPLADO) ---
    ws_lgg = get_sheet_safe(wb_main, conf_lgg.get("sheet") if conf_lgg else None, ["lgg", "general"])
    if ws_lgg:
        l_counters = {"total_ok": 0, "total_vacios": 0, "total_sin_informacion": 0, "total_advertencias": 0, "total_alertas": 0}
        total_lgg_filas, lgg_runs, lgg_runs_by_taladro, max_lgg, unique_lgg_runs = validate_lgg_sheet_data(
            ws_lgg, is_2026, resumen_celdas, incidencias, l_counters, collector=collector,
            filas_por_campana=filas_por_campana, filas_por_geotecnico=filas_por_geotecnico, max_lgg=max_lgg
        )
        total_vacios += l_counters["total_vacios"]
        total_sin_informacion += l_counters["total_sin_informacion"]
        total_advertencias += l_counters["total_advertencias"]
        total_alertas += l_counters["total_alertas"]
        total_ok += l_counters["total_ok"]

    # --- 2. PROCESAR ESTRUCTURAL (MOTOR DESACOPLADO) ---
    conf_est = config.get("est")
    ws_est = get_sheet_safe(wb_main, conf_est.get("sheet") if conf_est else None, ["est"])
    if ws_est:
        e_counters = {"total_ok": 0, "total_vacios": 0, "total_sin_informacion": 0, "total_advertencias": 0, "total_alertas": 0}
        total_est_filas, unique_est_structures, max_est = validate_est_sheet_data(
            ws_est, is_2026, lgg_runs, lgg_runs_by_taladro, max_lgg, resumen_celdas, incidencias, e_counters,
            collector=collector, max_est=max_est
        )
        total_vacios += e_counters["total_vacios"]
        total_sin_informacion += e_counters["total_sin_informacion"]
        total_advertencias += e_counters["total_advertencias"]
        total_alertas += e_counters["total_alertas"]
        total_ok += e_counters["total_ok"]

    # --- 2.5. PROCESAR HOJA RMR (SI EXISTE) ---
    conf_rmr = config.get("rmr")
    rmr_hint = conf_rmr.get("sheet") if conf_rmr else None
    ws_rmr = get_sheet_safe(wb_main, rmr_hint, ["rmr", "validacion"]) if (rmr_hint or find_rmr_sheet_name(wb_main.sheetnames)) else None
    total_rmr_filas = 0
    total_sin_informacion = 0
    if ws_rmr:
        custom_rmr_map = conf_rmr.get("mappings") if conf_rmr else None
        r_counters = {"total_ok": 0, "total_vacios": 0, "total_sin_informacion": 0, "total_advertencias": 0, "total_alertas": 0}
        total_rmr_filas = validate_rmr_sheet_data(ws_rmr, lgg_runs, resumen_celdas, incidencias, r_counters, custom_map=custom_rmr_map, collector=collector)
        total_vacios += r_counters["total_vacios"]
        total_sin_informacion += r_counters["total_sin_informacion"]
        total_advertencias += r_counters["total_advertencias"]
        total_alertas += r_counters["total_alertas"]
        total_ok += r_counters["total_ok"]

    # --- 3. PROCESAR COLLAR PARA EOH ---
    conf_col = config.get("collar")
    if wb_col:
        ws_col = get_sheet_safe(wb_col, conf_col.get("sheet") if conf_col else None, ["collar", "hoja1"])
        if ws_col:
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
    if wb_sur:
        ws_sur = get_sheet_safe(wb_sur, conf_sur.get("sheet") if conf_sur else None, ["survey", "trayectoria", "hoja1"])
        if ws_sur:
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
        elif data["vacios"] > 0 or data.get("sin_informacion", 0) > 0 or data["advertencias"] > 0: data["estado_celda"] = "ADVERTENCIA"
        else:
            data["estado_celda"] = "OK"
            total_celdas_ok += 1

    total_filas = total_lgg_filas + total_est_filas + total_rmr_filas
    total_campos = total_filas * 20

    output_json = {
        "total_filas_procesadas": total_filas,
        "total_celdas_evaluadas": total_campos,
        "metricas_globales": {
            "total_celdas_padre": len(resumen_celdas),
            "total_celdas_hija_procesadas": total_filas,
            "total_ok": total_ok,
            "total_vacios": total_vacios,
            "total_sin_informacion": total_sin_informacion,
            "total_advertencias": total_advertencias,
            "total_alertas": total_alertas,
            "total_celdas_ok": total_celdas_ok
        },
        "distribucion_filas_campana": filas_por_campana,
        "distribucion_geotecnico": filas_por_geotecnico,
        "formato_evaluado": "2026" if is_2026 else "tradicional",
        "incidencias": incidencias,
        "resumen_por_celda_padre": resumen_celdas,
        "faltantes_no_obligatorios": collector.dump(),
        "unique_lgg_runs": unique_lgg_runs,
        "unique_est_structures": unique_est_structures
    }

    tmp_path = output_json_path + ".tmp"
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(output_json, f, ensure_ascii=False)
    os.replace(tmp_path, output_json_path)

    if wb_col: wb_col.close()
    if wb_sur: wb_sur.close()