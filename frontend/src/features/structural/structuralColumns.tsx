import React from 'react';
import { Trash2, Copy, ShieldAlert } from 'lucide-react';
import type { GridColumn } from '../../components/common/BaseEditableGrid';
import { FormulaTooltipTrigger } from '../../components/common/FormulaTooltip';
import {
  LITHOLOGY_CATALOG,
  ESTRUCTURA_OPTIONS,
  RELLENO_OPTIONS,
  INTEMPERISMO_OPTIONS,
  RESISTENCIA_OPTIONS,
  AGUA_OPTIONS,
  normalizeStrength
} from '../../utils/catalogData';

export interface Discontinuidad {
  id: number;
  de: number;
  a: number;
  profundidad: number;
  litologia: string;
  tipo_estructura: string;
  alfa: number;
  beta: number;
  forma: number;
  rugosidad: number;
  jrc10: number;
  abertura: number;
  weathering: string;
  espesor: number;
  relleno1: string;
  relleno2?: string;
  dureza_pared: string;
  agua: string;
  geotecnico: string;
  comentario?: string;
  corrida: number;
  lito1?: string;
  lito2?: string;
  lito3?: string;
}

export interface Corrida {
  corrida: number;
  de: number;
  a: number;
  lito1: string;
  lito2?: string;
  lito3?: string;
  resistencia: string;
}

export const FORMA_LABELS: Record<number, string> = {
  1: "1 - Plana Escalonada",
  2: "2 - Ondulada Escalonada",
  3: "3 - Rugosa Escalonada",
  4: "4 - Plana Ondulada",
  5: "5 - Ondulada Ondulada",
  6: "6 - Rugosa Ondulada",
  7: "7 - Plana Suave",
  8: "8 - Ondulada Suave",
  9: "9 - Rugosa Suave",
  [-1]: "Sin dato"
};

