"""
test_cruce_collar_survey.py
Suite de pruebas unitarias y de integración para el lector de Collar/Survey,
la regla R301 de cruce EOH, la estructura 'cruce_collar_survey' y la resolución de campañas.
"""

import pytest
import openpyxl
from app.core.adapters.excel.collar_survey_reader import read_collar_sheet, read_survey_sheet
from app.core.engine.rules.eoh_rules import CrossModule_EOHRule, TOLERANCIA_EOH_METROS
from app.core.engine.context import ValidationContext
from app.services.ddh_audit_service import is_year_match


# =============================================================================
# 1. TEST LECTOR: Mapeo arbitrario / personalizado del Wizard
# =============================================================================
def test_collar_survey_reader_custom_mappings():
    # Libro Collar sintético con cabeceras no estándar en fila 3 (headerRowIdx = 2)
    wb_col = openpyxl.Workbook()
    ws_col = wb_col.active
    ws_col.title = "Sondajes_Collar"
    ws_col.cell(row=1, column=1, value="LOGUEO GEOTECNICO")
    ws_col.cell(row=2, column=1, value="PROYECTO ESPECIAL")
    ws_col.cell(row=3, column=1, value="HOLE_NAME")     # col 0 (excel col 1)
    ws_col.cell(row=3, column=2, value="METRAJE_TOTAL") # col 1 (excel col 2)
    ws_col.cell(row=4, column=1, value="DH-2026-01")
    ws_col.cell(row=4, column=2, value=150.25)
    ws_col.cell(row=5, column=1, value="DH-2026-02")
    ws_col.cell(row=5, column=2, value=85.00)

    # Libro Survey sintético con cabeceras no estándar en fila 2 (headerRowIdx = 1)
    wb_sur = openpyxl.Workbook()
    ws_sur = wb_sur.active
    ws_sur.title = "Trayectorias"
    ws_sur.cell(row=1, column=1, value="DATOS DE SURVEY")
    ws_sur.cell(row=2, column=1, value="ID_SONDAJE")    # col 0 (excel col 1)
    ws_sur.cell(row=2, column=2, value="PROF_MEDIDA")   # col 1 (excel col 2)
    ws_sur.cell(row=3, column=1, value="DH-2026-01")
    ws_sur.cell(row=3, column=2, value=50.0)
    ws_sur.cell(row=4, column=1, value="DH-2026-01")
    ws_sur.cell(row=4, column=2, value=150.25)

    conf_col = {
        "sheet": "Sondajes_Collar",
        "headerRowIdx": 2, # Base 0
        "mappings": {"taladro": 0, "eoh": 1}
    }
    conf_sur = {
        "sheet": "Trayectorias",
        "headerRowIdx": 1, # Base 0
        "mappings": {"taladro": 0, "depth": 1}
    }

    data_col, meta_col = read_collar_sheet(wb_col, conf_col)
    assert meta_col["status"] == "ok"
    assert meta_col["total_taladros"] == 2
    assert meta_col["error"] is None
    assert data_col["DH-2026-01"] == 150.25
    assert data_col["DH-2026-02"] == 85.00

    data_sur, meta_sur = read_survey_sheet(wb_sur, conf_sur)
    assert meta_sur["status"] == "ok"
    assert meta_sur["total_taladros"] == 1
    assert meta_sur["error"] is None
    assert data_sur["DH-2026-01"] == 150.25


# =============================================================================
# 2. TEST LECTOR: Control positivo con encabezados estándar (fallback)
# =============================================================================
def test_collar_survey_reader_standard_headers_fallback():
    wb_col = openpyxl.Workbook()
    ws_col = wb_col.active
    ws_col.title = "Collar"
    ws_col.append(["Taladro", "Este", "Norte", "Cota", "EOH"])
    ws_col.append(["STD-01", 1000.0, 2000.0, 3000.0, 320.5])

    wb_sur = openpyxl.Workbook()
    ws_sur = wb_sur.active
    ws_sur.title = "Survey"
    ws_sur.append(["Taladro", "Depth", "Dip", "Azimuth"])
    ws_sur.append(["STD-01", 100.0, -60.0, 180.0])
    ws_sur.append(["STD-01", 320.5, -60.2, 180.5])

    # Sin mappings (None o vacío) -> debe activar fallback automático
    data_col, meta_col = read_collar_sheet(wb_col, {"sheet": "Collar"})
    assert meta_col["status"] == "ok"
    assert meta_col["total_taladros"] == 1
    assert data_col["STD-01"] == 320.5

    data_sur, meta_sur = read_survey_sheet(wb_sur, {"sheet": "Survey"})
    assert meta_sur["status"] == "ok"
    assert meta_sur["total_taladros"] == 1
    assert data_sur["STD-01"] == 320.5


