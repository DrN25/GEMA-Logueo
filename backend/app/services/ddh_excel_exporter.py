"""
app.services.ddh_excel_exporter
Generador y exportador de reportes ejecutivos y técnicos en Excel (.xlsx) para auditoría DDH (LGG, Estructural y RMR).
Desacoplado de la capa de routers para seguir los principios de Clean Architecture y SRP.
"""

import os
import math
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.chart import BarChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.utils import get_column_letter
from collections import Counter, defaultdict
from typing import Optional, Any, List, Dict

from app.core.rules import MASTER_ERROR_RULES, get_rule_by_msg
from app.reportes.vacios_analysis import compute_analysis
from app.reportes.vacios_sheet import crear_hoja_analisis_vacios
from app.core.engine.rules.common import safe_str, safe_float, safe_int

def simplify_message(msg):
    msg_clean = str(msg or "").strip()
    msg_up = msg_clean.upper()

    # --- REGLAS RMR Y CRUCE RMR-LGG ---
    if "DESCUADRE EN RMR'76" in msg_up or "DESCUADRE EN RMR 76" in msg_up or ("DESCUADRE" in msg_up and "76" in msg_up) or "RMR'76" in msg_up or "RMR 76" in msg_up:
        return "Descuadre en RMR'76: la suma de sub-ratings registrados no coincide con el total reportado."
    if "DESCUADRE EN RMR'89" in msg_up or "DESCUADRE EN RMR 89" in msg_up or ("DESCUADRE" in msg_up and "89" in msg_up) or "RMR'89" in msg_up or "RMR 89" in msg_up:
        return "Descuadre en RMR'89: la suma de sub-ratings registrados no coincide con el total reportado."

    if "ESPACIAMIENTO" in msg_up and ("NO COINCIDE CON LA FÓRMULA" in msg_up or "NO COINCIDE CON LA FORMULA" in msg_up or "LONG.CORRIDA" in msg_up):
        return "Espaciamiento de fracturas en RMR no coincide con la fórmula calculada."
    if "COMBINACIÓN LITOLÓGICA EN RMR" in msg_up or "COMBINACION LITOLOGICA EN RMR" in msg_up or ("COMBINACIÓN LITOL" in msg_up and "RMR" in msg_up and "LGG" in msg_up):
        return "Combinación litológica en RMR no coincide con LGG."
    if "TOTAL DE FRACTURAS EN RMR" in msg_up and "NO COINCIDE CON" in msg_up:
        return "Total de Fracturas en RMR no coincide con la suma calculada (FRF + FracNat)."
    if "FRACTURAS NATURALES EN RMR" in msg_up and ("NO COINCIDE" in msg_up or "FRAC NAT" in msg_up):
        return "Fracturas Naturales en RMR no coincide con LGG."
    if "FRF EN RMR" in msg_up and "NO COINCIDE CON" in msg_up:
        return "FRF en RMR no coincide con LGG."
    if "RQD (M) EN RMR" in msg_up and "NO COINCIDE" in msg_up:
        return "Metraje RQD (m) en RMR no coincide con LGG."
    if ("REC (M) EN RMR" in msg_up or "RECUPERACIÓN EN RMR" in msg_up or "RECUPERACION EN RMR" in msg_up) and "NO COINCIDE" in msg_up:
        return "Recuperación (m) en RMR no coincide con LGG."
    if "LONGITUD DE TRAMO FRACTURADO" in msg_up and ("RMR" in msg_up or "LRF" in msg_up) and "NO COINCIDE" in msg_up:
        return "Longitud de Tramo Fracturado (LRF) en RMR no coincide con LGG."
    if "ABERTURA EN RMR" in msg_up and "NO COINCIDE" in msg_up:
        return "Abertura de junta en RMR no coincide con LGG."
    if "ESPESOR DE RELLENO EN RMR" in msg_up and "NO COINCIDE" in msg_up:
        return "Espesor de relleno en RMR no coincide con LGG."
    if "RUGOSIDAD EN RMR" in msg_up and "NO COINCIDE" in msg_up:
        return "Rugosidad en RMR no coincide con LGG."
    if "INTEMPERISMO EN RMR" in msg_up and "NO COINCIDE" in msg_up:
        return "Intemperismo en RMR no coincide con LGG."
    if "TIPO DE ESTRUCTURA EN RMR" in msg_up and "NO COINCIDE" in msg_up:
        return "Tipo de Estructura en RMR no coincide con LGG."
    if ("TIPO DE RELLENO EN RMR" in msg_up or "RELLENO EN RMR" in msg_up) and "NO COINCIDE" in msg_up:
        return "Tipo de Relleno en RMR no coincide con LGG."
    if "RESISTENCIA EN RMR" in msg_up and "NO COINCIDE" in msg_up:
        return "Resistencia ISRM en RMR no coincide con LGG."
    if "JRC10 EN RMR" in msg_up and "NO COINCIDE" in msg_up:
        return "JRC10 en RMR no coincide con LGG."
    if "CORRIDA EN VALIDACIÓN RMR" in msg_up or "CORRIDA EN VALIDACION RMR" in msg_up or ("CORRIDA EN" in msg_up and "RMR" in msg_up and "NO COINCIDE CON NINGUNA" in msg_up):
        return "Corrida en Validación RMR no coincide con ninguna corrida registrada en LGG."
    if "INTERVALO DESDE/HASTA" in msg_up and "RMR" in msg_up and "NO COINCIDE" in msg_up:
        return "Intervalo Desde/Hasta en RMR no coincide con el intervalo de LGG."
    if "LA LONGITUD DE CORRIDA" in msg_up and "NO COINCIDE CON (HASTA - DESDE" in msg_up:
        return "Longitud de corrida en RMR no coincide con (Hasta - Desde)."
    if "RQD (%) EN RMR" in msg_up and ("NO COINCIDE CON LA FÓRMULA" in msg_up or "NO COINCIDE CON LA FORMULA" in msg_up):
        return "RQD (%) en RMR no coincide con la fórmula calculada."
    if "REC (%) EN RMR" in msg_up and ("NO COINCIDE CON LA FÓRMULA" in msg_up or "NO COINCIDE CON LA FORMULA" in msg_up):
        return "Recuperación (%) en RMR no coincide con la fórmula calculada."
    if "FF/1M EN RMR" in msg_up and "NO COINCIDE CON" in msg_up:
        return "FF/1m en RMR no coincide con la fórmula calculada."
    if "CLASIFICACIÓN DE RELLENO" in msg_up or "CLASIFICACION DE RELLENO" in msg_up:
        return "Clasificación de Relleno en RMR no coincide con el código esperado."
    if "PRESENCIA DE AGUA EN RMR" in msg_up:
        if "TABLA DE PROFUNDIDAD" in msg_up or "CÓDIGO ESPERADO" in msg_up or "CODIGO ESPERADO" in msg_up or "ESPERADO" in msg_up:
            return "Presencia de Agua en RMR no coincide con la tabla de profundidad teórica."
        return "Presencia de Agua en RMR difiere de las observaciones de LGG."
    
    # 0. Regla DEP_VACIA (Campo erróneo debido a dependencias vacías o mal calculadas)
    if "DEPENDENCIAS VACIAS" in msg_up or "DEPENDENCIAS VACÍAS" in msg_up or "CAMPO ERRONEO DEBIDO" in msg_up or "CAMPO ERRÓNEO DEBIDO" in msg_up:
        return "Campo erróneo debido a dependencias vacías o mal calculadas en LGG/RMR."

    # 1. Sin Información (-1) -> Exclusivo para celdas con -1 o sin dato registrado (-1)
    if "SIN INFORMACION" in msg_up or "SIN INFORMACIÓN" in msg_up or "NO CONTIENE INFORMACIÓN" in msg_up or "NO CONTIENE INFORMACION" in msg_up or "(-1)" in msg_up:
        return "Campo obligatorio sin información (-1)."

    # 2. Campos obligatorios vacíos (Celda totalmente nula o vacía)
    if "VACIO" in msg_up or "VACÍO" in msg_up:
        return "Campo obligatorio se encuentra vacío."

    # 3. Validación RMR -> Reglas agrupadas sin parámetros dinámicos
    if "LONGITUD DE CORRIDA" in msg_up and ("HASTA" in msg_up or "DESDE" in msg_up or "TOLERANCIA" in msg_up or "NO COINCIDE CON" in msg_up):
        return "Longitud de corrida en RMR no coincide con (Hasta - Desde)."
    if "INTERVALO DESDE/HASTA" in msg_up or ("INTERVALO" in msg_up and "RMR" in msg_up and "LGG" in msg_up):
        return "Intervalo Desde/Hasta en RMR no coincide con el intervalo de LGG."
    if "CORRIDA EN VALIDACIÓN RMR" in msg_up or "CORRIDA EN VALIDACION RMR" in msg_up or ("RMR" in msg_up and "CORRIDA" in msg_up and "NO COINCIDE" in msg_up):
        return "Corrida en Validación RMR no coincide con ninguna corrida registrada en LGG."
    if "PRESENCIA DE AGUA EN RMR" in msg_up or "PRESENCIA DE AGUA" in msg_up:
        if "TABLA DE PROFUNDIDAD" in msg_up or "CÓDIGO ESPERADO" in msg_up or "CODIGO ESPERADO" in msg_up or "ESPERADO" in msg_up:
            return "Presencia de Agua en RMR no coincide con la tabla de profundidad teórica."
        return "Presencia de Agua en RMR difiere de las observaciones de LGG."
    if "INCOMPATIBILIDAD DE LITOLOGÍA ENTRE LA CORRIDA Y LA JUNTA" in msg_up or "INCOMPATIBILIDAD DE LITOLOGIA ENTRE LA CORRIDA Y LA JUNTA" in msg_up or ("INCOMPATIBILIDAD" in msg_up and "LITOLOG" in msg_up and "JUNTA" in msg_up):
        return "Incompatibilidad de litología entre la corrida y la junta."
    if "LITOLOGÍA DE JUNTA" in msg_up or "LITOLOGIA DE JUNTA" in msg_up or ("LITOLOG" in msg_up and "JUNTA" in msg_up):
        return "Litología de junta no coincide con las litologías registradas en LGG para la corrida."
    if "COMBINACIÓN LITOLÓGICA EN RMR" in msg_up or "COMBINACION LITOLOGICA EN RMR" in msg_up:
        return "Combinación litológica en RMR no coincide con LGG."
    if "LITOLOGÍA" in msg_up or "LITOLOGIA" in msg_up:
        return "Litología en RMR difiere de Litho 1 en LGG."
    if "ESPESOR DE RELLENO EN RMR" in msg_up:
        return "Espesor de relleno en RMR no coincide con LGG."
    if "ABERTURA EN RMR" in msg_up:
        return "Abertura de junta en RMR no coincide con LGG."
    if "FRACTURAS NATURALES EN RMR" in msg_up:
        return "Fracturas Naturales en RMR no coincide con LGG."
    if "REC (M) EN RMR" in msg_up or "RECUPERACIÓN DE LGG" in msg_up or ("REC" in msg_up and "RMR" in msg_up and "COINCIDE" in msg_up):
        return "Recuperación Rec (m) en RMR no coincide con LGG."
    if "RQD (M) EN RMR" in msg_up or "RQD DE LGG" in msg_up or ("RQD" in msg_up and "RMR" in msg_up and "COINCIDE" in msg_up):
        return "Metraje RQD (m) en RMR no coincide con LGG."
    if "LONGITUD DE TRAMO FRACTURADO" in msg_up:
        return "Longitud de Tramo Fracturado LRF en RMR no coincide con LGG."
    if "FRF EN RMR" in msg_up:
        return "FRF en RMR no coincide con LGG."
    if "TOTAL DE FRACTURAS EN RMR" in msg_up:
        return "Total de Fracturas en RMR no coincide con la suma calculada."
    if "FF/1M EN RMR" in msg_up:
        return "Frecuencia de Fracturas FF/1m en RMR no coincide con la fórmula."
    if "ESPACIAMIENTO EN RMR" in msg_up:
        return "Espaciamiento en RMR no coincide con la fórmula calculada."
    if "RESISTENCIA EN RMR" in msg_up:
        return "Resistencia ISRM en RMR no coincide con LGG."
    if "TIPO DE ESTRUCTURA EN RMR" in msg_up:
        return "Tipo de Estructura en RMR no coincide con LGG."
    if "RUGOSIDAD EN RMR" in msg_up:
        return "Rugosidad en RMR no coincide con LGG."
    if "RELLENO EN RMR" in msg_up:
        return "Tipo de Relleno en RMR no coincide con LGG."
    if "CLASIFICACIÓN DE RELLENO" in msg_up or "CLASIFICACION DE RELLENO" in msg_up:
        return "Clasificación de Relleno en RMR no coincide con la clase esperada."
    if "INTEMPERISMO EN RMR" in msg_up:
        return "Intemperismo en RMR no coincide con LGG."
    if "JRC10 EN RMR" in msg_up:
        return "JRC10 en RMR no coincide con LGG."
    if "CONDICIÓN DE JUNTAS" in msg_up or "CONDICION DE JUNTAS" in msg_up:
        if "89" in msg_up:
            return "Descuadre en Condición de Juntas (RMR'89): la suma de los 5 parámetros de discontinuidad no coincide con el valor reportado."
        if "76" in msg_up:
            return "Descuadre en Condición de Juntas (RMR'76): la suma de los 5 parámetros de discontinuidad no coincide con el valor reportado."
        return "Descuadre en Condición de Juntas: la suma de los 5 parámetros de discontinuidad no coincide con el valor reportado."
    if "RMR'76" in msg_up or "RMR 76" in msg_up:
        return "Descuadre matemático en RMR'76 registrado."
    if "RMR'89" in msg_up or "RMR 89" in msg_up:
        return "Descuadre matemático en RMR'89 registrado."

    # 4. Negativos agrupados dinámicamente
    if "FRAGMENTOS <10CM" in msg_up and "NEGATIV" in msg_up:
        return "El metraje de fragmentos <10cm no puede ser negativo."
    if "FRACTURAS NATURALES" in msg_up and "NEGATIV" in msg_up:
        return "Campo erróneo debido a dependencias vacías o mal calculadas en LGG/RMR."
    if "LONGITUD RECUPERADA" in msg_up and "NEGATIV" in msg_up:
        return "La longitud recuperada no puede ser negativa."
    if "METRAJE RQD" in msg_up and "NEGATIV" in msg_up:
        return "El metraje RQD no puede ser negativo."
    if "LONGITUD DE ROCA FRACTURADA" in msg_up and "NEGATIV" in msg_up:
        return "La longitud de roca fracturada LRF no puede ser negativa."
    if "VALOR DE FRF" in msg_up and "NEGATIV" in msg_up:
        return "Campo erróneo debido a dependencias vacías o mal calculadas en LGG/RMR."
    if "NEGATIV" in msg_up:
        return "El valor no puede ser negativo."
        
    # 5. Reglas de FRF restantes (Fórmula y formato entero)
    if "FRF" in msg_up:
        if "ENTERO" in msg_up:
            return "El valor de FRF debe ser un número entero."
        return "El valor de FRF no coincide con el calculado por la fórmula."

    # 6. Inconsistencias físicas de metraje (RQD, LRF y Recuperada)
    if "SUPERA LA LONGITUD RECUPERADA" in msg_up:
        return "La suma de fragmentos físicos supera la longitud recuperada."
    if "SUMA DE FRAGMENTOS" in msg_up or "SUMA DE FRAGMENTOS FÍSICOS" in msg_up or "SUMA DE FRAGMENTOS FISICOS" in msg_up:
        return "La suma de fragmentos físicos supera el avance perforado."
    if "RQD" in msg_up and "RECUPERADA" in msg_up:
        return "Metraje RQD es mayor que la longitud recuperada."
    if "LRF" in msg_up and "RECUPERADA" in msg_up:
        return "La longitud de roca fracturada LRF es mayor que la longitud recuperada."
    if "RECUPERADA" in msg_up and "AVANCE" in msg_up:
        return "La longitud recuperada es mayor que el avance perforado."

    # 7. Resto de reglas específicas
    if "RUPTURA DE CONTINUIDAD" in msg_up:
        return "Ruptura de continuidad espacial detectada."
    if "LÍMITE CRÍTICO DE 1.6M" in msg_up or "LIMITE CRITICO DE 1.6M" in msg_up:
        return "Longitud de corrida perforada excede el límite crítico de 1.6m."
    if "POSITIVA" in msg_up or "DEBE SER MAYOR A 0" in msg_up:
        return "Longitud de corrida perforada debe ser positiva."
    if "SUMA DE FRAGMENTOS" in msg_up:
        return "La suma de fragmentos físicos supera el avance perforado."
    if "BUZAMIENTO" in msg_up and "COINCIDE" in msg_up:
        return "La sumatoria de fracturas por buzamiento no coincide con el conteo general."
    if "ESPESOR DE RELLENO" in msg_up and ("ABERTURA ES 0MM" in msg_up or "ABERTURA ES 0 MM" in msg_up or "LA ABERTURA ES 0" in msg_up or "ABERTURA ES 0" in msg_up):
        return "Se declaró espesor de relleno de junta pero la abertura es 0mm."
    if "ABERTURA DE JUNTA" in msg_up and "ESPESOR DE RELLENO ES 0" in msg_up:
        return "La abertura de junta es mayor a 0mm pero no se ha registrado espesor de relleno."
    if "RESISTENCIA ISRM NO VÁLIDO" in msg_up or "RESISTENCIA ISRM NO VALIDO" in msg_up or "RESISTENCIA ISRM" in msg_up and "INVALIDO" in msg_up:
        return "Código de Resistencia ISRM no válido."
    if "METEORIZACIÓN NO VÁLIDO" in msg_up or "METEORIZACION NO VALIDO" in msg_up or "METEORIZACION" in msg_up and "INVALIDO" in msg_up:
        return "Código de Meteorización no válido."
    if "TIPO DE RELLENO NO VÁLIDO" in msg_up or "TIPO DE RELLENO NO VALIDO" in msg_up or "TIPO DE RELLENO" in msg_up and "INVALIDO" in msg_up:
        return "Código de Tipo de Relleno no válido."
    if "PRESENCIA DE AGUA" in msg_up and ("TABLA TEÓRICA" in msg_up or "TABLA TEORICA" in msg_up):
        return "Presencia de Agua en RMR no coincide con tabla teórica."
    if "PRESENCIA DE AGUA NO VÁLIDO" in msg_up or "PRESENCIA DE AGUA NO VALIDO" in msg_up or "PRESENCIA DE AGUA" in msg_up and "INVALIDO" in msg_up:
        return "Código de Presencia de Agua no válido."
    if "ESTRUCTURA 1 NO VÁLIDO" in msg_up or "ESTRUCTURA 1 NO VALIDO" in msg_up or "ESTRUCTURA 1" in msg_up and "INVALIDO" in msg_up:
        return "Código de estructura 1 no válido."
    if "ESTRUCTURA 2 NO VÁLIDO" in msg_up or "ESTRUCTURA 2 NO VALIDO" in msg_up or "ESTRUCTURA 2" in msg_up and "INVALIDO" in msg_up:
        return "Código de estructura 2 no válido."
    if "RUGOSIDAD NO VÁLIDO" in msg_up or "RUGOSIDAD NO VALIDO" in msg_up or "RUGOSIDAD" in msg_up and "INVALIDO" in msg_up:
        return "Código de Rugosidad no válido."
    if "JRC10" in msg_up and "RANGO" in msg_up or "JRC10" in msg_up and "INVÁLIDO" in msg_up or "JRC10" in msg_up and "INVALIDO" in msg_up:
        return "El valor de JRC10 es inválido. No se permiten valores mayores a 20."
    if "JRC10" in msg_up and "NEGATIVO" in msg_up:
        return "El valor de JRC10 no puede ser negativo."
    if "FORMA DE JUNTA NO VÁLIDA" in msg_up or "FORMA DE JUNTA NO VALIDA" in msg_up or "FORMA DE JUNTA" in msg_up and "INVALIDO" in msg_up:
        return "Forma de junta no válida. Permitidos: Plano (1) a Irregular (6)."
    if "NO SE HA REGISTRADO ESPESOR DE RELLENO" in msg_up or "LA ABERTURA DE JUNTA ES MAYOR A 0MM" in msg_up:
        return "La abertura de junta es mayor a 0mm pero no se ha registrado espesor de relleno."

    if "ESPESOR DE RELLENO NO PUEDE SER MAYOR" in msg_up or ("ESPESOR DE RELLENO" in msg_up and "ABERTURA DE JUNTA" in msg_up and "MAYOR" in msg_up):
        if "EXCEPTO" in msg_up or "ESTRUCTURAS" in msg_up:
            return "El espesor de relleno no puede ser mayor que la abertura de junta excepto en estructuras F, RF, VN, SZ, F+10 o BED."
        return "El espesor de relleno no puede ser mayor que la abertura de junta."
    if "SIN DEFINIR" in msg_up or "O ES CWF" in msg_up:
        return "Se declaró espesor de relleno pero el tipo de relleno está sin definir o es CWF."
    if "TIPO DE RELLENO" in msg_up and ("ABERTURA DE JUNTA ES 0" in msg_up or "ABERTURA ES 0" in msg_up or "ABERTURA DE JUNTA ES 0" in msg_up):
        return "El tipo de relleno está definido pero la abertura de junta es 0mm."
    if "DUREZA DE PARED" in msg_up and ("SUPERA" in msg_up or "INCOMPATIBILIDAD GEOLÓGICA" in msg_up or "INCOMPATIBILIDAD GEOLOGICA" in msg_up):
        return "Incompatibilidad geológica (Dureza de pared de junta supera la resistencia maxima estimada de la corrida en LGG)."
    if "INCOMPATIBILIDAD DE LITOLOGÍA ENTRE LA CORRIDA Y LA JUNTA" in msg_up or "INCOMPATIBILIDAD DE LITOLOGIA ENTRE LA CORRIDA Y LA JUNTA" in msg_up or ("INCOMPATIBILIDAD" in msg_up and "LITOLOG" in msg_up and "JUNTA" in msg_up):
        return "Incompatibilidad de litología entre la corrida y la junta."
    if "HUÉRFANA" in msg_up or "HUERFANA" in msg_up:
        return "Profundidad huérfana de junta no corresponde a ningún tramo de corrida en LGG."
    if "NO EXISTE DE FORMA EXACTA" in msg_up or "PAR DE CORRIDA" in msg_up or "COINCIDE EXACTAMENTE" in msg_up or "CORRIDA ASOCIADA" in msg_up:
        return "La corrida asociada (de/a) no existe de forma exacta en las corridas de LGG para el taladro."
    if "FUERA DEL TRAMO" in msg_up or "TRAMO DE CORRIDA ESPECIFICADO" in msg_up:
        return "La profundidad se encuentra fuera del tramo de corrida especificado."
    if "ALFA" in msg_up and ("INVÁLIDO" in msg_up or "INVALIDO" in msg_up):
        return "El ángulo Alfa es inválido. Debe estar entre 0° y 90°."
    if "ALFA" in msg_up and "ENTERO" in msg_up:
        return "El ángulo Alfa debería ser un número entero."
    if "BETA" in msg_up and ("INVÁLIDO" in msg_up or "INVALIDO" in msg_up):
        return "El ángulo Beta es inválido. Debe estar entre 0° y 360°."
    if "BETA" in msg_up and "ENTERO" in msg_up:
        return "El ángulo Beta debería ser un número entero."
    if "DIP" in msg_up:
        return "El ángulo Dip es inválido. Debe estar entre 0° y 90°."
    if "AZIMUT" in msg_up or "AZIMUTH" in msg_up:
        return "El ángulo Azimut es inválido. Debe estar entre 0° y 360°."
    if "PROFUNDIDADES FINALES" in msg_up or "COINCIDEN ENTRE MÓDULOS" in msg_up:
        return "Las profundidades finales del taladro no coinciden entre módulos (LGG, Estructural, Collar, Survey)."
    if "EXCEDE EL LÍMITE FINAL REGISTRADO EN LGG" in msg_up or "EXCEDE EL LIMITE FINAL REGISTRADO EN LGG" in msg_up:
        return "La profundidad en logueo estructural excede el límite final registrado en LGG."
    if "DISCREPANCIA EN LONGITUD DE AVANCE DE CORRIDA" in msg_up:
        return "Discrepancia en longitud de avance de corrida (Estructural vs LGG)."
    if "REGISTRO DE ESTRUCTURA ORIENTADA" in msg_up or "NO ORIENTADA" in msg_up:
        return "Registro de estructura orientada en corrida con línea de orientación 'N'."
    if "LÍMITE CRÍTICO DE 1.6M" in msg_up or "LIMITE CRITICO DE 1.6M" in msg_up:
        return "Longitud de corrida perforada excede el límite crítico de 1.6m."
    if "LITOLOGÍA DE JUNTA" in msg_up or "LITOLOGIA DE JUNTA" in msg_up:
        return "Incompatibilidad de litología entre la corrida y la junta."
    if "SUMA DE FRAGMENTOS" in msg_up and "NO COINCIDE CON RQD" in msg_up:
        return "La suma de fragmentos no coincide con RQD+LRF+Frag<10cm."
    if "ÍNDICE R" in msg_up or "INDICE R" in msg_up:
        return "El índice R no coincide con el código ISRM registrado en Resistencia."
    if "LÍNEA DE ORIENTACIÓN NO VÁLIDA" in msg_up or "LINEA DE ORIENTACION NO VALIDA" in msg_up:
        return "Línea de orientación no válida."
    if "SUMA DE FRACTURAS NATURALES" in msg_up:
        return "La suma de fracturas naturales no coincide con el número registrado."
    if "VALOR DE PERF." in msg_up:
        return "El valor de Perf. no coincide con el avance calculado A - De."
    if "OFFSET" in msg_up:
        return "El valor de Offset debe estar entre 0° y 360°."
    if "ENTERO" in msg_up:
        return "El valor del campo debe ser un número entero."
        
    return msg_clean

