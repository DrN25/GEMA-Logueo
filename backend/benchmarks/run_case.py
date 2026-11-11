"""Run the real audit handlers with private output paths, without starting SQL."""
import argparse
import asyncio
from contextlib import ExitStack
import json
from pathlib import Path
import sys
import time
from zipfile import ZipFile


def mark(phase):
    print(f"BENCHMARK {phase} {time.monotonic():.9f}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--mode", choices=("ddh", "plt"), required=True)
    parser.add_argument("--excel", type=Path, required=True)
    parser.add_argument("--lgg", type=Path)
    parser.add_argument("--collar", type=Path)
    parser.add_argument("--survey", type=Path)
    parser.add_argument("--config", type=Path, help="DDH config_json from the import form")
    parser.add_argument("--project")
    args = parser.parse_args()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=False)
    sys.path.insert(0, str(args.source.resolve()))

    if args.mode == "ddh":
        from app.services import ddh_audit_service as service
        service.uploads_dir = service.history_dir = str(out)
        mark("ready")
        inputs = {"lgg_est": str(args.excel)}
        for name in ("collar", "survey"):
            if getattr(args, name):
                inputs[name] = str(getattr(args, name))
        config = json.loads(args.config.read_text(encoding="utf-8-sig")) if args.config else {}
        mark("audit_started")
        service.run_revision_audit_pipeline(inputs, config, "bench", args.excel.name)
        diagnostic = out / "bench_diagnostico.json"
        report = out / "bench_reporte_completo.xlsx"
    else:
        from fastapi import UploadFile
        from app.routers import auditoria_plt as service
        service.plt_history_dir = str(out)
        service.LATEST_PLT_DIAG = str(out / "latest_diag.json")
        service.LATEST_PLT_COMPACT = str(out / "latest_compact.json")
        service.LATEST_PLT_EXCEL = str(out / "latest_report.xlsx")
        mark("ready")
        with ExitStack() as stack:
            def upload(path):
                return UploadFile(stack.enter_context(path.open("rb")), filename=path.name)
            mark("audit_started")
            response = asyncio.run(service.upload_plt_audit_file(
                upload(args.excel), upload(args.lgg) if args.lgg else None, args.project))
        if response.status_code != 200:
            raise RuntimeError(f"Audit failed: HTTP {response.status_code}")
        diagnostic = Path(service.LATEST_PLT_DIAG)
        report = Path(service.LATEST_PLT_EXCEL)

    if not diagnostic.is_file() or not report.is_file():
        raise RuntimeError("Audit did not publish both diagnostic and report")
    with ZipFile(report) as archive:
        if "xl/workbook.xml" not in archive.namelist():
            raise RuntimeError("Output report is not an Excel workbook")
    mark("artifacts_ready")


if __name__ == "__main__":
    main()
