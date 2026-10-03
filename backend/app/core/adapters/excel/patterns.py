"""
app.core.adapters.excel.patterns
Patrones de coincidencia difusa para cabeceras y mapeos fallback por defecto de hojas Excel.
"""

from typing import Dict, List
from app.core.engine.rules.common import (
    VALID_STRUCTURES, VALID_STRENGTHS, VALID_RUGOSITY, VALID_WEATHERING,
    VALID_RELLENO, VALID_AGUA, VALID_FORMA, VALID_ORIENTACION, VALID_TURNOS
)

LGG_PATTERNS: Dict[str, List[str]] = {
    "corrida": ["corrida", "id", "numcorrida"],
    "taladro": ["taladro", "sondaje", "drillhole", "holeid", "taladroid"],
    "de": ["de", "desde", "dem", "desdem", "from", "depthfrom"],
    "a": ["a", "hasta", "am", "hastam", "to", "depthto"],
    "perf": ["perf", "perforacion", "longitudperforada", "longperforada", "avance"],
    "rec_m": ["longitudrecuperadam", "recuperacionm", "recm", "recupm", "recuperacion", "recuperada", "longitudrecuperada", "longitudrecuperdadam", "longitudrecuperdada"],
    "rqd_m": ["rqdm", "rqd", "rqdmfragmentos10cm", "frag10cmm", "sumfrags10cm", "rqdsumfrags10cmm", "fragmentos10cmm", "frags10cmm", "fragmayorigual10cmm", "sumfrag10cm", "fragsmayor10cmm", "fragmayor10cmm", "rqdsumfragsmayorigual10cmm", "sumfragsmayorigual10cmm", "sumfragsmayor10cmm"],
    "lrf_m": ["longitudrocafracturadam", "lrfm", "lrf", "longitudrocafracturada", "rocafracturadam", "rocafracturada"],
    "small_frag_m": ["sumfrags10cmquenoentranalrqd", "smallfragm", "smallfrag", "sumfrags10cmquenoentranalrqdm", "frags10cmquenoentranalrqdm", "fragmenor10cmm", "fragmentosmenores10cm", "fragmenores10cm", "sumfragsmenor10cmquenoentranalrqdm"],
    "sum_frags_total": ["sumrqdlrfsumfragsmenor10cm", "sumrqdlrfsumfrags10cm", "sumrqdlrfsmallfrag", "sumrqdlrfsumfrags10cmm"],
    "frf": ["frf", "fracturaspormetro", "fracturasmetro"],
    "frac_nat": ["ndefracnaturales", "nfracnatur", "nfracnaturales", "fracnat", "fracturasnaturales", "naturales"],
    "lito1": ["lito1", "lito12023", "litologia1", "litologia12023", "litologia"],
    "lito2": ["lito2", "lito22023", "litologia2", "litologia22023"],
    "lito3": ["lito3", "lito32023", "litologia3", "litologia32023"],
    "r_indice": ["r", "indicer"],
    "resistencia": ["resistencia", "resistestimadaisrm", "resistmaxestimadaisrm", "resistestimada", "resistmax", "resist", "dureza", "isrm", "durezamaterial", "resistmaxestimada"],
    "linea_orientacion": ["lineadeorientacion", "lineaorientacion", "orientacion"],
    "offset": ["desplazamiento0360offsetoffset", "desplazamiento0360offset", "offset", "desplazamiento"],
    "tipo_est1": ["tipodeestruct", "tipoestructura1", "tipoest1", "estructura1", "tipodeestruct1"],
    "tipo_est2": ["tipodeestruct2", "tipoestructura2", "tipoest2", "estructura2"],
    "frac_buz30": ["nfracnatbuz30", "nfracnaturalbuz30", "buz30", "naturalesbuz30", "nfracnatbuzmenor30", "nfracnaturalbuzmenor30", "buzmenor30"],
    "frac_buz60": ["nfracn30buz60", "nfracnatural30buz60", "buz3060", "buz30a60", "nfracn30menorigualbuzmenor60", "nfracn30menorigualbuz60", "nfracnatural30menorigualbuzmenor60", "nfracn30menorbuzmenor60", "nfracn30menorbuz60"],
    "frac_buz90": ["nfracnatbuz60", "nfracnaturalbuz60", "buz60", "nfracnatbuz90", "nfracnaturalbuz90", "buz90", "nfracnatbuzmayor60", "nfracnaturalbuzmayor60", "buzmayor60"],
    "sum_frac_nat": ["sumfracturasnaturales", "sumfracnat", "sumatorianaturales"],
    "abertura": ["aberturamm", "abertura", "abert"],
    "rugosidad": ["rugosidadisrm", "rugosidad", "rugos"],
    "jrc10": ["jrc10", "jrc", "jrc10rugosidad"],
    "intemperismo": ["gradointempisrm", "gradointemp", "intemperismo", "alteracion", "weathering"],
    "relleno1": ["tipoderelleno1", "relleno1", "tiporelleno1"],
    "relleno2": ["tipoderelleno2", "relleno2", "tiporelleno2"],
    "espesor": ["espesorrellenomm", "espesorrelleno", "espesor", "espesormm"],
    "agua_obs": ["presenciadeaguaisrm", "presenaguaisrm", "presenciaagua", "aguaobs", "agua"],
    "geologo": ["geotecnico", "geotécnico", "geologo", "geotecnic", "geot"],
    "fecha": ["fecha", "date", "fechadelogueo"],
    "turno": ["turno", "shift"],
    "comentarios": ["comentarios", "comentario", "observaciones", "observacion", "comments"],
    "campana": ["campana", "anio", "campan", "campaign", "year"],
    "proyecto": ["proyecto", "project"]
}

