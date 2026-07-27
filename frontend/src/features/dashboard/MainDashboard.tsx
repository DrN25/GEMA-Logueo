import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  MapPin,
  User,
  LayoutGrid,
  Trash2,
  Construction,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  ChevronDown,
  Activity,
  Layers
} from 'lucide-react';

export interface TaladroSummary {
  name: string;
  proyecto: string;
  geologo: string;
  diametro: string;
  inclinacion: number;
  fecha_registro: string;
  corridas_count: number;
  surveys_count: number;
  perf_total?: number;
}

export interface DashboardKPIs {
  total_taladros: number;
  perf_total_m: number;
  perf_total_hoy: number;
  rmr_promedio: number;
  rqd_promedio: number;
  geologo_mas_reciente: string;
}

interface DashboardProps {
  taladros: TaladroSummary[];
  kpis: DashboardKPIs | null;
  page: number;
  pageSize: number;
  totalFiltered: number;
  totalPages: number;
  loading: boolean;
  searchTerm: string;
  isGlobalSearch: boolean;
  activeDateRange: string;
  onSearchSubmit: (term: string, isGlobal: boolean) => void;
  onClearSearch: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onFilterChange: (filters: { dateRange?: string }) => void;
  onSelectTaladro: (name: string) => void;
  onCreateTaladro: (newTaladro: any) => void;
  onDeleteTaladro: (name: string) => void;
}

