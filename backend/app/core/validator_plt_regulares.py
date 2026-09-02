"""
validator_plt_regulares.py — Motor de Auditoría y Validación QA/QC para Ensayos PLT Regulares (DDH).
Ejecuta la validación fila a fila según el catálogo oficial de reglas (reglas_plt_regulares.md).
"""

from collections import defaultdict
from datetime import datetime, date
import math
import unicodedata
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple

from app.core.rules_plt_regulares import (
    CATEGORIES_REGISTRY_PLT_REGULARES,
    NOMINAL_DIAMETERS,
    VALID_ENSAYO_TYPES,
    VALID_NOMINATIONS,
    VALID_FRACTURE_TYPES,
    VALID_ROTURA_DIRECTIONS,
    VALID_GEOLOGIC_GROUPS,
    ISRM_SCALE,
    OFFICIAL_34_COLUMNS,
    MANDATORY_PLT_COLUMNS,
)


def strip_accents(s: str) -> str:
    """Elimina tildes y diacríticos de un string."""
    if not s:
        return ""
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def clean_str(val: Any) -> str:
    """Limpia cadenas, elimina caracteres invisibles y espacios en blanco."""
    if val is None or pd.isna(val):
        return ""
    s = str(val).strip()
    if s.lower() in ("nan", "none", "null", "#value!", "#ref!", "#div/0!"):
        return ""
    return s


def is_valid_caja(val: Any) -> bool:
    """Valida si el valor de Nro Caja es un número entero positivo o un rango válido (ej. 34-35, 34 - 35, 34/35)."""
    if val is None:
        return False
    s = str(val).strip()
    if not s or s.lower() in ("nan", "none", "null", ""):
        return False
    try:
        f = float(s)
        return f > 0
    except ValueError:
        pass
    # Rangos como 34-35, 34 - 35, 34/35, 34 a 35, 34_35
    s_clean = s.replace(" a ", "-").replace(" A ", "-").replace("/", "-").replace("_", "-")
    parts = s_clean.split("-")
    if len(parts) == 2:
        try:
            v1 = float(parts[0].strip())
            v2 = float(parts[1].strip())
            return v1 > 0 and v2 >= v1
        except ValueError:
            pass
    return False


def to_float(val: Any) -> Optional[float]:
    """Convierte un valor a float si es numérico válido, o None."""
    if val is None or pd.isna(val):
        return None
    s = str(val).strip().replace(",", ".")
    if s in ("", "-", "N/A", "NA", "null", "None"):
        return None
    try:
        f = float(s)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def to_int(val: Any) -> Optional[int]:
    """Convierte un valor a entero seguro."""
    f = to_float(val)
    if f is None:
        return None
    return int(round(f))


