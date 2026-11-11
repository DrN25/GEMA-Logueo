"""Disk-backed report layout, emitted once through openpyxl write_only.

The existing reports compose tables, charts and the interactive missing-data
sheet using random-access cells. Only a bounded cell cache stays in memory;
layout records live in a private temporary SQLite file, NOT application SQL.
This preserves their layout without maintaining a second DOM-sized workbook.
"""
from collections import OrderedDict
from collections.abc import MutableMapping
from copy import copy, deepcopy
from itertools import groupby
import os
import pickle
import sqlite3
import tempfile

from openpyxl import Workbook
from openpyxl.cell.cell import Cell, MergedCell, WriteOnlyCell
from openpyxl.styles.cell_style import StyleArray
from openpyxl.utils import get_column_letter
from openpyxl.utils.indexed_list import IndexedList
from openpyxl.worksheet.worksheet import Worksheet


class _ReportStyles(IndexedList):
    """Reuse registry IDs for the immutable style instances used by a report."""
    def __init__(self, values):
        super().__init__(values)
        self._identities = OrderedDict()

    def add(self, value):
        identity = id(value)
        cached = self._identities.get(identity)
        if cached is not None:
            self._identities.move_to_end(identity)
            return cached[1]
        index = super().add(value)
        self._identities[identity] = value, index
        if len(self._identities) > 128:
            self._identities.popitem(last=False)
        return index


class _CellStore(MutableMapping):
    CACHE_ROWS = 128

    def __init__(self, worksheet, connection, sheet_id):
        self.ws, self.db, self.sheet_id = worksheet, connection, sheet_id
        self.cache = worksheet.parent._layout_cache
        self.persisted_max_row = 0
        self.max_row = self.max_col = 0
        self.min_row = self.min_col = None

    def _encode(self, cell):
        return pickle.dumps((isinstance(cell, MergedCell), cell.value,
                             cell.data_type, tuple(cell._style) if cell._style is not None else None,
                             getattr(cell, "_hyperlink", None),
                             getattr(cell, "_comment", None)), protocol=5)

    def _decode(self, key, data):
        merged, value, kind, style, hyperlink, comment = pickle.loads(data)
        cell = (MergedCell(self.ws, row=key[0], column=key[1]) if merged
                else Cell(self.ws, row=key[0], column=key[1]))
        cell._style = StyleArray(style) if style is not None else None
        if not merged:
            cell._value, cell.data_type = value, kind
            cell._hyperlink, cell._comment = hyperlink, comment
        return cell

    def _persist_row(self, row, entry):
        cells, original = entry

        def changed_cells():
            for column, cell in cells.items():
                data = self._encode(cell)
                if original.get(column) != data:
                    yield self.sheet_id, row, column, data

        self.db.executemany("INSERT OR REPLACE INTO cells VALUES (?, ?, ?, ?)", changed_cells())
        if cells:
            self.persisted_max_row = max(self.persisted_max_row, row)

    def flush(self, *, release=False):
        for key in tuple(self.cache):
            if key[0] == self.sheet_id:
                _, entry = self.cache[key]
                self._persist_row(key[1], entry)
                if release:
                    del self.cache[key]

    def _row(self, row):
        key = self.sheet_id, row
        if key not in self.cache:
            original = (dict(self.db.execute("SELECT c,data FROM cells WHERE sheet=? AND r=?",
                                             (self.sheet_id, row)))
                        if row <= self.persisted_max_row else {})
            cells = {c: self._decode((row, c), data) for c, data in original.items()}
            self.cache[key] = self, (cells, original)
            if len(self.cache) > self.CACHE_ROWS:
                (_, old_row), (owner, entry) = self.cache.popitem(last=False)
                owner._persist_row(old_row, entry)
        else:
            self.cache.move_to_end(key)
        return self.cache[key][1][0]

    def __getitem__(self, key):
        row, column = key
        return self._row(row)[column]

    def __setitem__(self, key, cell):
        row, column = key
        self.max_row, self.max_col = max(self.max_row, row), max(self.max_col, column)
        self.min_row = min(self.min_row or row, row)
        self.min_col = min(self.min_col or column, column)
        self._row(row)[column] = cell

    def __delitem__(self, key):
        if key not in self:
            raise KeyError(key)
        del self._row(key[0])[key[1]]
        self.db.execute("DELETE FROM cells WHERE sheet=? AND r=? AND c=?", (self.sheet_id, *key))
        self.flush()
        bounds = self.db.execute("SELECT min(r), min(c), max(r), max(c) FROM cells WHERE sheet=?",
                                 (self.sheet_id,)).fetchone()
        self.min_row, self.min_col, self.max_row, self.max_col = bounds
        self.max_row, self.max_col = self.max_row or 0, self.max_col or 0

    def __iter__(self):
        self.flush()
        for row, column in self.db.execute("SELECT r,c FROM cells WHERE sheet=? ORDER BY r,c", (self.sheet_id,)):
            yield row, column

    def __len__(self):
        self.flush()
        return self.db.execute("SELECT count(*) FROM cells WHERE sheet=?", (self.sheet_id,)).fetchone()[0]

    def __bool__(self):
        return self.max_row > 0

    def ordered_cells(self):
        self.flush(release=True)
        for row, column, data in self.db.execute(
                "SELECT r,c,data FROM cells WHERE sheet=? ORDER BY r,c", (self.sheet_id,)):
            yield row, column, self._decode((row, column), data)


