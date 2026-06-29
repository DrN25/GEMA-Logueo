// RmrAnalysis.tsx
import { useState, useMemo } from 'react';
import { calculateRowRmr } from '../../utils/formulaEngine';
import { TrendingUp, Search, RotateCcw, Database, Award, Zap, Activity } from 'lucide-react';
import { LITHOLOGY_CATALOG } from '../../utils/catalogData';
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Label, Cell
} from 'recharts';
import RmrGrid from './components/RmrGrid';

// ─── Puntos de Control y Envolventes (Bieniawski Chart D) ───────────────────

const BIENIAWSKI_CTRL_MIN = [
  { x: 90, y: 0 },
  { x: 100, y: 8.35 },
  { x: 200, y: 59.11 },
  { x: 600, y: 95.36 },
  { x: 1650, y: 100 },
  { x: 2000, y: 100 }
];

const BIENIAWSKI_CTRL_MAX = [
  { x: 14, y: 0 },
  { x: 20, y: 6.57 },
  { x: 30, y: 16.87 },
  { x: 40, y: 27.17 },
  { x: 70, y: 56.66 },
  { x: 100, y: 74.17 },
  { x: 200, y: 92.59 },
  { x: 600, y: 99.78 },
  { x: 1000, y: 100 },
  { x: 2000, y: 100 }
];

const BIENIAWSKI_CTRL_MID = [
  { x: 35.5, y: 0 },
  { x: 40, y: 3.4 },
  { x: 50, y: 11.0 },
  { x: 70, y: 26.25 },
  { x: 100, y: 47.9 },
  { x: 150, y: 69.1 },
  { x: 200, y: 80.76 },
  { x: 300, y: 91.38 },
  { x: 500, y: 98.0 },
  { x: 1000, y: 100 },
  { x: 2000, y: 100 }
];

// ─── Puntos de Control (Priest & Hudson / FF) ───────────────────────────────

const LAMBDA_CTRL_MIN = [
  { x: 0, y: 57.14 },
  { x: 1.25, y: 56.75 },
  { x: 2.5, y: 55.58 },
  { x: 5, y: 51.98 },
  { x: 10, y: 42.08 },
  { x: 15, y: 31.92 },
  { x: 20, y: 23.09 },
  { x: 25, y: 16.48 },
  { x: 30, y: 11.34 },
  { x: 35, y: 7.66 },
  { x: 40, y: 5.23 }
];

const LAMBDA_CTRL_MAX = [
  { x: 7.5, y: 95.24 },
  { x: 10, y: 84.43 },
  { x: 15, y: 63.58 },
  { x: 20, y: 46.42 },
  { x: 25, y: 33.06 },
  { x: 30, y: 22.91 },
  { x: 35, y: 15.60 },
  { x: 40, y: 10.37 }
];

const DRILL_COLORS = [
  '#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80',
  '#60a5fa', '#facc15', '#2dd4bf', '#f87171', '#fb7185'
];

function getDrillColor(name: string): string {
  if (!name) return '#38bdf8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DRILL_COLORS.length;
  return DRILL_COLORS[index];
}

// ─── Helpers Matemáticos, de Calidad e Interpolación ───

function getRockClass(rmrScore: number): string {
  if (rmrScore >= 81) return "Muy Buena";
  if (rmrScore >= 61) return "Buena";
  if (rmrScore >= 41) return "Regular";
  if (rmrScore >= 21) return "Mala";
  return "Muy Mala";
}

function phTeoricoFn(ff: number): number {
  if (ff <= 0) return 100;
  return Math.min(100, 100 * Math.exp(-0.1 * ff) * (0.1 * ff + 1));
}

