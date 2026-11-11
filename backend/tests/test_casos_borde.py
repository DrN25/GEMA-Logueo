"""
backend/tests/test_casos_borde.py
Pruebas para casos borde:
- Formatos numéricos: coma decimal, texto N/D, cero explícito
- Survey con una sola fila
- R307 individual en RMR y en Estructural
- Normalización de espacios
"""
import openpyxl
from app.core.adapters.excel.collar_survey_reader import read_collar_sheet, read_survey_sheet
from app.core.engine.context import ValidationContext
from app.core.engine.rules.eoh_rules import CrossModule_EOHRule


def test_formatos_numericos_collar():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Collar"
    ws.append(["Taladro", "EOH"])
    ws.append(["DH-COMA", "100,5"])
    ws.append(["DH-ND", "N/D"])
    ws.append(["DH-CERO", 0.0])

    data, meta = read_collar_sheet(wb, {"sheet": "Collar"})
    assert data["DH-COMA"] == 100.5
    assert data["DH-ND"] is None
    assert data["DH-CERO"] == 0.0
    assert "DH-ND" in meta["vacios"]


def test_survey_una_sola_fila():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Survey"
    ws.append(["Taladro", "Depth"])
    ws.append(["DH-SINGLE", 75.2])

    data, meta = read_survey_sheet(wb, {"sheet": "Survey"})
    assert data["DH-SINGLE"] == 75.2
    assert meta["status"] == "ok"


def test_r307_mensajes_distintos_est_vs_rmr():
    ctx = ValidationContext(
        collar_data={},
        survey_data={},
        lgg_by_taladro={"DH-OK": [{"de": 0, "a": 100, "campana": 2024}]},
        est_by_taladro={"DH-SOLO-EST": [{"profundidad": 40.0}]},
        rmr_by_taladro={"DH-SOLO-RMR": [{"corrida": 1}]},
        metadata={
            "max_lgg": {"DH-OK": 100.0},
            "max_est": {"DH-OK": 100.0, "DH-SOLO-EST": 40.0},
            "has_collar": False,
            "has_survey": False,
            "collar_meta": {"status": "no_cargado"},
            "survey_meta": {"status": "no_cargado"}
        }
    )
    rule = CrossModule_EOHRule()
    anomalies = rule.evaluate(ctx)

    r307_est = [a for a in anomalies if a.rule_code == "R307" and a.celda_padre == "DH-SOLO-EST"]
    r307_rmr = [a for a in anomalies if a.rule_code == "R307" and a.celda_padre == "DH-SOLO-RMR"]

    assert len(r307_est) == 1
    assert "Logueo Estructural" in r307_est[0].mensaje
    assert len(r307_rmr) == 1
    assert "Validación RMR" in r307_rmr[0].mensaje

def test_d5_casing_collar():
    # 1. "dh-01" en LGG y "dh-01" en Collar -> NO emite R302
    wb1 = openpyxl.Workbook()
    ws1 = wb1.active
    ws1.title = "Collar"
    ws1.append(["Taladro", "EOH"])
    ws1.append(["dh-01", 100.0])
    data1, meta1 = read_collar_sheet(wb1, {"sheet": "Collar"})
    assert "dh-01" in data1
    assert data1["dh-01"] == 100.0

    ctx1 = ValidationContext(
        collar_data=data1,
        survey_data={},
        lgg_by_taladro={"dh-01": [{"de": 0, "a": 100, "campana": 2024}]},
        metadata={
            "max_lgg": {"dh-01": 100.0},
            "max_est": {},
            "has_collar": True,
            "has_survey": False,
            "collar_meta": meta1,
            "survey_meta": {"status": "no_cargado"}
        }
    )
    rule = CrossModule_EOHRule()
    anoms1 = rule.evaluate(ctx1)
    r302_1 = [a for a in anoms1 if a.rule_code == "R302"]
    assert len(r302_1) == 0

    # 2. "dh-01" en LGG y "DH-01" en Collar -> emite R302 para "dh-01"
    wb2 = openpyxl.Workbook()
    ws2 = wb2.active
    ws2.title = "Collar"
    ws2.append(["Taladro", "EOH"])
    ws2.append(["DH-01", 100.0])
    data2, meta2 = read_collar_sheet(wb2, {"sheet": "Collar"})

    ctx2 = ValidationContext(
        collar_data=data2,
        survey_data={},
        lgg_by_taladro={"dh-01": [{"de": 0, "a": 100, "campana": 2024}]},
        metadata={
            "max_lgg": {"dh-01": 100.0},
            "max_est": {},
            "has_collar": True,
            "has_survey": False,
            "collar_meta": meta2,
            "survey_meta": {"status": "no_cargado"}
        }
    )
    anoms2 = rule.evaluate(ctx2)
    r302_2 = [a for a in anoms2 if a.rule_code == "R302"]
    assert len(r302_2) == 1
    assert r302_2[0].celda_padre == "dh-01"
    assert r302_2[0].mensaje == "No existe Collar para el taladro dh-01."

    # 3. Collar con "DH-01" y "dh-01" en filas separadas -> dos taladros distintos (no duplicado)
    wb3 = openpyxl.Workbook()
    ws3 = wb3.active
    ws3.title = "Collar"
    ws3.append(["Taladro", "EOH"])
    ws3.append(["DH-01", 100.0])
    ws3.append(["dh-01", 120.0])
    data3, meta3 = read_collar_sheet(wb3, {"sheet": "Collar"})
    assert len(data3) == 2
    assert "DH-01" in data3 and data3["DH-01"] == 100.0
    assert "dh-01" in data3 and data3["dh-01"] == 120.0
    assert len(meta3.get("duplicates_discrepant", {})) == 0


