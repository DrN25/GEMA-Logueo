import math
from typing import Dict, Any

# Catálogos de puntuación estática
STRENGTH_RATINGS = {
    'R0': 0, 'R1': 1, 'R2': 2, 'R3': 4, 'R4': 7, 'R5': 12, 'R6': 15, 
    0: 0, 1: 1, 2: 2, 3: 4, 4: 7, 5: 12, 6: 15, -1: 0, '-1': 0
}

WEATHERING_RATINGS_76 = {'UWF': 5, 'SWD': 4, 'MWM': 3, 'HWA': 1, 'CWC': 0, 'RS': 0, -1: 0, '-1': 0}
WEATHERING_RATINGS_89 = {'UWF': 6, 'SWD': 5, 'MWM': 3, 'HWA': 1, 'CWC': 0, 'RS': 0, -1: 0, '-1': 0}

ROUGHNESS_RATINGS_76 = {1: 5, 2: 4, 3: 3, 4: 4, 5: 3, 6: 1, 7: 3, 8: 1, 9: 0, -1: 0, '-1': 0}
ROUGHNESS_RATINGS_89 = {1: 6, 2: 5, 3: 3, 4: 5, 5: 3, 6: 1, 7: 3, 8: 1, 9: 0, -1: 0, '-1': 0}

FILLING_CLASSES = {
    'ca': 1, 'sand': 1, 'ch': 1, 'cl': 1, 'gy': 1, 'rxf': 1, 'gou': 1, 'pat': 1,
    'CA': 1, 'SAND': 1, 'CH': 1, 'CL': 1, 'GY': 1, 'RXF': 1, 'GOU': 1, 'PAT': 1,
    'fbx': 2, 'sio': 2, 'qz': 2, 'su': 2, 'ox': 2, 'ep': 2,
    'FBX': 2, 'SIO': 2, 'QZ': 2, 'SU': 2, 'OX': 2, 'EP': 2,
    'cwf': 3, 'CWF': 3
}

def calculate_rqd_rating(rqd_pct: float) -> int:
    """Calcula la puntuación polinómica del RQD continuo (0% a 100%)."""
    if rqd_pct < 0:
        return 3
    elif rqd_pct > 100:
        return 20
    val = -0.000006 * (rqd_pct ** 3) + 0.0015 * (rqd_pct ** 2) + 0.0806 * rqd_pct + 3.0282
    return round(val)

def calculate_spacing_rating_76(spacing_mm: float) -> int:
    """Cálculo continuo logarítmico de espaciamiento para RMR'76."""
    if spacing_mm <= 50:
        return 5
    elif spacing_mm >= 3000:
        return 30
    else:
        return round(6.038 * math.log(spacing_mm) - 19.63)

def calculate_spacing_rating_89(spacing_mm: float) -> int:
    """Cálculo continuo de espaciamiento para RMR'89 con capado de error."""
    if spacing_mm <= 0:
        return 5
    elif spacing_mm < 850:
        # Curva cuadrática
        return round(-0.000005 * (spacing_mm ** 2) + 0.0136 * spacing_mm + 5.2849)
    elif spacing_mm <= 2000:
        # Curva lineal
        return round(0.0056 * spacing_mm + 8.8775)
    else:
        # Límite matemático (capado a puntaje máximo de 20 en lugar de error)
        return 20

def calculate_aperture_rating_76(aperture_mm: float) -> int:
    if aperture_mm == 0: return 5
    elif aperture_mm < 0.1: return 4
    elif aperture_mm <= 1.0: return 3
    elif aperture_mm <= 5.0: return 1
    return 0

def calculate_aperture_rating_89(aperture_mm: float) -> int:
    if aperture_mm == 0: return 6
    elif aperture_mm < 0.1: return 5
    elif aperture_mm <= 1.0: return 3
    elif aperture_mm <= 5.0: return 1
    return 0

def calculate_filling_rating_76(filling_code: str, thickness_mm: float) -> int:
    f_class = FILLING_CLASSES.get(filling_code, 1)
    if thickness_mm == 0 or f_class == 3:
        return 5
    if f_class == 2:  # Relleno Duro
        return 4 if thickness_mm <= 5 else 2
    else:             # Relleno Blando
        return 2 if thickness_mm <= 5 else 0

def calculate_filling_rating_89(filling_code: str, thickness_mm: float) -> int:
    f_class = FILLING_CLASSES.get(filling_code, 1)
    if thickness_mm == 0 or f_class == 3:
        return 6
    if f_class == 2:  # Relleno Duro
        return 4 if thickness_mm <= 5 else 2
    else:             # Relleno Blando
        return 2 if thickness_mm <= 5 else 0

def calculate_water_rating(depth_m: float, water_table_m: float = 97.0) -> Dict[str, Any]:
    """Clasifica y puntúa el agua subterránea por profundidad."""
    dry_threshold = water_table_m - 5.0  # 92.0 m
    
    if depth_m < dry_threshold:
        code, score_76, score_89 = 'CDC', 10, 15
    elif depth_m < water_table_m:
        code, score_76, score_89 = 'DPH', 7, 10
    else:
        code, score_76, score_89 = 'WTM', 7, 7
        
    return {"code": code, "score_76": score_76, "score_89": score_89}

