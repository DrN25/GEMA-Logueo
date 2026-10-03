"""
tests/test_rule_engine.py
Pruebas unitarias para el Motor de Reglas Modular de Auditoría Geomecánica.
Valida el funcionamiento de ValidationContext, BaseRule, RuleRegistry y RuleEngineRunner.
"""

import pytest
from app.core.engine.models import Severity, Anomaly
from app.core.engine.context import ValidationContext
from app.core.engine.registry import RuleRegistry
from app.core.engine.runner import RuleEngineRunner
from app.core.engine.rules import (
    LGG_PhysicalAndGeometricRule,
    LGG_FracturesAndFRFRule,
    LGG_GeomechanicalCompatibilityRule,
    Estructural_SpatialContainmentRule,
    RMR_CrossCheckWithLGGRule,
    RMR_FormulasAndRatingsRule,
    CrossModule_EOHRule,
)


def test_validation_context_indexing():
    """Verifica que el contexto indexe corridas por taladro y ordene por profundidad."""
    lgg_runs = [
        {"taladro": "TAL-01", "corrida": 2, "de": 1.5, "a": 3.0},
        {"taladro": "TAL-01", "corrida": 1, "de": 0.0, "a": 1.5},
        {"taladro": "TAL-02", "corrida": 1, "de": 0.0, "a": 1.2},
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs)

    assert len(ctx.get_lgg_runs("TAL-01")) == 2
    # Debe estar ordenado por 'de'
    assert ctx.get_lgg_runs("TAL-01")[0]["corrida"] == 1
    assert ctx.get_lgg_runs("TAL-01")[1]["corrida"] == 2
    assert ctx.max_lgg_by_taladro["TAL-01"] == 3.0
    assert ctx.max_lgg_by_taladro["TAL-02"] == 1.2


def test_lgg_physical_rules_detection():
    """Verifica detección de avance negativo, exceso de avance y recuperación mayor al avance."""
    lgg_runs = [
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "de": 0.0, "a": 2.0, "perf": 2.0, "rec_m": 2.5, "rqd_m": 1.0, "lrf_m": 0.5, "small_frag_m": 0.2},
        {"_fila_excel": 3, "taladro": "T1", "corrida": 2, "de": 2.5, "a": 2.0},  # Ruptura continuidad y avance negativo
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs)
    rule = LGG_PhysicalAndGeometricRule()
    anomalies = rule.evaluate(ctx)

    codes = [a.rule_code for a in anomalies]
    assert "R102" in codes  # Excede 1.6m
    assert "R103" in codes  # Rec (2.5) > Perf (2.0)
    assert "R101" in codes  # Avance negativo (2.0 - 2.5 = -0.5)
    assert "R122" in codes  # Ruptura de continuidad (inicia en 2.5m pero anterior terminó en 2.0m)


def test_lgg_frf_formula():
    """Verifica que la regla valide la fórmula oficial de FRF = floor(round(lrf*100)/5) + 1."""
    # LRF = 0.40m -> round(40)/5 = 8 + 1 = 9
    lgg_runs = [
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "lrf_m": 0.40, "frf": 9, "frac_nat": 5, "frac_buz30": 2, "frac_buz60": 2, "frac_buz90": 1},
        {"_fila_excel": 3, "taladro": "T1", "corrida": 2, "lrf_m": 0.40, "frf": 4, "frac_nat": 5, "frac_buz30": 1, "frac_buz60": 1, "frac_buz90": 1},  # FRF erróneo y suma buzamientos errónea
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs)
    rule = LGG_FracturesAndFRFRule()
    anomalies = rule.evaluate(ctx)

    codes = [a.rule_code for a in anomalies]
    assert "R120" in codes  # Discrepancia FRF en corrida 2
    assert "R107" in codes  # Discrepancia sumatoria buzamientos (3 != 5)


def test_estructural_containment():
    """Verifica detección de profundidades huérfanas o fuera de corrida en Estructural."""
    lgg_runs = [
        {"taladro": "T1", "corrida": 1, "de": 0.0, "a": 1.5},
        {"taladro": "T1", "corrida": 2, "de": 1.5, "a": 3.0},
    ]
    est_structs = [
        {"_fila_excel": 2, "taladro": "T1", "profundidad": 1.2, "de": 0.0, "a": 1.5},  # OK
        {"_fila_excel": 3, "taladro": "T1", "profundidad": 4.5, "de": 4.0, "a": 5.0},  # Huérfana y excede límite
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs, est_structures=est_structs)
    rule = Estructural_SpatialContainmentRule()
    anomalies = rule.evaluate(ctx)

    codes = [a.rule_code for a in anomalies]
    assert "R201" in codes  # Huérfana
    assert "R216" in codes  # Excede límite final (4.5 > 3.0)