def test_d5_casing_survey():
    # 1. "dh-01" en LGG y "dh-01" en Survey -> NO emite R303
    wb1 = openpyxl.Workbook()
    ws1 = wb1.active
    ws1.title = "Survey"
    ws1.append(["Taladro", "Depth"])
    ws1.append(["dh-01", 100.0])
    data1, meta1 = read_survey_sheet(wb1, {"sheet": "Survey"})
    assert "dh-01" in data1
    assert data1["dh-01"] == 100.0

    ctx1 = ValidationContext(
        collar_data={},
        survey_data=data1,
        lgg_by_taladro={"dh-01": [{"de": 0, "a": 100, "campana": 2024}]},
        metadata={
            "max_lgg": {"dh-01": 100.0},
            "max_est": {},
            "has_collar": False,
            "has_survey": True,
            "collar_meta": {"status": "no_cargado"},
            "survey_meta": meta1
        }
    )
    rule = CrossModule_EOHRule()
    anoms1 = rule.evaluate(ctx1)
    r303_1 = [a for a in anoms1 if a.rule_code == "R303"]
    assert len(r303_1) == 0

    # 2. "dh-01" en LGG y "DH-01" en Survey -> emite R303 para "dh-01"
    wb2 = openpyxl.Workbook()
    ws2 = wb2.active
    ws2.title = "Survey"
    ws2.append(["Taladro", "Depth"])
    ws2.append(["DH-01", 100.0])
    data2, meta2 = read_survey_sheet(wb2, {"sheet": "Survey"})

    ctx2 = ValidationContext(
        collar_data={},
        survey_data=data2,
        lgg_by_taladro={"dh-01": [{"de": 0, "a": 100, "campana": 2024}]},
        metadata={
            "max_lgg": {"dh-01": 100.0},
            "max_est": {},
            "has_collar": False,
            "has_survey": True,
            "collar_meta": {"status": "no_cargado"},
            "survey_meta": meta2
        }
    )
    anoms2 = rule.evaluate(ctx2)
    r303_2 = [a for a in anoms2 if a.rule_code == "R303"]
    assert len(r303_2) == 1
    assert r303_2[0].celda_padre == "dh-01"
    assert r303_2[0].mensaje == "No existe Survey para el taladro dh-01."

    # 3. Survey con "DH-01" y "dh-01" en filas separadas -> dos taladros distintos
    wb3 = openpyxl.Workbook()
    ws3 = wb3.active
    ws3.title = "Survey"
    ws3.append(["Taladro", "Depth"])
    ws3.append(["DH-01", 100.0])
    ws3.append(["dh-01", 120.0])
    data3, meta3 = read_survey_sheet(wb3, {"sheet": "Survey"})
    assert len(data3) == 2
    assert "DH-01" in data3 and data3["DH-01"] == 100.0
    assert "dh-01" in data3 and data3["dh-01"] == 120.0

def test_r307_tres_casos_est_rmr_ambos():
    ctx = ValidationContext(
        collar_data={},
        survey_data={},
        lgg_by_taladro={"DH-OK": [{"de": 0, "a": 100, "campana": 2024}]},
        est_by_taladro={
            "DH-SOLO-EST": [{"profundidad": 40.0}],
            "DH-AMBOS": [{"profundidad": 50.0}]
        },
        rmr_by_taladro={
            "DH-SOLO-RMR": [{"corrida": 1}],
            "DH-AMBOS": [{"corrida": 1}]
        },
        metadata={
            "max_lgg": {"DH-OK": 100.0},
            "max_est": {"DH-OK": 100.0, "DH-SOLO-EST": 40.0, "DH-AMBOS": 50.0},
            "has_collar": False,
            "has_survey": False,
            "collar_meta": {"status": "no_cargado"},
            "survey_meta": {"status": "no_cargado"}
        }
    )
    rule = CrossModule_EOHRule()
    anomalies = rule.evaluate(ctx)

    r307_list = [a for a in anomalies if a.rule_code == "R307"]
    assert len(r307_list) == 3

    r307_map = {a.celda_padre: a.mensaje for a in r307_list}

    # 1. Solo EST
    assert "Logueo Estructural" in r307_map["DH-SOLO-EST"]
    assert "Validación RMR" not in r307_map["DH-SOLO-EST"]

    # 2. Solo RMR
    assert "Validación RMR" in r307_map["DH-SOLO-RMR"]
    assert "Logueo Estructural" not in r307_map["DH-SOLO-RMR"]

    # 3. Ambos
    assert "Logueo Estructural y Validación RMR" in r307_map["DH-AMBOS"]


def test_d6_r301_columna_profundidad_final_eoh():
    # R301 debe reportar columna="Profundidad Final EOH" para paridad con main y rama pura
    ctx = ValidationContext(
        collar_data={"DH-R301": 150.0},
        survey_data={},
        lgg_by_taladro={"DH-R301": [{"de": 0, "a": 100, "campana": 2024}]},
        metadata={
            "max_lgg": {"DH-R301": 100.0},
            "max_est": {},
            "has_collar": True,
            "has_survey": False,
            "collar_meta": {"status": "ok"},
            "survey_meta": {"status": "no_cargado"}
        }
    )
    rule = CrossModule_EOHRule()
    anomalies = rule.evaluate(ctx)
    r301_list = [a for a in anomalies if a.rule_code == "R301"]
    assert len(r301_list) == 1
    assert r301_list[0].columna == "Profundidad Final EOH"
