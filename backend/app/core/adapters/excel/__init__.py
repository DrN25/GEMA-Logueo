"""
app.core.adapters.excel
Paquete de adaptadores de lectura, mapeo léxico e ingesta para libros de trabajo Excel.
"""

from app.core.adapters.excel.patterns import (
    LGG_PATTERNS, EST_PATTERNS, RMR_PATTERNS, COLLAR_PATTERNS, SURVEY_PATTERNS,
    FALLBACK_LGG_MAP, FALLBACK_LGG_MAP_2026,
    FALLBACK_EST_MAP, FALLBACK_EST_MAP_2026,
    FALLBACK_RMR_MAP
)
from app.core.adapters.excel.helpers import (
    normalize_text,
    get_sheet_safe,
    find_header_row_and_mapping,
    get_row_dict,
    FaltantesCollector,
    capturar_faltantes_extra,
    find_rmr_sheet_name
)
from app.core.adapters.excel.lgg_reader import read_lgg_sheet
from app.core.adapters.excel.est_reader import read_est_sheet
from app.core.adapters.excel.rmr_reader import read_rmr_sheet
from app.core.adapters.excel.collar_survey_reader import read_collar_sheet, read_survey_sheet

__all__ = [
    "LGG_PATTERNS", "EST_PATTERNS", "RMR_PATTERNS", "COLLAR_PATTERNS", "SURVEY_PATTERNS",
    "FALLBACK_LGG_MAP", "FALLBACK_LGG_MAP_2026",
    "FALLBACK_EST_MAP", "FALLBACK_EST_MAP_2026",
    "FALLBACK_RMR_MAP",
    "normalize_text", "get_sheet_safe", "find_header_row_and_mapping", "get_row_dict",
    "FaltantesCollector", "capturar_faltantes_extra", "find_rmr_sheet_name",
    "read_lgg_sheet", "read_est_sheet", "read_rmr_sheet", "read_collar_sheet", "read_survey_sheet"
]
