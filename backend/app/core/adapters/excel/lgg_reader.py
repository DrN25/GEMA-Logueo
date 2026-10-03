"""
app.core.adapters.excel.lgg_reader
Extractor y adaptador de datos de la hoja Logueo General (LGG) en libros Excel Openpyxl.
"""

from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple, Set
from app.core.report_config import CAMPOS_EXTRA_A_CAPTURAR
from app.core.engine.rules.common import (
    VALID_STRUCTURES, VALID_STRENGTHS, VALID_WEATHERING, VALID_RELLENO,
    get_canonical_value, sanitize_val, safe_str, safe_int, safe_float
)
from app.core.adapters.excel.patterns import LGG_PATTERNS, FALLBACK_LGG_MAP, FALLBACK_LGG_MAP_2026
from app.core.adapters.excel.helpers import (
    find_header_row_and_mapping, get_row_dict, capturar_faltantes_extra, FaltantesCollector
)


def read_lgg_sheet(
    ws_lgg,
    is_2026: bool,
    resumen_celdas: Dict[str, Any],
    collector: Optional[FaltantesCollector] = None,
    filas_por_campana: Optional[Dict[str, int]] = None,
    filas_por_geotecnico: Optional[Dict[str, int]] = None,
    max_lgg: Optional[Dict[str, float]] = None
) -> Tuple[int, List[Dict[str, Any]], Dict[str, List[Dict[str, Any]]], Dict[str, float], Dict[str, int]]:
    """
    Escanea la hoja LGG desde Openpyxl, limpia celdas y genera la lista de corridas estructuradas.
    Retorna: (total_filas, lgg_runs, lgg_runs_by_taladro, max_lgg, l_map)
    """
    h_idx, l_map = find_header_row_and_mapping(ws_lgg, LGG_PATTERNS)
    lgg_claves_detectadas = set(l_map.keys())
    fallback_lgg = FALLBACK_LGG_MAP_2026 if is_2026 else FALLBACK_LGG_MAP
    for k, v in fallback_lgg.items():
        if k not in l_map:
            l_map[k] = v

    lgg_extra = [k for k in CAMPOS_EXTRA_A_CAPTURAR.get("LGG", []) if k in lgg_claves_detectadas]

    lgg_runs = []
    lgg_runs_by_taladro = defaultdict(list)
    if max_lgg is None:
        max_lgg = {}
    empty_streak = 0
    current_taladro = None
    total_lgg_filas = 0

    for r in range(h_idx + 1, ws_lgg.max_row + 1):
        row_dict, is_empty = get_row_dict(ws_lgg, r, l_map)

        t_val = row_dict.get("taladro")
        if t_val is not None and str(t_val).strip() != "":
            current_taladro = safe_str(t_val)
        else:
            row_dict["taladro"] = current_taladro

        if is_empty:
            empty_streak += 1
            if empty_streak >= 20:
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

    return total_lgg_filas, lgg_runs, lgg_runs_by_taladro, max_lgg, l_map
