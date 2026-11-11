"""
app.core.adapters.excel.collar_survey_reader
Extractores y adaptadores de datos para las hojas Collar y Survey en libros Excel Openpyxl.
Soporta mapeo dinámico del Wizard (mappings, headerRowIdx, sheet) y fallback automático a patrones estándar.
Implementa streaming acotado mediante iter_mapped_rows, detección de duplicados discrepantes y gestión de celdas vacías (None).
"""

from typing import Dict, Any, Optional, Tuple, List, Set
from collections import defaultdict
from app.core.engine.rules.common import safe_str
from app.core.adapters.excel.patterns import COLLAR_PATTERNS, SURVEY_PATTERNS
from app.core.adapters.excel.helpers import get_sheet_safe, find_header_row_and_mapping, normalize_text
from app.core.adapters.excel.stream_reader import iter_mapped_rows


def _parse_optional_float(val: Any) -> Optional[float]:
    """Convierte un valor de celda a float o retorna None si está vacío o no es numérico."""
    if val is None:
        return None
    s = str(val).strip().replace(",", ".")
    if not s:
        return None
    try:
        f = float(s)
        return f
    except (ValueError, TypeError):
        return None


def read_collar_sheet(
    wb_col,
    conf_col: Optional[Dict[str, Any]] = None
) -> Tuple[Dict[str, Optional[float]], Dict[str, Any]]:
    """
    Extrae las profundidades finales EOH registradas en la hoja Collar.
    
    Retorna:
        Tuple[Dict[str, Optional[float]], Dict[str, Any]]:
        - data: Diccionario {nombre_taladro: prof_eoh_float_o_None}
        - meta: Metadatos de la lectura (cargado, status, total_taladros, error, warning, sheet_name, duplicates_discrepant, vacios)
    """
    eoh_collar: Dict[str, Optional[float]] = {}
    meta: Dict[str, Any] = {
        "cargado": False,
        "status": "no_cargado",
        "total_taladros": 0,
        "error": None,
        "warning": None,
        "sheet_name": None,
        "duplicates_discrepant": {},
        "vacios": []
    }

    if wb_col is None:
        return eoh_collar, meta

    meta["cargado"] = True
    sheet_name = conf_col.get("sheet") if conf_col else None
    ws_col = None

    if sheet_name:
        if sheet_name in wb_col.sheetnames:
            ws_col = wb_col[sheet_name]
        else:
            hint_norm = normalize_text(sheet_name)
            for s in wb_col.sheetnames:
                if normalize_text(s) == hint_norm:
                    ws_col = wb_col[s]
                    break
        if not ws_col:
            meta["status"] = "error"
            meta["error"] = f"Hoja de Collar '{sheet_name}' no encontrada en el libro Excel. Hojas disponibles: {wb_col.sheetnames}."
            return eoh_collar, meta
    else:
        ws_col = get_sheet_safe(wb_col, None, ["collar", "hoja1"])

    if not ws_col:
        meta["status"] = "error"
        meta["error"] = f"No se pudo encontrar una hoja de Collar válida en el libro Excel. Hojas disponibles: {wb_col.sheetnames}."
        return eoh_collar, meta

    meta["sheet_name"] = ws_col.title

    mappings = conf_col.get("mappings") if conf_col else None
    header_row_idx = conf_col.get("headerRowIdx", 0) if conf_col else 0

    if mappings and isinstance(mappings, dict) and len(mappings) > 0:
        # Modo 1: Mapeo explícito configurado desde el Wizard (índices base 0)
        if "taladro" not in mappings or "eoh" not in mappings:
            meta["status"] = "error"
            meta["error"] = (
                f"El mapeo configurado para Collar no contiene los campos obligatorios requeridos "
                f"('taladro' y 'eoh'). Campos recibidos: {list(mappings.keys())}."
            )
            return eoh_collar, meta

        openpyxl_mapping = {
            "taladro": mappings["taladro"] + 1,
            "eoh": mappings["eoh"] + 1
        }
        start_row = header_row_idx + 2
    else:
        # Modo 2: Fallback automático por heurística de patrones (COLLAR_PATTERNS)
        h_idx, c_map = find_header_row_and_mapping(ws_col, COLLAR_PATTERNS)
        if "taladro" not in c_map or "eoh" not in c_map:
            meta["status"] = "error"
            meta["error"] = (
                f"No se pudieron detectar automáticamente los encabezados estándar de Collar "
                f"('taladro' y 'eoh') en la hoja '{ws_col.title}'. Especifique el mapeo de columnas en el asistente."
            )
            return eoh_collar, meta

        openpyxl_mapping = c_map
        start_row = h_idx + 1

    # Recopilar filas de Collar con iter_mapped_rows en streaming
    collar_entries = defaultdict(list)
    for r, row_dict, _ in iter_mapped_rows(ws_col, start_row, openpyxl_mapping):
        t_val = row_dict.get("taladro")
        if t_val is None or str(t_val).strip() == "":
            continue
        t_str = safe_str(t_val)
        e_val = row_dict.get("eoh")
        e_float = _parse_optional_float(e_val)
        collar_entries[t_str].append((r, e_float, e_val))

    duplicates_discrepant: Dict[str, List[Any]] = {}
    eoh_vacios: Set[str] = set()

    for t_str, entries in collar_entries.items():
        if len(entries) == 1:
            _, val, raw = entries[0]
            if val is None:
                eoh_collar[t_str] = None
                eoh_vacios.add(t_str)
            else:
                eoh_collar[t_str] = val
        else:
            # Taladro duplicado en Collar: evaluar coherencia de valores EOH
            numeric_vals = [e[1] for e in entries if e[1] is not None]
            distinct_numeric = set(numeric_vals)
            if len(distinct_numeric) > 1:
                # D2: Duplicado con EOH distintos -> ALERTA con los valores, sin elegir ninguno; comparación SIN_REFERENCIA
                eoh_collar[t_str] = None
                duplicates_discrepant[t_str] = [e[2] for e in entries]
            elif len(distinct_numeric) == 1:
                # Mismo EOH repetido -> sin alerta, se conserva el valor
                eoh_collar[t_str] = list(distinct_numeric)[0]
            else:
                # Todas las entradas del duplicado están vacías o son no numéricas
                eoh_collar[t_str] = None
                eoh_vacios.add(t_str)

    if len(eoh_collar) == 0:
        meta["status"] = "error"
        meta["error"] = f"La hoja '{ws_col.title}' no contiene registros válidos de Collar."
        return eoh_collar, meta

    meta["status"] = "ok"
    meta["total_taladros"] = len(eoh_collar)
    meta["duplicates_discrepant"] = duplicates_discrepant
    meta["vacios"] = sorted(list(eoh_vacios))
    return eoh_collar, meta