def get_safe_sheet_name(title, index):
    clean_title = "".join(c for c in title if c not in r':\/?*[]\'"').strip()
    suffix = f" ({index})"
    max_title_len = 31 - len(suffix)
    return f"{clean_title[:max_title_len].strip()}{suffix}"

def get_module_label(rule):
    matches = rule.get("matches", [])
    if matches:
        modulos = set(m.get("modulo", "") for m in matches if m.get("modulo"))
        clean_mods = []
        for m in modulos:
            m_up = m.upper()
            if "RMR" in m_up:
                clean_mods.append("RMR")
            elif "ESTRUCTURAL" in m_up or "EST" in m_up:
                clean_mods.append("Estructural")
            elif "LGG" in m_up:
                clean_mods.append("LGG")
            elif "COLLAR" in m_up or "SURVEY" in m_up:
                clean_mods.append("Collar / Survey")
            else:
                clean_mods.append(m)
        if clean_mods:
            return " / ".join(sorted(set(clean_mods)))
    
    msg_up = str(rule.get("msg", "")).upper()
    if "RMR" in msg_up:
        return "RMR"
    if "ESTRUCTURAL" in msg_up or "ALFA" in msg_up or "BETA" in msg_up or "HUÉRFANA" in msg_up or "HUERFANA" in msg_up:
        return "Estructural"
    if "COLLAR" in msg_up or "SURVEY" in msg_up or "EOH" in msg_up:
        return "Collar / Survey"
    return "LGG"