export const getLithologyStyle = (val: string, darkMode: boolean = true) => {
  const code = (val || '').toUpperCase();
  const item = LITHOLOGY_CATALOG[code];
  if (!item) {
    return darkMode
      ? { backgroundColor: 'rgba(168, 85, 247, 0.05)', color: '#cbd5e1' }
      : { backgroundColor: '#f1f5f9', color: '#334155' };
  }
  if (darkMode) {
    const hex = item.bg.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.18)`,
      color: item.bg
    };
  } else {
    return { backgroundColor: item.bg, color: item.text };
  }
};

export const getLithologyStyleNullable = (val: string | undefined, darkMode: boolean = true) => {
  if (!val || val === "-1") {
    return darkMode
      ? { backgroundColor: 'rgba(168, 85, 247, 0.05)', color: '#94a3b8' }
      : { backgroundColor: 'rgba(0, 0, 0, 0.02)', color: '#64748b' };
  }
  return getLithologyStyle(val, darkMode);
};

interface GetStructuralColumnsProps {
  darkMode: boolean;
  activeTaladroName: string;
  corridas: Corrida[];
  handleCellChange: (index: number, field: keyof Discontinuidad, value: any) => void;
  deleteRow: (index: number) => void;
  insertDiscontinuidadRow: (index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, rowIndex: number, colName: keyof Discontinuidad) => void;
}

export function getStructuralColumns({
  darkMode,
  activeTaladroName,
  corridas,
  handleCellChange,
  deleteRow,
  insertDiscontinuidadRow,
  handleKeyDown
}: GetStructuralColumnsProps): GridColumn<{ disc: Discontinuidad; originalIndex: number }>[] {
  return [
    {
      key: 'id' as any,
      label: '#',
      width: 'w-16',
      type: 'readonly',
      isSticky: true,
      stickyLeft: 0,
      renderCell: (row) => <div className="text-center font-bold text-slate-400 py-1.5">{row.disc.id}</div>
    },
    {
      key: 'taladro' as any,
      label: 'Taladro',
      width: 'w-24',
      type: 'readonly',
      isSticky: true,
      stickyLeft: 64,
      renderCell: () => <div className="text-center text-slate-400 py-1.5 truncate">{activeTaladroName}</div>
    },
    {
      key: 'de' as any,
      label: 'de: (m)',
      width: 'w-16',
      type: 'readonly',
      isSticky: true,
      stickyLeft: 160,
      renderCell: (row) => (
        <FormulaTooltipTrigger formulaId="struct_de_a_heredada" params={{ corrida: row.disc.corrida, de: row.disc.de, a: row.disc.a }} position="bottom">
          <div className="text-center text-slate-400 py-1.5 font-mono">
            {typeof row.disc.de === 'number' ? row.disc.de.toFixed(2) : (parseFloat(String(row.disc.de || 0)) || 0).toFixed(2)}
          </div>
        </FormulaTooltipTrigger>
      )
    },
    {
      key: 'a' as any,
      label: 'a: (m)',
      width: 'w-16',
      type: 'readonly',
      isSticky: true,
      stickyLeft: 224,
      renderCell: (row) => (
        <FormulaTooltipTrigger formulaId="struct_de_a_heredada" params={{ corrida: row.disc.corrida, de: row.disc.de, a: row.disc.a }} position="bottom">
          <div className="text-center text-slate-400 py-1.5 font-mono">
            {typeof row.disc.a === 'number' ? row.disc.a.toFixed(2) : (parseFloat(String(row.disc.a || 0)) || 0).toFixed(2)}
          </div>
        </FormulaTooltipTrigger>
      )
    },
    {
      key: 'profundidad' as any,
      label: 'Prof.',
      width: 'w-16',
      type: 'number',
      isSticky: true,
      stickyLeft: 288,
      renderCell: (row, _index, isSelected) => {
        const isOrphan = row.disc.corrida === 0;
        const profNum = typeof row.disc.profundidad === 'number' ? row.disc.profundidad : (parseFloat(String(row.disc.profundidad || 0)) || 0);
        if (!isSelected) {
          return (
            <div className="flex items-center justify-center gap-1.5 w-full py-1.5 text-center">
              <span className="text-slate-200 block text-center truncate font-bold select-all">
                {profNum.toFixed(2)}
              </span>
              {isOrphan && (
                <span title="Profundidad huérfana: No corresponde a ningún tramo de corrida en LGG">
                  <ShieldAlert size={14} className="text-red-400 shrink-0" />
                </span>
              )}
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5 w-full h-full px-1">
            <input
              id={`struct-cell-${row.originalIndex}-profundidad`}
              type="number"
              step="0.01"
              value={row.disc.profundidad}
              onChange={(e) => handleCellChange(row.originalIndex, 'profundidad', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'profundidad')}
              className="w-full bg-transparent border-0 text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 rounded py-1 text-cyan-200"
            />
            {isOrphan && (
              <span title="Profundidad huérfana: No corresponde a ningún tramo de corrida en LGG">
                <ShieldAlert size={14} className="text-red-400 shrink-0 animate-pulse" />
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'lito1' as any,
      label: 'Lito 1',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'text-purple-300',
      renderCell: (row) => {
        const matchingCorrida = corridas.find(c => row.disc.profundidad >= c.de && row.disc.profundidad < c.a) || corridas.find(c => row.disc.profundidad === c.a);
        const lito1 = matchingCorrida ? matchingCorrida.lito1 : (row.disc as any).lito1 || row.disc.litologia || '-';
        return (
          <FormulaTooltipTrigger formulaId="struct_lito_heredada" params={{ corrida: matchingCorrida?.corrida ?? row.disc.corrida, lito3: matchingCorrida?.lito3, lito1: matchingCorrida?.lito1, val: lito1 }} position="bottom">
            <div className="w-full h-full flex items-center justify-center font-bold px-2 select-all text-center rounded py-1" style={getLithologyStyle(lito1, darkMode)}>
              {lito1}
            </div>
          </FormulaTooltipTrigger>
        );
      }
    },
    {
      key: 'lito2' as any,
      label: 'Lito 2',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'text-purple-300',
      renderCell: (row) => {
        const matchingCorrida = corridas.find(c => row.disc.profundidad >= c.de && row.disc.profundidad < c.a) || corridas.find(c => row.disc.profundidad === c.a);
        const lito2 = matchingCorrida ? (matchingCorrida.lito2 || '-1') : (row.disc as any).lito2 || '-1';
        return (
          <div className="w-full h-full flex items-center justify-center font-bold px-2 select-all text-center rounded py-1" style={getLithologyStyleNullable(lito2, darkMode)}>
            {lito2 === "-1" ? "-" : lito2}
          </div>
        );
      }
    },
    {
      key: 'lito3' as any,
      label: 'Lito 3',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'text-purple-300',
      renderCell: (row) => {
        const matchingCorrida = corridas.find(c => row.disc.profundidad >= c.de && row.disc.profundidad < c.a) || corridas.find(c => row.disc.profundidad === c.a);
        const lito3 = matchingCorrida ? (matchingCorrida.lito3 || '-1') : (row.disc as any).lito3 || '-1';
        return (
          <div className="w-full h-full flex items-center justify-center font-bold px-2 select-all text-center rounded py-1" style={getLithologyStyleNullable(lito3, darkMode)}>
            {lito3 === "-1" ? "-" : lito3}
          </div>
        );
      }
    },
    {
      key: 'tipo_estructura' as any,
      label: 'Tipo Estructura',
      width: 'w-20',
      type: 'select',
      headerBgClass: 'text-purple-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-300 block text-center truncate py-1.5 font-bold">
              {row.disc.tipo_estructura === "-1" ? "-" : row.disc.tipo_estructura}
            </span>
          );
        }
        return (
          <select
            id={`struct-cell-${row.originalIndex}-tipo_estructura`}
            value={row.disc.tipo_estructura}
            onChange={(e) => handleCellChange(row.originalIndex, 'tipo_estructura', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'tipo_estructura')}
            className="w-full bg-transparent border-0 px-2 py-1 text-cyan-200 focus:outline-none cursor-pointer font-bold select-none text-center text-xs"
          >
            {ESTRUCTURA_OPTIONS.map(opt => (
              <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
                {opt === "-1" ? "Sin dato" : opt}
              </option>
            ))}
          </select>
        );
      }
    },
    {
      key: 'alfa' as any,
      label: 'Alfa (°)',
      width: 'w-16',
      type: 'number',
      headerBgClass: 'text-purple-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-200 block text-center truncate py-1.5 font-semibold">
              {row.disc.alfa === -1 ? "-" : `${row.disc.alfa}°`}
            </span>
          );
        }
        return (
          <input
            id={`struct-cell-${row.originalIndex}-alfa`}
            type="number"
            min="-1"
            max="90"
            step="0.1"
            value={row.disc.alfa}
            onChange={(e) => handleCellChange(row.originalIndex, 'alfa', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'alfa')}
            className="w-full bg-transparent border-0 text-center focus:outline-none text-cyan-200 py-1 font-bold"
          />
        );
      }
    },
    {
      key: 'beta' as any,
      label: 'Beta (°)',
      width: 'w-16',
      type: 'number',
      headerBgClass: 'text-purple-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-200 block text-center truncate py-1.5 font-semibold">
              {row.disc.beta === -1 ? "-" : `${row.disc.beta}°`}
            </span>
          );
        }
        return (
          <input
            id={`struct-cell-${row.originalIndex}-beta`}
            type="number"
            min="-1"
            max="360"
            step="0.1"
            value={row.disc.beta}
            onChange={(e) => handleCellChange(row.originalIndex, 'beta', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'beta')}
            className="w-full bg-transparent border-0 text-center focus:outline-none text-cyan-200 py-1 font-bold"
          />
        );
      }
    },
    {
      key: 'forma' as any,
      label: 'Forma',
      width: 'w-32',
      type: 'select',
      headerBgClass: 'text-indigo-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-300 block text-center truncate py-1.5 font-semibold">
              {row.disc.forma === -1 ? "-" : FORMA_LABELS[row.disc.forma]}
            </span>
          );
        }
        return (
          <select
            id={`struct-cell-${row.originalIndex}-forma`}
            value={row.disc.forma}
            onChange={(e) => handleCellChange(row.originalIndex, 'forma', parseInt(e.target.value) || 1)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'forma')}
            className="w-full bg-transparent border-0 px-1 py-1 text-cyan-200 focus:outline-none cursor-pointer text-center font-bold text-xs"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, -1].map(val => (
              <option key={val} value={val} className="bg-navy-950 text-slate-200">
                {FORMA_LABELS[val]}
              </option>
            ))}
          </select>
        );
      }
    },
    {
      key: 'rugosidad' as any,
      label: 'Rugosidad (ISRM)',
      width: 'w-32',
      type: 'number',
      headerBgClass: 'text-indigo-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-200 block text-center truncate py-1.5 font-semibold">
              {row.disc.rugosidad === -1 ? "-" : row.disc.rugosidad}
            </span>
          );
        }
        return (
          <input
            id={`struct-cell-${row.originalIndex}-rugosidad`}
            type="number"
            min="-1"
            max="9"
            value={row.disc.rugosidad}
            onChange={(e) => handleCellChange(row.originalIndex, 'rugosidad', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'rugosidad')}
            className="w-full bg-transparent border-0 text-center focus:outline-none text-cyan-200 py-1 font-bold"
          />
        );
      }
    },
    {
      key: 'jrc10' as any,
      label: 'JNRC10',
      width: 'w-24',
      type: 'number',
      headerBgClass: 'text-indigo-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-200 block text-center truncate py-1.5 font-bold">
              {row.disc.jrc10 === -1 ? "-" : row.disc.jrc10}
            </span>
          );
        }
        return (
          <input
            id={`struct-cell-${row.originalIndex}-jrc10`}
            type="number"
            min="-1"
            max="20"
            value={row.disc.jrc10}
            onChange={(e) => handleCellChange(row.originalIndex, 'jrc10', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'jrc10')}
            className="w-full bg-transparent border-0 text-center focus:outline-none text-cyan-200 font-bold py-1"
          />
        );
      }
    },
    {
      key: 'abertura' as any,
      label: 'Abertura (mm)',
      width: 'w-28',
      type: 'number',
      headerBgClass: 'text-amber-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-200 block text-center truncate py-1.5 font-semibold">
              {row.disc.abertura === -1 ? "-" : `${row.disc.abertura} mm`}
            </span>
          );
        }
        return (
          <input
            id={`struct-cell-${row.originalIndex}-abertura`}
            type="number"
            min="-1"
            step="0.01"
            value={row.disc.abertura}
            onChange={(e) => handleCellChange(row.originalIndex, 'abertura', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'abertura')}
            className="w-full bg-transparent border-0 text-center focus:outline-none text-cyan-200 font-bold py-1"
          />
        );
      }
    },
    {
      key: 'weathering' as any,
      label: 'Grado Intemp.',
      width: 'w-36',
      type: 'select',
      headerBgClass: 'text-amber-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-300 block text-center truncate py-1.5 font-bold">
              {row.disc.weathering === "-1" ? "-" : row.disc.weathering}
            </span>
          );
        }
        return (
          <select
            id={`struct-cell-${row.originalIndex}-weathering`}
            value={row.disc.weathering}
            onChange={(e) => handleCellChange(row.originalIndex, 'weathering', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'weathering')}
            className="w-full bg-transparent border-0 px-2 py-1 text-cyan-200 focus:outline-none cursor-pointer text-center font-bold text-xs"
          >
            {INTEMPERISMO_OPTIONS.map(opt => (
              <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
                {opt === "-1" ? "Sin dato" : opt}
              </option>
            ))}
          </select>
        );
      }
    },
    {
      key: 'espesor' as any,
      label: 'Espesor (mm)',
      width: 'w-32',
      type: 'number',
      headerBgClass: 'text-amber-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-200 block text-center truncate py-1.5 font-semibold">
              {row.disc.espesor === -1 ? "-" : `${row.disc.espesor} mm`}
            </span>
          );
        }
        return (
          <input
            id={`struct-cell-${row.originalIndex}-espesor`}
            type="number"
            min="-1"
            step="0.01"
            value={row.disc.espesor}
            onChange={(e) => handleCellChange(row.originalIndex, 'espesor', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'espesor')}
            className="w-full bg-transparent border-0 text-center focus:outline-none text-cyan-200 py-1 font-bold"
          />
        );
      }
    },
    {
      key: 'relleno1' as any,
      label: 'Relleno 1',
      width: 'w-32',
      type: 'select',
      headerBgClass: 'text-amber-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-350 block text-center truncate py-1.5 font-semibold">
              {row.disc.relleno1 === "-1" ? "-" : row.disc.relleno1}
            </span>
          );
        }
        return (
          <select
            id={`struct-cell-${row.originalIndex}-relleno1`}
            value={row.disc.relleno1}
            onChange={(e) => handleCellChange(row.originalIndex, 'relleno1', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'relleno1')}
            className="w-full bg-transparent border-0 px-2 py-1 text-cyan-200 focus:outline-none cursor-pointer text-center font-bold text-xs"
          >
            {RELLENO_OPTIONS.map(opt => (
              <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
                {opt === "-1" ? "Sin dato" : opt}
              </option>
            ))}
          </select>
        );
      }
    },
    {
      key: 'relleno2' as any,
      label: 'Relleno 2',
      width: 'w-32',
      type: 'select',
      headerBgClass: 'text-amber-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-355 block text-center truncate py-1.5 font-semibold">
              {(!row.disc.relleno2 || row.disc.relleno2 === "-1") ? "-" : row.disc.relleno2}
            </span>
          );
        }
        return (
          <select
            id={`struct-cell-${row.originalIndex}-relleno2`}
            value={row.disc.relleno2 || '-1'}
            onChange={(e) => handleCellChange(row.originalIndex, 'relleno2', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'relleno2')}
            className="w-full bg-transparent border-0 px-2 py-1 text-cyan-200 focus:outline-none cursor-pointer text-center font-bold text-xs"
          >
            {RELLENO_OPTIONS.map(opt => (
              <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
                {opt === "-1" ? "Sin dato" : opt}
              </option>
            ))}
          </select>
        );
      }
    },
    {
      key: 'dureza_pared' as any,
      label: 'Dureza pared',
      width: 'w-48',
      type: 'select',
      headerBgClass: 'text-emerald-300',
      renderCell: (row, _idx, isSelected) => {
        const normDureza = normalizeStrength(row.disc.dureza_pared);
        if (!isSelected) {
          return (
            <span className="text-slate-300 block text-center truncate py-1.5 font-bold">
              {normDureza === "-1" ? "-" : normDureza}
            </span>
          );
        }
        return (
          <select
            id={`struct-cell-${row.originalIndex}-dureza_pared`}
            value={normDureza}
            onChange={(e) => handleCellChange(row.originalIndex, 'dureza_pared', normalizeStrength(e.target.value))}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'dureza_pared')}
            className="w-full bg-transparent border-0 px-2 py-1 text-cyan-200 focus:outline-none cursor-pointer text-center font-bold text-xs"
          >
            {RESISTENCIA_OPTIONS.map(opt => (
              <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
                {opt === "-1" ? "Sin dato" : opt}
              </option>
            ))}
          </select>
        );
      }
    },
    {
      key: 'agua' as any,
      label: 'Presen. Agua',
      width: 'w-44',
      type: 'select',
      headerBgClass: 'text-emerald-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-300 block text-center truncate py-1.5 font-bold">
              {row.disc.agua === "-1" ? "-" : row.disc.agua}
            </span>
          );
        }
        return (
          <select
            id={`struct-cell-${row.originalIndex}-agua`}
            value={row.disc.agua}
            onChange={(e) => handleCellChange(row.originalIndex, 'agua', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'agua')}
            className="w-full bg-transparent border-0 px-2 py-1 text-cyan-200 focus:outline-none cursor-pointer text-center font-bold text-xs"
          >
            {AGUA_OPTIONS.map(opt => (
              <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
                {opt === "-1" ? "Sin dato" : opt}
              </option>
            ))}
          </select>
        );
      }
    },
    {
      key: 'geotecnico' as any,
      label: 'Geotécnico',
      width: 'w-36',
      type: 'text',
      headerBgClass: 'text-emerald-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-200 block text-center truncate py-1.5 font-semibold">
              {row.disc.geotecnico}
            </span>
          );
        }
        return (
          <input
            id={`struct-cell-${row.originalIndex}-geotecnico`}
            type="text"
            value={row.disc.geotecnico}
            onChange={(e) => handleCellChange(row.originalIndex, 'geotecnico', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'geotecnico')}
            className="w-full bg-transparent border-0 text-center focus:outline-none text-cyan-200 py-1 font-bold"
          />
        );
      }
    },
    {
      key: 'comentario' as any,
      label: 'Comentario',
      width: 'w-56',
      type: 'text',
      headerBgClass: 'text-emerald-300',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-200 block text-left truncate py-1.5 px-2 font-medium">
              {row.disc.comentario || ''}
            </span>
          );
        }
        return (
          <input
            id={`struct-cell-${row.originalIndex}-comentario`}
            type="text"
            value={row.disc.comentario || ''}
            onChange={(e) => handleCellChange(row.originalIndex, 'comentario', e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'comentario')}
            className="w-full bg-transparent border-0 text-left focus:outline-none text-cyan-200 py-1 px-2 font-semibold"
          />
        );
      }
    },
    {
      key: 'corrida' as any,
      label: 'Corrida',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'text-emerald-300',
      renderCell: (row) => (
        <div className="text-center font-bold text-slate-400 py-1.5">
          {row.originalIndex + 1}
        </div>
      )
    },
    {
      key: 'accion' as any,
      label: 'Acción',
      width: 'w-24',
      type: 'readonly',
      isStickyRight: true,
      stickyRight: 0,
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return null; // Ocultar botones de acciones en filas inactivas para máxima ligereza
        }
        return (
          <div className="flex justify-center items-center gap-1.5 h-full bg-navy-950/95 px-1">
            <button
              onClick={() => insertDiscontinuidadRow(row.originalIndex)}
              className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-all duration-150 active:scale-90 flex items-center justify-center shadow-sm cursor-pointer"
              title="Clonar registro estructural"
            >
              <Copy size={13} />
            </button>
            <button
              onClick={() => deleteRow(row.originalIndex)}
              className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-150 active:scale-90 flex items-center justify-center shadow-sm cursor-pointer"
              title="Eliminar registro estructural"
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      }
    }
  ];
}