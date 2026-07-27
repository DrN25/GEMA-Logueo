import { Trash2, Check, X, Copy } from 'lucide-react';
import type { GridColumn } from '../../components/common/BaseEditableGrid';
import type { CorridaEnriquecida } from './useLggState';
import {
  LITHOLOGY_CATALOG,
  LITO1_OPTIONS,
  LITO2_OPTIONS,
  LITO3_OPTIONS,
  RESISTENCIA_OPTIONS,
  RELLENO_OPTIONS,
  INTEMPERISMO_OPTIONS,
  AGUA_OPTIONS,
  STRENGTH_CATALOG,
  GROUNDWATER_CATALOG,
  normalizeStrength
} from '../../utils/catalogData';

export const getLithologyStyle = (val: string, darkMode: boolean) => {
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

export const getLithologyStyleNullable = (val: string | undefined, darkMode: boolean) => {
  if (!val || val === "-1") {
    return darkMode
      ? { backgroundColor: 'rgba(168, 85, 247, 0.05)', color: '#94a3b8' }
      : { backgroundColor: 'rgba(0, 0, 0, 0.02)', color: '#64748b' };
  }
  return getLithologyStyle(val, darkMode);
};

export const getResistenciaStyle = (val: string, darkMode: boolean) => {
  const code = normalizeStrength(val);
  const item = STRENGTH_CATALOG[code];
  if (!item || code === "-1") {
    return darkMode
      ? { backgroundColor: 'rgba(168, 85, 247, 0.05)', color: '#cbd5e1' }
      : { backgroundColor: 'rgba(0, 0, 0, 0.02)', color: '#64748b' };
  }
  const score = item.score;
  if (darkMode) {
    const bg = score >= 12 ? "#071f07" : score >= 7 ? "#1f1a00" : score >= 4 ? "#1f0f00" : "#1f0a0a";
    const fg = score >= 12 ? "#86efac" : score >= 7 ? "#fcd34d" : score >= 4 ? "#fb923c" : "#fca5a5";
    return { backgroundColor: bg, color: fg };
  } else {
    const bg = score >= 12 ? "#d1fae5" : score >= 7 ? "#fef3c7" : score >= 4 ? "#ffedd5" : "#fee2e2";
    const fg = score >= 12 ? "#065f46" : score >= 7 ? "#92400e" : score >= 4 ? "#9a3412" : "#991b1b";
    return { backgroundColor: bg, color: fg };
  }
};

export const getIntemperismoStyle = (val: string, darkMode: boolean) => {
  const code = (val || '').toUpperCase();
  let rating = -1;
  if (code === 'UWF') rating = 6;
  else if (code === 'SWD') rating = 5;
  else if (code === 'MWM') rating = 3;
  else if (code === 'HWA') rating = 1;
  else if (code === 'CWC' || code === 'RS') rating = 0;

  if (rating === -1 || val === "-1") {
    return darkMode
      ? { backgroundColor: 'rgba(245, 158, 11, 0.05)', color: '#cbd5e1' }
      : { backgroundColor: 'rgba(0, 0, 0, 0.02)', color: '#64748b' };
  }

  if (darkMode) {
    const bg = rating >= 5 ? "#071f07" : rating >= 3 ? "#1f1a00" : rating >= 1 ? "#1f0f00" : "#1f0a0a";
    const fg = rating >= 5 ? "#86efac" : rating >= 3 ? "#fcd34d" : rating >= 1 ? "#fb923c" : "#fca5a5";
    return { backgroundColor: bg, color: fg };
  } else {
    const bg = rating >= 5 ? "#d1fae5" : rating >= 3 ? "#fef3c7" : rating >= 1 ? "#ffedd5" : "#fee2e2";
    const fg = rating >= 5 ? "#065f46" : rating >= 3 ? "#92400e" : rating >= 1 ? "#9a3412" : "#991b1b";
    return { backgroundColor: bg, color: fg };
  }
};

export const getAguaStyle = (val: string, darkMode: boolean) => {
  const code = (val || '').toUpperCase();
  const item = GROUNDWATER_CATALOG[code];
  if (!item || val === "-1") {
    return darkMode
      ? { backgroundColor: 'rgba(59, 130, 246, 0.05)', color: '#cbd5e1' }
      : { backgroundColor: 'rgba(0, 0, 0, 0.02)', color: '#64748b' };
  }
  const rating = item.rmr89;
  if (darkMode) {
    const bg = rating >= 15 ? "#071a2f" : rating >= 10 ? "#0f253f" : rating >= 7 ? "#1c2a3f" : "#2f1f2f";
    const fg = rating >= 15 ? "#60a5fa" : rating >= 10 ? "#93c5fd" : rating >= 7 ? "#cbd5e1" : "#f87171";
    return { backgroundColor: bg, color: fg };
  } else {
    const bg = rating >= 15 ? "#dbeafe" : rating >= 10 ? "#eff6ff" : rating >= 7 ? "#f1f5f9" : "#fee2e2";
    const fg = rating >= 15 ? "#1e40af" : rating >= 10 ? "#2563eb" : rating >= 7 ? "#475569" : "#991b1b";
    return { backgroundColor: bg, color: fg };
  }
};

interface LggColumnBuilderProps {
  darkMode: boolean;
  lastRowGeologo: (idx: number) => string;
  lastRowFecha: (idx: number) => string;
  lastRowTaladroName: (idx: number) => string;
  handleCellChange: (idx: number, field: any, val: any) => void;
  deleteCorridaRow: (idx: number) => void;
  insertCorridaRow: (idx: number) => void;
}

export function getLggColumns({
  darkMode,
  lastRowGeologo,
  lastRowFecha,
  lastRowTaladroName,
  handleCellChange,
  deleteCorridaRow,
  insertCorridaRow
}: LggColumnBuilderProps): GridColumn<CorridaEnriquecida>[] {
  const isDark = darkMode;

  return [
    {
      key: 'corrida',
      label: '#',
      width: 'w-12',
      type: 'readonly',
      isSticky: true,
      stickyLeft: 0,
      headerBgClass: 'bg-navy-900',
      renderCell: (row) => <div className="text-center font-bold text-slate-400 py-1.5">{row.corrida}</div>
    },
    {
      key: 'taladro' as any,
      label: 'Taladro',
      width: 'w-24',
      type: 'readonly',
      isSticky: true,
      stickyLeft: 48,
      headerBgClass: 'bg-navy-900',
      renderCell: (_, idx) => <div className="text-center text-slate-400 py-1.5 truncate">{lastRowTaladroName(idx)}</div>
    },
    {
      key: 'de',
      label: 'de:',
      width: 'w-16',
      type: 'number',
      step: '0.01'
    },
    {
      key: 'a',
      label: 'a:',
      width: 'w-16',
      type: 'number',
      step: '0.01'
    },
    {
      key: 'perf' as any,
      label: 'Perf. (m)',
      width: 'w-16',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300',
      renderCell: (row) => <div className="text-center font-bold text-blue-400 py-1.5">{(row.a - row.de).toFixed(2)}</div>
    },
    {
      key: 'alert_sum_control' as any,
      label: 'Perf./LR',
      width: 'w-16',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300',
      renderCell: (row) => {
        const perf = parseFloat((row.a - row.de).toFixed(2));
        const rec = row.rec_m || 0;
        const hasError = rec > perf;
        return (
          <div className="flex justify-center items-center py-1.5">
            {hasError ? (
              <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="La longitud recuperada supera el avance">
                <X size={14} className="stroke-[3]" />
              </span>
            ) : (
              <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                <Check size={14} className="stroke-[3]" />
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'rec_m',
      label: 'Long. Recuper. (m)',
      width: 'w-20',
      type: 'number',
      step: '0.01',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300'
    },
    {
      key: 'rqd_m',
      label: '(RQD) ∑ Frag\'s ≥ 10 cm (m)',
      width: 'w-20',
      type: 'number',
      step: '0.01',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300'
    },
    {
      key: 'lrf_m',
      label: 'Long. Roca Fracturada (m)',
      width: 'w-20',
      type: 'number',
      step: '0.01',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300'
    },
    {
      key: 'frf' as any,
      label: 'FRF',
      width: 'w-16',
      type: 'readonly',
      headerBgClass: 'bg-purple-500/5 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300',
      renderCell: (row) => {
        const lrf = row.lrf_m || 0;
        const calcFrf = lrf > 0 ? Math.floor(Math.round(lrf * 100) / 5) + 1 : 0;
        const val = row.frf !== undefined && row.frf !== null ? row.frf : calcFrf;
        return <div className="text-center font-bold text-purple-400 py-1.5">{val}</div>;
      }
    },
    {
      key: 'small_frag_m',
      label: '∑ Frag\'s < 10 cm (m)',
      width: 'w-20',
      type: 'number',
      step: '0.01',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300'
    },
    {
      key: 'sum_control' as any,
      label: '∑ RQD+LRF + ∑ Frag\'s<10',
      width: 'w-20',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300',
      renderCell: (row) => {
        const sum = parseFloat(((row.rqd_m || 0) + (row.lrf_m || 0) + (row.small_frag_m || 0)).toFixed(2));
        return <div className="text-center font-bold text-slate-400 py-1.5">{sum}</div>;
      }
    },
    {
      key: 'sum_control_check' as any,
      label: 'LR/RQD + LRF',
      width: 'w-16',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300',
      renderCell: (row) => {
        const sum = parseFloat(((row.rqd_m || 0) + (row.lrf_m || 0) + (row.small_frag_m || 0)).toFixed(2));
        const perf = parseFloat((row.a - row.de).toFixed(2));
        const rec = row.rec_m || 0;
        const hasError = sum > perf || row.rqd_m > rec;
        return (
          <div className="flex justify-center items-center py-1.5">
            {hasError ? (
              <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="La sumatoria física no coincide con la recuperación o avance">
                <X size={14} className="stroke-[3]" />
              </span>
            ) : (
              <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                <Check size={14} className="stroke-[3]" />
              </span>
            )}
          </div>
        );
      }
    },

    {
      key: 'lito1',
      label: 'LITO 1',
      width: 'w-24',
      type: 'select',
      renderCell: (row, _idx, isSelected) => {
        const style = getLithologyStyleNullable(row.lito1, isDark);
        if (!isSelected) {
          return (
            <div className="w-full h-full flex items-center justify-center px-1" style={style}>
              <span className="font-bold py-1.5 truncate text-center select-all">
                {(!row.lito1 || row.lito1 === "-1") ? "-" : row.lito1}
              </span>
            </div>
          );
        }
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              id={`lgg-cell-${row.originalIndex}-lito1`}
              value={row.lito1 || '-1'}
              onChange={(e) => handleCellChange(row.originalIndex, 'lito1', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer text-xs"
              style={{ color: style.color }}
            >
              <option value="-1" className={isDark ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>S/D</option>
              {(!LITO1_OPTIONS.includes(row.lito1) && row.lito1 && row.lito1 !== "-1") && (
                <option value={row.lito1}>{row.lito1}</option>
              )}
              {LITO1_OPTIONS.filter(o => o !== "-1").map(opt => (
                <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );
      }
    },
    {
      key: 'lito2',
      label: 'LITO 2',
      width: 'w-24',
      type: 'select',
      renderCell: (row, _idx, isSelected) => {
        const style = getLithologyStyleNullable(row.lito2, isDark);
        if (!isSelected) {
          return (
            <div className="w-full h-full flex items-center justify-center px-1" style={style}>
              <span className="font-bold py-1.5 truncate text-center select-all">
                {(!row.lito2 || row.lito2 === "-1") ? "-" : row.lito2}
              </span>
            </div>
          );
        }
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              id={`lgg-cell-${row.originalIndex}-lito2`}
              value={row.lito2 || '-1'}
              onChange={(e) => handleCellChange(row.originalIndex, 'lito2', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer text-xs"
              style={{ color: style.color }}
            >
              <option value="-1" className={isDark ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>S/D</option>
              {(row.lito2 && !LITO2_OPTIONS.includes(row.lito2) && row.lito2 !== "-1") && (
                <option value={row.lito2}>{row.lito2}</option>
              )}
              {LITO2_OPTIONS.filter(o => o !== "-1").map(opt => (
                <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );
      }
    },
    {
      key: 'lito3',
      label: 'LITO 3',
      width: 'w-24',
      type: 'select',
      renderCell: (row, _idx, isSelected) => {
        const style = getLithologyStyleNullable(row.lito3, isDark);
        if (!isSelected) {
          return (
            <div className="w-full h-full flex items-center justify-center px-1" style={style}>
              <span className="font-bold py-1.5 truncate text-center select-all">
                {(!row.lito3 || row.lito3 === "-1") ? "-" : row.lito3}
              </span>
            </div>
          );
        }
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              id={`lgg-cell-${row.originalIndex}-lito3`}
              value={row.lito3 || '-1'}
              onChange={(e) => handleCellChange(row.originalIndex, 'lito3', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer text-xs"
              style={{ color: style.color }}
            >
              <option value="-1" className={isDark ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>S/D</option>
              {(row.lito3 && !LITO3_OPTIONS.includes(row.lito3) && row.lito3 !== "-1") && (
                <option value={row.lito3}>{row.lito3}</option>
              )}
              {LITO3_OPTIONS.filter(o => o !== "-1").map(opt => (
                <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );
      }
    },
    {
      key: 'resistencia',
      label: 'Resist. Máx. Estimada (ISRM)',
      width: 'w-24',
      type: 'select',
      renderCell: (row, _idx, isSelected) => {
        const normRes = normalizeStrength(row.resistencia);
        const style = getResistenciaStyle(normRes, isDark);
        if (!isSelected) {
          return (
            <div className="w-full h-full flex items-center justify-center px-1" style={style}>
              <span className="font-bold py-1.5 truncate text-center select-all">
                {normRes === "-1" ? "-" : normRes}
              </span>
            </div>
          );
        }
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              id={`lgg-cell-${row.originalIndex}-resistencia`}
              value={normRes}
              onChange={(e) => handleCellChange(row.originalIndex, 'resistencia', normalizeStrength(e.target.value))}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer text-xs"
              style={{ color: style.color }}
            >
              {RESISTENCIA_OPTIONS.map(opt => (
                <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>
                  {opt === "-1" ? "S/D" : opt}
                </option>
              ))}
            </select>
          </div>
        );
      }
    },
    {
      key: 'orientacion',
      label: 'Linea de orientación',
      width: 'w-20',
      type: 'select',
      options: ['N', 'S', 'X']
    },
    {
      key: 'offset',
      label: 'Desplaz. 0°-360° (OFFSET)',
      width: 'w-20',
      type: 'number',
      step: '0.1'
    },
    {
      key: 'tipo_est1',
      label: 'Tipo de estructura',
      width: 'w-20',
      type: 'select',
      options: ['JN', 'F-10', 'SZ', 'BED', 'VN', 'CON', 'SE', 'F+10', '-1']
    },
    {
      key: 'tipo_est2',
      label: 'Tipo de estructura 2',
      width: 'w-20',
      type: 'select',
      options: ['JN', 'F-10', 'SZ', 'BED', 'VN', 'CON', 'SE', 'F+10', '-1']
    },
    {
      key: 'frac_nat',
      label: 'N° de Fracturas Naturales',
      width: 'w-20',
      type: 'number'
    },
    {
      key: 'frac_buz30',
      label: 'N° Frac. Nat. (Buz<30°)',
      width: 'w-20',
      type: 'number'
    },
    {
      key: 'frac_buz60',
      label: 'N° Frac. Nat. (30°< Buz <60°)',
      width: 'w-20',
      type: 'number'
    },
    {
      key: 'frac_buz90',
      label: 'N° Frac. Nat. (Buz>60°)',
      width: 'w-20',
      type: 'number'
    },
    {
      key: 'sum_frac_nat' as any,
      label: '∑ Fracturas Naturales',
      width: 'w-20',
      type: 'readonly',
      renderCell: (row) => {
        const sum = (row.frac_buz30 || 0) + (row.frac_buz60 || 0) + (row.frac_buz90 || 0);
        return <div className="text-center font-bold text-slate-400 py-1.5">{sum}</div>;
      }
    },
    {
      key: 'alert_fn' as any,
      label: 'N\' FN',
      width: 'w-16',
      type: 'readonly',
      renderCell: (row) => {
        const sum = (row.frac_buz30 || 0) + (row.frac_buz60 || 0) + (row.frac_buz90 || 0);
        const hasError = sum !== (row.frac_nat || 0);
        return (
          <div className="flex justify-center items-center py-1.5">
            {hasError ? (
              <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="La sumatoria no coincide con Frac Nat">
                <X size={14} className="stroke-[3]" />
              </span>
            ) : (
              <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                <Check size={14} className="stroke-[3]" />
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'abertura',
      label: 'Abertura (mm.)',
      width: 'w-20',
      type: 'number',
      step: '0.01'
    },
    {
      key: 'rugosidad',
      label: 'Rugosidad (ISRM)',
      width: 'w-20',
      type: 'number'
    },
    {
      key: 'jrc10',
      label: 'JRC10',
      width: 'w-20',
      type: 'number'
    },
    {
      key: 'intemperismo',
      label: 'Grado Intemp. (ISRM)',
      width: 'w-20',
      type: 'select',
      renderCell: (row, _idx, isSelected) => {
        const style = getIntemperismoStyle(row.intemperismo, isDark);
        if (!isSelected) {
          return (
            <div className="w-full h-full flex items-center justify-center px-1" style={style}>
              <span className="font-bold py-1.5 truncate text-center select-all">
                {(!row.intemperismo || row.intemperismo === "-1") ? "-" : row.intemperismo}
              </span>
            </div>
          );
        }
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              id={`lgg-cell-${row.originalIndex}-intemperismo`}
              value={row.intemperismo}
              onChange={(e) => handleCellChange(row.originalIndex, 'intemperismo', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer text-xs"
              style={{ color: style.color }}
            >
              {INTEMPERISMO_OPTIONS.map(opt => (
                <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>
                  {opt === "-1" ? "S/D" : opt}
                </option>
              ))}
            </select>
          </div>
        );
      }
    },
    {
      key: 'relleno1',
      label: 'Tipo de Relleno 1',
      width: 'w-20',
      type: 'select',
      options: RELLENO_OPTIONS
    },
    {
      key: 'relleno2',
      label: 'Tipo de Relleno 2',
      width: 'w-20',
      type: 'select',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-300 block text-center truncate py-1.5 font-semibold select-all">
              {(!row.relleno2 || row.relleno2 === "-1") ? "-" : row.relleno2}
            </span>
          );
        }
        return (
          <select
            id={`lgg-cell-${row.originalIndex}-relleno2`}
            value={row.relleno2 || '-1'}
            onChange={(e) => handleCellChange(row.originalIndex, 'relleno2', e.target.value)}
            className="w-full bg-transparent border-0 px-1 py-1 text-center text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded text-xs"
          >
            <option value="-1" className={isDark ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>Ninguno</option>
            {RELLENO_OPTIONS.filter(o => o !== "-1").map(opt => (
              <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>{opt}</option>
            ))}
          </select>
        );
      }
    },
    {
      key: 'espesor',
      label: 'Espesor Relleno (mm)',
      width: 'w-20',
      type: 'number',
      step: '0.1'
    },
    {
      key: 'alert_abert_rell' as any,
      label: 'Abert./Rel',
      width: 'w-24',
      type: 'readonly',
      renderCell: (row) => {
        const hasError = ((row.espesor || 0) > 0 && (row.abertura || 0) <= 0) || ((row.espesor || 0) === 0 && (row.abertura || 0) > 0);
        return (
          <div className="flex justify-center items-center py-1.5">
            {hasError ? (
              <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="Inconsistencia de Abertura vs Espesor">
                <X size={14} className="stroke-[3]" />
              </span>
            ) : (
              <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                <Check size={14} className="stroke-[3]" />
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'agua_obs',
      label: 'Presen. Agua (ISRM)',
      width: 'w-20',
      type: 'select',
      renderCell: (row, _idx, isSelected) => {
        const style = getAguaStyle(row.agua_obs, isDark);
        if (!isSelected) {
          return (
            <div className="w-full h-full flex items-center justify-center px-1" style={style}>
              <span className="font-bold py-1.5 truncate text-center select-all">
                {(!row.agua_obs || row.agua_obs === "-1") ? "-" : row.agua_obs}
              </span>
            </div>
          );
        }
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              id={`lgg-cell-${row.originalIndex}-agua_obs`}
              value={row.agua_obs}
              onChange={(e) => handleCellChange(row.originalIndex, 'agua_obs', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer text-xs"
              style={{ color: style.color }}
            >
              {AGUA_OPTIONS.map(opt => (
                <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );
      }
    },
    {
      key: 'geologo' as any,
      label: 'Geotécnico',
      width: 'w-24',
      type: 'readonly',
      renderCell: (row) => <span className="w-full block px-2 py-1.5 text-center text-slate-400 font-medium">{row.turno ? lastRowGeologo(row.originalIndex) : "RD/RB"}</span>
    },
    {
      key: 'fecha' as any,
      label: 'Fecha',
      width: 'w-24',
      type: 'readonly',
      renderCell: (row) => <span className="w-full block px-2 py-1.5 text-center text-slate-400 font-medium">{lastRowFecha(row.originalIndex)}</span>
    },
    {
      key: 'turno',
      label: 'Turno',
      width: 'w-16',
      type: 'select',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return (
            <span className="text-slate-300 block text-center truncate py-1.5 font-semibold select-all">
              {row.turno || 'D'}
            </span>
          );
        }
        return (
          <select
            id={`lgg-cell-${row.originalIndex}-turno`}
            value={row.turno || 'D'}
            onChange={(e) => handleCellChange(row.originalIndex, 'turno', e.target.value)}
            className="w-full bg-transparent border-0 py-1 text-center text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded text-xs"
          >
            <option value="D" className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>Día</option>
            <option value="N" className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>Noche</option>
          </select>
        );
      }
    },
    {
      key: 'comentarios',
      label: 'Comentarios',
      width: 'w-56',
      type: 'text'
    },
    {
      key: 'rmr76Score' as any,
      label: "RMR'76",
      width: 'w-16',
      type: 'readonly',
      isStickyRight: true,
      stickyRight: 144,
      headerBgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
      renderCell: (row) => {
        const score = row.rmr76Score;
        if (score === 'ERR') {
          return <div className="text-center text-red-500 font-black py-1.5">ERR</div>;
        }
        return (
          <div className="flex justify-center items-center py-1.5">
            <span className={`px-2.5 py-0.5 rounded text-xs font-black border ${score >= 81 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20' : score >= 61 ? 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20' : score >= 41 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'}`}>
              {score}
            </span>
          </div>
        );
      }
    },
    {
      key: 'rmr89Score' as any,
      label: "RMR'89",
      width: 'w-16',
      type: 'readonly',
      isStickyRight: true,
      stickyRight: 80,
      headerBgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
      renderCell: (row) => {
        const score = row.rmr89Score;
        if (score === 'ERR') {
          return <div className="text-center text-red-500 font-black py-1.5">ERR</div>;
        }
        return (
          <div className="flex justify-center items-center py-1.5">
            <span className={`px-2.5 py-0.5 rounded text-xs font-black border ${score >= 81 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20' : score >= 61 ? 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20' : score >= 41 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'}`}>
              {score}
            </span>
          </div>
        );
      }
    },
    {
      key: 'accion' as any,
      label: 'Acciones',
      width: 'w-20',
      type: 'readonly',
      isStickyRight: true,
      stickyRight: 0,
      headerBgClass: 'bg-navy-900',
      renderCell: (row, _idx, isSelected) => {
        if (!isSelected) {
          return null;
        }
        return (
          <div className="flex justify-center items-center gap-1.5 h-full bg-navy-950/95">
            <button
              onClick={() => insertCorridaRow(row.originalIndex)}
              className="p-1.5 rounded bg-navy-800 hover:bg-navy-700 text-cyan-400 hover:text-cyan-300 border border-navy-700/30 transition-all active:scale-90"
              title="Clonar esta corrida abajo"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={() => deleteCorridaRow(row.originalIndex)}
              className="p-1.5 rounded bg-red-950/20 hover:bg-red-950/50 text-red-400 hover:text-red-300 border border-red-900/20 transition-all active:scale-90"
              title="Eliminar esta corrida"
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      }
    }
  ];
}