EST_PATTERNS: Dict[str, List[str]] = {
    "corrida_avance": ["corrida"],
    "taladro": ["taladro", "sondaje", "drillhole", "holeid", "taladroid"],
    "de": ["de", "desde", "dem", "desdem", "from", "depthfrom"],
    "a": ["a", "hasta", "am", "hastam", "to", "depthto"],
    "profundidad": ["profundidad", "prof", "depth", "profundidadm"],
    "lito1": ["lito1", "lito12023", "litologia1", "litologia12023", "litologia"],
    "lito2": ["lito2", "lito22023", "litologia2", "litologia22023"],
    "lito3": ["lito3", "lito32023", "litologia3", "litologia32023"],
    "tipo_estructura": ["tipodeestructura", "estructura", "tipoest", "tipodeestructu"],
    "alfa": ["alpha", "alfa"],
    "beta": ["beta"],
    "dip": ["dip"],
    "azimuth": ["azimuth", "azimut"],
    "forma": ["forma"],
    "rugosidad": ["rugosidadisrm", "rugosidad", "rugos"],
    "jrc10": ["jrc10", "jrc", "jrc10rugosidad", "jnrc10"],
    "abertura": ["aberturamm", "abertura", "abert"],
    "weathering": ["gradointempisrm", "gradointemp", "intemperismo", "alteracion", "weathering", "gradointemperismo"],
    "espesor": ["espesorrellenomm", "espesorrelleno", "espesor", "espesormm"],
    "relleno1": ["tipoderelleno1", "relleno1", "tiporelleno1"],
    "relleno2": ["tipoderelleno2", "relleno2", "tiporelleno2"],
    "dureza_pared": ["durezadepared", "dureza", "durezapared", "durezaestructural", "durezadelapareddeestructura", "durezadelapareddeestructu"],
    "agua": ["presenciadeaguaisrm", "presenaguaisrm", "presenciaagua", "aguaobs", "agua"],
    "geotecnico": ["geotecnico", "geotécnico", "geologo", "geotecnic", "geot"],
    "comentario": ["comentarios", "comentario", "observaciones", "observacion", "comments", "intervalocomentario"],
    "corrida": ["corrida", "id", "numcorrida"],
    "campana": ["campana", "anio", "campan", "campaign", "year"],
    "proyecto": ["proyecto", "project"]
}

RMR_PATTERNS: Dict[str, List[str]] = {
    "sondaje": ["sondaje", "taladro", "drillhole", "holeid"],
    "corrida": ["corrida", "id", "numcorrida"],
    "lito1": ["litho1", "lito1", "litologia1"],
    "lito2": ["litho2", "lito2", "litologia2"],
    "lito3": ["litho3", "lito3", "litologia3"],
    "de": ["desde", "desdem", "de", "from"],
    "a": ["hasta", "hastam", "a", "to"],
    "long_corrida": ["longcorrida", "longcorridam", "longitudcorrida"],
    "rec_m": ["recm", "recupm", "recuperacionm", "longitudrecuperada"],
    "rec_pct": ["recpct", "recporcentaje"],
    "rqd_m": ["rqdm", "rqd"],
    "rqd_pct": ["rqdpct", "rqdporcentaje"],
    "lrf_m": ["longtramofracturadom", "lrfm", "lrf", "longitudrocafracturada"],
    "frf": ["frfzonastrituradas", "frf"],
    "frac_nat": ["fracturasnaturales", "nfracnaturales", "fracnat"],
    "total_frac": ["toraldefracturas", "totaldefracturas", "totalfracturas"],
    "ff_1m": ["ff1m", "ffm"],
    "espaciamiento_mm": ["espaciamientomm", "espaciamiento"],
    "resistencia": ["resistencia", "resistenciainput"],
    "tipo_estructura": ["tipodeestructura", "tipoest"],
    "abertura_mm": ["aberturamm", "abertura"],
    "rugosidad": ["rugosidad"],
    "relleno": ["relleno"],
    "clasificacion_relleno": ["clasificacionrelleno"],
    "intemperismo": ["intemperismo"],
    "jrc10": ["jrc10"],
    "espesor_relleno": ["espesorderelleno", "espesorrelleno"],
    "presencia_agua": ["presenciadeagua", "presenciaagua"],
    "rmr76": ["rmr76", "rmr76total"],
    "rmr89": ["rmr89", "rmr89total"],
    "campana": ["campana", "anio"]
}