export default function Dashboard({
  taladros,
  kpis,
  page,
  pageSize,
  totalFiltered,
  totalPages,
  loading,
  searchTerm,
  isGlobalSearch,
  activeDateRange,
  onSearchSubmit,
  onClearSearch,
  onPageChange,
  onPageSizeChange,
  onFilterChange,
  onSelectTaladro,
  onCreateTaladro,
  onDeleteTaladro
}: DashboardProps) {
  const [showModal, setShowModal] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm);

  // Sincronizar búsqueda local cuando el prop externo cambia
  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  // Form state para crear nuevo taladro
  const [name, setName] = useState('');
  const [proyecto, setProyecto] = useState('Proyecto A');
  const [geologo, setGeologo] = useState('RD/RB');
  const [diametro, setDiametro] = useState('HQ3');
  const [inclinacion, setInclinacion] = useState(-60.0);
  const [campana, setCampana] = useState('2026');
  const [turno, setTurno] = useState('D');

  // Filtros avanzados locales
  const [advProyecto, setAdvProyecto] = useState('');
  const [advGeologo, setAdvGeologo] = useState('');
  const [advDiametro, setAdvDiametro] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateTaladro({
      name: name.trim().toUpperCase(),
      proyecto,
      geologo,
      diametro,
      inclinacion,
      campana,
      fecha_registro: new Date().toISOString().split('T')[0],
      collar_este_proyectado: 0.0,
      collar_norte_proyectado: 0.0,
      collar_cota_proyectado: 0.0,
      prof_final_eoh_proyectada: 0.0,
      comentarios_proyectado: '',
      collar_este: 0.0,
      collar_norte: 0.0,
      collar_cota: 0.0,
      prof_final_eoh: 0.0,
      comentarios: '',
      turno,
      surveys: [],
      corridas: [],
      discontinuidades: [],
      ensayos_plt: []
    });
    setShowModal(false);
    setName('');
  };

  const formatDate = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' });
    return `${day} ${month} · ${weekday.charAt(0).toUpperCase() + weekday.slice(1)}`;
  };

  const dateObj = new Date();
  const filterLabel = activeDateRange === 'hoy' ? 'Hoy' :
    activeDateRange === 'ayer' ? 'Ayer' :
    activeDateRange === 'semana' ? 'Esta semana' :
    activeDateRange === 'mes' ? 'Este mes' :
    activeDateRange === 'ano' ? 'Este año' : 'Todo';

  const totalGlobal = kpis?.total_taladros || taladros.length;
  const kpiSubset = totalFiltered !== totalGlobal
    ? `Sobre ${totalFiltered.toLocaleString()} sondajes de ${totalGlobal.toLocaleString()} totales`
    : `Total: ${totalGlobal.toLocaleString()} sondajes`;

  return (
    <div className="space-y-6 select-none w-full animate-fade-in text-left">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            <span>Panel de Control de Logueo Geotécnico de Sondajes</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-semibold">{kpiSubset}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 font-bold transition-all duration-200 active:scale-95 shadow-[0_0_12px_rgba(6,182,212,0.12)] px-4 py-2 rounded-lg text-xs"
          >
            <Plus size={16} />
            <span>Registrar Nuevo Taladro</span>
          </button>
        </div>
      </div>

      {/* Date Range Chips Filter */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'hoy', label: 'Hoy' },
          { key: 'ayer', label: 'Ayer' },
          { key: 'semana', label: 'Esta semana' },
          { key: 'mes', label: 'Este mes' },
          { key: 'ano', label: 'Este año' },
          { key: 'todo', label: 'Todo' },
        ].map(chip => (
          <button
            key={chip.key}
            onClick={() => onFilterChange({ dateRange: chip.key })}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 border ${
              activeDateRange === chip.key
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                : 'bg-navy-900/40 border-navy-700/70 text-slate-400 hover:text-slate-200 hover:border-navy-600'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Advanced Filters Panel */}
      <details className="group">
        <summary className="flex items-center gap-2 text-xs text-slate-400 font-semibold cursor-pointer hover:text-slate-200 transition-all select-none list-none">
          <Filter size={14} className="text-cyan-400" />
          <span>Filtros avanzados</span>
          <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
        </summary>
        <div className="mt-3 p-4 bg-navy-950/40 border border-navy-800 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Proyecto</label>
            <input
              type="text"
              placeholder="Proyecto A, B..."
              value={advProyecto}
              onChange={(e) => setAdvProyecto(e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Geólogo</label>
            <input
              type="text"
              placeholder="RD/RB, CBA..."
              value={advGeologo}
              onChange={(e) => setAdvGeologo(e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Diámetro</label>
            <input
              type="text"
              placeholder="HQ3, NQ3..."
              value={advDiametro}
              onChange={(e) => setAdvDiametro(e.target.value)}
              className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => onSearchSubmit(advProyecto || advGeologo || advDiametro || localSearch, isGlobalSearch)}
              className="w-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      </details>

      {/* Real Geotechnical KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Date Card */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Rango activo</span>
            <span className="text-base font-black text-slate-100 block">{filterLabel}</span>
            <span className="text-[10px] font-bold text-cyan-400 block leading-none">{formatDate(dateObj)}</span>
          </div>
          <Calendar size={22} className="text-cyan-500/40" />
        </div>

        {/* Total Drillholes */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Total Taladros</span>
            <span className="text-xl font-black text-slate-100 block">{totalGlobal.toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-400 block leading-none">{kpiSubset}</span>
          </div>
          <LayoutGrid size={22} className="text-cyan-500/40" />
        </div>

        {/* Total Logged Meters */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Metraje Logueado</span>
            <span className="text-xl font-black text-slate-100 block">{(kpis?.perf_total_m || 0).toFixed(1)} m</span>
            <span className="text-[10px] font-bold text-emerald-400 block leading-none">Hoy: {(kpis?.perf_total_hoy || 0).toFixed(1)} m</span>
          </div>
          <Construction size={22} className="text-emerald-500/40 animate-pulse" />
        </div>

        {/* RMR 89 Avg */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">RMR Promedio</span>
            <span className="text-xl font-black text-indigo-400 block">{kpis?.rmr_promedio ? kpis.rmr_promedio.toFixed(1) : '—'}</span>
            <span className="text-[10px] font-bold text-indigo-400 block leading-none">RMR '89 General</span>
          </div>
          <TrendingUp size={22} className="text-indigo-400/40" />
        </div>

        {/* Last Geologist */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/20 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Último Geólogo</span>
            <span className="text-base font-black text-slate-200 block truncate max-w-[130px]">
              {kpis?.geologo_mas_reciente || 'RD/RB'}
            </span>
            <span className="text-[10px] font-bold text-slate-400 block leading-none">Responsable reciente</span>
          </div>
          <User size={22} className="text-cyan-500/40" />
        </div>
      </div>

      {/* Search Bar with Explicit Buttons + Table Grid */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 bg-navy-950/15 shadow-xl space-y-4">
        {/* Search Controls Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-2xl w-full">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Escriba código de taladro (ej. FEGT25-001)..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSearchSubmit(localSearch, isGlobalSearch);
                  }
                }}
                className="w-full bg-navy-950/80 border border-navy-800 rounded-lg pl-9 pr-8 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              {localSearch && (
                <button
                  onClick={() => {
                    setLocalSearch('');
                    onClearSearch();
                  }}
                  className="absolute right-2.5 top-3 text-slate-500 hover:text-slate-200 transition-colors"
                  title="Limpiar texto de búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSearchSubmit(localSearch, false)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3.5 py-2 rounded-lg text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                title={`Buscar dentro del rango activo (${filterLabel})`}
              >
                <Search size={13} />
                <span>Buscar en {filterLabel}</span>
              </button>

              <button
                onClick={() => onSearchSubmit(localSearch, true)}
                className={`border font-bold px-3.5 py-2 rounded-lg text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 whitespace-nowrap ${
                  isGlobalSearch && searchTerm.trim()
                    ? 'bg-violet-500 border-violet-400 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                    : 'bg-navy-900 border-navy-700 text-slate-300 hover:text-white hover:border-navy-600'
                }`}
                title="Buscar en todo el historial completo de la base de datos (ignora filtro de fecha)"
              >
                <span>🌐 Buscar en todo</span>
              </button>
            </div>
          </div>

          {searchTerm.trim() && (
            <div className="flex items-center justify-between gap-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3.5 py-2 text-xs text-cyan-300 animate-fade-in">
              <div className="flex items-center gap-2 font-medium">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>
                  {isGlobalSearch ? '🌐 Todo el historial' : `📅 En ${filterLabel}`}: Buscando <strong className="text-white">"{searchTerm}"</strong>
                </span>
              </div>
              <button
                onClick={() => {
                  setLocalSearch('');
                  onClearSearch();
                }}
                className="text-[11px] font-bold text-cyan-400 hover:text-cyan-200 underline cursor-pointer ml-3 whitespace-nowrap"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}
        </div>

        {/* Drillhole Table Grid */}
        <div className="overflow-x-auto rounded-lg border border-navy-900 bg-navy-950/30">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 font-black uppercase tracking-wider border-b border-navy-800/80 bg-navy-900/40 h-9">
                <th className="py-2.5 px-4">Taladro / Sondaje</th>
                <th className="py-2.5 px-4">Fecha</th>
                <th className="py-2.5 px-4">Proyecto</th>
                <th className="py-2.5 px-4 text-center">Metraje Logueado (m)</th>
                <th className="py-2.5 px-4">Geólogo</th>
                <th className="py-2.5 px-4 text-center">Diámetro</th>
                <th className="py-2.5 px-4 text-center">Inclinación</th>
                <th className="py-2.5 px-4 text-center">Corridas</th>
                <th className="py-2.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/30 text-slate-200 font-medium">
              {loading && [...Array(pageSize)].map((_, i) => (
                <tr key={`skeleton-${i}`} className="h-11 animate-pulse">
                  {[...Array(9)].map((_, j) => (
                    <td key={j} className="py-2.5 px-4">
                      <div className="h-3 bg-navy-800/60 rounded w-3/4 mx-auto" />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && taladros.map(t => (
                <tr
                  key={t.name}
                  onClick={() => onSelectTaladro(t.name)}
                  className="hover:bg-navy-900/20 cursor-pointer transition-colors h-11"
                >
                  <td className="py-2.5 px-4 font-black text-slate-100 tracking-wide">
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-cyan-400" />
                      <span>{t.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 text-[10px]">{t.fecha_registro}</td>
                  <td className="py-2.5 px-4 text-slate-400">{t.proyecto || 'Proyecto A'}</td>
                  <td className="py-2.5 px-4 text-center text-slate-300 font-bold">
                    {(t.perf_total || 0).toFixed(1)} m
                  </td>
                  <td className="py-2.5 px-4 text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-slate-500" />
                      <span>{t.geologo}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-center text-slate-300 font-semibold">{t.diametro}</td>
                  <td className="py-2.5 px-4 text-center text-slate-400">{t.inclinacion}&deg;</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="bg-navy-900 border border-navy-800 text-cyan-400 px-2 py-0.5 rounded text-xs font-bold">
                      {t.corridas_count}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => onSelectTaladro(t.name)}
                        className="bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 font-bold transition-all shadow-sm active:scale-95 px-3 py-1.5 rounded-lg text-xs"
                      >
                        Ingresar
                      </button>
                      <button
                        onClick={() => onDeleteTaladro(t.name)}
                        className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all active:scale-90"
                        title="Eliminar taladro"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && taladros.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-xs font-semibold">
                    No se encontraron taladros en este rango. {activeDateRange === 'hoy' ? 'Registra el primero del día.' : 'Prueba cambiando el filtro de fecha o búsqueda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Grid Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Filas por página:</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="bg-navy-950 border border-navy-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {[10, 20, 50, 100].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span className="ml-2 text-slate-500 font-medium">
                Mostrando {Math.min((page - 1) * pageSize + 1, totalFiltered)} - {Math.min(page * pageSize, totalFiltered)} de {totalFiltered} sondajes
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded border border-navy-800 bg-navy-900/40 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Página anterior"
              >
                <ChevronLeft size={14} />
              </button>
              {(() => {
                const pages = [];
                const maxVisible = 7;
                let start = Math.max(1, page - Math.floor(maxVisible / 2));
                const end = Math.min(totalPages, start + maxVisible - 1);
                if (end - start + 1 < maxVisible) {
                  start = Math.max(1, end - maxVisible + 1);
                }
                if (start > 1) {
                  pages.push(
                    <button key={1} onClick={() => onPageChange(1)} className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-slate-200">1</button>
                  );
                  if (start > 2) {
                    pages.push(<span key="dots-1" className="px-1 text-xs text-slate-600">...</span>);
                  }
                }
                for (let i = start; i <= end; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => onPageChange(i)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                        page === i
                          ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }
                if (end < totalPages) {
                  if (end < totalPages - 1) {
                    pages.push(<span key="dots-2" className="px-1 text-xs text-slate-600">...</span>);
                  }
                  pages.push(
                    <button key={totalPages} onClick={() => onPageChange(totalPages)} className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-slate-200">{totalPages}</button>
                  );
                }
                return pages;
              })()}
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-navy-800 bg-navy-900/40 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Página siguiente"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Registro Nuevo Taladro */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
          <div className="glass-panel w-full max-w-md p-6 rounded-xl border border-navy-800 space-y-4 shadow-2xl bg-navy-900/95">
            <h3 className="text-sm font-black text-slate-100 tracking-wide border-b border-navy-800 pb-2 uppercase">
              Registrar Nuevo Taladro
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Código del Taladro</label>
                <input
                  type="text"
                  required
                  placeholder="ej. FEGT25-001"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 font-bold tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Proyecto</label>
                  <select
                    value={proyecto}
                    onChange={(e) => setProyecto(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                  >
                    <option value="Proyecto A">Proyecto A</option>
                    <option value="Proyecto B">Proyecto B</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Geólogo</label>
                  <input
                    type="text"
                    required
                    value={geologo}
                    onChange={(e) => setGeologo(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Diámetro</label>
                  <select
                    value={diametro}
                    onChange={(e) => setDiametro(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                  >
                    <option value="HQ3">HQ3</option>
                    <option value="NQ3">NQ3</option>
                    <option value="PQ3">PQ3</option>
                    <option value="HQ">HQ</option>
                    <option value="NQ">NQ</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Inclinación (&deg;)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={inclinacion}
                    onChange={(e) => setInclinacion(parseFloat(e.target.value) || 0)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Campaña</label>
                  <input
                    type="text"
                    required
                    value={campana}
                    onChange={(e) => setCampana(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Turno</label>
                  <select
                    value={turno}
                    onChange={(e) => setTurno(e.target.value)}
                    className="w-full bg-navy-950 border border-navy-800 rounded-lg px-2 py-2 text-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                  >
                    <option value="D">Día</option>
                    <option value="N">Noche</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-navy-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  Guardar Taladro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}