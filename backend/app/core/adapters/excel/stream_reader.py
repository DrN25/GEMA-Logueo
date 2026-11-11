"""Bounded header inspection and sequential worksheet projection.

Do not use Worksheet.cell in a read-only data loop: each lookup can reopen and
scan the XML stream. Column numbers here retain openpyxl's one-based contract.
"""
from contextlib import ExitStack, closing
from openpyxl import load_workbook


def header_rows(sheet):
    rows = getattr(sheet, "_gema_header_rows", None)
    if rows is None:
        rows = tuple(sheet.iter_rows(min_row=1, max_row=20, values_only=True))
        sheet._gema_header_rows = rows
    return rows


def header_values(sheet, row):
    rows = header_rows(sheet)
    if 1 <= row <= len(rows):
        return rows[row - 1]
    return next(sheet.iter_rows(min_row=row, max_row=row, values_only=True), ())


def iter_mapped_rows(sheet, start_row, mapping):
    """Yield physical Excel row, projected dictionary and existing empty test."""
    columns = tuple((key, col - 1) for key, col in mapping.items())
    max_col = max(mapping.values(), default=1)
    for number, values in enumerate(
        sheet.iter_rows(min_row=start_row, max_col=max_col, values_only=True),
        start=start_row,
    ):
        row = {key: values[index] if index < len(values) else None
               for key, index in columns}
        empty = all(value is None or str(value).strip() == "" for value in row.values())
        yield number, row, empty


def open_read_workbook(stack: ExitStack, path):
    return stack.enter_context(closing(load_workbook(path, read_only=True, data_only=True)))
