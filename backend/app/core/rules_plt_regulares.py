"""
rules_plt_regulares.py — Catálogo Oficial de Reglas de Consistencia Geomecánica para Ensayos PLT Regulares (DDH).
Define las categorías canónicas de error, severidades, mapeo de columnas, catálogo litológico SSOT
y reglas específicas de validación (incluyendo duplicados, Factor K y cruce con LGG).
"""

from typing import Dict, List, Set, Optional, Tuple


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
    # --- Integridad de Campos y Formato ---
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
        "CAT_PLT_NOMINACION_INVALIDA", "Diámetro de taladro no pertenece al catálogo (HQ, HQ3, NQ, PQ, BQ).", "ALERTA"
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
        "CAT_PLT_TIPO_LITOLOGICO_INCONGRUENTE", "Tipo litológico no coincide con el grupo oficial para esta roca.", "ADVERTENCIA"
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
    ),

    # --- NUEVAS CATEGORÍAS: DUPLICADOS Y CRUCE DE TRAMOS ---
    "CAT_PLT_MUESTRA_DUPLICADA": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_DUPLICADA", "Muestra duplicada en el taladro.", "ALERTA"
    ),
    "CAT_PLT_TRAMO_DUPLICADO": RuleCategoryPLT(
        "CAT_PLT_TRAMO_DUPLICADO", "Mismo tramo ensayado más de una vez.", "ALERTA"
    ),
    "CAT_PLT_TRAMOS_CRUZADOS": RuleCategoryPLT(
        "CAT_PLT_TRAMOS_CRUZADOS", "Tramos de muestras que se cruzan o montan.", "ALERTA"
    ),
    "CAT_PLT_CARGA_REPETIDA": RuleCategoryPLT(
        "CAT_PLT_CARGA_REPETIDA", "Carga de ensayo repetida continuamente (revisar posible copia).", "ADVERTENCIA"
    ),

    # --- NUEVAS CATEGORÍAS: CRUCE CON LOGUEO GENERAL LGG ---
    "CAT_PLT_CORRIDA_NO_EXISTE_LGG": RuleCategoryPLT(
        "CAT_PLT_CORRIDA_NO_EXISTE_LGG", "Corrida no existe en el logueo (LGG).", "ALERTA"
    ),
    "CAT_PLT_MUESTRA_FUERA_DE_CORRIDA": RuleCategoryPLT(
        "CAT_PLT_MUESTRA_FUERA_DE_CORRIDA", "Muestra se sale de la corrida de logueo.", "ALERTA"
    ),
    "CAT_PLT_CORRIDA_DIFIERE_LGG": RuleCategoryPLT(
        "CAT_PLT_CORRIDA_DIFIERE_LGG", "Límites de corrida no coinciden con logueo.", "ADVERTENCIA"
    ),
    "CAT_PLT_COMBINACION_LITO_DISCORDANTE_LGG": RuleCategoryPLT(
        "CAT_PLT_COMBINACION_LITO_DISCORDANTE_LGG", "Combinación de litología no coincide con logueo.", "ADVERTENCIA"
    ),
    "CAT_PLT_DUREZA_DIFIERE_LGG": RuleCategoryPLT(
        "CAT_PLT_DUREZA_DIFIERE_LGG", "Dureza de campo (ISRM) difiere del ensayo.", "ADVERTENCIA"
    ),
}

