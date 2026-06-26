import { useState, useMemo } from 'react';
import { calculateRowRmr } from '../utils/formulaEngine';
import { TrendingUp, Search, RotateCcw, Database, Settings } from 'lucide-react';
import { LITHOLOGY_CATALOG } from '../utils/catalogData';
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Label, Cell
} from 'recharts';

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

// ─── Helpers Matemáticos e Interpolación ─────────────────────────────────────

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

function getDrillColor(name: string): string {
  if (!name) return '#38bdf8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const DRILL_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#4ade80'];
  return DRILL_COLORS[Math.abs(hash) % DRILL_COLORS.length];
}

// ─── Tooltips de Seguimiento Localizados (Un Solo Taladro) ───────────────────

const MiniBienTooltip = ({ hoveredPoint }: any) => {
  if (!hoveredPoint) return null;
  const d = hoveredPoint;
  const minRqd = interpolateY(BIENIAWSKI_CTRL_MIN, d.spacing_mm, true);
  const maxRqd = interpolateY(BIENIAWSKI_CTRL_MAX, d.spacing_mm, true);

  return (
    <div className="bg-navy-950/95 border border-navy-700 rounded-xl p-2 text-[10px] shadow-2xl backdrop-blur-sm space-y-0.5 w-52 text-left pointer-events-none">
      <p className="font-extrabold text-cyan-400 border-b border-navy-800 pb-1 mb-1">
        Corrida {d.corrida} ({d.prof_m} m)
      </p>
      <p className="text-slate-100">
        Espaciamiento: <span className="text-cyan-300 font-bold">{d.spacing_mm} mm</span>
      </p>
      <p className="text-slate-300">
        RQD Medido: <span className="text-emerald-400 font-bold">{d.rqd_pct}%</span>
      </p>
      <p className="text-slate-300">
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
    <div className="bg-navy-950/95 border border-navy-700 rounded-xl p-2 text-[10px] shadow-2xl backdrop-blur-sm space-y-0.5 w-52 text-left pointer-events-none">
      <p className="font-extrabold text-cyan-400 border-b border-navy-800 pb-1 mb-1">
        Corrida {d.corrida} ({d.prof_m} m)
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

// ─── Interfaces ─────────────────────────────────────────────────────────────

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

  // Estados locales para tooltips interactivos (gráficos)
  const [hoveredPointBien, setHoveredPointBien] = useState<any>(null);
  const [hoveredPointPh, setHoveredPointPh] = useState<any>(null);

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

  // Procesar puntos de datos optimizados para las gráficas de seguimiento (un solo taladro)
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

  const getRockClass = (rmrScore: number): string => {
    if (rmrScore >= 81) return "Muy Buena";
    if (rmrScore >= 61) return "Buena";
    if (rmrScore >= 41) return "Regular";
    if (rmrScore >= 21) return "Mala";
    return "Muy Mala";
  };

  const getQualityColor = (rmr: number) => {
    if (rmr >= 81) return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
    if (rmr >= 61) return "text-cyan-400 border-cyan-500/20 bg-cyan-500/5";
    if (rmr >= 41) return "text-amber-400 border-amber-500/20 bg-amber-500/5";
    return "text-red-400 border-red-500/20 bg-red-500/5";
  };

  // Helper para clasificar relleno al estilo del excel
  const getClasificacionRelleno = (relleno: string) => {
    if (!relleno || relleno === "cwf") return 3; // Sin relleno
    if (["FBX", "QZ", "SIO", "SU", "OX", "ep"].includes(relleno)) return 2; // Relleno duro
    return 1; // Relleno blando
  };

  return (
    <div className="space-y-6 select-none w-full animate-fade-in text-slate-100">
      {/* Panel de Introducción */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
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

      {/* Panel de Filtros Enterprise */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-4 shadow-lg animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Filtro Litología */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Litología Principal</label>
            <select
              value={filterLito}
              onChange={(e) => setFilterLito(e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">TODAS</option>
              {Object.keys(LITHOLOGY_CATALOG).map(opt => (
                <option key={opt} value={opt}>{opt} - {LITHOLOGY_CATALOG[opt]?.name || opt}</option>
              ))}
            </select>
          </div>

          {/* Rango de Profundidades */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Profundidad Máxima (m)</label>
            <input
              type="number"
              placeholder="Ej. 300"
              value={filterMaxDepth}
              onChange={(e) => setFilterMaxDepth(e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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
              <span>Filtrar</span>
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
              <Database size={14} className="text-cyan-400 shrink-0" />
              <span className="text-slate-300 font-medium">{filteredCorridas.length}</span>
              <span className="text-slate-400">{filteredCorridas.length === 1 ? 'corrida' : 'corridas'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sección Superior Integrada (Filtros + KPIs + Mini Gráficos) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Lado Izquierdo: Tarjetas de KPIs (Apiladas Verticalmente) */}
        <div className="lg:col-span-4 flex flex-col gap-3 justify-between">

          {/* RMR 89 Card */}
          <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 shadow-lg flex items-center justify-between transition-all hover:scale-[1.01] flex-1">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">RMR'89 Promedio</span>
              <span className="text-3xl font-black text-emerald-400 block tracking-tight">{avgRmr89}</span>
              <div className="pt-0.5">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${parseFloat(avgRmr89) >= 81 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' :
                  parseFloat(avgRmr89) >= 61 ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' :
                    parseFloat(avgRmr89) >= 41 ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' :
                      'bg-red-500/15 text-red-300 border border-red-500/20'
                  }`}>
                  {getRockClass(parseFloat(avgRmr89))}
                </span>
              </div>
            </div>
            <TrendingUp size={28} className="text-emerald-400/25" />
          </div>

          {/* RMR 76 Card */}
          <div className="glass-panel p-4 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 shadow-lg flex items-center justify-between transition-all hover:scale-[1.01] flex-1">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">RMR'76 Promedio</span>
              <span className="text-3xl font-black text-cyan-400 block tracking-tight">{avgRmr76}</span>
              <div className="pt-0.5">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${parseFloat(avgRmr76) >= 81 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' :
                  parseFloat(avgRmr76) >= 61 ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' :
                    parseFloat(avgRmr76) >= 41 ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' :
                      'bg-red-500/15 text-red-300 border border-red-500/20'
                  }`}>
                  {getRockClass(parseFloat(avgRmr76))}
                </span>
              </div>
            </div>
            <TrendingUp size={28} className="text-cyan-400/35" />
          </div>

          {/* RQD Promedio Card */}
          <div className="glass-panel p-4 rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5 shadow-lg flex items-center justify-between transition-all hover:scale-[1.01] flex-1">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">RQD Promedio</span>
              <span className="text-3xl font-black text-purple-400 block tracking-tight">{avgRqd}%</span>
              <div className="pt-0.5">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${parseFloat(avgRqd) >= 90 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' :
                  parseFloat(avgRqd) >= 75 ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' :
                    parseFloat(avgRqd) >= 50 ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' :
                      'bg-red-500/15 text-red-300 border border-red-500/20'
                  }`}>
                  {parseFloat(avgRqd) >= 90 ? 'Excelente' :
                    parseFloat(avgRqd) >= 75 ? 'Bueno' :
                      parseFloat(avgRqd) >= 50 ? 'Regular' : 'Malo'}
                </span>
              </div>
            </div>
            <Database size={28} className="text-purple-400/35" />
          </div>

        </div>

        {/* Lado Derecho: Contenedor Unificado de Gráficos (Columna 3 de la imagen, extendido) */}
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

          {/* Grid de gráficos lado a lado, con división vertical en pantallas medianas/grandes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">

            {/* Gráfico 1: Espaciamiento vs RQD */}
            <div className="relative flex flex-col justify-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block text-center">RQD / Espaciamiento (Bieniawski '89)</span>
              <ResponsiveContainer width="100%" height={190}>
                <ComposedChart
                  margin={{ top: 5, right: 5, bottom: 20, left: 5 }}
                  onMouseLeave={() => setHoveredPointBien(null)}
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

                  <Line data={bienMinLine} dataKey="y" type="monotone" dot={false} stroke="#1f77b4" strokeWidth={1.2} strokeDasharray="5 3" legendType="none" style={{ pointerEvents: 'none' }} />
                  <Line data={bienMaxLine} dataKey="y" type="monotone" dot={false} stroke="#ff7f0e" strokeWidth={1.2} strokeDasharray="5 3" legendType="none" style={{ pointerEvents: 'none' }} />
                  <Line data={bienMidLine} dataKey="y" type="monotone" dot={false} stroke="#2ca02c" strokeWidth={1.2} strokeDasharray="3 3" style={{ pointerEvents: 'none' }} />

                  <Scatter data={scatterBien} r={2.8}>
                    {scatterBien.map((entry, index) => (
                      <Cell
                        key={`cell-bien-mini-${index}`}
                        fill={getDrillColor(activeTaladroName)}
                        onMouseEnter={(e: any) => {
                          const chartRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                          if (chartRect) {
                            const x = e.clientX - chartRect.left;
                            const y = e.clientY - chartRect.top;
                            setHoveredPointBien({ data: entry, x, y });
                          }
                        }}
                        onMouseMove={(e: any) => {
                          const chartRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                          if (chartRect) {
                            const x = e.clientX - chartRect.left;
                            const y = e.clientY - chartRect.top;
                            setHoveredPointBien({ data: entry, x, y });
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredPointBien((prev: any) => (prev && prev.data.corrida === entry.corrida ? null : prev));
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Scatter>
                </ComposedChart>
              </ResponsiveContainer>

              {hoveredPointBien && (
                <div
                  className="absolute z-50 pointer-events-none"
                  style={{
                    left: hoveredPointBien.x,
                    top: hoveredPointBien.y,
                    transform: 'translate(-50%, -100%)',
                    marginTop: '-8px',
                  }}
                >
                  <MiniBienTooltip hoveredPoint={hoveredPointBien.data} />
                </div>
              )}
            </div>

            {/* Gráfico 2: FF/m vs RQD + Línea divisoria izquierda para simular el dibujo */}
            <div className="relative flex flex-col justify-center border-t md:border-t-0 md:border-l border-navy-800 md:pl-4 pt-4 md:pt-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block text-center">RQD / Frecuencia de Fracturas FF/1m</span>
              <ResponsiveContainer width="100%" height={190}>
                <ComposedChart
                  margin={{ top: 5, right: 5, bottom: 20, left: 5 }}
                  onMouseLeave={() => setHoveredPointPh(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f15" style={{ pointerEvents: 'none' }} />
                  <XAxis dataKey="x" type="number" domain={[-0.8, 40.8]} ticks={[0, 10, 20, 30, 40]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 8 }}>
                    <Label value="Frecuencia FF (fract/m)" position="insideBottom" offset={-12} fill="#64748b" fontSize={8} />
                  </XAxis>

                  <YAxis dataKey="y" domain={[-2, 102]} ticks={[0, 50, 100]} allowDataOverflow={true} tick={{ fill: '#64748b', fontSize: 8 }}>
                    <Label value="RQD (%)" angle={-90} position="insideLeft" offset={3} fill="#64748b" fontSize={8} />
                  </YAxis>

                  <Line data={phSuaveLine} dataKey="y" type="monotone" dot={false} stroke="#e2e8f0" strokeWidth={1.2} strokeDasharray="5 3" legendType="none" style={{ pointerEvents: 'none' }} />
                  <Line data={lambdaMinLine} dataKey="y" type="monotone" dot={false} stroke="#d62728" strokeWidth={1.2} legendType="none" style={{ pointerEvents: 'none' }} />
                  <Line data={lambdaMaxLine} dataKey="y" type="monotone" dot={false} stroke="#1f77b4" strokeWidth={1.2} legendType="none" style={{ pointerEvents: 'none' }} />

                  <Scatter data={scatterPh} r={2.8}>
                    {scatterPh.map((entry, index) => (
                      <Cell
                        key={`cell-ph-mini-${index}`}
                        fill={getDrillColor(activeTaladroName)}
                        onMouseEnter={(e: any) => {
                          const chartRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                          if (chartRect) {
                            const x = e.clientX - chartRect.left;
                            const y = e.clientY - chartRect.top;
                            setHoveredPointPh({ data: entry, x, y });
                          }
                        }}
                        onMouseMove={(e: any) => {
                          const chartRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                          if (chartRect) {
                            const x = e.clientX - chartRect.left;
                            const y = e.clientY - chartRect.top;
                            setHoveredPointPh({ data: entry, x, y });
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredPointPh((prev: any) => (prev && prev.data.corrida === entry.corrida ? null : prev));
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Scatter>
                </ComposedChart>
              </ResponsiveContainer>

              {hoveredPointPh && (
                <div
                  className="absolute z-50 pointer-events-none"
                  style={{
                    left: hoveredPointPh.x,
                    top: hoveredPointPh.y,
                    transform: 'translate(-50%, -100%)',
                    marginTop: '-8px',
                  }}
                >
                  <MiniPhTooltip hoveredPoint={hoveredPointPh.data} />
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Grid General de Validación RMR */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 shadow-2xl relative overflow-hidden animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-navy-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Rejilla Detallada de Ratings RMR
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditoría y puntuación geomecánica por corrida (Nivel Freático configurado: {waterTableM} m)
            </p>
          </div>

          {/* Toggler Badge Premium */}
          <button
            onClick={() => setShowAllColumns(!showAllColumns)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-md active:scale-95 ${!showAllColumns
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
              : 'bg-navy-900/60 border-navy-800 text-slate-400 hover:text-slate-200 hover:border-navy-700'
              }`}
          >
            <Settings size={14} className={!showAllColumns ? 'rotate-90 transition-transform duration-300' : 'transition-transform duration-300'} />
            <span>{showAllColumns ? 'Solo mostrar las 2 últimas secciones' : 'Mostrar Todas las Columnas (Excel)'}</span>
          </button>
        </div>

        {/* Tabla scrollable */}
        <div className="overflow-x-auto w-full rounded-lg border border-navy-850 bg-navy-950/80 max-h-[550px] shadow-inner">
          <table
            className="w-full border-separate text-xs text-left"
            style={{ borderSpacing: 0, minWidth: 'max-content' }}
          >
            <thead>
              {/* Group Header Row */}
              <tr className="bg-navy-900 text-[10px] uppercase font-bold text-slate-500 select-none">
                <th colSpan={5} className="py-2.5 px-3 text-center border-r border-b border-navy-800 sticky top-0 bg-navy-900 z-30">Identificación</th>
                {showAllColumns && (
                  <th colSpan={25} className="py-2.5 px-3 text-center border-r border-b border-navy-800 th-rmr-purple sticky top-0 z-30">
                    Registro de Parámetros
                  </th>
                )}
                <th colSpan={12} className="py-2.5 px-3 text-center border-r border-b border-navy-800 th-rmr-cyan sticky top-0 z-30">
                  Ratings RMR '76
                </th>
                <th colSpan={12} className="py-2.5 px-3 text-center border-b border-navy-800 th-rmr-emerald sticky top-0 z-30">
                  Ratings RMR '89
                </th>
              </tr>
              {/* Main Headers Row */}
              <tr className="bg-navy-900 border-b border-navy-800 font-bold uppercase text-slate-400 select-none text-[10px] tracking-wider sticky top-[30px] z-30">
                <th className="py-3 px-3 text-center sticky left-0 bg-navy-950 dark:bg-navy-900 z-40 border-r border-b border-navy-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Sondaje</th>
                <th className="py-3 px-3 text-center sticky left-[80px] bg-navy-950 dark:bg-navy-900 z-40 border-r border-b border-navy-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Fecha</th>
                <th className="py-3 px-3 text-center border-b border-navy-800 bg-navy-900">Logueador</th>
                <th className="py-3 px-3.5 text-center border-b border-navy-800 bg-navy-900">Corrida</th>
                <th className="py-3 px-3.5 text-center border-r border-b border-navy-800 bg-navy-900">Lito 1</th>

                {/* Columnas Intermedias */}
                {showAllColumns && (
                  <>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Lito 2</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Lito 3</th>
                    <th className="py-3 px-3.5 text-center border-b border-navy-800 th-rmr-purple">Desde (m)</th>
                    <th className="py-3 px-3.5 text-center border-b border-navy-800 th-rmr-purple">Hasta (m)</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Long. Corrida (m)</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Rec (m)</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Rec (%)</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">RQD (m)</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">RQD (%)</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Long. Tramo fracturado (m)</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">FRF (zonas trituradas)</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Fracturas naturales</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Total de Fracturas</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">FF/1m</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Espaciamiento (mm)</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Resistencia</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Tipo de Estructura</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Abertura (mm)</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Rugosidad</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Relleno</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Clasificación Relleno</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Intemperismo</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">JRC10</th>
                    <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-purple">Espesor de relleno</th>
                    <th className="py-3 px-3 text-center border-r border-b border-navy-800 th-rmr-purple">Presencia de Agua</th>
                  </>
                )}

                {/* RMR 76 Columns */}
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Resistencia</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">RQD</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Espaciamiento</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Abertura</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Rugosidad</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Relleno</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Intemperismo</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Persistencia</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan font-extrabold">Condición de Juntas</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-cyan">Presencia de Agua</th>
                <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-cyan font-black">RMR'76</th>
                <th className="py-3 px-3 text-center border-r border-b border-navy-800 th-rmr-cyan">CALIDAD DE ROCA</th>

                {/* RMR 89 Columns */}
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Resistencia</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">RQD</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Espaciamiento</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Abertura</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Rugosidad</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Relleno</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Intemperismo</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Persistencia</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald font-extrabold">Condición de Juntas</th>
                <th className="py-3 px-2.5 text-center border-b border-navy-800 th-rmr-emerald">Presencia de Agua</th>
                <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-emerald font-black">RMR'89</th>
                <th className="py-3 px-3 text-center border-b border-navy-800 th-rmr-emerald">CALIDAD DE ROCA</th>
              </tr>
            </thead>
            <tbody>
              {calculatedRows.map(({ row, rmrRes }, index) => {
                const isOdd = index % 2 === 1;
                const rowBg = isOdd
                  ? 'bg-navy-900/10 hover:bg-blue-500/5'
                  : 'bg-navy-950/10 hover:bg-blue-500/5';

                return (
                  <tr key={index} className={`transition-all ${rowBg} text-slate-300 font-medium`}>
                    {/* Frozen identifiers */}
                    <td className="py-2.5 px-3 text-center sticky left-0 bg-navy-950 border-r border-b border-navy-800 shadow-[2px_0_5px_rgba(0,0,0,0.35)] w-20 truncate">{activeTaladroName}</td>
                    <td className="py-2.5 px-3 text-center sticky left-[80px] bg-navy-950 border-r border-b border-navy-800 shadow-[2px_0_5px_rgba(0,0,0,0.35)] w-[85px] truncate">{fecha}</td>
                    <td className="py-2.5 px-3 text-center border-b border-navy-850 truncate max-w-[90px]">{geologo}</td>
                    <td className="py-2.5 px-3 text-center border-b border-navy-850 font-black text-cyan-400">{row.corrida}</td>
                    <td className="py-2.5 px-3 text-center border-r border-b border-navy-800 font-bold text-slate-400">{row.lito1}</td>

                    {/* Intermediate parameters */}
                    {showAllColumns && (
                      <>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.lito2 || "-1"}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.lito3 || "-1"}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.de.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.a.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 font-semibold">{rmrRes.error ? "-" : rmrRes.perf}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.rec_m.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{rmrRes.error ? "-" : `${rmrRes.rec_pct}%`}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.rqd_m.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 font-bold text-slate-300 bg-purple-950/5">{rmrRes.error ? "-" : `${rmrRes.rqd_pct}%`}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.lrf_m.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 font-bold">{rmrRes.frf || 0}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.frac_nat}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 font-bold">{rmrRes.total_frac || 0}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{rmrRes.error ? "-" : Math.round((rmrRes.total_frac || 0) / (rmrRes.perf || 1))}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{rmrRes.error ? "-" : `${rmrRes.spacing_mm}`}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 font-semibold">{row.resistencia}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 uppercase">{row.tipo_est1 || "JN"}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.abertura}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.rugosidad}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5 uppercase">{row.relleno1}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{rmrRes.error ? "-" : getClasificacionRelleno(row.relleno1)}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.intemperismo}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.jrc10}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 text-slate-400 bg-purple-950/5">{row.espesor}</td>
                        <td className="py-2.5 px-3 text-center border-r border-b border-navy-800 text-slate-400 bg-purple-950/5">{row.agua_obs}</td>
                      </>
                    )}

                    {/* RMR 76 columns */}
                    {rmrRes.error || !rmrRes.scores ? (
                      <td colSpan={12} className="py-2.5 px-3 text-center border-r border-b border-navy-800 bg-cyan-950/5 text-red-400 font-bold uppercase text-[10px] tracking-widest">{rmrRes.error || "ERROR"}</td>
                    ) : (
                      <>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.resistencia}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.rqd}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.spacing_76}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.abertura_76}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.rugosidad_76}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.relleno_76}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.weathering_76}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.persistencia_76}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5 font-bold text-cyan-400">{rmrRes.scores.juntas_76}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-cyan-950/5">{rmrRes.scores.agua_76}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 bg-cyan-950/10 font-black text-cyan-400">{rmrRes.rmr_76}</td>
                        <td className="py-2.5 px-3 text-center border-r border-b border-navy-800 bg-cyan-950/10 font-bold uppercase">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${getQualityColor(rmrRes.rmr_76 || 0)}`}>
                            {rmrRes.class_76}
                          </span>
                        </td>
                      </>
                    )}

                    {/* RMR 89 columns */}
                    {rmrRes.error || !rmrRes.scores ? (
                      <td colSpan={12} className="py-2.5 px-3 text-center border-b border-navy-800 bg-emerald-950/5 text-red-400 font-bold uppercase text-[10px] tracking-widest">{rmrRes.error || "ERROR"}</td>
                    ) : (
                      <>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.resistencia}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.rqd}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.spacing_89}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.abertura_89}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.rugosidad_89}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.relleno_89}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.weathering_89}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.persistencia_89}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5 font-bold text-emerald-400">{rmrRes.scores.juntas_89}</td>
                        <td className="py-2.5 px-2.5 text-center border-b border-navy-850 bg-emerald-950/5">{rmrRes.scores.agua_89}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 bg-emerald-950/10 font-black text-emerald-400">{rmrRes.rmr_89}</td>
                        <td className="py-2.5 px-3 text-center border-b border-navy-850 bg-emerald-950/10 font-bold uppercase">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${getQualityColor(rmrRes.rmr_89 || 0)}`}>
                            {rmrRes.class_89}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {filteredCorridas.length === 0 && (
                <tr>
                  <td colSpan={showAllColumns ? 54 : 29} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Database size={24} className="opacity-20 animate-pulse" />
                      <span>No se encontraron corridas en este taladro que coincidan con los filtros aplicados.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-navy-800/40">
          <span>* Todos los cálculos siguen los estándares geomecánicos de Bieniawski 1976 y 1989.</span>
          <span>Mostrando {filteredCorridas.length} de {corridas.length} corridas totales.</span>
        </div>
      </div>
    </div>
  );
}