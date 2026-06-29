import React, { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import type { ValidationAlert } from '../../utils/qaqcValidator';

export interface GridColumn<T> {
  key: keyof T | 'id' | 'accion';
  label: string;
  width: string;
  type: 'text' | 'number' | 'select' | 'readonly';
  options?: string[];
  step?: string;
  min?: number;
  max?: number;
  isSticky?: boolean;
  stickyLeft?: number;
  isStickyRight?: boolean;
  stickyRight?: number;
  headerBgClass?: string;
  cellClassName?: string;
  renderCell?: (row: T, index: number, isSelected: boolean) => React.RefNode | React.ReactNode;
}

interface BaseEditableGridProps<T> {
  data: T[];
  columns: GridColumn<T>[];
  selectedRowIndex: number | null;
  onSelectRow: (index: number) => void;
  onCellChange: (index: number, field: keyof T, value: any) => void;
  alerts: ValidationAlert[];
  idPrefix: string;
  onAddRow?: () => void;
  onDeleteRow?: (index: number) => void;
  getRowKey: (row: T, index: number) => string | number;
  editableFields: (keyof T)[];
  darkMode?: boolean;
  minWidth?: string;
  getAlertRowIndex?: (row: T, displayIndex: number) => number;
}

const EMPTY_ALERTS: ValidationAlert[] = [];

function getCellTdStyle(
  colKey: string,
  isSticky: boolean,
  stickyLeft: number | undefined,
  isStickyRight: boolean,
  stickyRight: number | undefined,
  isSelected: boolean,
  rowAlerts: ValidationAlert[],
  alertRowIndex: number,
  idPrefix: string
): React.CSSProperties {
  let alert: ValidationAlert | undefined;
  if (idPrefix === 'lgg-cell') {
    alert = rowAlerts.find(a => a.field === `${colKey}-${alertRowIndex}`);
  } else if (idPrefix === 'struct-cell') {
    alert = rowAlerts.find(a => a.field === `struct-${colKey}-${alertRowIndex}`);
  } else {
    alert = rowAlerts.find(a =>
      a.field === `${idPrefix}-${colKey}-${alertRowIndex}` ||
      a.field === `${colKey}-${alertRowIndex}`
    );
  }

  const actualStickyRight = isStickyRight || colKey === 'accion';
  const isStickyAny = isSticky || actualStickyRight;

  let borderShadow: string | undefined = isSticky
    ? 'inset -1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), 1px 0 0 0 rgb(var(--navy-900))'
    : undefined;

  if (actualStickyRight) {
    borderShadow = 'inset 1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), -1px 0 0 0 rgb(var(--navy-900))';
  }

  let background: string | undefined;
  const stickyStyle: React.CSSProperties = {};

  if (isSticky) {
    Object.assign(stickyStyle, { position: 'sticky', left: stickyLeft ?? 0, zIndex: 10 });
  } else if (actualStickyRight) {
    Object.assign(stickyStyle, { position: 'sticky', right: stickyRight ?? 0, zIndex: 10 });
  }

  let baseBg = isStickyAny ? 'rgb(var(--navy-950))' : undefined;
  if (isSelected) {
    baseBg = isStickyAny
      ? 'linear-gradient(rgba(6, 182, 212, 0.08), rgba(6, 182, 212, 0.08)), rgb(var(--navy-950))'
      : 'rgba(6, 182, 212, 0.08)';
  }

  if (alert) {
    const isCritical = alert.type === 'CRITICAL';
    const alertBg = isCritical ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)';
    const alertBorder = isCritical
      ? 'inset 0 0 0 2px rgba(239, 68, 68, 0.6)'
      : 'inset 0 0 0 2px rgba(245, 158, 11, 0.5)';

    if (isStickyAny) {
      borderShadow = `${alertBorder}, ${borderShadow}`;
      background = `linear-gradient(${alertBg}, ${alertBg}), ${baseBg || 'rgb(var(--navy-950))'}`;
    } else {
      borderShadow = alertBorder;
      background = baseBg ? `linear-gradient(${alertBg}, ${alertBg}), ${baseBg}` : alertBg;
    }
  } else if (baseBg) {
    background = baseBg;
  }

  const style: React.CSSProperties = { ...stickyStyle };
  if (borderShadow) style.boxShadow = borderShadow;
  if (background) style.background = background;
  return style;
}