# ===========================================================================
# 2. CATÁLOGO LITOLÓGICO Y FACTOR K CANÓNICO (SSOT)
# ===========================================================================
LITHOLOGY_FULL_CATALOG = [
    # INTRUSIVOS
    {"grupo": "INTRUSIVOS", "lito1": "MZB",  "lito2": "MZB", "lito3": "MZB_EQ", "k": 8.29},
    {"grupo": "INTRUSIVOS", "lito1": "MZB",  "lito2": "MZB", "lito3": "MZB_P",  "k": 8.53},
    {"grupo": "INTRUSIVOS", "lito1": "MZB",  "lito2": "MZB", "lito3": "NR",     "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MBF1", "lito2": "MBF", "lito3": "MBF1",   "k": 9.20},
    {"grupo": "INTRUSIVOS", "lito1": "MBF1", "lito2": "MBF", "lito3": "NR",     "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MBF2", "lito2": "MBF", "lito3": "MBF2",   "k": 10.73},
    {"grupo": "INTRUSIVOS", "lito1": "MBF2", "lito2": "MBF", "lito3": "MBF_P",  "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MBF2", "lito2": "MBF", "lito3": "NR",     "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZM",  "lito2": "MZM", "lito3": "MZM_F",  "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZM",  "lito2": "MZM", "lito3": "MZM_M",  "k": 8.61},
    {"grupo": "INTRUSIVOS", "lito1": "MZM",  "lito2": "MZM", "lito3": "NR",     "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZH",  "lito2": "MZH", "lito3": "MZH_1",  "k": 11.62},
    {"grupo": "INTRUSIVOS", "lito1": "MZH",  "lito2": "MZH", "lito3": "MZH_2",  "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZH",  "lito2": "MZH", "lito3": "NR",     "k": 9.31},
    {"grupo": "INTRUSIVOS", "lito1": "MZD",  "lito2": "MZD", "lito3": "MZD",    "k": 7.60},
    {"grupo": "INTRUSIVOS", "lito1": "MZQ",  "lito2": "MZQ", "lito3": "MZQ",    "k": 12.29},
    {"grupo": "INTRUSIVOS", "lito1": "AN",   "lito2": "AN",  "lito3": "LAM",    "k": 9.31},
    # SEDIMENTARIOS
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT",    "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_M",  "k": 14.74},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_MG", "k": 14.25},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_S",  "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_C",  "k": 16.83},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "LMT_U",  "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "LMT", "lito3": "NR",     "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "SHL", "lito2": "HFL", "lito3": "SHL_MA", "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "SHL", "lito2": "HFL", "lito3": "-",      "k": 12.63},
    {"grupo": "SEDIMENTARIOS", "lito1": "SND", "lito2": "QZT", "lito3": "-",      "k": 12.63},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "OVD", "lito3": "OVD",    "k": 14.84},
    {"grupo": "SEDIMENTARIOS", "lito1": "LMT", "lito2": "OVD", "lito3": "-",      "k": 14.84},
    # BRECHAS
    {"grupo": "BRECHAS", "lito1": "TBX",          "lito2": "TBX", "lito3": "TBX", "k": 13.72},
    {"grupo": "BRECHAS", "lito1": "HBX",          "lito2": "HBX", "lito3": "HBX", "k": 11.41},
    {"grupo": "BRECHAS", "lito1": "MBX / varios", "lito2": "MBX", "lito3": "MBX", "k": 11.41},
    # ENDOSKARN
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "MZB_EQ", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "MZM_M",  "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "MZD",    "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EPG", "lito3": "-",      "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EGT", "lito3": "MZM_M",  "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EGT", "lito3": "MZB_EQ", "k": 9.87},
    {"grupo": "ENDOSKARN", "lito1": "Intrusivo", "lito2": "EGT", "lito3": "-",      "k": 9.87},
    # METAMORFICAS
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_M",  "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_C",  "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_S",  "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_U",  "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "LMT_MG", "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "GSK", "lito3": "Varios", "k": 11.15},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_MG", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_C",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_S",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "LMT_U",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "PSK", "lito3": "Varios", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MSK", "lito3": "LMT_MG", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MSK", "lito3": "LMT_S",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MSK", "lito3": "Varios", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_M",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_MG", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_C",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "LMT_S",  "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "ESK", "lito3": "Varios", "k": 12.63},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "LMT_M",  "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "LMT_MG", "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "LMT_S",  "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBC", "lito3": "Varios", "k": 11.78},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_MG", "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_S",  "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_M",  "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "LMT_C",  "k": 13.34},
    {"grupo": "METAMORFICAS", "lito1": "LMT", "lito2": "MBL", "lito3": "Varios", "k": 13.34},
]

INTRUSIVE_LITOS_SET = {
    "MZB", "MZQ", "MZM", "GRD", "TON", "DIO", "POR", "AND", "DAC", "MZD",
    "INTRUSIVO", "INTRUSIVOS", "INTRUSIVA", "INTRUSIVAS", "INTRUS"
}

