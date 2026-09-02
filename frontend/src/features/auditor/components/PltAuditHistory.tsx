import { Folder, FileSpreadsheet, Trash2 } from 'lucide-react';

export interface PltAuditHistoryItem {
    audit_id: string;
    nombre_archivo: string;
    fecha_auditoria: string;
    total_registros: number;
    integridad_global_pct: number;
    total_alertas: number;
    total_advertencias: number;
    total_vacios: number;
    has_report?: boolean;
}

interface PltAuditHistoryProps {
    history: PltAuditHistoryItem[];
    selectedAuditId: string;
    onSelectAudit: (auditId: string) => void;
    onClearHistory: () => void;
}

export default function PltAuditHistory({
    history,
    selectedAuditId,
    onSelectAudit,
    onClearHistory
}: PltAuditHistoryProps) {
    return (
        <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-4 shadow-md select-none">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Folder size={14} className="text-cyan-400" />
                    <span>Historial de Auditorías PLT Realizadas</span>
                </h3>
                {history.length > 0 && (
                    <button
                        onClick={onClearHistory}
                        className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 hover:underline"
                    >
                        <Trash2 size={12} />
                        <span>Limpiar historial</span>
                    </button>
                )}
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {history.length === 0 ? (
                    <span className="text-xs text-slate-500 italic px-2">No hay registros de auditorías PLT anteriores.</span>
                ) : (
                    history.map((audit) => {
                        const isActive = selectedAuditId === audit.audit_id;
                        return (
                            <button
                                key={audit.audit_id}
                                onClick={() => onSelectAudit(audit.audit_id)}
                                className={`flex-shrink-0 w-64 p-3 rounded-xl border text-left transition-all ${
                                    isActive
                                        ? 'border-cyan-500 bg-cyan-950/30 shadow-md ring-1 ring-cyan-500/30'
                                        : 'border-navy-800 bg-navy-950 hover:border-slate-700 hover:bg-navy-900/60'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <FileSpreadsheet size={14} className={isActive ? 'text-cyan-400' : 'text-slate-400'} />
                                    <span className="text-xs font-bold text-slate-200 truncate" title={audit.nombre_archivo}>
                                        {audit.nombre_archivo}
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-500 mb-2">
                                    {audit.fecha_auditoria}
                                </div>
                                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-navy-850">
                                    <span className="font-bold text-slate-300">
                                        {audit.total_registros?.toLocaleString()} regs
                                    </span>
                                    <span className={`font-bold ${
                                        audit.integridad_global_pct >= 90 ? 'text-emerald-400' : 'text-cyan-400'
                                    }`}>
                                        {audit.integridad_global_pct?.toFixed(1)}% salud
                                    </span>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