def generar_excel_reporte_core(diag: dict, compact: dict, filtered: list):
    font_title = Font(name="Segoe UI", size=16, bold=True, color="1B365D")
    font_subtitle = Font(name="Segoe UI", size=10, italic=True, color="555555")
    font_section = Font(name="Segoe UI", size=11, bold=True, color="1B365D")
    font_header = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    font_bold = Font(name="Segoe UI", size=10, bold=True, color="000000")
    font_regular = Font(name="Segoe UI", size=10, color="000000")
    font_kpi_lbl = Font(name="Segoe UI", size=9, bold=True, color="555555")
    
    font_kpi_val_blue = Font(name="Segoe UI", size=18, bold=True, color="1B365D")
    font_kpi_val_green = Font(name="Segoe UI", size=18, bold=True, color="375623")
    font_kpi_val_red = Font(name="Segoe UI", size=18, bold=True, color="C00000")
    font_kpi_val_orange = Font(name="Segoe UI", size=18, bold=True, color="C65911")

    fill_primary = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    fill_accent_green = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
    fill_accent_yellow = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
    fill_accent_orange = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
    fill_accent_red = PatternFill(start_color="F2DCDB", end_color="F2DCDB", fill_type="solid")
    fill_zebra = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")
    fill_kpi_gray = PatternFill(start_color="F2F4F7", end_color="F2F4F7", fill_type="solid")

    border_thin = Border(
        left=Side(style='thin', color='E2E8F0'), 
        right=Side(style='thin', color='E2E8F0'), 
        top=Side(style='thin', color='E2E8F0'), 
        bottom=Side(style='thin', color='E2E8F0')
    )
    border_kpi = Border(
        left=Side(style='thin', color='B0C4DE'),
        right=Side(style='thin', color='B0C4DE'),
        top=Side(style='thin', color='B0C4DE'),
        bottom=Side(style='thin', color='B0C4DE')
    )

    alignment_center = Alignment(horizontal="center", vertical="center")
    alignment_left = Alignment(horizontal="left", vertical="center")
    alignment_right = Alignment(horizontal="right", vertical="center")

    wb = openpyxl.Workbook()
    
    def write_kpi_card_opt(ws, start_row, start_col, label, value, bg_fill, val_font):
        c1 = ws.cell(row=start_row, column=start_col, value=label)
        c1.font = font_kpi_lbl
        c1.alignment = alignment_center
        
        c2 = ws.cell(row=start_row+1, column=start_col, value=value)
        c2.font = val_font
        c2.alignment = alignment_center
        
        for r in range(start_row, start_row+2):
            for c in range(start_col, start_col+2):
                cell = ws.cell(row=r, column=c)
                cell.fill = bg_fill
                cell.border = border_kpi
                
        ws.merge_cells(start_row=start_row, start_column=start_col, end_row=start_row, end_column=start_col+1)
        ws.merge_cells(start_row=start_row+1, start_column=start_col, end_row=start_row+1, end_column=start_col+1)

    # --- HOJA 1: DASHBOARD EJECUTIVO ---
    ws_dash = wb.active
    ws_dash.title = "📊 Dashboard Ejecutivo"
    ws_dash.views.sheetView[0].showGridLines = True
    
    ws_dash.cell(row=2, column=2, value="SISTEMA DE REVISIÓN Y AUDITORÍA").font = font_title
    ws_dash.cell(row=3, column=2, value="Dashboard de Control de Calidad y Consistencia Geomecánica").font = font_subtitle
    
    total_filas = compact.get("familia1", {}).get("total_discontinuidades", 0)
    total_fields = compact.get("familia2", {}).get("total_fields", 0)
    total_vacios = sum(1 for i in filtered if i.get("tipo_incidencia") == "VACIO")
    total_advertencias = sum(1 for i in filtered if i.get("tipo_incidencia") == "ADVERTENCIA")
    total_alertas = sum(1 for i in filtered if i.get("tipo_incidencia") == "ALERTA")
    total_correctos = total_fields - (total_vacios + total_advertencias + total_alertas)
    pct_integridad = (total_correctos / max(1, total_fields)) * 100

    write_kpi_card_opt(ws_dash, 5, 2, "TALADROS EVALUADOS", len(compact.get("resumen_por_celda_padre", {})), fill_kpi_gray, font_kpi_val_blue)
    write_kpi_card_opt(ws_dash, 5, 4, "FILAS DE LOGUEO EVALUADAS", total_filas, fill_kpi_gray, font_kpi_val_blue)
    write_kpi_card_opt(ws_dash, 5, 6, "INTEGRIDAD GLOBAL DE CAMPOS", f"{pct_integridad:.2f}%", fill_accent_green, font_kpi_val_green)
    write_kpi_card_opt(ws_dash, 5, 8, "ALERTAS CRÍTICAS", total_alertas, fill_accent_red, font_kpi_val_red)
    write_kpi_card_opt(ws_dash, 5, 10, "ADVERTENCIAS DE CONSISTENCIA", total_advertencias, fill_accent_orange, font_kpi_val_orange)

    # Tabla: Distribución por Campaña
    ws_dash.cell(row=9, column=2, value="DESEMPEÑO DE CONTROL POR CAMPAÑA").font = font_section
    headers_camp = ["Campaña", "Estructuras/Corridas", "Alertas (N)", "% Alertas", "Vacíos (N)", "% Vacíos"]
    for idx, col in enumerate(headers_camp, start=2):
        cell = ws_dash.cell(row=10, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    r_camp = 11
    dist_camp = compact.get("distribucion_campania", [])
    if isinstance(dist_camp, dict):
        dist_camp = [{"campania": str(k), "discontinuidades": v, "alertas_cant": 0, "alertas_pct": 0, "vacios_cant": 0, "vacios_pct": 0} for k, v in dist_camp.items()]
    for row in (dist_camp or []):
        if not isinstance(row, dict):
            continue
        ws_dash.cell(row=r_camp, column=2, value=row.get("campania")).font = font_bold
        ws_dash.cell(row=r_camp, column=2).alignment = alignment_center
        
        ws_dash.cell(row=r_camp, column=3, value=safe_int(row.get("discontinuidades"))).number_format = '#,##0'
        ws_dash.cell(row=r_camp, column=3).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=4, value=safe_int(row.get("alertas_cant"))).number_format = '#,##0'
        ws_dash.cell(row=r_camp, column=4).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=5, value=safe_float(row.get("alertas_pct")) / 100.0).number_format = '0.00%'
        ws_dash.cell(row=r_camp, column=5).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=6, value=safe_int(row.get("vacios_cant"))).number_format = '#,##0'
        ws_dash.cell(row=r_camp, column=6).alignment = alignment_right
        
        ws_dash.cell(row=r_camp, column=7, value=safe_float(row.get("vacios_pct")) / 100.0).number_format = '0.00%'
        ws_dash.cell(row=r_camp, column=7).alignment = alignment_right
        
        for col_idx in range(2, 8):
            ws_dash.cell(row=r_camp, column=col_idx).border = border_thin
            if r_camp % 2 == 0:
                ws_dash.cell(row=r_camp, column=col_idx).fill = fill_zebra
        r_camp += 1

    # Tabla: Distribución por Geólogos
    r_sect = r_camp + 2
    ws_dash.cell(row=r_sect, column=2, value="DESEMPEÑO DE CONTROL POR GEÓLOGO").font = font_section
    
    r_sect += 1
    headers_sect = ["Geólogo", "Registros", "Alertas (N)", "% Alertas", "Vacíos (N)", "% Vacíos"]
    for idx, col in enumerate(headers_sect, start=2):
        cell = ws_dash.cell(row=r_sect, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    dist_geo = compact.get("distribucion_geotecnico", [])
    if isinstance(dist_geo, dict):
        dist_geo = [{"geotecnico": str(k), "discontinuidades": v, "alertas_cant": 0, "alertas_pct": 0, "vacios_cant": 0, "vacios_pct": 0} for k, v in dist_geo.items()]
    for row in (dist_geo or []):
        if not isinstance(row, dict):
            continue
        r_sect += 1
        ws_dash.cell(row=r_sect, column=2, value=row.get("geotecnico")).font = font_bold
        ws_dash.cell(row=r_sect, column=2).alignment = alignment_center
        
        ws_dash.cell(row=r_sect, column=3, value=safe_int(row.get("discontinuidades"))).number_format = '#,##0'
        ws_dash.cell(row=r_sect, column=3).alignment = alignment_right
        
        ws_dash.cell(row=r_sect, column=4, value=safe_int(row.get("alertas_cant"))).number_format = '#,##0'
        ws_dash.cell(row=r_sect, column=4).alignment = alignment_right
        
        ws_dash.cell(row=r_sect, column=5, value=safe_float(row.get("alertas_pct")) / 100.0).number_format = '0.00%'
        ws_dash.cell(row=r_sect, column=5).alignment = alignment_right
        
        ws_dash.cell(row=r_sect, column=6, value=safe_int(row.get("vacios_cant"))).number_format = '#,##0'
        ws_dash.cell(row=r_sect, column=6).alignment = alignment_right
        
        ws_dash.cell(row=r_sect, column=7, value=safe_float(row.get("vacios_pct")) / 100.0).number_format = '0.00%'
        ws_dash.cell(row=r_sect, column=7).alignment = alignment_right
        
        for col_idx in range(2, 8):
            ws_dash.cell(row=r_sect, column=col_idx).border = border_thin
            if r_sect % 2 == 0:
                ws_dash.cell(row=r_sect, column=col_idx).fill = fill_zebra
        r_sect += 1

    # Tabla: Taladros más Afectados
    r_worst = r_sect + 2
    ws_dash.cell(row=r_worst-1, column=2, value="PEORES 5 TALADROS CON MAYOR DESVIACIÓN").font = font_section
    headers_worst = ["Taladro", "Registros", "Vacíos", "Advertencias", "Alertas", "Calificación"]
    for idx, col in enumerate(headers_worst, start=2):
        cell = ws_dash.cell(row=r_worst, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    for row in compact.get("worst_cells", [])[:5]:
        r_worst += 1
        ws_dash.cell(row=r_worst, column=2, value=row.get("celda")).font = font_bold
        ws_dash.cell(row=r_worst, column=2).alignment = alignment_center
        
        ws_dash.cell(row=r_worst, column=3, value=safe_int(row.get("total_hijas"))).number_format = '#,##0'
        ws_dash.cell(row=r_worst, column=3).alignment = alignment_right
        
        ws_dash.cell(row=r_worst, column=4, value=safe_int(row.get("vacios"))).number_format = '#,##0'
        ws_dash.cell(row=r_worst, column=4).alignment = alignment_right
        
        ws_dash.cell(row=r_worst, column=5, value=safe_int(row.get("advertencias"))).number_format = '#,##0'
        ws_dash.cell(row=r_worst, column=5).alignment = alignment_right
        
        ws_dash.cell(row=r_worst, column=6, value=safe_int(row.get("alertas"))).number_format = '#,##0'
        ws_dash.cell(row=r_worst, column=6).alignment = alignment_right
        
        status = row.get("estado_celda", "OK")
        status_cell = ws_dash.cell(row=r_worst, column=7, value=status)
        status_cell.font = font_bold
        status_cell.alignment = alignment_center
        if status == "ALERTA": status_cell.fill = fill_accent_red
        elif status == "ADVERTENCIA": status_cell.fill = fill_accent_orange
        else: status_cell.fill = fill_accent_green
        
        for col_idx in range(2, 8):
            ws_dash.cell(row=r_worst, column=col_idx).border = border_thin
            if r_worst % 2 == 0:
                ws_dash.cell(row=r_worst, column=col_idx).fill = fill_zebra

    # Tabla para Gráfica Directa: Top 5 Alertas Críticas
    ws_dash.cell(row=9, column=9, value="PRINCIPALES ALERTAS CRÍTICAS").font = font_section
    headers_graph = ["Anomalía Geotécnica", "Frecuencia"]
    for idx, col in enumerate(headers_graph, start=9):
        cell = ws_dash.cell(row=10, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    top_errs_list = Counter(simplify_message(i.get("mensaje")) for i in filtered if i.get("tipo_incidencia") == "ALERTA").most_common(5)
    r_graph = 11
    for msg, qty in top_errs_list:
        ws_dash.cell(row=r_graph, column=9, value=msg).font = font_regular
        ws_dash.cell(row=r_graph, column=9).border = border_thin
        
        c_qty = ws_dash.cell(row=r_graph, column=10, value=qty)
        c_qty.font = font_bold
        c_qty.alignment = alignment_right
        c_qty.number_format = '#,##0'
        c_qty.border = border_thin
        c_qty.fill = fill_accent_red
        r_graph += 1
        
    for dummy in range(r_graph, 16):
        ws_dash.cell(row=dummy, column=9, value="—").font = font_regular
        ws_dash.cell(row=dummy, column=9).border = border_thin
        ws_dash.cell(row=dummy, column=10, value=0).font = font_regular
        ws_dash.cell(row=dummy, column=10).border = border_thin
        ws_dash.cell(row=dummy, column=10).number_format = '#,##0'

    # Gráfica Nativa de Excel
    chart = BarChart()
    chart.type = "col"
    chart.style = 10
    chart.title = "Distribución de Anomalías Críticas"
    chart.y_axis.title = "Frecuencia"
    chart.x_axis.title = "Regla de Consistencia"
    
    chart_data = Reference(ws_dash, min_col=10, min_row=10, max_row=15)
    chart_cats = Reference(ws_dash, min_col=9, min_row=11, max_row=15)
    chart.add_data(chart_data, titles_from_data=True)
    chart.set_categories(chart_cats)
    chart.legend = None
    chart.width = 15
    chart.height = 11
    ws_dash.add_chart(chart, "I17")

    # --- HOJA 2: REGISTRO MAESTRO DE ERRORES (CATÁLOGO / ÍNDICE) ---
    ws_cat = wb.create_sheet(title="❌ Catálogo de Errores")
    ws_cat.views.sheetView[0].showGridLines = True
    
    ws_cat.cell(row=2, column=2, value="CATÁLOGO DE REGLAS DE CONSISTENCIA").font = font_title
    ws_cat.cell(row=3, column=2, value="Índice maestro de validación geomecánica ordenado por frecuencia. Use los hipervínculos para navegar.").font = font_subtitle
    
    headers_cat = ["ID", "Gravedad", "Módulo Afectado", "Mensaje de Regla Evaluada", "Casos Hallados (N)", "Enlace Detallado"]
    for idx, col in enumerate(headers_cat, start=2):
        cell = ws_cat.cell(row=5, column=idx, value=col)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    incidencias_por_error = defaultdict(list)
    for inc in filtered:
        msg_simplificado = simplify_message(inc.get("mensaje", ""))
        incidencias_por_error[msg_simplificado].append(inc)

    catalog_frequencies = []
    processed_msgs = set()
    for rule in MASTER_ERROR_RULES:
        rule_msg = rule["msg"]
        if rule_msg in processed_msgs:
            continue
        processed_msgs.add(rule_msg)
        matches = incidencias_por_error.get(rule_msg, [])
        catalog_frequencies.append({
            "msg": rule_msg, "severity": rule["severity"], "matches": matches, "count": len(matches)
        })
        
    for msg_simplificado, matches in incidencias_por_error.items():
        if msg_simplificado not in processed_msgs:
            severity = "ALERTA"
            if matches:
                severity = matches[0].get("tipo_incidencia", "ALERTA")
            catalog_frequencies.append({
                "msg": msg_simplificado, "severity": severity, "matches": matches, "count": len(matches)
            })
            processed_msgs.add(msg_simplificado)

    catalog_frequencies = sorted(catalog_frequencies, key=lambda x: x["count"], reverse=True)

    r_cat = 6
    active_sheets_mapping = {}
    
    fill_mod_est = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")

    for c_idx, rule in enumerate(catalog_frequencies, start=1):
        ws_cat.cell(row=r_cat, column=2, value=c_idx).font = font_regular
        ws_cat.cell(row=r_cat, column=2).alignment = alignment_center
        ws_cat.cell(row=r_cat, column=2).border = border_thin
        
        c_sev = ws_cat.cell(row=r_cat, column=3, value=rule["severity"])
        c_sev.font = font_bold
        c_sev.alignment = alignment_center
        c_sev.border = border_thin
        if rule["severity"] == "ALERTA": c_sev.fill = fill_accent_red
        elif rule["severity"] == "ADVERTENCIA": c_sev.fill = fill_accent_orange
        else: c_sev.fill = fill_accent_yellow
        
        mod_label = get_module_label(rule)
        c_mod = ws_cat.cell(row=r_cat, column=4, value=mod_label)
        c_mod.font = font_bold
        c_mod.alignment = alignment_center
        c_mod.border = border_thin
        if "RMR" in mod_label: c_mod.fill = fill_accent_yellow
        elif "Estructural" in mod_label: c_mod.fill = fill_mod_est
        elif "LGG" in mod_label: c_mod.fill = fill_accent_green
        else: c_mod.fill = fill_kpi_gray

        ws_cat.cell(row=r_cat, column=5, value=rule["msg"]).font = font_bold if rule["count"] > 0 else font_regular
        ws_cat.cell(row=r_cat, column=5).border = border_thin
        
        c_count = ws_cat.cell(row=r_cat, column=6, value=rule["count"])
        c_count.font = font_bold
        c_count.alignment = alignment_right
        c_count.number_format = '#,##0'
        c_count.border = border_thin
        
        c_link = ws_cat.cell(row=r_cat, column=7)
        if rule["count"] > 0:
            tab_name = get_safe_sheet_name(rule["msg"], c_idx)
            active_sheets_mapping[rule["msg"]] = {"tab_name": tab_name, "records": rule["matches"]}
            
            c_link.value = f'=HYPERLINK("#\'{tab_name}\'!B2", "🔍 Navegar a Detalles")'
            c_link.font = Font(name="Segoe UI", size=10, bold=True, color="1B365D", underline="single")
            c_link.alignment = alignment_center
        else:
            c_link.value = "Limpio / 0 Incidencias"
            c_link.font = Font(name="Segoe UI", size=9, italic=True, color="7F8C8D")
            c_link.alignment = alignment_center
            c_link.fill = fill_accent_green
            
        c_link.border = border_thin
        r_cat += 1

    # =========================================================================
    # --- HOJA: 🗂️ TALADROS ÚNICOS LGG (CONSOLIDADO 1 FILA POR TALADRO) ---
    # =========================================================================
    ws_lgg_taladros = wb.create_sheet(title="🗂️ Taladros Únicos LGG")
    ws_lgg_taladros.views.sheetView[0].showGridLines = True

    ws_lgg_taladros.cell(row=2, column=2, value="TALADROS EXCLUSIVOS EN LGG (SIN LOGUEO ESTRUCTURAL)").font = font_title
    ws_lgg_taladros.cell(
        row=3, column=2,
        value="Sondajes perforados en Logueo General que no cuentan con discontinuidades registradas en Logueo Estructural."
    ).font = font_subtitle

    c_back_lgg = ws_lgg_taladros.cell(row=2, column=15)
    c_back_lgg.value = '=HYPERLINK("#' + "'❌ Catálogo de Errores'" + '!B2", "⬅ Volver al Catálogo de Errores")'
    c_back_lgg.font = Font(name="Segoe UI", size=10, bold=True, color="1B365D", underline="single")
    c_back_lgg.alignment = alignment_right

    headers_lgg_dh = [
        "N°", "Taladro", "Campaña", "Desde Mín (m)", "Hasta Máx (m)", "Metraje Total (m)",
        "Total Corridas", "Recuperación Total (m)", "RQD Total (m)", "Recup Prom (%)", "RQD Prom (%)",
        "Incidencias LGG", "Estado QA/QC", "Cruce con Estructural"
    ]

    for c_idx, h_text in enumerate(headers_lgg_dh, start=2):
        cell = ws_lgg_taladros.cell(row=5, column=c_idx, value=h_text)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    # Indexar estructuras por taladro para el cruce
    est_dh_counts = defaultdict(int)
    for s_item in diag.get("unique_est_structures", []):
        t_clean = str(s_item.get("taladro", "")).strip().upper()
        if t_clean:
            est_dh_counts[t_clean] += 1

    # Agrupar corridas LGG por taladro
    lgg_by_dh = defaultdict(lambda: {
        "corridas": 0, "desde_min": 999999.0, "hasta_max": -1.0, "campana": "S/C",
        "rec_sum": 0.0, "rqd_sum": 0.0, "len_sum": 0.0, "alertas": 0, "advertencias": 0
    })

    import re
    for run_item in diag.get("unique_lgg_runs", []):
        t_clean = str(run_item.get("taladro", "")).strip().upper()
        if not t_clean:
            continue
        st = lgg_by_dh[t_clean]
        st["corridas"] += 1
        d = run_item.get("de")
        h = run_item.get("a")
        if d is not None: st["desde_min"] = min(st["desde_min"], float(d))
        if h is not None: st["hasta_max"] = max(st["hasta_max"], float(h))
        st["len_sum"] += float(run_item.get("longitud") or 0)
        st["rec_sum"] += float(run_item.get("rec_m") or 0)
        st["rqd_sum"] += float(run_item.get("rqd_m") or 0)

        if st["campana"] == "S/C":
            m_c = re.search(r'FE[A-Z]{2}(\d{2})-', t_clean)
            if m_c:
                st["campana"] = f"20{m_c.group(1)}"

        if run_item.get("estado") == "NO CONFORME":
            st["alertas"] += 1
        elif run_item.get("estado") == "CON OBSERVACIONES":
            st["advertencias"] += 1

    # FILTRAR ÚNICAMENTE TALADROS EXCLUSIVOS EN LGG (SIN ESTRUCTURAS EN LG EST)
    lgg_only_dh = [
        (t_name, data_dh)
        for t_name, data_dh in sorted(lgg_by_dh.items())
        if est_dh_counts.get(t_name, 0) == 0
    ]

    r_lgg_dh = 6
    if lgg_only_dh:
        for idx_dh, (t_name, data_dh) in enumerate(lgg_only_dh, start=1):
            ws_lgg_taladros.cell(row=r_lgg_dh, column=2, value=idx_dh).alignment = alignment_center
            ws_lgg_taladros.cell(row=r_lgg_dh, column=3, value=t_name).alignment = alignment_left
            ws_lgg_taladros.cell(row=r_lgg_dh, column=4, value=data_dh["campana"]).alignment = alignment_center

            c_d = ws_lgg_taladros.cell(row=r_lgg_dh, column=5, value=data_dh["desde_min"] if data_dh["desde_min"] != 999999.0 else 0)
            c_d.alignment = alignment_right
            c_d.number_format = '0.00'

            c_h = ws_lgg_taladros.cell(row=r_lgg_dh, column=6, value=data_dh["hasta_max"] if data_dh["hasta_max"] != -1.0 else 0)
            c_h.alignment = alignment_right
            c_h.number_format = '0.00'

            c_len = ws_lgg_taladros.cell(row=r_lgg_dh, column=7, value=data_dh["len_sum"])
            c_len.alignment = alignment_right
            c_len.number_format = '0.00'

            ws_lgg_taladros.cell(row=r_lgg_dh, column=8, value=data_dh["corridas"]).alignment = alignment_center

            c_rec = ws_lgg_taladros.cell(row=r_lgg_dh, column=9, value=data_dh["rec_sum"])
            c_rec.alignment = alignment_right
            c_rec.number_format = '0.00'

            c_rqd = ws_lgg_taladros.cell(row=r_lgg_dh, column=10, value=data_dh["rqd_sum"])
            c_rqd.alignment = alignment_right
            c_rqd.number_format = '0.00'

            rec_pct = (data_dh["rec_sum"] / data_dh["len_sum"]) if data_dh["len_sum"] > 0 else 0
            c_rec_p = ws_lgg_taladros.cell(row=r_lgg_dh, column=11, value=rec_pct)
            c_rec_p.alignment = alignment_right
            c_rec_p.number_format = '0.0%'

            rqd_pct = (data_dh["rqd_sum"] / data_dh["len_sum"]) if data_dh["len_sum"] > 0 else 0
            c_rqd_p = ws_lgg_taladros.cell(row=r_lgg_dh, column=12, value=rqd_pct)
            c_rqd_p.alignment = alignment_right
            c_rqd_p.number_format = '0.0%'

            total_anom = data_dh["alertas"] + data_dh["advertencias"]
            ws_lgg_taladros.cell(row=r_lgg_dh, column=13, value=total_anom).alignment = alignment_center

            if data_dh["alertas"] > 0:
                est_qa = "NO CONFORME"
                fill_st = fill_accent_red
            elif data_dh["advertencias"] > 0:
                est_qa = "CON OBSERVACIONES"
                fill_st = fill_accent_orange
            else:
                est_qa = "CONFORME"
                fill_st = fill_accent_green

            c_st = ws_lgg_taladros.cell(row=r_lgg_dh, column=14, value=est_qa)
            c_st.alignment = alignment_center
            c_st.font = font_bold
            c_st.fill = fill_st

            # Cruce con Estructural (Exclusivo LGG)
            c_cruce = ws_lgg_taladros.cell(row=r_lgg_dh, column=15)
            c_cruce.alignment = alignment_center
            c_cruce.font = font_bold
            c_cruce.value = "❌ SIN ESTRUCTURAS"
            c_cruce.fill = fill_accent_red

            for col_idx in range(2, 16):
                cell = ws_lgg_taladros.cell(row=r_lgg_dh, column=col_idx)
                cell.border = border_thin
                if cell.font != font_bold:
                    cell.font = font_regular
                if r_lgg_dh % 2 == 0 and col_idx not in (14, 15):
                    cell.fill = fill_zebra

            r_lgg_dh += 1
    else:
        c_msg = ws_lgg_taladros.cell(row=r_lgg_dh, column=2, value="✅ CONFORME: Todos los taladros de Logueo General cuentan con discontinuidades registradas en Logueo Estructural.")
        c_msg.font = font_bold
        c_msg.alignment = alignment_left
        ws_lgg_taladros.merge_cells(start_row=r_lgg_dh, start_column=2, end_row=r_lgg_dh, end_column=15)
        c_msg.fill = fill_accent_green
        for col_idx in range(2, 16):
            ws_lgg_taladros.cell(row=r_lgg_dh, column=col_idx).border = border_thin
        r_lgg_dh += 1

    if r_lgg_dh > 6 and lgg_only_dh:
        ws_lgg_taladros.auto_filter.ref = f"B5:O{r_lgg_dh - 1}"

    for col in ws_lgg_taladros.iter_cols(min_col=2, max_col=15, min_row=5, max_row=min(r_lgg_dh, 100)):
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_lgg_taladros.column_dimensions[col_letter].width = max(12, min(max_len + 3, 30))

    # =========================================================================
    # --- HOJA: 🗂️ TALADROS ÚNICOS ESTRUCTURAL (CONSOLIDADO 1 FILA POR TALADRO) ---
    # =========================================================================
    ws_est_taladros = wb.create_sheet(title="🗂️ Taladros Únicos Estructural")
    ws_est_taladros.views.sheetView[0].showGridLines = True

    ws_est_taladros.cell(row=2, column=2, value="TALADROS EXCLUSIVOS EN ESTRUCTURAL (NO REGISTRADOS EN LGG)").font = font_title
    ws_est_taladros.cell(
        row=3, column=2,
        value="Sondajes de Logueo Estructural que no cuentan con corridas registradas en Logueo General."
    ).font = font_subtitle

    c_back_est = ws_est_taladros.cell(row=2, column=12)
    c_back_est.value = '=HYPERLINK("#' + "'❌ Catálogo de Errores'" + '!B2", "⬅ Volver al Catálogo de Errores")'
    c_back_est.font = Font(name="Segoe UI", size=10, bold=True, color="1B365D", underline="single")
    c_back_est.alignment = alignment_right

    headers_est_dh = [
        "N°", "Taladro", "Campaña", "Profundidad Mín (m)", "Profundidad Máx (m)",
        "Rango Evaluado (m)", "Total Discontinuidades", "Estructuras con Alerta",
        "Estado QA/QC", "Cruce con LGG"
    ]

    for c_idx, h_text in enumerate(headers_est_dh, start=2):
        cell = ws_est_taladros.cell(row=5, column=c_idx, value=h_text)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin

    est_by_dh = defaultdict(lambda: {
        "estructuras": 0, "prof_min": 999999.0, "prof_max": -1.0, "campana": "S/C", "alertas": 0
    })

    for st_item in diag.get("unique_est_structures", []):
        t_clean = str(st_item.get("taladro", "")).strip().upper()
        if not t_clean:
            continue
        st = est_by_dh[t_clean]
        st["estructuras"] += 1
        de_val = st_item.get("de")
        a_val = st_item.get("a")
        p = st_item.get("profundidad")
        d_min = de_val if de_val is not None else p
        a_max = a_val if a_val is not None else p
        if d_min is not None:
            st["prof_min"] = min(st["prof_min"], float(d_min))
        if a_max is not None:
            st["prof_max"] = max(st["prof_max"], float(a_max))
        if st["campana"] == "S/C":
            m_c = re.search(r'FE[A-Z]{2}(\d{2})-', t_clean)
            if m_c:
                st["campana"] = f"20{m_c.group(1)}"
        if st_item.get("estado") == "NO CONFORME":
            st["alertas"] += 1

    # FILTRAR ÚNICAMENTE TALADROS EXCLUSIVOS EN ESTRUCTURAL (NO EXISTEN EN LGG)
    est_only_dh = [
        (t_name, data_dh)
        for t_name, data_dh in sorted(est_by_dh.items())
        if (lgg_by_dh[t_name]["corridas"] if t_name in lgg_by_dh else 0) == 0
    ]

    r_est_dh = 6
    if est_only_dh:
        for idx_dh, (t_name, data_dh) in enumerate(est_only_dh, start=1):
            ws_est_taladros.cell(row=r_est_dh, column=2, value=idx_dh).alignment = alignment_center
            ws_est_taladros.cell(row=r_est_dh, column=3, value=t_name).alignment = alignment_left
            ws_est_taladros.cell(row=r_est_dh, column=4, value=data_dh["campana"]).alignment = alignment_center

            c_p_min = ws_est_taladros.cell(row=r_est_dh, column=5, value=data_dh["prof_min"] if data_dh["prof_min"] != 999999.0 else 0)
            c_p_min.alignment = alignment_right
            c_p_min.number_format = '0.00'

            c_p_max = ws_est_taladros.cell(row=r_est_dh, column=6, value=data_dh["prof_max"] if data_dh["prof_max"] != -1.0 else 0)
            c_p_max.alignment = alignment_right
            c_p_max.number_format = '0.00'

            rango = max(0, data_dh["prof_max"] - data_dh["prof_min"]) if data_dh["prof_max"] != -1.0 else 0
            c_rango = ws_est_taladros.cell(row=r_est_dh, column=7, value=rango)
            c_rango.alignment = alignment_right
            c_rango.number_format = '0.00'

            ws_est_taladros.cell(row=r_est_dh, column=8, value=data_dh["estructuras"]).alignment = alignment_center
            ws_est_taladros.cell(row=r_est_dh, column=9, value=data_dh["alertas"]).alignment = alignment_center

            if data_dh["alertas"] > 0:
                est_qa = "NO CONFORME"
                fill_st = fill_accent_red
            else:
                est_qa = "CONFORME"
                fill_st = fill_accent_green

            c_st = ws_est_taladros.cell(row=r_est_dh, column=10, value=est_qa)
            c_st.alignment = alignment_center
            c_st.font = font_bold
            c_st.fill = fill_st

            # Cruce con LGG (Exclusivo Estructural)
            c_cruce = ws_est_taladros.cell(row=r_est_dh, column=11)
            c_cruce.alignment = alignment_center
            c_cruce.font = font_bold
            c_cruce.value = "❌ NO REGISTRADO EN LGG"
            c_cruce.fill = fill_accent_red

            for col_idx in range(2, 12):
                cell = ws_est_taladros.cell(row=r_est_dh, column=col_idx)
                cell.border = border_thin
                if cell.font != font_bold:
                    cell.font = font_regular
                if r_est_dh % 2 == 0 and col_idx not in (10, 11):
                    cell.fill = fill_zebra

            r_est_dh += 1
    else:
        c_msg_est = ws_est_taladros.cell(row=r_est_dh, column=2, value="✅ CONFORME: Todos los taladros de Logueo Estructural tienen correspondencia en Logueo General (0 taladros huérfanos).")
        c_msg_est.font = font_bold
        c_msg_est.alignment = alignment_left
        ws_est_taladros.merge_cells(start_row=r_est_dh, start_column=2, end_row=r_est_dh, end_column=11)
        c_msg_est.fill = fill_accent_green
        for col_idx in range(2, 12):
            ws_est_taladros.cell(row=r_est_dh, column=col_idx).border = border_thin
        r_est_dh += 1

    if r_est_dh > 6 and est_only_dh:
        ws_est_taladros.auto_filter.ref = f"B5:K{r_est_dh - 1}"

    for col in ws_est_taladros.iter_cols(min_col=2, max_col=11, min_row=5, max_row=min(r_est_dh, 100)):
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_est_taladros.column_dimensions[col_letter].width = max(12, min(max_len + 3, 30))

    # --- HOJA: DETALLE COMPLETO DE INCIDENCIAS ---
    ws_detail = wb.create_sheet(title="📋 Detalle de Incidencias")
    ws_detail.views.sheetView[0].showGridLines = True
    
    ws_detail.cell(row=2, column=2, value="REGISTRO COMPLETO DE INCIDENCIAS").font = font_title
    ws_detail.cell(row=3, column=2, value="Listado plano consolidado de todas las desviaciones y vacíos detectados. Utilice filtros en las cabeceras.").font = font_subtitle
    
    headers_detail = [
        "Fila Excel", "Módulo", "Gravedad", "Taladro Padre", "ID/Prof Hija", "Campaña", 
        "Logger Geotécnico", "Columna de Falla", "Valor Actual", "Mensaje de Inconsistencia"
    ]
    
    ws_detail.append([]) 
    ws_detail.append([None] + headers_detail) 
    grid_heading_row = ws_detail.max_row
    
    for idx in range(2, 12):
        cell = ws_detail.cell(row=grid_heading_row, column=idx)
        cell.font = font_header
        cell.fill = fill_primary
        cell.alignment = alignment_center
        cell.border = border_thin
        
    start_detail_row = ws_detail.max_row + 1
    for inc_item in filtered:
        row_data = [
            None,
            safe_int(inc_item.get("fila_excel")),
            inc_item.get("modulo", "LGG"),
            inc_item.get("tipo_incidencia", "ALERTA"),
            inc_item.get("celda_padre"),
            inc_item.get("celda_hija"),
            inc_item.get("campania"),
            inc_item.get("geotecnico"),
            inc_item.get("columna"),
            inc_item.get("valor_actual") if inc_item.get("valor_actual") is not None else "—",
            simplify_message(inc_item.get("mensaje"))
        ]
        ws_detail.append(row_data)
        
    end_detail_row = ws_detail.max_row
    
    for r_idx in range(start_detail_row, end_detail_row + 1):
        if r_idx <= start_detail_row + 300:
            ws_detail.cell(row=r_idx, column=2).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=3).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=4).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=5).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=6).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=7).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=8).alignment = alignment_left
            ws_detail.cell(row=r_idx, column=9).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=10).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=11).alignment = alignment_left
            
            if r_idx % 2 == 0:
                for col_idx in range(2, 12):
                    if col_idx != 4:
                        ws_detail.cell(row=r_idx, column=col_idx).fill = fill_zebra
        else:
            ws_detail.cell(row=r_idx, column=2).alignment = alignment_center
            ws_detail.cell(row=r_idx, column=4).alignment = alignment_center
            
        cell_sev = ws_detail.cell(row=r_idx, column=4)
        sev = cell_sev.value
        if sev == "ALERTA": cell_sev.fill = fill_accent_red
        elif sev == "ADVERTENCIA": cell_sev.fill = fill_accent_orange
        else: cell_sev.fill = fill_accent_yellow
        cell_sev.font = font_bold
        
        for col_idx in range(2, 12):
            ws_detail.cell(row=r_idx, column=col_idx).border = border_thin
            
    ws_detail.auto_filter.ref = f"B{grid_heading_row}:K{end_detail_row}"

    # --- HOJAS 4+: DETALLES ESPECÍFICOS POR REGLA ---
    for orig_msg, mapping_data in active_sheets_mapping.items():
        sh_name = mapping_data["tab_name"]
        err_records = mapping_data["records"]
        
        ws_err = wb.create_sheet(title=sh_name)
        ws_err.views.sheetView[0].showGridLines = True
        
        c_back = ws_err.cell(row=2, column=2)
        c_back.value = '=HYPERLINK("#\'❌ Catálogo de Errores\'!B2", "⬅ Volver al Catálogo de Errores")'
        c_back.font = Font(name="Segoe UI", size=10, bold=True, color="1B365D", underline="single")
        c_back.alignment = alignment_left
        
        ws_err.cell(row=4, column=2, value="ANÁLISIS DE ANOMALÍA ESPECÍFICA").font = font_section
        cell_err_desc = ws_err.cell(row=5, column=2, value=f"Regla: {orig_msg.upper()}")
        cell_err_desc.font = Font(name="Segoe UI", size=10, bold=True, color="7F1D1D")
        cell_err_desc.fill = fill_accent_red
        cell_err_desc.border = border_thin
        ws_err.merge_cells(start_row=5, start_column=2, end_row=5, end_column=7)
        
        st_affected = len(set(x.get("celda_padre", "N/A") for x in err_records))
        tot_affected = len(err_records)
        
        write_kpi_card_opt(ws_err, 7, 2, "TALADROS AFECTADOS", st_affected, fill_kpi_gray, font_kpi_val_blue)
        write_kpi_card_opt(ws_err, 7, 4, "REGISTROS AFECTADOS", tot_affected, fill_kpi_gray, font_kpi_val_blue)
        
        # Distribución por Campaña
        ws_err.cell(row=10, column=2, value="DISTRIBUCIÓN POR CAMPAÑA").font = font_section
        for idx, col in enumerate(["Campaña / Año", "Ocurrencias", "% Contribución"], start=2):
            cell = ws_err.cell(row=11, column=idx, value=col)
            cell.font = font_header
            cell.fill = fill_primary
            cell.alignment = alignment_center
            cell.border = border_thin
            
        r_dist_yr = defaultdict(int)
        for r in err_records:
            r_dist_yr[str(r.get("campania", "N/A"))] += 1
            
        curr_y_r = 12
        for yr, y_qty in sorted(r_dist_yr.items()):
            ws_err.cell(row=curr_y_r, column=2, value=yr).font = font_bold
            ws_err.cell(row=curr_y_r, column=2).alignment = alignment_center
            ws_err.cell(row=curr_y_r, column=2).border = border_thin
            
            c_yq = ws_err.cell(row=curr_y_r, column=3, value=y_qty)
            c_yq.font = font_regular
            c_yq.alignment = alignment_right
            c_yq.number_format = '#,##0'
            c_yq.border = border_thin
            
            c_yp = ws_err.cell(row=curr_y_r, column=4, value=y_qty / max(1, tot_affected))
            c_yp.font = font_regular
            c_yp.alignment = alignment_right
            c_yp.number_format = '0.00%'
            c_yp.border = border_thin
            curr_y_r += 1

        # Detalle de Registros
        ws_err.append([])
        ws_err.append([None, "REGISTROS INDIVIDUALES AFECTADOS"])
        ws_err.cell(row=ws_err.max_row, column=2).font = font_section
        
        headers_inc = [
            "Fila Excel", "Módulo", "Taladro Padre", "ID/Prof Hija", "Campaña", 
            "Logger Geotécnico", "Columna de Falla", "Valor Actual", "Mensaje de Regla"
        ]
        ws_err.append([None] + headers_inc)
        header_row_idx = ws_err.max_row
        
        for col_idx in range(2, 11):
            cell = ws_err.cell(row=header_row_idx, column=col_idx)
            cell.font = font_header
            cell.fill = fill_primary
            cell.alignment = alignment_center
            cell.border = border_thin
            
        start_data_row = ws_err.max_row + 1
        for inc_item in err_records:
            row_data = [
                None,
                safe_int(inc_item.get("fila_excel")),
                inc_item.get("modulo", "LGG"),
                inc_item.get("celda_padre"),
                inc_item.get("celda_hija"),
                inc_item.get("campania"),
                inc_item.get("geotecnico"),
                inc_item.get("columna"),
                inc_item.get("valor_actual") if inc_item.get("valor_actual") is not None else "—",
                inc_item.get("mensaje")
            ]
            ws_err.append(row_data)
            
        end_data_row = ws_err.max_row
        
        for r_idx in range(start_data_row, end_data_row + 1):
            if r_idx <= start_data_row + 150:
                ws_err.cell(row=r_idx, column=2).alignment = alignment_center
                ws_err.cell(row=r_idx, column=3).alignment = alignment_center
                ws_err.cell(row=r_idx, column=4).alignment = alignment_center
                ws_err.cell(row=r_idx, column=5).alignment = alignment_center
                ws_err.cell(row=r_idx, column=6).alignment = alignment_center
                ws_err.cell(row=r_idx, column=7).alignment = alignment_center
                ws_err.cell(row=r_idx, column=8).alignment = alignment_left
                ws_err.cell(row=r_idx, column=9).alignment = alignment_center
                ws_err.cell(row=r_idx, column=10).alignment = alignment_left
                
                if r_idx % 2 == 0:
                    for col_idx in range(2, 11):
                        ws_err.cell(row=r_idx, column=col_idx).fill = fill_zebra
            else:
                ws_err.cell(row=r_idx, column=2).alignment = alignment_center
                ws_err.cell(row=r_idx, column=4).alignment = alignment_center
                
            for col_idx in range(2, 11):
                ws_err.cell(row=r_idx, column=col_idx).border = border_thin
                
        ws_err.auto_filter.ref = f"B{header_row_idx}:J{end_data_row}"

    # --- HOJA ESPECIAL: ANÁLISIS DE DATOS FALTANTES ---
    try:
        faltantes_extra = diag.get("faltantes_no_obligatorios") or []
        resultado_vacios = compute_analysis(diag, filtered, faltantes_extra)
        crear_hoja_analisis_vacios(wb, resultado_vacios, index=4)
    except Exception as e:
        print(f"[-] Error al generar la hoja de análisis de datos faltantes: {e}", flush=True)

    # Auto-ajuste de Columnas
    for ws in wb.worksheets:
        ws.column_dimensions['A'].width = 3
        for col_idx in range(2, ws.max_column + 1):
            vals = []
            for row_idx in range(1, min(15, ws.max_row + 1)):
                val = ws.cell(row=row_idx, column=col_idx).value
                if val is not None:
                    val_str = str(val)
                    if val_str.startswith("=HYPERLINK"):
                        vals.append("Navegar")
                    else:
                        vals.append(val_str)
            if not vals: continue
            max_len = max(len(v) for v in vals)
            col_letter = get_column_letter(col_idx)
            ws.column_dimensions[col_letter].width = min(max(max_len + 4, 11), 52)

    return wb

# Alias de compatibilidad
export_ddh_reporte_excel = generar_excel_reporte_core
