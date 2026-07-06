import { Trash2, Check, X } from 'lucide-react';
import type { GridColumn } from '../../components/common/BaseEditableGrid';
import type { EnsayoPlt } from '../../App';
import {
  LITHOLOGY_CATALOG,
  LITO1_OPTIONS,
  LITO2_OPTIONS,
  LITO3_OPTIONS
} from '../../utils/catalogData';

// --- ESTILOS DE CELDA PERSONALIZADOS ---
export const getLithologyStyle = (val: string, darkMode: boolean) => {
  const code = (val || '').toUpperCase();
  const item = LITHOLOGY_CATALOG[code];
  if (!item || val === "-" || val === "-1") {
    return darkMode
      ? { backgroundColor: 'rgba(168, 85, 247, 0.05)', color: '#94a3b8' }
      : { backgroundColor: 'rgba(0, 0, 0, 0.02)', color: '#64748b' };
  }
  if (darkMode) {
    const hex = item.bg.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return { backgroundColor: `rgba(${r}, ${g}, ${b}, 0.18)`, color: item.bg };
  }
  return { backgroundColor: item.bg, color: item.text };
};

export const getCellSectionClass = (colKey: string): string => {
  if (['from_m', 'to_m', 'long_de_muestra_mm', 'd_mm', 'diametro_taladro_nominacion', 'verif_de_longitud'].includes(colKey)) {
    return "bg-blue-500/5 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300";
  } else if (['litologia_1', 'litologia_2', 'litologia_3', 'tipo_litologico'].includes(colKey)) {
    return "bg-purple-500/5 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300";
  } else if (['tipo_de_ensayo', 'p_instr_kn', 'tipo_rotura_code', 'direccion_rotura_code'].includes(colKey)) {
    return "bg-amber-500/5 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300";
  } else if (['is_mpa', 'fact_corr', 'is_50_mpa', 'factor_k', 'ucs', 'isrm_indice_r'].includes(colKey)) {
    return "bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold";
  }
  return "";
};

interface PltColumnBuilderProps {
  darkMode: boolean;
  collar: any;
  handleCellChange: (idx: number, field: keyof EnsayoPlt, val: any) => void;
  deleteRow: (idx: number) => void;
}