class _LayoutWorksheet(Worksheet):
    def __init__(self, parent, title, sheet_id):
        super().__init__(parent, title)
        self._cells = _CellStore(self, parent._layout_db, sheet_id)

    @property
    def max_row(self):
        return self._cells.max_row or 1

    @property
    def max_column(self):
        return self._cells.max_col or 1

    @property
    def min_row(self):
        return self._cells.min_row or 1

    @property
    def min_column(self):
        return self._cells.min_col or 1

    def fit_report_columns(self):
        widths = [0] * self.max_column
        for _, column, cell in self._cells.ordered_cells():
            value = str(cell.value or "")
            if not value.startswith("=") and len(value) < 60:
                widths[column - 1] = max(widths[column - 1], len(value))
        for column, width in enumerate(widths, 1):
            self.column_dimensions[get_column_letter(column)].width = max(width + 3, 13)

    def calculate_dimension(self):
        return (f"{get_column_letter(self.min_column)}{self.min_row}:"
                f"{get_column_letter(self.max_column)}{self.max_row}")


class StreamingReportWorkbook(Workbook):
    """Report-only random-access layout with bounded cache and streaming save.

    Style cells immediately after retrieving them, as the report builders do.
    Output is saved once to an internal file; callers may copy/rename that file.
    """
    def __init__(self):
        super().__init__()
        for name in ("_fonts", "_fills", "_borders", "_alignments", "_protections"):
            setattr(self, name, _ReportStyles(getattr(self, name)))
        fd, self._layout_path = tempfile.mkstemp(prefix="gema-report-", suffix=".sqlite")
        os.close(fd)
        self._layout_db = None
        self._layout_closed = False
        try:
            self._initialize_layout()
        except BaseException:
            self.close()
            raise

    def _initialize_layout(self):
        self._layout_db = sqlite3.connect(self._layout_path)
        self._layout_db.execute("PRAGMA journal_mode=OFF")
        self._layout_db.execute("PRAGMA synchronous=OFF")
        self._layout_db.execute("PRAGMA temp_store=FILE")
        self._layout_db.execute("PRAGMA cache_size=-1024")
        self._layout_db.execute("CREATE TABLE cells (sheet INTEGER,r INTEGER,c INTEGER,data BLOB,PRIMARY KEY(sheet,r,c)) WITHOUT ROWID")
        self._sheets = []
        self._layout_cache = OrderedDict()
        self._next_layout_id = 0
        self._layout_closed = False
        self._stream_saved = False
        self.create_sheet("Sheet")

    def create_sheet(self, title=None, index=None):
        sheet = _LayoutWorksheet(self, title, self._next_layout_id)
        self._next_layout_id += 1
        self._add_sheet(sheet, index)
        return sheet

    def save(self, filename):
        if self._stream_saved:
            raise RuntimeError("A streaming report can only be saved once; copy the saved file instead")
        output = Workbook(write_only=True)
        try:
            self._write_output(output, filename)
            self._stream_saved = True
        finally:
            try:
                for sheet in output.worksheets:
                    writer = sheet._writer
                    if writer is not None and os.path.exists(writer.out):
                        try:
                            if not sheet.closed:
                                sheet.close()
                        finally:
                            writer.cleanup()
            finally:
                output.close()
                self.close()

    def _write_output(self, output, filename):
        for name in ("_fonts", "_fills", "_borders", "_alignments", "_protections",
                     "_number_formats", "_cell_styles", "_differential_styles", "_named_styles"):
            setattr(output, name, getattr(self, name))
        output.properties = deepcopy(self.properties)
        output.calculation = deepcopy(self.calculation)
        output.defined_names = deepcopy(self.defined_names)
        for source in self.worksheets:
            target = output.create_sheet(source.title)
            for attr in ("sheet_format", "sheet_properties", "views", "sheet_state",
                         "auto_filter", "conditional_formatting", "data_validations",
                         "merged_cells", "print_options", "page_margins", "page_setup",
                         "HeaderFooter", "protection", "sheet_view"):
                if attr == "sheet_view":  # read-only convenience property, already in views
                    continue
                setattr(target, attr, deepcopy(getattr(source, attr), {id(source): target, id(self): output}))
            for key, dim in source.column_dimensions.items():
                target.column_dimensions[key] = copy(dim)
            for key, dim in source.row_dimensions.items():
                target.row_dimensions[key] = copy(dim)
            if source.print_area:
                target.print_area = source.print_area
            target.print_title_rows = source.print_title_rows
            target.print_title_cols = source.print_title_cols
            target._charts = source._charts
            target._images = source._images
            target.calculate_dimension = lambda ref=source.calculate_dimension(): ref
            previous = 0
            for number, cells in groupby(source._cells.ordered_cells(), key=lambda item: item[0]):
                while previous + 1 < number:
                    target.append([])
                    previous += 1
                row = []
                for _, column, original in cells:
                    row.extend([None] * (column - len(row)))
                    cell = WriteOnlyCell(target)
                    cell._value, cell.data_type = original.value, original.data_type
                    cell._style = original._style
                    cell._hyperlink = getattr(original, "_hyperlink", None)
                    cell._comment = getattr(original, "_comment", None)
                    row[column - 1] = cell
                target.append(row)
                previous = number
        output.active = self._active_sheet_index
        output.save(filename)

    def close(self):
        if not getattr(self, "_layout_closed", True):
            self._layout_closed = True
            if self._layout_db is not None:
                self._layout_db.close()
            if hasattr(self, "_layout_cache"):
                self._layout_cache.clear()
            os.unlink(self._layout_path)

    def __del__(self):
        self.close()
