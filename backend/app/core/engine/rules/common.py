"""
app.core.engine.rules.common
Funciones utilitarias y catálogos estándar para las reglas del motor geomecánico.
"""

from typing import Any, Optional, Set


VALID_STRUCTURES: Set[str] = {"JN", "F", "RF", "F-10", "SZ", "BED", "VN", "CON", "SE", "F+10", "-1"}
VALID_STRENGTHS: Set[str] = {"R0", "R1", "R2", "R3", "R4", "R5", "R6", "-1"}
VALID_RUGOSITY: Set[str] = {str(x) for x in range(1, 10)}.union({"-1"})
VALID_WEATHERING: Set[str] = {"UWF", "SWD", "MWM", "HWA", "CWC", "RS", "-1"}
VALID_RELLENO: Set[str] = {"ca", "sand", "ch", "cl", "gy", "RXF", "FBX", "GOU", "PAT", "SIO", "QZ", "SU", "OX", "ep", "cwf", "-1"}
VALID_AGUA: Set[str] = {"CDC", "DPH", "WTM", "DGE", "FGF"}
VALID_FORMA: Set[str] = {str(x) for x in range(1, 7)}.union({"-1"})
VALID_ORIENTACION: Set[str] = {"S", "N", "PU", "PT", "PT/PU", "BUENA", "REGULAR", "MALA", "NO APLICA", "NO REGISTRA", "S/O", "-1"}
VALID_TURNOS: Set[str] = {"TD", "TN", "D", "N", "DIA", "NOCHE"}


def safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def safe_int(val: Any, default: int = 0) -> int:
    if val is None:
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


def safe_str(val: Any, default: str = "") -> str:
    if val is None:
        return default
    return str(val).strip()


def sanitize_val(val: Any, target_type: type) -> Optional[Any]:
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
    except (ValueError, TypeError):
        return None


def get_canonical_value(val: Any, valid_set: Set[str]) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    s_lower = s.lower()
    for code in valid_set:
        if code.lower() == s_lower:
            return code
    return None