# =============================================================================
# 3. TEST LECTOR: Alerta y reporte de error explícito (NUNCA {} silencioso)
# =============================================================================
def test_collar_survey_reader_explicit_errors():
    # Caso A: Archivo no subido (wb is None)
    d_none, m_none = read_collar_sheet(None)
    assert m_none["status"] == "no_cargado"
    assert m_none["cargado"] is False
    assert m_none["total_taladros"] == 0

    # Caso B: Hoja solicitada no existe
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "OtraHoja"
    d_no_sheet, m_no_sheet = read_collar_sheet(wb, {"sheet": "HojaInexistente"})
    assert m_no_sheet["status"] == "error"
    assert "no encontrada" in m_no_sheet["error"]
    assert len(d_no_sheet) == 0

    # Caso C: Mapeo incompleto sin campos obligatorios
    d_bad_map, m_bad_map = read_collar_sheet(wb, {
        "sheet": "OtraHoja",
        "mappings": {"taladro": 0} # Falta 'eoh'
    })
    assert m_bad_map["status"] == "error"
    assert "campos obligatorios" in m_bad_map["error"]
    assert len(d_bad_map) == 0

    # Caso D: Hoja sin cabeceras estándar reconocibles (falla fallback)
    ws.append(["ColumnaA", "ColumnaB"])
    ws.append(["Valor1", "Valor2"])
    d_no_headers, m_no_headers = read_survey_sheet(wb, {"sheet": "OtraHoja"})
    assert m_no_headers["status"] == "error"
    assert "No se pudieron detectar automáticamente" in m_no_headers["error"]
    assert len(d_no_headers) == 0

    # Caso E (D1/D2): EOH no numérico guarda None explícito (no 0.0) y duplicado discrepante detecta alerta
    wb_e = openpyxl.Workbook()
    ws_e = wb_e.active
    ws_e.title = "Collar"
    ws_e.append(["Taladro", "EOH"])
    ws_e.append(["DH-TEXT", "NO_NUMERICO"])
    ws_e.append(["DH-DISC", 100.0])
    ws_e.append(["DH-DISC", 120.0])
    d_e, m_e = read_collar_sheet(wb_e, {"sheet": "Collar"})
    assert m_e["status"] == "ok"
    assert d_e["DH-TEXT"] is None
    assert d_e["DH-DISC"] is None
    assert "DH-DISC" in m_e.get("duplicates_discrepant", [])


# =============================================================================
# 4. TEST CRUCE POR TALADRO: Todos los estados (COINCIDE, DISCREPANCIA, SIN_REF, NO_CARGADO)
# =============================================================================
def test_cruce_collar_survey_all_states():
    # Taladros de prueba:
    # 1. T-COINCIDE: LGG=100.0, Est=100.0, Collar=100.03 (dentro de tol 0.05), Survey=100.0 -> COINCIDE
    # 2. T-DISCREP: LGG=100.0, Est=100.0, Collar=105.0 (discrepa en 5m) -> DISCREPANCIA (emite R301)
    # 3. T-SINREF: LGG=80.0, Est=80.0, ausente en Collar y ausente en Survey -> SIN_REFERENCIA
    # 4. T-NOCARGA: Caso con archivo Survey no subido -> lgg_vs_survey = NO_CARGADO

    max_lgg = {"T-COINCIDE": 100.0, "T-DISCREP": 100.0, "T-SINREF": 80.0}
    max_est = {"T-COINCIDE": 100.0, "T-DISCREP": 100.0, "T-SINREF": 80.0}
    collar_data = {"T-COINCIDE": 100.03, "T-DISCREP": 105.0} # T-SINREF no está
    survey_data = {"T-COINCIDE": 100.00, "T-DISCREP": 100.0}

    lgg_by_taladro = {
        "T-COINCIDE": [{"campana": "2026", "de": 0, "a": 100.0}],
        "T-DISCREP": [{"campana": "2026", "de": 0, "a": 100.0}],
        "T-SINREF": [{"campana": "2026", "de": 0, "a": 80.0}]
    }

    ctx = ValidationContext(
        collar_data=collar_data,
        survey_data=survey_data,
        lgg_by_taladro=lgg_by_taladro,
        metadata={
            "max_lgg": max_lgg,
            "max_est": max_est,
            "has_collar": True,
            "has_survey": True,
            "collar_meta": {"status": "ok", "total_taladros": 2},
            "survey_meta": {"status": "ok", "total_taladros": 2}
        }
    )

    rule = CrossModule_EOHRule()
    assert rule.tolerance == TOLERANCIA_EOH_METROS
    anomalies = rule.evaluate(ctx)

    cruce = ctx.metadata.get("cruce_collar_survey", {})
    assert "taladros" in cruce
    assert "resumen" in cruce

    # 1. T-COINCIDE
    t_c = cruce["taladros"]["T-COINCIDE"]
    assert t_c["estado_global"] == "COINCIDE"
    assert t_c["comparaciones"]["lgg_vs_collar"]["estado"] == "COINCIDE"
    assert abs(t_c["comparaciones"]["lgg_vs_collar"]["delta_m"]) <= 0.05
    assert t_c["comparaciones"]["lgg_vs_survey"]["estado"] == "COINCIDE"
    assert t_c["comparaciones"]["lgg_vs_est"]["estado"] == "COINCIDE"

    # 2. T-DISCREP
    t_d = cruce["taladros"]["T-DISCREP"]
    assert t_d["estado_global"] == "DISCREPANCIA"
    assert t_d["comparaciones"]["lgg_vs_collar"]["estado"] == "DISCREPANCIA"
    assert t_d["comparaciones"]["lgg_vs_collar"]["delta_m"] == -5.0

    # R301 emitida para T-DISCREP. Con D1, T-SINREF además emite R302 y R303 por ausencia en archivos cargados
    r301_list = [a for a in anomalies if a.rule_code == "R301"]
    assert len(r301_list) == 1
    assert r301_list[0].celda_padre == "T-DISCREP"
    r302_list = [a for a in anomalies if a.rule_code == "R302" and a.celda_padre == "T-SINREF"]
    assert len(r302_list) == 1
    r303_list = [a for a in anomalies if a.rule_code == "R303" and a.celda_padre == "T-SINREF"]
    assert len(r303_list) == 1

    # 3. T-SINREF
    t_sr = cruce["taladros"]["T-SINREF"]
    assert t_sr["comparaciones"]["lgg_vs_collar"]["estado"] == "SIN_REFERENCIA"
    assert t_sr["comparaciones"]["lgg_vs_survey"]["estado"] == "SIN_REFERENCIA"

    # 4. Escenario con archivo Survey NO cargado
    ctx_nosurvey = ValidationContext(
        collar_data=collar_data,
        survey_data={},
        lgg_by_taladro=lgg_by_taladro,
        metadata={
            "max_lgg": max_lgg,
            "max_est": max_est,
            "has_collar": True,
            "has_survey": False,
            "collar_meta": {"status": "ok"},
            "survey_meta": {"status": "no_cargado"}
        }
    )
    rule.evaluate(ctx_nosurvey)
    cruce_nosur = ctx_nosurvey.metadata.get("cruce_collar_survey", {})
    assert cruce_nosur["archivos"]["survey"]["cargado"] is False
    assert cruce_nosur["archivos"]["survey"]["status"] == "no_cargado"
    assert cruce_nosur["taladros"]["T-COINCIDE"]["comparaciones"]["lgg_vs_survey"]["estado"] == "NO_CARGADO"


