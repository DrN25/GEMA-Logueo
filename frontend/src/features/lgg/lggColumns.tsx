import { Trash2, Check, X, Copy } from 'lucide-react';
import type { GridColumn } from '../../components/common/BaseEditableGrid';
import type { Corrida } from './useLggState';
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
  ORIENTACION_OPTIONS,
  ESTRUCTURA_OPTIONS,
  STRENGTH_CATALOG,
  GROUNDWATER_CATALOG
} from '../../utils/catalogData';

// --- ESTILOS DE CELDA ---
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
  const code = (val || '').toUpperCase();
  const item = STRENGTH_CATALOG[code];
  if (!item || val === "-1") {
    return darkMode
      ? { backgroundColor: 'rgba(168, 85, 247, 0.05)', color: '#cbd5e1' }
      : { backgroundColor: 'rgba(0, 0, 0, 0.02)', color: '#64748b' };
  }
  const score = item.score;
  if (darkMode) {
    const bg = score >= 12 ? "#1a3a1a" : score >= 7 ? "#2a2a0a" : score >= 4 ? "#2a1a0a" : "#3a1a1a";
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
  handleCellChange: (idx: number, field: keyof Corrida, val: any) => void;
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
      label: 'de: (m)',
      width: 'w-24',
      type: 'number',
      step: '0.01'
    },
    {
      key: 'a',
      label: 'a: (m)',
      width: 'w-24',
      type: 'number',
      step: '0.01'
    },
    {
      key: 'perf' as any,
      label: 'Perf. (m)',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300',
      renderCell: (row) => <div className="text-center font-bold text-blue-400 py-1.5">{(row.a - row.de).toFixed(2)}</div>
    },
    {
      key: 'rec_m',
      label: 'Rec. (m)',
      width: 'w-24',
      type: 'number',
      step: '0.01',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300'
    },
    {
      key: 'rec_pct' as any,
      label: 'Rec. (%)',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300',
      renderCell: (row) => <div className="text-center font-bold text-slate-400 py-1.5">{row.isErr ? '-' : `${row.rec_pct}%`}</div>
    },
    {
      key: 'rqd_m',
      label: 'RQD (m)',
      width: 'w-24',
      type: 'number',
      step: '0.01',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300'
    },
    {
      key: 'rqd_pct' as any,
      label: 'RQD (%)',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300',
      renderCell: (row) => <div className="text-center font-bold text-slate-400 py-1.5">{row.isErr ? '-' : `${row.rqd_pct}%`}</div>
    },
    {
      key: 'lrf_m',
      label: 'LRF (m)',
      width: 'w-24',
      type: 'number',
      step: '0.01',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300'
    },
    {
      key: 'small_frag_m',
      label: 'Frag <10cm',
      width: 'w-24',
      type: 'number',
      step: '0.01',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300'
    },
    {
      key: 'sum_control' as any,
      label: 'Σ RQD+LRF+F',
      width: 'w-28',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300',
      renderCell: (row) => {
        const sum = parseFloat(((row.rqd_m || 0) + (row.lrf_m || 0) + (row.small_frag_m || 0)).toFixed(2));
        return <div className="text-center font-bold text-slate-400 py-1.5">{sum}</div>;
      }
    },
    {
      key: 'alert_sum_control' as any,
      label: 'Bal. Fis.',
      width: 'w-24',
      type: 'readonly',
      headerBgClass: 'bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300',
      renderCell: (row) => {
        const sum = parseFloat(((row.rqd_m || 0) + (row.lrf_m || 0) + (row.small_frag_m || 0)).toFixed(2));
        const perf = parseFloat((row.a - row.de).toFixed(2));
        const rec = row.rec_m || 0;
        const hasError = sum > perf || row.rqd_m > rec || rec > perf;
        return (
          <div className="flex justify-center items-center py-1.5">
            {hasError ? (
              <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="Inconsistencia de Balance Físico">
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
      key: 'mec_frac',
      label: 'Frac Mec',
      width: 'w-24',
      type: 'number',
      headerBgClass: 'bg-purple-500/5 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300'
    },
    {
      key: 'lito1',
      label: 'Lito 1',
      width: 'w-28',
      type: 'select',
      options: LITO1_OPTIONS,
      renderCell: (row) => {
        const style = getLithologyStyleNullable(row.lito1, isDark);
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              value={row.lito1}
              onChange={(e) => handleCellChange(row.originalIndex, 'lito1', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer"
              style={{ color: style.color }}
            >
              {LITO1_OPTIONS.map(opt => (
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
      label: 'Lito 2',
      width: 'w-28',
      type: 'select',
      options: LITO2_OPTIONS,
      renderCell: (row) => {
        const style = getLithologyStyleNullable(row.lito2, isDark);
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              value={row.lito2 || '-1'}
              onChange={(e) => handleCellChange(row.originalIndex, 'lito2', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer"
              style={{ color: style.color }}
            >
              <option value="-1" className={isDark ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>S/D</option>
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
      label: 'Lito 3',
      width: 'w-28',
      type: 'select',
      options: LITO3_OPTIONS,
      renderCell: (row) => {
        const style = getLithologyStyleNullable(row.lito3, isDark);
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              value={row.lito3 || '-1'}
              onChange={(e) => handleCellChange(row.originalIndex, 'lito3', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer"
              style={{ color: style.color }}
            >
              <option value="-1" className={isDark ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>S/D</option>
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
      label: 'Resist ISRM',
      width: 'w-28',
      type: 'select',
      options: RESISTENCIA_OPTIONS,
      renderCell: (row) => {
        const style = getResistenciaStyle(row.resistencia, isDark);
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              value={row.resistencia}
              onChange={(e) => handleCellChange(row.originalIndex, 'resistencia', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer"
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
      label: 'Ori',
      width: 'w-24',
      type: 'select',
      options: ORIENTACION_OPTIONS
    },
    {
      key: 'offset',
      label: 'Offset',
      width: 'w-24',
      type: 'number',
      step: '0.1'
    },
    {
      key: 'tipo_est1',
      label: 'Tipo Est 1',
      width: 'w-28',
      type: 'select',
      options: ESTRUCTURA_OPTIONS
    },
    {
      key: 'tipo_est2',
      label: 'Tipo Est 2',
      width: 'w-28',
      type: 'select',
      options: ESTRUCTURA_OPTIONS
    },
    {
      key: 'frac_nat',
      label: 'Frac Nat',
      width: 'w-24',
      type: 'number'
    },
    {
      key: 'frac_buz30',
      label: 'Buz <30°',
      width: 'w-24',
      type: 'number'
    },
    {
      key: 'frac_buz60',
      label: '30°-60°',
      width: 'w-24',
      type: 'number'
    },
    {
      key: 'frac_buz90',
      label: 'Buz >60°',
      width: 'w-24',
      type: 'number'
    },
    {
      key: 'sum_frac_nat' as any,
      label: 'Σ Bins',
      width: 'w-24',
      type: 'readonly',
      renderCell: (row) => {
        const sum = (row.frac_buz30 || 0) + (row.frac_buz60 || 0) + (row.frac_buz90 || 0);
        return <div className="text-center font-bold text-slate-400 py-1.5">{sum}</div>;
      }
    },
    {
      key: 'alert_fn' as any,
      label: 'N° FN',
      width: 'w-24',
      type: 'readonly',
      renderCell: (row) => {
        const sum = (row.frac_buz30 || 0) + (row.frac_buz60 || 0) + (row.frac_buz90 || 0);
        const hasError = sum !== (row.frac_nat || 0);
        return (
          <div className="flex justify-center items-center py-1.5">
            {hasError ? (
              <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="La sumatoria de bins no coincide con Frac Nat">
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
      label: 'Abertura',
      width: 'w-24',
      type: 'number',
      step: '0.01'
    },
    {
      key: 'rugosidad',
      label: 'Rug',
      width: 'w-24',
      type: 'number'
    },
    {
      key: 'jrc10',
      label: 'Jrc10',
      width: 'w-24',
      type: 'number'
    },
    {
      key: 'intemperismo',
      label: 'Intemp',
      width: 'w-28',
      type: 'select',
      options: INTEMPERISMO_OPTIONS,
      renderCell: (row) => {
        const style = getIntemperismoStyle(row.intemperismo, isDark);
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              value={row.intemperismo}
              onChange={(e) => handleCellChange(row.originalIndex, 'intemperismo', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer"
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
      label: 'Relleno 1',
      width: 'w-28',
      type: 'select',
      options: RELLENO_OPTIONS
    },
    {
      key: 'relleno2',
      label: 'Relleno 2',
      width: 'w-28',
      type: 'select',
      options: RELLENO_OPTIONS,
      renderCell: (row) => (
        <select
          value={row.relleno2 || '-1'}
          onChange={(e) => handleCellChange(row.originalIndex, 'relleno2', e.target.value)}
          className="w-full bg-transparent border-0 px-1 py-1 text-center text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded"
        >
          <option value="-1" className={isDark ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>Ninguno</option>
          {RELLENO_OPTIONS.filter(o => o !== "-1").map(opt => (
            <option key={opt} value={opt} className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>{opt}</option>
          ))}
        </select>
      )
    },
    {
      key: 'espesor',
      label: 'Espesor',
      width: 'w-24',
      type: 'number',
      step: '0.1'
    },
    {
      key: 'alert_abert_rell' as any,
      label: 'Abert/Rell',
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
      label: 'Agua',
      width: 'w-28',
      type: 'select',
      options: AGUA_OPTIONS,
      renderCell: (row) => {
        const style = getAguaStyle(row.agua_obs, isDark);
        return (
          <div className="w-full h-full flex items-center justify-center px-1" style={style}>
            <select
              value={row.agua_obs}
              onChange={(e) => handleCellChange(row.originalIndex, 'agua_obs', e.target.value)}
              className="w-full bg-transparent border-0 py-1 text-center font-bold focus:outline-none cursor-pointer"
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
      label: 'Geólogo',
      width: 'w-28',
      type: 'readonly',
      renderCell: (row) => <span className="w-full block px-2 py-1.5 text-center text-slate-400 font-medium">{row.turno ? lastRowGeologo(row.originalIndex) : "RD/RB"}</span>
    },
    {
      key: 'fecha' as any,
      label: 'Fecha',
      width: 'w-28',
      type: 'readonly',
      renderCell: (row) => <span className="w-full block px-2 py-1.5 text-center text-slate-400 font-medium">{lastRowFecha(row.originalIndex)}</span>
    },
    {
      key: 'turno',
      label: 'Turno',
      width: 'w-24',
      type: 'select',
      options: ['D', 'N'],
      renderCell: (row) => (
        <select
          value={row.turno || 'D'}
          onChange={(e) => handleCellChange(row.originalIndex, 'turno', e.target.value)}
          className="w-full bg-transparent border-0 py-1 text-center text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded"
        >
          <option value="D" className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>Día</option>
          <option value="N" className={isDark ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>Noche</option>
        </select>
      )
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
      width: 'w-24',
      type: 'readonly',
      isStickyRight: true,
      stickyRight: 192,
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
      width: 'w-24',
      type: 'readonly',
      isStickyRight: true,
      stickyRight: 96,
      headerBgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
      renderCell: (row) => {
        const score = row.rmr89Score;
        if (score === 'ERR') {
          return <div className="text-center text-red-500 font-black py-1.5">ERR</div>;
        }
        return (
          <div className="flex justify-center items-center py-1.5">
            <span className={`px-2.5 py-0.5 rounded text-xs font-black border ${score >= 81 ? 'bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' : score >= 61 ? 'bg-blue-500/25 text-blue-600 dark:text-cyan-300 border-blue-500/30' : score >= 41 ? 'bg-amber-500/25 text-amber-600 dark:text-amber-300 border-amber-500/30' : 'bg-red-500/25 text-red-600 dark:text-red-400 border-red-500/30'}`}>
              {score}
            </span>
          </div>
        );
      }
    },
    {
      key: 'accion' as any,
      label: 'Acciones',
      width: 'w-24',
      type: 'readonly',
      isStickyRight: true,
      stickyRight: 0,
      renderCell: (row) => (
        <div className="flex justify-center items-center gap-1.5 py-1.5">
          <button
            onClick={() => insertCorridaRow(row.originalIndex)}
            className="text-cyan-500 hover:text-cyan-400 p-1 hover:bg-cyan-500/10 rounded transition-colors"
            title="Clonar esta corrida abajo"
          >
            <Copy size={15} />
          </button>
          <button
            onClick={() => deleteCorridaRow(row.originalIndex)}
            className="text-red-500 hover:text-red-400 p-1 hover:bg-red-500/10 rounded transition-colors"
            title="Eliminar esta corrida"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )
    }
  ];
}
