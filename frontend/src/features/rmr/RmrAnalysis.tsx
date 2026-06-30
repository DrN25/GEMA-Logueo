import { useState } from 'react';
import { TrendingUp, Search, RotateCcw, Database, Settings } from 'lucide-react';
import { LITHOLOGY_CATALOG } from '../../utils/catalogData';
import RmrGrid from './components/RmrGrid';
import RmrCharts from './components/RmrCharts';
import { useRmrState } from './useRmrState';

function getRockClass(rmrScore: number): string {
  if (rmrScore >= 81) return "Muy Buena";
  if (rmrScore >= 61) return "Buena";
  if (rmrScore >= 41) return "Regular";
  if (rmrScore >= 21) return "Mala";
  return "Muy Mala";
}

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
  corridas = [],
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
    scatterBien = [],
    scatterPh = []
  } = useRmrState({
    corridas,
    waterTableM,
    activeTaladroName
  });

  return (
    <div className="h-full flex flex-col select-none min-h-0 overflow-hidden space-y-3">
      {/* Panel de Introducción */}
      <div className="glass-panel p-3.5 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10 shrink-0">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0">
        {/* Columna Izquierda: Filtros y KPIs */}
        <div className="lg:col-span-4 flex flex-col gap-2.5">
          {/* Filtros */}
          <div className="glass-panel p-3.5 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-3 shadow-lg flex-1 flex flex-col justify-between">
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
                  <Database size={14} className="text-cyan-400 shrink-0" />
                  <span>{filteredCorridas.length} reg.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tarjetas KPIs dinámicas */}
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-panel p-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 flex flex-col justify-between shadow-md">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">RMR '89 Medio</span>
                <span className="text-base font-extrabold text-emerald-400 block tracking-tight mt-0.5">{avgRmr89}</span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block truncate max-w-[100px]">{getRockClass(parseFloat(avgRmr89))}</span>
            </div>

            <div className="glass-panel p-2.5 rounded-xl border border-cyan-500/25 bg-cyan-500/5 flex flex-col justify-between shadow-md">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">RMR '76 Medio</span>
                <span className="text-base font-extrabold text-cyan-400 block tracking-tight mt-0.5">{avgRmr76}</span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block truncate max-w-[100px]">{getRockClass(parseFloat(avgRmr76))}</span>
            </div>

            <div className="glass-panel p-2.5 rounded-xl border border-purple-500/25 bg-purple-500/5 flex flex-col justify-between shadow-md">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">RQD Promedio</span>
                <span className="text-base font-extrabold text-purple-400 block tracking-tight mt-0.5">{avgRqd}%</span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold block truncate max-w-[100px]">
                {parseFloat(avgRqd) >= 90 ? 'Excelente' : parseFloat(avgRqd) >= 75 ? 'Bueno' : parseFloat(avgRqd) >= 50 ? 'Regular' : 'Malo'}
              </span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Contenedor Modular de Gráficos */}
        <div className="lg:col-span-8 flex flex-col">
          <RmrCharts
            activeTaladroName={activeTaladroName}
            scatterBien={scatterBien}
            scatterPh={scatterPh}
            hoveredPointBien={hoveredPointBien}
            setHoveredPointBien={setHoveredPointBien}
            hoveredPointPh={hoveredPointPh}
            setHoveredPointPh={setHoveredPointPh}
          />
        </div>
      </div>

      {/* SECCIÓN INFERIOR FLEXIBLE (ESTILO LGG / EXCEL NATIVO) */}
      <div className="flex-1 min-h-0 flex flex-col space-y-2">
        {/* Barra de Herramientas de la Rejilla */}
        <div className="shrink-0 flex justify-between items-center bg-navy-900/50 p-2.5 rounded-xl border border-navy-800/35 backdrop-blur-md shadow-md">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border-r border-navy-800 pr-3 mr-1">
              <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md tracking-wider uppercase">
                {activeTaladroName}
              </span>
              <span className="text-[10px] font-bold text-slate-500 truncate max-w-[110px]">
                Log: {geologo}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-navy-950/80 border border-navy-850 rounded-lg px-2.5 py-1.5 text-xxs text-slate-400 shadow-sm">
              <span className="text-slate-300 font-bold">{filteredCorridas.length}</span>
              <span className="text-slate-500">regs.</span>
            </div>
          </div>

          {/* Toggler de columnas */}
          <button
            onClick={() => setShowAllColumns(!showAllColumns)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all border shadow-sm active:scale-95 ${!showAllColumns
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
              : 'bg-navy-900/60 border-navy-800 text-slate-400 hover:text-slate-200 hover:border-navy-700'
              }`}
          >
            <Settings size={13} className={!showAllColumns ? 'rotate-90 transition-transform duration-300' : 'transition-transform duration-300'} />
            <span>{showAllColumns ? 'Solo RMR' : 'Mostrar Todo'}</span>
          </button>
        </div>

        {/* Tabla BaseEditableGrid directa en la visualización flexible */}
        <div className="flex-1 min-h-0 flex flex-col">
          <RmrGrid
            calculatedRows={calculatedRows}
            activeTaladroName={activeTaladroName}
            geologo={geologo}
            fecha={fecha}
            showAllColumns={showAllColumns}
          />
        </div>
      </div>
    </div>
  );
}