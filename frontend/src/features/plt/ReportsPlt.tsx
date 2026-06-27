// --- START OF FILE ReportsPlt.tsx ---

import React, { useState, useRef } from 'react';
import { Plus, Trash2, FileSpreadsheet, Keyboard, Check, X, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { EnsayoPlt } from '../../App';
import type { ValidationAlert } from '../../utils/qaqcValidator';
import {
  LITHOLOGY_CATALOG,
  NOMINAL_DIAMETERS,
  resolveLithologyCascade,
  LITO1_OPTIONS,
  LITO2_OPTIONS,
  LITO3_OPTIONS
} from '../../utils/catalogData';
import ExcelImportModal from '../lgg/ExcelImportModal';
import QaqcPltAnalysisPanel from './QaqcPltAnalysisPanel';
import QaqcPltDashboardPanel from './QaqcPltDashboardPanel';

interface ReportsPltProps {
  ensayos_plt: EnsayoPlt[];
  onEnsayosPltChange: (plts: EnsayoPlt[]) => void;
  corridas: any[];
  collar: any;
  alerts: ValidationAlert[];
  darkMode?: boolean;
  onImportExcel?: (importedRows: any[]) => void;
}



const DYNAMIC_COLUMNS = [
  { key: 'nro_caja', label: 'Nro Caja', editable: true, type: 'number', defaultWidth: 90 },
  { key: 'corrida_desde', label: 'Corrida Desde (m)', editable: true, type: 'number', defaultWidth: 120 },
  { key: 'corrida_hasta', label: 'Corrida Hasta (m)', editable: true, type: 'number', defaultWidth: 120 },
  { key: 'from_m', label: 'From', editable: true, type: 'number', defaultWidth: 90 },
  { key: 'to_m', label: 'To', editable: true, type: 'number', defaultWidth: 90 },
  { key: 'verif_corrida', label: 'Verif. corrida', editable: false, defaultWidth: 90 },
  { key: 'long_de_corrida_m', label: 'Long. Corrida (m)', editable: false, defaultWidth: 120 },
  { key: 'este_m', label: 'Este (m)', editable: true, type: 'number', defaultWidth: 110 },
  { key: 'norte_m', label: 'Norte (m)', editable: true, type: 'number', defaultWidth: 110 },
  { key: 'elevacion_msnm', label: 'Elevación (msnm)', editable: true, type: 'number', defaultWidth: 120 },
  { key: 'long_de_muestra_mm', label: 'Long. Muestra (mm)', editable: false, defaultWidth: 130 },
  { key: 'tipo_de_ensayo', label: 'Tipo de Ensayo', editable: true, type: 'select', options: ['D', 'A', 'B', 'I'], defaultWidth: 120 },
  { key: 'diametro_taladro_nominacion', label: 'Diám. Taladro', editable: true, type: 'select', options: ['BQ', 'NQ', 'HQ', 'PQ'], defaultWidth: 110 },
  { key: 'litologia_1', label: 'Litología 1', editable: true, type: 'select', options: LITO1_OPTIONS, defaultWidth: 120 },
  { key: 'litologia_2', label: 'Litología 2', editable: true, type: 'select', options: LITO2_OPTIONS, defaultWidth: 120 },
  { key: 'litologia_3', label: 'Litología 3', editable: true, type: 'select', options: LITO3_OPTIONS, defaultWidth: 120 },
  { key: 'tipo_litologico', label: 'Tipo litológico', editable: false, defaultWidth: 120 },
  { key: 'd_mm', label: 'D (mm)', editable: true, type: 'number', defaultWidth: 90 },
  { key: 'verif_de_longitud', label: 'Verif. longitud', editable: false, defaultWidth: 100 },
  { key: 'p_instr_kn', label: 'P instr (kN)', editable: true, type: 'number', defaultWidth: 100 },
  { key: 'tipo_rotura_code', label: 'Tipo de Rotura', editable: true, type: 'select', options: ['M', 'E', 'C'], defaultWidth: 110 },
  { key: 'direccion_rotura_code', label: 'Dirección rotura', editable: true, type: 'select', options: ['Pa', 'Pe', 'NA'], defaultWidth: 120 },
  { key: 'ejecutadoPor', label: 'Ejecutado por', editable: true, type: 'text', defaultWidth: 110 },
  { key: 'is_mpa', label: 'Is (Mpa)', editable: false, defaultWidth: 100 },
  { key: 'fact_corr', label: 'Fact. Corr', editable: false, defaultWidth: 100 },
  { key: 'is_50_mpa', label: 'Is(50) (Mpa)', editable: false, defaultWidth: 110 },
  { key: 'factor_k', label: 'Factor K', editable: false, defaultWidth: 90 },
  { key: 'ucs', label: 'UCS', editable: false, defaultWidth: 100 },
  { key: 'isrm_indice_r', label: 'ISRM Indice R', editable: false, defaultWidth: 110 },
  { key: 'observaciones', label: 'Observaciones', editable: true, type: 'text', defaultWidth: 200 }
];

const ALL_COL_KEYS = [
  'fecha', 'nro_muestra',
  ...DYNAMIC_COLUMNS.filter(c => c.editable).map(c => c.key)
];

export default function ReportsPlt({
  ensayos_plt,
  onEnsayosPltChange,
  corridas,
  collar,
  alerts,
  darkMode = true,
  onImportExcel
}: ReportsPltProps) {
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [activeSubTab, setActiveSubTab] = useState<'plt' | 'dashboard' | 'qaqc'>('plt');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleExportExcel = () => {
    try {
      const campaignVal = collar.name ? collar.name.match(/\d+/)?.[0] || '2026' : '2026';
      const exportRows = ensayos_plt.map((plt) => {
        return {
          'Campaña': campaignVal,
          'Fecha': plt.fecha,
          'Taladro': collar.name || '',
          'Nro Muestra': plt.nro_muestra,
          'Nro Caja': plt.nro_caja,
          'Corrida Desde (m)': plt.corrida_desde || 0,
          'Corrida Hasta (m)': plt.corrida_hasta || 0,
          'From': plt.from_m,
          'To': plt.to_m,
          'Verif. corrida': plt.verif_corrida,
          'Long. de Corrida (m)': plt.long_de_corrida_m,
          'Este (m)': plt.este_m,
          'Norte (m)': plt.norte_m,
          'Elevación (msnm)': plt.elevacion_msnm,
          'Long. de Muestra (mm)': plt.long_de_muestra_mm,
          'Tipo de Ensayo': plt.tipo_de_ensayo,
          'Diametro de Taladro': plt.diametro_taladro_nominacion,
          'Litologia 1': plt.litologia_1 || '',
          'Litologia 2': plt.litologia_2 || '',
          'Litologia 3': plt.litologia_3 || '',
          'Tipo litológico': plt.tipo_litologico || '',
          'D (mm)': plt.d_mm,
          'Verif. de longitud': plt.verif_de_longitud,
          'P instr (kN)': plt.p_instr_kn,
          'Tipo de Rotura': plt.tipo_rotura_code,
          'Dirección de rotura': plt.direccion_rotura_code,
          'Ejecutado por': plt.ejecutadoPor,
          'Is (Mpa)': plt.is_mpa,
          'Fact. Corr': plt.fact_corr,
          'Is(50) (Mpa)': plt.is_50_mpa,
          'Factor K': plt.factor_k || '',
          'UCS': plt.ucs,
          'ISRM Indice R': plt.isrm_indice_r,
          'Observaciones': plt.observaciones || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ENSAYO PLT');
      XLSX.writeFile(wb, `${collar.name || 'TALADRO'}_Ensayos_PLT.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Error al exportar los datos a Excel.');
    }
  };

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    DYNAMIC_COLUMNS.forEach(col => {
      initial[col.key] = col.defaultWidth;
    });
    return initial;
  });

  const resizingCol = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    resizingCol.current = colKey;
    startX.current = e.clientX;
    startWidth.current = widths[colKey] || 100;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingCol.current) return;
    const diff = e.clientX - startX.current;
    const newWidth = Math.max(60, Math.min(500, startWidth.current + diff));
    setWidths(prev => ({ ...prev, [resizingCol.current!]: newWidth }));
  };

  const handleMouseUp = () => {
    resizingCol.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const activePltAlerts = alerts.filter(a => a.field.startsWith('plt-'));

  const getCellAlert = (rowIdx: number, colName: string) => {
    return activePltAlerts.find(a => a.field === `plt-${colName}-${rowIdx}`);
  };

  const getHeaderStyle = (colKey: string, baseWidth: number) => {
    const w = widths[colKey] || baseWidth;
    let backgroundStyle = {};

    if (['from_m', 'to_m', 'long_de_muestra_mm', 'd_mm', 'diametro_taladro_nominacion', 'verif_de_longitud'].includes(colKey)) {
      backgroundStyle = {
        background: darkMode
          ? 'linear-gradient(rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.1)), rgb(var(--navy-900))'
          : 'linear-gradient(rgba(59, 130, 246, 0.05), rgba(59, 130, 246, 0.05)), rgb(var(--navy-900))'
      };
    } else if (['litologia_1', 'litologia_2', 'litologia_3', 'tipo_litologico'].includes(colKey)) {
      backgroundStyle = {
        background: darkMode
          ? 'linear-gradient(rgba(168, 85, 247, 0.1), rgba(168, 85, 247, 0.1)), rgb(var(--navy-900))'
          : 'linear-gradient(rgba(168, 85, 247, 0.05), rgba(168, 85, 247, 0.05)), rgb(var(--navy-900))'
      };
    } else if (['tipo_de_ensayo', 'p_instr_kn', 'tipo_rotura_code', 'direccion_rotura_code'].includes(colKey)) {
      backgroundStyle = {
        background: darkMode
          ? 'linear-gradient(rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.1)), rgb(var(--navy-900))'
          : 'linear-gradient(rgba(245, 158, 11, 0.05), rgba(245, 158, 11, 0.05)), rgb(var(--navy-900))'
      };
    } else if (['is_mpa', 'fact_corr', 'is_50_mpa', 'factor_k', 'ucs', 'isrm_indice_r'].includes(colKey)) {
      backgroundStyle = {
        background: darkMode
          ? 'linear-gradient(rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.15)), rgb(var(--navy-900))'
          : 'linear-gradient(rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.08)), rgb(var(--navy-900))'
      };
    } else {
      backgroundStyle = { background: 'rgb(var(--navy-900))' };
    }

    return {
      width: w, minWidth: w, maxWidth: w,
      ...backgroundStyle,
      boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))'
    };
  };

  const getCellTdStyle = (rowIdx: number, colKey: string) => {
    const alert = getCellAlert(rowIdx, colKey);
    let baseClass = "";

    if (['from_m', 'to_m', 'long_de_muestra_mm', 'd_mm', 'diametro_taladro_nominacion', 'verif_de_longitud'].includes(colKey)) {
      baseClass = "bg-blue-500/5 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300";
    } else if (['litologia_1', 'litologia_2', 'litologia_3', 'tipo_litologico'].includes(colKey)) {
      baseClass = "bg-purple-500/5 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300";
    } else if (['tipo_de_ensayo', 'p_instr_kn', 'tipo_rotura_code', 'direccion_rotura_code'].includes(colKey)) {
      baseClass = "bg-amber-500/5 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300";
    } else if (['is_mpa', 'fact_corr', 'is_50_mpa', 'factor_k', 'ucs', 'isrm_indice_r'].includes(colKey)) {
      baseClass = "bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold";
    }

    if (!alert) return { className: baseClass, style: {} };

    const isCritical = alert.type === 'CRITICAL';
    const alertBg = isCritical ? 'rgba(239, 68, 68, 0.18)' : 'rgba(245, 158, 11, 0.18)';
    const alertBorder = isCritical ? 'inset 0 0 0 2px rgba(239, 68, 68, 0.6)' : 'inset 0 0 0 2px rgba(245, 158, 11, 0.5)';

    return {
      className: baseClass,
      style: {
        background: alertBg,
        boxShadow: alertBorder,
      }
    };
  };

  const getLithologyStyle = (val: string) => {
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

  const cleanNum = (val: any): number => {
    const num = parseFloat(val);
    return isNaN(num) || num === -1 ? 0 : num;
  };

  const resolveIsrmIndex = (ucs: number): string => {
    if (ucs <= 0.25) return "Suelo";
    if (ucs <= 1.0) return "R0";
    if (ucs <= 5.0) return "R1";
    if (ucs <= 25.0) return "R2";
    if (ucs <= 50.0) return "R3";
    if (ucs <= 100.0) return "R4";
    if (ucs <= 250.0) return "R5";
    return "R6";
  };

  const handleCellChange = (rowIdx: number, key: string, value: any) => {
    const updated = [...ensayos_plt];
    const row = { ...updated[rowIdx] } as any;

    // --- RECONOCIMIENTO DE CAMPOS VACÍOS ---
    if (value === '-1' || value === -1 || value === '') {
      if (key === 'fecha') value = collar.fecha_registro || '';
      else if (['tipo_de_ensayo', 'diametro_taladro_nominacion', 'tipo_rotura_code', 'direccion_rotura_code', 'litologia_1', 'litologia_2', 'litologia_3'].includes(key)) value = '-1';
      else value = -1; // Permitir que los campos numéricos se guarden como -1 (Sin dato)
    }

    // --- VALIDACIÓN DE LÍMITES MÍNIMOS EN JAVASCRIPT ---
    const numericKeys = [
      'nro_caja', 'corrida_desde', 'corrida_hasta', 'from_m', 'to_m',
      'este_m', 'norte_m', 'elevacion_msnm', 'd_mm', 'p_instr_kn'
    ];

    if (numericKeys.includes(key)) {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        value = parsed < -1 ? -1 : parsed;
      } else {
        value = -1; // Forzar a -1 si se borra o hay un error de parseo
      }
    }

    row[key] = value;

    // A. CO-SINCRONIZACIÓN DE DIÁMETRO DE TALADRO <-> D (MM)
    if (key === 'diametro_taladro_nominacion') {
      const nominal = NOMINAL_DIAMETERS[value as string];
      if (nominal) row.d_mm = nominal;
    } else if (key === 'd_mm') {
      const valNum = parseFloat(value) || 0;
      const closestCode = Object.entries(NOMINAL_DIAMETERS).find(([_, v]) => Math.abs(v - valNum) < 0.2);
      if (closestCode) row.diametro_taladro_nominacion = closestCode[0];
    }

    // B. CÁLCULO DE INTERVALOS, METRAJES Y AUTOCOMPLETADO INTELIGENTE DESDE LGG [2]
    if (key === 'from_m' || key === 'to_m' || key === 'corrida_desde' || key === 'corrida_hasta') {
      let from = parseFloat(key === 'from_m' ? value : row.from_m) || 0;
      let to = parseFloat(key === 'to_m' ? value : row.to_m) || 0;
      let c_desde = parseFloat(key === 'corrida_desde' ? value : row.corrida_desde) || 0;
      let c_hasta = parseFloat(key === 'corrida_hasta' ? value : row.corrida_hasta) || 0;

      // Autocompletado inteligente desde LGG al escribir From/To
      if (key === 'from_m' || key === 'to_m') {
        const match = corridas.find(c => c.de <= from && to <= c.a);
        if (match) {
          c_desde = match.de;
          c_hasta = match.a;
          row.corrida_desde = match.de;
          row.corrida_hasta = match.a;

          // Sugerencia automática de litologías de LGG [2]
          row.litologia_1 = match.lito1;
          row.litologia_2 = match.lito2 === "-1" ? "-" : match.lito2;
          row.litologia_3 = match.lito3 === "-1" ? "-" : match.lito3;

          // Se resuelve la cascada geomecánica con estas litologías sugeridas
          const resCascade = resolveLithologyCascade(row.litologia_1, row.litologia_2, row.litologia_3, 'litologia_1', row.litologia_1);
          row.litologia_1 = resCascade.lito1;
          row.litologia_2 = resCascade.lito2;
          row.litologia_3 = resCascade.lito3;
          row.tipo_litologico = resCascade.clase;
          row.factor_k = resCascade.k;
        }
      }

      row.long_de_muestra_mm = parseFloat(((to - from) * 1000).toFixed(1));
      row.long_de_corrida_m = parseFloat((c_hasta - c_desde).toFixed(2));

      // Verif. corrida -> Corrida Desde <= From <= To <= Corrida Hasta
      row.verif_corrida = (c_desde <= from && from <= to && to <= c_hasta) ? "OK" : "Error";
    }

    // C. CASCADA DE LITOLOGÍAS (ENFOQUE DE LIDERAZGO DE MAYOR NÚMERO)
    if (key === 'litologia_1' || key === 'litologia_2' || key === 'litologia_3') {
      const resCascade = resolveLithologyCascade(
        key === 'litologia_1' ? value : (row.litologia_1 || 'MZB'),
        key === 'litologia_2' ? value : (row.litologia_2 || 'MZB'),
        key === 'litologia_3' ? value : (row.litologia_3 || 'MZB_EQ'),
        key,
        value
      );
      row.litologia_1 = resCascade.lito1;
      row.litologia_2 = resCascade.lito2;
      row.litologia_3 = resCascade.lito3;
      row.tipo_litologico = resCascade.clase;
      row.factor_k = resCascade.k;
    }

    // D. CÁLCULOS MATEMÁTICOS DEL ENSAYO PLT (CÁLCULO CON PRECISIÓN ABSOLUTA)
    const d = cleanNum(row.d_mm);
    const p = cleanNum(row.p_instr_kn);
    const long_muestra = cleanNum(row.long_de_muestra_mm);

    // Verif. de longitud -> Long. de Muestra (mm) > D (mm)
    row.verif_de_longitud = (long_muestra > d && d > 0) ? "OK" : "Error";

    if (d > 0 && p > 0) {
      // 1. Calcular valores intermedios brutos (Doble Precisión de JS)
      const is_raw = (p * 1000) / (d * d);              // 3.8626222...
      const fact_corr_raw = Math.pow(d / 50.0, 0.45);   // 1.0938676...
      const is_50_raw = is_raw * fact_corr_raw;          // 4.2252115...
      const k = parseFloat(row.factor_k as any) || 10.0; // 13.34
      const ucs_raw = is_50_raw * k;                     // 56.3643...

      // 2. Redondear ÚNICAMENTE al guardar/mostrar en las celdas
      row.is_mpa = parseFloat(is_raw.toFixed(2));              // Muestra: 3.86
      row.fact_corr = parseFloat(fact_corr_raw.toFixed(3));    // Muestra: 1.094

      // Is(50) calculado con precisión absoluta ahora da exactamente 4.23 (4.2252... redondeado arriba)
      row.is_50_mpa = parseFloat(is_50_raw.toFixed(2));        // Muestra: 4.23 (¡Corregido!)

      // UCS calculado con precisión absoluta da 56.36 (o 56.39 si el diámetro real medido tuviese decimales ocultos)
      row.ucs = parseFloat(ucs_raw.toFixed(2));                // Muestra: 56.36
      row.isrm_indice_r = resolveIsrmIndex(row.ucs);
    } else {
      row.is_mpa = 0.0;
      row.fact_corr = 0.0;
      row.is_50_mpa = 0.0;
      row.ucs = 0.0;
      row.isrm_indice_r = 'R0';
    }

    updated[rowIdx] = row as any;
    onEnsayosPltChange(updated);
  };

  const addRow = () => {
    const lastRow = ensayos_plt[ensayos_plt.length - 1];
    const newIdx = ensayos_plt.length + 1;
    const newRow: EnsayoPlt = {
      fecha: lastRow ? lastRow.fecha : (collar.fecha_registro || new Date().toISOString().split('T')[0]),
      nro_muestra: `M${newIdx.toString().padStart(2, '0')}`,
      nro_caja: lastRow ? lastRow.nro_caja : 1,
      from_m: lastRow ? lastRow.to_m : 0.0,
      to_m: lastRow ? lastRow.to_m + 0.15 : 0.15,
      verif_corrida: 'OK',
      long_de_corrida_m: 1.5,
      este_m: collar.collar_este || 0.0,
      norte_m: collar.collar_norte || 0.0,
      elevacion_msnm: collar.collar_cota || 0.0,
      long_de_muestra_mm: 150.0,
      tipo_de_ensayo: 'D',
      diametro_taladro_nominacion: lastRow ? lastRow.diametro_taladro_nominacion : 'HQ',
      d_mm: lastRow ? lastRow.d_mm : 61.1,
      verif_de_longitud: 'OK',
      p_instr_kn: 0.0,
      tipo_rotura_code: 'M',
      direccion_rotura_code: 'NA',
      ejecutadoPor: lastRow ? lastRow.ejecutadoPor : 'CBA',
      is_mpa: 0.0,
      fact_corr: 1.094,
      is_50_mpa: 0.0,
      factor_k: 8.29,
      ucs: 0.0,
      isrm_indice_r: 'R0',
      observaciones: '',
      corrida_desde: lastRow ? lastRow.corrida_desde : 0.0,
      corrida_hasta: lastRow ? lastRow.corrida_hasta : 1.5,
      litologia_1: 'MZB',
      litologia_2: 'MZB',
      litologia_3: 'MZB_EQ',
      tipo_litologico: 'Intrusivas'
    };

    onEnsayosPltChange([...ensayos_plt, newRow]);

    setTimeout(() => {
      const nextId = `plt-cell-${ensayos_plt.length}-nro_muestra`;
      const el = document.getElementById(nextId) as HTMLInputElement;
      if (el) { el.focus(); el.select(); }
    }, 100);
  };

  const deleteRow = (rowIdx: number) => {
    const updated = ensayos_plt.filter((_, idx) => idx !== rowIdx);
    onEnsayosPltChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colKey: string) => {
    const colIndex = ALL_COL_KEYS.indexOf(colKey);
    if (colIndex === -1) return;

    let targetRow = rowIdx;
    let targetColIndex = colIndex;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetRow = Math.max(0, rowIdx - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      targetRow = Math.min(ensayos_plt.length - 1, rowIdx + 1);
    } else if (e.key === 'ArrowLeft') {
      const target = e.target as HTMLInputElement;
      if (e.currentTarget.tagName === 'SELECT' || target.selectionStart === 0) {
        e.preventDefault();
        targetColIndex = Math.max(0, colIndex - 1);
      } else return;
    } else if (e.key === 'ArrowRight') {
      const target = e.target as HTMLInputElement;
      if (e.currentTarget.tagName === 'SELECT' || target.selectionEnd === target.value.length) {
        e.preventDefault();
        targetColIndex = Math.min(ALL_COL_KEYS.length - 1, colIndex + 1);
      } else return;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (colIndex === ALL_COL_KEYS.length - 1) {
        addRow();
        return;
      } else {
        targetColIndex = colIndex + 1;
      }
    } else {
      return;
    }

    const nextColKey = ALL_COL_KEYS[targetColIndex];
    const nextElementId = `plt-cell-${targetRow}-${nextColKey}`;

    setTimeout(() => {
      const element = document.getElementById(nextElementId) as HTMLInputElement | HTMLSelectElement;
      if (element) {
        element.focus();
        if (element.tagName === 'INPUT') (element as HTMLInputElement).select();
      }
    }, 10);
  };

  const handleAlertFix = (fieldId: string) => {
    setActiveSubTab('plt');
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        if (el.tagName === 'INPUT') {
          (el as HTMLInputElement).select();
        }
      }
    }, 100);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none space-y-4">

      {/* Sub-Pestañas Superiores */}
      <div className="flex border-b border-navy-850 dark:border-navy-800 shrink-0">
        <button
          onClick={() => setActiveSubTab('plt')}
          className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'plt'
            ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
        >
          Registro de Ensayos PLT
        </button>
        <button
          onClick={() => setActiveSubTab('dashboard')}
          className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'dashboard'
            ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
        >
          Dashboard de Resultados
        </button>
        <button
          onClick={() => setActiveSubTab('qaqc')}
          className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'qaqc'
            ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
        >
          Análisis QA/QC PLT
        </button>
      </div>

      {activeSubTab === 'plt' ? (
        <>
          {/* Panel Superior */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
                  Registro de Ensayos PLT (Point Load Test)
                </h2>
                <p className="text-xs text-slate-400">
                  Ensayos de carga puntual diametral, axial e irregular para determinación del UCS e índice ISRM
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-navy-900/40 border border-navy-800 rounded-lg px-2.5 py-1.5">
                <Keyboard size={14} className="text-blue-500 dark:text-cyan-400" />
                <span>Navega con flechas, Enter avanza/crea fila</span>
              </div>

              <button
                onClick={addRow}
                className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500/10 dark:border dark:border-cyan-500/30 dark:hover:bg-cyan-500/20 text-white dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 border border-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-none"
              >
                <Plus size={14} />
                <span>Agregar Ensayo</span>
              </button>

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

          {/* Grid Container */}
          <div
            ref={gridContainerRef}
            className="flex-1 overflow-auto rounded-xl border border-navy-800/50 bg-navy-950/65 shadow-2xl relative"
          >
            <table className="w-full border-separate border-spacing-0 text-left text-xs font-medium text-slate-300 table-fixed">
              <thead className="sticky top-0 z-30">
                <tr className="bg-navy-900 text-slate-400 font-bold uppercase tracking-wider h-11">
                  <th className="sticky left-0 z-40 bg-navy-900 border-b border-r border-navy-800 text-center py-3.5 px-2 w-[50px] shrink-0" style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800))' }}>#</th>
                  <th className="sticky left-[50px] z-40 bg-navy-900 border-b border-r border-navy-800 py-3.5 px-2 w-[80px] shrink-0 text-center" style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800))' }}>Campaña</th>
                  <th className="sticky left-[130px] z-40 bg-navy-900 border-b border-r border-navy-800 py-3.5 px-2 w-[110px] shrink-0" style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800))' }}>Fecha</th>
                  <th className="sticky left-[240px] z-40 bg-navy-900 border-b border-r border-navy-800 py-3.5 px-2 w-[100px] shrink-0" style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 1px 0 0 0 rgb(var(--navy-800))' }}>Taladro</th>
                  <th className="sticky left-[340px] z-40 bg-navy-900 border-b border-r border-navy-800 py-3.5 px-2 w-[100px] shrink-0" style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 1px 0 0 0 rgb(var(--navy-800))' }}>Nro Muestra</th>

                  {DYNAMIC_COLUMNS.map(col => (
                    <th
                      key={col.key}
                      className="border-b border-r border-navy-800 py-3.5 px-2 shrink-0 relative align-middle"
                      style={getHeaderStyle(col.key, col.defaultWidth)}
                    >
                      {col.label}
                      <div onMouseDown={(e) => handleMouseDown(e, col.key)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-40" />
                    </th>
                  ))}
                  <th className="sticky right-0 z-40 bg-navy-900 border-b border-l border-navy-800 py-3.5 px-2 w-[60px] shrink-0 text-center" style={{ boxShadow: 'inset 1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800))' }}>Elim.</th>
                </tr>
              </thead>
              <tbody>
                {ensayos_plt.map((plt, rowIdx) => {
                  const campaignVal = collar.name ? collar.name.match(/\d+/)?.[0] || '2026' : '2026';

                  // --- RECONCILIACIÓN EN TIEMPO DE RENDERIZADO PARA EVITAR VALORES EN CERO HEREDADOS ---
                  const matchingCorrida = corridas.find(c => c.de <= (plt.from_m || 0) && (plt.to_m || 0) <= c.a);

                  return (
                    <tr key={rowIdx} className="hover:bg-navy-900/10 h-10 group transition-all duration-150 border-b border-navy-900">
                      <td className="sticky left-0 z-20 bg-navy-950 border-r border-navy-900 text-center shrink-0 w-[50px] font-bold text-blue-600 dark:text-cyan-400" style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-900)), 1px 0 0 0 rgb(var(--navy-900))' }}>
                        {rowIdx + 1}
                      </td>
                      <td className="sticky left-[50px] z-20 bg-navy-950 border-r border-navy-900 shrink-0 w-[80px] text-center text-slate-500 font-bold select-all" style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-900)), 1px 0 0 0 rgb(var(--navy-900))' }}>
                        {campaignVal}
                      </td>
                      <td className="sticky left-[130px] z-20 bg-navy-950 border-r border-navy-900 shrink-0 w-[110px] p-0" style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-900)), 1px 0 0 0 rgb(var(--navy-900))' }}>
                        <input
                          id={`plt-cell-${rowIdx}-fecha`}
                          type="date"
                          value={plt.fecha || ''}
                          onChange={(e) => handleCellChange(rowIdx, 'fecha', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, 'fecha')}
                          className="w-full h-full px-2.5 bg-transparent border-0 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="sticky left-[240px] z-20 bg-navy-950 border-r border-navy-900 shrink-0 w-[100px] text-center text-slate-400 font-bold truncate px-2 select-all" style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-900)), 1px 0 0 0 rgb(var(--navy-900))' }}>
                        {collar.name || 'TALADRO'}
                      </td>
                      <td className="sticky left-[340px] z-20 bg-navy-950 border-r border-navy-900 shrink-0 w-[100px] p-0" style={{ boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-900)), 1px 0 0 0 rgb(var(--navy-900))' }}>
                        <input
                          id={`plt-cell-${rowIdx}-nro_muestra`}
                          type="text"
                          value={plt.nro_muestra || ''}
                          onChange={(e) => handleCellChange(rowIdx, 'nro_muestra', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, 'nro_muestra')}
                          className="w-full h-full px-2.5 bg-transparent border-0 text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      {DYNAMIC_COLUMNS.map((col) => {
                        let val = plt[col.key as keyof EnsayoPlt];
                        const tdStyle = getCellTdStyle(rowIdx, col.key);

                        // Reconciliación dinámica en tiempo de renderizado para evitar valores en cero heredados
                        if (col.key === 'corrida_desde' && (val === 0 || !val)) {
                          val = matchingCorrida ? matchingCorrida.de : 0;
                        } else if (col.key === 'corrida_hasta' && (val === 0 || !val)) {
                          val = matchingCorrida ? matchingCorrida.a : 0;
                        } else if (col.key === 'long_de_corrida_m' && (val === 0 || !val)) {
                          val = matchingCorrida ? parseFloat((matchingCorrida.a - matchingCorrida.de).toFixed(2)) : 0;
                        } else if (col.key === 'verif_corrida' && (!val || val === 'Error')) {
                          val = matchingCorrida ? 'OK' : 'Error';
                        }

                        return (
                          <td
                            key={col.key}
                            className={`border-r border-navy-900 p-0 relative ${tdStyle.className}`}
                            style={tdStyle.style}
                          >
                            {col.key.startsWith('litologia_') ? (
                              <div className="w-full h-full flex items-center p-1">
                                <select
                                  id={`plt-cell-${rowIdx}-${col.key}`}
                                  value={val === undefined || val === null || val === '-1' || val === '' ? '-1' : String(val)}
                                  onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, rowIdx, col.key)}
                                  className="w-full h-full bg-transparent px-2 text-current border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-center cursor-pointer"
                                  style={getLithologyStyle(val as string)}
                                >
                                  <option value="-1" className={darkMode ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>S/D</option>
                                  {col.options?.map(opt => (
                                    <option key={opt} value={opt} className={darkMode ? "bg-navy-950 text-slate-200" : "bg-white text-slate-800"}>{opt}</option>
                                  ))}
                                </select>
                              </div>
                            ) : ['verif_corrida', 'verif_de_longitud'].includes(col.key) ? (
                              <div className="flex items-center justify-center w-full h-full">
                                {val === 'OK' ? (
                                  <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                                    <Check size={14} className="stroke-[3]" />
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="Inconsistencia física detectada">
                                    <X size={14} className="stroke-[3]" />
                                  </span>
                                )}
                              </div>
                            ) : col.editable ? (
                              col.type === 'select' ? (
                                <select
                                  id={`plt-cell-${rowIdx}-${col.key}`}
                                  value={val === undefined || val === null ? '-1' : String(val)}
                                  onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, rowIdx, col.key)}
                                  className="w-full h-full bg-transparent px-2 text-current border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-center cursor-pointer appearance-none animate-none"
                                >
                                  <option value="-1" className={darkMode ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>S/D</option>
                                  {col.options?.map(opt => (
                                    <option key={opt} value={opt} className={darkMode ? "bg-navy-950 text-slate-200" : "bg-white text-slate-800"}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  id={`plt-cell-${rowIdx}-${col.key}`}
                                  type={col.type}
                                  min={col.type === 'number' ? "-1" : undefined}
                                  value={val === undefined || val === null || val === -1 || val === '-1' ? '' : val}
                                  onChange={(e) => {
                                    handleCellChange(rowIdx, col.key, e.target.value);
                                  }}
                                  onKeyDown={(e) => handleKeyDown(e, rowIdx, col.key)}
                                  className={`w-full h-full px-2.5 bg-transparent border-0 text-current focus:outline-none focus:ring-1 focus:ring-blue-500 ${col.type === 'number' ? 'text-center font-semibold' : ''}`}
                                />
                              )
                            ) : (
                              <div className={`px-2.5 py-1.5 truncate text-center w-full h-full flex items-center justify-center font-medium select-none ${col.key === 'isrm_indice_r' ? (['R4', 'R5', 'R6'].includes(String(val)) ? 'text-orange-400 font-black' : 'text-slate-400') : 'text-slate-400'}`}>
                                {col.key === 'fact_corr' && typeof val === 'number' ? val.toFixed(2) : val}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      <td className="sticky right-0 z-20 bg-navy-950 border-l border-navy-900 text-center py-1 w-[60px]" style={{ boxShadow: 'inset 1px 0 0 0 rgb(var(--navy-900)), -1px 0 0 0 rgb(var(--navy-900))' }}>
                        <button
                          onClick={() => deleteRow(rowIdx)}
                          className="p-1.5 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 shadow-sm active:scale-90 flex items-center justify-center mx-auto"
                          title="Eliminar Ensayo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {ensayos_plt.length === 0 && (
                  <tr>
                    <td colSpan={100} className="py-12 text-center text-slate-500 text-sm">
                      <FileSpreadsheet size={40} className="mx-auto mb-2 text-slate-500/20" />
                      <p className="font-semibold text-slate-400">Sin ensayos PLT registrados</p>
                      <p className="text-xs mt-0.5 mb-3">Registra los tramos de carga axial y diametral pulsando el botón superior.</p>
                      <button
                        onClick={addRow}
                        className="mx-auto bg-navy-800 hover:bg-navy-700 text-cyan-400 font-bold px-4 py-2 rounded-lg border border-navy-700 active:scale-95 transition-all text-xs"
                      >
                        Agregar Muestra
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <ExcelImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            activeTaladroName={collar.name || ''}
            importType="PLT"
            onImport={(importedRows) => {
              if (onImportExcel) {
                onImportExcel(importedRows);
              }
            }}
          />
        </>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1 scrollbar-thin">
          {activeSubTab === 'dashboard' ? (
            <QaqcPltDashboardPanel
              ensayos_plt={ensayos_plt}
              alerts={alerts}
              onSwitchTab={setActiveSubTab}
              darkMode={darkMode}
            />
          ) : (
            <QaqcPltAnalysisPanel
              ensayos_plt={ensayos_plt}
              alerts={alerts}
              onFocusField={handleAlertFix}
              onSwitchTab={setActiveSubTab}
              darkMode={darkMode}
            />
          )}
        </div>
      )}

    </div>
  );
}