def parse_date(val: Any) -> Optional[date]:
    """Parsea fechas desde seriales de Excel, objetos datetime o strings."""
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.date()
    if isinstance(val, date):
        return val
    # Si es número (serial de Excel)
    f = to_float(val)
    if f is not None and f > 20000:
        try:
            return pd.to_datetime(f, unit="D", origin="1899-12-30").date()
        except Exception:
            pass
    # Si es string
    s = clean_str(val)
    if not s:
        return None
    formats = [
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y",
        "%Y/%m/%d", "%d.%m.%Y", "%Y.%m.%d", "%d/%m/%y", "%m/%d/%y"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def get_isrm_grade(ucs: float) -> str:
    """Calcula el índice ISRM a partir del valor de UCS."""
    if ucs is None or ucs < 0:
        return "R0"
    for limit, grade in ISRM_SCALE:
        if ucs <= limit:
            return grade
    return "R6"


class PltRegularesValidator:
    """Motor de auditoría para Ensayos PLT Regulares."""

    def __init__(self, tolerance_is: float = 0.05, tolerance_f: float = 0.02, tolerance_ucs: float = 0.5):
        self.tol_is = tolerance_is
        self.tol_f = tolerance_f
        self.tol_ucs = tolerance_ucs

    def audit_dataframe(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Audita un DataFrame completo de ensayos PLT regulares y genera el diagnóstico estructurado.
        """
        # Normalizar nombres de columnas
        col_map = {}
        for c in df.columns:
            clean_c = str(c).replace("\n", " ").strip()
            col_map[c] = clean_c
        df = df.rename(columns=col_map)

        total_rows = len(df)
        anomalies: List[Dict[str, Any]] = []
        drillhole_stats = defaultdict(lambda: {"total": 0, "alertas": 0, "advertencias": 0, "vacios": 0})
        campaign_stats = defaultdict(lambda: {"total": 0, "alertas": 0, "advertencias": 0, "vacios": 0})
        category_counter = Counter_custom()
        column_error_counter = Counter_custom()
        severity_counter = {"ALERTA": 0, "ADVERTENCIA": 0, "VACIO": 0}

        row_severity_flags = [False] * total_rows  # True si tiene ALERTA o VACIO

        today = datetime.now().date()

        for idx in range(total_rows):
            row = df.iloc[idx]
            excel_row_num = idx + 2  # Considerando fila 1 como encabezado

            # Extraer campos clave
            campana_raw = row.get("Campaña")
            fecha_raw = row.get("Fecha")
            taladro_raw = row.get("Taladro")
            muestra_raw = row.get("Nro Muestra")
            caja_raw = row.get("Nro Caja")

            c_desde_raw = row.get("Corrida Desde (m)")
            c_hasta_raw = row.get("Corrida Hasta (m)")
            from_raw = row.get("From")
            to_raw = row.get("To")
            verif_corrida_raw = row.get("Verif. corrida")
            long_corrida_raw = row.get("Long. de Corrida (m)")

            este_raw = row.get("Este (m)")
            norte_raw = row.get("Norte (m)")
            cota_raw = row.get("Elevación (msnm)")

            long_muestra_raw = row.get("Long. de Muestra (mm)")
            tipo_ensayo_raw = row.get("Tipo de Ensayo")
            nominacion_raw = row.get("Diametro de Taladro")
            d_raw = row.get("D (mm)")
            verif_long_raw = row.get("Verif. de longitud")

            lito1_raw = row.get("Litologia 1")
            lito2_raw = row.get("Litologia 2")
            lito3_raw = row.get("Litologia 3")
            tipo_lito_raw = row.get("Tipo litológico")

            p_raw = row.get("P instr (kN)")
            tipo_rotura_raw = row.get("Tipo de Rotura")
            dir_rotura_raw = row.get("Dirección de rotura")
            ejecutado_raw = row.get("Ejecutado por")

            is_raw = row.get("Is (Mpa)")
            fact_corr_raw = row.get("Fact. Corr")
            is50_raw = row.get("Is(50) (Mpa)")
            factor_k_raw = row.get("Factor K")
            ucs_raw = row.get("UCS")
            isrm_raw = row.get("ISRM Indice R")

            # Limpiezas y conversiones
            taladro_str = clean_str(taladro_raw)
            muestra_str = clean_str(muestra_raw)
            campana_int = to_int(campana_raw)
            campana_key = str(campana_int) if campana_int else (clean_str(campana_raw) or "S/C")
            taladro_key = taladro_str or "S/T"

            drillhole_stats[taladro_key]["total"] += 1
            campaign_stats[campana_key]["total"] += 1

            # Función auxiliar para registrar anomalías
            def add_anomaly(col_name: str, cat_code: str, message: str, sev_override: Optional[str] = None):
                cat = CATEGORIES_REGISTRY_PLT_REGULARES.get(cat_code)
                sev = sev_override or (cat.severity if cat else "ALERTA")
                cat_name = cat.name if cat else cat_code
                
                anomalies.append({
                    "row_index": excel_row_num,
                    "campana": campana_key,
                    "taladro": taladro_key,
                    "muestra": muestra_str or f"Fila_{excel_row_num}",
                    "from_m": to_float(from_raw),
                    "to_m": to_float(to_raw),
                    "columna": col_name,
                    "category_code": cat_code,
                    "category_name": cat_name,
                    "severity": sev,
                    "message": message
                })
                category_counter[cat_code] += 1
                column_error_counter[col_name] += 1
                severity_counter[sev] += 1
                if sev in ("ALERTA", "VACIO"):
                    row_severity_flags[idx] = True
                    drillhole_stats[taladro_key]["alertas" if sev == "ALERTA" else "vacios"] += 1
                    campaign_stats[campana_key]["alertas" if sev == "ALERTA" else "vacios"] += 1
                else:
                    drillhole_stats[taladro_key]["advertencias"] += 1
                    campaign_stats[campana_key]["advertencias"] += 1

            # -------------------------------------------------------------
            # VALIDACIONES GRUPO 1: IDENTIFICACIÓN
            # -------------------------------------------------------------
            if campana_raw is None or clean_str(campana_raw) == "":
                add_anomaly("Campaña", "CAT_CAMPO_OBLIGATORIO_VACIO", "El campo Campaña es obligatorio y se encuentra vacío.")
            elif campana_int is None or not (2000 <= campana_int <= 2035):
                add_anomaly("Campaña", "CAT_PLT_CAMPANA_INVALIDA", f"Año de campaña '{campana_raw}' no es válido (debe ser entre 2000 y 2035).")

            fecha_dt = parse_date(fecha_raw)
            if fecha_raw is None or clean_str(fecha_raw) == "":
                add_anomaly("Fecha", "CAT_CAMPO_OBLIGATORIO_VACIO", "El campo Fecha es obligatorio y se encuentra vacío.")
            elif fecha_dt is None:
                add_anomaly("Fecha", "CAT_PLT_FECHA_INVALIDA", f"Formato de fecha '{fecha_raw}' no es reconocible o es inválido.")
            elif fecha_dt > today:
                add_anomaly("Fecha", "CAT_PLT_FECHA_FUTURA", f"La fecha '{fecha_dt}' es posterior a la fecha actual del sistema.")

            if not taladro_str:
                add_anomaly("Taladro", "CAT_CAMPO_OBLIGATORIO_VACIO", "El código del Taladro es obligatorio y se encuentra vacío.")

            if not muestra_str:
                add_anomaly("Nro Muestra", "CAT_CAMPO_OBLIGATORIO_VACIO", "El Nro de Muestra es obligatorio y se encuentra vacío.")

            caja_clean = clean_str(caja_raw)
            if not caja_clean:
                add_anomaly("Nro Caja", "CAT_CAMPO_OBLIGATORIO_VACIO", "El campo Nro Caja es obligatorio y se encuentra vacío.")
            elif not is_valid_caja(caja_raw):
                add_anomaly("Nro Caja", "CAT_PLT_CAJA_INVALIDA", f"Nro de Caja '{caja_raw}' no es válido (debe ser un entero positivo o un rango como '34-35').")

            # -------------------------------------------------------------
            # VALIDACIONES GRUPO 2: CORRIDAS Y TRAMOS
            # -------------------------------------------------------------
            c_desde_f = to_float(c_desde_raw)
            c_hasta_f = to_float(c_hasta_raw)
            from_f = to_float(from_raw)
            to_f = to_float(to_raw)

            if c_desde_raw is None or clean_str(c_desde_raw) == "":
                add_anomaly("Corrida Desde (m)", "CAT_CAMPO_OBLIGATORIO_VACIO", "El campo Corrida Desde es obligatorio y se encuentra vacío.")
            elif c_desde_f is None or c_desde_f < 0:
                add_anomaly("Corrida Desde (m)", "CAT_PLT_CORRIDA_INCONGRUENTE", f"Corrida Desde ({c_desde_raw}) no puede ser un valor negativo.")

            if c_hasta_raw is None or clean_str(c_hasta_raw) == "":
                add_anomaly("Corrida Hasta (m)", "CAT_CAMPO_OBLIGATORIO_VACIO", "El campo Corrida Hasta es obligatorio y se encuentra vacío.")
            elif c_hasta_f is None or (c_desde_f is not None and c_hasta_f <= c_desde_f):
                add_anomaly("Corrida Hasta (m)", "CAT_PLT_CORRIDA_INCONGRUENTE", f"Corrida Hasta ({c_hasta_raw}) debe ser estrictamente mayor a Corrida Desde ({c_desde_raw}).")

            if from_raw is None or clean_str(from_raw) == "":
                add_anomaly("From", "CAT_CAMPO_OBLIGATORIO_VACIO", "El campo From es obligatorio y se encuentra vacío.")
            elif from_f is None or from_f < 0:
                add_anomaly("From", "CAT_PLT_TRAMO_MUESTRA_INCONGRUENTE", f"From ({from_raw}) no puede ser un valor negativo.")

            if to_raw is None or clean_str(to_raw) == "":
                add_anomaly("To", "CAT_CAMPO_OBLIGATORIO_VACIO", "El campo To es obligatorio y se encuentra vacío.")
            elif to_f is None or (from_f is not None and to_f <= from_f):
                add_anomaly("To", "CAT_PLT_TRAMO_MUESTRA_INCONGRUENTE", f"To ({to_raw}) debe ser estrictamente mayor a From ({from_raw}).")

            # Verificación geométrica de contención de muestra en corrida
            if c_desde_f is not None and c_hasta_f is not None and from_f is not None and to_f is not None:
                is_contained = (from_f >= c_desde_f - 0.01) and (to_f <= c_hasta_f + 0.01)
                if not is_contained:
                    add_anomaly("Verif. corrida", "CAT_PLT_MUESTRA_FUERA_CORRIDA",
                                f"La muestra [{from_f:.2f}, {to_f:.2f}] excede los límites de la corrida [{c_desde_f:.2f}, {c_hasta_f:.2f}].")

                expected_verif = "OK" if is_contained else "ERROR"
                verif_c_str = clean_str(verif_corrida_raw).upper()
                if verif_corrida_raw is None or verif_c_str == "":
                    add_anomaly("Verif. corrida", "CAT_CAMPO_OBLIGATORIO_VACIO", "El campo Verif. corrida se encuentra vacío.")
                elif verif_c_str not in ("OK", "SI", "SÍ", "ERROR", "NO", "FALSE"):
                    add_anomaly("Verif. corrida", "CAT_PLT_VERIF_CORRIDA_INCONGRUENTE",
                                f"Valor '{verif_corrida_raw}' no coincide con el estado esperado '{expected_verif}'.")

                expected_long_c = c_hasta_f - c_desde_f
                long_c_f = to_float(long_corrida_raw)
                if long_corrida_raw is None or clean_str(long_corrida_raw) == "":
                    add_anomaly("Long. de Corrida (m)", "CAT_CAMPO_OBLIGATORIO_VACIO", "El campo Long. de Corrida se encuentra vacío.")
                elif long_c_f is None or abs(long_c_f - expected_long_c) > 0.02:
                    add_anomaly("Long. de Corrida (m)", "CAT_PLT_LONGITUD_CORRIDA_INCONGRUENTE",
                                f"Longitud reportada ({long_corrida_raw}) difiere de ({c_hasta_f:.2f} - {c_desde_f:.2f} = {expected_long_c:.2f} m).")

            # -------------------------------------------------------------
            # VALIDACIONES GRUPO 3: COORDENADAS
            # -------------------------------------------------------------
            este_f = to_float(este_raw)
            if este_raw is None or clean_str(este_raw) == "":
                add_anomaly("Este (m)", "CAT_CAMPO_OBLIGATORIO_VACIO", "Coordenada Este es obligatoria y se encuentra vacía.")
            elif este_f is None or este_f <= 0:
                add_anomaly("Este (m)", "CAT_PLT_COORD_ESTE_RANGO", f"Coordenada Este ({este_raw}) debe ser un valor positivo mayor a cero.")

            norte_f = to_float(norte_raw)
            if norte_raw is None or clean_str(norte_raw) == "":
                add_anomaly("Norte (m)", "CAT_CAMPO_OBLIGATORIO_VACIO", "Coordenada Norte es obligatoria y se encuentra vacía.")
            elif norte_f is None or norte_f <= 0:
                add_anomaly("Norte (m)", "CAT_PLT_COORD_NORTE_RANGO", f"Coordenada Norte ({norte_raw}) debe ser un valor positivo mayor a cero.")

            cota_f = to_float(cota_raw)
            if cota_raw is None or clean_str(cota_raw) == "":
                add_anomaly("Elevación (msnm)", "CAT_CAMPO_OBLIGATORIO_VACIO", "Cota topográfica Elevación es obligatoria y se encuentra vacía.")
            elif cota_f is None or cota_f <= 0:
                add_anomaly("Elevación (msnm)", "CAT_PLT_ELEVACION_RANGO", f"Elevación ({cota_raw}) debe ser un valor positivo mayor a cero.")

            # -------------------------------------------------------------
            # VALIDACIONES GRUPO 4: GEOMETRÍA DEL TESTIGO
            # -------------------------------------------------------------
            long_m_f = to_float(long_muestra_raw)
            if long_muestra_raw is None or clean_str(long_muestra_raw) == "":
                add_anomaly("Long. de Muestra (mm)", "CAT_CAMPO_OBLIGATORIO_VACIO", "Longitud de muestra es obligatoria y se encuentra vacía.")
            elif long_m_f is None or long_m_f <= 0:
                add_anomaly("Long. de Muestra (mm)", "CAT_PLT_LONGITUD_MUESTRA_RANGO", f"Longitud de muestra ({long_muestra_raw} mm) debe ser mayor a cero.")

            tipo_ensayo_str = clean_str(tipo_ensayo_raw).upper()
            if not tipo_ensayo_str:
                add_anomaly("Tipo de Ensayo", "CAT_CAMPO_OBLIGATORIO_VACIO", "Tipo de Ensayo es obligatorio y se encuentra vacío.")
            elif tipo_ensayo_str not in VALID_ENSAYO_TYPES:
                add_anomaly("Tipo de Ensayo", "CAT_PLT_TIPO_ENSAYO_INVALIDO", f"Tipo de ensayo '{tipo_ensayo_raw}' no es válido (debe ser D, A o B).")

            nom_str = clean_str(nominacion_raw).upper().replace(" ", "")
            if not nom_str:
                add_anomaly("Diametro de Taladro", "CAT_CAMPO_OBLIGATORIO_VACIO", "Diámetro de taladro es obligatorio y se encuentra vacío.")
            elif nom_str not in VALID_NOMINATIONS:
                add_anomaly("Diametro de Taladro", "CAT_PLT_NOMINACION_INVALIDA", f"Nominación de broca '{nominacion_raw}' no pertenece al catálogo (HQ, HQ3, NQ, NQ3, PQ, BQ).")

            d_f = to_float(d_raw)
            if d_raw is None or clean_str(d_raw) == "":
                add_anomaly("D (mm)", "CAT_CAMPO_OBLIGATORIO_VACIO", "Diámetro D (mm) es obligatorio y se encuentra vacío.")
            elif d_f is None or d_f <= 0:
                add_anomaly("D (mm)", "CAT_PLT_DIAMETRO_RANGO", f"Diámetro D ({d_raw} mm) debe ser un valor positivo mayor a cero.")

            if long_m_f is not None and d_f is not None and d_f > 0:
                is_esbelto = long_m_f >= (0.5 * d_f)
                expected_verif_l = "OK" if is_esbelto else "CORTO"
                verif_l_str = clean_str(verif_long_raw).upper()
                if verif_long_raw is None or verif_l_str == "":
                    add_anomaly("Verif. de longitud", "CAT_CAMPO_OBLIGATORIO_VACIO", "El campo Verif. de longitud se encuentra vacío.")
                elif verif_l_str not in ("OK", "SI", "SÍ", "CORTO", "NO", "ERROR"):
                    add_anomaly("Verif. de longitud", "CAT_PLT_VERIF_LONGITUD_INCONGRUENTE",
                                f"Verificación de longitud '{verif_long_raw}' no coincide con el criterio ISRM '{expected_verif_l}'.")

            # -------------------------------------------------------------
            # VALIDACIONES GRUPO 5: LITOLOGÍA
            # -------------------------------------------------------------
            lito1_str = clean_str(lito1_raw)
            if not lito1_str:
                add_anomaly("Litologia 1", "CAT_CAMPO_OBLIGATORIO_VACIO", "Litología 1 es obligatoria y se encuentra vacía.")

            tipo_lito_str = strip_accents(clean_str(tipo_lito_raw).upper())
            if not tipo_lito_str:
                add_anomaly("Tipo litológico", "CAT_CAMPO_OBLIGATORIO_VACIO", "Tipo litológico es obligatorio y se encuentra vacío.")
            elif not any(g in tipo_lito_str for g in ("INTRUSIV", "SEDIMENTAR", "METAMORF", "BRECHA", "SKARN", "ENDO")):
                add_anomaly("Tipo litológico", "CAT_PLT_TIPO_LITOLOGICO_INVALIDO",
                            f"Tipo litológico '{tipo_lito_raw}' no pertenece a los 5 grupos geológicos admitidos.")

            # -------------------------------------------------------------
            # VALIDACIONES GRUPO 6: ENSAYO FÍSICO
            # -------------------------------------------------------------
            p_f = to_float(p_raw)
            if p_raw is None or clean_str(p_raw) == "":
                add_anomaly("P instr (kN)", "CAT_CAMPO_OBLIGATORIO_VACIO", "Fuerza P (kN) es obligatoria y se encuentra vacía.")
            elif p_f is None or p_f <= 0:
                add_anomaly("P instr (kN)", "CAT_PLT_FUERZA_P_RANGO", f"Fuerza P ({p_raw} kN) debe ser un valor positivo mayor a cero.")

            rotura_str = clean_str(tipo_rotura_raw).upper().replace(" ", "")
            if not rotura_str:
                add_anomaly("Tipo de Rotura", "CAT_CAMPO_OBLIGATORIO_VACIO", "Tipo de Rotura es obligatorio y se encuentra vacío.")
            elif rotura_str not in VALID_FRACTURE_TYPES:
                add_anomaly("Tipo de Rotura", "CAT_PLT_TIPO_ROTURA_INVALIDO",
                            f"Tipo de rotura '{tipo_rotura_raw}' no es válido (debe ser M, E o C).")

            dir_str = clean_str(dir_rotura_raw).upper().replace(" ", "")
            if not dir_str:
                # Si es Matriz (M), a menudo no se especifica dirección de rotura (NA implícito)
                if rotura_str == "M":
                    pass
                else:
                    add_anomaly("Dirección de rotura", "CAT_CAMPO_OBLIGATORIO_VACIO", "Dirección de rotura es obligatoria y se encuentra vacía.")
            elif dir_str not in VALID_ROTURA_DIRECTIONS:
                add_anomaly("Dirección de rotura", "CAT_PLT_DIRECCION_ROTURA_INVALIDA",
                            f"Dirección de rotura '{dir_rotura_raw}' no es válida (debe ser Pa, Pe o NA).")

            if not clean_str(ejecutado_raw):
                add_anomaly("Ejecutado por", "CAT_CAMPO_OBLIGATORIO_VACIO", "Campo Ejecutado por es obligatorio y se encuentra vacío.")

            # -------------------------------------------------------------
            # VALIDACIONES GRUPO 7: CÁLCULOS GEOMECÁNICOS NUCLEARES
            # -------------------------------------------------------------
            is_f = to_float(is_raw)
            fact_f = to_float(fact_corr_raw)
            is50_f = to_float(is50_raw)
            k_f = to_float(factor_k_raw)
            ucs_f = to_float(ucs_raw)
            isrm_str = clean_str(isrm_raw).upper()

            # 1. Is (MPa) = (P * 1000) / D^2
            if is_raw is None or clean_str(is_raw) == "":
                add_anomaly("Is (Mpa)", "CAT_CAMPO_OBLIGATORIO_VACIO", "Índice Is (MPa) se encuentra vacío.")
            elif p_f is not None and d_f is not None and d_f > 0:
                calc_is = (p_f * 1000.0) / (d_f ** 2)
                if is_f is None or abs(is_f - calc_is) > self.tol_is:
                    add_anomaly("Is (Mpa)", "CAT_PLT_IS_INCONGRUENTE",
                                f"Is ({is_raw} MPa) difiere de la fórmula ({p_f}*1000 / {d_f}^2 = {calc_is:.2f} MPa).")

            # 2. Fact. Corr = (D / 50)^0.45
            if fact_corr_raw is None or clean_str(fact_corr_raw) == "":
                add_anomaly("Fact. Corr", "CAT_CAMPO_OBLIGATORIO_VACIO", "Factor de corrección se encuentra vacío.")
            elif d_f is not None and d_f > 0:
                calc_f = (d_f / 50.0) ** 0.45
                if fact_f is None or abs(fact_f - calc_f) > self.tol_f:
                    add_anomaly("Fact. Corr", "CAT_PLT_FACTOR_F_INCONGRUENTE",
                                f"Factor F ({fact_corr_raw}) difiere de ({d_f}/50)^0.45 = {calc_f:.3f}.")

            # 3. Is(50) = Is * Fact.Corr
            if is50_raw is None or clean_str(is50_raw) == "":
                add_anomaly("Is(50) (Mpa)", "CAT_CAMPO_OBLIGATORIO_VACIO", "Índice Is(50) (MPa) se encuentra vacío.")
            elif is_f is not None and fact_f is not None:
                calc_is50 = is_f * fact_f
                if is50_f is None or abs(is50_f - calc_is50) > self.tol_is:
                    add_anomaly("Is(50) (Mpa)", "CAT_PLT_IS50_INCONGRUENTE",
                                f"Is(50) ({is50_raw} MPa) difiere de ({is_f:.2f} * {fact_f:.3f} = {calc_is50:.2f} MPa).")

            # 4. Factor K
            if factor_k_raw is None or clean_str(factor_k_raw) == "":
                add_anomaly("Factor K", "CAT_CAMPO_OBLIGATORIO_VACIO", "Factor K se encuentra vacío.")
            elif k_f is None or not (5.0 <= k_f <= 30.0):
                add_anomaly("Factor K", "CAT_PLT_FACTOR_K_RANGO", f"Factor K ({factor_k_raw}) fuera de rango razonable [5.0, 30.0].")

            # 5. UCS = Is(50) * K
            if ucs_raw is None or clean_str(ucs_raw) == "":
                add_anomaly("UCS", "CAT_CAMPO_OBLIGATORIO_VACIO", "UCS se encuentra vacío.")
            elif is50_f is not None and k_f is not None:
                calc_ucs = is50_f * k_f
                if ucs_f is None or abs(ucs_f - calc_ucs) > self.tol_ucs:
                    add_anomaly("UCS", "CAT_PLT_UCS_INCONGRUENTE",
                                f"UCS ({ucs_raw} MPa) difiere de ({is50_f:.2f} * {k_f} = {calc_ucs:.2f} MPa).")

            # 6. ISRM
            if not isrm_str:
                add_anomaly("ISRM Indice R", "CAT_CAMPO_OBLIGATORIO_VACIO", "ISRM Indice R se encuentra vacío.")
            elif ucs_f is not None:
                expected_isrm = get_isrm_grade(ucs_f).upper()
                if isrm_str != expected_isrm:
                    add_anomaly("ISRM Indice R", "CAT_PLT_RESISTENCIA_ISRM_INCONGRUENTE",
                                f"Índice ISRM '{isrm_raw}' no coincide con el rango de UCS={ucs_f:.2f} MPa (esperado: '{expected_isrm}').")

        # Métricas consolidadas
        invalid_count = sum(row_severity_flags)
        valid_count = total_rows - invalid_count
        quality_idx = (valid_count / total_rows * 100.0) if total_rows > 0 else 100.0

        return {
            "total_rows": total_rows,
            "valid_rows": valid_count,
            "invalid_rows": invalid_count,
            "quality_index": round(quality_idx, 2),
            "severity_counts": severity_counter,
            "category_counts": dict(category_counter),
            "column_error_counts": dict(column_error_counter),
            "drillhole_stats": dict(drillhole_stats),
            "campaign_stats": dict(campaign_stats),
            "anomalies": anomalies
        }


class Counter_custom(dict):
    def __missing__(self, key):
        return 0