function interpolateY(ctrlPoints: { x: number; y: number }[], targetX: number, isLog: boolean = false): number {
  if (targetX <= ctrlPoints[0].x) return ctrlPoints[0].y;
  if (targetX >= ctrlPoints[ctrlPoints.length - 1].x) return ctrlPoints[ctrlPoints.length - 1].y;

  for (let i = 0; i < ctrlPoints.length - 1; i++) {
    const p1 = ctrlPoints[i];
    const p2 = ctrlPoints[i + 1];
    if (targetX >= p1.x && targetX <= p2.x) {
      if (isLog) {
        const logX1 = Math.log10(p1.x);
        const logX2 = Math.log10(p2.x);
        const logTarget = Math.log10(targetX);
        const t = (logTarget - logX1) / (logX2 - logX1);
        return p1.y + t * (p2.y - p1.y);
      } else {
        const t = (targetX - p1.x) / (p2.x - p1.x);
        return p1.y + t * (p2.y - p1.y);
      }
    }
  }
  return 0;
}

function bandStatus(rqd: number, spacingMm: number): 'dentro' | 'sobre' | 'bajo' {
  if (!spacingMm || spacingMm <= 0 || !isFinite(spacingMm)) return 'dentro';
  if (spacingMm < 14) return 'sobre';

  const rMin = interpolateY(BIENIAWSKI_CTRL_MIN, spacingMm, true);
  const rMax = interpolateY(BIENIAWSKI_CTRL_MAX, spacingMm, true);

  if (rqd > rMax) return 'sobre';
  if (rqd < rMin) return 'bajo';
  return 'dentro';
}

// ─── Componentes del Tooltip ───

const BienTooltip = ({ hoveredPoint }: any) => {
  if (!hoveredPoint) return null;
  const d = hoveredPoint;
  const minRqd = interpolateY(BIENIAWSKI_CTRL_MIN, d.spacing_mm, true);
  const maxRqd = interpolateY(BIENIAWSKI_CTRL_MAX, d.spacing_mm, true);

  return (
    <div className="bg-navy-950/95 border border-navy-700 rounded-xl p-2.5 text-[10px] shadow-2xl backdrop-blur-sm space-y-0.5 w-52 text-left pointer-events-none">
      <p className="font-extrabold text-cyan-400 border-b border-navy-800 pb-1 mb-1" style={{ color: getDrillColor(d.taladro) }}>
        📍 {d.taladro} — Corrida {d.corrida}
      </p>
      <p className="text-slate-100">
        Espaciamiento: <span className="text-cyan-300 font-bold">{d.spacing_mm} mm</span>
      </p>
      <p className="text-slate-300">
        RQD Medido: <span className="text-emerald-400 font-bold">{d.rqd_pct}%</span>
      </p>
      <p className="text-slate-400">
        Banda: <span className="text-slate-400">{minRqd.toFixed(0)}% - {maxRqd.toFixed(0)}%</span>
      </p>
      <p className="text-slate-300 font-semibold">
        Estado: <span className="text-emerald-400">
          {bandStatus(d.rqd_pct, d.spacing_mm) === 'dentro' ? '✓ Dentro' : '▲ Fuera'}
        </span>
      </p>
    </div>
  );
};