def test_rmr_formulas_and_filling_normalization():
    """Verifica fórmulas de RMR, clasificación de relleno ('OX', 'SIO') y agua teórica."""
    rmr_runs = [
        {
            "_fila_excel": 2, "sondaje": "T1", "corrida": 1, "a": 95.0, "long_corrida": 1.5,
            "rec_m": 1.5, "rec_pct": 100, "rqd_m": 1.2, "rqd_pct": 80,
            "frf": 4, "frac_nat": 6, "total_frac": 10, "ff_1m": 7, "espaciamiento_mm": 150,
            "relleno": "OX", "clasificacion_relleno": 2,  # Óxido de cobre -> Clase 2 (Duro)
            "presencia_agua": "DPH",  # 92 <= 95 < 97 -> DPH
            "rmr76": 50.0, "r76_resistencia": 10.0, "r76_rqd": 15.0, "r76_espaciamiento": 10.0, "r76_juntas": 5.0, "r76_agua": 10.0
        },
        {
            "_fila_excel": 3, "sondaje": "T1", "corrida": 2, "a": 50.0, "long_corrida": 1.5,
            "relleno": "ox", "clasificacion_relleno": 1,  # Erróneo: ox debe ser Clase 2
            "presencia_agua": "WTM",  # Erróneo: a=50m debe ser CDC (<92m)
            "rmr76": 60.0, "r76_resistencia": 10.0, "r76_rqd": 10.0, "r76_espaciamiento": 10.0, "r76_juntas": 0.0, "r76_agua": 10.0 # Suma = 40 != 60
        }
    ]
    ctx = ValidationContext(rmr_runs=rmr_runs)
    rule = RMR_FormulasAndRatingsRule()
    anomalies = rule.evaluate(ctx)

    codes = [a.rule_code for a in anomalies]
    # Fila 1 no debe tener errores
    f2_anoms = [a for a in anomalies if a.row_excel == 2]
    assert len(f2_anoms) == 0

    # Fila 2 debe reportar clase de relleno, agua y descuadre RMR76
    assert "R421" in codes
    assert "R310" in codes
    assert "R_RMR76_MISMATCH" in codes


def test_rule_engine_runner_pipeline():
    """Verifica que RuleEngineRunner ejecute todas las reglas y consolide el ValidationResult."""
    registry = RuleRegistry()
    registry.register(LGG_PhysicalAndGeometricRule)
    registry.register(LGG_FracturesAndFRFRule)
    registry.register(CrossModule_EOHRule)

    lgg_runs = [
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "de": 0.0, "a": 1.0, "perf": 1.0, "rec_m": 0.8, "rqd_m": 0.5, "lrf_m": 0.2, "small_frag_m": 0.1, "frf": 5, "frac_nat": 2, "frac_buz30": 1, "frac_buz60": 1, "frac_buz90": 0, "campana": "2024", "geologo": "GEO1"},
    ]
    collar_data = {"T1": 1.0}  # Coincide con LGG
    ctx = ValidationContext(lgg_runs=lgg_runs, collar_data=collar_data)

    runner = RuleEngineRunner(registry)
    result = runner.run(ctx)

    assert result.total_filas_procesadas == 1
    assert result.metricas_globales.total_celdas_padre == 1
    assert result.resumen_por_celda_padre["T1"]["estado_celda"] == "OK"
    assert len(result.incidencias) == 0


def test_heavy_dependent_fields_rule():
    """Verifica que dependencias negativas por mal cálculo sean aisladas bajo R130."""
    from app.core.engine.rules.heavy_rules import DependentFieldsIncompleteRule

    rmr_runs = [
        {"_fila_excel": 2, "sondaje": "T1", "corrida": 1, "frf": -1, "frac_nat": 5, "total_frac": 4},
        {"_fila_excel": 3, "sondaje": "T1", "corrida": 2, "frf": 4, "frac_nat": -2, "total_frac": -2}
    ]
    ctx = ValidationContext(rmr_runs=rmr_runs)
    rule = DependentFieldsIncompleteRule()
    anomalies = rule.evaluate(ctx)

    assert len(anomalies) == 2
    assert all(a.rule_code == "R130" for a in anomalies)


