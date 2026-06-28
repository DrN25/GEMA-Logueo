import React from 'react';
import type { ValidationAlert } from '../../utils/qaqcValidator';

export interface GridColumn<T> {
  key: keyof T | 'id' | 'accion';
  label: string;
  width: string;
  type: 'text' | 'number' | 'select' | 'readonly';
  options?: string[];
  step?: string;
  isSticky?: boolean;
  stickyLeft?: number;
  isStickyRight?: boolean;
  stickyRight?: number;
  headerBgClass?: string;
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
  /** Maps a display row to its original array index (for alert matching when filters are active) */
  getAlertRowIndex?: (row: T, displayIndex: number) => number;
}

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

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    field: keyof T
  ) => {
    const colIndex = editableFields.indexOf(field);
    if (colIndex === -1) return;

    let targetRow = rowIndex;
    let targetColIndex = colIndex;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      targetRow = Math.min(data.length - 1, rowIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      const target = e.target as HTMLInputElement;
      if (e.currentTarget.tagName === 'SELECT' || target.selectionStart === 0) {
        e.preventDefault();
        targetColIndex = Math.max(0, colIndex - 1);
      } else {
        return;
      }
    } else if (e.key === 'ArrowRight') {
      const target = e.target as HTMLInputElement;
      if (e.currentTarget.tagName === 'SELECT' || target.selectionEnd === target.value.length) {
        e.preventDefault();
        targetColIndex = Math.min(editableFields.length - 1, colIndex + 1);
      } else {
        return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (colIndex === editableFields.length - 1) {
        // Última columna editable: Añadir nueva fila
        if (onAddRow) {
          onAddRow();
          setTimeout(() => {
            const nextElement = document.getElementById(`${idPrefix}-${data.length}-0`);
            if (nextElement) {
              nextElement.focus();
            }
          }, 100);
        }
        return;
      } else {
        targetColIndex = colIndex + 1;
      }
    } else {
      return;
    }

    const nextElementId = `${idPrefix}-${targetRow}-${targetColIndex}`;

    setTimeout(() => {
      const element = document.getElementById(nextElementId) as HTMLInputElement | HTMLSelectElement;
      if (element) {
        element.focus();
        if (element.tagName === 'INPUT') {
          (element as HTMLInputElement).select();
        }
      }
    }, 10);
  };

  const getCellTdStyle = (
    index: number,
    colKey: string,
    isSticky: boolean,
    stickyLeft?: number,
    isStickyRight?: boolean,
    stickyRight?: number,
    isSelected?: boolean,
    alertRowIndex?: number
  ) => {
    // Resolve the alert array index (may differ from display index when filters are active)
    const effectiveAlertIdx = alertRowIndex ?? index;

    // Match alert field using the format emitted by qaqcValidator.ts:
    //   LGG grid (idPrefix='lgg-cell'):       field = "colKey-rowIndex"
    //   Structural grid (idPrefix='struct-cell'): field = "struct-colKey-rowIndex"
    //   Survey / PLT / others:                 field = "prefix-colKey-rowIndex"
    let alert: ValidationAlert | undefined;
    if (idPrefix === 'lgg-cell') {
      alert = alerts.find(a => a.field === `${colKey}-${effectiveAlertIdx}`);
    } else if (idPrefix === 'struct-cell') {
      alert = alerts.find(a => a.field === `struct-${colKey}-${effectiveAlertIdx}`);
    } else {
      // Generic fallback — try both full-prefix and bare formats
      alert = alerts.find(a =>
        a.field === `${idPrefix}-${colKey}-${effectiveAlertIdx}` ||
        a.field === `${colKey}-${effectiveAlertIdx}`
      );
    }

    const actualStickyRight = isStickyRight || colKey === 'accion';
    const isStickyAny = isSticky || actualStickyRight;

    let borderShadow = isSticky
      ? 'inset -1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), 1px 0 0 0 rgb(var(--navy-900))'
      : undefined;

    if (actualStickyRight) {
      borderShadow = 'inset 1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), -1px 0 0 0 rgb(var(--navy-900))';
    }

    let background: string | undefined = undefined;
    let stickyStyle: React.CSSProperties = {};

    if (isSticky) {
      stickyStyle = {
        position: 'sticky',
        left: stickyLeft ?? 0,
        zIndex: 10
      };
    } else if (actualStickyRight) {
      stickyStyle = {
        position: 'sticky',
        right: stickyRight ?? 0,
        zIndex: 10
      };
    }

    // Capa de selección base con fondo sólido para evitar transparencias
    let baseBg = isStickyAny ? 'rgb(var(--navy-950))' : undefined;
    if (isSelected) {
      baseBg = isStickyAny
        ? 'linear-gradient(rgba(6, 182, 212, 0.08), rgba(6, 182, 212, 0.08)), rgb(var(--navy-950))'
        : 'rgba(6, 182, 212, 0.08)';
    }

    // Capa de alerta (QA/QC)
    if (alert) {
      const isCritical = alert.type === 'CRITICAL';
      const alertBg = isCritical ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)';
      const alertBorder = isCritical ? 'inset 0 0 0 2px rgba(239, 68, 68, 0.6)' : 'inset 0 0 0 2px rgba(245, 158, 11, 0.5)';

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

    const style: React.CSSProperties = {};
    if (borderShadow) style.boxShadow = borderShadow;
    if (background) style.background = background;

    return {
      ...style,
      ...stickyStyle
    };
  };

  const getHeaderStyle = (col: GridColumn<T>) => {
    let backgroundStyle: React.CSSProperties = {
      background: 'rgb(var(--navy-900))'
    };

    let borderShadows = 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
    let stickyStyle: React.CSSProperties = {};

    if (col.isSticky) {
      borderShadows = 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 1px 0 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
      stickyStyle = {
        position: 'sticky',
        left: col.stickyLeft ?? 0,
        zIndex: 30
      };
    } else if (col.isStickyRight || col.key === 'accion') {
      borderShadows = 'inset 1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), -1px 0 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
      stickyStyle = {
        position: 'sticky',
        right: col.stickyRight ?? 0,
        zIndex: 30
      };
    }

    return {
      ...backgroundStyle,
      boxShadow: borderShadows,
      ...stickyStyle
    };
  };

  return (
    <div className="flex-1 overflow-auto border border-navy-800/80 rounded-xl bg-navy-950/65 shadow-2xl relative min-h-[350px]">
      <table className="w-full border-separate text-xs text-left table-fixed" style={{ borderSpacing: 0, minWidth }}>
        <thead className="sticky top-0 z-20 text-slate-400 dark:text-slate-300 font-bold uppercase tracking-wider text-center select-none text-xs">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`py-3.5 ${col.width} ${col.headerBgClass || ''}`}
                style={getHeaderStyle(col)}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const isSelected = selectedRowIndex === rowIndex;

            return (
              <tr
                key={getRowKey(row, rowIndex)}
                onClick={() => onSelectRow(rowIndex)}
                onFocus={() => onSelectRow(rowIndex)}
                className={`geotech-table-row border-b border-navy-900/60 hover:bg-cyan-500/15 transition-all text-slate-100 font-medium h-10 ${
                  isSelected ? 'bg-cyan-500/5' : ''
                }`}
              >
                {(() => {
                  // Resolve alert row index once per row (filter-aware)
                  const alertRowIndex = getAlertRowIndex ? getAlertRowIndex(row, rowIndex) : rowIndex;

                  return columns.map((col) => {
                  const isSticky = !!col.isSticky;
                  const isStickyRight = !!col.isStickyRight;
                  const colKeyStr = String(col.key);
                  const isEditable = col.type !== 'readonly' && col.key !== 'id' && col.key !== 'accion';
                  const editableColIdx = isEditable ? editableFields.indexOf(col.key as keyof T) : -1;
                  const isStickyAny = isSticky || isStickyRight || col.key === 'accion';

                  // Renderizador personalizado
                  if (col.renderCell) {
                    return (
                      <td
                        key={colKeyStr}
                        className={isStickyAny ? 'bg-navy-950' : ''}
                        style={getCellTdStyle(rowIndex, colKeyStr, isSticky, col.stickyLeft, isStickyRight, col.stickyRight, isSelected, alertRowIndex)}
                      >
                        {col.renderCell(row, rowIndex, isSelected)}
                      </td>
                    );
                  }

                  // Renderizador por tipo de celda
                  return (
                    <td
                      key={colKeyStr}
                      className={isStickyAny ? 'bg-navy-950 text-center' : 'px-1'}
                      style={getCellTdStyle(rowIndex, colKeyStr, isSticky, col.stickyLeft, isStickyRight, col.stickyRight, isSelected, alertRowIndex)}
                    >
                      {col.type === 'readonly' ? (
                        <span className="text-slate-400 font-medium select-all block text-center truncate">
                          {String(row[col.key as keyof T] ?? '')}
                        </span>
                      ) : col.type === 'select' ? (
                        <select
                          id={`${idPrefix}-${rowIndex}-${editableColIdx}`}
                          value={String(row[col.key as keyof T] ?? '-1')}
                          onChange={(e) => onCellChange(rowIndex, col.key as keyof T, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key as keyof T)}
                          className={`w-full bg-transparent border-0 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 rounded py-1 ${
                            isSelected ? 'text-cyan-200' : 'text-slate-200'
                          }`}
                        >
                          {(col.options || []).map((opt) => (
                            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={`${idPrefix}-${rowIndex}-${editableColIdx}`}
                          type={col.type}
                          step={col.step}
                          value={row[col.key as keyof T] !== undefined ? String(row[col.key as keyof T]) : ''}
                          onChange={(e) =>
                            onCellChange(
                              rowIndex,
                              col.key as keyof T,
                              col.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                            )
                          }
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key as keyof T)}
                          className={`w-full bg-transparent border-0 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 rounded py-1 ${
                            isSelected ? 'text-cyan-200 font-bold' : 'text-slate-100'
                          }`}
                        />
                      )}
                    </td>
                  );
                  });
                })()}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
