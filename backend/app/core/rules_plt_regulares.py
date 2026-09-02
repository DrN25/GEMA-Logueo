"""
rules_plt_regulares.py — Catálogo Oficial de Reglas de Consistencia Geomecánica para Ensayos PLT Regulares (DDH).
Define las categorías canónicas de error, severidades, mapeo de columnas y reglas específicas de validación.
"""

from typing import Dict, List, Set


class RuleCategoryPLT:
    """Categoría canónica mostrada en el Catálogo de Errores del Excel y Dashboard."""
    def __init__(self, code: str, name: str, severity: str):
        self.code = code
        self.name = name
        self.severity = severity  # 'ALERTA', 'ADVERTENCIA', 'VACIO'


class ErrorRulePLT:
    """Regla específica de validación geomecánica."""
    def __init__(self, code: str, category_code: str, columns: List[str], message_template: str):
        self.code = code
        self.category_code = category_code
        self.columns = columns
        self.message_template = message_template

    def format_message(self, **kwargs) -> str:
        try:
            return self.message_template.format(**kwargs)
        except Exception:
            return self.message_template


# ===========================================================================
# 1. CATEGORÍAS CANÓNICAS DE ERROR (SSOT)
# ===========================================================================
CATEGORIES_REGISTRY_PLT_REGULARES: Dict[str, RuleCategoryPLT] = {
    "CAT_CAMPO_OBLIGATORIO_VACIO": RuleCategoryPLT(
        "CAT_CAMPO_OBLIGATORIO_VACIO", "Campo obligatorio se encuentra vacío.", "VACIO"
    ),
    "CAT_PLT_CAMPANA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_CAMPANA_INVALIDA", "Año de campaña no válido (debe ser un año entre 2000 y 2035).", "ALERTA"
    ),
    "CAT_PLT_FECHA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_FECHA_INVALIDA", "Fecha de ensayo con formato no válido o no parseable.", "ALERTA"
    ),
    "CAT_PLT_FECHA_FUTURA": RuleCategoryPLT(
        "CAT_PLT_FECHA_FUTURA", "Fecha de ensayo posterior a la fecha actual del sistema.", "ALERTA"
    ),
    "CAT_PLT_CAJA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_CAJA_INVALIDA", "Nro de caja con formato no válido o menor a 1.", "ALERTA"
    ),
    "CAT_PLT_CORRIDA_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_CORRIDA_INCONGRUENTE", "Corrida Desde es mayor o igual a Corrida Hasta, o posee valores negativos.", "ALERTA"
    ),
    "CAT_PLT_LONGITUD_CORRIDA_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_LONGITUD_CORRIDA_INCONGRUENTE", "Longitud de corrida no coincide con la resta (Corrida Hasta − Corrida Desde).", "ALERTA"
    ),
    "CAT_PLT_TRAMO_MUESTRA_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_TRAMO_MUESTRA_INCONGRUENTE", "Profundidad From es mayor o igual a To, o posee valores negativos.", "ALERTA"
    ),
    "CAT_PLT_MUESTRA_FUERA_CORRIDA": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_FUERA_CORRIDA", "El intervalo de la muestra [From, To] excede los límites de la corrida reportada.", "ALERTA"
    ),
    "CAT_PLT_VERIF_CORRIDA_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_VERIF_CORRIDA_INCONGRUENTE", "Estado de Verif. Corrida no coincide con la contención geométrica real.", "ALERTA"
    ),
    "CAT_PLT_COORD_ESTE_RANGO": RuleCategoryPLT(
        "CAT_PLT_COORD_ESTE_RANGO", "Coordenada Este fuera de rango o menor/igual a cero.", "ALERTA"
    ),
    "CAT_PLT_COORD_NORTE_RANGO": RuleCategoryPLT(
        "CAT_PLT_COORD_NORTE_RANGO", "Coordenada Norte fuera de rango o menor/igual a cero.", "ALERTA"
    ),
    "CAT_PLT_ELEVACION_RANGO": RuleCategoryPLT(
        "CAT_PLT_ELEVACION_RANGO", "Elevación topográfica Z (msnm) menor o igual a cero.", "ALERTA"
    ),
    "CAT_PLT_TIPO_ENSAYO_INVALIDO": RuleCategoryPLT(
        "CAT_PLT_TIPO_ENSAYO_INVALIDO", "Tipo de ensayo no admitido (debe ser D: Diametral, A: Axial, B: Bloques).", "ALERTA"
    ),
    "CAT_PLT_NOMINACION_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_NOMINACION_INVALIDA", "Diámetro de taladro no pertenece al catálogo (HQ, HQ3, NQ, NQ3, PQ, BQ).", "ALERTA"
    ),
    "CAT_PLT_DIAMETRO_RANGO": RuleCategoryPLT(
        "CAT_PLT_DIAMETRO_RANGO", "Diámetro D (mm) debe ser un valor positivo mayor a cero (D > 0).", "ALERTA"
    ),
    "CAT_PLT_LONGITUD_MUESTRA_RANGO": RuleCategoryPLT(
        "CAT_PLT_LONGITUD_MUESTRA_RANGO", "Longitud de muestra L (mm) menor o igual a cero.", "ALERTA"
    ),
    "CAT_PLT_VERIF_LONGITUD_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_VERIF_LONGITUD_INCONGRUENTE", "Verificación de longitud reportada no coincide con el criterio ISRM (L >= 0.5*D).", "ALERTA"
    ),
    "CAT_PLT_LITO1_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_LITO1_INVALIDA", "Litología 1 no existe en el catálogo litológico oficial de la mina.", "ALERTA"
    ),
    "CAT_PLT_LITOLOGIA_COMBINACION_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_LITOLOGIA_COMBINACION_INVALIDA", "Combinación litológica (Lito 1-2-3) no existe en la cascada geomecánica.", "ALERTA"
    ),
    "CAT_PLT_TIPO_LITOLOGICO_INVALIDO": RuleCategoryPLT(
        "CAT_PLT_TIPO_LITOLOGICO_INVALIDO", "Tipo litológico no pertenece a los 5 grupos geológicos admitidos.", "ALERTA"
    ),
    "CAT_PLT_TIPO_LITOLOGICO_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_TIPO_LITOLOGICO_INCONGRUENTE", "Tipo litológico es incongruente con la combinación Lito 1-2-3.", "ALERTA"
    ),
    "CAT_PLT_FUERZA_P_RANGO": RuleCategoryPLT(
        "CAT_PLT_FUERZA_P_RANGO", "Fuerza P (kN) debe ser un valor positivo mayor a cero (P > 0).", "ALERTA"
    ),
    "CAT_PLT_TIPO_ROTURA_INVALIDO": RuleCategoryPLT(
        "CAT_PLT_TIPO_ROTURA_INVALIDO", "Tipo de rotura no admitido.", "ALERTA"
    ),
    "CAT_PLT_DIRECCION_ROTURA_INVALIDA": RuleCategoryPLT(
        "CAT_PLT_DIRECCION_ROTURA_INVALIDA", "Dirección de rotura no admitida (debe ser Pa, Pe o NA).", "ALERTA"
    ),
    "CAT_PLT_IS_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_IS_INCONGRUENTE", "Índice Is (MPa) no coincide con la fórmula P*1000 / D^2.", "ALERTA"
    ),
    "CAT_PLT_FACTOR_F_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_FACTOR_F_INCONGRUENTE", "Factor de corrección F no coincide con la fórmula (D / 50)^0.45.", "ALERTA"
    ),
    "CAT_PLT_IS50_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_IS50_INCONGRUENTE", "Índice normalizado Is(50) (MPa) no coincide con la fórmula Is * F.", "ALERTA"
    ),
    "CAT_PLT_FACTOR_K_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_FACTOR_K_INCONGRUENTE", "Factor K digitado no coincide con el valor asignado por la cascada litológica.", "ALERTA"
    ),
    "CAT_PLT_FACTOR_K_RANGO": RuleCategoryPLT(
        "CAT_PLT_FACTOR_K_RANGO", "Factor K fuera de rango razonable [5.0, 30.0].", "ALERTA"
    ),
    "CAT_PLT_UCS_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_UCS_INCONGRUENTE", "Resistencia UCS (MPa) no coincide con la fórmula Is(50) * K.", "ALERTA"
    ),
    "CAT_PLT_RESISTENCIA_ISRM_INCONGRUENTE": RuleCategoryPLT(
        "CAT_PLT_RESISTENCIA_ISRM_INCONGRUENTE", "Clasificación ISRM no corresponde al rango de UCS según tabla oficial.", "ALERTA"
    ),
    "CAT_PLT_FORMULA_ERROR": RuleCategoryPLT(
        "CAT_PLT_FORMULA_ERROR", "La celda contiene un error de evaluación de fórmula (#VALUE!, #REF!, #DIV/0!).", "ALERTA"
    )
}