def read_survey_sheet(
    wb_sur,
    conf_sur: Optional[Dict[str, Any]] = None
) -> Tuple[Dict[str, Optional[float]], Dict[str, Any]]:
    """
    Extrae la profundidad máxima registrada en las trayectorias de la hoja Survey.
    
    Retorna:
        Tuple[Dict[str, Optional[float]], Dict[str, Any]]:
        - data: Diccionario {nombre_taladro: max_depth_float_o_None}
        - meta: Metadatos de la lectura (cargado, status, total_taladros, error, warning, sheet_name, vacios)
    """
    max_survey: Dict[str, Optional[float]] = {}
    meta: Dict[str, Any] = {
        "cargado": False,
        "status": "no_cargado",
        "total_taladros": 0,
        "error": None,
        "warning": None,
        "sheet_name": None,
        "vacios": []
    }

    if wb_sur is None:
        return max_survey, meta

    meta["cargado"] = True
    sheet_name = conf_sur.get("sheet") if conf_sur else None
    ws_sur = None

    if sheet_name:
        if sheet_name in wb_sur.sheetnames:
            ws_sur = wb_sur[sheet_name]
        else:
            hint_norm = normalize_text(sheet_name)
            for s in wb_sur.sheetnames:
                if normalize_text(s) == hint_norm:
                    ws_sur = wb_sur[s]
                    break
        if not ws_sur:
            meta["status"] = "error"
            meta["error"] = f"Hoja de Survey '{sheet_name}' no encontrada en el libro Excel. Hojas disponibles: {wb_sur.sheetnames}."
            return max_survey, meta
    else:
        ws_sur = get_sheet_safe(wb_sur, None, ["survey", "trayectoria", "hoja1"])

    if not ws_sur:
        meta["status"] = "error"
        meta["error"] = f"No se pudo encontrar una hoja de Survey válida en el libro Excel. Hojas disponibles: {wb_sur.sheetnames}."
        return max_survey, meta

    meta["sheet_name"] = ws_sur.title

    mappings = conf_sur.get("mappings") if conf_sur else None
    header_row_idx = conf_sur.get("headerRowIdx", 0) if conf_sur else 0

    if mappings and isinstance(mappings, dict) and len(mappings) > 0:
        # Modo 1: Mapeo explícito configurado desde el Wizard (índices base 0)
        if "taladro" not in mappings or "depth" not in mappings:
            meta["status"] = "error"
            meta["error"] = (
                f"El mapeo configurado para Survey no contiene los campos obligatorios requeridos "
                f"('taladro' y 'depth'). Campos recibidos: {list(mappings.keys())}."
            )
            return max_survey, meta

        openpyxl_mapping = {
            "taladro": mappings["taladro"] + 1,
            "depth": mappings["depth"] + 1
        }
        start_row = header_row_idx + 2
    else:
        # Modo 2: Fallback automático por heurística de patrones (SURVEY_PATTERNS)
        h_idx, s_map = find_header_row_and_mapping(ws_sur, SURVEY_PATTERNS)
        if "taladro" not in s_map or "depth" not in s_map:
            meta["status"] = "error"
            meta["error"] = (
                f"No se pudieron detectar automáticamente los encabezados estándar de Survey "
                f"('taladro' y 'depth') en la hoja '{ws_sur.title}'. Especifique el mapeo de columnas en el asistente."
            )
            return max_survey, meta

        openpyxl_mapping = s_map
        start_row = h_idx + 1

    # Recopilar filas de Survey con iter_mapped_rows en streaming
    survey_entries = defaultdict(list)
    for r, row_dict, _ in iter_mapped_rows(ws_sur, start_row, openpyxl_mapping):
        t_val = row_dict.get("taladro")
        if t_val is None or str(t_val).strip() == "":
            continue
        t_str = safe_str(t_val)
        d_val = row_dict.get("depth")
        d_float = _parse_optional_float(d_val)
        survey_entries[t_str].append((r, d_float, d_val))

    survey_vacios: Set[str] = set()

    for t_str, entries in survey_entries.items():
        # D1/D2: Varias filas por taladro es normal -> máximo de las válidas. Filas con depth vacío se ignoran si hay otras válidas.
        valid_depths = [e[1] for e in entries if e[1] is not None]
        if valid_depths:
            max_survey[t_str] = max(valid_depths)
        else:
            # TODAS sus profundidades vacías o no numéricas -> VACÍO
            max_survey[t_str] = None
            survey_vacios.add(t_str)

    if len(max_survey) == 0:
        meta["status"] = "error"
        meta["error"] = f"La hoja '{ws_sur.title}' no contiene registros válidos de Survey."
        return max_survey, meta

    meta["status"] = "ok"
    meta["total_taladros"] = len(max_survey)
    meta["vacios"] = sorted(list(survey_vacios))
    return max_survey, meta