def test_heavy_continuous_crushed_zone_rule():
    """Verifica detección de zona altamente triturada a lo largo de 3 corridas sin estructura mayor."""
    from app.core.engine.rules.heavy_rules import ContinuousCrushedZoneAnomalyRule

    lgg_runs = [
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "de": 10.0, "a": 11.5, "perf": 1.5, "lrf_m": 1.0, "rqd_m": 0.0},
        {"_fila_excel": 3, "taladro": "T1", "corrida": 2, "de": 11.5, "a": 13.0, "perf": 1.5, "lrf_m": 0.9, "rqd_m": 0.0},
        {"_fila_excel": 4, "taladro": "T1", "corrida": 3, "de": 13.0, "a": 14.5, "perf": 1.5, "lrf_m": 1.1, "rqd_m": 0.0},
    ]
    # Sin estructuras en Estructural
    ctx = ValidationContext(lgg_runs=lgg_runs, est_structures=[])
    rule = ContinuousCrushedZoneAnomalyRule()
    anomalies = rule.evaluate(ctx)

    assert len(anomalies) == 1
    assert anomalies[0].rule_code == "R_HVY_CRUSHED_ZONE"
    assert anomalies[0].severity == Severity.ADVERTENCIA


def test_heavy_abrupt_competence_drop_rule():
    """Verifica detección de caída abrupta de RQD (>50% de caída) en misma litología."""
    from app.core.engine.rules.heavy_rules import AbruptCompetenceDropRule

    lgg_runs = [
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "de": 0.0, "a": 1.5, "perf": 1.5, "rqd_m": 1.3, "lito1": "MZM"}, # RQD = 86.6%
        {"_fila_excel": 3, "taladro": "T1", "corrida": 2, "de": 1.5, "a": 3.0, "perf": 1.5, "rqd_m": 0.1, "lito1": "MZM"}, # RQD = 6.6%
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs)
    rule = AbruptCompetenceDropRule()
    anomalies = rule.evaluate(ctx)

    assert len(anomalies) == 1
    assert anomalies[0].rule_code == "R_HVY_COMPETENCE_DROP"


def test_rqd_weak_weathered_compatibility_r141():
    """Verifica la regla R141 de incompatibilidad geomecánica en RQD para roca blanda (R0-R1) o meteorización intensa (>=IV)."""
    lgg_runs = [
        # Caso 1: R1 + HWA con RQD = 0 -> Correcto, sin anomalía
        {"_fila_excel": 2, "taladro": "T1", "corrida": 1, "rqd_m": 0.0, "resistencia": "R1", "intemperismo": "HWA", "_raw_dict": {"resistencia": "R1", "intemperismo": "HWA"}},
        # Caso 2: R1 + HWA con RQD > 0 -> Alerta R141 (ambos factores)
        {"_fila_excel": 3, "taladro": "T1", "corrida": 2, "rqd_m": 0.6, "resistencia": "R1", "intemperismo": "HWA", "_raw_dict": {"resistencia": "R1", "intemperismo": "HWA"}},
        # Caso 3: R0 + SWD con RQD > 0 -> Alerta R141 (resistencia blanda)
        {"_fila_excel": 4, "taladro": "T1", "corrida": 3, "rqd_m": 0.4, "resistencia": "R0", "intemperismo": "SWD", "_raw_dict": {"resistencia": "R0", "intemperismo": "SWD"}},
        # Caso 4: R3 + CWC con RQD > 0 -> Alerta R141 (meteorización grado V)
        {"_fila_excel": 5, "taladro": "T1", "corrida": 4, "rqd_m": 0.5, "resistencia": "R3", "intemperismo": "CWC", "_raw_dict": {"resistencia": "R3", "intemperismo": "CWC"}},
        # Caso 5: R3 + SWD con RQD > 0 -> Competente, sin anomalía
        {"_fila_excel": 6, "taladro": "T1", "corrida": 5, "rqd_m": 1.2, "resistencia": "R3", "intemperismo": "SWD", "_raw_dict": {"resistencia": "R3", "intemperismo": "SWD"}},
        # Caso 6: R1 con RQD vacío / None -> No debe disparar R141 (lo maneja R100_EMPTY)
        {"_fila_excel": 7, "taladro": "T1", "corrida": 6, "rqd_m": None, "resistencia": "R1", "intemperismo": "HWA", "_raw_dict": {"resistencia": "R1", "intemperismo": "HWA"}},
    ]
    ctx = ValidationContext(lgg_runs=lgg_runs)
    rule = LGG_GeomechanicalCompatibilityRule()
    anomalies = rule.evaluate(ctx)

    r141_anoms = [a for a in anomalies if a.rule_code == "R141"]
    assert len(r141_anoms) == 3

    # Filas 3, 4, 5 dispararon anomalías
    rows_flagged = {a.row_excel for a in r141_anoms}
    assert rows_flagged == {3, 4, 5}

    # Todas son de severidad ADVERTENCIA
    assert all(a.severity == Severity.ADVERTENCIA for a in r141_anoms)

    # Ningún mensaje debe contener la palabra 'procedimiento'
    for a in r141_anoms:
        assert "procedimiento" not in a.mensaje.lower(), f"Mensaje no debe mencionar procedimiento: {a.mensaje}"


