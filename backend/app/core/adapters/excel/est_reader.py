"""
app.core.adapters.excel.est_reader
Extractor y adaptador de datos de la hoja Estructural (EST) en libros Excel Openpyxl.
"""

from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple, Set
from app.core.report_config import CAMPOS_EXTRA_A_CAPTURAR
from app.core.engine.rules.common import (
    VALID_STRENGTHS, VALID_RELLENO,
    get_canonical_value, sanitize_val, safe_str
)
from app.core.adapters.excel.patterns import EST_PATTERNS, FALLBACK_EST_MAP, FALLBACK_EST_MAP_2026
from app.core.adapters.excel.helpers import (
    find_header_row_and_mapping, get_row_dict, capturar_faltantes_extra, FaltantesCollector
)


def read_est_sheet(
    ws_est,
    is_2026: bool,
    resumen_celdas: Dict[str, Any],
    collector: Optional[FaltantesCollector] = None,
    max_est: Optional[Dict[str, float]] = None
) -> Tuple[int, List[Dict[str, Any]], Dict[str, List[Dict[str, Any]]], Dict[str, float], Dict[str, int]]:
    """
    Escanea la hoja Estructural desde Openpyxl, limpia celdas y genera la lista de discontinuidades estructuradas.
    Retorna: (total_filas, est_structures, est_by_taladro, max_est, e_map)
    """
    h_idx, e_map = find_header_row_and_mapping(ws_est, EST_PATTERNS)
    est_claves_detectadas = set(e_map.keys())
    fallback_est = FALLBACK_EST_MAP_2026 if is_2026 else FALLBACK_EST_MAP
    for k, v in fallback_est.items():
        if k not in e_map:
            e_map[k] = v

    est_extra = [k for k in CAMPOS_EXTRA_A_CAPTURAR.get("Estructural", []) if k in est_claves_detectadas]

    est_structures = []
    est_by_taladro = defaultdict(list)
    if max_est is None:
        max_est = {}
    empty_streak = 0
    current_taladro_est = None
    total_est_filas = 0

    for r in range(h_idx + 1, ws_est.max_row + 1):
        row_dict, is_empty = get_row_dict(ws_est, r, e_map)

        t_val = row_dict.get("taladro")
        if t_val is not None and str(t_val).strip() != "":
            current_taladro_est = safe_str(t_val)
        else:
            row_dict["taladro"] = current_taladro_est

        if is_empty:
            empty_streak += 1
            if empty_streak >= 20:
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

    return total_est_filas, est_structures, est_by_taladro, max_est, e_map
