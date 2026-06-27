import React, { useState } from 'react';
import { Plus, Trash2, ShieldAlert, Share2, Search, RotateCcw, Database, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ValidationAlert } from '../../utils/qaqcValidator';
import LggImportModal from '../lgg/LggImportModal';
import {
  LITHOLOGY_CATALOG,
  ESTRUCTURA_OPTIONS,
  RELLENO_OPTIONS,
  INTEMPERISMO_OPTIONS,
  RESISTENCIA_OPTIONS,
  AGUA_OPTIONS
} from '../../utils/catalogData';
import BaseEditableGrid, { type GridColumn } from '../../components/common/BaseEditableGrid';

interface Discontinuidad {
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
  tipo: string;
  lito1?: string;
  lito2?: string;
  lito3?: string;
}

interface Corrida {
  corrida: number;
  de: number;
  a: number;
  lito1: string;
  lito2?: string;
  lito3?: string;
  resistencia: string;
}

interface StructuralViewProps {
  discontinuidades: Discontinuidad[];
  corridas: Corrida[];
  onDiscontinuidadesChange: (discontinuidades: Discontinuidad[]) => void;
  geologo: string;
  activeTaladroName: string;
  alerts: ValidationAlert[];
  onImportExcel?: (rawRows: any[]) => void;
}

const TIPO_ESTRUCTURA_OPTIONS = ESTRUCTURA_OPTIONS;
const DUREZA_OPTIONS = RESISTENCIA_OPTIONS;


