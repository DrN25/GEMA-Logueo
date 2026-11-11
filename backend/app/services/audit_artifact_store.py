"""Temporary, disk-backed sequences for large audit intermediates.

This uses a private binary temporary file, never the shared SQL database.
Pickle records are only read from the file created by this process (not uploads).
Outside an audit scope new_sequence() remains a normal list for compatibility.
"""
from array import array
from contextvars import ContextVar
from functools import wraps
from inspect import iscoroutinefunction
import pickle
import tempfile
import threading

_active_store = ContextVar("audit_record_store", default=None)


class RecordStore:
    def __init__(self):
        self.file = tempfile.TemporaryFile(prefix="gema-audit-", suffix=".records")
        self.lock = threading.RLock()

    def append(self, value):
        with self.lock:
            self.file.seek(0, 2)
            offset = self.file.tell()
            pickle.dump(value, self.file, protocol=5)
            return offset

    def read(self, offset):
        with self.lock:
            self.file.seek(offset)
            return pickle.load(self.file)

    def close(self):
        self.file.close()


class DiskSequence(list):
    """List-shaped replayable sequence, with only uint64 offsets in memory.

    Records are snapshots: callers must update via __setitem__ after mutation.
    Audit readers append complete records; rule evaluation treats them as input.
    """
    def __init__(self, store, values=()):
        super().__init__()
        self.store = store
        self.offsets = array("Q")
        self.extend(values)

    def __len__(self):
        return len(self.offsets)

    def __bool__(self):
        return bool(self.offsets)

    def __iter__(self):
        for offset in self.offsets:
            yield self.store.read(offset)

    def __getitem__(self, index):
        if isinstance(index, slice):
            return [self.store.read(offset) for offset in self.offsets[index]]
        return self.store.read(self.offsets[index])

    def __setitem__(self, index, value):
        self.offsets[index] = self.store.append(value)

    def append(self, value):
        self.offsets.append(self.store.append(value))

    def extend(self, values):
        if isinstance(values, DiskSequence) and values.store is self.store:
            self.offsets.extend(values.offsets)
        else:
            for value in values:
                self.append(value)

    def sort(self, *, key=None, reverse=False):
        # Sort scalar keys/offsets, not all input dictionaries at once.
        pairs = [(key(value) if key else value, offset)
                 for offset, value in zip(self.offsets, self)]
        pairs.sort(key=lambda item: item[0], reverse=reverse)
        self.offsets = array("Q", (offset for _, offset in pairs))

    def clear(self):
        self.offsets = array("Q")

    def pop(self, index=-1):
        offset = self.offsets.pop(index)
        return self.store.read(offset)

    def __add__(self, other):
        result = DiskSequence(self.store)
        result.extend(self)
        result.extend(other)
        return result

    def __radd__(self, other):
        result = DiskSequence(self.store, other)
        result.extend(self)
        return result


def new_sequence(values=()):
    store = _active_store.get()
    return DiskSequence(store, values) if store is not None else list(values)


class AuditStorage:
    def __enter__(self):
        self.parent = _active_store.get()
        self.store = self.parent or RecordStore()
        self.token = _active_store.set(self.store)
        return self

    def __exit__(self, *args):
        _active_store.reset(self.token)
        if self.parent is None:
            self.store.close()


def bounded_audit(function):
    """Keep scratch records alive through validation, aggregation and export."""
    if iscoroutinefunction(function):
        @wraps(function)
        async def async_wrapped(*args, **kwargs):
            with AuditStorage():
                return await function(*args, **kwargs)
        return async_wrapped
    @wraps(function)
    def wrapped(*args, **kwargs):
        with AuditStorage():
            return function(*args, **kwargs)
    return wrapped


def load_diagnostic(path):
    """Stream top-level arrays (including nested arrays) into scratch storage.

    Must be consumed within AuditStorage. Historical JSON stays compatible.
    """
    import ijson
    store = _active_store.get()
    if store is None:
        raise RuntimeError("load_diagnostic requires an AuditStorage scope")
    stack = []
    result = None
    with open(path, "rb") as source:
        for _, event, value in ijson.parse(source, use_float=True):
            if event == "map_key":
                stack[-1][1] = value
                continue
            if event in ("start_map", "start_array"):
                item = {} if event == "start_map" else DiskSequence(store)
                stack.append([item, None])
                continue
            if event in ("end_map", "end_array"):
                item, _ = stack.pop()
            else:
                item = value
            if not stack:
                result = item
            elif isinstance(stack[-1][0], dict):
                stack[-1][0][stack[-1][1]] = item
            else:
                # Nested disk lists cannot be pickled with a live store; their
                # records are usually small tuples/arrays, materialize only this item.
                stack[-1][0].append(_plain_nested(item))
    return result


def _plain_nested(value):
    if isinstance(value, DiskSequence):
        return [_plain_nested(item) for item in value]
    if isinstance(value, dict):
        return {key: _plain_nested(item) for key, item in value.items()}
    return value


def append_grouped(records, group, value):
    records.append(value)
    if isinstance(records, DiskSequence) and isinstance(group, DiskSequence) and group.store is records.store:
        group.offsets.append(records.offsets[-1])
    else:
        group.append(value)


def _publish_atomic(path, writer):
    from pathlib import Path
    import os
    target = Path(path)
    fd, name = tempfile.mkstemp(dir=target.parent, prefix=".audit-", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as output:
            writer(output)
        os.replace(name, target)
    finally:
        Path(name).unlink(missing_ok=True)


def write_json_atomic(path, data):
    from json import JSONEncoder
    encoder = JSONEncoder(ensure_ascii=False)
    def write(output):
        for chunk in encoder.iterencode(data):
            output.write(chunk.encode("utf-8"))
    _publish_atomic(path, write)


def copy_file_atomic(source, path):
    from shutil import copyfileobj
    def write(output):
        with open(source, "rb") as content:
            copyfileobj(content, output)
    _publish_atomic(path, write)


def diagnostic_items(path, key):
    import ijson
    with open(path, "rb") as source:
        yield from ijson.items(source, key + ".item", use_float=True)


def audit_page(records, predicate, page, limit, *, clamp=False):
    """Count all matches, retaining only the requested page and optional tail."""
    from collections import deque
    if page < 1:
        page = 1
    if limit < 1:
        raise ValueError("Page size must be positive")
    start = (page - 1) * limit
    tail = deque(maxlen=limit) if clamp else None
    selected = []
    total = 0
    for item in records:
        if not predicate(item):
            continue
        if start <= total < start + limit:
            selected.append(item)
        if tail is not None:
            tail.append(item)
        total += 1
    pages = max(1, (total + limit - 1) // limit)
    if clamp and page > pages:
        page = pages
        size = total - (page - 1) * limit
        selected = list(tail)[-size:] if size else []
    return selected, total, page, pages
