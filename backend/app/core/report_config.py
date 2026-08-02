CAMPO_LABELS = {
    "LGG": {
        "de": "Desde (m)", "a": "Hasta (m)", "rec_m": "Long. Recuperada (m)",
        "rqd_m": "RQD (m)", "lrf_m": "Long. Roca Fracturada (m)",
        "small_frag_m": "Suma Frag. <10cm (m)", "frac_nat": "N° Frac. Naturales",
        "lito1": "Litho 1", "lito2": "Litho 2", "lito3": "Litho 3",
        "resistencia": "Resist. Máx. Estimada (ISRM)",
        "tipo_est1": "Tipo de Estructura 1", "tipo_est2": "Tipo de Estructura 2",
        "frac_buz30": "N° Frac. Buz <30°", "frac_buz60": "N° Frac. Buz 30°-60°",
        "frac_buz90": "N° Frac. Buz >60°", "abertura": "Abertura (mm)",
        "rugosidad": "Rugosidad (ISRM)", "jrc10": "JRC10",
        "intemperismo": "Grado Intemp. (ISRM)", "relleno1": "Tipo de Relleno 1",
        "relleno2": "Tipo de Relleno 2", "espesor": "Espesor Relleno (mm)",
        "agua_obs": "Presencia de Agua", "geologo": "Geólogo / Geotécnico",
        "comentarios": "Comentarios", "campana": "Campaña / Año", "frf": "FRF",
    },
    "Estructural": {
        "de": "Desde (m)", "a": "Hasta (m)", "profundidad": "Profundidad (m)",
        "lito1": "Litho 1", "lito2": "Litho 2", "lito3": "Litho 3",
        "tipo_estructura": "Tipo de Estructura", "alfa": "Alfa (°)", "beta": "Beta (°)",
        "dip": "Dip (°)", "azimuth": "Azimut (°)", "forma": "Forma",
        "rugosidad": "Rugosidad (ISRM)", "jrc10": "JRC10", "abertura": "Abertura (mm)",
        "weathering": "Grado Intemp. (ISRM)", "espesor": "Espesor Relleno (mm)",
        "relleno1": "Tipo de Relleno 1", "relleno2": "Tipo de Relleno 2",
        "dureza_pared": "Dureza de Pared", "agua": "Presencia de Agua",
        "geotecnico": "Geólogo / Geotécnico", "comentario": "Comentarios",
        "campana": "Campaña / Año",
    },
    "Validación RMR": {
        "corrida": "Corrida", "fecha": "Fecha", "logueador": "Logueador",
        "de": "Desde (m)", "a": "Hasta (m)", "long_corrida": "Long. Corrida (m)",
        "lito1": "Litho 1", "lito2": "Litho 2", "lito3": "Litho 3",
        "rec_m": "Rec (m)", "rec_pct": "Rec (%)", "rqd_m": "RQD (m)", "rqd_pct": "RQD (%)",
        "lrf_m": "Long. Tramo Fracturado (m)", "frf": "FRF",
        "frac_nat": "Frac. Naturales", "total_frac": "Total de Fracturas",
        "ff_1m": "FF/1m", "espaciamiento_mm": "Espaciamiento (mm)",
        "resistencia": "Resistencia", "tipo_estructura": "Tipo de Estructura",
        "abertura_mm": "Abertura (mm)", "rugosidad": "Rugosidad",
        "relleno": "Relleno", "clasificacion_relleno": "Clasificación Relleno",
        "intemperismo": "Intemperismo", "jrc10": "JRC10",
        "espesor_relleno": "Espesor Relleno (mm)", "presencia_agua": "Presencia de Agua",
        "rmr76": "RMR'76 Total", "rmr89": "RMR'89 Total", "campana": "Campaña / Año",
    },
}

SUBRATINGS_LABELS = {}
for _v in ("76", "89"):
    for _key, _lbl in [
        ("resistencia", "Resistencia"), ("rqd", "RQD"), ("espaciamiento", "Espaciamiento"),
        ("abertura", "Abertura"), ("rugosidad", "Rugosidad"), ("relleno", "Relleno"),
        ("intemperismo", "Intemperismo"), ("persistencia", "Persistencia"),
        ("juntas", "Condición de Juntas"), ("agua", "Presencia de Agua"),
    ]:
        SUBRATINGS_LABELS[f"r{_v}_{_key}"] = f"RMR'{_v} {_lbl}"
CAMPO_LABELS["Validación RMR"].update(SUBRATINGS_LABELS)

SUBRATING_PREFIXES = ("r76_", "r89_")

REQUIRED_FIELDS_POR_MODULO = {
    "LGG": {
        "corrida", "de", "a", "rec_m", "rqd_m", "lrf_m", "small_frag_m", "frac_nat",
        "lito1", "resistencia", "tipo_est1", "frac_buz30", "frac_buz60", "frac_buz90",
        "abertura", "rugosidad", "jrc10", "intemperismo", "relleno1", "espesor",
        "agua_obs", "campana", "geologo",
    },
    "Estructural": {
        "profundidad", "alfa", "beta", "forma", "rugosidad", "jrc10", "abertura",
        "weathering", "espesor", "relleno1", "dureza_pared", "agua", "geotecnico", "campana",
        "dip", "azimuth",
    },
    "Validación RMR": {
        "sondaje", "corrida", "de", "a", "long_corrida", "lito1", "rec_m", "rec_pct",
        "rqd_m", "rqd_pct", "lrf_m", "frf", "frac_nat", "total_frac", "ff_1m",
        "espaciamiento_mm", "resistencia", "tipo_estructura", "abertura_mm",
        "rugosidad", "relleno", "clasificacion_relleno", "intemperismo", "jrc10",
        "espesor_relleno", "logueador",
    },
}

RMR_AFFECTING_POR_MODULO = {
    "LGG": {
        "de", "a", "rec_m", "rqd_m", "lrf_m", "small_frag_m", "frac_nat", "lito1",
        "resistencia", "tipo_est1", "abertura", "rugosidad", "jrc10", "intemperismo",
        "relleno1", "espesor", "agua_obs", "frf",
    },
    "Estructural": {"dip", "azimuth"},
    "Validación RMR": set(),
}

EXCLUIDOS_DE_TABLAS = {
    "LGG": {"corrida", "taladro"},
    "Estructural": {"taladro"},
    "Validación RMR": {"sondaje"},
}

CAMPOS_EXTRA_A_CAPTURAR = {
    "LGG": ["lito2", "lito3", "tipo_est2", "relleno2", "comentarios", "frf"],
    "Estructural": [
        "de", "a", "lito1", "lito2", "lito3", "tipo_estructura",
        "dip", "azimuth", "relleno2", "comentario",
    ],
    "Validación RMR": [
        "fecha", "logueador", "lito2", "lito3", "presencia_agua",
        "rmr76", "rmr89", "campana",
    ] + sorted(SUBRATINGS_LABELS),
}

COLORES = {
    "rmr_fucsia": "FF2D92",
    "rmr_rojo": "C00000",
    "rmr_rosa": "FF80C0",
    "no_rmr_ambar": "FFC000",
    "obligatorio_verde": "2E8B57",
    "obligatorio_verde_claro": "D9EAD3",
    "no_obligatorio_ambar_claro": "FFF2CC",
    "rosa_claro": "FCE4EC",
    "alta_durazno": "FCE4D6",
    "media_amarillo": "FFF2CC",
    "puntual_verde": "E2EFDA",
    "sin_accion_gris": "F2F4F7",
}

PARRAFOS_OPCIONALES = False
