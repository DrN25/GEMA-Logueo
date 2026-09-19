import { useState, useEffect } from 'react';
import { Layers, Activity } from 'lucide-react';
import BulkAuditor from './BulkAuditor';
import PltBulkAuditor from './PltBulkAuditor';
import AuditYearSelector, { ALL_AUDIT_YEARS } from './components/AuditYearSelector';

interface AuditoriaHubProps {
    apiBase: string;
}

export default function AuditoriaHub({ apiBase }: AuditoriaHubProps) {
    const [auditMode, setAuditMode] = useState<'logueo' | 'plt'>(() => {
        return (localStorage.getItem('gema_logueo_active_audit_mode') as 'logueo' | 'plt') || 'logueo';
    });

    const [selectedYears, setSelectedYears] = useState<string[]>(() => {
        const saved = localStorage.getItem('gema_selected_audit_years');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch {}
        }
        return ALL_AUDIT_YEARS;
    });

    useEffect(() => {
        localStorage.setItem('gema_logueo_active_audit_mode', auditMode);
    }, [auditMode]);

    useEffect(() => {
        localStorage.setItem('gema_selected_audit_years', JSON.stringify(selectedYears));
    }, [selectedYears]);

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-navy-950 overflow-hidden select-none font-sans">
            {/* Barra de Selector Superior */}
            <div className="bg-navy-900 border-b border-navy-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                        Módulo:
                    </span>
                    <div className="inline-flex p-1 bg-navy-950 rounded-xl border border-navy-800 shadow-inner">
                        {/* Opción 1: Logueo Geomecánico DDH */}
                        <button
                            onClick={() => setAuditMode('logueo')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                auditMode === 'logueo'
                                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/50'
                            }`}
                        >
                            <Layers size={14} />
                            <span>Logueo Geomecánico (DDH)</span>
                        </button>

                        {/* Opción 2: Ensayos PLT Regulares */}
                        <button
                            onClick={() => setAuditMode('plt')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                auditMode === 'plt'
                                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/50'
                            }`}
                        >
                            <Activity size={14} />
                            <span>Ensayos PLT Regulares</span>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                auditMode === 'plt' ? 'bg-navy-950/40 text-slate-900 dark:text-slate-950' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            }`}>
                                QA/QC
                            </span>
                        </button>
                    </div>
                </div>

                {/* Selector Global de Años (2020-2026) */}
                <div className="flex items-center">
                    <AuditYearSelector
                        selectedYears={selectedYears}
                        onYearsChange={setSelectedYears}
                        compact={true}
                    />
                </div>
            </div>

            {/* Contenedor del Auditor Activo */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                {auditMode === 'logueo' ? (
                    <BulkAuditor
                        apiBase={apiBase}
                        selectedYears={selectedYears}
                        onSelectedYearsChange={setSelectedYears}
                    />
                ) : (
                    <PltBulkAuditor
                        apiBase={apiBase}
                        selectedYears={selectedYears}
                        onSelectedYearsChange={setSelectedYears}
                    />
                )}
            </div>
        </div>
    );
}