def resolve_expected_k_and_type(l1: str, l2: str, l3: str) -> Tuple[Optional[str], Optional[float]]:
    """
    Resuelve el grupo geológico y el Factor K esperado para la combinación litológica (L1, L2, L3)
    según el catálogo oficial SSOT de GEMA.
    """
    l1_norm = str(l1 or "").strip().upper()
    l2_norm = str(l2 or "").strip().upper()
    l3_norm = str(l3 or "").strip().upper()

    # 1. Búsqueda exacta en catálogo
    for item in LITHOLOGY_FULL_CATALOG:
        cat_l1 = item["lito1"].upper()
        cat_l2 = item["lito2"].upper()
        cat_l3 = item["lito3"].upper()

        if cat_l1 in ("INTRUSIVO", "INTRUSIVOS"):
            m1 = (l1_norm in INTRUSIVE_LITOS_SET) or (l1_norm == cat_l1)
        elif cat_l1:
            m1 = (l1_norm == cat_l1)
        else:
            m1 = True

        m2 = (l2_norm == cat_l2) if cat_l2 else True
        m3 = (l3_norm == cat_l3) if cat_l3 and cat_l3 not in ("VARIOS", "NR", "-") else True

        if m1 and m2 and m3:
            return item["grupo"], item["k"]

    # 2. Reglas jerárquicas geológicas de contingencia (Ferrobamba)
    # Metamórficas
    if l2_norm == "MBL": return "METAMORFICAS", 13.34
    if l2_norm == "MBC": return "METAMORFICAS", 11.78
    if l2_norm == "GSK": return "METAMORFICAS", 11.15
    if l2_norm in ("ESK", "MSK", "PSK", "HFL"): return "METAMORFICAS", 12.63

    # Brechas
    if l2_norm == "TBX" or l1_norm == "TBX": return "BRECHAS", 13.72
    if l2_norm in ("BX", "HBX", "MBX") or l1_norm in ("BX", "HBX"): return "BRECHAS", 11.41

    # Intrusivos
    if l2_norm == "MZQ" or l1_norm == "MZQ": return "INTRUSIVOS", 12.29
    if l2_norm == "MZH" or l1_norm == "MZH": return "INTRUSIVOS", 11.62
    if l1_norm == "MBF2" or l3_norm == "MBF2": return "INTRUSIVOS", 10.73
    if l1_norm == "MBF1" or l3_norm == "MBF1": return "INTRUSIVOS", 9.20
    if l2_norm in ("MBF", "MBF1"): return "INTRUSIVOS", 9.20
    if l2_norm == "MBF2": return "INTRUSIVOS", 10.73
    if l2_norm == "MZD" or l1_norm == "MZD": return "INTRUSIVOS", 7.60
    if l2_norm in ("EPG", "EGT"): return "ENDOSKARN", 9.87
    if l2_norm == "MZM":
        if l3_norm in ("MZM_F", "MBF1"): return "INTRUSIVOS", 9.31
        return "INTRUSIVOS", 8.61
    if l2_norm == "MZB":
        if l3_norm == "MZB_EQ": return "INTRUSIVOS", 8.29
        if l3_norm == "MZB_P": return "INTRUSIVOS", 8.53
        return "INTRUSIVOS", 8.29

    # Calizas
    if l2_norm == "LMT" or l1_norm == "LMT":
        if l3_norm == "LMT_C": return "SEDIMENTARIOS", 16.83
        if l3_norm == "LMT_M": return "SEDIMENTARIOS", 14.74
        if l3_norm == "LMT_MG": return "SEDIMENTARIOS", 14.25
        if l3_norm in ("LMT_S", "LMT", "SHL", "OVD"): return "SEDIMENTARIOS", 14.84
        return "SEDIMENTARIOS", 14.74

    return None, None


# ===========================================================================
# 3. CATÁLOGO DE CONSTANTES Y TABLAS OFICIALES
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
VALID_FRACTURE_TYPES = {"M", "E", "C", "M-E", "M/E", "E/M", "E-M", "NA", "N/A"}
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
