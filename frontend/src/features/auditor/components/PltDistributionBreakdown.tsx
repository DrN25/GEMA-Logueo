import { Calendar, BarChart3 } from 'lucide-react';

interface PltDistributionBreakdownProps {
    kpis: any;
    filterCampania: string;
    onFilterCampania: (camp: string) => void;
    filterTaladro: string;
    onFilterTaladro: (taladro: string) => void;
}

export default function PltDistributionBreakdown({
    kpis,
    filterCampania,
    onFilterCampania,
    filterTaladro,
    onFilterTaladro
}: PltDistributionBreakdownProps) {
    if (!kpis) return null;

    const distCamp = kpis.distribucion_campania || [];
    const worstDh = kpis.worst_drillholes || [];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* DISTRIBUCIÓN POR CAMPAÑA */}
            <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <Calendar size={14} className="text-cyan-400" />
                        <span>Desempeño de Calidad por Campaña</span>
                    </h3>
                    {filterCampania && (
                        <button
                            onClick={() => onFilterCampania('')}
                            className="text-[10px] text-cyan-400 hover:underline font-bold"
                        >
                            Quitar filtro ({filterCampania})
                        </button>
                    )}
                </div>

                <div className="rounded-xl border border-navy-800 overflow-hidden bg-navy-950">
                    <div className="max-h-56 overflow-y-auto scrollbar-thin">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-navy-900 text-slate-400 font-extrabold border-b border-navy-800">
                                <tr>
                                    <th className="py-2 px-3">Campaña</th>
                                    <th className="py-2 px-3 text-right">Muestras</th>
                                    <th className="py-2 px-3 text-right text-red-400">Alertas</th>
                                    <th className="py-2 px-3 text-right text-yellow-400">Vacíos</th>
                                    <th className="py-2 px-3 text-right text-emerald-400">Calidad %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-navy-850">
                                {distCamp.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-4 text-center text-slate-500 italic">
                                            No hay datos de campañas disponibles.
                                        </td>
                                    </tr>
                                ) : (
                                    distCamp.map((r: any, idx: number) => {
                                        const isSelected = String(filterCampania) === String(r.campania);
                                        return (
                                            <tr
                                                key={idx}
                                                onClick={() => onFilterCampania(isSelected ? '' : String(r.campania))}
                                                className={`cursor-pointer transition-colors ${
                                                    isSelected
                                                        ? 'bg-cyan-500/15 text-cyan-300 font-bold'
                                                        : 'hover:bg-navy-900/60 text-slate-300'
                                                }`}
                                            >
                                                <td className="py-2 px-3 font-bold">{r.campania}</td>
                                                <td className="py-2 px-3 text-right">{r.registros?.toLocaleString()}</td>
                                                <td className="py-2 px-3 text-right text-red-400 font-bold">{r.alertas || 0}</td>
                                                <td className="py-2 px-3 text-right text-yellow-400">{r.vacios || 0}</td>
                                                <td className="py-2 px-3 text-right font-black text-emerald-400">
                                                    {r.calidad_pct?.toFixed(1)}%
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* TOP 5 TALADROS CON MAYOR INCIDENCIA */}
            <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <BarChart3 size={14} className="text-cyan-400" />
                        <span>Top 5 Taladros con Mayor Desviación</span>
                    </h3>
                    {filterTaladro && (
                        <button
                            onClick={() => onFilterTaladro('')}
                            className="text-[10px] text-cyan-400 hover:underline font-bold"
                        >
                            Quitar filtro ({filterTaladro})
                        </button>
                    )}
                </div>

                <div className="rounded-xl border border-navy-800 overflow-hidden bg-navy-950">
                    <div className="max-h-56 overflow-y-auto scrollbar-thin">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-navy-900 text-slate-400 font-extrabold border-b border-navy-800">
                                <tr>
                                    <th className="py-2 px-3">Taladro (DDH)</th>
                                    <th className="py-2 px-3 text-right">Muestras</th>
                                    <th className="py-2 px-3 text-right text-red-400">Alertas</th>
                                    <th className="py-2 px-3 text-right text-yellow-400">Vacíos</th>
                                    <th className="py-2 px-3 text-right text-cyan-400">Salud %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-navy-850">
                                {worstDh.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-4 text-center text-slate-500 italic">
                                            No se detectaron taladros con desviaciones.
                                        </td>
                                    </tr>
                                ) : (
                                    worstDh.map((dh: any, idx: number) => {
                                        const isSelected = filterTaladro === dh.taladro;
                                        return (
                                            <tr
                                                key={idx}
                                                onClick={() => onFilterTaladro(isSelected ? '' : dh.taladro)}
                                                className={`cursor-pointer transition-colors ${
                                                    isSelected
                                                        ? 'bg-cyan-500/15 text-cyan-300 font-bold'
                                                        : 'hover:bg-navy-900/60 text-slate-300'
                                                }`}
                                            >
                                                <td className="py-2 px-3 font-bold">{dh.taladro}</td>
                                                <td className="py-2 px-3 text-right">{dh.total_muestras}</td>
                                                <td className="py-2 px-3 text-right text-red-400 font-bold">{dh.alertas}</td>
                                                <td className="py-2 px-3 text-right text-yellow-400">{dh.vacios}</td>
                                                <td className="py-2 px-3 text-right font-black text-cyan-300">
                                                    {dh.salud_pct?.toFixed(1)}%
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
