import { TrendingUp, Search, RotateCcw } from 'lucide-react';
import { LITHOLOGY_CATALOG } from '../../utils/catalogData';
import { useRmrState } from './useRmrState';
import RmrCharts from './components/RmrCharts';
import RmrGrid from './components/RmrGrid';

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
  espesor: number;
  agua_obs: string;
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
  const {
    filterLito,
    setFilterLito,
    filterMaxDepth,
    setFilterMaxDepth,
    showAllColumns,
    setShowAllColumns,
    hoveredPointBien,
    setHoveredPointBien,
    hoveredPointPh,
    setHoveredPointPh,
    handleApplyFilters,
    handleClearFilters,
    filteredCorridas,
    calculatedRows,
    avgRmr89,
    avgRmr76,
    avgRqd,
    scatterBien,
    scatterPh
  } = useRmrState({ corridas, waterTableM, activeTaladroName });

  return (
    <div className="space-y-6 select-none w-full animate-fade-in text-slate-100">
      {/* Panel de Introducción */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10">
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
        <div className="flex gap-2.5 justify-end">
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 border border-navy-850 hover:border-navy-700 hover:text-slate-200 bg-navy-950 text-slate-400 text-xs font-bold uppercase px-4 py-2 rounded-lg transition-all active:scale-95 shadow-sm"
          >
            <RotateCcw size={14} />
            <span>Limpiar</span>
          </button>
          <button
            onClick={handleApplyFilters}
            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500/10 dark:border dark:border-cyan-500/30 dark:hover:bg-cyan-500/20 text-white dark:text-cyan-400 text-xs font-bold uppercase px-5.5 py-2.5 rounded-lg transition-all active:scale-95 border border-cyan-500/25 shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
          >
            <Search size={14} />
            <span>Aplicar Filtros</span>
          </button>
        </div>
      </div>

      {/* Grid de Resúmenes (Promedios RMR) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
        {/* Card RMR 89 */}
        <div className="glass-panel p-4.5 rounded-xl border border-navy-800 bg-gradient-to-br from-emerald-500/5 via-navy-950/20 to-transparent flex flex-col justify-between shadow-lg min-h-[105px]">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Promedio RMR '89</span>
            <span className="text-3xl font-black text-emerald-400 drop-shadow-[0_2px_8px_rgba(52,211,153,0.15)] mt-1.5 block">
              {avgRmr89}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-2 font-medium">Clasificación promedio del macizo rocoso</span>
        </div>

        {/* Card RMR 76 */}
        <div className="glass-panel p-4.5 rounded-xl border border-navy-800 bg-gradient-to-br from-cyan-500/5 via-navy-950/20 to-transparent flex flex-col justify-between shadow-lg min-h-[105px]">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Promedio RMR '76</span>
            <span className="text-3xl font-black text-cyan-400 drop-shadow-[0_2px_8px_rgba(34,211,238,0.15)] mt-1.5 block">
              {avgRmr76}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-2 font-medium">Estándar Bieniawski 1976</span>
        </div>

        {/* Card RQD */}
        <div className="glass-panel p-4.5 rounded-xl border border-navy-800 bg-gradient-to-br from-blue-500/5 via-navy-950/20 to-transparent flex flex-col justify-between shadow-lg min-h-[105px]">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Promedio RQD</span>
            <span className="text-3xl font-black text-blue-400 drop-shadow-[0_2px_8px_rgba(59,130,246,0.15)] mt-1.5 block">
              {avgRqd}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-2 font-medium">Rock Quality Designation medio</span>
        </div>
      </div>

      {/* Gráficos de Consistencia QA/QC */}
      <RmrCharts
        activeTaladroName={activeTaladroName}
        scatterBien={scatterBien}
        scatterPh={scatterPh}
        hoveredPointBien={hoveredPointBien}
        setHoveredPointBien={setHoveredPointBien}
        hoveredPointPh={hoveredPointPh}
        setHoveredPointPh={setHoveredPointPh}
      />

      {/* Grid General de Validación RMR */}
      <RmrGrid
        calculatedRows={calculatedRows}
        filteredCorridas={filteredCorridas}
        activeTaladroName={activeTaladroName}
        geologo={geologo}
        fecha={fecha}
        waterTableM={waterTableM}
        showAllColumns={showAllColumns}
        setShowAllColumns={setShowAllColumns}
      />
    </div>
  );
}