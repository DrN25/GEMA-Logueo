import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  Activity,
  Layers,
  BarChart3,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Zap,
  MapPin,
  Tag
} from 'lucide-react';
import type { ValidationAlert } from '../../../utils/qaqcValidator';
import { calculateRowRmr } from '../../../utils/formulaEngine';

interface Corrida {
  corrida: number;
  de: number;
  a: number;
  rec_m: number;
  rqd_m: number;
  lrf_m: number;
  small_frag_m: number;
  lito1: string;
  resistencia: string;
  frac_nat: number;
  frac_buz30: number;
  frac_buz60: number;
  frac_buz90: number;
  abertura: number;
  rugosidad: number;
  jrc10: number;
  intemperismo: string;
  relleno1: string;
  espesor: number;
  agua_obs: string;
  turno?: string;
  comentarios?: string;
}

interface LggQaqcPanelProps {
  corridas: Corrida[];
  alerts: ValidationAlert[];
  waterTableM: number;
  onFocusField?: (fieldId: string) => void;
  onSwitchTab?: (tab: 'lgg' | 'qaqc') => void;
  darkMode?: boolean;
}

// Safe float parser to prevent NaN and Infinity propagation
const safeFloat = (val: any, fallback = 0.0): number => {
  const parsed = parseFloat(val);
  return isNaN(parsed) || !isFinite(parsed) ? fallback : parsed;
};