def get_rock_class(rmr_score: int) -> str:
    if rmr_score >= 81: return "Muy Buena"
    elif rmr_score >= 61: return "Buena"
    elif rmr_score >= 41: return "Regular"
    elif rmr_score >= 21: return "Mala"
    return "Muy Mala"

def calculate_row_rmr(data: Dict[str, Any], water_table_m: float = 97.0) -> Dict[str, Any]:
    """Calcula el RMR'76 y RMR'89 completo para una fila de LGG."""
    try:
        # Lectura de inputs del grid
        de = float(data.get("de", 0.0))
        a = float(data.get("a", 0.0))
        perf = round(a - de, 2)
        
        # Validar si el avance es ERROR
        if perf > 1.6:
            return {"error": "Longitud de corrida excede 1.6m"}
            
        rec_m = float(data.get("rec_m", 0.0))
        rqd_m = float(data.get("rqd_m", 0.0))
        
        # QA/QC básico
        if rec_m > perf or rqd_m > rec_m:
            return {"error": "Inconsistencia de metrajes: Rec > Perf o RQD > Rec"}
            
        rec_pct = round((rec_m / perf * 100) if perf > 0 else 0)
        rqd_pct = round((rqd_m / perf * 100) if perf > 0 else 0)
        
        # Conteo de fracturas
        lrf_m = float(data.get("lrf_m", 0.0))
        frf = math.floor(round(lrf_m * 100) / 5) + 1 if lrf_m > 0 else 0
        frac_nat = int(data.get("frac_nat", 0))
        total_frac = frac_nat + frf
        spacing_mm = round((perf / total_frac * 1000) if total_frac > 0 else perf * 1000)
        
        strength = data.get("resistencia", "R4")
        aperture = float(data.get("abertura", 0.0))
        roughness = int(data.get("rugosidad", 1))
        filling = data.get("relleno1", "cwf")
        thickness = float(data.get("espesor", 0.0))
        weathering = data.get("intemperismo", "UWF")
        
        # 1. Resistencia Matrix Score
        s_score = STRENGTH_RATINGS.get(strength, 0)
        
        # 2. RQD Score
        rqd_score = calculate_rqd_rating(rqd_pct)
        
        # 3. Espaciamiento Score
        sp_score_76 = calculate_spacing_rating_76(spacing_mm)
        sp_score_89 = calculate_spacing_rating_89(spacing_mm)
        
        # 4. Condición de Juntas (Ratings parciales)
        ab_score_76 = calculate_aperture_rating_76(aperture)
        ab_score_89 = calculate_aperture_rating_89(aperture)
        
        rg_score_76 = ROUGHNESS_RATINGS_76.get(roughness, 0)
        rg_score_89 = ROUGHNESS_RATINGS_89.get(roughness, 0)
        
        fl_score_76 = calculate_filling_rating_76(filling, thickness)
        fl_score_89 = calculate_filling_rating_89(filling, thickness)
        
        wt_score_76 = WEATHERING_RATINGS_76.get(weathering, 0)
        wt_score_89 = WEATHERING_RATINGS_89.get(weathering, 0)
        
        # Persistencia (Promedio)
        p_score_76 = round((ab_score_76 + rg_score_76 + fl_score_76 + wt_score_76) / 4)
        p_score_89 = round((ab_score_89 + rg_score_89 + fl_score_89 + wt_score_89) / 4)
        
        # Sumas de Juntas
        j_score_76 = ab_score_76 + rg_score_76 + fl_score_76 + wt_score_76 + p_score_76
        j_score_89 = ab_score_89 + rg_score_89 + fl_score_89 + wt_score_89 + p_score_89
        
        # 5. Agua Subterránea
        water = calculate_water_rating(a, water_table_m)
        
        # Puntuaciones finales RMR
        rmr_76 = s_score + rqd_score + sp_score_76 + j_score_76 + water["score_76"]
        rmr_89 = s_score + rqd_score + sp_score_89 + j_score_89 + water["score_89"]
        
        return {
            "perf": perf,
            "rec_pct": rec_pct,
            "rqd_pct": rqd_pct,
            "spacing_mm": spacing_mm,
            "frf": frf,
            "total_frac": total_frac,
            "scores": {
                "resistencia": s_score,
                "rqd": rqd_score,
                "spacing_76": sp_score_76,
                "spacing_89": sp_score_89,
                "juntas_76": j_score_76,
                "juntas_89": j_score_89,
                "agua_76": water["score_76"],
                "agua_89": water["score_89"],
                "abertura_76": ab_score_76,
                "abertura_89": ab_score_89,
                "rugosidad_76": rg_score_76,
                "rugosidad_89": rg_score_89,
                "relleno_76": fl_score_76,
                "relleno_89": fl_score_89,
                "weathering_76": wt_score_76,
                "weathering_89": wt_score_89,
                "persistencia_76": p_score_76,
                "persistencia_89": p_score_89
            },
            "rmr_76": rmr_76,
            "rmr_89": rmr_89,
            "class_76": get_rock_class(rmr_76),
            "class_89": get_rock_class(rmr_89),
            "water_code": water["code"]
        }
    except Exception as e:
        return {"error": f"Fallo al procesar RMR: {str(e)}"}