# ===========================================================================
# 2. CATÁLOGO DE CONSTANTES Y TABLAS OFICIALES
# ===========================================================================

NOMINAL_DIAMETERS = {
    "HQ": 61.1,
    "HQ3": 61.1,
    "HQ-3": 61.1,
    "NQ": 47.6,
    "NQ3": 47.6,
    "NQ-3": 47.6,
    "PQ": 85.0,
    "PQ3": 85.0,
    "PQ-3": 85.0,
    "BQ": 36.5,
    "BQ3": 36.5
}

VALID_ENSAYO_TYPES = {"D", "A", "B", "DIAMETRAL", "AXIAL", "BLOQUES"}
VALID_NOMINATIONS = {"HQ", "HQ3", "HQ-3", "NQ", "NQ3", "NQ-3", "PQ", "PQ3", "PQ-3", "BQ", "BQ3", "BQ-3"}
VALID_FRACTURE_TYPES = {"M", "E", "C", "M-E", "M/E", "E/M", "E-M"}
VALID_ROTURA_DIRECTIONS = {"PA", "PE", "NA", "N/A", "N / A"}

VALID_GEOLOGIC_GROUPS = {
    "INTRUSIVOS", "INTRUSIVA", "INTRUSIVAS", "ROCA INTRUSIVA",
    "SEDIMENTARIOS", "SEDIMENTARIA", "SEDIMENTARIAS", "ROCA SEDIMENTARIA",
    "METAMORFICAS", "METAMORFICA", "METAMORFICOS", "ROCA METAMORFICA",
    "BRECHAS", "BRECHA", "BRECHA TECTONICA",
    "ENDOSKARN", "EXOSKARN", "SKARN", "ENDO"
}

