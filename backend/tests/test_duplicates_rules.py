"""
tests/test_duplicates_rules.py
Pruebas unitarias para las reglas de detección de duplicados en DDH:
1. R100_DUP_CORRIDA: Número de corrida duplicado en el mismo taladro.
2. R122_OVERLAP: Intervalo solapado o traslape (de < prev_a) vs Brecha (de > prev_a).
3. R200_DUP: Estructura duplicada idéntica (prof, tipo, alfa, beta) vs intersección legítima.
"""

import pytest
from app.core.engine.models import Severity
from app.core.engine.context import ValidationContext
from app.core.engine.rules.lgg_rules import LGG_PhysicalAndGeometricRule
from app.core.engine.rules.est_rules import Estructural_GeometryAndAnglesRule


def test_duplicate_corrida_r100_dup_corrida():
    """Valida que una corrida repetida en el mismo taladro active R100_DUP_CORRIDA."""
    rule = LGG_PhysicalAndGeometricRule()

    # Taladro con corrida #5 duplicada (filas 10 y 11)
    runs = [
        {"_fila_excel": 9, "taladro": "DH-01", "corrida": 4, "de": 10.0, "a": 11.5, "rec_m": 1.5, "rqd_m": 1.0, "lrf_m": 0.0, "small_frag_m": 0.5, "frac_nat": 2},
        {"_fila_excel": 10, "taladro": "DH-01", "corrida": 5, "de": 11.5, "a": 13.0, "rec_m": 1.5, "rqd_m": 1.0, "lrf_m": 0.0, "small_frag_m": 0.5, "frac_nat": 2},
        {"_fila_excel": 11, "taladro": "DH-01", "corrida": 5, "de": 13.0, "a": 14.5, "rec_m": 1.5, "rqd_m": 1.0, "lrf_m": 0.0, "small_frag_m": 0.5, "frac_nat": 2},
    ]

    ctx = ValidationContext(
        lgg_runs=runs,
        lgg_by_taladro={"DH-01": runs},
        is_2026=False
    )

    anomalies = rule.evaluate(ctx)
    codes = [a.rule_code for a in anomalies]

    assert "R100_DUP_CORRIDA" in codes
    dup_anom = next(a for a in anomalies if a.rule_code == "R100_DUP_CORRIDA")
    assert dup_anom.row_excel == 11
    assert dup_anom.severity == Severity.ALERTA
    assert "corrida #5" in dup_anom.mensaje.lower()
    assert "fila 10" in dup_anom.mensaje.lower()


def test_corridas_different_taladros_not_duplicate():
    """Valida que la misma corrida en TALADROS DISTINTOS no se marque como duplicado."""
    rule = LGG_PhysicalAndGeometricRule()

    runs_dh1 = [{"_fila_excel": 10, "taladro": "DH-01", "corrida": 5, "de": 11.5, "a": 13.0, "rec_m": 1.5, "rqd_m": 1.0, "lrf_m": 0.0, "small_frag_m": 0.5, "frac_nat": 2}]
    runs_dh2 = [{"_fila_excel": 20, "taladro": "DH-02", "corrida": 5, "de": 11.5, "a": 13.0, "rec_m": 1.5, "rqd_m": 1.0, "lrf_m": 0.0, "small_frag_m": 0.5, "frac_nat": 2}]

    ctx = ValidationContext(
        lgg_runs=runs_dh1 + runs_dh2,
        lgg_by_taladro={"DH-01": runs_dh1, "DH-02": runs_dh2},
        is_2026=False
    )

    anomalies = rule.evaluate(ctx)
    dup_codes = [a.rule_code for a in anomalies if a.rule_code == "R100_DUP_CORRIDA"]
    assert len(dup_codes) == 0


