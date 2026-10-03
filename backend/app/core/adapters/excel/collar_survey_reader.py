"""
app.core.adapters.excel.collar_survey_reader
Extractores y adaptadores de datos para las hojas Collar y Survey en libros Excel Openpyxl.
"""

from typing import Dict, Any, Optional
from app.core.engine.rules.common import sanitize_val, safe_str, safe_float
from app.core.adapters.excel.patterns import COLLAR_PATTERNS, SURVEY_PATTERNS
from app.core.adapters.excel.helpers import get_sheet_safe, find_header_row_and_mapping, get_row_dict


def read_collar_sheet(wb_col, conf_col: Optional[Dict[str, Any]] = None) -> Dict[str, float]:
    """Extrae las profundidades finales EOH registradas en la hoja Collar."""
    eoh_collar: Dict[str, float] = {}
    if not wb_col:
        return eoh_collar

    ws_col = get_sheet_safe(wb_col, conf_col.get("sheet") if conf_col else None, ["collar", "hoja1"])
    if not ws_col:
        return eoh_collar

    h_idx, c_map = find_header_row_and_mapping(ws_col, COLLAR_PATTERNS)
    for r in range(h_idx + 1, ws_col.max_row + 1):
        row_dict, _ = get_row_dict(ws_col, r, c_map)
        t_val = row_dict.get("taladro")
        e_val = row_dict.get("eoh")
        if not t_val:
            continue
        t_str = safe_str(t_val)
        e_float = safe_float(sanitize_val(e_val, float))
        eoh_collar[t_str] = e_float

    return eoh_collar


def read_survey_sheet(wb_sur, conf_sur: Optional[Dict[str, Any]] = None) -> Dict[str, float]:
    """Extrae la máxima profundidad alcanzada por trayectoria en la hoja Survey."""
    max_survey: Dict[str, float] = {}
    if not wb_sur:
        return max_survey

    ws_sur = get_sheet_safe(wb_sur, conf_sur.get("sheet") if conf_sur else None, ["survey", "trayectoria", "hoja1"])
    if not ws_sur:
        return max_survey

    h_idx, s_map = find_header_row_and_mapping(ws_sur, SURVEY_PATTERNS)
    for r in range(h_idx + 1, ws_sur.max_row + 1):
        row_dict, _ = get_row_dict(ws_sur, r, s_map)
        t_val = row_dict.get("taladro")
        d_val = row_dict.get("depth")
        if not t_val:
            continue
        t_str = safe_str(t_val)
        d_float = safe_float(sanitize_val(d_val, float))
        max_survey[t_str] = max(max_survey.get(t_str, 0.0), d_float)

    return max_survey
