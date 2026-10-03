"""
app.core.adapters.excel.helpers
Funciones auxiliares para inspección, búsqueda de cabeceras, extracción de celdas y captura de faltantes en Openpyxl.
"""

import re
import unicodedata
from typing import Dict, List, Any, Optional, Tuple, Set


def normalize_text(text: Any) -> str:
    """Normalización robusta para mapeo de cabeceras (remueve acentos, espacios y símbolos matemáticos)."""
    if text is None:
        return ""
    s = str(text).lower()
    s = s.replace("≥", "mayorigual").replace("≤", "menorigual")
    s = s.replace(">=", "mayorigual").replace("<=", "menorigual").replace(">", "mayor").replace("<", "menor")
    s = s.replace("∑", "sum").replace("σ", "sum").replace("ς", "sum").replace("Σ", "sum")
    normalized = unicodedata.normalize('NFKD', s).encode('ASCII', 'ignore').decode('utf-8')
    return re.sub(r'[^a-z0-9]', '', normalized).strip()


def get_sheet_safe(wb, sheet_hint: Optional[str] = None, default_keywords: Optional[List[str]] = None):
    """Obtiene una hoja de cálculo sin fallar por discrepancias de mayúsculas, espacios o nombres inexactos."""
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


def find_header_row_and_mapping(sheet, keyword_maps: Dict[str, List[str]]) -> Tuple[int, Dict[str, int]]:
    """Escanea las primeras 20 filas de la hoja buscando la fila con mayor densidad de coincidencias de columnas."""
    best_row = 6
    best_matches = 0
    best_mapping: Dict[str, int] = {}

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


def get_row_dict(ws, row_idx: int, mapping: Dict[str, int]) -> Tuple[Dict[str, Any], bool]:
    """Extrae un diccionario campo -> valor para una fila dada según el mapping de columnas detectado."""
    row_data = {}
    is_empty = True
    for key, col_idx in mapping.items():
        cell_val = ws.cell(row=row_idx, column=col_idx).value
        if cell_val is not None and str(cell_val).strip() != "":
            is_empty = False
        row_data[key] = cell_val
    return row_data, is_empty


class FaltantesCollector:
    """Recolector en memoria para campos no obligatorios faltantes o con código de no información (-1)."""
    def __init__(self):
        self._registros: List[Dict[str, Any]] = []

    def registrar(self, modulo: str, fila_excel: int, celda_padre: str, celda_hija: str,
                  columna: str, valor_raw: Any, campania: Any, geotecnico: Any):
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

    def dump(self) -> List[Dict[str, Any]]:
        return list(self._registros)


def capturar_faltantes_extra(collector: Optional[FaltantesCollector], modulo: str, row_dict: Dict[str, Any],
                             claves: List[str], fila_excel: int, celda_padre: str, celda_hija: str,
                             campania: Any, geotecnico: Any):
    """Registra campos adicionales configurados en CAMPOS_EXTRA_A_CAPTURAR si resultan vacíos."""
    if collector is None:
        return
    for clave in claves:
        if clave not in row_dict:
            continue
        collector.registrar(modulo, fila_excel, celda_padre, celda_hija, clave,
                            row_dict.get(clave), campania, geotecnico)


def find_rmr_sheet_name(sheetnames: List[str]) -> Optional[str]:
    """Detecta de forma heurística la hoja de RMR o Validación geomecánica dentro del libro Excel."""
    keywords = ["rmr", "validacion", "clasificacion", "geomecanica", "bienawski", "resumen_rmr"]
    for s in sheetnames:
        norm = normalize_text(s)
        for kw in keywords:
            if kw in norm:
                return s
    return None
