import asyncio
from contextlib import closing
from datetime import datetime
import json
from zipfile import ZipFile

from fastapi import FastAPI, UploadFile
from openpyxl import Workbook, load_workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Font
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.views import Selection

from app.reportes.stream_writer import StreamingReportWorkbook, _CellStore
from app.services.audit_artifact_store import AuditStorage, diagnostic_items, load_diagnostic
from app.services import ddh_audit_service as ddh
from app.routers import auditoria as ddh_api, auditoria_plt as plt_api
from app.validator import validate_revision_bulk_v2


def write_ddh(path):
    workbook = Workbook()
    lgg = workbook.active
    lgg.title = "BD LGG"
    lgg.append(["Registro sintético"])
    lgg.append(["Taladro", "Corrida", "De", "A", "Recuperación", "RQD", "Campaña"])
    lgg.append(["DH-1", 1, 0, 2, 3, 4, 2025])
    lgg.append([None, 1, 2, 4, 2, 1, 2025])
    est = workbook.create_sheet("EST")
    est.append(["Taladro", "De", "A", "Profundidad", "Alfa", "Beta", "Tipo de Estructura"])
    est.append(["DH-1", 0, 2, 1, 105, 80, "J"])
    rmr = workbook.create_sheet("RMR")
    rmr.append(["Sondaje", "De", "A", "RMR76", "RMR89"])
    rmr.append(["DH-1", 0, 2, 10, 50])
    rmr.cell(row=10000, column=1).font = Font(bold=True)
    workbook.save(path)


def test_ddh_diagnostic_report_and_history(tmp_path, monkeypatch):
    path = tmp_path / "input.xlsx"
    write_ddh(path)
    config = {"lgg": {"sheet": "BD LGG"}, "est": {"sheet": "EST"}, "rmr": {"sheet": "RMR"}}
    expected = validate_revision_bulk_v2({"lgg_est": str(path)}, config, None)
    for module in (ddh, ddh_api):
        monkeypatch.setattr(module, "uploads_dir", str(tmp_path))
        monkeypatch.setattr(module, "history_dir", str(tmp_path))

    ddh.run_revision_audit_pipeline({"lgg_est": str(path)}, config, "test", path.name)
    raw = tmp_path / "test_diagnostico.json"
    assert expected["total_filas_procesadas"] == 4
    assert expected["incidencias"]
    assert json.loads(raw.read_text(encoding="utf-8")) == expected
    with AuditStorage() as storage:
        restored = load_diagnostic(raw)
        assert json.loads(json.dumps(restored)) == expected
    assert storage.store.file.closed
    page = ddh_api.obtener_incidencias_paginadas(page=5000, limit=2, audit_id="test")
    records = expected["incidencias"]
    assert page["total_records"] == len(records)
    assert page["data"] == records[(page["page"] - 1) * 2:]
    assert list(diagnostic_items(raw, "incidencias")) == records
    summary = ddh_api.obtener_resumen_ligero(audit_id="test")
    assert json.loads(open(summary.path, encoding="utf-8").read())["audit_id"] == "test"

    with closing(load_workbook(tmp_path / "test_reporte_completo.xlsx")) as workbook:
        assert len(workbook.sheetnames) > 4
        assert any(ws.data_validations.dataValidation for ws in workbook)
        assert any(ws._charts for ws in workbook)
        assert any(cell.data_type == "f" for ws in workbook for cell in ws._cells.values())


