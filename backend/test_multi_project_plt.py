"""
test_multi_project_plt.py — Prueba automatizada y assert-based para soporte multi-proyecto en PLT.
Valida la resolución canónica de Factor K y Grupos Litológicos para Ferrobamba y Chalcobamba.
"""

import sys
import os

# Asegurar path de importación
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from app.core.rules_plt_regulares import (
    resolve_expected_k_and_type,
    FERROBAMBA_LITHOLOGY_CATALOG,
    CHALCO_LITHOLOGY_CATALOG
)
from app.core.validator_plt_regulares import (
    detect_project_for_drillhole,
    PltRegularesValidator
)


def test_catalogs_loaded():
    assert len(FERROBAMBA_LITHOLOGY_CATALOG) > 30, "Catálogo de Ferrobamba debe tener datos"
    assert len(CHALCO_LITHOLOGY_CATALOG) >= 80, "Catálogo de Chalcobamba debe tener datos"
    print("[OK] Catálogos cargados correctamente.")


def test_project_autodetection():
    # Ferrobamba
    assert detect_project_for_drillhole("FEGT20-001") == "ferrobamba"
    assert detect_project_for_drillhole("FEGT25-065") == "ferrobamba"
    assert detect_project_for_drillhole("FEHI24-006") == "ferrobamba"
    assert detect_project_for_drillhole("DDGT-FBMI26-001") == "ferrobamba"
    assert detect_project_for_drillhole("DDHY-FBMI26-002") == "ferrobamba"

    # Chalcobamba
    assert detect_project_for_drillhole("DDGT-CBIS26-001") == "chalco"
    assert detect_project_for_drillhole("DDGT-CBMI26-002") == "chalco"
    assert detect_project_for_drillhole("CB-01") == "chalco"
    assert detect_project_for_drillhole("CHALCO_DH_01") == "chalco"

    # Override explícito
    assert detect_project_for_drillhole("FEGT20-001", default_project="chalco") == "chalco"
    assert detect_project_for_drillhole("DDGT-CBIS26-001", default_project="ferrobamba") == "ferrobamba"
    print("[OK] Autodetección de proyectos verificada.")


def test_ferrobamba_resolution():
    # MZH en Ferrobamba
    g, k = resolve_expected_k_and_type("MZH", "MZH", "MZH_1", project="ferrobamba")
    assert g == "INTRUSIVOS" and k == 11.62

    g, k = resolve_expected_k_and_type("MZH", "MZH", "MZH_2", project="ferrobamba")
    assert g == "INTRUSIVOS" and k == 9.31

    g, k = resolve_expected_k_and_type("MZH", "MZH", "MZH", project="ferrobamba")
    assert g == "INTRUSIVOS" and k == 9.31, f"MZH/MZH/MZH en Ferrobamba debe resolver a 9.31, dio {k}"

    # MZB en Ferrobamba
    g, k = resolve_expected_k_and_type("MZB", "MZB", "MZB_EQ", project="ferrobamba")
    assert g == "INTRUSIVOS" and k == 8.29

    # Skarn en Ferrobamba
    g, k = resolve_expected_k_and_type("LMT", "GSK", "LMT_M", project="ferrobamba")
    assert g == "METAMORFICAS" and k == 11.15
    print("[OK] Resolución de litologías Ferrobamba verificada.")


def test_chalcobamba_resolution():
    # CASO CRÍTICO: MZH/MZH/MZH en Chalcobamba DEBE ser 11.62 (resuelve 272 falsas alarmas)
    g, k = resolve_expected_k_and_type("MZH", "MZH", "MZH", project="chalco")
    assert g == "INTRUSIVOS" and k == 11.62, f"MZH/MZH/MZH en Chalcobamba debe ser 11.62, dio {k}"

    # MZH subtipos
    g, k = resolve_expected_k_and_type("MZH", "MZH", "MZH_K", project="chalco")
    assert g == "INTRUSIVOS" and k == 9.31

    # Diorita en Chalcobamba (DI / DI / DIO_1)
    g, k = resolve_expected_k_and_type("DI", "DI", "DIO_1", project="chalco")
    assert g == "INTRUSIVOS" and k == 7.60

    # Normalización con barras (DIO/1 -> DIO_1)
    g, k = resolve_expected_k_and_type("DI", "DI", "DIO/1", project="chalco")
    assert g == "INTRUSIVOS" and k == 7.60

    # MZB en Chalcobamba
    g, k = resolve_expected_k_and_type("MZB", "MZB", "MZB_1", project="chalco")
    assert g == "INTRUSIVOS" and k == 9.20

    g, k = resolve_expected_k_and_type("MZB", "MZB", "MZB_2", project="chalco")
    assert g == "INTRUSIVOS" and k == 7.60

    # MZM en Chalcobamba
    g, k = resolve_expected_k_and_type("MZM", "MZM", "MZM_1", project="chalco")
    assert g == "INTRUSIVOS" and k == 8.61

    g, k = resolve_expected_k_and_type("MZM", "MZM", "MZM_2", project="chalco")
    assert g == "INTRUSIVOS" and k == 9.31

    # MZQ en Chalcobamba
    g, k = resolve_expected_k_and_type("MZQ", "MZQ", "MZQ_1A", project="chalco")
    assert g == "INTRUSIVOS" and k == 12.29
    print("[OK] Resolución de litologías Chalcobamba verificada.")


