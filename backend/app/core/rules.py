# Core Rules catalog - Single Source of Truth (SSOT)

WEATHERING_COMPATIBILITY = {
    'R0': ['RS', 'CWC'],
    'R1': ['HWA', 'CWC'],
    'R2': ['SWD', 'MWM', 'HWA'],
    'R3': ['MWM', 'SWD', 'UWF'],
    'R4': ['SWD', 'MWM', 'UWF'],
    'R5': ['UWF', 'SWD'],
    'R6': ['UWF']
}

MASTER_ERROR_RULES = [
    # --- LOGUEO GENERAL (LGG) ---
    {
        "code": "R101",
        "msg": "Longitud de corrida perforada debe ser positiva.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R102",
        "msg": "Longitud de corrida perforada excede el límite crítico de 1.6m.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R103",
        "msg": "Longitud recuperada es mayor que el avance perforado.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R104",
        "msg": "Metraje RQD es mayor que la longitud recuperada.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R105",
        "msg": "La suma de fragmentos supera el avance perforado.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R106",
        "msg": "La sumatoria de fracturas por buzamiento no coincide con el conteo general.",
        "severity": "ADVERTENCIA",
        "group": "LGG"
    },
    {
        "code": "R107",
        "msg": "Se declaró espesor de relleno de junta pero la abertura es 0mm.",
        "severity": "ADVERTENCIA",
        "group": "LGG"
    },
    {
        "code": "R108",
        "msg": "La abertura de junta es mayor a 0mm pero no se ha registrado espesor de relleno.",
        "severity": "ADVERTENCIA",
        "group": "LGG"
    },
    {
        "code": "R109",
        "msg": "Incompatibilidad geológica (Resistencia vs Intemperismo de corrida).",
        "severity": "ADVERTENCIA",
        "group": "LGG"
    },
    {
        "code": "R110",
        "msg": "Campo obligatorio se encuentra vacío.",
        "severity": "VACIO",
        "group": "LGG"
    },

    # --- LOGUEO ESTRUCTURAL ---
    {
        "code": "R201",
        "msg": "Profundidad huérfana de junta no corresponde a ningún tramo de corrida en LGG.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R202",
        "msg": "El ángulo Alfa es inválido. Debe estar entre 0° y 90° o ser -1.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R203",
        "msg": "El ángulo Beta es inválido. Debe estar entre 0° y 360° o ser -1.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R204",
        "msg": "El valor de JRC10 es inválido. No se permiten valores mayores a 20.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R205",
        "msg": "El espesor de relleno no puede ser mayor que la abertura de junta.",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R206",
        "msg": "Se declaró espesor de relleno pero el tipo de relleno está sin definir.",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R207",
        "msg": "El tipo de relleno está definido pero la abertura de junta es 0mm.",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R208",
        "msg": "Incompatibilidad geológica (Dureza de pared de junta supera la resistencia intacta de la corrida).",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R209",
        "msg": "Incompatibilidad de litología entre la corrida y la junta.",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R210",
        "msg": "Campo obligatorio se encuentra vacío.",
        "severity": "VACIO",
        "group": "Estructural"
    }
]

def get_rule_by_code(code: str):
    for rule in MASTER_ERROR_RULES:
        if rule["code"] == code:
            return rule
    return None

def get_rule_by_msg(msg: str):
    for rule in MASTER_ERROR_RULES:
        if rule["msg"] == msg:
            return rule
    return None
