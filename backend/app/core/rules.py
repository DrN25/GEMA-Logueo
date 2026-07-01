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
        "msg": "La longitud recuperada es mayor que el avance perforado.",
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
        "msg": "La longitud de roca fracturada LRF es mayor que la longitud recuperada.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R106",
        "msg": "La suma de fragmentos físicos supera el avance perforado.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R107",
        "msg": "La sumatoria de fracturas por buzamiento no coincide con el conteo general.",
        "severity": "ADVERTENCIA",
        "group": "LGG"
    },
    {
        "code": "R108",
        "msg": "El espesor de relleno no puede ser mayor que la abertura de junta.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R109",
        "msg": "Se declaró espesor de relleno de junta pero la abertura es 0mm.",
        "severity": "ADVERTENCIA",
        "group": "LGG"
    },
    {
        "code": "R110",
        "msg": "La abertura de junta es mayor a 0mm pero no se ha registrado espesor de relleno.",
        "severity": "ADVERTENCIA",
        "group": "LGG"
    },
    {
        "code": "R111",
        "msg": "Código de Resistencia ISRM no válido.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R112",
        "msg": "Código de Meteorización no válido.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R113",
        "msg": "Código de Tipo de Relleno no válido.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R114",
        "msg": "Código de Presencia de Agua no válido.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R115",
        "msg": "Código de Rugosidad no válido.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R116",
        "msg": "El valor de JRC10 es inválido. No se permiten valores mayores a 20.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R117",
        "msg": "El valor de JRC10 no puede ser negativo.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R118",
        "msg": "Código de estructura 1 no válido.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R119",
        "msg": "Código de estructura 2 no válido.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R120",
        "msg": "El valor de FRF no coincide con el calculado por la fórmula.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R121",
        "msg": "Incompatibilidad geológica (Resistencia vs Intemperismo de corrida).",
        "severity": "ADVERTENCIA",
        "group": "LGG"
    },
    {
        "code": "R122",
        "msg": "Ruptura de continuidad espacial detectada.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R123",
        "msg": "Campo obligatorio se encuentra vacío.",
        "severity": "VACIO",
        "group": "General"
    },
    {
        "code": "R124",
        "msg": "El valor de 'de:' no puede ser negativo.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R125",
        "msg": "El valor de 'a:' no puede ser negativo.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R126",
        "msg": "La longitud recuperada no puede ser negativa.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R127",
        "msg": "El metraje RQD no puede ser negativo.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R128",
        "msg": "La longitud de roca fracturada LRF no puede ser negativa.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R129",
        "msg": "El metraje de fragmentos <10cm no puede ser negativo.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R130",
        "msg": "El número de fracturas naturales no puede ser negativo.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R131",
        "msg": "El número de fracturas en Buz<30° no puede ser negativo.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R132",
        "msg": "El número de fracturas en 30°-60° no puede ser negativo.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R133",
        "msg": "El número de fracturas en Buz>60° no puede ser negativo.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R134",
        "msg": "La abertura no puede ser negativa.",
        "severity": "ALERTA",
        "group": "General"
    },
    {
        "code": "R135",
        "msg": "El espesor de relleno no puede ser negativo.",
        "severity": "ALERTA",
        "group": "General"
    },
    {
        "code": "R136",
        "msg": "El año de campaña no puede ser negativo.",
        "severity": "ALERTA",
        "group": "General"
    },
    {
        "code": "R137",
        "msg": "El valor del campo debe ser un número entero.",
        "severity": "ALERTA",
        "group": "General"
    },
    {
        "code": "R138",
        "msg": "El valor de FRF no puede ser negativo.",
        "severity": "ALERTA",
        "group": "LGG"
    },
    {
        "code": "R139",
        "msg": "El valor de FRF debe ser un número entero.",
        "severity": "ALERTA",
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
        "msg": "La corrida asociada (de/a) no existe de forma exacta en las corridas de LGG para el taladro.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R203",
        "msg": "La profundidad se encuentra fuera del tramo de corrida especificado.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R204",
        "msg": "El ángulo Alfa es inválido. Debe estar entre 0° y 90° o ser -1.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R205",
        "msg": "El ángulo Alfa debería ser un número entero.",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R206",
        "msg": "El ángulo Beta es inválido. Debe estar entre 0° y 360° o ser -1.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R207",
        "msg": "El ángulo Beta debería ser un número entero.",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R208",
        "msg": "El ángulo Dip es inválido. Debe estar entre 0° y 90°.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R209",
        "msg": "El ángulo Azimut es inválido. Debe estar entre 0° y 360°.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R210",
        "msg": "Forma de junta no válida. Permitidos: Plano (1) a Irregular (6).",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R211",
        "msg": "El espesor de relleno no puede ser mayor que la abertura de junta excepto en estructuras F, RF, VN, SZ, F+10 o BED.",
        "severity": "ALERTA",
        "group": "Estructural"
    },
    {
        "code": "R212",
        "msg": "Se declaró espesor de relleno pero el tipo de relleno está sin definir o es CWF.",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R213",
        "msg": "El tipo de relleno está definido pero la abertura de junta es 0mm.",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R214",
        "msg": "Incompatibilidad geológica (Dureza de pared de junta supera la resistencia intacta de la corrida).",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R215",
        "msg": "Incompatibilidad de litología entre la corrida y la junta.",
        "severity": "ADVERTENCIA",
        "group": "Estructural"
    },
    {
        "code": "R301",
        "msg": "Las profundidades finales del taladro no coinciden entre módulos (LGG, Estructural, Collar, Survey).",
        "severity": "ALERTA",
        "group": "Cruce General"
    },
    {
        "code": "R216",
        "msg": "La profundidad en logueo estructural excede el límite final registrado en LGG.",
        "severity": "ALERTA",
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