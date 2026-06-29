import React, { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import type { ValidationAlert } from '../../utils/qaqcValidator';

export interface GridColumn<T> {
  key: keyof T | 'id' | 'accion';
  label: string;
  width: string;
  type: 'text' | 'number' | 'select' | 'readonly';
  options?: string[];
  step?: string;
  /** Rango mínimo: se aplica en tiempo real via onInput sin tocar React state */
  min?: number;
  /** Rango máximo: se aplica en tiempo real via onInput sin tocar React state */
  max?: number;
  isSticky?: boolean;
  stickyLeft?: number;
  isStickyRight?: boolean;
  stickyRight?: number;
  headerBgClass?: string;
  cellClassName?: string;
  renderCell?: (row: T, index: number, isSelected: boolean) => React.ReactNode;
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

// Array vacío estable — evita crear nuevas referencias para filas sin alertas.
const EMPTY_ALERTS: ValidationAlert[] = [];

// ─── Helpers de estilo (fuera del componente — constantes, nunca se recrean) ──

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

// ─── Sub-componente de Fila con Estado Local (patrón Excel) ───────────────────
//
// PATRÓN "LOCAL-FIRST, COMMIT-ON-BLUR" (igual que Excel):
// --------------------------------------------------------
// Mientras el usuario tipea, los inputs manejan su propio valor local
// (useState en la fila). El estado global de React (activeTaladro) NO se
// actualiza en cada keystroke — solo cuando:
//   1. El input pierde el foco (onBlur)
//   2. El usuario presiona Enter o flechas de navegación
//
// Resultado: solo esta fila re-renderiza durante el tipeo.
// Las otras 199 filas permanecen congeladas — React.memo nunca las toca.
//
// Los límites de rango (min/max) se aplican en tiempo real via onInput,
// manipulando directamente el DOM sin tocar el estado de React.

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

  // ── Estado local de edición ──────────────────────────────────────────────
  // Mapa de { fieldKey → stringValue } de los campos que el usuario está editando.
  // Mientras el usuario tipea, SOLO este mapa cambia (no el estado global).
  // Cuando onBlur/Enter ocurre, el valor se "commit" al estado global.
  const [editing, setEditing] = useState<Record<string, string>>({});

  // Ref para acceso estable al editing actual dentro de callbacks
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // ── Sincronización con el padre ──────────────────────────────────────────
  // Cuando la fila en el estado global cambia (después de un commit o import
  // masivo), limpiamos los overrides locales para que los inputs reflejen
  // los valores oficiales del estado global.
  useEffect(() => {
    setEditing({});
  }, [row]);

  // ── Helpers de display ───────────────────────────────────────────────────
  // Devuelve el valor a mostrar en el input: override local primero,
  // luego el valor oficial de la fila (desde el estado global).
  const getDisplayVal = (field: keyof T): string => {
    const k = String(field);
    if (k in editing) return editing[k];
    const val = row[field];
    return val !== undefined && val !== null ? String(val) : '';
  };

  // ── Commit de campo ──────────────────────────────────────────────────────
  // Envía el valor actual al estado global. Solo se llama en onBlur o
  // al navegar con teclado — nunca durante el tipeo activo.
  const commitField = useCallback((field: keyof T, domValueOverride?: string) => {
    const k = String(field);
    // Prioridad: valor del DOM (si viene de teclado) > local override > nada
    const strVal = domValueOverride !== undefined
      ? domValueOverride
      : k in editingRef.current
        ? editingRef.current[k]
        : null;

    // Si el usuario nunca editó este campo, no hay nada que commitear
    if (strVal === null) return;

    const colDef = columns.find(c => c.key === field);
    const parsed = colDef?.type === 'number'
      ? (parseFloat(strVal) || 0)
      : strVal;

    onCellChange(rowIndex, field, parsed);
  }, [rowIndex, onCellChange, columns]);

  // ── Navegación por teclado + commit antes de moverse ────────────────────
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
        return; // cursor moviéndose dentro del texto
      }
    } else if (e.key === 'ArrowRight') {
      const target = e.target as HTMLInputElement;
      if (e.currentTarget.tagName === 'SELECT' || target.selectionEnd === target.value.length) {
        e.preventDefault();
        if (colIndex >= editableFields.length - 1) return;
        targetColIndex = colIndex + 1;
      } else {
        return; // cursor moviéndose dentro del texto
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Commit del campo actual antes de avanzar
      const currentVal = e.currentTarget.tagName === 'INPUT'
        ? (e.currentTarget as HTMLInputElement).value
        : undefined;
      commitField(field, currentVal);

      if (colIndex === editableFields.length - 1) {
        // Última columna: agregar nueva fila
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
      // Commit ya fue hecho arriba; navegar sin hacer otro commit
      const nextId = `${idPrefix}-${targetRow}-${targetColIndex}`;
      setTimeout(() => {
        const el = document.getElementById(nextId) as HTMLInputElement | null;
        if (el) { el.focus(); if (el.tagName === 'INPUT') el.select(); }
      }, 10);
      return;
    }

    // Para Arrow keys: commit el valor actual del DOM antes de navegar
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
      className={`geotech-table-row border-b border-navy-900/60 hover:bg-cyan-500/15 transition-all text-slate-100 font-medium h-10 ${
        isSelected ? 'bg-cyan-500/5' : ''
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

        // Renderizador personalizado (ej: botones de acción)
        if (col.renderCell) {
          return (
            <td key={colKeyStr} className={`${isStickyAny ? 'bg-navy-950' : ''} ${col.cellClassName || ''}`} style={cellStyle}>
              {col.renderCell(row, rowIndex, isSelected)}
            </td>
          );
        }

        return (
          <td key={colKeyStr} className={`${isStickyAny ? 'bg-navy-950 text-center' : 'px-1'} ${col.cellClassName || ''}`} style={cellStyle}>

            {col.type === 'readonly' ? (
              // Solo lectura: siempre muestra el valor oficial
              <span className="text-slate-400 font-medium select-all block text-center truncate">
                {String(row[col.key as keyof T] ?? '')}
              </span>

            ) : col.type === 'select' ? (
              // Selects: commit instantáneo (seleccionar un option es siempre una acción completa)
              // Usan el valor del estado global directamente (no override local necesario)
              <select
                id={`${idPrefix}-${rowIndex}-${colIdx}`}
                value={String(row[col.key as keyof T] ?? '-1')}
                onChange={(e) => onCellChange(rowIndex, col.key as keyof T, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, col.key as keyof T)}
                className={`w-full bg-transparent border-0 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 rounded py-1 ${
                  isSelected ? 'text-cyan-200' : 'text-slate-200'
                }`}
              >
                {(col.options || []).map((opt) => (
                  <option key={opt} value={opt} className="bg-navy-950 text-slate-200">{opt}</option>
                ))}
              </select>

            ) : (
              // Text / Number: estado LOCAL durante el tipeo, commit en blur o teclado.
              // onCellChange (estado global) NO se llama mientras el usuario tipea.
              <input
                id={`${idPrefix}-${rowIndex}-${colIdx}`}
                type={col.type}
                step={col.step}
                min={col.min}
                max={col.max}
                // Controlado con el estado LOCAL de la fila (no el global)
                value={getDisplayVal(col.key as keyof T)}
                onChange={(e) => {
                  // Solo actualiza el estado LOCAL de esta fila — sin tocar activeTaladro
                  setEditing(prev => ({ ...prev, [colKeyStr]: e.target.value }));
                }}
                onBlur={() => {
                  // Pierde el foco → commit al estado global
                  commitField(col.key as keyof T);
                }}
                onInput={(e) => {
                  // Límites de rango: manipulación directa del DOM (sin React state)
                  // El usuario NUNCA puede escribir un valor fuera de [min, max]
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
                // Prevenir que el scroll del ratón altere valores numéricos
                onWheel={col.type === 'number' ? (e) => e.currentTarget.blur() : undefined}
                className={`w-full bg-transparent border-0 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 rounded py-1 ${
                  isSelected ? 'text-cyan-200 font-bold' : 'text-slate-100'
                }`}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ── Función de comparación para React.memo ────────────────────────────────────
// Devuelve true = no re-renderizar desde el padre (props iguales).
// La clave: row se compara por REFERENCIA. Mientras el usuario tipea,
// el estado global no cambia → row es el mismo objeto → todas las demás
// filas son saltadas por React.memo (solo la fila activa re-renderiza via
// su propio useState interno, que bypasa memo).
function areRowPropsEqual<T>(prev: GridRowProps<T>, next: GridRowProps<T>): boolean {
  if (prev.row !== next.row) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.totalRows !== next.totalRows) return false;
  if (prev.columns !== next.columns) return false;
  // Comparar alertas: referencia primero (mayormente estable con debounce),
  // luego contenido si la referencia cambió (actualización post-tipeo)
  if (prev.rowAlerts === next.rowAlerts) return true;
  if (prev.rowAlerts.length !== next.rowAlerts.length) return false;
  for (let i = 0; i < prev.rowAlerts.length; i++) {
    if (prev.rowAlerts[i].field !== next.rowAlerts[i].field ||
        prev.rowAlerts[i].type  !== next.rowAlerts[i].type) return false;
  }
  return true;
}

const GridRow = memo(GridRowInner, areRowPropsEqual) as typeof GridRowInner;

// ─── Componente Principal ─────────────────────────────────────────────────────

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

  // Pre-computar mapa de alertas por fila (O(alertas) una vez).
  // Cada fila recibe solo sus propias alertas → getCellTdStyle busca en
  // un array de 0-5 items en lugar del array global.
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

  // Estilos de cabecera memoizados
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
          {data.map((row, rowIndex) => {
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
