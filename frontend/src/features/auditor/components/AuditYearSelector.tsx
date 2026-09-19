import { Calendar, Check, RotateCcw, Sparkles } from 'lucide-react';

export const ALL_AUDIT_YEARS = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];

interface AuditYearSelectorProps {
    selectedYears: string[];
    onYearsChange: (years: string[]) => void;
    className?: string;
    compact?: boolean;
    title?: string;
}

export default function AuditYearSelector({
    selectedYears,
    onYearsChange,
    className = '',
    compact = false,
    title = 'Campañas / Años a Auditar:'
}: AuditYearSelectorProps) {
    const isAllSelected = selectedYears.length === ALL_AUDIT_YEARS.length;
    const isNoneSelected = selectedYears.length === 0;

    const handleToggleYear = (year: string) => {
        if (selectedYears.includes(year)) {
            onYearsChange(selectedYears.filter(y => y !== year));
        } else {
            // Mantener orden cronológico
            const next = [...selectedYears, year].sort((a, b) => Number(a) - Number(b));
            onYearsChange(next);
        }
    };

    const handleSelectAll = () => {
        onYearsChange([...ALL_AUDIT_YEARS]);
    };

    const handleSelectNone = () => {
        onYearsChange([]);
    };

    const handleSelectOnly2026 = () => {
        onYearsChange(['2026']);
    };

    const handleSelectRecent = () => {
        onYearsChange(['2025', '2026']);
    };

    return (
        <div className={`rounded-xl border border-navy-800 bg-navy-900/70 p-2.5 sm:p-3 shadow-md backdrop-blur-md transition-all ${className}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                {/* Etiqueta e Indicador de Estado */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
                        <Calendar size={14} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider">
                                {title}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                isAllSelected
                                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                    : isNoneSelected
                                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}>
                                {isAllSelected
                                    ? 'Todos (7/7)'
                                    : isNoneSelected
                                    ? '0 seleccionados'
                                    : `${selectedYears.length}/7: ${selectedYears.join(', ')}`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Botones de Años y Accesos Rápidos */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Botones de Años Individuales (2020 a 2026) */}
                    <div className="inline-flex p-1 bg-navy-950 rounded-xl border border-navy-800 shadow-inner flex-wrap gap-1">
                        {ALL_AUDIT_YEARS.map(yr => {
                            const isChecked = selectedYears.includes(yr);
                            return (
                                <button
                                    key={yr}
                                    type="button"
                                    onClick={() => handleToggleYear(yr)}
                                    title={`Clic para ${isChecked ? 'deseleccionar' : 'seleccionar'} campaña ${yr}`}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-black transition-all cursor-pointer select-none active:scale-95 ${
                                        isChecked
                                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 border border-cyan-400'
                                            : 'bg-navy-900/40 text-slate-500 hover:text-slate-300 hover:bg-navy-800/60 border border-navy-850'
                                    }`}
                                >
                                    {isChecked && <Check size={12} strokeWidth={3} className="text-slate-950 shrink-0" />}
                                    <span>{yr}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Presets Rápidos */}
                    {!compact && (
                        <div className="flex items-center gap-1 pl-1 border-l border-navy-800/80">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                title="Seleccionar todas las campañas (2020 - 2026)"
                                className={`px-2 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                                    isAllSelected
                                        ? 'bg-navy-800 text-cyan-400 border border-cyan-500/30'
                                        : 'bg-navy-950 text-slate-400 hover:text-slate-200 hover:bg-navy-800 border border-navy-800'
                                }`}
                            >
                                Todas
                            </button>

                            <button
                                type="button"
                                onClick={handleSelectRecent}
                                title="Auditar solo 2025 y 2026"
                                className="px-2 py-1 rounded-lg text-[11px] font-black bg-navy-950 text-slate-400 hover:text-slate-200 hover:bg-navy-800 border border-navy-800 transition-all cursor-pointer"
                            >
                                2025-2026
                            </button>

                            <button
                                type="button"
                                onClick={handleSelectOnly2026}
                                title="Auditar solo 2026 (Chalcobamba)"
                                className="px-2 py-1 rounded-lg text-[11px] font-black bg-navy-950 text-amber-400 hover:bg-amber-500/10 border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1"
                            >
                                <Sparkles size={11} />
                                <span>2026</span>
                            </button>

                            {!isNoneSelected && (
                                <button
                                    type="button"
                                    onClick={handleSelectNone}
                                    title="Desmarcar todos"
                                    className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                                >
                                    <RotateCcw size={12} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Alerta si no hay años seleccionados */}
            {isNoneSelected && (
                <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold flex items-center justify-between">
                    <span>⚠️ Has deseleccionado todos los años. Activa al menos uno para visualizar los resultados.</span>
                    <button
                        type="button"
                        onClick={handleSelectAll}
                        className="underline font-bold text-red-200 hover:text-white"
                    >
                        Activar todos
                    </button>
                </div>
            )}
        </div>
    );
}