export default function LggQaqcPanel({
  corridas = [],
  alerts = [],
  waterTableM,
  onFocusField,
  onSwitchTab,
  darkMode: _darkMode = true
}: LggQaqcPanelProps) {
  try {
    const safeCorridas = Array.isArray(corridas) ? corridas : [];
    const safeAlerts = Array.isArray(alerts) ? alerts : [];

    const getAlertContext = (fieldId: string) => {
      if (!fieldId) return { tab: 'LGG', column: 'General' };

      if (fieldId.startsWith('survey-')) {
        const parts = fieldId.split('-');
        const colName = parts[1] || '';
        let column = 'Lectura';
        if (colName === 'depth') column = 'Profundidad';
        else if (colName === 'dip') column = 'Dip';
        else if (colName === 'azimuth') column = 'Azimut';
        return { tab: 'Survey', column };
      }

      const parts = fieldId.split('-');
      const key = parts[0];
      let column = 'General';
      switch (key) {
        case 'de': column = 'Desde'; break;
        case 'a': column = 'Hasta'; break;
        case 'rec_m': column = 'Recuperación'; break;
        case 'rqd_m': column = 'RQD'; break;
        case 'lrf_m': column = 'LRF'; break;
        case 'small_frag_m': column = 'Fragmentos < 10cm'; break;
        case 'frac_nat': column = 'Fracturas General'; break;
        case 'abertura': column = 'Abertura'; break;
        case 'espesor': column = 'Espesor'; break;
        case 'intemperismo': column = 'Intemperismo'; break;
        case 'resistencia': column = 'Resistencia'; break;
      }
      return { tab: 'LGG', column };
    };

    // --- Calculations ---
    const totalTramos = safeCorridas.length;

    let totalPerf = 0;
    let totalRec = 0;
    let totalRqd = 0;
    let totalLrf = 0;
    let totalSmall = 0;
    let rmrSum = 0;
    let rmrCount = 0;

    // Breakdown counts
    const rqdCounts = { excelent: 0, good: 0, fair: 0, poor: 0, veryPoor: 0 };
    const rmrCounts = { muyBuena: 0, buena: 0, regular: 0, mala: 0, muyMala: 0 };

    safeCorridas.forEach(row => {
      const de = safeFloat(row.de);
      const a = safeFloat(row.a);
      const rec_m = safeFloat(row.rec_m);
      const rqd_m = safeFloat(row.rqd_m);
      const lrf_m = safeFloat(row.lrf_m);
      const small_frag_m = safeFloat(row.small_frag_m);

      const perf = Math.max(0, a - de);
      totalPerf += perf;
      totalRec += rec_m;
      totalRqd += rqd_m;
      totalLrf += lrf_m;
      totalSmall += small_frag_m;

      // RQD Quality breakdown
      const rqdPct = perf > 0 ? (rqd_m / perf) * 100 : 0;
      const rqdPctClean = isNaN(rqdPct) || !isFinite(rqdPct) ? 0 : rqdPct;
      if (rqdPctClean >= 90) rqdCounts.excelent++;
      else if (rqdPctClean >= 75) rqdCounts.good++;
      else if (rqdPctClean >= 50) rqdCounts.fair++;
      else if (rqdPctClean >= 25) rqdCounts.poor++;
      else rqdCounts.veryPoor++;

      // RMR calculations
      const rmrRes = calculateRowRmr(row, waterTableM);
      if (rmrRes && !rmrRes.error && rmrRes.rmr_89 !== undefined) {
        const val = safeFloat(rmrRes.rmr_89, NaN);
        if (!isNaN(val) && isFinite(val)) {
          rmrSum += val;
          rmrCount++;

          if (val >= 81) rmrCounts.muyBuena++;
          else if (val >= 61) rmrCounts.buena++;
          else if (val >= 41) rmrCounts.regular++;
          else if (val >= 21) rmrCounts.mala++;
          else rmrCounts.muyMala++;
        }
      }
    });

    const recPond = totalPerf > 0 ? (totalRec / totalPerf) * 100 : 0;
    const recPondClean = isNaN(recPond) || !isFinite(recPond) ? 0 : recPond;

    const rqdPond = totalRec > 0 ? (totalRqd / totalRec) * 100 : 0;
    const rqdPondClean = isNaN(rqdPond) || !isFinite(rqdPond) ? 0 : rqdPond;

    const avgRmr89 = rmrCount > 0 ? rmrSum / rmrCount : 0;
    const avgRmr89Clean = isNaN(avgRmr89) || !isFinite(avgRmr89) ? 0 : avgRmr89;

    const criticalCount = safeAlerts.filter(a => a && a.type === 'CRITICAL').length;
    const warningCount = safeAlerts.filter(a => a && a.type === 'WARNING').length;
    const vacioCount = safeAlerts.filter(a => a && a.type === 'VACIO').length;

    // Jump to grid handler
    const handleAlertFix = (fieldId: string) => {
      if (onSwitchTab) onSwitchTab('lgg');
      setTimeout(() => {
        if (onFocusField) onFocusField(fieldId);
      }, 80);
    };

    return (
      <div className="space-y-6 pb-12 animate-fade-in text-slate-200">

        {/* Overview stats layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

          {/* Total Tramos Card */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tramos Logueados</span>
              <Layers size={16} className="text-cyan-400" />
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-100">{totalTramos}</span>
              <span className="text-xs text-slate-500 block mt-1">{totalPerf.toFixed(2)} m perforados</span>
            </div>
          </div>

          {/* Recuperación Ponderada Card */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recuperación Ponderada</span>
              <Zap size={16} className={recPondClean >= 95 ? "text-emerald-400" : "text-amber-400"} />
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-100">{recPondClean.toFixed(1)}%</span>
              <span className="text-xs text-slate-500 block mt-1">{totalRec.toFixed(2)} m de core recuperado</span>
            </div>
          </div>

          {/* RQD Ponderado Card */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">RQD Ponderado</span>
              <Activity size={16} className={rqdPondClean >= 75 ? "text-emerald-400" : rqdPondClean >= 50 ? "text-amber-400" : "text-red-400"} />
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-100">{rqdPondClean.toFixed(1)}%</span>
              <span className="text-xs text-slate-500 block mt-1">
                Calidad: <span className="font-bold text-slate-300">
                  {rqdPondClean >= 90 ? 'Excelente' : rqdPondClean >= 75 ? 'Buena' : rqdPondClean >= 50 ? 'Regular' : rqdPondClean >= 25 ? 'Mala' : 'Muy Mala'}
                </span>
              </span>
            </div>
          </div>

          {/* Promedio RMR Card */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Promedio RMR'89</span>
              <BarChart3 size={16} className="text-emerald-400" />
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-100">{avgRmr89Clean.toFixed(1)}</span>
              <span className="text-xs text-slate-500 block mt-1">
                Macizo: <span className="font-bold text-slate-300">
                  {avgRmr89Clean >= 81 ? 'Clase I' : avgRmr89Clean >= 61 ? 'Clase II' : avgRmr89Clean >= 41 ? 'Clase III' : avgRmr89Clean >= 21 ? 'Clase IV' : 'Clase V'}
                </span>
              </span>
            </div>
          </div>

          {/* Auditoría QA/QC Card */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">QA/QC en LGG</span>
              {criticalCount > 0 ? (
                <ShieldAlert size={16} className="text-red-400 animate-pulse" />
              ) : (
                <ShieldCheck size={16} className="text-emerald-400" />
              )}
            </div>
            <div className="mt-4">
              <div className="flex gap-2.5">
                <div>
                  <span className={`text-lg font-black ${criticalCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>{criticalCount}</span>
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Críticos</span>
                </div>
                <div>
                  <span className={`text-lg font-black ${warningCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{warningCount}</span>
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Avisos</span>
                </div>
                <div>
                  <span className={`text-lg font-black ${vacioCount > 0 ? 'text-slate-400' : 'text-slate-500'}`}>{vacioCount}</span>
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Vacíos</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Main dashboard breakdown grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Core Physical Balance Visualizer */}
          <div className="glass-panel p-5 rounded-xl border border-navy-800/40 bg-navy-900/10 lg:col-span-2 space-y-4 shadow-xl">
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                Distribución Física del Testigo por Corrida
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Representación visual continua del balance físico y calidad del núcleo recuperado
              </p>
            </div>

            {/* Color Legend */}
            <div className="flex flex-wrap gap-4 py-2 border-y border-navy-800/40 text-[10px] uppercase font-bold tracking-wider">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500" />
                <span className="text-slate-300">RQD (&ge;10cm)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-cyan-500" />
                <span className="text-slate-300">Roca Fracturada (LRF)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-purple-500" />
                <span className="text-slate-300">Finos (&lt;10cm)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-950/80 border border-red-500/30" />
                <span className="text-slate-300">Pérdida de Core</span>
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {safeCorridas.map((c, idx) => {
                const de = safeFloat(c.de);
                const a = safeFloat(c.a);
                const rec_m = safeFloat(c.rec_m);
                const rqd_m = safeFloat(c.rqd_m);
                const lrf_m = safeFloat(c.lrf_m);
                const small_frag_m = safeFloat(c.small_frag_m);

                const perf = Math.max(0.01, a - de);
                const lost = Math.max(0, perf - rec_m);

                const rqdPct = (rqd_m / perf) * 100;
                const rqdPctClean = isNaN(rqdPct) || !isFinite(rqdPct) ? 0 : Math.min(100, Math.max(0, rqdPct));

                const lrfPct = (lrf_m / perf) * 100;
                const lrfPctClean = isNaN(lrfPct) || !isFinite(lrfPct) ? 0 : Math.min(100, Math.max(0, lrfPct));

                const smallPct = (small_frag_m / perf) * 100;
                const smallPctClean = isNaN(smallPct) || !isFinite(smallPct) ? 0 : Math.min(100, Math.max(0, smallPct));

                const lostPct = (lost / perf) * 100;
                const lostPctClean = isNaN(lostPct) || !isFinite(lostPct) ? 0 : Math.min(100, Math.max(0, lostPct));

                // Check if physical balance exceeded
                const sumFrags = rqd_m + lrf_m + small_frag_m;
                const hasBalanceErr = sumFrags > perf + 0.01 || rec_m > perf + 0.01 || rqd_m > rec_m + 0.01;

                return (
                  <div key={idx} className="space-y-1 bg-navy-950/45 p-2 rounded-lg border border-navy-900/60">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-cyan-400">Corrida {c.corrida}</span>
                        <span className="text-slate-500 font-semibold">{de.toFixed(2)} - {a.toFixed(2)} m</span>
                      </div>
                      <div className="flex gap-3 text-[10px] text-slate-400 font-bold">
                        <span>Perf: {perf.toFixed(2)}m</span>
                        <span>Rec: {rec_m.toFixed(2)}m ({perf > 0 ? ((rec_m / perf) * 100).toFixed(0) : '0'}%)</span>
                        {hasBalanceErr && (
                          <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-1 rounded uppercase text-[8px] animate-pulse">ERROR FÍSICO</span>
                        )}
                      </div>
                    </div>

                    {/* Multi-segmented stacked progress bar */}
                    <div className="w-full h-3 rounded-full bg-navy-900 overflow-hidden flex border border-navy-800/40 relative">
                      {/* RQD */}
                      {rqd_m > 0 && (
                        <div
                          style={{ width: `${rqdPctClean}%` }}
                          className="bg-emerald-500 dark:bg-emerald-400 h-full transition-all"
                          title={`RQD: ${rqd_m.toFixed(2)}m (${rqdPctClean.toFixed(1)}%)`}
                        />
                      )}
                      {/* LRF */}
                      {lrf_m > 0 && (
                        <div
                          style={{ width: `${lrfPctClean}%` }}
                          className="bg-cyan-500 dark:bg-cyan-400 h-full transition-all"
                          title={`LRF: ${lrf_m.toFixed(2)}m (${lrfPctClean.toFixed(1)}%)`}
                        />
                      )}
                      {/* Small Frags */}
                      {small_frag_m > 0 && (
                        <div
                          style={{ width: `${smallPctClean}%` }}
                          className="bg-purple-500 dark:bg-purple-400 h-full transition-all"
                          title={`Frag < 10cm: ${small_frag_m.toFixed(2)}m (${smallPctClean.toFixed(1)}%)`}
                        />
                      )}
                      {/* Lost core */}
                      {lost > 0 && (
                        <div
                          style={{ width: `${lostPctClean}%` }}
                          className="bg-red-950/85 dark:bg-red-950/80 border-l border-red-500/20 h-full transition-all"
                          title={`Pérdida: ${lost.toFixed(2)}m (${lostPctClean.toFixed(1)}%)`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              {safeCorridas.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Agrega corridas geotécnicas para ver el balance físico de testigos.
                </div>
              )}
            </div>
          </div>

          {/* Quality Bins Breakdown (RQD and RMR) */}
          <div className="glass-panel p-5 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-6 shadow-xl">

            {/* RQD Classes */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Distribución de Calidad RQD
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Clasificación de calidad geotécnica según longitud RQD
                </p>
              </div>

              <div className="space-y-2 text-xs font-semibold">
                {[
                  { label: 'Excelente (>=90%)', count: rqdCounts.excelent, color: 'bg-emerald-500' },
                  { label: 'Buena (75-90%)', count: rqdCounts.good, color: 'bg-emerald-600' },
                  { label: 'Regular (50-75%)', count: rqdCounts.fair, color: 'bg-amber-500' },
                  { label: 'Mala (25-50%)', count: rqdCounts.poor, color: 'bg-orange-500' },
                  { label: 'Muy Mala (<25%)', count: rqdCounts.veryPoor, color: 'bg-red-600' },
                ].map((bin, i) => {
                  const pct = totalTramos > 0 ? (bin.count / totalTramos) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-slate-300">
                        <span>{bin.label}</span>
                        <span className="text-slate-400 font-bold">{bin.count} tramos ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-navy-950 overflow-hidden">
                        <div style={{ width: `${pct}%` }} className={`h-full ${bin.color}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RMR Classes */}
            <div className="space-y-3 pt-4 border-t border-navy-850">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Distribución de Clases RMR'89
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Clasificación cualitativa del macizo rocoso
                </p>
              </div>

              <div className="space-y-2 text-xs font-semibold">
                {[
                  { label: 'Muy Buena (I) (>80)', count: rmrCounts.muyBuena, color: 'bg-emerald-400' },
                  { label: 'Buena (II) (61-80)', count: rmrCounts.buena, color: 'bg-cyan-500' },
                  { label: 'Regular (III) (41-60)', count: rmrCounts.regular, color: 'bg-amber-400' },
                  { label: 'Mala (IV) (21-40)', count: rmrCounts.mala, color: 'bg-orange-500' },
                  { label: 'Muy Mala (V) (<=20)', count: rmrCounts.muyMala, color: 'bg-red-500' },
                ].map((bin, i) => {
                  const totalRmrRows = rmrCount;
                  const pct = totalRmrRows > 0 ? (bin.count / totalRmrRows) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-slate-300">
                        <span>{bin.label}</span>
                        <span className="text-slate-400 font-bold">{bin.count} tramos ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-navy-950 overflow-hidden">
                        <div style={{ width: `${pct}%` }} className={`h-full ${bin.color}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

        {/* Interactive Audit List */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-4 shadow-xl">
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Listado Auditor de Inconsistencias (QA/QC)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Detección reactiva de errores físicos de fragmentación y compatibilidades de litología y resistencia
            </p>
          </div>

          <div className="space-y-2.5">
            {safeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 border border-dashed border-navy-800 rounded-lg">
                <CheckCircle size={44} className="text-emerald-500/20 mb-2" />
                <p className="text-sm font-bold text-slate-300 uppercase tracking-wide">Perfecto</p>
                <p className="text-xs mt-1 text-slate-400">
                  No se detectaron inconsistencias de balance físico o compatibilidad de resistencia.
                </p>
              </div>
            ) : (
              [...safeAlerts]
                .sort((a, b) => (a?.type === 'CRITICAL' ? -1 : 1) - (b?.type === 'CRITICAL' ? -1 : 1))
                .map((alert, idx) => {
                  if (!alert) return null;
                  const isCritical = alert.type === 'CRITICAL';
                  const context = getAlertContext(alert.field);
                  return (
                    <div
                      key={idx}
                      onClick={() => handleAlertFix(alert.field)}
                      className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all hover:translate-x-1 active:scale-[0.99] flex justify-between items-center ${isCritical
                        ? 'bg-red-500/5 dark:bg-red-950/20 border-red-500/20 text-red-200 hover:bg-red-500/10 hover:border-red-500/35'
                        : 'bg-amber-500/5 dark:bg-amber-950/15 border-amber-500/25 text-amber-200 hover:bg-amber-500/10 hover:border-amber-500/35'
                        }`}
                    >
                      <div className="flex gap-3 items-start pr-4">
                        {isCritical ? (
                          <AlertOctagon size={18} className="text-red-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-2 flex-1 min-w-0">
                          {/* Badge row */}
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {/* Severity badge */}
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${isCritical
                              ? 'bg-red-500/20 border-red-500/40 text-red-300'
                              : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              }`}>
                              {isCritical ? 'Error crítico' : 'Aviso'}
                            </span>
                            {/* Tab badge */}
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800/70 border border-slate-700/60 text-slate-300">
                              <MapPin size={11} className="text-cyan-400 shrink-0" />
                              {context.tab}
                            </span>
                            {/* Column badge */}
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                              <Tag size={11} className="shrink-0" />
                              {context.column}
                            </span>
                          </div>
                          {/* Message */}
                          <p className="text-sm leading-snug text-slate-200 font-medium">{alert.message}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="flex items-center gap-1 bg-navy-950 hover:bg-navy-900 border border-navy-850 hover:border-navy-750 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 active:scale-95 shadow-sm"
                      >
                        <span>Corregir</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>

      </div>
    );
  } catch (e) {
    console.error("QA/QC Panel Render Error:", e);
    return (
      <div className="glass-panel p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-center text-red-400 my-8 max-w-xl mx-auto">
        <AlertOctagon className="mx-auto text-red-500 mb-2" size={36} />
        <h3 className="text-sm font-bold uppercase tracking-wider">Error al procesar QA/QC</h3>
        <p className="text-xs mt-1 text-slate-400">
          Ocurrió un error de cálculo o formato en los registros del taladro. Revise que los intervalos y metrajes del grid de logueo sean consistentes.
        </p>
      </div>
    );
  }
}