export function getPltColumns({
  darkMode,
  collar,
  handleCellChange,
  deleteRow
}: PltColumnBuilderProps): GridColumn<EnsayoPlt>[] {
  const isDark = darkMode;

  return [
    {
      key: 'id' as any,
      label: '#',
      width: 'w-12',
      type: 'readonly',
      isSticky: true,
      stickyLeft: 0,
      headerBgClass: 'bg-navy-900 text-center',
      renderCell: (_, idx) => (
        <div className="text-center font-bold text-blue-600 dark:text-cyan-400 py-1.5">
          {idx + 1}
        </div>
      )
    },
    {
      key: 'campana' as any,
      label: 'Campaña',
      width: 'w-20',
      type: 'readonly',
      isSticky: true,
      stickyLeft: 48,
      headerBgClass: 'bg-navy-900 text-center',
      renderCell: () => {
        const campaignVal = collar.name ? collar.name.match(/\d+/)?.[0] || '2026' : '2026';
        return (
          <div className="text-center text-slate-500 font-bold py-1.5 select-all">
            {campaignVal}
          </div>
        );
      }
    },
    {
      key: 'fecha',
      label: 'Fecha',
      width: 'w-[110px]',
      type: 'text',
      isSticky: true,
      stickyLeft: 128,
      headerBgClass: 'bg-navy-900',
      renderCell: (row, idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-300 block text-center truncate py-1.5 font-semibold select-all">
              {row.fecha || ''}
            </span>
          );
        }
        return (
          <div className="w-full h-full p-0 bg-transparent">
            <input
              id={`plt-cell-${idx}-fecha`}
              type="date"
              value={row.fecha || ''}
              onChange={(e) => handleCellChange(idx, 'fecha', e.target.value)}
              className="w-full h-full px-2 bg-transparent border-0 text-cyan-200 font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
            />
          </div>
        );
      }
    },
    {
      key: 'taladro' as any,
      label: 'Taladro',
      width: 'w-24',
      type: 'readonly',
      isSticky: true,
      stickyLeft: 238,
      headerBgClass: 'bg-navy-900 text-center',
      renderCell: () => (
        <div className="text-center text-slate-400 font-bold py-1.5 truncate px-1 select-all">
          {collar.name || 'TALADRO'}
        </div>
      )
    },
    {
      key: 'nro_muestra',
      label: 'Nro Muestra',
      width: 'w-24',
      type: 'text',
      isSticky: true,
      stickyLeft: 334,
      headerBgClass: 'bg-navy-900 text-center',
      renderCell: (row, idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-100 block text-center truncate font-bold py-1.5 select-all">
              {row.nro_muestra || ''}
            </span>
          );
        }
        return (
          <div className="w-full h-full p-0 bg-transparent">
            <input
              id={`plt-cell-${idx}-nro_muestra`}
              type="text"
              value={row.nro_muestra || ''}
              onChange={(e) => handleCellChange(idx, 'nro_muestra', e.target.value)}
              className="w-full h-full px-2 bg-transparent border-0 text-cyan-200 font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
            />
          </div>
        );
      }
    },
    {
      key: 'nro_caja',
      label: 'Nro Caja',
      width: 'w-20',
      type: 'number'
    },
    {
      key: 'corrida_desde',
      label: 'Corrida Desde (m)',
      width: 'w-32',
      type: 'number'
    },
    {
      key: 'corrida_hasta',
      label: 'Corrida Hasta (m)',
      width: 'w-32',
      type: 'number'
    },
    {
      key: 'from_m',
      label: 'From',
      width: 'w-20',
      type: 'number',
      headerBgClass: 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20',
      cellClassName: getCellSectionClass('from_m')
    },
    {
      key: 'to_m',
      label: 'To',
      width: 'w-20',
      type: 'number',
      headerBgClass: 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20',
      cellClassName: getCellSectionClass('to_m')
    },
    {
      key: 'verif_corrida',
      label: 'Verif. corrida',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20',
      cellClassName: getCellSectionClass('verif_corrida'),
      renderCell: (row) => (
        <div className="flex items-center justify-center py-1.5">
          {row.verif_corrida === 'OK' ? (
            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
              <Check size={14} className="stroke-[3]" />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="Inconsistencia física detectada">
              <X size={14} className="stroke-[3]" />
            </span>
          )}
        </div>
      )
    },
    {
      key: 'long_de_corrida_m',
      label: 'Long. Corrida (m)',
      width: 'w-32',
      type: 'readonly'
    },
    {
      key: 'este_m',
      label: 'Este (m)',
      width: 'w-28',
      type: 'number'
    },
    {
      key: 'norte_m',
      label: 'Norte (m)',
      width: 'w-28',
      type: 'number'
    },
    {
      key: 'elevacion_msnm',
      label: 'Elevación (msnm)',
      width: 'w-32',
      type: 'number'
    },
    {
      key: 'long_de_muestra_mm',
      label: 'Long. Muestra (mm)',
      width: 'w-36',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20',
      cellClassName: getCellSectionClass('long_de_muestra_mm')
    },
    {
      key: 'tipo_de_ensayo',
      label: 'Tipo de Ensayo',
      width: 'w-32',
      type: 'select',
      options: ['D', 'A', 'B', 'I'],
      headerBgClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      cellClassName: getCellSectionClass('tipo_de_ensayo')
    },
    {
      key: 'diametro_taladro_nominacion',
      label: 'Diám. Taladro',
      width: 'w-28',
      type: 'select',
      options: ['BQ', 'NQ', 'HQ', 'PQ'],
      headerBgClass: 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20',
      cellClassName: getCellSectionClass('diametro_taladro_nominacion')
    },
    {
      key: 'litologia_1',
      label: 'Litología 1',
      width: 'w-32',
      type: 'select',
      options: LITO1_OPTIONS,
      headerBgClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20',
      cellClassName: getCellSectionClass('litologia_1'),
      renderCell: (row, idx, isSelected) => {
        const style = getLithologyStyle(row.litologia_1 || '', isDark);
        if (!isSelected) {
          return (
            <div className="w-full h-full flex items-center justify-center p-1" style={style}>
              <span className="font-bold py-1.5 truncate text-center select-all">{row.litologia_1 || '-'}</span>
            </div>
          );
        }
        return (
          <div className="w-full h-full flex items-center p-1" style={style}>
            <select
              id={`plt-cell-${idx}-litologia_1`}
              value={row.litologia_1 === undefined || row.litologia_1 === null || row.litologia_1 === '-1' || row.litologia_1 === '' ? '-1' : String(row.litologia_1)}
              onChange={(e) => handleCellChange(idx, 'litologia_1', e.target.value)}
              className="w-full h-full bg-transparent px-2 text-current border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-center cursor-pointer text-xs"
              style={{ color: style.color }}
            >
              <option value="-1" className={isDark ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>S/D</option>
              {LITO1_OPTIONS.map(opt => (
                <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-200" : "bg-white text-slate-800"}>{opt}</option>
              ))}
            </select>
          </div>
        );
      }
    },
    {
      key: 'litologia_2',
      label: 'Litología 2',
      width: 'w-32',
      type: 'select',
      options: LITO2_OPTIONS,
      headerBgClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20',
      cellClassName: getCellSectionClass('litologia_2'),
      renderCell: (row, idx, isSelected) => {
        const style = getLithologyStyle(row.litologia_2 || '', isDark);
        if (!isSelected) {
          return (
            <div className="w-full h-full flex items-center justify-center p-1" style={style}>
              <span className="font-bold py-1.5 truncate text-center select-all">
                {row.litologia_2 === undefined || row.litologia_2 === null || row.litologia_2 === '-1' || row.litologia_2 === '' ? '-' : String(row.litologia_2)}
              </span>
            </div>
          );
        }
        return (
          <div className="w-full h-full flex items-center p-1" style={style}>
            <select
              id={`plt-cell-${idx}-litologia_2`}
              value={row.litologia_2 === undefined || row.litologia_2 === null || row.litologia_2 === '-1' || row.litologia_2 === '' ? '-1' : String(row.litologia_2)}
              onChange={(e) => handleCellChange(idx, 'litologia_2', e.target.value)}
              className="w-full h-full bg-transparent px-2 text-current border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-center cursor-pointer text-xs"
              style={{ color: style.color }}
            >
              <option value="-1" className={isDark ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>S/D</option>
              {LITO2_OPTIONS.map(opt => (
                <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-200" : "bg-white text-slate-800"}>{opt}</option>
              ))}
            </select>
          </div>
        );
      }
    },
    {
      key: 'litologia_3',
      label: 'Litología 3',
      width: 'w-32',
      type: 'select',
      options: LITO3_OPTIONS,
      headerBgClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20',
      cellClassName: getCellSectionClass('litologia_3'),
      renderCell: (row, idx, isSelected) => {
        const style = getLithologyStyle(row.litologia_3 || '', isDark);
        if (!isSelected) {
          return (
            <div className="w-full h-full flex items-center justify-center p-1" style={style}>
              <span className="font-bold py-1.5 truncate text-center select-all">
                {row.litologia_3 === undefined || row.litologia_3 === null || row.litologia_3 === '-1' || row.litologia_3 === '' ? '-' : String(row.litologia_3)}
              </span>
            </div>
          );
        }
        return (
          <div className="w-full h-full flex items-center p-1" style={style}>
            <select
              id={`plt-cell-${idx}-litologia_3`}
              value={row.litologia_3 === undefined || row.litologia_3 === null || row.litologia_3 === '-1' || row.litologia_3 === '' ? '-1' : String(row.litologia_3)}
              onChange={(e) => handleCellChange(idx, 'litologia_3', e.target.value)}
              className="w-full h-full bg-transparent px-2 text-current border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-center cursor-pointer text-xs"
              style={{ color: style.color }}
            >
              <option value="-1" className={isDark ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>S/D</option>
              {LITO3_OPTIONS.map(opt => (
                <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-200" : "bg-white text-slate-800"}>{opt}</option>
              ))}
            </select>
          </div>
        );
      }
    },
    {
      key: 'tipo_litologico',
      label: 'Tipo litológico',
      width: 'w-32',
      type: 'readonly',
      headerBgClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20',
      cellClassName: getCellSectionClass('tipo_litologico')
    },
    {
      key: 'd_mm',
      label: 'D (mm)',
      width: 'w-24',
      type: 'number',
      headerBgClass: 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20',
      cellClassName: getCellSectionClass('d_mm')
    },
    {
      key: 'verif_de_longitud',
      label: 'Verif. longitud',
      width: 'w-28',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20',
      cellClassName: getCellSectionClass('verif_de_longitud'),
      renderCell: (row) => (
        <div className="flex items-center justify-center py-1.5">
          {row.verif_de_longitud === 'OK' ? (
            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
              <Check size={14} className="stroke-[3]" />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="Inconsistencia física detectada">
              <X size={14} className="stroke-[3]" />
            </span>
          )}
        </div>
      )
    },
    {
      key: 'p_instr_kn',
      label: 'P instr (kN)',
      width: 'w-28',
      type: 'number',
      headerBgClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      cellClassName: getCellSectionClass('p_instr_kn')
    },
    {
      key: 'tipo_rotura_code',
      label: 'Tipo de Rotura',
      width: 'w-28',
      type: 'select',
      options: ['M', 'E', 'C'],
      headerBgClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      cellClassName: getCellSectionClass('tipo_rotura_code')
    },
    {
      key: 'direccion_rotura_code',
      label: 'Dirección rotura',
      width: 'w-32',
      type: 'select',
      options: ['Pa', 'Pe', 'NA'],
      headerBgClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      cellClassName: getCellSectionClass('direccion_rotura_code')
    },
    {
      key: 'ejecutadoPor',
      label: 'Ejecutado por',
      width: 'w-28',
      type: 'text'
    },
    {
      key: 'is_mpa',
      label: 'Is (Mpa)',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
      cellClassName: getCellSectionClass('is_mpa')
    },
    {
      key: 'fact_corr',
      label: 'Fact. Corr',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
      cellClassName: getCellSectionClass('fact_corr'),
      renderCell: (row) => (
        <div className="text-center text-slate-400 py-1.5 font-medium font-mono select-all">
          {typeof row.fact_corr === 'number' ? row.fact_corr.toFixed(3) : row.fact_corr}
        </div>
      )
    },
    {
      key: 'is_50_mpa',
      label: 'Is(50) (Mpa)',
      width: 'w-28',
      type: 'readonly',
      headerBgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
      cellClassName: getCellSectionClass('is_50_mpa')
    },
    {
      key: 'factor_k',
      label: 'Factor K',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
      cellClassName: getCellSectionClass('factor_k')
    },
    {
      key: 'ucs',
      label: 'UCS',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
      cellClassName: getCellSectionClass('ucs')
    },
    {
      key: 'isrm_indice_r',
      label: 'ISRM Indice R',
      width: 'w-28',
      type: 'readonly',
      headerBgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
      cellClassName: getCellSectionClass('isrm_indice_r'),
      renderCell: (row) => {
        const val = row.isrm_indice_r;
        const isStrong = ['R4', 'R5', 'R6'].includes(String(val));
        return (
          <div className={`text-center py-1.5 font-bold truncate px-1 select-all ${isStrong ? 'text-orange-400 font-black' : 'text-slate-400'}`}>
            {val}
          </div>
        );
      }
    },
    {
      key: 'observaciones',
      label: 'Observaciones',
      width: 'w-48',
      type: 'text'
    },
    {
      key: 'accion',
      label: 'Elim.',
      width: 'w-16',
      type: 'readonly',
      isStickyRight: true,
      stickyRight: 0,
      headerBgClass: 'bg-navy-900 text-center',
      renderCell: (_, idx, isSelected) => {
        if (!isSelected) {
          return null; // Oculta botones de acción en filas inactivas para máxima ligereza
        }
        return (
          <div className="flex justify-center items-center py-1.5 bg-navy-950/95">
            <button
              onClick={() => deleteRow(idx)}
              className="p-1.5 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 shadow-sm active:scale-90 flex items-center justify-center mx-auto"
              title="Eliminar Ensayo"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      }
    }
  ];
}