const FORMA_LABELS: Record<number, string> = {
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

const EDITABLE_COLS: (keyof Discontinuidad)[] = [
  'profundidad', 'tipo_estructura', 'alfa', 'beta', 'forma', 'rugosidad',
  'jrc10', 'abertura', 'weathering', 'espesor', 'relleno1', 'relleno2',
  'dureza_pared', 'agua', 'geotecnico', 'comentario', 'tipo'
];

const getLithologyStyle = (val: string) => {
  const code = (val || '').toUpperCase();
  const item = LITHOLOGY_CATALOG[code];
  if (!item) {
    return { backgroundColor: 'rgba(168, 85, 247, 0.05)', color: '#cbd5e1' };
  }
  const hex = item.bg.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.18)`,
    color: item.bg
  };
};

const getLithologyStyleNullable = (val: string | undefined) => {
  if (!val || val === "-1") {
    return { backgroundColor: 'rgba(168, 85, 247, 0.05)', color: '#94a3b8' };
  }
  return getLithologyStyle(val);
};

export default function StructuralView({
  discontinuidades,
  corridas,
  onDiscontinuidadesChange,
  geologo,
  activeTaladroName,
  alerts,
  onImportExcel
}: StructuralViewProps) {

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  const structuralColumns: GridColumn<{ disc: Discontinuidad, originalIndex: number }>[] = [
    { key: 'id' as any, label: '#', width: 'w-16', type: 'readonly', isSticky: true, stickyLeft: 0, renderCell: (row) => row.disc.id },
    { key: 'taladro' as any, label: 'Taladro', width: 'w-28', type: 'readonly', isSticky: true, stickyLeft: 64, renderCell: () => activeTaladroName },
    { key: 'de' as any, label: 'de:', width: 'w-20', type: 'readonly', isSticky: true, stickyLeft: 176, renderCell: (row) => row.disc.de > 0 ? row.disc.de.toFixed(2) : '0.00' },
    { key: 'a' as any, label: 'a:', width: 'w-20', type: 'readonly', isSticky: true, stickyLeft: 256, renderCell: (row) => row.disc.a > 0 ? row.disc.a.toFixed(2) : '0.00' },
    {
      key: 'profundidad' as any,
      label: 'Profundidad',
      width: 'w-28',
      type: 'number',
      isSticky: true,
      stickyLeft: 336,
      renderCell: (row, index, isSelected) => {
        const isOrphan = row.disc.corrida === 0;
        return (
          <div className="flex items-center gap-1.5 w-full h-full px-1">
            <input
              id={`struct-cell-${row.originalIndex}-0`}
              type="number"
              step="0.01"
              value={row.disc.profundidad}
              onChange={(e) => handleCellChange(row.originalIndex, 'profundidad', e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'profundidad')}
              className={`w-full bg-transparent border-0 text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 rounded py-1 ${
                isSelected ? 'text-cyan-200' : 'text-slate-100'
              }`}
            />
            {isOrphan && (
              <span title="Profundidad huérfana: No corresponde a ningún tramo de corrida en LGG">
                <ShieldAlert size={14} className="text-red-400 shrink-0" />
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
          <div className="w-full h-full flex items-center justify-center font-bold px-2 select-all text-center rounded" style={getLithologyStyle(lito1)}>
            {lito1}
          </div>
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
          <div className="w-full h-full flex items-center justify-center font-bold px-2 select-all text-center rounded" style={getLithologyStyleNullable(lito2)}>
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
          <div className="w-full h-full flex items-center justify-center font-bold px-2 select-all text-center rounded" style={getLithologyStyleNullable(lito3)}>
            {lito3 === "-1" ? "-" : lito3}
          </div>
        );
      }
    },
    {
      key: 'tipo_estructura' as any,
      label: 'Tipo Estructura',
      width: 'w-36',
      type: 'select',
      headerBgClass: 'text-purple-300',
      renderCell: (row) => (
        <select
          id={`struct-cell-${row.originalIndex}-1`}
          value={row.disc.tipo_estructura}
          onChange={(e) => handleCellChange(row.originalIndex, 'tipo_estructura', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'tipo_estructura')}
          className="w-full bg-transparent border-0 px-2 py-1 text-slate-200 focus:outline-none cursor-pointer font-bold select-none text-center"
        >
          {ESTRUCTURA_OPTIONS.map(opt => (
            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
              {opt === "-1" ? "Sin dato" : opt}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'alfa' as any,
      label: 'Alfa (°)',
      width: 'w-24',
      type: 'number',
      headerBgClass: 'text-purple-300',
      renderCell: (row) => (
        <input
          id={`struct-cell-${row.originalIndex}-2`}
          type="number"
          min="-1"
          max="90"
          step="0.1"
          value={row.disc.alfa}
          onChange={(e) => handleCellChange(row.originalIndex, 'alfa', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'alfa')}
          className="w-full bg-transparent border-0 text-center focus:outline-none text-slate-200 py-1"
        />
      )
    },
    {
      key: 'beta' as any,
      label: 'Beta (°)',
      width: 'w-24',
      type: 'number',
      headerBgClass: 'text-purple-300',
      renderCell: (row) => (
        <input
          id={`struct-cell-${row.originalIndex}-3`}
          type="number"
          min="-1"
          max="360"
          step="0.1"
          value={row.disc.beta}
          onChange={(e) => handleCellChange(row.originalIndex, 'beta', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'beta')}
          className="w-full bg-transparent border-0 text-center focus:outline-none text-slate-200 py-1"
        />
      )
    },
    {
      key: 'forma' as any,
      label: 'Forma',
      width: 'w-44',
      type: 'select',
      headerBgClass: 'text-indigo-300',
      renderCell: (row) => (
        <select
          id={`struct-cell-${row.originalIndex}-4`}
          value={row.disc.forma}
          onChange={(e) => handleCellChange(row.originalIndex, 'forma', parseInt(e.target.value) || 1)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'forma')}
          className="w-full bg-transparent border-0 px-1 py-1 text-slate-200 focus:outline-none cursor-pointer text-center"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, -1].map(val => (
            <option key={val} value={val} className="bg-navy-950 text-slate-200">
              {FORMA_LABELS[val]}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'rugosidad' as any,
      label: 'Rugosidad (ISRM)',
      width: 'w-32',
      type: 'number',
      headerBgClass: 'text-indigo-300',
      renderCell: (row) => (
        <input
          id={`struct-cell-${row.originalIndex}-5`}
          type="number"
          min="-1"
          max="9"
          value={row.disc.rugosidad}
          onChange={(e) => handleCellChange(row.originalIndex, 'rugosidad', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'rugosidad')}
          className="w-full bg-transparent border-0 text-center focus:outline-none text-slate-200 py-1"
        />
      )
    },
    {
      key: 'jrc10' as any,
      label: 'JNRC10',
      width: 'w-24',
      type: 'number',
      headerBgClass: 'text-indigo-300',
      renderCell: (row) => (
        <input
          id={`struct-cell-${row.originalIndex}-6`}
          type="number"
          min="-1"
          max="20"
          value={row.disc.jrc10}
          onChange={(e) => handleCellChange(row.originalIndex, 'jrc10', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'jrc10')}
          className="w-full bg-transparent border-0 text-center focus:outline-none text-slate-200 font-bold py-1"
        />
      )
    },
    {
      key: 'abertura' as any,
      label: 'Abertura (mm)',
      width: 'w-28',
      type: 'number',
      headerBgClass: 'text-amber-300',
      renderCell: (row) => (
        <input
          id={`struct-cell-${row.originalIndex}-7`}
          type="number"
          min="-1"
          step="0.01"
          value={row.disc.abertura}
          onChange={(e) => handleCellChange(row.originalIndex, 'abertura', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'abertura')}
          className="w-full bg-transparent border-0 text-center focus:outline-none text-slate-200 font-semibold py-1"
        />
      )
    },
    {
      key: 'weathering' as any,
      label: 'Grado Intemp.',
      width: 'w-36',
      type: 'select',
      headerBgClass: 'text-amber-300',
      renderCell: (row) => (
        <select
          id={`struct-cell-${row.originalIndex}-8`}
          value={row.disc.weathering}
          onChange={(e) => handleCellChange(row.originalIndex, 'weathering', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'weathering')}
          className="w-full bg-transparent border-0 px-2 py-1 text-slate-200 focus:outline-none cursor-pointer text-center font-bold"
        >
          {INTEMPERISMO_OPTIONS.map(opt => (
            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
              {opt === "-1" ? "Sin dato" : opt}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'espesor' as any,
      label: 'Espesor (mm)',
      width: 'w-32',
      type: 'number',
      headerBgClass: 'text-amber-300',
      renderCell: (row) => (
        <input
          id={`struct-cell-${row.originalIndex}-9`}
          type="number"
          min="-1"
          step="0.01"
          value={row.disc.espesor}
          onChange={(e) => handleCellChange(row.originalIndex, 'espesor', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'espesor')}
          className="w-full bg-transparent border-0 text-center focus:outline-none text-slate-200 py-1"
        />
      )
    },
    {
      key: 'relleno1' as any,
      label: 'Relleno 1',
      width: 'w-32',
      type: 'select',
      headerBgClass: 'text-amber-300',
      renderCell: (row) => (
        <select
          id={`struct-cell-${row.originalIndex}-10`}
          value={row.disc.relleno1}
          onChange={(e) => handleCellChange(row.originalIndex, 'relleno1', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'relleno1')}
          className="w-full bg-transparent border-0 px-2 py-1 text-slate-200 focus:outline-none cursor-pointer text-center font-semibold"
        >
          {RELLENO_OPTIONS.map(opt => (
            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
              {opt === "-1" ? "Sin dato" : opt}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'relleno2' as any,
      label: 'Relleno 2',
      width: 'w-32',
      type: 'select',
      headerBgClass: 'text-amber-300',
      renderCell: (row) => (
        <select
          id={`struct-cell-${row.originalIndex}-11`}
          value={row.disc.relleno2 || '-1'}
          onChange={(e) => handleCellChange(row.originalIndex, 'relleno2', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'relleno2')}
          className="w-full bg-transparent border-0 px-2 py-1 text-slate-200 focus:outline-none cursor-pointer text-center font-semibold"
        >
          {RELLENO_OPTIONS.map(opt => (
            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
              {opt === "-1" ? "Sin dato" : opt}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'dureza_pared' as any,
      label: 'Dureza pared',
      width: 'w-48',
      type: 'select',
      headerBgClass: 'text-emerald-300',
      renderCell: (row) => (
        <select
          id={`struct-cell-${row.originalIndex}-12`}
          value={row.disc.dureza_pared}
          onChange={(e) => handleCellChange(row.originalIndex, 'dureza_pared', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'dureza_pared')}
          className="w-full bg-transparent border-0 px-2 py-1 text-slate-200 focus:outline-none cursor-pointer text-center font-bold"
        >
          {RESISTENCIA_OPTIONS.map(opt => (
            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
              {opt === "-1" ? "Sin dato" : opt}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'agua' as any,
      label: 'Presen. Agua',
      width: 'w-44',
      type: 'select',
      headerBgClass: 'text-emerald-300',
      renderCell: (row) => (
        <select
          id={`struct-cell-${row.originalIndex}-13`}
          value={row.disc.agua}
          onChange={(e) => handleCellChange(row.originalIndex, 'agua', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'agua')}
          className="w-full bg-transparent border-0 px-2 py-1 text-slate-200 focus:outline-none cursor-pointer text-center font-bold"
        >
          {AGUA_OPTIONS.map(opt => (
            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
              {opt === "-1" ? "Sin dato" : opt}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'geotecnico' as any,
      label: 'Geotécnico',
      width: 'w-36',
      type: 'text',
      headerBgClass: 'text-emerald-300',
      renderCell: (row) => (
        <input
          id={`struct-cell-${row.originalIndex}-14`}
          type="text"
          value={row.disc.geotecnico}
          onChange={(e) => handleCellChange(row.originalIndex, 'geotecnico', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'geotecnico')}
          className="w-full bg-transparent border-0 text-center focus:outline-none text-slate-200 py-1"
        />
      )
    },
    {
      key: 'comentario' as any,
      label: 'Comentario',
      width: 'w-56',
      type: 'text',
      headerBgClass: 'text-emerald-300',
      renderCell: (row) => (
        <input
          id={`struct-cell-${row.originalIndex}-15`}
          type="text"
          value={row.disc.comentario || ''}
          onChange={(e) => handleCellChange(row.originalIndex, 'comentario', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'comentario')}
          className="w-full bg-transparent border-0 text-left focus:outline-none text-slate-200 py-1 px-2"
        />
      )
    },
    { key: 'corrida' as any, label: 'Corrida', width: 'w-24', type: 'readonly', headerBgClass: 'text-emerald-300', renderCell: (row) => row.disc.corrida },
    {
      key: 'tipo' as any,
      label: 'Tipo',
      width: 'w-32',
      type: 'select',
      headerBgClass: 'text-emerald-300',
      renderCell: (row) => (
        <select
          id={`struct-cell-${row.originalIndex}-16`}
          value={row.disc.tipo}
          onChange={(e) => handleCellChange(row.originalIndex, 'tipo', e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, row.originalIndex, 'tipo')}
          className="w-full bg-transparent border-0 px-2 py-1 text-slate-200 focus:outline-none cursor-pointer text-center font-bold"
        >
          {['Natural', 'Mecánica'].map(opt => (
            <option key={opt} value={opt} className="bg-navy-950 text-slate-200">
              {opt}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'accion' as any,
      label: 'Acción',
      width: 'w-24',
      type: 'readonly',
      renderCell: (row) => (
        <div className="flex items-center justify-center h-full w-full">
          <button
            onClick={() => deleteRow(row.originalIndex)}
            className="text-red-400 hover:text-red-300 transition-colors p-1"
            title="Eliminar registro estructural"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ];

  const handleExportExcel = () => {
    try {
      const exportRows = discontinuidades.map((disc) => {
        const matchingCorrida = corridas.find(c => disc.profundidad >= c.de && disc.profundidad < c.a) || corridas.find(c => disc.profundidad === c.a);
        const lito1 = matchingCorrida ? matchingCorrida.lito1 : (disc as any).lito1 || disc.litologia || '';
        const lito2 = matchingCorrida ? (matchingCorrida.lito2 || '-1') : (disc as any).lito2 || '-1';
        const lito3 = matchingCorrida ? (matchingCorrida.lito3 || '-1') : (disc as any).lito3 || '-1';

        return {
          'Nro': disc.id,
          'Taladro': activeTaladroName,
          'de:': disc.de,
          'a:': disc.a,
          'Profundidad (m)': disc.profundidad,
          'Lito 1': lito1,
          'Lito 2': lito2 === "-1" ? "" : lito2,
          'Lito 3': lito3 === "-1" ? "" : lito3,
          'Tipo de Estructura': disc.tipo_estructura,
          'Alfa (°)': disc.alfa,
          'Beta (°)': disc.beta,
          'Forma': disc.forma,
          'Rugosidad (ISRM)': disc.rugosidad,
          'JNRC10': disc.jrc10,
          'Abertura (mm)': disc.abertura,
          'Grado Intemperismo': disc.weathering,
          'Espesor Relleno (mm)': disc.espesor,
          'Tipo de Relleno 1': disc.relleno1,
          'Tipo de Relleno 2': disc.relleno2 || '',
          'Dureza de la pared de Estructura': disc.dureza_pared,
          'Presen. Agua (ISRM)': disc.agua,
          'Geotécnico': disc.geotecnico,
          'Comentario': disc.comentario || '',
          'Corrida': disc.corrida,
          'Tipo': disc.tipo
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'LG EST.');
      XLSX.writeFile(wb, `${activeTaladroName}_Logueo_Estructural.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Error al exportar los datos a Excel.');
    }
  };

  // --- Filters States ---
  const [filterTipoEst, setFilterTipoEst] = useState<string>('');
  const [filterWeathering, setFilterWeathering] = useState<string>('');
  const [appliedFilters, setAppliedFilters] = useState({
    tipoEst: '',
    weathering: ''
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      tipoEst: filterTipoEst,
      weathering: filterWeathering
    });
  };

  const handleClearFilters = () => {
    setFilterTipoEst('');
    setFilterWeathering('');
    setAppliedFilters({
      tipoEst: '',
      weathering: ''
    });
  };

  const mappedDiscontinuidades = discontinuidades.map((disc, originalIndex) => ({
    disc,
    originalIndex
  }));

  const filteredDiscontinuidades = mappedDiscontinuidades.filter(({ disc }) => {
    if (appliedFilters.tipoEst && disc.tipo_estructura !== appliedFilters.tipoEst) {
      return false;
    }
    if (appliedFilters.weathering && disc.weathering !== appliedFilters.weathering) {
      return false;
    }
    return true;
  });

  const handleCellChange = (index: number, field: keyof Discontinuidad, value: any) => {
    const updated = [...discontinuidades];

    if (field === 'profundidad') {
      const depth = parseFloat(value);
      if (isNaN(depth)) {
        updated[index] = {
          ...updated[index],
          profundidad: value
        };
      } else {
        const matchingCorrida = corridas.find(c => depth >= c.de && depth < c.a) || corridas.find(c => depth === c.a);

        if (matchingCorrida) {
          updated[index] = {
            ...updated[index],
            profundidad: depth,
            de: matchingCorrida.de,
            a: matchingCorrida.a,
            corrida: matchingCorrida.corrida,
            litologia: matchingCorrida.lito1,
            lito1: matchingCorrida.lito1,
            lito2: matchingCorrida.lito2 || '-1',
            lito3: matchingCorrida.lito3 || '-1',
            dureza_pared: matchingCorrida.resistencia
          };
        } else {
          updated[index] = {
            ...updated[index],
            profundidad: depth,
            de: 0.0,
            a: 0.0,
            corrida: 0,
            litologia: '',
            lito1: '',
            lito2: '-1',
            lito3: '-1',
            dureza_pared: '-1'
          };
        }
      }
    } else {
      let validatedValue = value;

      // 1. Campos específicos con límites definidos
      if (field === 'alfa') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          if (parsed === -1) {
            validatedValue = -1;
          } else if (parsed < 0) {
            validatedValue = 0;
          } else if (parsed > 90) {
            validatedValue = 90;
          } else {
            validatedValue = parsed;
          }
        } else {
          validatedValue = -1;
        }
      }
      else if (field === 'beta') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          if (parsed === -1) {
            validatedValue = -1;
          } else if (parsed < 0) {
            validatedValue = 0;
          } else if (parsed > 360) {
            validatedValue = 360;
          } else {
            validatedValue = parsed;
          }
        } else {
          validatedValue = -1;
        }
      }
      else if (field === 'jrc10') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          if (parsed === -1) validatedValue = -1;
          else if (parsed < 0) validatedValue = 0;
          else if (parsed > 20) validatedValue = 20;
          else validatedValue = parsed;
        } else {
          validatedValue = -1;
        }
      }
      else if (field === 'rugosidad') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          if (parsed === -1) validatedValue = -1;
          else if (parsed < 0) validatedValue = 0;
          else if (parsed > 9) validatedValue = 9;
          else validatedValue = parsed;
        } else {
          validatedValue = -1;
        }
      }
      // 2. Validación genérica de mínimos para los demás campos numéricos
      else {
        const camposNumericos: (keyof Discontinuidad)[] = ['abertura', 'espesor', 'forma'];
        if (camposNumericos.includes(field)) {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            validatedValue = parsed < -1 ? -1 : parsed;
          } else {
            validatedValue = -1;
          }
        }
      }

      updated[index] = { ...updated[index], [field]: validatedValue };
    }

    onDiscontinuidadesChange(updated);
  };

  const addDiscontinuidadRow = () => {
    const lastRow = discontinuidades[discontinuidades.length - 1];
    const newId = lastRow ? lastRow.id + 1 : 1;
    let initialDepth = 0.0;

    if (lastRow) {
      initialDepth = lastRow.profundidad;
    } else if (corridas.length > 0) {
      initialDepth = corridas[0].de;
    }

    const matchingCorrida = corridas.find(c => initialDepth >= c.de && initialDepth < c.a) || corridas.find(c => initialDepth === c.a);

    const newRow: any = { // cambiamos temporalmente a any o extiende tu interfaz Discontinuidad si lo requiere
      id: newId,
      de: matchingCorrida ? matchingCorrida.de : 0.0,
      a: matchingCorrida ? matchingCorrida.a : 0.0,
      profundidad: initialDepth,
      litologia: matchingCorrida ? matchingCorrida.lito1 : '',
      lito1: matchingCorrida ? matchingCorrida.lito1 : '',
      lito2: matchingCorrida ? (matchingCorrida.lito2 || '-1') : '-1',
      lito3: matchingCorrida ? (matchingCorrida.lito3 || '-1') : '-1',
      tipo_estructura: "JN",
      alfa: 45.0,
      beta: -1,
      forma: 4,
      rugosidad: 2,
      jrc10: 10,
      abertura: 0.1,
      weathering: "UWF",
      espesor: 0.0,
      relleno1: "cwf",
      relleno2: "-1",
      dureza_pared: matchingCorrida ? matchingCorrida.resistencia : "R4",
      agua: "CDC",
      geotecnico: geologo || "",
      comentario: "",
      corrida: matchingCorrida ? matchingCorrida.corrida : 0,
      tipo: "Natural"
    };

    onDiscontinuidadesChange([...discontinuidades, newRow]);
  };

  const insertDiscontinuidadRow = (index: number) => {
    const prevRow = discontinuidades[index];

    const newRow: Discontinuidad = {
      id: 0, // Se calculará de manera automática en el reindexado
      de: prevRow.de,
      a: prevRow.a,
      corrida: prevRow.corrida,
      litologia: prevRow.litologia,
      dureza_pared: prevRow.dureza_pared,
      geotecnico: prevRow.geotecnico,
      // 1. Campos que SÍ se copian (Contexto continuo de la corrida)
      tipo_estructura: prevRow.tipo_estructura,
      weathering: prevRow.weathering,
      relleno1: prevRow.relleno1,
      relleno2: prevRow.relleno2,
      agua: prevRow.agua,
      tipo: prevRow.tipo,
      forma: prevRow.forma,
      rugosidad: prevRow.rugosidad,
      profundidad: prevRow.profundidad, // Base de referencia para que el usuario la modifique
      alfa: 45.0,      // Valor neutro por defecto
      beta: -1,        // -1 (No Existe / Testigo no orientado) por defecto
      jrc10: 10,       // Default limpio
      abertura: 0.1,   // Default limpio
      espesor: 0.0,    // Default limpio
      comentario: ""   // Comentario limpio
    };

    const updated = [...discontinuidades];
    // Splice inserta el nuevo registro inmediatamente debajo de la fila seleccionada (index + 1)
    updated.splice(index + 1, 0, newRow);

    // Reindexamos todos los IDs secuenciales de la tabla
    const reindexed = updated.map((item, idx) => ({
      ...item,
      id: idx + 1
    }));

    onDiscontinuidadesChange(reindexed);
  };

  const deleteRow = (index: number) => {
    const updated = discontinuidades
      .filter((_, i) => i !== index)
      .map((row, i) => ({ ...row, id: i + 1 }));
    onDiscontinuidadesChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, rowIndex: number, colName: keyof Discontinuidad) => {
    const colIndex = EDITABLE_COLS.indexOf(colName);
    if (colIndex === -1) return;

    let targetRow = rowIndex;
    let targetColIndex = colIndex;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      targetRow = Math.min(discontinuidades.length - 1, rowIndex + 1);
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
        targetColIndex = Math.min(EDITABLE_COLS.length - 1, colIndex + 1);
      } else {
        return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (colIndex === EDITABLE_COLS.length - 1) {
        // Last cell: create new row
        addDiscontinuidadRow();
        setTimeout(() => {
          const nextElement = document.getElementById(`struct-cell-${discontinuidades.length}-0`);
          if (nextElement) {
            nextElement.focus();
          }
        }, 100);
        return;
      } else {
        targetColIndex = colIndex + 1;
      }
    } else {
      return;
    }

    const nextElementId = `struct-cell-${targetRow}-${targetColIndex}`;

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


  const getCellTdStyle = (index: number, fieldName: string, isSticky: boolean, isSelected: boolean) => {
    const alert = alerts.find(a => a.field === `struct-${fieldName}-${index}`);

    let borderShadow = isSticky
      ? 'inset -1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), 1px 0 0 0 rgb(var(--navy-900))'
      : undefined;

    let background: string | undefined = undefined;
    let stickyStyle: React.CSSProperties = {};

    if (isSticky) {
      if (fieldName === 'accion') {
        borderShadow = 'inset 1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), -1px 0 0 0 rgb(var(--navy-900))';
        stickyStyle = {
          position: 'sticky',
          right: 0,
          zIndex: 10
        };
      } else {
        let leftVal = 0;
        if (fieldName === 'taladro') leftVal = 64;
        else if (fieldName === 'de') leftVal = 176;
        else if (fieldName === 'a') leftVal = 256;
        else if (fieldName === 'profundidad') leftVal = 336;

        stickyStyle = {
          position: 'sticky',
          left: leftVal,
          zIndex: 10
        };
      }
    }

    // --- CAPA DE SELECCIÓN BASE ---
    let baseBg = isSticky ? 'rgb(var(--navy-950))' : undefined;
    if (isSelected) {
      baseBg = isSticky
        ? 'linear-gradient(rgba(6, 182, 212, 0.08), rgba(6, 182, 212, 0.08)), rgb(var(--navy-950))'
        : 'rgba(6, 182, 212, 0.08)';
    }

    if (alert) {
      const isCritical = alert.type === 'CRITICAL';
      const alertBg = isCritical
        ? 'rgba(239, 68, 68, 0.12)'
        : 'rgba(245, 158, 11, 0.12)';
      const alertBorder = isCritical
        ? 'inset 0 0 0 2px rgba(239, 68, 68, 0.6)'
        : 'inset 0 0 0 2px rgba(245, 158, 11, 0.5)';

      if (isSticky) {
        borderShadow = `${alertBorder}, ${borderShadow}`;
        background = `linear-gradient(${alertBg}, ${alertBg}), ${baseBg || 'rgb(var(--navy-950))'}`;
      } else {
        borderShadow = alertBorder;
        background = baseBg ? `linear-gradient(${alertBg}, ${alertBg}), ${baseBg}` : alertBg;
      }
    } else if (fieldName === 'profundidad' && discontinuidades[index]?.corrida === 0) {
      const alertBg = 'rgba(239, 68, 68, 0.12)';
      const alertBorder = 'inset 0 0 0 2px rgba(239, 68, 68, 0.6)';
      if (isSticky) {
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
    if (borderShadow) {
      style.boxShadow = borderShadow;
    }
    if (background) {
      style.background = background;
    }
    return {
      ...style,
      ...stickyStyle
    };
  };

  const getHeaderStyle = (colKey: string) => {
    let backgroundStyle: React.CSSProperties = {
      background: 'rgb(var(--navy-900))'
    };

    if (['tipo_estructura', 'alfa', 'beta'].includes(colKey)) {
      backgroundStyle = {
        background: 'linear-gradient(rgba(168, 85, 247, 0.08), rgba(168, 85, 247, 0.08)), rgb(var(--navy-900))'
      };
    } else if (['forma', 'rugosidad', 'jrc10'].includes(colKey)) {
      backgroundStyle = {
        background: 'linear-gradient(rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.08)), rgb(var(--navy-900))'
      };
    } else if (['abertura', 'weathering', 'espesor', 'relleno1', 'relleno2'].includes(colKey)) {
      backgroundStyle = {
        background: 'linear-gradient(rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.08)), rgb(var(--navy-900))'
      };
    } else if (['dureza_pared', 'agua', 'geotecnico', 'comentario', 'corrida', 'tipo'].includes(colKey)) {
      backgroundStyle = {
        background: 'linear-gradient(rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.08)), rgb(var(--navy-900))'
      };
    }

    let borderShadows = 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
    let stickyStyle: React.CSSProperties = {};

    if (['id', 'taladro', 'de', 'a', 'profundidad'].includes(colKey)) {
      borderShadows = 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 1px 0 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';

      let leftVal = 0;
      if (colKey === 'taladro') leftVal = 64;
      else if (colKey === 'de') leftVal = 176;
      else if (colKey === 'a') leftVal = 256;
      else if (colKey === 'profundidad') leftVal = 336;

      stickyStyle = {
        position: 'sticky',
        left: leftVal,
        zIndex: 30
      };
    }

    if (colKey === 'accion') {
      borderShadows = 'inset 1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), -1px 0 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
      stickyStyle = {
        position: 'sticky',
        right: 0,
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
    <div className="space-y-6 h-full flex flex-col select-none w-full animate-fade-in">
      <style>{`
        .geotech-table-row:hover td {
          background-image: linear-gradient(rgba(0, 121, 143, 0.04), rgba(5, 153, 179, 0.04)) !important;
        }
      `}</style>
      {/* Panel de Introducción */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
            <Share2 size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
              Logueo Estructural Orientado (LG EST)
            </h2>
            <p className="text-xs text-slate-400">
              Registro individual de discontinuidades en su secuencia exacta de columnas (A - Y) mapeadas desde el Excel.
            </p>
          </div>
        </div>
      </div>

      {/* Panel de Filtros */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-4 shadow-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tipo Estructura</label>
            <select
              value={filterTipoEst}
              onChange={(e) => setFilterTipoEst(e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">TODAS</option>
              {TIPO_ESTRUCTURA_OPTIONS.filter(o => o !== "-1").map(opt => (
                <option key={opt} value={opt}>{opt === "-1" ? "Sin dato" : opt}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Meteorización (Weathering)</label>
            <select
              value={filterWeathering}
              onChange={(e) => setFilterWeathering(e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">TODAS</option>
              {INTEMPERISMO_OPTIONS.filter(o => o !== "-1").map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Acciones de Filtro */}
        <div className="flex justify-between items-center pt-2 border-t border-navy-800/30">
          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyFilters}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500/10 dark:border dark:border-cyan-500/30 dark:hover:bg-cyan-500/20 text-white dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Search size={14} />
              <span>Buscar</span>
            </button>
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-400 hover:text-slate-200 border border-navy-800 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
            >
              <RotateCcw size={14} />
              <span>Limpiar</span>
            </button>
          </div>
          <div>
            <div className="flex items-center gap-1.5 bg-navy-900/40 dark:bg-navy-900/60 border border-navy-800/80 rounded-lg px-2.5 py-1 text-xs text-slate-400">
              <Database size={14} className="text-blue-500 dark:text-cyan-400 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">{filteredDiscontinuidades.length}</span>
              <span className="text-slate-500 dark:text-slate-400">{filteredDiscontinuidades.length === 1 ? 'estructura' : 'estructuras'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones de Grilla */}
      <div className="flex justify-between items-center bg-navy-900/50 p-3 rounded-xl border border-navy-800/35 backdrop-blur-md">
        <button
          onClick={addDiscontinuidadRow}
          className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
        >
          <Plus size={16} />
          <span>Agregar Estructura</span>
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 dark:text-slate-300 border border-navy-800 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
          >
            <Upload size={14} className="text-emerald-400" />
            <span>Importar Excel</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 dark:text-slate-300 border border-navy-800 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
          >
            <Download size={14} className="text-blue-400" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Grid Table Container */}
      <BaseEditableGrid<{ disc: Discontinuidad, originalIndex: number }>
        data={filteredDiscontinuidades}
        columns={structuralColumns}
        selectedRowIndex={selectedRowIndex !== null ? filteredDiscontinuidades.findIndex(fd => fd.originalIndex === selectedRowIndex) : null}
        onSelectRow={(idx) => {
          if (filteredDiscontinuidades[idx]) {
            setSelectedRowIndex(filteredDiscontinuidades[idx].originalIndex);
          } else {
            setSelectedRowIndex(null);
          }
        }}
        onCellChange={() => {}}
        alerts={alerts}
        idPrefix="struct-cell"
        getRowKey={(row, idx) => row.disc.id || idx}
        editableFields={EDITABLE_COLS as any}
        minWidth="3000px"
      />
      <LggImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeTaladroName={activeTaladroName}
        importType="STRUCT"
        onImport={(importedRows) => {
          if (onImportExcel) {
            onImportExcel(importedRows);
          }
        }}
      />
    </div>
  );
}