ISRM_SCALE = [
    (0.25, "Suelo"),
    (1.0, "R0"),
    (5.0, "R1"),
    (25.0, "R2"),
    (50.0, "R3"),
    (100.0, "R4"),
    (250.0, "R5"),
    (float("inf"), "R6")
]

OFFICIAL_34_COLUMNS = [
    "Campaña", "Fecha", "Taladro", "Nro Muestra", "Nro Caja",
    "Corrida Desde (m)", "Corrida Hasta (m)", "From", "To",
    "Verif. corrida", "Long. de Corrida (m)",
    "Este (m)", "Norte (m)", "Elevación (msnm)",
    "Long. de Muestra (mm)", "Tipo de Ensayo", "Diametro de Taladro",
    "Litologia 1", "Litologia 2", "Litologia 3", "Tipo litológico",
    "D (mm)", "Verif. de longitud", "P instr (kN)",
    "Tipo de Rotura", "Dirección de rotura", "Ejecutado por",
    "Is (Mpa)", "Fact. Corr", "Is(50) (Mpa)", "Factor K", "UCS",
    "ISRM Indice R", "Observaciones"
]

MANDATORY_PLT_COLUMNS = [
    "Campaña", "Fecha", "Taladro", "Nro Muestra", "Nro Caja",
    "Corrida Desde (m)", "Corrida Hasta (m)", "From", "To",
    "Verif. corrida", "Long. de Corrida (m)",
    "Este (m)", "Norte (m)", "Elevación (msnm)",
    "Long. de Muestra (mm)", "Tipo de Ensayo", "Diametro de Taladro",
    "Litologia 1", "Tipo litológico", "D (mm)", "Verif. de longitud",
    "P instr (kN)", "Tipo de Rotura", "Dirección de rotura", "Ejecutado por",
    "Is (Mpa)", "Fact. Corr", "Is(50) (Mpa)", "Factor K", "UCS", "ISRM Indice R"
]