def test_plt_upload_crosscheck_and_pagination(tmp_path, monkeypatch):
    lgg_path = tmp_path / "lgg.xlsx"
    write_ddh(lgg_path)
    workbook = Workbook()
    workbook.active.title = "ENSAYO PLT"
    workbook.active.append(["Campaña", "Fecha", "Taladro", "Nro Muestra", "From", "To"])
    workbook.active.append([2025, datetime(2025, 1, 1), "DH-1", "M-1", 1, 1.5])
    workbook.active.append([2025, datetime(2025, 1, 1), "DH-1", "M-1", 1, 1.5])
    path = tmp_path / "plt.xlsx"
    workbook.save(path)
    monkeypatch.setattr(plt_api, "plt_history_dir", str(tmp_path))
    for key in ("LATEST_PLT_DIAG", "LATEST_PLT_COMPACT", "LATEST_PLT_EXCEL"):
        monkeypatch.setattr(plt_api, key, str(tmp_path / (key + (".xlsx" if "EXCEL" in key else ".json"))))
    app = FastAPI()
    app.include_router(plt_api.router)
    schema = app.openapi()
    for route in ("/api/auditoria/plt/upload", "/api/audit/plt/upload-and-audit"):
        operation = schema["paths"][route]["post"]
        assert "multipart/form-data" in operation["requestBody"]["content"]
    with path.open("rb") as sample, lgg_path.open("rb") as lgg:
        result = asyncio.run(plt_api.upload_plt_audit_file(
            UploadFile(sample, filename=path.name), UploadFile(lgg, filename=lgg_path.name), None))
    assert result.status_code == 200
    raw = json.loads(open(plt_api.LATEST_PLT_DIAG, encoding="utf-8").read())
    assert raw["has_lgg_crosscheck"]
    assert raw["total_rows"] == 2
    assert raw["anomalies"] == raw["incidencias"]
    assert all(a["sample_code"] == a["muestra"] for a in raw["anomalies"])
    assert sum(r["muestras_plt_cant"] for r in raw["unique_runs_lgg"]) == 2
    assert plt_api.get_latest_plt_diagnostic().path == plt_api.LATEST_PLT_DIAG
    page = plt_api.get_plt_paginated_incidencias(1, 2, None, "ALERTA", "2025", "DH-1", None, None)
    expected = [a for a in raw["anomalies"] if a["severity"] == "ALERTA"]
    assert expected
    assert json.loads(page.body)["items"] == expected[:2]
    with ZipFile(plt_api.LATEST_PLT_EXCEL) as report:
        assert report.testzip() is None


def test_report_cells_survive_eviction(tmp_path, monkeypatch):
    monkeypatch.setattr(_CellStore, "CACHE_ROWS", 8)
    workbook = StreamingReportWorkbook()
    sheet = workbook.active
    sheet.freeze_panes = "C4"
    sheet.sheet_view.selection.append(Selection(activeCell="D4", sqref="D4"))
    sheet["B2"] = "=SUM(B5:B44)"
    sheet["B2"].font = Font(bold=True)
    sheet["B3"] = "go"
    sheet["B3"].hyperlink = "https://example.com"
    sheet.merge_cells("B3:C3")
    dv = DataValidation(type="list", formula1='"A,B"')
    sheet.add_data_validation(dv)
    dv.add("E5")
    for row in range(5, 45):
        sheet.cell(row=row, column=2, value=row)
    chart = BarChart()
    chart.add_data(Reference(sheet, min_col=2, min_row=5, max_row=44))
    sheet.add_chart(chart, "F5")
    path = tmp_path / "out.xlsx"
    workbook.save(path)
    assert not __import__("pathlib").Path(workbook._layout_path).exists()
    with closing(load_workbook(path)) as restored:
        sheet = restored.active
        assert sheet["B2"].value == "=SUM(B5:B44)"
        assert sheet["B2"].font.bold
        assert sheet["B44"].value == 44
        assert sheet["B3"].hyperlink.target == "https://example.com"
        assert "B3:C3" in sheet.merged_cells
        assert sheet.freeze_panes == "C4"
        assert sheet.sheet_view.selection[-1].activeCell == "D4"
        assert str(sheet.data_validations.dataValidation[0].sqref) == "E5"
        assert sheet._charts[0].series[0].val.numRef.f.endswith("$B$5:$B$44")
