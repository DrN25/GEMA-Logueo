import { BarChart3 } from 'lucide-react';

interface PltConsolidatedDeviationsProps {
    kpis: any;
    selectedRuleCode: string | null;
    onSelectRuleCode: (code: string | null) => void;
}

export default function PltConsolidatedDeviations({
    kpis,
    selectedRuleCode,
    onSelectRuleCode
}: PltConsolidatedDeviationsProps) {
    if (!kpis) return null;

    const devs = kpis.top_deviations || [];
    if (devs.length === 0) return null;

    return (
        <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-navy-800 pb-2">
                <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-cyan-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Consolidado de Desviaciones e Inconsistencias Geomecánicas
                    </h3>
                </div>
                {selectedRuleCode && (
                    <button
                        onClick={() => onSelectRuleCode(null)}
                        className="text-[11px] text-cyan-400 hover:underline font-bold"
                    >
                        Mostrar todas las reglas
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {devs.map((d: any, idx: number) => {
                    const isSelected = selectedRuleCode === d.code;
                    const isAlert = d.severity === 'ALERTA';
                    const isVacio = d.severity === 'VACIO';

                    return (
                        <div
                            key={idx}
                            onClick={() => onSelectRuleCode(isSelected ? null : d.code)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                    ? 'border-cyan-500 bg-cyan-950/30 shadow-md ring-1 ring-cyan-500/50'
                                    : 'border-navy-800 bg-navy-950/60 hover:border-slate-700 hover:bg-navy-900/60'
                            }`}
                        >
                            <div className="flex justify-between items-start gap-2 mb-1.5">
                                <span className="text-xs font-bold text-slate-200 line-clamp-2">
                                    {d.name}
                                </span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                                    isAlert
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        : isVacio
                                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                }`}>
                                    {d.count} ({d.percentage}%)
                                </span>
                            </div>

                            {/* Barra de Progreso */}
                            <div className="w-full bg-navy-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-1.5 rounded-full ${
                                        isAlert ? 'bg-red-500' : isVacio ? 'bg-yellow-400' : 'bg-orange-400'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(5, d.percentage))}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