def test_overlap_vs_gap_r122():
    """Valida la diferenciación estricta entre R122 (Brecha de > prev_a) y R122_OVERLAP (de < prev_a)."""
    rule = LGG_PhysicalAndGeometricRule()

    # Caso 1: Solapamiento (de=14.0m < anterior=14.5m)
    runs_overlap = [
        {"_fila_excel": 10, "taladro": "DH-OVERLAP", "corrida": 1, "de": 13.0, "a": 14.5, "rec_m": 1.5, "rqd_m": 1.0, "lrf_m": 0.0, "small_frag_m": 0.5, "frac_nat": 2},
        {"_fila_excel": 11, "taladro": "DH-OVERLAP", "corrida": 2, "de": 14.0, "a": 15.5, "rec_m": 1.5, "rqd_m": 1.0, "lrf_m": 0.0, "small_frag_m": 0.5, "frac_nat": 2},
    ]

    ctx_overlap = ValidationContext(
        lgg_runs=runs_overlap,
        lgg_by_taladro={"DH-OVERLAP": runs_overlap},
        is_2026=False
    )
    anom_overlap = rule.evaluate(ctx_overlap)
    codes_overlap = [a.rule_code for a in anom_overlap]
    assert "R122_OVERLAP" in codes_overlap
    assert "R122" not in codes_overlap
    ov_msg = next(a.mensaje for a in anom_overlap if a.rule_code == "R122_OVERLAP")
    assert "solapado" in ov_msg.lower()

    # Caso 2: Brecha / Hueco (de=15.0m > anterior=14.5m)
    runs_gap = [
        {"_fila_excel": 10, "taladro": "DH-GAP", "corrida": 1, "de": 13.0, "a": 14.5, "rec_m": 1.5, "rqd_m": 1.0, "lrf_m": 0.0, "small_frag_m": 0.5, "frac_nat": 2},
        {"_fila_excel": 11, "taladro": "DH-GAP", "corrida": 2, "de": 15.0, "a": 16.5, "rec_m": 1.5, "rqd_m": 1.0, "lrf_m": 0.0, "small_frag_m": 0.5, "frac_nat": 2},
    ]

    ctx_gap = ValidationContext(
        lgg_runs=runs_gap,
        lgg_by_taladro={"DH-GAP": runs_gap},
        is_2026=False
    )
    anom_gap = rule.evaluate(ctx_gap)
    codes_gap = [a.rule_code for a in anom_gap]
    assert "R122" in codes_gap
    assert "R122_OVERLAP" not in codes_gap
    gap_msg = next(a.mensaje for a in anom_gap if a.rule_code == "R122")
    assert "ruptura de continuidad" in gap_msg.lower() or "brecha" in gap_msg.lower()


def test_duplicate_structure_r200_dup():
    """Valida que estructuras 100% idénticas activen R200_DUP, pero intersecciones legítimas con ángulos distintos NO."""
    rule = Estructural_GeometryAndAnglesRule()

    structures = [
        # Fila 100 y 101: Duplicado exacto (misma prof 17.5m, tipo JN, alfa 80, beta 45)
        {"_fila_excel": 100, "taladro": "DH-01", "profundidad": 17.5, "tipo_estructura": "JN", "alfa": 80.0, "beta": 45.0, "abertura": 1.0, "espesor": 1.0, "relleno1": "ca"},
        {"_fila_excel": 101, "taladro": "DH-01", "profundidad": 17.5, "tipo_estructura": "JN", "alfa": 80.0, "beta": 45.0, "abertura": 1.0, "espesor": 1.0, "relleno1": "ca"},
        
        # Fila 102 y 103: Misma profundidad 25.0m pero ángulos diferentes (intersección geológica real)
        {"_fila_excel": 102, "taladro": "DH-01", "profundidad": 25.0, "tipo_estructura": "SZ", "alfa": 52.0, "beta": 25.0, "abertura": 2.0, "espesor": 2.0, "relleno1": "ca"},
        {"_fila_excel": 103, "taladro": "DH-01", "profundidad": 25.0, "tipo_estructura": "SZ", "alfa": 78.0, "beta": 110.0, "abertura": 2.0, "espesor": 2.0, "relleno1": "ca"},
    ]

    ctx = ValidationContext(
        est_structures=structures,
        est_by_taladro={"DH-01": structures},
        is_2026=False
    )

    anomalies = rule.evaluate(ctx)
    dup_anoms = [a for a in anomalies if a.rule_code == "R200_DUP"]

    # Debe haber exactamente 1 anomalía de duplicado (la fila 101 duplicada de la 100)
    assert len(dup_anoms) == 1
    assert dup_anoms[0].row_excel == 101
    assert dup_anoms[0].severity == Severity.ADVERTENCIA
    assert "fila 100" in dup_anoms[0].mensaje.lower()

    # Las filas 102 y 103 NO deben generar R200_DUP
    rows_flagged = [a.row_excel for a in dup_anoms]
    assert 102 not in rows_flagged
    assert 103 not in rows_flagged