const MiniPhTooltip = ({ hoveredPoint }: any) => {
  if (!hoveredPoint) return null;
  const d = hoveredPoint;
  const ff = d.ff_per_m;

  return (
    <div className="bg-navy-950/95 border border-navy-700 rounded-xl p-2.5 text-[10px] shadow-2xl backdrop-blur-sm space-y-0.5 w-52 text-left pointer-events-none">
      <p className="font-extrabold text-cyan-400 border-b border-navy-800 pb-1 mb-1" style={{ color: getDrillColor(d.taladro) }}>
        📍 {d.taladro} — Corrida {d.corrida}
      </p>
      <p className="text-slate-100">
        FF: <span className="text-cyan-300 font-bold">{ff.toFixed(2)} fract/m</span>
      </p>
      <p className="text-slate-300">
        RQD Medido: <span className="text-emerald-400 font-bold">{d.rqd_pct}%</span>
      </p>
      <p className="text-slate-300">
        P&amp;H Teórico: <span className="text-slate-200">{d.ph_teorico}%</span>
      </p>
      <p className="text-slate-300">
        Δ: <span className={`font-semibold ${Math.abs(d.rqd_pct - d.ph_teorico) > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
          {(d.rqd_pct - d.ph_teorico).toFixed(1)}%
        </span>
      </p>
    </div>
  );
};

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
  abertura: number;
  rugosidad: number;
  jrc10: number;
  intemperismo: string;
  relleno1: string;
  espesor: number;
  agua_obs: string;
  frac_nat: number;
  tipo_est1?: string;
}

interface RmrAnalysisProps {
  corridas: Corrida[];
  waterTableM: number;
  activeTaladroName: string;
  geologo: string;
  fecha: string;
}

export default function RmrAnalysis({
  corridas,
  waterTableM,
  activeTaladroName,
  geologo,
  fecha
}: RmrAnalysisProps) {
  // States locales para filtros
  const [filterLito, setFilterLito] = useState<string>('');
  const [filterMaxDepth, setFilterMaxDepth] = useState<string>('');

  // Estados aplicados para el filtrado reactivo
  const [appliedLito, setAppliedLito] = useState<string>('');
  const [appliedMaxDepth, setAppliedMaxDepth] = useState<string>('');

  // Mostrar todas las columnas de Excel (por defecto true)
  const [showAllColumns, setShowAllColumns] = useState<boolean>(true);

  // --- MANEJADORES DE EVENTO DE FILTROS ---
  const handleApplyFilters = () => {
    setAppliedLito(filterLito);
    setAppliedMaxDepth(filterMaxDepth);
  };

  const handleClearFilters = () => {
    setFilterLito('');
    setFilterMaxDepth('');
    setAppliedLito('');
    setAppliedMaxDepth('');
  };

  // --- MANIPULACIÓN DIRECTA DEL DOM PARA HOVER DE TOOLTIPS ---
  const showTooltip = (e: any, d: any, type: 'bien' | 'ph') => {
    const tooltipEl = document.getElementById(`rmr-${type}-floating-tooltip`);
    if (!tooltipEl) return;

    let html = '';
    if (type === 'bien') {
      const minRqd = interpolateY(BIENIAWSKI_CTRL_MIN, d.spacing_mm, true);
      const maxRqd = interpolateY(BIENIAWSKI_CTRL_MAX, d.spacing_mm, true);
      html = `
        <div class="font-extrabold text-cyan-400 border-b border-navy-800 pb-1.5 mb-1 text-xs tracking-wide">
          Corrida ${d.corrida} (${d.prof_m} m)
        </div>
        <p class="text-slate-100 font-extrabold text-[11px]">
          Espaciamiento: <span class="text-cyan-300 font-black">${d.spacing_mm} mm</span>
        </p>
        <p class="text-blue-400 text-[10px]">
          Curva RQD mínimo: <span class="font-bold">${minRqd > 0 ? `${minRqd.toFixed(1)}%` : '0.0%'}</span>
        </p>
        <p class="text-orange-400 text-[10px]">
          Curva RQD máximo: <span class="font-bold">${maxRqd > 0 ? `${maxRqd.toFixed(1)}%` : '100.0%'}</span>
        </p>
        <p class="text-slate-300 text-[10px]">
          RQD Medido: <span class="text-emerald-400 font-bold">${d.rqd_pct}%</span>
        </p>
        <p class="text-slate-300 text-[10px]">
          Estado de Banda: <span class="font-semibold text-emerald-400">
            ${bandStatus(d.rqd_pct, d.spacing_mm) === 'dentro' ? '✓ Dentro' : '▲ Fuera'}
          </span>
        </p>
      `;
    } else {
      const ff = d.ff_per_m;
      const minRqd = interpolateY(LAMBDA_CTRL_MIN, ff, false);
      const maxRqd = interpolateY(LAMBDA_CTRL_MAX, ff, false);
      const delta = d.rqd_pct - d.ph_teorico;
      const deltaColorClass = Math.abs(delta) > 15 ? 'text-amber-400' : 'text-emerald-400';
      html = `
        <div class="font-extrabold text-cyan-400 border-b border-navy-800 pb-1.5 mb-1 text-xs tracking-wide">
          Corrida ${d.corrida} (${d.prof_m} m)
        </div>
        <p class="text-slate-100 font-extrabold text-[11px] mb-1">
          FF/1m = <span class="text-cyan-300 font-black">${ff.toFixed(2)} fract/m</span>
        </p>
        <p class="text-red-400 text-[10px]">
          Curva RQD mínimo: <span class="font-bold">${minRqd > 0 ? `${minRqd.toFixed(1)}%` : '0.0%'}</span>
        </p>
        <p class="text-blue-400 text-[10px]">
          Curva RQD máximo: <span class="font-bold">${maxRqd > 0 ? `${maxRqd.toFixed(1)}%` : '100.0%'}</span>
        </p>
        <p class="text-slate-300 text-[10px]">
          Priest &amp; Hudson teórico: <span class="text-slate-100 font-bold">${d.ph_teorico}%</span>
        </p>
        <p class="text-slate-300 text-[10px]">
          RQD Medido: <span class="text-emerald-400 font-bold">${d.rqd_pct}%</span>
        </p>
        <p class="text-slate-300 text-[10px]">
          Delta (Med - Teórico): <span class="font-semibold ${deltaColorClass}">
            ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%
          </span>
        </p>
      `;
    }

    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';

    const parentEl = tooltipEl.parentElement;
    if (parentEl) {
      const rect = parentEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      tooltipEl.style.left = `${x}px`;
      tooltipEl.style.top = `${y}px`;
    }
  };

  const moveTooltip = (e: any, type: 'bien' | 'ph') => {
    const tooltipEl = document.getElementById(`rmr-${type}-floating-tooltip`);
    if (!tooltipEl) return;
    const parentEl = tooltipEl.parentElement;
    if (parentEl) {
      const rect = parentEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      tooltipEl.style.left = `${x}px`;
      tooltipEl.style.top = `${y}px`;
    }
  };

  const hideTooltip = (type: 'bien' | 'ph') => {
    const tooltipEl = document.getElementById(`rmr-${type}-floating-tooltip`);
    if (tooltipEl) {
      tooltipEl.style.display = 'none';
    }
  };

  // Filtrado de corridas reactivo
  const filteredCorridas = corridas.filter(row => {
    if (appliedLito && row.lito1 !== appliedLito) {
      return false;
    }
    const maxD = appliedMaxDepth ? parseFloat(appliedMaxDepth) : Infinity;
    if (row.a > maxD) {
      return false;
    }
    return true;
  });

  // Calcular RMR para todas las corridas filtradas
  const calculatedRows = filteredCorridas.map((row, idx) => {
    const rmrRes = calculateRowRmr(row, waterTableM);
    return {
      row,
      idx,
      rmrRes
    };
  });

  const validRows = calculatedRows.filter(r => !r.rmrRes.error);

  // Calcular promedios generales
  const avgRmr89 = validRows.length > 0
    ? (validRows.reduce((sum, r) => sum + (r.rmrRes.rmr_89 || 0), 0) / validRows.length).toFixed(1)
    : "0.0";
  const avgRmr76 = validRows.length > 0
    ? (validRows.reduce((sum, r) => sum + (r.rmrRes.rmr_76 || 0), 0) / validRows.length).toFixed(1)
    : "0.0";
  const avgRqd = validRows.length > 0
    ? (validRows.reduce((sum, r) => sum + (r.rmrRes.rqd_pct || 0), 0) / validRows.length).toFixed(1)
    : "0.0";

  // Procesar puntos de datos optimizados para las gráficas de seguimiento
  const chartPoints = useMemo(() => {
    return validRows.map(r => {
      const res = r.rmrRes;
      const total_frac = res.total_frac ?? 0;
      const perf = res.perf ?? 1;
      const ff = total_frac > 0 ? total_frac / perf : 0;
      return {
        corrida: r.row.corrida,
        prof_m: parseFloat(((r.row.de + r.row.a) / 2).toFixed(2)),
        rqd_pct: res.rqd_pct ?? 0,
        spacing_mm: res.spacing_mm ?? 0,
        ff_per_m: parseFloat(ff.toFixed(4)),
        ph_teorico: parseFloat(phTeoricoFn(ff).toFixed(2)),
      };
    });
  }, [validRows]);

  const scatterBien = useMemo(() => {
    return chartPoints.map(p => ({ ...p, x: p.spacing_mm, y: p.rqd_pct }));
  }, [chartPoints]);

  const scatterPh = useMemo(() => {
    return chartPoints.map(p => ({ ...p, x: p.ff_per_m, y: p.rqd_pct }));
  }, [chartPoints]);

  const bienMinLine = useMemo(() => BIENIAWSKI_CTRL_MIN, []);
  const bienMaxLine = useMemo(() => BIENIAWSKI_CTRL_MAX, []);
  const bienMidLine = useMemo(() => BIENIAWSKI_CTRL_MID, []);

  const lambdaMinLine = useMemo(() => LAMBDA_CTRL_MIN, []);
  const lambdaMaxLine = useMemo(() => LAMBDA_CTRL_MAX, []);

  const phSuaveLine = useMemo(() => {
    const pts = [];
    for (let ff = 0; ff <= 40; ff += 1) {
      pts.push({ x: ff, y: parseFloat(phTeoricoFn(ff).toFixed(2)) });
    }
    return pts;
  }, []);

  return (
    <div className="space-y-6 select-none w-full animate-fade-in text-slate-100 h-full flex flex-col overflow-hidden">
      {/* Panel de Introducción */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
              Validación y Análisis de RMR
            </h2>
            <p className="text-xs text-slate-400">
              Evaluación geomecánica en tiempo real del Rock Mass Rating (RMR'76 y RMR'89) por corridas
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN INTERACTIVA SUPERIOR CON PANEL DE FILTROS + KPIS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 shrink-0">

        {/* Columna Izquierda: Filtros y KPIs */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Filtros */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-3.5 shadow-lg flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lito Principal</label>
                <select
                  value={filterLito}
                  onChange={(e) => setFilterLito(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xxs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">TODAS</option>
                  {Object.keys(LITHOLOGY_CATALOG).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profundidad Máx.</label>
                <input
                  type="number"
                  placeholder="Ej. 150"
                  value={filterMaxDepth}
                  onChange={(e) => setFilterMaxDepth(e.target.value)}
                  className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xxs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-navy-800/30">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleApplyFilters}
                  className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500/10 dark:border dark:border-cyan-500/30 dark:hover:bg-cyan-500/20 text-white dark:text-cyan-400 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Search size={11} />
                  <span>Filtrar</span>
                </button>
                <button
                  onClick={handleClearFilters}
                  className="flex items-center gap-1 bg-navy-900 hover:bg-navy-850 text-slate-400 hover:text-slate-200 border border-navy-800 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
                >
                  <RotateCcw size={11} />
                  <span>Limpiar</span>
                </button>
              </div>
              <div>
                <div className="flex items-center gap-1.5 bg-navy-900/40 dark:bg-navy-900/60 border border-navy-800/80 rounded-lg px-2.5 py-1 text-xs text-slate-400 font-bold">
                  <Database size={14} className="text-cyan-400 shrink-0 animate-none" />
                  <span>{filteredCorridas.length} reg.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tarjetas KPIs dinámicas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-panel p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 flex flex-col justify-between shadow-md">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">RMR '89 Medio</span>
                <span className="text-xl font-extrabold text-emerald-400 block tracking-tight mt-1">{avgRmr89}</span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block truncate max-w-[100px]">{getRockClass(parseFloat(avgRmr89))}</span>
            </div>

            <div className="glass-panel p-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 flex flex-col justify-between shadow-md">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">RMR '76 Medio</span>
                <span className="text-xl font-extrabold text-cyan-400 block tracking-tight mt-1">{avgRmr76}</span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block truncate max-w-[100px]">{getRockClass(parseFloat(avgRmr76))}</span>
            </div>

            <div className="glass-panel p-3 rounded-xl border border-purple-500/25 bg-purple-500/5 flex flex-col justify-between shadow-md">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">RQD Promedio</span>
                <span className="text-xl font-extrabold text-purple-400 block tracking-tight mt-1">{avgRqd}%</span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block truncate max-w-[100px]">
                {parseFloat(avgRqd) >= 90 ? 'Excelente' : parseFloat(avgRqd) >= 75 ? 'Bueno' : parseFloat(avgRqd) >= 50 ? 'Regular' : 'Malo'}
              </span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Contenedor Unificado de Gráficos */}
        <div className="lg:col-span-8 glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/10 flex flex-col justify-between shadow-lg">
          <div className="mb-2 border-b border-navy-850 pb-1.5 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>Seguimiento de Correlación Geomecánica</span>
                <span className="text-[10px] font-normal text-slate-400 lowercase italic">({activeTaladroName})</span>
              </h3>
            </div>
            <span className="text-[9px] bg-navy-900 border border-navy-800 rounded px-1.5 py-0.5 text-slate-400 uppercase font-semibold">QA/QC</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {/* Gráfico 1: Espaciamiento vs RQD */}
            <div className="relative flex flex-col justify-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block text-center">RQD / Espaciamiento (Bieniawski '89)</span>
              <ResponsiveContainer width="100%" height={170}>
                <ComposedChart
                  margin={{ top: 5, right: 5, bottom: 20, left: 5 }}
                  onMouseLeave={() => hideTooltip('bien')}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f15" style={{ pointerEvents: 'none' }} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    scale="log"
                    domain={[0.8, 2200]}
                    ticks={[1, 10, 100, 1000, 2000]}
                    interval={0}
                    allowDataOverflow={true}
                    tick={{ fill: '#64748b', fontSize: 8 }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
                  >
                    <Label value="Espaciamiento (mm)" position="insideBottom" offset={-12} fill="#64748b" fontSize={8} />
                  </XAxis>

                  <YAxis dataKey="y" domain={[-2, 102]} ticks={[0, 50, 100]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 8 }}>
                    <Label value="RQD (%)" angle={-90} position="insideLeft" offset={3} fill="#64748b" fontSize={8} />
                  </YAxis>

                  <Line data={bienMinLine} dataKey="y" type="monotone" dot={false} stroke="#1f77b4" strokeWidth={1.2} strokeDasharray="5 3" legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />
                  <Line data={bienMaxLine} dataKey="y" type="monotone" dot={false} stroke="#ff7f0e" strokeWidth={1.2} strokeDasharray="5 3" legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />
                  <Line data={bienMidLine} dataKey="y" type="monotone" dot={false} stroke="#2ca02c" strokeWidth={1.2} strokeDasharray="3 3" style={{ pointerEvents: 'none' }} isAnimationActive={false} />

                  <Scatter data={scatterBien} r={2.8} isAnimationActive={false} onMouseLeave={() => hideTooltip('bien')}>
                    {scatterBien.map((entry, index) => (
                      <Cell
                        key={`cell-bien-mini-${index}`}
                        fill={getDrillColor(activeTaladroName)}
                        onMouseEnter={(e: any) => showTooltip(e, entry, 'bien')}
                        onMouseMove={(e: any) => moveTooltip(e, 'bien')}
                        onMouseLeave={() => hideTooltip('bien')}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Scatter>
                </ComposedChart>
              </ResponsiveContainer>

              {/* Contenedor del Tooltip flotante */}
              <div
                id="rmr-bien-floating-tooltip"
                className="absolute z-50 pointer-events-none bg-navy-950/95 border border-navy-700 rounded-xl p-2.5 text-[10px] shadow-2xl backdrop-blur-sm space-y-0.5 w-52 text-left font-sans"
                style={{ display: 'none', transform: 'translate(-50%, -100%)', marginTop: '-8px' }}
              />
            </div>

            {/* Gráfico 2: FF/m vs RQD */}
            <div className="relative flex flex-col justify-center border-t md:border-t-0 md:border-l border-navy-800 md:pl-4 pt-4 md:pt-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block text-center">RQD / Frecuencia de Fracturas FF/1m</span>
              <ResponsiveContainer width="100%" height={170}>
                <ComposedChart
                  margin={{ top: 5, right: 5, bottom: 20, left: 5 }}
                  onMouseLeave={() => hideTooltip('ph')}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f15" style={{ pointerEvents: 'none' }} />
                  <XAxis dataKey="x" type="number" domain={[-0.8, 40.8]} ticks={[0, 10, 20, 30, 40]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 8 }}>
                    <Label value="Frecuencia FF (fract/m)" position="insideBottom" offset={-12} fill="#64748b" fontSize={8} />
                  </XAxis>

                  <YAxis dataKey="y" domain={[-2, 102]} ticks={[0, 50, 100]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 8 }}>
                    <Label value="RQD (%)" angle={-90} position="insideLeft" offset={3} fill="#64748b" fontSize={8} />
                  </YAxis>

                  <Line data={phSuaveLine} dataKey="y" type="monotone" dot={false} stroke="#e2e8f0" strokeWidth={1.2} strokeDasharray="5 3" legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />
                  <Line data={lambdaMinLine} dataKey="y" type="monotone" dot={false} stroke="#d62728" strokeWidth={1.2} legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />
                  <Line data={lambdaMaxLine} dataKey="y" type="monotone" dot={false} stroke="#1f77b4" strokeWidth={1.2} legendType="none" style={{ pointerEvents: 'none' }} isAnimationActive={false} />

                  <Scatter data={scatterPh} r={2.8} isAnimationActive={false} onMouseLeave={() => hideTooltip('ph')}>
                    {scatterPh.map((entry, index) => (
                      <Cell
                        key={`cell-ph-mini-${index}`}
                        fill={getDrillColor(activeTaladroName)}
                        onMouseEnter={(e: any) => showTooltip(e, entry, 'ph')}
                        onMouseMove={(e: any) => moveTooltip(e, 'ph')}
                        onMouseLeave={() => hideTooltip('ph')}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Scatter>
                </ComposedChart>
              </ResponsiveContainer>

              {/* Contenedor del Tooltip flotante */}
              <div
                id="rmr-ph-floating-tooltip"
                className="absolute z-50 pointer-events-none bg-navy-950/95 border border-navy-700 rounded-xl p-2.5 text-[10px] shadow-2xl backdrop-blur-sm space-y-0.5 w-52 text-left font-sans"
                style={{ display: 'none', transform: 'translate(-50%, -100%)', marginTop: '-8px' }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* SECCIÓN INFERIOR FLEXIBLE CON SCROLLBARS INTERNAS VISIBLES EN VIEWPORT (RMR GRID) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <RmrGrid
          calculatedRows={calculatedRows} // <-- SOLUCIÓN: Usar la variable unificada
          filteredCorridas={filteredCorridas} // <-- SOLUCIÓN: Usar la variable unificada
          activeTaladroName={activeTaladroName}
          geologo={geologo}
          fecha={fecha}
          waterTableM={waterTableM}
          showAllColumns={showAllColumns}
          setShowAllColumns={setShowAllColumns}
        />
      </div>
    </div>
  );
}