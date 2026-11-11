"""Compare audit JSON and report semantics in a process outside the benchmark."""
import argparse
from contextlib import ExitStack
from itertools import zip_longest
import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from openpyxl import load_workbook


def assert_same(left, right, label):
    if left != right:
        raise AssertionError(f"Difference in {label}")


def report_metadata(path):
    """Compare report layout XML without retaining the potentially large sheetData."""
    with ZipFile(path) as archive:
        for name in sorted(archive.namelist()):
            if name.startswith(("xl/charts/", "xl/drawings/")) or name.endswith(".rels") and name.startswith("xl/worksheets/"):
                yield name, ET.tostring(ET.fromstring(archive.read(name)))
            if not (name.startswith("xl/worksheets/sheet") and name.endswith(".xml")):
                continue
            with archive.open(name) as xml:
                events = ET.iterparse(xml, events=("start", "end"))
                _, root = next(events)
                depth = 0
                parent_data = None
                for event, node in events:
                    tag = node.tag.rsplit("}", 1)[-1]
                    if event == "start":
                        depth += 1
                        if depth == 1 and tag == "sheetData":
                            parent_data = node
                        continue
                    if depth == 2 and parent_data is not None:
                        parent_data.remove(node)
                    if depth == 1:
                        if tag not in ("sheetData", "dimension"):
                            if tag == "mergeCells":
                                node[:] = sorted(node, key=lambda child: child.attrib["ref"])
                            yield (name, tag), ET.tostring(node)
                        root.remove(node)
                        parent_data = None
                    depth -= 1


def signatures(sheet):
    for row in sheet.iter_rows():
        # An explicitly created but unstyled empty cell has no visible effect.
        for cell in row:
            style = getattr(cell, "_style_id", 0)
            if cell.value is not None or style:
                signature = tuple(cell.parent.parent._cell_styles[style]) if style else ()
                value = cell.value
                if isinstance(value, str):
                    value = re.sub(r"(?<= \| Generado: )\d{2}/\d{2}/\d{4} \d{2}:\d{2}$", "<fecha>", value)
                yield cell.coordinate, value, cell.data_type, signature


def compare_reports(before, after):
    with ExitStack() as stack:
        a, b = (load_workbook(path, read_only=True) for path in (before, after))
        stack.callback(a.close)
        stack.callback(b.close)
        assert_same(a.sheetnames, b.sheetnames, "sheet order")
        for name in a.sheetnames:
            for x, y in zip_longest(signatures(a[name]), signatures(b[name])):
                assert_same(x, y, f"{name}: {x and x[0]} / {y and y[0]}")
    for a, b in zip_longest(report_metadata(before), report_metadata(after)):
        assert_same(a, b, f"metadata: {a and a[0]} / {b and b[0]}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for kind in ("json", "xlsx"):
        parser.add_argument("--before-" + kind, type=Path, required=True)
        parser.add_argument("--after-" + kind, type=Path, required=True)
    args = parser.parse_args()
    left, right = [json.loads(p.read_text(encoding="utf-8"))
                   for p in (args.before_json, args.after_json)]
    for key in ("fecha_auditoria", "audit_id"):
        left.pop(key, None)
        right.pop(key, None)
    assert_same(left.keys(), right.keys(), "diagnostic keys")
    for key in left:
        assert_same(left[key], right[key], f"diagnostic field {key}")
    compare_reports(args.before_xlsx, args.after_xlsx)
    print("Diagnostic and report match.")


if __name__ == "__main__":
    main()