# =============================================================================
# 5. TEST CAMPAÑA Y FILTRO DE AÑO (Nunca ocultar R301 con 'Varias' / 'Sin campaña')
# =============================================================================
def test_campaign_resolution_and_year_filter():
    max_lgg = {"DH-UNICA": 100.0, "DH-VARIAS": 100.0, "DH-NOCAMP": 100.0}
    max_est = {"DH-UNICA": 100.0, "DH-VARIAS": 100.0, "DH-NOCAMP": 100.0}
    collar_data = {"DH-UNICA": 110.0, "DH-VARIAS": 110.0, "DH-NOCAMP": 110.0} # Todos con discrepancia de 10m

    lgg_by_taladro = {
        # 1 sola campaña
        "DH-UNICA": [
            {"campana": 2026, "de": 0, "a": 50},
            {"campana": "2026", "de": 50, "a": 100}
        ],
        # Múltiples campañas en el mismo taladro
        "DH-VARIAS": [
            {"campana": "2024", "de": 0, "a": 50},
            {"campana": "2025", "de": 50, "a": 100}
        ],
        # Sin campaña registrada
        "DH-NOCAMP": [
            {"campana": None, "de": 0, "a": 50},
            {"campana": "", "de": 50, "a": 100}
        ]
    }

    ctx = ValidationContext(
        collar_data=collar_data,
        survey_data={},
        lgg_by_taladro=lgg_by_taladro,
        metadata={
            "max_lgg": max_lgg,
            "max_est": max_est,
            "has_collar": True,
            "has_survey": False
        }
    )

    rule = CrossModule_EOHRule()
    anomalies = rule.evaluate(ctx)

    anom_map = {a.celda_padre: a for a in anomalies}

    # D4: Campañas resueltas desde el dato LGG (solo año numérico o None)
    assert anom_map["DH-UNICA"].campania == "2026"
    assert anom_map["DH-VARIAS"].campania is None
    assert anom_map["DH-NOCAMP"].campania is None
    assert "Campañas registradas en LGG: 2024, 2025" in anom_map["DH-VARIAS"].mensaje

    # Verificación del filtro de año (is_year_match nativo de main):
    years_filter = ["2024"]
    assert is_year_match(anom_map["DH-UNICA"].campania, years_filter) is False
    assert is_year_match(anom_map["DH-VARIAS"].campania, years_filter) is False
    assert is_year_match(anom_map["DH-NOCAMP"].campania, years_filter) is False

    # Si se filtra por año '2026':
    assert is_year_match(anom_map["DH-UNICA"].campania, ["2026"]) is True
    assert is_year_match(anom_map["DH-VARIAS"].campania, ["2026"]) is False

