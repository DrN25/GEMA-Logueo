import { AlertOctagon, AlertTriangle, HelpCircle, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface PltAnomaliesViewerProps {
    incidencias: any[];
    totalRecords: number;
    page: number;
    totalPages: number;
    onPageChange: (newPage: number) => void;
    filterSearch: string;
    onFilterSearch: (val: string) => void;
    isLoading?: boolean;
}

export default function PltAnomaliesViewer({
    incidencias,
    totalRecords,
    page,
    totalPages,
    onPageChange,
    filterSearch,
    onFilterSearch,
    isLoading = false
}: PltAnomaliesViewerProps) {
    return (
        <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-5 space-y-4 shadow-xl select-none">
            {/* Encabezado y Barra de Búsqueda */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-navy-800 pb-3">
                <div className="flex items-center gap-2">
                    <AlertOctagon size={16} className="text-cyan-400" />
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                            Registro Detallado de Anomalías Fila a Fila
                        </h3>
                        <p className="text-[11px] text-slate-400">
                            Mostrando {incidencias.length} de {totalRecords.toLocaleString()} inconsistencias encontradas
                        </p>
                    </div>
                </div>

                {/* Buscador */}
                <div className="relative w-full sm:w-72">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={filterSearch}
                        onChange={(e) => onFilterSearch(e.target.value)}
                        placeholder="Buscar por taladro, columna, regla..."
                        className="w-full pl-9 pr-3 py-1.5 bg-navy-950 border border-navy-750 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                </div>
            </div>

            {/* Tabla Principal */}
            <div className="rounded-xl border border-navy-800 overflow-hidden bg-navy-950">
                <div className="overflow-x-auto max-h-[480px] scrollbar-thin">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-navy-900 text-slate-400 font-extrabold border-b border-navy-800">
                            <tr>
                                <th className="py-2.5 px-3 text-center">Fila Excel</th>
                                <th className="py-2.5 px-3">Severidad</th>
                                <th className="py-2.5 px-3">Taladro</th>
                                <th className="py-2.5 px-3">Muestra</th>
                                <th className="py-2.5 px-3 text-center">Campaña</th>
                                <th className="py-2.5 px-3 text-right">From (m)</th>
                                <th className="py-2.5 px-3 text-right">To (m)</th>
                                <th className="py-2.5 px-3">Columna</th>
                                <th className="py-2.5 px-4">Diagnóstico Geomecánico</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-navy-850">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="py-8 text-center text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={16} className="animate-spin text-cyan-400" />
                                            <span>Cargando anomalías...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : incidencias.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                                        No se encontraron registros que coincidan con los filtros aplicados.
                                    </td>
                                </tr>
                            ) : (
                                incidencias.map((inc: any, idx: number) => {
                                    const isAlert = inc.severity === 'ALERTA';
                                    const isVacio = inc.severity === 'VACIO';

                                    return (
                                        <tr key={idx} className="hover:bg-navy-900/60 transition-colors text-slate-300">
                                            <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                                                #{inc.row_index}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                                    isAlert
                                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                        : isVacio
                                                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                                }`}>
                                                    {isAlert ? <AlertOctagon size={10} /> : isVacio ? <HelpCircle size={10} /> : <AlertTriangle size={10} />}
                                                    <span>{inc.severity}</span>
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-bold text-slate-200">{inc.taladro || '—'}</td>
                                            <td className="py-2.5 px-3 font-semibold text-cyan-300">{inc.muestra || '—'}</td>
                                            <td className="py-2.5 px-3 text-center">{inc.campana || '—'}</td>
                                            <td className="py-2.5 px-3 text-right">{inc.from_m !== null && inc.from_m !== undefined ? inc.from_m : '—'}</td>
                                            <td className="py-2.5 px-3 text-right">{inc.to_m !== null && inc.to_m !== undefined ? inc.to_m : '—'}</td>
                                            <td className="py-2.5 px-3 font-semibold text-slate-300">{inc.columna || '—'}</td>
                                            <td className="py-2.5 px-4 text-xs font-medium text-slate-300 max-w-md">
                                                {inc.message}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Paginador */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Página {page} de {Math.max(1, totalPages)}</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1 || isLoading}
                        className="px-3 py-1.5 rounded-lg border border-navy-800 bg-navy-900 text-slate-300 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                        <ChevronLeft size={14} />
                        <span>Anterior</span>
                    </button>
                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages || isLoading}
                        className="px-3 py-1.5 rounded-lg border border-navy-800 bg-navy-900 text-slate-300 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                        <span>Siguiente</span>
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