function getHeaderStyle<T>(col: GridColumn<T>): React.CSSProperties {
  let borderShadows = 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
  const stickyStyle: React.CSSProperties = {};

  if (col.isSticky) {
    borderShadows = 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 1px 0 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
    Object.assign(stickyStyle, { position: 'sticky', left: col.stickyLeft ?? 0, zIndex: 30 });
  } else if (col.isStickyRight || col.key === 'accion') {
    borderShadows = 'inset 1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), -1px 0 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
    Object.assign(stickyStyle, { position: 'sticky', right: col.stickyRight ?? 0, zIndex: 30 });
  }

  return { background: 'rgb(var(--navy-900))', boxShadow: borderShadows, ...stickyStyle };
}

interface GridRowProps<T> {
  row: T;
  rowIndex: number;
  totalRows: number;
  columns: GridColumn<T>[];
  isSelected: boolean;
  rowAlerts: ValidationAlert[];
  alertRowIndex: number;
  idPrefix: string;
  editableFields: (keyof T)[];
  onSelect: (index: number) => void;
  onCellChange: (index: number, field: keyof T, value: any) => void;
  onAddRow?: () => void;
}

function GridRowInner<T>({
  row,
  rowIndex,
  totalRows,
  columns,
  isSelected,
  rowAlerts,
  alertRowIndex,
  idPrefix,
  editableFields,
  onSelect,
  onCellChange,
  onAddRow,
}: GridRowProps<T>) {

  const [editing, setEditing] = useState<Record<string, string>>({});
  const editingRef = useRef(editing);
  editingRef.current = editing;

  useEffect(() => {
    setEditing({});
  }, [row]);

  const getDisplayVal = (field: keyof T): string => {
    const k = String(field);
    if (k in editing) return editing[k];
    const val = row[field];
    return val !== undefined && val !== null ? String(val) : '';
  };

  const commitField = useCallback((field: keyof T, domValueOverride?: string) => {
    const k = String(field);
    const strVal = domValueOverride !== undefined
      ? domValueOverride
      : k in editingRef.current
        ? editingRef.current[k]
        : null;

    if (strVal === null) return;

    const colDef = columns.find(c => c.key === field);
    const parsed = colDef?.type === 'number'
      ? (parseFloat(strVal) || 0)
      : strVal;

    onCellChange(rowIndex, field, parsed);
  }, [rowIndex, onCellChange, columns]);

  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof T
  ) => {
    const colIndex = editableFields.indexOf(field);
    if (colIndex === -1) return;

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;

    let targetRow = rowIndex;
    let targetColIndex = colIndex;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex <= 0) return;
      targetRow = rowIndex - 1;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex >= totalRows - 1) return;
      targetRow = rowIndex + 1;
    } else if (e.key === 'ArrowLeft') {
      const target = e.target as HTMLInputElement;
      if (e.currentTarget.tagName === 'SELECT' || target.selectionStart === 0) {
        e.preventDefault();
        if (colIndex <= 0) return;
        targetColIndex = colIndex - 1;
      } else {
        return;
      }
    } else if (e.key === 'ArrowRight') {
      const target = e.target as HTMLInputElement;
      if (e.currentTarget.tagName === 'SELECT' || target.selectionEnd === target.value.length) {
        e.preventDefault();
        if (colIndex >= editableFields.length - 1) return;
        targetColIndex = colIndex + 1;
      } else {
        return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentVal = e.currentTarget.tagName === 'INPUT'
        ? (e.currentTarget as HTMLInputElement).value
        : undefined;
      commitField(field, currentVal);

      if (colIndex === editableFields.length - 1) {
        if (onAddRow) {
          onAddRow();
          setTimeout(() => {
            const nextEl = document.getElementById(`${idPrefix}-${totalRows}-0`);
            if (nextEl) nextEl.focus();
          }, 100);
        }
        return;
      }
      targetColIndex = colIndex + 1;
      const nextId = `${idPrefix}-${targetRow}-${targetColIndex}`;
      setTimeout(() => {
        const el = document.getElementById(nextId) as HTMLInputElement | null;
        if (el) { el.focus(); if (el.tagName === 'INPUT') el.select(); }
      }, 10);
      return;
    }

    const currentDomVal = e.currentTarget.tagName === 'INPUT'
      ? (e.currentTarget as HTMLInputElement).value
      : undefined;
    commitField(field, currentDomVal);

    const nextId = `${idPrefix}-${targetRow}-${targetColIndex}`;
    setTimeout(() => {
      const el = document.getElementById(nextId) as HTMLInputElement | null;
      if (el) { el.focus(); if (el.tagName === 'INPUT') el.select(); }
    }, 10);
  }, [editableFields, rowIndex, totalRows, onAddRow, idPrefix, commitField]);

  return (
    <tr
      onClick={() => onSelect(rowIndex)}
      onFocus={() => onSelect(rowIndex)}
      className={`geotech-table-row border-b border-navy-900/60 hover:bg-cyan-500/15 transition-all text-slate-100 font-medium h-8 ${isSelected ? 'bg-cyan-500/5' : ''
        }`}
    >
      {columns.map((col) => {
        const colKeyStr = String(col.key);
        const colIdx = editableFields.indexOf(col.key as keyof T);
        const isStickyAny = !!col.isSticky || !!col.isStickyRight || col.key === 'accion';

        const cellStyle = getCellTdStyle(
          colKeyStr,
          !!col.isSticky, col.stickyLeft,
          !!col.isStickyRight, col.stickyRight,
          isSelected, rowAlerts, alertRowIndex, idPrefix
        );

        if (col.renderCell) {
          return (
            <td key={colKeyStr} className={`${isStickyAny ? 'bg-navy-950' : ''} ${col.cellClassName || ''}`} style={cellStyle}>
              {col.renderCell(row, rowIndex, isSelected)}
            </td>
          );
        }

        return (
          <td
            key={colKeyStr}
            className={`${isStickyAny ? 'bg-navy-950 text-center' : 'px-1'} ${col.cellClassName || ''}`}
            style={cellStyle}
            onClick={() => {
              // Si el usuario hace clic en una celda de una fila inactiva, la selecciona
              // y enfoca el input correspondiente una vez renderizado
              if (!isSelected && colIdx !== -1) {
                onSelect(rowIndex);
                setTimeout(() => {
                  const inputId = `${idPrefix}-${rowIndex}-${colIdx}`;
                  const inputEl = document.getElementById(inputId);
                  if (inputEl) {
                    inputEl.focus();
                    if (inputEl.tagName === 'INPUT') {
                      (inputEl as HTMLInputElement).select();
                    }
                  }
                }, 40);
              }
            }}
          >
            {col.type === 'readonly' ? (
              <span className="text-slate-400 font-medium select-all block text-center truncate">
                {String(row[col.key as keyof T] ?? '')}
              </span>
            ) : !isSelected ? (
              // EXCEL OPTIMIZATION: Si la fila no está activa, renderizamos texto plano ligero (span)
              // Esto limpia el 90% del DOM de inputs inactivos
              <span className="text-slate-200 block text-center truncate py-0.5 font-semibold select-all">
                {String(row[col.key as keyof T] ?? '') === '-1' ? '-' : String(row[col.key as keyof T] ?? '')}
              </span>
            ) : col.type === 'select' ? (
              <select
                id={`${idPrefix}-${rowIndex}-${colIdx}`}
                value={String(row[col.key as keyof T] ?? '-1')}
                onChange={(e) => onCellChange(rowIndex, col.key as keyof T, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, col.key as keyof T)}
                className={`w-full bg-transparent border-0 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 rounded py-0.5 ${isSelected ? 'text-cyan-200 font-bold' : 'text-slate-200'
                  }`}
              >
                {(col.options || []).map((opt) => (
                  <option key={opt} value={opt} className="bg-navy-950 text-slate-200">{opt}</option>
                ))}
              </select>
            ) : (
              <input
                id={`${idPrefix}-${rowIndex}-${colIdx}`}
                type={col.type}
                step={col.step}
                min={col.min}
                max={col.max}
                value={getDisplayVal(col.key as keyof T)}
                onChange={(e) => {
                  setEditing(prev => ({ ...prev, [colKeyStr]: e.target.value }));
                }}
                onBlur={() => {
                  commitField(col.key as keyof T);
                }}
                onInput={(e) => {
                  if (col.type === 'number' && (col.min !== undefined || col.max !== undefined)) {
                    const v = parseFloat(e.currentTarget.value);
                    if (!isNaN(v)) {
                      if (col.min !== undefined && v < col.min) {
                        e.currentTarget.value = String(col.min);
                        setEditing(prev => ({ ...prev, [colKeyStr]: String(col.min) }));
                      }
                      if (col.max !== undefined && v > col.max) {
                        e.currentTarget.value = String(col.max);
                        setEditing(prev => ({ ...prev, [colKeyStr]: String(col.max) }));
                      }
                    }
                  }
                }}
                onKeyDown={(e) => handleKeyDown(e, col.key as keyof T)}
                onWheel={col.type === 'number' ? (e) => e.currentTarget.blur() : undefined}
                className={`w-full bg-transparent border-0 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 rounded py-0.5 ${isSelected ? 'text-cyan-200 font-bold' : 'text-slate-100'
                  }`}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
}

function areRowPropsEqual<T>(prev: GridRowProps<T>, next: GridRowProps<T>): boolean {
  if (prev.row !== next.row) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.totalRows !== next.totalRows) return false;
  if (prev.columns !== next.columns) return false;
  if (prev.rowAlerts === next.rowAlerts) return true;
  if (prev.rowAlerts.length !== next.rowAlerts.length) return false;
  for (let i = 0; i < prev.rowAlerts.length; i++) {
    if (prev.rowAlerts[i].field !== next.rowAlerts[i].field ||
      prev.rowAlerts[i].type !== next.rowAlerts[i].type) return false;
  }
  return true;
}

const GridRow = memo(GridRowInner, areRowPropsEqual) as typeof GridRowInner;

export default function BaseEditableGrid<T>({
  data,
  columns,
  selectedRowIndex,
  onSelectRow,
  onCellChange,
  alerts,
  idPrefix,
  onAddRow,
  getRowKey,
  editableFields,
  minWidth = '2000px',
  getAlertRowIndex
}: BaseEditableGridProps<T>) {

  // --- MOTOR DE RENDIMIENTO: RENDERIZADO PROGRESIVO EN LOTES ---
  const [renderLimit, setRenderLimit] = useState(() => {
    // Si hay una fila seleccionada mayor a 40, inicializamos el límite para que la incluya de golpe
    const initialLimit = selectedRowIndex !== null ? Math.max(40, selectedRowIndex + 10) : 40;
    return Math.min(data.length, initialLimit);
  });

  // Resetear el límite progresivo al cargar un taladro o array de datos diferente
  useEffect(() => {
    const initialLimit = selectedRowIndex !== null ? Math.max(40, selectedRowIndex + 10) : 40;
    setRenderLimit(Math.min(data.length, initialLimit));
  }, [data]);

  // Incrementar progresivamente el límite de renderizado cediendo el control al navegador
  useEffect(() => {
    if (renderLimit < data.length) {
      const timer = setTimeout(() => {
        setRenderLimit(prev => Math.min(data.length, prev + 40));
      }, 20); // Ventana de 20ms que permite al navegador pintar y responder a clics
      return () => clearTimeout(timer);
    }
  }, [renderLimit, data.length]);

  // Array rebanado según el límite de carga progresivo actual
  const visibleData = useMemo(() => {
    return data.slice(0, renderLimit);
  }, [data, renderLimit]);

  const alertsByRow = useMemo(() => {
    const map = new Map<number, ValidationAlert[]>();
    for (const alert of alerts) {
      const match = alert.field.match(/-(\d+)$/);
      if (match) {
        const rowIdx = parseInt(match[1]);
        if (!map.has(rowIdx)) map.set(rowIdx, []);
        map.get(rowIdx)!.push(alert);
      }
    }
    return map;
  }, [alerts]);

  const headerStyles = useMemo(
    () => columns.map(col => getHeaderStyle(col)),
    [columns]
  );

  return (
    <div className="flex-1 overflow-auto border border-navy-800/80 rounded-xl bg-navy-950/65 shadow-2xl relative min-h-[350px]">
      <table className="w-full border-separate text-xs text-left table-fixed" style={{ borderSpacing: 0, minWidth }}>
        <thead className="sticky top-0 z-20 text-slate-400 dark:text-slate-300 font-bold uppercase tracking-wider text-center select-none text-xs">
          <tr>
            {columns.map((col, colIdx) => (
              <th
                key={String(col.key)}
                className={`py-3.5 ${col.width} ${col.headerBgClass || ''}`}
                style={headerStyles[colIdx]}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleData.map((row, rowIndex) => {
            const alertRowIndex = getAlertRowIndex ? getAlertRowIndex(row, rowIndex) : rowIndex;
            const isSelected = selectedRowIndex === rowIndex;
            const rowAlerts = alertsByRow.get(alertRowIndex) ?? EMPTY_ALERTS;

            return (
              <GridRow
                key={getRowKey(row, rowIndex)}
                row={row}
                rowIndex={rowIndex}
                totalRows={data.length}
                columns={columns}
                isSelected={isSelected}
                rowAlerts={rowAlerts}
                alertRowIndex={alertRowIndex}
                idPrefix={idPrefix}
                editableFields={editableFields}
                onSelect={onSelectRow}
                onCellChange={onCellChange}
                onAddRow={onAddRow}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}