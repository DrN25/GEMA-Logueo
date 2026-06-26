from typing import List, Dict, Any

# Matriz de compatibilidad entre Resistencia y Meteorización
# Resistencia -> Lista de Meteorizaciones válidas
WEATHERING_COMPATIBILITY = {
    'R0': ['RS', 'CWC'],
    'R1': ['HWA', 'CWC'],
    'R2': ['SWD', 'MWM', 'HWA'],
    'R3': ['MWM', 'SWD', 'UWF'],
    'R4': ['SWD', 'MWM', 'UWF'],
    'R5': ['UWF', 'SWD'],
    'R6': ['UWF']
}

def validate_row_qaqc(data: Dict[str, Any]) -> List[Dict[str, str]]:
    """Ejecuta todos los controles de calidad geomecánicos QA/QC en una corrida."""
    alerts = []
    
    try:
        # Conversión de tipos
        de = float(data.get("de", 0.0))
        a = float(data.get("a", 0.0))
        perf = round(a - de, 2)
        rec_val = float(data.get("rec_m", 0.0))
        rec_m = 0.0 if rec_val < 0 else rec_val

        rqd_val = float(data.get("rqd_m", 0.0))
        rqd_m = 0.0 if rqd_val < 0 else rqd_val

        lrf_val = float(data.get("lrf_m", 0.0))
        lrf_m = 0.0 if lrf_val < 0 else lrf_val

        small_val = float(data.get("small_frag_m", 0.0))
        small_frag_m = 0.0 if small_val < 0 else small_val
        
        fn_val = int(data.get("frac_nat", 0))
        frac_nat = 0 if fn_val < 0 else fn_val

        b30_val = int(data.get("frac_buz30", 0))
        buz30 = 0 if b30_val < 0 else b30_val

        b60_val = int(data.get("frac_buz60", 0))
        buz60 = 0 if b60_val < 0 else b60_val

        b90_val = int(data.get("frac_buz90", 0))
        buz90 = 0 if b90_val < 0 else b90_val
        
        resistencia = data.get("resistencia", "R4")
        weathering = data.get("intemperismo", "UWF")
        
        aperture = float(data.get("abertura", 0.0))
        thickness = float(data.get("espesor", 0.0))
        
        # 1. Validación de Avance
        if perf <= 0:
            alerts.append({
                "type": "CRITICAL",
                "field": "a",
                "message": f"Profundidad final ({a}m) debe ser mayor a la inicial ({de}m)."
            })
        elif perf > 1.6:
            alerts.append({
                "type": "CRITICAL",
                "field": "a",
                "message": f"La longitud de corrida ({perf}m) excede el límite máximo de perforación de 1.6m."
            })
            
        # 2. Validación de Recuperación vs Avance
        if rec_m > perf:
            alerts.append({
                "type": "CRITICAL",
                "field": "rec_m",
                "message": f"Longitud recuperada ({rec_m}m) es físicamente mayor que la perforada ({perf}m)."
            })
            
        # 3. Validación de RQD vs Recuperación
        if rqd_m > rec_m:
            alerts.append({
                "type": "CRITICAL",
                "field": "rqd_m",
                "message": f"El metraje de RQD ({rqd_m}m) no puede ser mayor que la longitud recuperada ({rec_m}m)."
            })
            
        # 4. Validación de Balance Físico del Testigo
        sum_frags = round(rqd_m + lrf_m + small_frag_m, 2)
        if sum_frags > perf:
            alerts.append({
                "type": "CRITICAL",
                "field": "rqd_m",
                "message": f"La suma de fragmentos ({sum_frags}m) supera el avance total de la corrida ({perf}m)."
            })
            
        # 5. Validación de Coherencia de Conteo de Fracturas
        sum_bins = buz30 + buz60 + buz90
        if sum_bins != frac_nat:
            alerts.append({
                "type": "WARNING",
                "field": "frac_nat",
                "message": f"La suma de fracturas naturales clasificadas por buzamiento ({sum_bins}) no coincide con el conteo general ({frac_nat})."
            })
            
        # 6. Validación de Relleno vs Abertura de la Junta
        # Si espesor > 0, abertura debe ser > 0.
        # Si espesor == 0, abertura debe ser 0. (Validación rígida del Excel original)
        if thickness > 0 and aperture <= 0:
            alerts.append({
                "type": "WARNING",
                "field": "abertura",
                "message": f"Se ha registrado un espesor de relleno de {thickness}mm, pero la abertura de junta es 0mm."
            })
        elif thickness == 0 and aperture > 0:
            alerts.append({
                "type": "WARNING",
                "field": "espesor",
                "message": f"La abertura de junta es {aperture}mm, pero no se ha registrado espesor de relleno."
            })
            
        # 7. Validación de Compatibilidad Dureza vs Meteorización
        valid_weatherings = WEATHERING_COMPATIBILITY.get(resistencia)
        if valid_weatherings and weathering not in valid_weatherings:
            alerts.append({
                "type": "WARNING",
                "field": "intemperismo",
                "message": f"Incompatibilidad geológica: Roca con resistencia {resistencia} no puede registrar intemperismo {weathering}. Permitidos: {', '.join(valid_weatherings)}."
            })
            
    except Exception as e:
        alerts.append({
            "type": "CRITICAL",
            "field": "global",
            "message": f"Error al procesar reglas de consistencia: {str(e)}"
        })
        
    return alerts