COLLAR_PATTERNS: Dict[str, List[str]] = {
    "taladro": ["taladro", "sondaje", "drillhole", "holeid", "taladroid", "hole_id", "hole"],
    "eoh": ["eoh", "profundidad_final", "prof_final", "max_depth", "total_depth"]
}

SURVEY_PATTERNS: Dict[str, List[str]] = {
    "taladro": ["taladro", "sondaje", "drillhole", "holeid", "taladroid", "hole_id", "hole"],
    "depth": ["profundidad", "depth", "depthm", "profundidadm", "prof"]
}

FALLBACK_LGG_MAP: Dict[str, int] = {
    "corrida": 1, "taladro": 2, "de": 3, "a": 4, "rec_m": 5, "rqd_m": 6, "lrf_m": 7, "frf": 8,
    "frac_nat": 9, "lito1": 10, "lito2": 11, "lito3": 12, "resistencia": 13, "tipo_est1": 14, "tipo_est2": 15,
    "frac_buz30": 16, "frac_buz60": 17, "frac_buz90": 18, "abertura": 19, "rugosidad": 20, "jrc10": 21,
    "intemperismo": 22, "relleno1": 23, "relleno2": 24, "espesor": 25, "agua_obs": 26, "geologo": 27,
    "comentarios": 28, "campana": 29
}

FALLBACK_LGG_MAP_2026: Dict[str, int] = {
    "taladro": 2, "de": 3, "a": 4, "perf": 5, "rec_m": 7, "rqd_m": 8, "lrf_m": 9, "small_frag_m": 10,
    "sum_frags_total": 11, "frf": 13, "frac_nat": 14, "lito1": 15, "lito2": 16, "lito3": 17,
    "r_indice": 18, "resistencia": 19, "linea_orientacion": 20, "offset": 21, "tipo_est1": 22, "tipo_est2": 23,
    "frac_buz30": 24, "frac_buz60": 25, "frac_buz90": 26, "sum_frac_nat": 27, "abertura": 29, "rugosidad": 30,
    "jrc10": 31, "intemperismo": 33, "relleno1": 35, "relleno2": 36, "espesor": 37, "agua_obs": 39,
    "geologo": 40, "fecha": 41, "turno": 42, "comentarios": 43, "campana": 44, "proyecto": 45
}

FALLBACK_EST_MAP: Dict[str, int] = {
    "taladro": 2, "de": 3, "a": 4, "profundidad": 5, "lito1": 6, "lito2": 7, "lito3": 8, "tipo_estructura": 9,
    "alfa": 10, "beta": 11, "dip": 12, "azimuth": 13, "forma": 14, "rugosidad": 15, "jrc10": 16, "abertura": 17,
    "weathering": 18, "espesor": 19, "relleno1": 20, "relleno2": 21, "dureza_pared": 22, "agua": 23,
    "geotecnico": 24, "comentario": 25, "campana": 26
}

FALLBACK_EST_MAP_2026: Dict[str, int] = {
    "taladro": 2, "de": 3, "a": 4, "corrida_avance": 5, "profundidad": 6, "lito1": 7, "tipo_estructura": 8,
    "alfa": 9, "beta": 10, "forma": 11, "rugosidad": 14, "jrc10": 15, "abertura": 16,
    "weathering": 17, "espesor": 18, "relleno1": 19, "relleno2": 20, "dureza_pared": 21, "agua": 22,
    "geotecnico": 23, "comentario": 24, "corrida": 25, "campana": 26, "proyecto": 27
}

FALLBACK_RMR_MAP: Dict[str, int] = {
    "sondaje": 1, "fecha": 2, "logueador": 3, "corrida": 4, "lito1": 5, "lito2": 6, "lito3": 7,
    "de": 8, "a": 9, "long_corrida": 10, "rec_m": 11, "rec_pct": 12, "rqd_m": 13, "rqd_pct": 14,
    "lrf_m": 15, "frf": 16, "frac_nat": 17, "total_frac": 18, "ff_1m": 19, "espaciamiento_mm": 20,
    "resistencia": 21, "tipo_estructura": 22, "abertura_mm": 23, "rugosidad": 24, "relleno": 25,
    "clasificacion_relleno": 26, "intemperismo": 27, "jrc10": 28, "espesor_relleno": 29, "presencia_agua": 30,
    "r76_resistencia": 32, "r76_rqd": 33, "r76_espaciamiento": 34, "r76_abertura": 35,
    "r76_rugosidad": 36, "r76_relleno": 37, "r76_intemperismo": 38, "r76_persistencia": 39,
    "r76_juntas": 40, "r76_agua": 41, "rmr76": 42, "r76_calidad_roca": 43, "r76_litologia": 44,
    "r89_resistencia": 46, "r89_rqd": 47, "r89_espaciamiento": 48, "r89_abertura": 49,
    "r89_rugosidad": 50, "r89_relleno": 51, "r89_intemperismo": 52, "r89_persistencia": 53,
    "r89_juntas": 54, "r89_agua": 55, "rmr89": 56, "r89_calidad_roca": 57, "campana": 58
}
