import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  RotateCcw,
  FileSpreadsheet,
  Download,
  Layers,
  Shield,
  Ruler,
  Check
} from 'lucide-react';
import type { Corrida } from '../DataGridLGG';
import { calculateRowRmr } from '../../../utils/formulaEngine';
import { STRENGTH_CATALOG } from '../../../utils/catalogData';

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

const DEFAULT_WIDTHS: Record<string, number> = {
  corrida: 8,
  taladro: 12,
  de: 10,
  a: 10,
  perf: 10,
  rec_m: 12,
  rqd_m: 15,
  lrf_m: 12,
  small_frag_m: 12,
  lito1: 10,
  lito2: 10,
  lito3: 10,
  resistencia: 15,
  intemperismo: 12,
  agua_obs: 10,
  rmr76: 10,
  rmr89: 10
};

interface LggExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  corridas: Corrida[];
  waterTableM: number;
  activeTaladroName: string;
  darkMode: boolean;
}

export default function LggExportModal({
  isOpen,
  onClose,
  corridas,
  waterTableM,
  activeTaladroName,
  darkMode
}: LggExportModalProps) {
  const [exportFieldsConfig, setExportFieldsConfig] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    EXPORT_FIELDS.forEach(f => {
      initial[f.key] = !f.isCheck && f.key !== 'rmr76' && f.key !== 'rmr89';
    });
    return initial;
  });

  if (!isOpen) return null;

  const lastRowTaladroName = () => activeTaladroName || "FEGT25-001";
  const lastRowGeologo = () => {
    const parentEl = document.getElementById('geologo-header-val');
    return parentEl?.textContent || "RD/RB";
  };
  const lastRowFecha = () => {
    const parentEl = document.getElementById('fecha-header-val');
    return parentEl?.textContent || new Date().toISOString().split('T')[0];
  };

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
      case 'taladro': return lastRowTaladroName();
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
      case 'geologo': return row.turno ? lastRowGeologo() : 'RD/RB';
      case 'fecha': return lastRowFecha();
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
      const charWidthFromUi = DEFAULT_WIDTHS[f.key] || 12;
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
        'Sondaje': lastRowTaladroName(),
        'Fecha': lastRowFecha(),
        'Logueador': lastRowGeologo(),
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
    onClose();
  };

  const toggleField = (key: string) => {
    setExportFieldsConfig(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-navy-950 border border-navy-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Exportador Avanzado a Excel</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Taladro Activo: <span className="font-semibold text-emerald-400">{activeTaladroName}</span> • Selecciona las columnas a incluir
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-navy-900 rounded-lg transition-colors active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {EXPORT_GROUPS.map(grp => {
              const groupFields = EXPORT_FIELDS.filter(f => f.group === grp);
              const groupIcons: Record<string, React.ReactNode> = {
                'Intervalo y Perforación': <Layers size={14} className="text-blue-400" />,
                'Físico y Recuperación': <Ruler size={14} className="text-cyan-400" />,
                'Geología y Alteración': <Shield size={14} className="text-purple-400" />,
                'Registro Estructural': <Layers size={14} className="text-indigo-400" />,
                'Discontinuidades y Relleno': <Shield size={14} className="text-amber-400" />,
                'Administración y Notas': <Layers size={14} className="text-slate-400" />,
                'Cálculos de RMR': <Shield size={14} className="text-emerald-400" />
              };

              return (
                <div key={grp} className="bg-navy-900/40 border border-navy-800/60 rounded-xl p-4 flex flex-col space-y-3">
                  <div className="flex items-center gap-2 border-b border-navy-800/85 pb-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {groupIcons[grp] || <Layers size={14} />}
                    <span>{grp}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {groupFields.map(f => {
                      const active = exportFieldsConfig[f.key];
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => toggleField(f.key)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-[11px] font-medium border text-left transition-all ${
                            active
                              ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                              : 'bg-navy-950/30 border-navy-800/50 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                            active
                              ? 'border-blue-500 bg-blue-600 text-slate-100'
                              : 'border-navy-700 bg-navy-950/80'
                          }`}>
                            {active && <Check size={10} strokeWidth={3} />}
                          </div>
                          <span className="truncate">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 border-t border-navy-800 shrink-0 bg-navy-950/50">
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
              onClick={onClose}
              className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95 w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={performExportExcel}
              className="bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 w-full sm:w-auto flex items-center justify-center gap-1.5"
            >
              <Download size={14} />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
