import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus,
  Trash2,
  Check,
  X,
  Search,
  RotateCcw,
  FileSpreadsheet,
  Database,
  Upload,
  Download,
  Edit,
  Ruler,
  Layers,
  Shield
} from 'lucide-react';
import type { ValidationAlert } from '../../utils/qaqcValidator';
import { calculateRowRmr } from '../../utils/formulaEngine';
import {
  LITHOLOGY_CATALOG,
  resolveLithologyCascade,
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
import ExcelImportModal from './ExcelImportModal';
import QaqcAnalysisPanel from './QaqcAnalysisPanel';

interface Corrida {
  corrida: number;
  de: number;
  a: number;
  rec_m: number;
  rqd_m: number;
  lrf_m: number;
  small_frag_m: number;
  mec_frac: number;
  lito1: string;
  lito2?: string;
  lito3?: string;
  resistencia: string;
  orientacion: string;
  offset?: number;
  tipo_est1: string;
  tipo_est2?: string;
  frac_nat: number;
  frac_buz30: number;
  frac_buz60: number;
  frac_buz90: number;
  abertura: number;
  rugosidad: number;
  jrc10: number;
  intemperismo: string;
  relleno1: string;
  relleno2?: string;
  espesor: number;
  agua_obs: string;
  turno?: string;
  comentarios?: string;
}

interface DataGridLGGProps {
  corridas: Corrida[];
  alerts: ValidationAlert[];
  onCorridasChange: (corridas: Corrida[]) => void;
  selectedRowIndex: number | null;
  onSelectRow: (index: number) => void;
  waterTableM: number;
  darkMode?: boolean;
  activeTaladroName: string;
  sidebarCollapsed?: boolean;
  onFocusField?: (fieldId: string) => void;
  onImportExcel?: (importedRows: Corrida[], createNewWithName?: string) => void;
  onCreateTaladro?: (newTaladro: any) => void;
  onRenameTaladro?: (newName: string) => void;
  syncStatus?: string;
  defaultTurno?: string;
}

const LITO_OPTIONS = Object.keys(LITHOLOGY_CATALOG);

const getLitoOptionLabel = (opt: string) => {
  if (opt === "-1" || opt === "-") return "Ninguna";
  const cleanOpt = opt.toUpperCase().replace(/[_-\s/]/g, "");
  const foundKey = Object.keys(LITHOLOGY_CATALOG).find(k => k.toUpperCase().replace(/[_-\s/]/g, "") === cleanOpt);
  if (foundKey) {
    return `${opt} - ${LITHOLOGY_CATALOG[foundKey].name}`;
  }
  return opt;
};



const EDITABLE_COLS: (keyof Corrida)[] = [
  'de', 'a', 'rec_m', 'rqd_m', 'lrf_m', 'small_frag_m', 'mec_frac',
  'frac_nat', 'lito1', 'lito2', 'lito3', 'resistencia', 'orientacion', 'offset',
  'tipo_est1', 'tipo_est2', 'frac_buz30', 'frac_buz60', 'frac_buz90',
  'abertura', 'rugosidad', 'jrc10', 'intemperismo', 'relleno1', 'relleno2',
  'espesor', 'agua_obs', 'turno', 'comentarios'
];

interface ExportField {
  key: string;
  label: string;
  isCheck: boolean;
  group: string;
}

const EXPORT_FIELDS: ExportField[] = [
  { key: 'corrida', label: '#', isCheck: false, group: 'Intervalo y Perforación' },
  { key: 'taladro', label: 'Taladro', isCheck: false, group: 'Intervalo y Perforación' },
  { key: 'de', label: 'de: (m)', isCheck: false, group: 'Intervalo y Perforación' },
  { key: 'a', label: 'a: (m)', isCheck: false, group: 'Intervalo y Perforación' },
  { key: 'perf', label: 'Perf. (m)', isCheck: false, group: 'Intervalo y Perforación' },
  { key: 'check_perf_lr', label: 'Perf./LR', isCheck: true, group: 'Intervalo y Perforación' },
  { key: 'rec_m', label: 'Longitud Recuper. (m)', isCheck: false, group: 'Físico y Recuperación' },
  { key: 'rqd_m', label: '(RQD) Σ Frag\'s ≥ 10cm (m)', isCheck: false, group: 'Físico y Recuperación' },
  { key: 'lrf_m', label: 'Long. Roca Fract. (m)', isCheck: false, group: 'Físico y Recuperación' },
  { key: 'small_frag_m', label: 'Σ Frag\'s < 10cm (m)', isCheck: false, group: 'Físico y Recuperación' },
  { key: 'sum_control', label: 'Σ RQD + LRF + Σ Frag\'s < 10cm (m)', isCheck: false, group: 'Físico y Recuperación' },
  { key: 'check_lr_rqd_lrf', label: 'LR/RQD + LRF', isCheck: true, group: 'Físico y Recuperación' },
  { key: 'lito1', label: 'LITO 1', isCheck: false, group: 'Geología y Alteración' },
  { key: 'lito2', label: 'LITO 2', isCheck: false, group: 'Geología y Alteración' },
  { key: 'lito3', label: 'LITO 3', isCheck: false, group: 'Geología y Alteración' },
  { key: 'resistencia', label: 'Resistencia Máxima Estimada (ISRM)', isCheck: false, group: 'Geología y Alteración' },
  { key: 'intemperismo', label: 'Grado Intemp. (ISRM)', isCheck: false, group: 'Geología y Alteración' },
  { key: 'orientacion', label: 'Linea de Orientac.', isCheck: false, group: 'Registro Estructural' },
  { key: 'offset', label: 'Desplaz. 0°-360° (Offset)', isCheck: false, group: 'Registro Estructural' },
  { key: 'tipo_est1', label: 'Tipo Estructura', isCheck: false, group: 'Registro Estructural' },
  { key: 'tipo_est2', label: 'Tipo Estructura 2', isCheck: false, group: 'Registro Estructural' },
  { key: 'mec_frac', label: 'N° Fract. Mecanic.', isCheck: false, group: 'Registro Estructural' },
  { key: 'frf', label: 'FRF', isCheck: false, group: 'Registro Estructural' },
  { key: 'frac_nat', label: 'N° Fract. Naturales', isCheck: false, group: 'Registro Estructural' },
  { key: 'frac_buz30', label: 'N° Fract. Natural. (Buz <30°)', isCheck: false, group: 'Registro Estructural' },
  { key: 'frac_buz60', label: 'N° Fract. Natural. (30°< Buz < 60°)', isCheck: false, group: 'Registro Estructural' },
  { key: 'frac_buz90', label: 'N° Fract. Natural. (Buz > 60°)', isCheck: false, group: 'Registro Estructural' },
  { key: 'sum_frac_nat', label: 'Σ Fract. Natural.', isCheck: false, group: 'Registro Estructural' },
  { key: 'check_fn', label: 'N° FN', isCheck: true, group: 'Registro Estructural' },
  { key: 'abertura', label: 'Abertura (mm)', isCheck: false, group: 'Discontinuidades y Relleno' },
  { key: 'rugosidad', label: 'Rugosidad (ISRM)', isCheck: false, group: 'Discontinuidades y Relleno' },
  { key: 'jrc10', label: 'JRC10', isCheck: false, group: 'Discontinuidades y Relleno' },
  { key: 'check_rug_jrc', label: 'Rug./JRC', isCheck: true, group: 'Discontinuidades y Relleno' },
  { key: 'relleno1', label: 'Tipo Relleno 1', isCheck: false, group: 'Discontinuidades y Relleno' },
  { key: 'relleno2', label: 'Tipo Relleno 2', isCheck: false, group: 'Discontinuidades y Relleno' },
  { key: 'espesor', label: 'Espesor Relleno (mm)', isCheck: false, group: 'Discontinuidades y Relleno' },
  { key: 'check_abert_rell', label: 'Abertura / Relleno', isCheck: true, group: 'Discontinuidades y Relleno' },
  { key: 'agua_obs', label: 'Presencia de Agua (ISRM)', isCheck: false, group: 'Discontinuidades y Relleno' },
  { key: 'geologo', label: 'Geotécnico', isCheck: false, group: 'Administración y Notas' },
  { key: 'fecha', label: 'Fecha', isCheck: false, group: 'Administración y Notas' },
  { key: 'turno', label: 'Turno', isCheck: false, group: 'Administración y Notas' },
  { key: 'comentarios', label: 'Comentarios', isCheck: false, group: 'Administración y Notas' },
  { key: 'rmr76', label: 'RMR\'76', isCheck: false, group: 'Cálculos de RMR' },
  { key: 'rmr89', label: 'RMR\'89', isCheck: false, group: 'Cálculos de RMR' }
];

const EXPORT_GROUPS = [
  'Intervalo y Perforación',
  'Físico y Recuperación',
  'Geología y Alteración',
  'Registro Estructural',
  'Discontinuidades y Relleno',
  'Administración y Notas',
  'Cálculos de RMR'
];

export default function DataGridLGG({
  corridas,
  alerts,
  onCorridasChange,
  selectedRowIndex,
  onSelectRow,
  waterTableM,
  darkMode = true,
  activeTaladroName,
  sidebarCollapsed = false,
  onFocusField,
  onImportExcel,
  onCreateTaladro,
  onRenameTaladro,
  syncStatus: _syncStatus,
  defaultTurno = 'D'
}: DataGridLGGProps) {

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const panelWidthStyle = {
    position: 'sticky' as const,
    left: 0,
    width: sidebarCollapsed ? 'calc(100vw - 4.5rem)' : 'calc(100vw - 20.5rem)',
    maxWidth: sidebarCollapsed ? 'calc(100vw - 4.5rem)' : 'calc(100vw - 20.5rem)',
  };

  const [activeSubTab, setActiveSubTab] = useState<'lgg' | 'qaqc'>('lgg');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // --- CÁLCULOS GEOMECÁNICOS DEL SONDAJE ACTIVO (DASHBOARD) ---
  const safeRowsKpi = corridas || [];
  const totalCorridasKpi = safeRowsKpi.length;
  const totalPerfKpi = safeRowsKpi.reduce((acc, row) => acc + Math.max(0, (row.a - row.de)), 0);
  const firstDeKpi = safeRowsKpi.length > 0 ? Math.min(...safeRowsKpi.map(r => r.de)) : 0;
  const lastAKpi = safeRowsKpi.length > 0 ? Math.max(...safeRowsKpi.map(r => r.a)) : 0;
  const avgRunLengthKpi = totalCorridasKpi > 0 ? (totalPerfKpi / totalCorridasKpi) : 0;

  // Cálculo Promedio Resistencia Estimada (ISRM R0-R6)
  const validStrengths = safeRowsKpi.filter(r => r.resistencia && r.resistencia !== '-1');
  const strengthIndices = validStrengths.map(r => {
    const num = parseInt(r.resistencia.replace('R', ''), 10);
    return isNaN(num) ? null : num;
  }).filter(n => n !== null) as number[];

  const avgRClassKpi = strengthIndices.length > 0
    ? "R" + (strengthIndices.reduce((acc, v) => acc + v, 0) / strengthIndices.length).toFixed(1)
    : "S/D";

  const validStrengthScores = safeRowsKpi
    .map(r => STRENGTH_CATALOG[r.resistencia]?.score)
    .filter(s => s !== undefined) as number[];
  const avgStrengthScoreKpi = validStrengthScores.length > 0
    ? (validStrengthScores.reduce((acc, v) => acc + v, 0) / validStrengthScores.length).toFixed(1)
    : "0.0";

  // Traducción geomecánica de los rangos de resistencia ISRM
  const getISRMClassDescription = (avgClass: string) => {
    if (avgClass === "S/D") return "Sin datos registrados";
    const num = parseFloat(avgClass.replace("R", ""));
    if (isNaN(num)) return "S/D";
    if (num < 1) return "R0: Extr. Blanda (0.25 - 1 MPa)";
    if (num < 2) return "R1: Muy Blanda (1 - 5 MPa)";
    if (num < 3) return "R2: Blanda (5 - 25 MPa)";
    if (num < 4) return "R3: Moderadamente Fuerte (25 - 50 MPa)";
    if (num < 5) return "R4: Fuerte (50 - 100 MPa)";
    if (num < 6) return "R5: Muy Fuerte (100 - 250 MPa)";
    return "R6: Extremadamente Fuerte (>250 MPa)";
  };

  // --- Exportar Excel — Configuración y Proceso ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFieldsConfig, setExportFieldsConfig] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    EXPORT_FIELDS.forEach(f => {
      initial[f.key] = !f.isCheck && f.key !== 'rmr76' && f.key !== 'rmr89';
    });
    return initial;
  });

  const getExportFieldValue = (row: Corrida, idx: number, key: string) => {
    const perf = Number((row.a - row.de).toFixed(2));

    const clean = (val: any, isNumeric = false): any => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val === '-1' || val.trim() === '')) return '';
      if (isNumeric && (val === -1 || val === '-1')) return '';
      return val;
    };

    const safeSumVal = (v: any) => {
      const num = parseFloat(v);
      return isNaN(num) || num < 0 ? 0 : num;
    };
    const safeSumInt = (v: any) => {
      const val = parseInt(v);
      return isNaN(val) || val < 0 ? 0 : val;
    };

    const sRqd = safeSumVal(row.rqd_m);
    const sLrf = safeSumVal(row.lrf_m);
    const sSmall = safeSumVal(row.small_frag_m);
    const sRec = safeSumVal(row.rec_m);
    const sumControlVal = parseFloat((sRqd + sLrf + sSmall).toFixed(2));

    const errPerfLr = parseFloat(sRec.toFixed(2)) > parseFloat(perf.toFixed(2));
    const errLrRqdLrf = sumControlVal > parseFloat(perf.toFixed(2)) || sRqd > sRec;

    const sBuz30 = safeSumInt(row.frac_buz30);
    const sBuz60 = safeSumInt(row.frac_buz60);
    const sBuz90 = safeSumInt(row.frac_buz90);
    const sFracNat = safeSumInt(row.frac_nat);
    const errFn = (sBuz30 + sBuz60 + sBuz90) !== sFracNat;

    const errRugJrc = false;
    const sEspesor = safeSumVal(row.espesor);
    const sAbertura = safeSumVal(row.abertura);
    const errAbertRell = (sEspesor > 0 && sAbertura <= 0) || (sEspesor === 0 && sAbertura > 0);

    const rmrRes = calculateRowRmr(row, waterTableM);

    switch (key) {
      case 'corrida': return row.corrida;
      case 'taladro': return lastRowTaladroName(idx);
      case 'de': return row.de;
      case 'a': return row.a;
      case 'perf': return perf;
      case 'check_perf_lr': return errPerfLr ? '✘' : '✔';
      case 'rec_m': return clean(row.rec_m, true);
      case 'rqd_m': return clean(row.rqd_m, true);
      case 'lrf_m': return clean(row.lrf_m, true);
      case 'small_frag_m': return clean(row.small_frag_m, true);
      case 'sum_control': return sumControlVal;
      case 'check_lr_rqd_lrf': return errLrRqdLrf ? '✘' : '✔';
      case 'mec_frac': return clean(row.mec_frac, true);
      case 'frf': return row.lrf_m > 0 ? Math.floor(Math.round(row.lrf_m * 100) / 5) + 1 : 0;
      case 'frac_nat': return clean(row.frac_nat, true);
      case 'lito1': return clean(row.lito1);
      case 'lito2': return clean(row.lito2);
      case 'lito3': return clean(row.lito3);
      case 'resistencia': return clean(row.resistencia);
      case 'orientacion': return clean(row.orientacion);
      case 'offset': return clean(row.offset, true);
      case 'tipo_est1': return clean(row.tipo_est1);
      case 'tipo_est2': return clean(row.tipo_est2);
      case 'frac_buz30': return clean(row.frac_buz30, true);
      case 'frac_buz60': return clean(row.frac_buz60, true);
      case 'frac_buz90': return clean(row.frac_buz90, true);
      case 'sum_frac_nat': return sBuz30 + sBuz60 + sBuz90;
      case 'check_fn': return errFn ? '✘' : '✔';
      case 'abertura': return clean(row.abertura, true);
      case 'rugosidad': return clean(row.rugosidad, true);
      case 'jrc10': return clean(row.jrc10, true);
      case 'check_rug_jrc': return errRugJrc ? '✘' : '✔';
      case 'intemperismo': return clean(row.intemperismo);
      case 'relleno1': return clean(row.relleno1);
      case 'relleno2': return clean(row.relleno2);
      case 'espesor': return clean(row.espesor, true);
      case 'check_abert_rell': return errAbertRell ? '✘' : '✔';
      case 'agua_obs': return clean(row.agua_obs);
      case 'geologo': return row.turno ? lastRowGeologo(idx) : 'RD/RB';
      case 'fecha': return lastRowFecha(idx);
      case 'turno': return clean(row.turno);
      case 'comentarios': return clean(row.comentarios);
      case 'rmr76': return rmrRes.error || rmrRes.rmr_76 === undefined ? 'ERR' : rmrRes.rmr_76;
      case 'rmr89': return rmrRes.error || rmrRes.rmr_89 === undefined ? 'ERR' : rmrRes.rmr_89;
      default: return '';
    }
  };

  const performExportExcel = () => {
    if (!corridas || corridas.length === 0) {
      alert('No hay datos en la tabla para exportar.');
      return;
    }

    const activeFields = EXPORT_FIELDS.filter(f => exportFieldsConfig[f.key]);
    if (activeFields.length === 0) {
      alert('Debe seleccionar al menos un campo para exportar.');
      return;
    }

    const rows = corridas.map((row, idx) => {
      const rowData: Record<string, any> = {};
      activeFields.forEach(f => {
        rowData[f.label] = getExportFieldValue(row, idx, f.key);
      });
      return rowData;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    const colWidths = activeFields.map((f) => {
      const headerLabel = f.label;
      const pixelWidth = widths[f.key] || 90;
      const charWidthFromUi = Math.max(8, Math.round(pixelWidth / 8.5));
      const maxContentLen = corridas.reduce((acc, r, idx) => {
        const val = String(getExportFieldValue(r, idx, f.key) ?? '');
        return Math.max(acc, val.length);
      }, 0);
      return { wch: Math.max(headerLabel.length, charWidthFromUi, maxContentLen) + 2 };
    });
    ws['!cols'] = colWidths;
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const sheetName = activeTaladroName.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'LGG');

    const getClasificacionRelleno = (relleno: string) => {
      if (!relleno || relleno === "cwf") return 3;
      if (["FBX", "QZ", "SIO", "SU", "OX", "ep"].includes(relleno)) return 2;
      return 1;
    };

    const rmrRows = corridas.map((row, idx) => {
      const rmrRes = calculateRowRmr(row, waterTableM);
      const isErr = !!rmrRes.error;
      const sc = (rmrRes as any).scores || {};

      const lrf_m = parseFloat(row.lrf_m as any) || 0;
      const frf = lrf_m > 0 ? Math.floor(Math.round(lrf_m * 100) / 5) + 1 : 0;
      const frac_nat = parseInt(row.frac_nat as any) || 0;
      const total_frac = frac_nat + frf;

      const p_de = parseFloat(row.de as any) || 0;
      const p_a = parseFloat(row.a as any) || 0;
      const perf = Number((p_a - p_de).toFixed(2));

      return {
        'Sondaje': lastRowTaladroName(idx),
        'Fecha': lastRowFecha(idx),
        'Logueador': lastRowGeologo(idx),
        'Corrida': row.corrida,
        'Lito 1': row.lito1 || '',
        'Lito 2': row.lito2 || '-1',
        'Lito 3': row.lito3 || '-1',
        'Desde (m)': p_de,
        'Hasta (m)': p_a,
        'Long. Corrida (m)': isErr ? '-' : perf,
        'Rec (m)': parseFloat(row.rec_m as any) || 0,
        'Rec (%)': isErr ? '-' : `${rmrRes.rec_pct}%`,
        'RQD (m)': parseFloat(row.rqd_m as any) || 0,
        'RQD (%)': isErr ? '-' : `${rmrRes.rqd_pct}%`,
        'Long. Tramo fracturado (m)': lrf_m,
        'FRF (zonas trituradas)': frf,
        'Fracturas naturales': frac_nat,
        'Total de Fracturas': isErr ? '-' : total_frac,
        'FF/1m': isErr ? '-' : (perf > 0 ? Math.round(total_frac / perf) : 0),
        'Espaciamiento (mm)': isErr ? '-' : (rmrRes.spacing_mm || 0),
        'Resistencia': row.resistencia || '',
        'Tipo de Estructura': row.tipo_est1 || 'JN',
        'Abertura (mm)': parseFloat(row.abertura as any) || 0,
        'Rugosidad': parseInt(row.rugosidad as any) || 1,
        'Relleno': row.relleno1 || '',
        'Clasificación Relleno': isErr ? '-' : getClasificacionRelleno(row.relleno1 || ''),
        'Intemperismo': row.intemperismo || '',
        'JRC10': parseFloat(row.jrc10 as any) || 0,
        'Espesor de relleno': parseFloat(row.espesor as any) || 0,
        'Presencia de Agua': row.agua_obs || '',
        'Resistencia (R76)': isErr ? '-' : (sc.resistencia ?? 0),
        'RQD (R76)': isErr ? '-' : (sc.rqd ?? 0),
        'Espaciamiento (R76)': isErr ? '-' : (sc.spacing_76 ?? 0),
        'Abertura (R76)': isErr ? '-' : (sc.abertura_76 ?? 0),
        'Rugosidad (R76)': isErr ? '-' : (sc.rugosidad_76 ?? 0),
        'Relleno (R76)': isErr ? '-' : (sc.relleno_76 ?? 0),
        'Intemperismo (R76)': isErr ? '-' : (sc.weathering_76 ?? 0),
        'Persistencia (R76)': isErr ? '-' : (sc.persistencia_76 ?? 0),
        'Condición de Juntas (R76)': isErr ? '-' : (sc.juntas_76 ?? 0),
        'Presencia de Agua (R76)': isErr ? '-' : (sc.agua_76 ?? 0),
        'RMR\'76': isErr ? 'ERR' : (rmrRes.rmr_76 ?? 0),
        'CALIDAD DE ROCA (R76)': isErr ? 'ERROR' : (rmrRes.class_76 ?? ''),
        'Resistencia (R89)': isErr ? '-' : (sc.resistencia ?? 0),
        'RQD (R89)': isErr ? '-' : (sc.rqd ?? 0),
        'Espaciamiento (R89)': isErr ? '-' : (sc.spacing_89 ?? 0),
        'Abertura (R89)': isErr ? '-' : (sc.abertura_89 ?? 0),
        'Rugosidad (R89)': isErr ? '-' : (sc.rugosidad_89 ?? 0),
        'Relleno (R89)': isErr ? '-' : (sc.relleno_89 ?? 0),
        'Intemperismo (R89)': isErr ? '-' : (sc.weathering_89 ?? 0),
        'Persistencia (R89)': isErr ? '-' : (sc.persistencia_89 ?? 0),
        'Condición de Juntas (R89)': isErr ? '-' : (sc.juntas_89 ?? 0),
        'Presencia de Agua (R89)': isErr ? '-' : (sc.agua_89 ?? 0),
        'RMR\'89': isErr ? 'ERR' : (rmrRes.rmr_89 ?? 0),
        'CALIDAD DE ROCA (R89)': isErr ? 'ERROR' : (rmrRes.class_89 ?? '')
      };
    });

    const wsRmr = XLSX.utils.json_to_sheet(rmrRows);

    if (rmrRows.length > 0) {
      const colWidthsRmr = Object.keys(rmrRows[0]).map((key) => {
        const maxContentLen = rmrRows.reduce((acc, r) => {
          const val = String((r as any)[key] ?? '');
          return Math.max(acc, val.length);
        }, key.length);
        return { wch: maxContentLen + 2 };
      });
      wsRmr['!cols'] = colWidthsRmr;
    }
    wsRmr['!freeze'] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(wb, wsRmr, 'Validación RMR');

    const fileName = `LGG_${activeTaladroName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    setIsExportModalOpen(false);
  };

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameInput, setRenameInput] = useState(activeTaladroName);

  const [newTaladroName, setNewTaladroName] = useState('');
  const [newProyecto, setNewProyecto] = useState('Proyecto A');
  const [newGeologo, setNewGeologo] = useState('RD/RB');
  const [newDiametro, setNewDiametro] = useState('HQ3');
  const [newInclinacion, setNewInclinacion] = useState(-60.0);
  const [newCampana, setNewCampana] = useState('2026');
  const [newTurno, setNewTurno] = useState('D');

  // const handleCreateNewClick = () => {
  //   if (syncStatus === 'unsaved') {
  //     const confirmProceed = confirm(
  //       `Atención: Hay cambios sin guardar en el taladro activo "${activeTaladroName}". Si creas un nuevo taladro, estos cambios podrían perderse.\n\n¿Deseas continuar de todos modos?`
  //     );
  //     if (!confirmProceed) return;
  //   }
  //   setNewTaladroName('');
  //   const parentGeologo = lastRowGeologo(0) || 'RD/RB';
  //   setNewGeologo(parentGeologo);
  //   setIsCreateModalOpen(true);
  // };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaladroName.trim()) return;

    if (onCreateTaladro) {
      onCreateTaladro({
        name: newTaladroName.trim().toUpperCase(),
        proyecto: newProyecto,
        geologo: newGeologo,
        diametro: newDiametro,
        inclinacion: newInclinacion,
        campana: newCampana,
        fecha_registro: new Date().toISOString().split('T')[0],
        collar_este: 0.0,
        collar_norte: 0.0,
        collar_cota: 0.0,
        turno: newTurno,
        surveys: [],
        corridas: [],
        discontinuidades: [],
        ensayos_plt: []
      });
    }
    setIsCreateModalOpen(false);
  };

  const handleRenameClick = () => {
    setRenameInput(activeTaladroName);
    setIsRenameModalOpen(true);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renameInput.trim().toUpperCase();
    if (!trimmed || trimmed === activeTaladroName) {
      setIsRenameModalOpen(false);
      return;
    }

    if (onRenameTaladro) {
      onRenameTaladro(trimmed);
    }
    setIsRenameModalOpen(false);
  };

  const [filterLito, setFilterLito] = useState<string>('');
  const [filterResistencia, setFilterResistencia] = useState<string>('');
  const [filterRmrClass, setFilterRmrClass] = useState<string>('');
  const [filterGeotecnico, setFilterGeotecnico] = useState<string>('');

  const [focusedCell, setFocusedCell] = useState<{ row: number; field: 'lito1' | 'lito2' | 'lito3'; originalVal: string } | null>(null);
  const [tempValue, setTempValue] = useState<string>("");
  const [isChanged, setIsChanged] = useState<boolean>(false);

  const [appliedFilters, setAppliedFilters] = useState({
    lito: '',
    resistencia: '',
    rmrClass: '',
    geotecnico: ''
  });

  const filteredCorridas = corridas.filter((row) => {
    if (appliedFilters.lito && row.lito1 !== appliedFilters.lito) {
      return false;
    }
    if (appliedFilters.resistencia && row.resistencia !== appliedFilters.resistencia) {
      return false;
    }
    if (appliedFilters.rmrClass) {
      const rmrRes = calculateRowRmr(row, waterTableM);
      if (rmrRes.error || rmrRes.rmr_89 === undefined) {
        return false;
      }
      const rmrClass = rmrRes.rmr_89 >= 81 ? 'Muy Buena' :
        rmrRes.rmr_89 >= 61 ? 'Buena' :
          rmrRes.rmr_89 >= 41 ? 'Regular' :
            rmrRes.rmr_89 >= 21 ? 'Mala' : 'Muy Mala';
      if (rmrClass !== appliedFilters.rmrClass) {
        return false;
      }
    }
    if (appliedFilters.geotecnico) {
      const geotecnicoName = lastRowGeologo(corridas.indexOf(row)).toLowerCase();
      if (!geotecnicoName.includes(appliedFilters.geotecnico.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      lito: filterLito,
      resistencia: filterResistencia,
      rmrClass: filterRmrClass,
      geotecnico: filterGeotecnico
    });
  };

  const handleClearFilters = () => {
    setFilterLito('');
    setFilterResistencia('');
    setFilterRmrClass('');
    setFilterGeotecnico('');
    setAppliedFilters({
      lito: '',
      resistencia: '',
      rmrClass: '',
      geotecnico: ''
    });
  };

  // --- Column Resizing State ---
  const [widths, setWidths] = useState<Record<string, number>>({
    corrida: 70, taladro: 105, de: 85, a: 85, perf: 80, perf_lr: 90,
    rec_m: 90, rqd_m: 90, lrf_m: 90, small_frag_m: 90, sum_control: 90,
    lr_rqd_lrf: 90, mec_frac: 90, frf: 90, frac_nat: 90, lito1: 90,
    lito2: 90, lito3: 90, max_resist: 120, orientacion: 90,
    offset: 90, tipo_est1: 110, tipo_est2: 110, frac_buz30: 90,
    frac_buz60: 90, frac_buz90: 90, sum_frac_nat: 110, alert_fn: 90,
    abertura: 95, rugosidad: 85, jrc10: 85, alert_rug_jrc: 90,
    intemperismo: 110, alert_rest_intep: 100, relleno1: 100, relleno2: 100,
    espesor: 110, alert_abert_rell: 95, agua_obs: 110, geologo: 105,
    fecha: 110, turno: 75, comentarios: 200, rmr76: 80, rmr89: 80
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
    const newWidth = Math.max(60, Math.min(450, startWidth.current + diff));
    setWidths(prev => ({ ...prev, [resizingCol.current!]: newWidth }));
  };

  const handleMouseUp = () => {
    resizingCol.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // --- Handlers ---
  const handleCellChange = (index: number, field: keyof Corrida, value: any) => {
    const updated = [...corridas];
    let row = { ...updated[index] };

    if (field === 'lito1' || field === 'lito2' || field === 'lito3') {
      const resCascade = resolveLithologyCascade(
        field === 'lito1' ? value : (row.lito1 || 'LMT'),
        field === 'lito2' ? value : (row.lito2 || '-1'),
        field === 'lito3' ? value : (row.lito3 || '-1'),
        field,
        value
      );
      row.lito1 = resCascade.lito1;
      row.lito2 = resCascade.lito2 === "-" ? "-1" : resCascade.lito2;
      row.lito3 = resCascade.lito3 === "-" ? "-1" : resCascade.lito3;
    } else {
      let validatedValue = value;

      if (field === 'jrc10') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          if (parsed === -1) validatedValue = -1;
          else if (parsed < 0) validatedValue = 0;
          else if (parsed > 20) validatedValue = 20;
          else validatedValue = parsed;
        } else {
          validatedValue = -1;
        }
      } else if (field === 'rugosidad') {
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
      else {
        const camposMinimoCero: (keyof Corrida)[] = ['de', 'a'];
        const camposMinimoMenosUno: (keyof Corrida)[] = [
          'rec_m', 'rqd_m', 'lrf_m', 'small_frag_m', 'mec_frac', 'frac_nat',
          'frac_buz30', 'frac_buz60', 'frac_buz90', 'abertura', 'espesor', 'offset'
        ];

        if (field === 'offset') {
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
            validatedValue = 0;
          }
        }
        else if (camposMinimoCero.includes(field)) {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            validatedValue = parsed < 0 ? 0 : parsed;
          } else {
            validatedValue = 0;
          }
        } else if (camposMinimoMenosUno.includes(field)) {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            validatedValue = parsed < -1 ? -1 : parsed;
          } else {
            validatedValue = -1;
          }
        }
      }

      row = { ...row, [field]: validatedValue };
    }

    updated[index] = row;
    onCorridasChange(updated);
  };

  const addCorridaRow = () => {
    const lastRow = corridas[corridas.length - 1];
    const newDe = lastRow ? lastRow.a : 0.0;
    const newA = lastRow ? parseFloat((newDe + 1.5).toFixed(2)) : 1.5;

    const newRow: Corrida = {
      corrida: corridas.length + 1,
      de: newDe,
      a: newA,
      rec_m: parseFloat((newA - newDe).toFixed(2)),
      rqd_m: parseFloat((newA - newDe).toFixed(2)),
      lrf_m: 0.0,
      small_frag_m: 0.0,
      mec_frac: 0,
      lito1: lastRow ? lastRow.lito1 : "LMT",
      lito2: "-1",
      lito3: "-1",
      resistencia: lastRow ? lastRow.resistencia : "R4",
      orientacion: "X",
      offset: 0.0,
      tipo_est1: "JN",
      tipo_est2: "-1",
      frac_nat: 0,
      frac_buz30: 0,
      frac_buz60: 0,
      frac_buz90: 0,
      abertura: 0.1,
      rugosidad: 2,
      jrc10: 17,
      intemperismo: "UWF",
      relleno1: "cwf",
      relleno2: "-1",
      espesor: 0.0,
      agua_obs: "CDC",
      turno: defaultTurno,
      comentarios: ""
    };

    onCorridasChange([...corridas, newRow]);
    onSelectRow(corridas.length);
  };

  const deleteCorridaRow = (index: number) => {
    const updated = corridas
      .filter((_, i) => i !== index)
      .map((row, i) => ({ ...row, corrida: i + 1 }));
    onCorridasChange(updated);
    if (selectedRowIndex === index) {
      onSelectRow(Math.max(0, index - 1));
    }
  };

  // --- Keyboard Excel Navigation ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, rowIndex: number, colName: keyof Corrida) => {
    const colIndex = EDITABLE_COLS.indexOf(colName);
    if (colIndex === -1) return;

    let targetRow = rowIndex;
    let targetColIndex = colIndex;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      targetRow = Math.min(corridas.length - 1, rowIndex + 1);
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
        addCorridaRow();
        setTimeout(() => {
          const nextElement = document.getElementById(`cell-${corridas.length}-0`);
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

    const nextElementId = `cell-${targetRow}-${targetColIndex}`;

    setTimeout(() => {
      const element = document.getElementById(nextElementId) as HTMLInputElement | HTMLSelectElement;
      if (element) {
        element.focus();
        if (element.tagName === 'INPUT') {
          (element as HTMLInputElement).select();
        }
        onSelectRow(targetRow);
      }
    }, 10);
  };

  const getCellAlertClass = (index: number, field: string) => {
    const alert = alerts.find(a => a.corridaIndex === index && a.field.startsWith(field));
    if (!alert) return '';
    return alert.type === 'CRITICAL'
      ? 'bg-red-500/10 border border-red-500/40 text-red-200'
      : 'bg-amber-500/10 border border-amber-500/30 text-amber-200';
  };

  const getCellTdStyle = (index: number, fieldName: string, extraStyles: React.CSSProperties = {}) => {
    const alert = alerts.find(a => a.corridaIndex === index && a.field.startsWith(fieldName));
    if (!alert) return extraStyles;

    const isCritical = alert.type === 'CRITICAL';
    const alertBg = isCritical
      ? 'rgba(239, 68, 68, 0.18)'
      : 'rgba(245, 158, 11, 0.18)';
    const alertBorder = isCritical
      ? 'inset 0 0 0 2px rgba(239, 68, 68, 0.6)'
      : 'inset 0 0 0 2px rgba(245, 158, 11, 0.5)';

    const bg = extraStyles.backgroundColor
      ? `linear-gradient(${alertBg}, ${alertBg}), ${extraStyles.backgroundColor}`
      : alertBg;

    return {
      ...extraStyles,
      background: bg,
      boxShadow: alertBorder,
    };
  };

  const getLithologyStyle = (val: string) => {
    const code = (val || '').toUpperCase();
    const item = LITHOLOGY_CATALOG[code];
    const isDark = darkMode ?? document.documentElement.classList.contains('dark') ?? true;
    if (!item) {
      return isDark
        ? { backgroundColor: 'rgba(168, 85, 247, 0.05)', color: '#cbd5e1' }
        : { backgroundColor: '#f1f5f9', color: '#334155' };
    }
    if (isDark) {
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

  const getLithologyStyleNullable = (val: string | undefined) => {
    const isDark = darkMode ?? document.documentElement.classList.contains('dark') ?? true;
    if (!val || val === "-1") {
      return isDark
        ? { backgroundColor: 'rgba(168, 85, 247, 0.05)', color: '#94a3b8' }
        : { backgroundColor: 'rgba(0, 0, 0, 0.02)', color: '#64748b' };
    }
    return getLithologyStyle(val);
  };

  const getResistenciaStyle = (val: string) => {
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

  const getIntemperismoStyle = (val: string) => {
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

  const getAguaStyle = (val: string) => {
    const code = (val || '').toUpperCase();
    const item = GROUNDWATER_CATALOG[code];
    if (!item || val === "-1") {
      return darkMode
        ? { backgroundColor: 'rgba(59, 130, 246, 0.05)', color: '#cbd5e1' }
        : { backgroundColor: 'rgba(0, 0, 0, 0.02)', color: '#64748b' };
    }
    const rating = item.rmr89;
    if (darkMode) {
      const bg = rating >= 10 ? "#071f07" : rating >= 7 ? "#0a1f12" : rating >= 4 ? "#1f1a00" : rating >= 1 ? "#1f0f00" : "#1f0a0a";
      const fg = rating >= 10 ? "#86efac" : rating >= 7 ? "#6ee7b7" : rating >= 4 ? "#fcd34d" : rating >= 1 ? "#fb923c" : "#fca5a5";
      return { backgroundColor: bg, color: fg };
    } else {
      let bg = "#fee2e2";
      let fg = "#991b1b";
      if (rating >= 15) {
        bg = "#d1fae5";
        fg = "#065f46";
      } else if (rating >= 10) {
        bg = "#dbeafe";
        fg = "#1e40af";
      } else if (rating >= 7) {
        bg = "#fef3c7";
        fg = "#92400e";
      } else if (rating >= 4) {
        bg = "#ffedd5";
        fg = "#9a3412";
      }
      return { backgroundColor: bg, color: fg };
    }
  };

  const getHeaderStyle = (colKey: string) => {
    const w = widths[colKey] || 64;
    let backgroundStyle = {};

    if (colKey === 'rmr76') {
      backgroundStyle = {
        background: darkMode
          ? 'linear-gradient(rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.2)), rgb(var(--navy-900))'
          : 'linear-gradient(rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.1)), rgb(var(--navy-900))'
      };
    } else if (colKey === 'rmr89') {
      backgroundStyle = {
        background: darkMode
          ? 'linear-gradient(rgba(16, 185, 129, 0.25), rgba(16, 185, 129, 0.25)), rgb(var(--navy-900))'
          : 'linear-gradient(rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.15)), rgb(var(--navy-900))'
      };
    } else if (['rec_m', 'rqd_m', 'lrf_m', 'small_frag_m', 'sum_control', 'lr_rqd_lrf'].includes(colKey)) {
      backgroundStyle = {
        background: darkMode
          ? 'linear-gradient(rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.1)), rgb(var(--navy-900))'
          : 'linear-gradient(rgba(59, 130, 246, 0.05), rgba(59, 130, 246, 0.05)), rgb(var(--navy-900))'
      };
    } else if (['mec_frac', 'frf', 'frac_nat', 'lito1', 'lito2', 'lito3', 'max_resist'].includes(colKey)) {
      backgroundStyle = {
        background: darkMode
          ? 'linear-gradient(rgba(168, 85, 247, 0.1), rgba(168, 85, 247, 0.1)), rgb(var(--navy-900))'
          : 'linear-gradient(rgba(168, 85, 247, 0.05), rgba(168, 85, 247, 0.05)), rgb(var(--navy-900))'
      };
    } else if (['orientacion', 'offset', 'tipo_est1', 'tipo_est2', 'frac_buz30', 'frac_buz60', 'frac_buz90', 'sum_frac_nat', 'alert_fn'].includes(colKey)) {
      backgroundStyle = {
        background: darkMode
          ? 'linear-gradient(rgba(99, 102, 241, 0.1), rgba(99, 102, 241, 0.1)), rgb(var(--navy-900))'
          : 'linear-gradient(rgba(99, 102, 241, 0.05), rgba(99, 102, 241, 0.05)), rgb(var(--navy-900))'
      };
    } else if (['abertura', 'rugosidad', 'jrc10', 'alert_rug_jrc', 'intemperismo', 'relleno1', 'relleno2', 'espesor', 'alert_abert_rell', 'agua_obs'].includes(colKey)) {
      backgroundStyle = {
        background: darkMode
          ? 'linear-gradient(rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.1)), rgb(var(--navy-900))'
          : 'linear-gradient(rgba(245, 158, 11, 0.05), rgba(245, 158, 11, 0.05)), rgb(var(--navy-900))'
      };
    } else {
      backgroundStyle = {
        background: 'rgb(var(--navy-900))'
      };
    }

    let borderShadows = 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';

    if (colKey === 'corrida') {
      borderShadows = 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 1px 0 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
    } else if (colKey === 'taladro') {
      borderShadows = 'inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), 1px 0 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
    } else if (colKey === 'rmr76' || colKey === 'rmr89') {
      borderShadows = 'inset 1px 0 0 0 rgb(var(--navy-800)), inset -1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), -1px 0 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
    } else if (colKey === 'Elim.') {
      borderShadows = 'inset 1px 0 0 0 rgb(var(--navy-800)), inset 0 -1px 0 0 rgb(var(--navy-800)), -1px 0 0 0 rgb(var(--navy-800)), 0 1px 0 0 rgb(var(--navy-800))';
    }

    return {
      width: w,
      minWidth: w,
      maxWidth: w,
      ...backgroundStyle,
      boxShadow: borderShadows,
    };
  };

  return (
    <div className="h-full flex flex-col select-none min-h-0">
      {/* Sub-Pestañas Superiores */}
      <div className="flex border-b border-navy-850 dark:border-navy-800 shrink-0 mb-4">
        <button
          onClick={() => setActiveSubTab('lgg')}
          className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'lgg'
            ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
        >
          Logueo General (LGG)
        </button>
        <button
          onClick={() => setActiveSubTab('qaqc')}
          className={`px-6 py-2.5 font-black text-xs uppercase tracking-wider transition-all border-b-2 -mb-[2px] ${activeSubTab === 'qaqc'
            ? 'border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400 font-extrabold'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800'
            }`}
        >
          Análisis QA/QC
        </button>
      </div>

      {/* Contenedor scrolleable hacia abajo */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-1 space-y-6 min-h-0 relative">
        {activeSubTab === 'lgg' ? (
          <>
            {/* Panel de Introducción */}
            <div
              style={panelWidthStyle}
              className="glass-panel p-4 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10 shrink-0 transition-[width,max-width] duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
                    Logueo Geotécnico General (LGG)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Registro sistemático de corridas, recuperación de testigos, RQD y parámetros del macizo rocoso
                  </p>
                </div>
              </div>

              {/* Botones de Importación / Exportación Excel */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95 text-emerald-500 dark:text-emerald-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  <Upload size={14} />
                  <span>Importar Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  disabled={!corridas || corridas.length === 0}
                  title={corridas?.length === 0 ? 'Sin datos para exportar' : `Exportar ${corridas?.length} corridas a Excel`}
                  className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 active:scale-95 text-blue-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={14} />
                  <span>Exportar Excel</span>
                </button>
              </div>
            </div>

            {/* NUEVO: DASHBOARD DE INDICADORES CLAVE DEL SONDAJE ACTIVO (GEOMECÁNICA) */}
            <div
              style={panelWidthStyle}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 transition-[width,max-width] duration-300"
            >
              {/* Card 1: Identificación del Taladro */}
              <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Taladro Activo</span>
                  <span className="text-xl font-extrabold text-cyan-400 tracking-wider block">{lastRowTaladroName(0)}</span>
                  <span className="text-[10px] text-slate-500 block font-bold">Responsable: {lastRowGeologo(0)}</span>
                </div>
                <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
                  <Database size={20} />
                </div>
              </div>

              {/* Card 2: Metros Perforados / Logueados */}
              <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Metraje Perforado</span>
                  <span className="text-xl font-extrabold text-emerald-400 tracking-wide block">{totalPerfKpi.toFixed(2)} <span className="text-xs text-slate-400 normal-case font-bold">m</span></span>
                  <span className="text-[10px] text-slate-500 block font-bold">Intervalo: {firstDeKpi.toFixed(2)}m - {lastAKpi.toFixed(2)}m</span>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <Ruler size={20} />
                </div>
              </div>

              {/* Card 3: Cantidad de Corridas */}
              <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Cantidad de Corridas</span>
                  <span className="text-xl font-extrabold text-purple-400 tracking-wide block">{totalCorridasKpi} <span className="text-xs text-slate-400 lowercase font-bold">corridas</span></span>
                  <span className="text-[10px] text-slate-500 block font-bold">Longitud Promedio: {avgRunLengthKpi.toFixed(2)}m</span>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
                  <Layers size={20} />
                </div>
              </div>

              {/* Card 4: Resistencia Máxima ISRM */}
              <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/15 flex items-center justify-between shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Resistencia ISRM Promedio</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-amber-400 tracking-wide block">{avgRClassKpi}</span>
                    <span className="text-[10px] text-slate-400 font-bold">({avgStrengthScoreKpi} pts RMR)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 block font-bold truncate max-w-[210px]">{getISRMClassDescription(avgRClassKpi)}</span>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                  <Shield size={20} />
                </div>
              </div>
            </div>

            {/* Panel de Filtros (Estilo Enterprise) */}
            <div
              style={panelWidthStyle}
              className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-4 shadow-lg shrink-0 transition-[width,max-width] duration-300"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Litología 1</label>
                  <select
                    value={filterLito}
                    onChange={(e) => setFilterLito(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">TODAS</option>
                    {LITO_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt} - {LITHOLOGY_CATALOG[opt]?.name || opt}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Resistencia (R)</label>
                  <select
                    value={filterResistencia}
                    onChange={(e) => setFilterResistencia(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">TODAS</option>
                    {RESISTENCIA_OPTIONS.filter(o => o !== "-1").map(opt => (
                      <option key={opt} value={opt}>{opt} ({STRENGTH_CATALOG[opt]?.score ?? 0} pts)</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Calidad RMR'89</label>
                  <select
                    value={filterRmrClass}
                    onChange={(e) => setFilterRmrClass(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">TODAS</option>
                    <option value="Muy Buena">Muy Buena (&gt;=81)</option>
                    <option value="Buena">Buena (61-80)</option>
                    <option value="Regular">Regular (41-60)</option>
                    <option value="Mala">Mala (21-40)</option>
                    <option value="Muy Mala">Muy Mala (&lt;=20)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Geotécnico</label>
                  <input
                    type="text"
                    placeholder="Ej. Ana"
                    value={filterGeotecnico}
                    onChange={(e) => setFilterGeotecnico(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

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
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{filteredCorridas.length}</span>
                    <span className="text-slate-500 dark:text-slate-400">{filteredCorridas.length === 1 ? 'registro' : 'registros'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid Actions */}
            <div
              style={panelWidthStyle}
              className="flex justify-between items-center bg-navy-900/50 p-3 rounded-xl border border-navy-800/35 backdrop-blur-md transition-[width,max-width] duration-300 shrink-0"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={addCorridaRow}
                  className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 animate-pulse-ring"
                >
                  <Plus size={16} />
                  <span>Agregar Registro</span>
                </button>
                <button
                  type="button"
                  onClick={handleRenameClick}
                  className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 hover:text-white px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                  title="Renombrar taladro activo"
                >
                  <Edit size={15} className="text-cyan-400" />
                  <span>Renombrar Taladro</span>
                </button>
              </div>
              <div className="text-xs text-slate-500 font-medium max-w-md text-right leading-relaxed">
                * Navega con las <span className="font-bold text-slate-400">Teclas de Dirección</span>. Presiona <span className="font-bold text-slate-400">ENTER</span> para avanzar o crear corridas. Arrastra los bordes de cabecera para ajustar columnas.
              </div>
            </div>

            {/* Grid Container */}
            <div
              ref={gridContainerRef}
              className="border border-navy-800 rounded-xl bg-navy-950/65 shadow-2xl relative overflow-visible inline-block min-w-full"
            >
              <table className="w-full border-separate text-xs text-left" style={{ tableLayout: 'fixed', borderSpacing: 0 }}>
                {/* Header */}
                <thead className="sticky top-0 z-20 bg-navy-900 border-b border-navy-800 text-slate-400 dark:text-slate-300 font-bold uppercase tracking-wider text-xs">
                  <tr>
                    <th
                      className="sticky top-0 left-0 z-30 bg-navy-900 py-3.5 px-2 text-center w-16 whitespace-nowrap"
                      style={getHeaderStyle('corrida')}
                    >
                      #
                    </th>
                    <th
                      className="sticky top-0 left-16 z-30 bg-navy-900 py-3.5 px-2 text-center w-24 whitespace-nowrap"
                      style={getHeaderStyle('taladro')}
                    >
                      Taladro
                    </th>

                    {/* Grupo Intervalo */}
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative" style={getHeaderStyle('de')}>
                      de: (m)
                      <div onMouseDown={(e) => handleMouseDown(e, 'de')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative" style={getHeaderStyle('a')}>
                      a: (m)
                      <div onMouseDown={(e) => handleMouseDown(e, 'a')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative" style={getHeaderStyle('perf')}>
                      Perf. (m)
                      <div onMouseDown={(e) => handleMouseDown(e, 'perf')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative" style={getHeaderStyle('perf_lr')}>
                      Perf./LR
                      <div onMouseDown={(e) => handleMouseDown(e, 'perf_lr')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>

                    {/* Grupo Físico / QAQC */}
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300" style={getHeaderStyle('rec_m')}>
                      Longitud Recuper. (m)
                      <div onMouseDown={(e) => handleMouseDown(e, 'rec_m')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300" style={getHeaderStyle('rqd_m')}>
                      (RQD) &Sigma; Frag's &ge; 10cm (m)
                      <div onMouseDown={(e) => handleMouseDown(e, 'rqd_m')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300" style={getHeaderStyle('lrf_m')}>
                      Long. Roca Fract. (m)
                      <div onMouseDown={(e) => handleMouseDown(e, 'lrf_m')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300" style={getHeaderStyle('small_frag_m')}>
                      &Sigma; Frag's &lt; 10cm (m)
                      <div onMouseDown={(e) => handleMouseDown(e, 'small_frag_m')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300" style={getHeaderStyle('sum_control')}>
                      &Sigma; RQD + LRF + &Sigma; Frag's &lt; 10cm (m)
                      <div onMouseDown={(e) => handleMouseDown(e, 'sum_control')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-blue-500/5 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300" style={getHeaderStyle('lr_rqd_lrf')}>
                      LR/RQD + LRF
                      <div onMouseDown={(e) => handleMouseDown(e, 'lr_rqd_lrf')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>

                    {/* Grupo Geología y Resistencia */}
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-purple-500/5 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300" style={getHeaderStyle('mec_frac')}>
                      N° Fract. Mecanic.
                      <div onMouseDown={(e) => handleMouseDown(e, 'mec_frac')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-purple-500/5 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300" style={getHeaderStyle('frf')}>
                      FRF
                      <div onMouseDown={(e) => handleMouseDown(e, 'frf')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-purple-500/5 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300" style={getHeaderStyle('frac_nat')}>
                      N° Fract. Naturales
                      <div onMouseDown={(e) => handleMouseDown(e, 'frac_nat')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-purple-500/5 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300" style={getHeaderStyle('lito1')}>
                      LITO 1
                      <div onMouseDown={(e) => handleMouseDown(e, 'lito1')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-purple-500/5 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300" style={getHeaderStyle('lito2')}>
                      LITO 2
                      <div onMouseDown={(e) => handleMouseDown(e, 'lito2')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-purple-500/5 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300" style={getHeaderStyle('lito3')}>
                      LITO 3
                      <div onMouseDown={(e) => handleMouseDown(e, 'lito3')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-purple-500/5 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300" style={getHeaderStyle('max_resist')}>
                      Resistencia Máxima Estimada (ISRM)
                      <div onMouseDown={(e) => handleMouseDown(e, 'max_resist')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>

                    {/* Bins de Orientación */}
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" style={getHeaderStyle('orientacion')}>
                      Linea de Orientac.
                      <div onMouseDown={(e) => handleMouseDown(e, 'orientacion')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" style={getHeaderStyle('offset')}>
                      Desplaz. 0°-360° (Offset)
                      <div onMouseDown={(e) => handleMouseDown(e, 'offset')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" style={getHeaderStyle('tipo_est1')}>
                      Tipo Estructura
                      <div onMouseDown={(e) => handleMouseDown(e, 'tipo_est1')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" style={getHeaderStyle('tipo_est2')}>
                      Tipo Estructura 2
                      <div onMouseDown={(e) => handleMouseDown(e, 'tipo_est2')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" style={getHeaderStyle('frac_buz30')}>
                      N° Fract. Natural. (Buz &lt;30°)
                      <div onMouseDown={(e) => handleMouseDown(e, 'frac_buz30')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" style={getHeaderStyle('frac_buz60')}>
                      N° Fract. Natural. (30°&lt; Buz &lt; 60°)
                      <div onMouseDown={(e) => handleMouseDown(e, 'frac_buz60')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" style={getHeaderStyle('frac_buz90')}>
                      N° Fract. Natural. (Buz &gt; 60°)
                      <div onMouseDown={(e) => handleMouseDown(e, 'frac_buz90')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" style={getHeaderStyle('sum_frac_nat')}>
                      &Sigma; Fract. Natural.
                      <div onMouseDown={(e) => handleMouseDown(e, 'sum_frac_nat')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" style={getHeaderStyle('alert_fn')}>
                      N° FN
                      <div onMouseDown={(e) => handleMouseDown(e, 'alert_fn')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>

                    {/* Condiciones de Discontinuidades / Relleno */}
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" style={getHeaderStyle('abertura')}>
                      Abertura (mm)
                      <div onMouseDown={(e) => handleMouseDown(e, 'abertura')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" style={getHeaderStyle('rugosidad')}>
                      Rugosidad (ISRM)
                      <div onMouseDown={(e) => handleMouseDown(e, 'rugosidad')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" style={getHeaderStyle('jrc10')}>
                      JRC10
                      <div onMouseDown={(e) => handleMouseDown(e, 'jrc10')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" style={getHeaderStyle('alert_rug_jrc')}>
                      Rug./JRC
                      <div onMouseDown={(e) => handleMouseDown(e, 'alert_rug_jrc')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" style={getHeaderStyle('intemperismo')}>
                      Grado Intemp. (ISRM)
                      <div onMouseDown={(e) => handleMouseDown(e, 'intemperismo')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>

                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" style={getHeaderStyle('relleno1')}>
                      Tipo Relleno 1
                      <div onMouseDown={(e) => handleMouseDown(e, 'relleno1')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" style={getHeaderStyle('relleno2')}>
                      Tipo Relleno 2
                      <div onMouseDown={(e) => handleMouseDown(e, 'relleno2')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" style={getHeaderStyle('espesor')}>
                      Espesor Relleno (mm)
                      <div onMouseDown={(e) => handleMouseDown(e, 'espesor')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" style={getHeaderStyle('alert_abert_rell')}>
                      Abertura / Relleno
                      <div onMouseDown={(e) => handleMouseDown(e, 'alert_abert_rell')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" style={getHeaderStyle('agua_obs')}>
                      Presencia de Agua (ISRM)
                      <div onMouseDown={(e) => handleMouseDown(e, 'agua_obs')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>

                    {/* Campos Administrativos */}
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative" style={getHeaderStyle('geologo')}>
                      Geotécnico
                      <div onMouseDown={(e) => handleMouseDown(e, 'geologo')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative" style={getHeaderStyle('fecha')}>
                      Fecha
                      <div onMouseDown={(e) => handleMouseDown(e, 'fecha')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative" style={getHeaderStyle('turno')}>
                      Turno
                      <div onMouseDown={(e) => handleMouseDown(e, 'turno')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>
                    <th className="py-3.5 px-2 border-r border-navy-800 text-center relative" style={getHeaderStyle('comentarios')}>
                      Comentarios
                      <div onMouseDown={(e) => handleMouseDown(e, 'comentarios')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500" />
                    </th>

                    {/* RMR final */}
                    <th
                      className="sticky top-0 right-[144px] z-30 text-center relative font-extrabold text-emerald-600 dark:text-emerald-300 py-3.5 px-2"
                      style={getHeaderStyle('rmr76')}
                    >
                      RMR'76
                      <div onMouseDown={(e) => handleMouseDown(e, 'rmr76')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-40" />
                    </th>
                    <th
                      className="sticky top-0 right-[64px] z-30 text-center relative font-black shadow-sm text-emerald-600 dark:text-emerald-300 py-3.5 px-2"
                      style={getHeaderStyle('rmr89')}
                    >
                      RMR'89
                      <div onMouseDown={(e) => handleMouseDown(e, 'rmr89')} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-40" />
                    </th>

                    <th
                      className="sticky top-0 right-0 z-30 bg-navy-900 py-3.5 px-2 text-center w-16 whitespace-nowrap"
                      style={getHeaderStyle('Elim.')}
                    >
                      Elim.
                    </th>
                  </tr>
                </thead>

                {/* Body */}
                <tbody>
                  {filteredCorridas.map((row, idx) => {
                    const isSelected = selectedRowIndex === idx;
                    const rmrRes = calculateRowRmr(row, waterTableM);
                    const perf = (row.a - row.de).toFixed(2);

                    const safeSumVal = (v: any) => {
                      const num = parseFloat(v);
                      return isNaN(num) || num < 0 ? 0 : num;
                    };
                    const safeSumInt = (v: any) => {
                      const val = parseInt(v);
                      return isNaN(val) || val < 0 ? 0 : val;
                    };

                    const sRqd = safeSumVal(row.rqd_m);
                    const sLrf = safeSumVal(row.lrf_m);
                    const sSmall = safeSumVal(row.small_frag_m);
                    const sRec = safeSumVal(row.rec_m);

                    const sumControlVal = parseFloat((sRqd + sLrf + sSmall).toFixed(2));

                    const errPerfLr = parseFloat(sRec.toFixed(2)) > parseFloat(perf);
                    const errLrRqdLrf = sumControlVal > parseFloat(perf) || sRqd > sRec;

                    const sBuz30 = safeSumInt(row.frac_buz30);
                    const sBuz60 = safeSumInt(row.frac_buz60);
                    const sBuz90 = safeSumInt(row.frac_buz90);
                    const sFracNat = safeSumInt(row.frac_nat);

                    const errFn = (sBuz30 + sBuz60 + sBuz90) !== sFracNat;

                    const errRugJrc = false;
                    const sEspesor = safeSumVal(row.espesor);
                    const sAbertura = safeSumVal(row.abertura);
                    const errAbertRell = (sEspesor > 0 && sAbertura <= 0) || (sEspesor === 0 && sAbertura > 0);

                    return (
                      <tr
                        key={idx}
                        onClick={() => onSelectRow(idx)}
                        className={`border-b border-navy-900 transition-colors ${isSelected ? 'bg-blue-600/5 hover:bg-blue-600/5' : 'hover:bg-navy-900/10'
                          }`}
                      >
                        {/* Congeladas */}
                        <td
                          className="sticky left-0 z-10 bg-navy-950 font-bold text-center py-2 text-blue-600 dark:text-cyan-400"
                          style={{
                            boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), 1px 0 0 0 rgb(var(--navy-900))'
                          }}
                        >
                          {row.corrida}
                        </td>
                        <td
                          className="sticky left-16 z-10 bg-navy-950 text-center text-slate-400 font-semibold truncate px-2 select-all"
                          style={{
                            boxShadow: 'inset -1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), 1px 0 0 0 rgb(var(--navy-900))'
                          }}
                        >
                          {lastRowTaladroName(idx)}
                        </td>

                        {/* de: */}
                        <td className="border-r border-navy-900" style={getCellTdStyle(idx, 'de')}>
                          <input
                            id={`cell-${idx}-0`}
                            type="number"
                            min="0"
                            value={row.de}
                            step="0.01"
                            onKeyDown={(e) => handleKeyDown(e, idx, 'de')}
                            onChange={(e) => handleCellChange(idx, 'de', parseFloat(e.target.value) || 0)}
                            className={`w-full bg-transparent border-0 px-2 py-1 text-center text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded ${getCellAlertClass(idx, 'de')}`}
                          />
                        </td>
                        {/* a: */}
                        <td className="border-r border-navy-900" style={getCellTdStyle(idx, 'a')}>
                          <input
                            id={`cell-${idx}-1`}
                            type="number"
                            min="0"
                            value={row.a}
                            step="0.01"
                            onKeyDown={(e) => handleKeyDown(e, idx, 'a')}
                            onChange={(e) => handleCellChange(idx, 'a', parseFloat(e.target.value) || 0)}
                            className={`w-full bg-transparent border-0 px-2 py-1 text-center font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded ${getCellAlertClass(idx, 'a')}`}
                          />
                        </td>
                        {/* Perf. (m) */}
                        <td className="border-r border-navy-900 text-center py-2 text-slate-400 font-semibold select-none">
                          {perf}
                        </td>
                        {/* Perf./LR */}
                        <td className="border-r border-navy-900 py-2 text-center">
                          {errPerfLr ? (
                            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="Sobre-recuperación detectada (Recup > Perf)">
                              <X size={14} className="stroke-[3]" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                              <Check size={14} className="stroke-[3]" />
                            </span>
                          )}
                        </td>

                        {/* Grupo Físico / QAQC */}
                        <td className="border-r border-navy-900 bg-blue-500/5 dark:bg-blue-500/10" style={getCellTdStyle(idx, 'rec_m')}>
                          <input
                            id={`cell-${idx}-2`}
                            type="number"
                            min="-1"
                            value={row.rec_m}
                            step="0.01"
                            onKeyDown={(e) => handleKeyDown(e, idx, 'rec_m')}
                            onChange={(e) => handleCellChange(idx, 'rec_m', parseFloat(e.target.value) || 0)}
                            className={`w-full bg-transparent border-0 px-2 py-1 text-center text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded ${getCellAlertClass(idx, 'rec_m')}`}
                          />
                        </td>
                        <td className="border-r border-navy-900 bg-blue-500/5 dark:bg-blue-500/10" style={getCellTdStyle(idx, 'rqd_m')}>
                          <input
                            id={`cell-${idx}-3`}
                            type="number"
                            min="-1"
                            value={row.rqd_m}
                            step="0.01"
                            onKeyDown={(e) => handleKeyDown(e, idx, 'rqd_m')}
                            onChange={(e) => handleCellChange(idx, 'rqd_m', parseFloat(e.target.value) || 0)}
                            className={`w-full bg-transparent border-0 px-2 py-1 text-center text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded ${getCellAlertClass(idx, 'rqd_m')}`}
                          />
                        </td>
                        <td className="border-r border-navy-900 bg-blue-500/5 dark:bg-blue-500/10">
                          <input
                            id={`cell-${idx}-4`}
                            type="number"
                            min="-1"
                            value={row.lrf_m}
                            step="0.01"
                            onKeyDown={(e) => handleKeyDown(e, idx, 'lrf_m')}
                            onChange={(e) => handleCellChange(idx, 'lrf_m', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                          />
                        </td>
                        <td className="border-r border-navy-900 bg-blue-500/5 dark:bg-blue-500/10">
                          <input
                            id={`cell-${idx}-5`}
                            type="number"
                            min="-1"
                            value={row.small_frag_m}
                            step="0.01"
                            onKeyDown={(e) => handleKeyDown(e, idx, 'small_frag_m')}
                            onChange={(e) => handleCellChange(idx, 'small_frag_m', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                          />
                        </td>
                        <td className="border-r border-navy-900 text-center py-2 bg-blue-500/5 dark:bg-blue-500/10 text-slate-400 font-medium">
                          {sumControlVal}
                        </td>
                        <td className="border-r border-navy-900 bg-blue-500/5 dark:bg-blue-500/10 py-2 text-center">
                          {errLrRqdLrf ? (
                            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="Inconsistencia física (Suma fragmentos > Perf ó RQD > Recup)">
                              <X size={14} className="stroke-[3]" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                              <Check size={14} className="stroke-[3]" />
                            </span>
                          )}
                        </td>

                        {/* Grupo Geología y Resistencia */}
                        <td className="border-r border-navy-900 bg-purple-500/5 dark:bg-purple-500/10">
                          <input
                            id={`cell-${idx}-6`}
                            type="number"
                            min="-1"
                            value={row.mec_frac}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'mec_frac')}
                            onChange={(e) => handleCellChange(idx, 'mec_frac', parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                          />
                        </td>
                        <td className="border-r border-navy-900 text-center py-2 bg-purple-500/5 dark:bg-purple-500/10 text-slate-400 select-none">
                          {row.lrf_m > 0 ? Math.floor(Math.round(row.lrf_m * 100) / 5) + 1 : 0}
                        </td>
                        <td className="border-r border-navy-900 bg-purple-500/5 dark:bg-purple-500/10" style={getCellTdStyle(idx, 'frac_nat')}>
                          <input
                            id={`cell-${idx}-7`}
                            type="number"
                            min="-1"
                            value={row.frac_nat}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'frac_nat')}
                            onChange={(e) => handleCellChange(idx, 'frac_nat', parseInt(e.target.value) || 0)}
                            className={`w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none font-semibold text-slate-300 focus:ring-1 focus:ring-blue-500 rounded ${getCellAlertClass(idx, 'frac_nat')}`}
                          />
                        </td>
                        {(() => {
                          const style = getLithologyStyle(row.lito1);
                          const isFocused = focusedCell?.row === idx && focusedCell?.field === 'lito1';
                          const displayValue = isFocused ? tempValue : (row.lito1 || "");
                          return (
                            <td className="border-r border-navy-900" style={getCellTdStyle(idx, 'lito1', { backgroundColor: style.backgroundColor })}>
                              <input
                                id={`cell-${idx}-8`}
                                list="lito1-options-list"
                                value={displayValue}
                                placeholder={isFocused ? row.lito1 : "—"}
                                onKeyDown={(e) => handleKeyDown(e, idx, 'lito1')}
                                onFocus={() => {
                                  setFocusedCell({ row: idx, field: 'lito1', originalVal: row.lito1 || "" });
                                  setTempValue("");
                                  setIsChanged(false);
                                }}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTempValue(val);
                                  setIsChanged(true);
                                  handleCellChange(idx, 'lito1', val.toUpperCase());
                                }}
                                onBlur={() => {
                                  if (focusedCell) {
                                    if (!isChanged || !tempValue.trim()) {
                                      handleCellChange(idx, 'lito1', focusedCell.originalVal);
                                    }
                                  }
                                  setFocusedCell(null);
                                }}
                                className="w-full bg-transparent border-0 px-1 py-1 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 rounded font-bold uppercase placeholder:opacity-100 placeholder:text-current"
                                style={{ color: style.color }}
                              />
                            </td>
                          );
                        })()}
                        {(() => {
                          const style = getLithologyStyleNullable(row.lito2);
                          const isFocused = focusedCell?.row === idx && focusedCell?.field === 'lito2';
                          const displayValue = isFocused ? tempValue : (row.lito2 === "-1" ? "" : row.lito2 || "");
                          const origVal = row.lito2 || "-1";
                          const placeholderVal = origVal === "-1" ? "—" : origVal;
                          return (
                            <td className="border-r border-navy-900" style={{ backgroundColor: style.backgroundColor }}>
                              <input
                                id={`cell-${idx}-9`}
                                list="lito2-options-list"
                                value={displayValue}
                                placeholder={isFocused ? placeholderVal : "—"}
                                onKeyDown={(e) => handleKeyDown(e, idx, 'lito2')}
                                onFocus={() => {
                                  setFocusedCell({ row: idx, field: 'lito2', originalVal: origVal });
                                  setTempValue("");
                                  setIsChanged(false);
                                }}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTempValue(val);
                                  setIsChanged(true);
                                  handleCellChange(idx, 'lito2', val.toUpperCase() || "-1");
                                }}
                                onBlur={() => {
                                  if (focusedCell) {
                                    if (!isChanged) {
                                      handleCellChange(idx, 'lito2', focusedCell.originalVal);
                                    } else if (!tempValue.trim()) {
                                      handleCellChange(idx, 'lito2', "-1");
                                    }
                                  }
                                  setFocusedCell(null);
                                }}
                                className="w-full bg-transparent border-0 px-1 py-1 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 rounded font-bold uppercase placeholder:opacity-100 placeholder:text-current"
                                style={{ color: style.color }}
                              />
                            </td>
                          );
                        })()}
                        {(() => {
                          const style = getLithologyStyleNullable(row.lito3);
                          const isFocused = focusedCell?.row === idx && focusedCell?.field === 'lito3';
                          const displayValue = isFocused ? tempValue : (row.lito3 === "-1" ? "" : row.lito3 || "");
                          const origVal = row.lito3 || "-1";
                          const placeholderVal = origVal === "-1" ? "—" : origVal;
                          return (
                            <td className="border-r border-navy-900" style={{ backgroundColor: style.backgroundColor }}>
                              <input
                                id={`cell-${idx}-10`}
                                list="lito3-options-list"
                                value={displayValue}
                                placeholder={isFocused ? placeholderVal : "—"}
                                onKeyDown={(e) => handleKeyDown(e, idx, 'lito3')}
                                onFocus={() => {
                                  setFocusedCell({ row: idx, field: 'lito3', originalVal: origVal });
                                  setTempValue("");
                                  setIsChanged(false);
                                }}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTempValue(val);
                                  setIsChanged(true);
                                  handleCellChange(idx, 'lito3', val.toUpperCase() || "-1");
                                }}
                                onBlur={() => {
                                  if (focusedCell) {
                                    if (!isChanged) {
                                      handleCellChange(idx, 'lito3', focusedCell.originalVal);
                                    } else if (!tempValue.trim()) {
                                      handleCellChange(idx, 'lito3', "-1");
                                    }
                                  }
                                  setFocusedCell(null);
                                }}
                                className="w-full bg-transparent border-0 px-1 py-1 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 rounded font-bold uppercase placeholder:opacity-100 placeholder:text-current"
                                style={{ color: style.color }}
                              />
                            </td>
                          );
                        })()}
                        {(() => {
                          const style = getResistenciaStyle(row.resistencia);
                          return (
                            <td className="border-r border-navy-900" style={getCellTdStyle(idx, 'resistencia', { backgroundColor: style.backgroundColor })}>
                              <select
                                id={`cell-${idx}-11`}
                                value={row.resistencia}
                                onKeyDown={(e) => handleKeyDown(e, idx, 'resistencia')}
                                onChange={(e) => handleCellChange(idx, 'resistencia', e.target.value)}
                                className="w-full bg-transparent border-0 px-1 py-1 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded text-center font-bold"
                                style={{ color: style.color }}
                              >
                                {RESISTENCIA_OPTIONS.map(opt => (
                                  <option key={opt} value={opt} className={darkMode ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>
                                    {opt === "-1" ? "S/D" : `${opt} (${STRENGTH_CATALOG[opt]?.score ?? 0} pts)`}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })()}

                        {/* Bins de Orientación */}
                        <td className="border-r border-navy-900 bg-indigo-500/5 dark:bg-indigo-500/10">
                          <select
                            id={`cell-${idx}-12`}
                            value={row.orientacion}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'orientacion')}
                            onChange={(e) => handleCellChange(idx, 'orientacion', e.target.value)}
                            className="w-full bg-transparent border-0 px-1 py-1 text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded"
                          >
                            {ORIENTACION_OPTIONS.map(opt => <option key={opt} value={opt} className={darkMode ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>{opt}</option>)}
                          </select>
                        </td>
                        <td className="border-r border-navy-900 bg-indigo-500/5 dark:bg-indigo-500/10">
                          <input
                            id={`cell-${idx}-13`}
                            type="number"
                            min="-1"
                            max="360"
                            value={row.offset !== undefined ? row.offset : 0}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'offset')}
                            onChange={(e) => handleCellChange(idx, 'offset', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                          />
                        </td>
                        <td className="border-r border-navy-900 bg-indigo-500/5 dark:bg-indigo-500/10">
                          <select
                            id={`cell-${idx}-14`}
                            value={row.tipo_est1}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'tipo_est1')}
                            onChange={(e) => handleCellChange(idx, 'tipo_est1', e.target.value)}
                            className="w-full bg-transparent border-0 px-1 py-1 text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded"
                          >
                            {ESTRUCTURA_OPTIONS.map(opt => <option key={opt} value={opt} className={darkMode ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>{opt}</option>)}
                          </select>
                        </td>
                        <td className="border-r border-navy-900 bg-indigo-500/5 dark:bg-indigo-500/10">
                          <select
                            id={`cell-${idx}-15`}
                            value={row.tipo_est2 || "-1"}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'tipo_est2')}
                            onChange={(e) => handleCellChange(idx, 'tipo_est2', e.target.value)}
                            className="w-full bg-transparent border-0 px-1 py-1 text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded"
                          >
                            <option value="-1" className={darkMode ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>Ninguna</option>
                            {ESTRUCTURA_OPTIONS.map(opt => <option key={opt} value={opt} className={darkMode ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>{opt}</option>)}
                          </select>
                        </td>
                        <td className="border-r border-navy-900 bg-indigo-500/5 dark:bg-indigo-500/10">
                          <input
                            id={`cell-${idx}-16`}
                            type="number"
                            min="-1"
                            value={row.frac_buz30}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'frac_buz30')}
                            onChange={(e) => handleCellChange(idx, 'frac_buz30', parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                          />
                        </td>
                        <td className="border-r border-navy-900 bg-indigo-500/5 dark:bg-indigo-500/10">
                          <input
                            id={`cell-${idx}-17`}
                            type="number"
                            min="-1"
                            value={row.frac_buz60}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'frac_buz60')}
                            onChange={(e) => handleCellChange(idx, 'frac_buz60', parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                          />
                        </td>
                        <td className="border-r border-navy-900 bg-indigo-500/5 dark:bg-indigo-500/10">
                          <input
                            id={`cell-${idx}-18`}
                            type="number"
                            min="-1"
                            value={row.frac_buz90}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'frac_buz90')}
                            onChange={(e) => handleCellChange(idx, 'frac_buz90', parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                          />
                        </td>
                        <td className="border-r border-navy-900 text-center py-2 bg-indigo-500/5 dark:bg-indigo-500/10 text-slate-400 font-semibold select-none">
                          {sBuz30 + sBuz60 + sBuz90}
                        </td>
                        <td className="border-r border-navy-900 bg-indigo-500/5 dark:bg-indigo-500/10 py-2 text-center">
                          {errFn ? (
                            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="La suma de buzamientos no coincide con el conteo general de fracturas naturales">
                              <X size={14} className="stroke-[3]" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                              <Check size={14} className="stroke-[3]" />
                            </span>
                          )}
                        </td>

                        {/* Condiciones de Discontinuidades / Relleno */}
                        <td className="border-r border-navy-900 bg-amber-500/5 dark:bg-amber-500/10" style={getCellTdStyle(idx, 'abertura')}>
                          <input
                            id={`cell-${idx}-19`}
                            type="number"
                            min="-1"
                            step="0.01"
                            value={row.abertura}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'abertura')}
                            onChange={(e) => handleCellChange(idx, 'abertura', parseFloat(e.target.value) || 0)}
                            className={`w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded ${getCellAlertClass(idx, 'abertura')}`}
                          />
                        </td>
                        <td className="border-r border-navy-900 bg-amber-500/5 dark:bg-amber-500/10">
                          <input
                            id={`cell-${idx}-20`}
                            type="number"
                            min="-1"
                            max="9"
                            value={row.rugosidad}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'rugosidad')}
                            onChange={(e) => handleCellChange(idx, 'rugosidad', parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                          />
                        </td>
                        <td className="border-r border-navy-900 bg-amber-500/5 dark:bg-amber-500/10">
                          <input
                            id={`cell-${idx}-21`}
                            type="number"
                            min="-1"
                            max="20"
                            value={row.jrc10}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'jrc10')}
                            onChange={(e) => handleCellChange(idx, 'jrc10', parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                          />
                        </td>
                        <td className="border-r border-navy-900 bg-amber-500/5 dark:bg-amber-500/10 py-2 text-center">
                          {errRugJrc ? (
                            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="Inconsistencia cualitativa vs JRC10">
                              <X size={14} className="stroke-[3]" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                              <Check size={14} className="stroke-[3]" />
                            </span>
                          )}
                        </td>
                        {(() => {
                          const style = getIntemperismoStyle(row.intemperismo);
                          return (
                            <td className="border-r border-navy-900" style={getCellTdStyle(idx, 'intemperismo', { backgroundColor: style.backgroundColor })}>
                              <select
                                id={`cell-${idx}-22`}
                                value={row.intemperismo}
                                onKeyDown={(e) => handleKeyDown(e, idx, 'intemperismo')}
                                onChange={(e) => handleCellChange(idx, 'intemperismo', e.target.value)}
                                className={`w-full bg-transparent border-0 px-1 py-1 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded text-center font-bold ${getCellAlertClass(idx, 'intemperismo')}`}
                                style={{ color: style.color }}
                              >
                                {INTEMPERISMO_OPTIONS.map(opt => (
                                  <option key={opt} value={opt} className={darkMode ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>
                                    {opt === "-1" ? "S/D" : opt}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })()}

                        <td className="border-r border-navy-900 bg-amber-500/5 dark:bg-amber-500/10">
                          <select
                            id={`cell-${idx}-23`}
                            value={row.relleno1}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'relleno1')}
                            onChange={(e) => handleCellChange(idx, 'relleno1', e.target.value)}
                            className="w-full bg-transparent border-0 px-1 py-1 text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded"
                          >
                            {RELLENO_OPTIONS.map(opt => <option key={opt} value={opt} className={darkMode ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>{opt === "-1" ? "S/D" : opt}</option>)}
                          </select>
                        </td>
                        <td className="border-r border-navy-900 bg-amber-500/5 dark:bg-amber-500/10">
                          <select
                            id={`cell-${idx}-24`}
                            value={row.relleno2 || "-1"}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'relleno2')}
                            onChange={(e) => handleCellChange(idx, 'relleno2', e.target.value)}
                            className="w-full bg-transparent border-0 px-1 py-1 text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded"
                          >
                            <option value="-1" className={darkMode ? "bg-navy-950 text-slate-500" : "bg-white text-slate-400"}>Ninguno</option>
                            {RELLENO_OPTIONS.filter(o => o !== "-1").map(opt => <option key={opt} value={opt} className={darkMode ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>{opt}</option>)}
                          </select>
                        </td>
                        <td className="border-r border-navy-900 bg-amber-500/5 dark:bg-amber-500/10" style={getCellTdStyle(idx, 'espesor')}>
                          <input
                            id={`cell-${idx}-25`}
                            type="number"
                            min="-1"
                            step="0.1"
                            value={row.espesor}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'espesor')}
                            onChange={(e) => handleCellChange(idx, 'espesor', parseFloat(e.target.value) || 0)}
                            className={`w-full bg-transparent border-0 px-2 py-1 text-center focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded ${getCellAlertClass(idx, 'espesor')}`}
                          />
                        </td>
                        <td className="border-r border-navy-900 bg-amber-500/5 dark:bg-amber-500/10 py-2 text-center">
                          {errAbertRell ? (
                            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-red-500/10 text-red-500" title="Inconsistencia de abertura: se declaró relleno >0mm pero abertura =0mm o viceversa">
                              <X size={14} className="stroke-[3]" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center p-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                              <Check size={14} className="stroke-[3]" />
                            </span>
                          )}
                        </td>
                        {(() => {
                          const style = getAguaStyle(row.agua_obs);
                          return (
                            <td className="border-r border-navy-900" style={getCellTdStyle(idx, 'agua_obs', { backgroundColor: style.backgroundColor })}>
                              <select
                                id={`cell-${idx}-26`}
                                value={row.agua_obs}
                                onKeyDown={(e) => handleKeyDown(e, idx, 'agua_obs')}
                                onChange={(e) => handleCellChange(idx, 'agua_obs', e.target.value)}
                                className="w-full bg-transparent border-0 px-1 py-1 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded text-center font-bold"
                                style={{ color: style.color }}
                              >
                                {AGUA_OPTIONS.map(opt => (
                                  <option key={opt} value={opt} className={darkMode ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })()}

                        {/* Campos Administrativos */}
                        <td className="border-r border-navy-900">
                          <span className="w-full block px-2 py-1 text-center text-slate-400 select-all font-medium">
                            {row.turno ? (lastRowGeologo(idx)) : "RD/RB"}
                          </span>
                        </td>
                        <td className="border-r border-navy-900 text-center py-2 text-slate-400 font-medium truncate px-1">
                          {lastRowFecha(idx)}
                        </td>
                        <td className="border-r border-navy-900">
                          <select
                            id={`cell-${idx}-27`}
                            value={row.turno || "D"}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'turno')}
                            onChange={(e) => handleCellChange(idx, 'turno', e.target.value)}
                            className="w-full bg-transparent border-0 px-1 py-1 text-slate-300 focus:outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 rounded text-center"
                          >
                            <option value="D" className={darkMode ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>Día</option>
                            <option value="N" className={darkMode ? "bg-navy-950 text-slate-300" : "bg-white text-slate-800"}>Noche</option>
                          </select>
                        </td>
                        <td className="border-r border-navy-900">
                          <input
                            id={`cell-${idx}-28`}
                            type="text"
                            value={row.comentarios || ""}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'comentarios')}
                            onChange={(e) => handleCellChange(idx, 'comentarios', e.target.value)}
                            className="w-full bg-transparent border-0 px-2 py-1 focus:outline-none text-slate-300 focus:ring-1 focus:ring-blue-500 rounded"
                          />
                        </td>

                        {/* RMR'76 Result summary */}
                        <td
                          className="sticky right-[144px] z-10 text-center font-bold py-2"
                          style={{
                            background: darkMode
                              ? 'linear-gradient(rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.1)), rgb(var(--navy-950))'
                              : 'linear-gradient(rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.05)), rgb(var(--navy-950))',
                            boxShadow: 'inset 1px 0 0 0 rgb(var(--navy-900)), inset -1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), -1px 0 0 0 rgb(var(--navy-900))'
                          }}
                        >
                          {rmrRes.error || rmrRes.rmr_76 === undefined ? (
                            <span className="text-red-500 dark:text-red-400 text-xs uppercase font-black">ERR</span>
                          ) : (
                            <span className={`px-2.5 py-0.5 rounded text-xs font-black border transition-all ${rmrRes.rmr_76 >= 81 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20' :
                              rmrRes.rmr_76 >= 61 ? 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20' :
                                rmrRes.rmr_76 >= 41 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20' :
                                  'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                              }`}>
                              {rmrRes.rmr_76}
                            </span>
                          )}
                        </td>

                        {/* RMR'89 Result summary */}
                        <td
                          className="sticky right-[64px] z-10 text-center font-bold py-2"
                          style={{
                            background: darkMode
                              ? 'linear-gradient(rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.15)), rgb(var(--navy-950))'
                              : 'linear-gradient(rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.1)), rgb(var(--navy-950))',
                            boxShadow: 'inset 1px 0 0 0 rgb(var(--navy-900)), inset -1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), -1px 0 0 0 rgb(var(--navy-900))'
                          }}
                        >
                          {rmrRes.error || rmrRes.rmr_89 === undefined ? (
                            <span className="text-red-500 dark:text-red-400 text-xs uppercase font-black">ERR</span>
                          ) : (
                            <span className={`px-2.5 py-0.5 rounded text-xs font-black border transition-all ${rmrRes.rmr_89 >= 81 ? 'bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' :
                              rmrRes.rmr_89 >= 61 ? 'bg-blue-500/25 text-blue-600 dark:text-cyan-300 border-blue-500/30' :
                                rmrRes.rmr_89 >= 41 ? 'bg-amber-500/25 text-amber-600 dark:text-amber-300 border-amber-500/30' :
                                  'bg-red-500/25 text-red-600 dark:text-red-400 border-red-500/30'
                              }`}>
                              {rmrRes.rmr_89}
                            </span>
                          )}
                        </td>

                        {/* Botón Eliminar */}
                        <td
                          className="sticky right-0 z-10 bg-navy-950 text-center py-2"
                          style={{
                            boxShadow: 'inset 1px 0 0 0 rgb(var(--navy-900)), inset 0 -1px 0 0 rgb(var(--navy-900)), -1px 0 0 0 rgb(var(--navy-900))'
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCorridaRow(idx);
                            }}
                            className="p-1.5 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 shadow-sm active:scale-90 flex items-center justify-center mx-auto"
                            title="Eliminar corrida"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCorridas.length === 0 && (
                    <tr>
                      <td colSpan={46} className="py-12 text-center text-slate-500 text-xs">
                        {corridas.length === 0
                          ? 'Sin corridas geotécnicas registradas. Haz clic en "Agregar Corrida" para comenzar el logueo.'
                          : 'Ninguna corrida coincide con los filtros de búsqueda. Presiona "Limpiar" para restablecer.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Litología Datalists */}
            <datalist id="lito1-options-list">
              {LITO1_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {getLitoOptionLabel(opt)}
                </option>
              ))}
            </datalist>
            <datalist id="lito2-options-list">
              <option value="-1">Ninguna</option>
              {LITO2_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {getLitoOptionLabel(opt)}
                </option>
              ))}
            </datalist>
            <datalist id="lito3-options-list">
              <option value="-1">Ninguna</option>
              {LITO3_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {getLitoOptionLabel(opt)}
                </option>
              ))}
            </datalist>
          </>
        ) : activeSubTab === 'qaqc' ? (
          <QaqcAnalysisPanel
            corridas={corridas}
            alerts={alerts}
            waterTableM={waterTableM}
            onFocusField={onFocusField || (() => { })}
            onSwitchTab={setActiveSubTab}
            darkMode={darkMode}
          />
        ) : null}
      </div>

      {/* Modal Registrar Nuevo Taladro */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-xl border border-navy-800 space-y-4 text-left shadow-2xl bg-navy-900/90">
            <h3 className="text-lg font-bold text-slate-100 tracking-wide border-b border-navy-800 pb-2 uppercase text-sm">
              Crear Nuevo Taladro desde Cero
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Código del Taladro</label>
                <input
                  type="text"
                  required
                  placeholder="ej. FEGT25-002"
                  value={newTaladroName}
                  onChange={(e) => setNewTaladroName(e.target.value.toUpperCase())}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Proyecto</label>
                  <select
                    value={newProyecto}
                    onChange={(e) => setNewProyecto(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Proyecto A">Proyecto A</option>
                    <option value="Proyecto B">Proyecto B</option>
                    <option value="Proyecto C">Proyecto C</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Geólogo</label>
                  <input
                    type="text"
                    required
                    value={newGeologo}
                    onChange={(e) => setNewGeologo(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Diámetro</label>
                  <select
                    value={newDiametro}
                    onChange={(e) => setNewDiametro(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 focus:outline-none"
                  >
                    <option value="HQ3">HQ3</option>
                    <option value="NQ3">NQ3</option>
                    <option value="PQ3">PQ3</option>
                    <option value="HQ">HQ</option>
                    <option value="NQ">NQ</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Inclinación (&deg;)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newInclinacion}
                    onChange={(e) => setNewInclinacion(parseFloat(e.target.value) || 0)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Campaña</label>
                  <input
                    type="text"
                    required
                    value={newCampana}
                    onChange={(e) => setNewCampana(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Turno</label>
                  <select
                    value={newTurno}
                    onChange={(e) => setNewTurno(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 focus:outline-none"
                  >
                    <option value="D">Día</option>
                    <option value="N">Noche</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-navy-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  Crear Taladro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Renombrar Taladro */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-sm p-6 rounded-xl border border-navy-800 space-y-4 text-left shadow-2xl bg-navy-900/90">
            <h3 className="text-lg font-bold text-slate-100 tracking-wide border-b border-navy-800 pb-2 uppercase text-sm">
              Renombrar Taladro Activo
            </h3>

            <form onSubmit={handleRenameSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Nuevo Código del Taladro</label>
                <input
                  type="text"
                  required
                  placeholder="ej. FEGT25-001A"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value.toUpperCase())}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-sm tracking-wider"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-navy-800">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  Renombrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Selección de Campos para Exportar */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-5xl p-6 rounded-xl border border-navy-800 flex flex-col shadow-2xl bg-navy-900/95 max-h-[90vh]">
            <div className="border-b border-navy-800 pb-3 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-100 tracking-wide uppercase text-sm">
                  Configurar Exportación a Excel
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Seleccione las columnas que desea incluir en el reporte Excel para el taladro activo <span className="text-cyan-400 font-bold">{activeTaladroName}</span>.
                </p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-navy-800/50 rounded-lg transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {EXPORT_GROUPS.map(groupName => {
                  const groupFields = EXPORT_FIELDS.filter(f => f.group === groupName);
                  const allChecked = groupFields.every(f => exportFieldsConfig[f.key]);

                  return (
                    <div key={groupName} className="bg-navy-950/50 border border-navy-800 p-4 rounded-xl space-y-3 shadow-inner">
                      <div className="flex justify-between items-center pb-2 border-b border-navy-800/40">
                        <span className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                          {groupName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...exportFieldsConfig };
                            groupFields.forEach(f => {
                              updated[f.key] = !allChecked;
                            });
                            setExportFieldsConfig(updated);
                          }}
                          className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors font-bold uppercase"
                        >
                          {allChecked ? 'Deseleccionar' : 'Seleccionar'}
                        </button>
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {groupFields.map(field => (
                          <label
                            key={field.key}
                            className="flex items-center justify-between text-xs text-slate-300 hover:text-slate-100 transition-colors cursor-pointer select-none py-1.5 px-2 hover:bg-navy-900/30 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!exportFieldsConfig[field.key]}
                                onChange={() => {
                                  setExportFieldsConfig(prev => ({
                                    ...prev,
                                    [field.key]: !prev[field.key]
                                  }));
                                }}
                                className="w-4 h-4 rounded border-navy-700 bg-navy-950 text-cyan-500 focus:ring-cyan-500/20 cursor-pointer"
                              />
                              <span className="font-medium">{field.label}</span>
                            </div>
                            {field.isCheck && (
                              <span className="text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                QA/QC
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-navy-800 shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const allTrue: Record<string, boolean> = {};
                    EXPORT_FIELDS.forEach(f => {
                      allTrue[f.key] = true;
                    });
                    setExportFieldsConfig(allTrue);
                  }}
                  className="px-3 py-1.5 bg-navy-850 hover:bg-navy-800 text-slate-300 rounded-lg text-xs font-semibold transition-all active:scale-95 border border-navy-800 flex-1 sm:flex-initial"
                >
                  Seleccionar Todos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const allFalse: Record<string, boolean> = {};
                    EXPORT_FIELDS.forEach(f => {
                      allFalse[f.key] = false;
                    });
                    setExportFieldsConfig(allFalse);
                  }}
                  className="px-3 py-1.5 bg-navy-850 hover:bg-navy-800 text-slate-300 rounded-lg text-xs font-semibold transition-all active:scale-95 border border-navy-800 flex-1 sm:flex-initial"
                >
                  Deseleccionar Todos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pre: Record<string, boolean> = {};
                    EXPORT_FIELDS.forEach(f => {
                      pre[f.key] = !f.isCheck && f.key !== 'rmr76' && f.key !== 'rmr89';
                    });
                    setExportFieldsConfig(pre);
                  }}
                  className="px-3 py-1.5 bg-navy-850 hover:bg-navy-800 text-slate-300 rounded-lg text-xs font-semibold transition-all active:scale-95 border border-navy-800 flex-1 sm:flex-initial"
                >
                  Predeterminado
                </button>
              </div>

              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95 w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={performExportExcel}
                  className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 w-full sm:w-auto"
                >
                  Exportar Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeTaladroName={activeTaladroName}
        onImport={(importedRows, createNewWithName) => {
          if (onImportExcel) {
            onImportExcel(importedRows, createNewWithName);
          } else {
            onCorridasChange(importedRows);
          }
        }}
      />
    </div>
  );

  function lastRowTaladroName(_idx: number) {
    return activeTaladroName || "FEGT25-001";
  }

  function lastRowGeologo(_idx: number) {
    const parentEl = document.getElementById('geologo-header-val');
    return parentEl?.textContent || "RD/RB";
  }

  function lastRowFecha(_idx: number) {
    const parentEl = document.getElementById('fecha-header-val');
    return parentEl?.textContent || new Date().toISOString().split('T')[0];
  }
}