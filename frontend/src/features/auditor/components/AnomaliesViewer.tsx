import { AlertTriangle, Settings, FileText, Search, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface AnomaliesViewerProps {
  incidencias: any[];
  totalRecords: number;
  filterSearch: string;
  onFilterSearch: (search: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  kpis: any;
  isLoading?: boolean; // Prop de carga reactivo
}

export default function AnomaliesViewer({
  incidencias,
  totalRecords,
  filterSearch,
  onFilterSearch,
  page,
  totalPages,
  onPageChange,
  kpis,
  isLoading = false, // Valor por defecto
}: AnomaliesViewerProps) {
  if (!kpis) return null;

  const getAlertRankStyle = (idx: number) => {
    if (idx === 0) return 'bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs';
    if (idx === 1) return 'bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-xs';
    return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded text-xs';
  };

  const getWarningRankStyle = (idx: number) => {
    if (idx === 0) return 'bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-xs';
    if (idx === 1) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded text-xs';
    return 'bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-xs';
  };

  return (
    <div className="space-y-6">
      {/* TOP ERRORES DETALLADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ALERTAS CRÍTICAS */}
        <div className="rounded-xl border border-navy-800 bg-[#090f1d]/30 p-5 space-y-4 shadow-lg">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span>Alertas Críticas con Mayor Ocurrencia</span>
          </h3>
          <div className="space-y-2.5 max-h-[350px] overflow-y-auto p-1 scrollbar-thin">
            {kpis.error_types_detailed?.alertas?.map((item: any, idx: number) => {
              const isFiltered = filterSearch === item.mensaje;
              return (
                <button
                  key={idx}
                  onClick={() => onFilterSearch(isFiltered ? '' : item.mensaje)}
                  className={`w-full flex flex-col md:flex-row md:items-center justify-between p-3 rounded-xl border text-left transition-all ${isFiltered
                      ? 'bg-red-500/10 border-red-500 shadow-md ring-1 ring-red-500/30'
                      : 'bg-[#0f172a]/30 border-navy-800 hover:bg-slate-900/30 hover:border-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={getAlertRankStyle(idx)}>{idx + 1}</span>
                    <span className="text-red-400 font-black uppercase text-xs tracking-wider leading-relaxed block break-words">
                      {item.mensaje}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0 font-bold">
                    <span className="bg-[#02040a] border border-navy-900 text-slate-450 px-2 py-0.5 rounded text-xs">
                      {item.cantidad} casos
                    </span>
                    <span className="bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded text-xs">
                      {item.pct.toFixed(1)}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ADVERTENCIAS */}
        <div className="rounded-xl border border-navy-800 bg-[#090f1d]/30 p-5 space-y-4 shadow-lg">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
            <Settings size={14} className="text-amber-500" />
            <span>Advertencias de Consistencia</span>
          </h3>
          <div className="space-y-2.5 max-h-[350px] overflow-y-auto p-1 scrollbar-thin">
            {kpis.error_types_detailed?.advertencias?.map((item: any, idx: number) => {
              const isFiltered = filterSearch === item.mensaje;
              return (
                <button
                  key={idx}
                  onClick={() => onFilterSearch(isFiltered ? '' : item.mensaje)}
                  className={`w-full flex flex-col md:flex-row md:items-center justify-between p-3 rounded-xl border text-left transition-all ${isFiltered
                      ? 'bg-orange-500/10 border-orange-500 shadow-md ring-1 ring-orange-500/30'
                      : 'bg-[#0f172a]/30 border-navy-800 hover:bg-slate-900/30 hover:border-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={getWarningRankStyle(idx)}>{idx + 1}</span>
                    <span className="text-orange-400 font-black uppercase text-xs tracking-wider leading-relaxed block break-words">
                      {item.mensaje}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0 font-bold">
                    <span className="bg-[#02040a] border border-navy-900 text-slate-450 px-2 py-0.5 rounded text-xs">
                      {item.cantidad} casos
                    </span>
                    <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded text-xs">
                      {item.pct.toFixed(1)}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* VISOR DETALLADO GRID PAGINADO */}
      <div className="rounded-xl border border-cyan-500/10 bg-[#090f1d]/30 p-6 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <FileText size={14} className="text-cyan-400" />
              <span>Buscador y Monitor de Anomalías Paginado</span>
              {isLoading && (
                <Loader2 size={14} className="animate-spin text-cyan-400 ml-1.5" />
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-semibold">
              {isLoading ? (
                <span className="text-cyan-400 animate-pulse">Cargando registros filtrados...</span>
              ) : (
                <>Mostrando **{totalRecords.toLocaleString()}** registros que coinciden con las consultas.</>
              )}
            </p>
          </div>

          {/* BUSCADOR */}
          <div className="flex items-center gap-2 bg-slate-950 border border-navy-800 rounded-lg px-3 py-1.5 w-full sm:w-64">
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Buscar columna, taladro, error..."
              value={filterSearch}
              onChange={(e) => onFilterSearch(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none w-full font-bold"
            />
            {filterSearch && (
              <button onClick={() => onFilterSearch('')} className="text-slate-500 hover:text-slate-350">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* GRILLA TABULAR */}
        <div className={`overflow-x-auto rounded-xl border border-navy-850 bg-[#090f1d]/20 transition-all duration-300 ${isLoading ? 'opacity-40 pointer-events-none' : ''
          }`}>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-extrabold uppercase border-b border-navy-850 tracking-wider text-xs">
                <th className="py-3 px-3 text-xs">Módulo</th>
                <th className="py-3 px-3 text-xs">Fila</th>
                <th className="py-3 px-3 text-xs">Taladro / Muestra</th>
                <th className="py-3 px-3 text-xs">Campaña</th>
                <th className="py-3 px-3 text-xs">Geólogo</th>
                <th className="py-3 px-3 text-xs">Campo (Columna)</th>
                <th className="py-3 px-3 text-xs">Valor</th>
                <th className="py-3 px-3 text-xs">Gravedad</th>
                <th className="py-3 px-3 text-xs">Detalle de la Falla Hallada</th>
              </tr>
            </thead>
            <tbody>
              {incidencias.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-500 italic font-semibold">
                    No se encontraron anomalías con los filtros seleccionados actualmente.
                  </td>
                </tr>
              ) : (
                incidencias.map((item, idx) => {
                  const severityBadge = item.tipo_incidencia === 'ALERTA'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : item.tipo_incidencia === 'ADVERTENCIA'
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      : item.tipo_incidencia === 'SIN_INFORMACION'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';

                  const rawVal = item.valor_actual;
                  const displayVal = (rawVal === null || rawVal === undefined || String(rawVal).trim() === "" || String(rawVal) === "-1")
                    ? (item.tipo_incidencia === 'SIN_INFORMACION' ? '-1' : '—')
                    : String(rawVal);

                  return (
                    <tr key={idx} className="border-b border-navy-900/60 hover:bg-slate-900/30 transition-all">
                      {/* Módulo (Negrita) */}
                      <td className="py-2.5 px-3 font-bold text-slate-400">{item.modulo}</td>
                      {/* Fila (No negrita) */}
                      <td className="py-2.5 px-3 font-mono font-normal text-slate-400">{item.fila_excel}</td>
                      {/* Taladro / Muestra (No negrita) */}
                      <td className="py-2.5 px-3 font-normal text-slate-200">{item.celda_padre || item.celda_hija}</td>
                      {/* Campaña (No negrita) */}
                      <td className="py-2.5 px-3 font-normal text-slate-400">{item.campania || '—'}</td>
                      {/* Geólogo (No negrita) */}
                      <td className="py-2.5 px-3 font-normal text-slate-400">{item.geotecnico || '—'}</td>
                      {/* Campo Columna (Negrita) */}
                      <td className="py-2.5 px-3 font-bold text-cyan-400 font-mono">{item.columna || 'General'}</td>
                      {/* Valor (No negrita) */}
                      <td className="py-2.5 px-3 font-mono font-normal text-slate-350">{displayVal}</td>
                      {/* Gravedad (Negrita) */}
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-black uppercase border ${severityBadge}`}>
                          {item.tipo_incidencia === 'SIN_INFORMACION' ? 'SIN INFO (-1)' : item.tipo_incidencia}
                        </span>
                      </td>
                      {/* Detalle de la Falla Hallada (No negrita) */}
                      <td className="py-2.5 px-3 text-slate-300 font-normal leading-relaxed">{item.mensaje}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINACIÓN */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-navy-850 text-xs text-slate-500 font-semibold">
          <span>
            Página <strong className="text-slate-350">{page}</strong> de <strong className="text-slate-350">{totalPages}</strong>
          </span>

          <div className="flex gap-2">
            <button
              disabled={page <= 1 || isLoading}
              onClick={() => onPageChange(page - 1)}
              className="p-1.5 rounded-lg bg-[#090f1d] hover:bg-slate-900 border border-navy-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={page >= totalPages || isLoading}
              onClick={() => onPageChange(page + 1)}
              className="p-1.5 rounded-lg bg-[#090f1d] hover:bg-slate-900 border border-navy-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}