def test_validator_audit_multi_project():
    validator = PltRegularesValidator()

    # DataFrame con 2 filas:
    # 1) Chalcobamba con MZH/MZH/MZH y K=11.62 -> NO debe dar CAT_PLT_FACTOR_K_INCONGRUENTE
    # 2) Ferrobamba con MZH/MZH/MZH y K=11.62 -> SI debe dar CAT_PLT_FACTOR_K_INCONGRUENTE (espera 9.31)
    test_data = [
        {
            "Nro Muestra": "M1",
            "Taladro": "DDGT-CBIS26-001",
            "Nro Caja": 1,
            "Campaña": 2026,
            "Fecha": "2026-01-15",
            "Corrida Desde (m)": 0.0,
            "Corrida Hasta (m)": 3.0,
            "From": 1.0,
            "To": 1.15,
            "Tipo Ensayo": "D",
            "Nominacion": "HQ",
            "Diametro (mm)": 61.1,
            "Longitud (mm)": 75.0,
            "Litologia 1": "MZH",
            "Litologia 2": "MZH",
            "Litologia 3": "MZH",
            "Tipo litológico": "INTRUSIVOS",
            "P instr (kN)": 20.0,
            "Tipo de Rotura": "M",
            "Dirección de rotura": "NA",
            "Ejecutado por": "GEOTECNIA",
            "Is (Mpa)": 5.36,
            "Fact. Corr": 1.09,
            "Is(50) (Mpa)": 5.86,
            "Factor K": 11.62,
            "UCS": 68.09,
            "ISRM Indice R": "R4"
        },
        {
            "Nro Muestra": "M2",
            "Taladro": "FEGT20-001",
            "Nro Caja": 1,
            "Campaña": 2020,
            "Fecha": "2020-05-10",
            "Corrida Desde (m)": 0.0,
            "Corrida Hasta (m)": 3.0,
            "From": 1.0,
            "To": 1.15,
            "Tipo Ensayo": "D",
            "Nominacion": "HQ",
            "Diametro (mm)": 61.1,
            "Longitud (mm)": 75.0,
            "Litologia 1": "MZH",
            "Litologia 2": "MZH",
            "Litologia 3": "MZH",
            "Tipo litológico": "INTRUSIVOS",
            "P instr (kN)": 20.0,
            "Tipo de Rotura": "M",
            "Dirección de rotura": "NA",
            "Ejecutado por": "GEOTECNIA",
            "Is (Mpa)": 5.36,
            "Fact. Corr": 1.09,
            "Is(50) (Mpa)": 5.86,
            "Factor K": 11.62,  # En Ferrobamba esto es discordante porque espera 9.31
            "UCS": 54.56,
            "ISRM Indice R": "R4"
        }
    ]

    df = pd.DataFrame(test_data)
    diag = validator.audit_dataframe(df)

    anomalias_k = [a for a in diag["anomalies"] if a["category_code"] == "CAT_PLT_FACTOR_K_INCONGRUENTE"]
    assert len(anomalias_k) == 1, f"Debe haber exactamente 1 anomalía de Factor K, hubo {len(anomalias_k)}"
    assert anomalias_k[0]["taladro"] == "FEGT20-001", "La anomalía de Factor K debe pertenecer al taladro de Ferrobamba"
    assert diag["unique_samples_plt"][0]["proyecto"] == "chalco"
    assert diag["unique_samples_plt"][1]["proyecto"] == "ferrobamba"
    print("[OK] Auditoría multi-proyecto de DataFrame validada con éxito.")


if __name__ == "__main__":
    test_catalogs_loaded()
    test_project_autodetection()
    test_ferrobamba_resolution()
    test_chalcobamba_resolution()
    test_validator_audit_multi_project()
    print("\nTODOS LOS TESTS MULTI-PROYECTO PASARON EXITOSAMENTE (100% OK).")
