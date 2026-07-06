import {
    AlertOctagon,
    AlertTriangle,
    CheckCircle,
    Activity,
    Layers,
    ShieldAlert,
    ShieldCheck,
    ArrowRight,
    MapPin,
    Tag,
    Scale,
    TrendingUp
} from 'lucide-react';
import type { EnsayoPlt } from '../../../App';
import type { ValidationAlert } from '../../../utils/qaqcValidator';

interface PltQaqcPanelProps {
    ensayos_plt: EnsayoPlt[];
    alerts: ValidationAlert[];
    onFocusField?: (fieldId: string) => void;
    onSwitchTab?: (tab: 'plt' | 'qaqc') => void;
    darkMode?: boolean;
}

const safeFloat = (val: any, fallback = 0.0): number => {
    const parsed = parseFloat(val);
    return isNaN(parsed) || !isFinite(parsed) ? fallback : parsed;
};

export default function PltQaqcPanel({
    ensayos_plt = [],
    alerts = [],
    onFocusField,
    onSwitchTab,
    darkMode: _darkMode = true
}: PltQaqcPanelProps) {
    try {
        const safePlts = Array.isArray(ensayos_plt) ? ensayos_plt : [];
        const safeAlerts = Array.isArray(alerts) ? alerts : [];

        // Filtrar únicamente alertas asociadas a PLT
        const pltAlerts = safeAlerts.filter(a => a && a.field && a.field.startsWith('plt-'));

        const getAlertContext = (fieldId: string) => {
            if (!fieldId) return { tab: 'PLT', column: 'General' };
            const parts = fieldId.split('-');
            const key = parts[1] || '';
            let column = 'General';
            switch (key) {
                case 'from_m': column = 'From'; break;
                case 'to_m': column = 'To'; break;
                case 'd_mm': column = 'D (mm)'; break;
                case 'p_instr_kn': column = 'P instr (kN)'; break;
                case 'long_de_muestra_mm': column = 'Long. Muestra'; break;
                case 'este_m': column = 'Este (m)'; break;
                case 'norte_m': column = 'Norte (m)'; break;
                case 'elevacion_msnm': column = 'Elevación (msnm)'; break;
                case 'litologia_1': column = 'Litología 1'; break;
                case 'ucs': column = 'Cálculo UCS'; break;
            }
            return { tab: 'Ensayo PLT', column };
        };

        // --- Métricas Instrumentales ---
        const totalEnsayos = safePlts.length;
        let sumLoad = 0;
        let validLoadCount = 0;
        let sumUcs = 0;
        let validUcsCount = 0;
        let sumDiameter = 0;
        let validDiameterCount = 0;

        // Desglose de Calidad ISRM
        const isrmCounts = { Suelo: 0, R0: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0 };
        // Desglose de Tipos de Ensayo
        const typeCounts = { D: 0, A: 0, B: 0, I: 0 };
        // Desglose de Tipos de Rotura
        const failureCounts = { M: 0, E: 0, C: 0 };

        safePlts.forEach(p => {
            const load = safeFloat(p.p_instr_kn);
            const ucsVal = safeFloat(p.ucs);
            const diameter = safeFloat(p.d_mm);

            if (load > 0) {
                sumLoad += load;
                validLoadCount++;
            }
            if (ucsVal > 0) {
                sumUcs += ucsVal;
                validUcsCount++;
            }
            if (diameter > 0) {
                sumDiameter += diameter;
                validDiameterCount++;
            }

            // Tipos de Ensayo (Diametral, Axial, Bloque, Irregular)
            const testType = (p.tipo_de_ensayo || 'D').toUpperCase();
            if (testType in typeCounts) {
                typeCounts[testType as keyof typeof typeCounts]++;
            }

            // Tipos de Rotura (Matriz, Estructura, Cizalla/Contacto)
            const failType = (p.tipo_rotura_code || 'M').toUpperCase();
            if (failType in failureCounts) {
                failureCounts[failType as keyof typeof failureCounts]++;
            }

            // Clasificación de Resistencia ISRM
            const rIdx = p.isrm_indice_r || 'R0';
            if (rIdx in isrmCounts) {
                isrmCounts[rIdx as keyof typeof isrmCounts]++;
            }
        });

        const avgLoad = validLoadCount > 0 ? sumLoad / validLoadCount : 0.0;
        const avgUcs = validUcsCount > 0 ? sumUcs / validUcsCount : 0.0;
        const avgDiameter = validDiameterCount > 0 ? sumDiameter / validDiameterCount : 0.0;

        const criticalCount = pltAlerts.filter(a => a && a.type === 'CRITICAL').length;
        const warningCount = pltAlerts.filter(a => a && a.type === 'WARNING').length;
        const vacioCount = pltAlerts.filter(a => a && a.type === 'VACIO').length;

        const handleAlertFix = (fieldId: string) => {
            if (onSwitchTab) onSwitchTab('plt');
            setTimeout(() => {
                if (onFocusField) onFocusField(fieldId);
            }, 100);
        };

        return (
            <div className="space-y-6 pb-12 animate-fade-in text-slate-200">

                {/* Tarjetas Estadísticas Instrumentales */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

                    {/* Total Ensayos */}
                    <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Muestras Ensayadas</span>
                            <Layers size={16} className="text-cyan-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-2xl font-black text-slate-100">{totalEnsayos}</span>
                            <span className="text-xs text-slate-500 block mt-1">Carga diametral/axial</span>
                        </div>
                    </div>

                    {/* Carga Promedio */}
                    <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Carga de Ruptura (P)</span>
                            <Scale size={16} className="text-amber-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-2xl font-black text-slate-100">{avgLoad.toFixed(3)} kN</span>
                            <span className="text-xs text-slate-500 block mt-1">Fuerza aplicada media</span>
                        </div>
                    </div>

                    {/* Diámetro Promedio */}
                    <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Diámetro Promedio (D)</span>
                            <Activity size={16} className="text-cyan-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-2xl font-black text-slate-100">{avgDiameter.toFixed(1)} mm</span>
                            <span className="text-xs text-slate-500 block mt-1">Dimensión real medida</span>
                        </div>
                    </div>

                    {/* UCS Estimado Medio */}
                    <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">UCS Promedio (Is50 * k)</span>
                            <TrendingUp size={16} className="text-emerald-400" />
                        </div>
                        <div className="mt-4">
                            <span className="text-2xl font-black text-slate-100">{avgUcs.toFixed(1)} MPa</span>
                            <span className="text-xs text-slate-500 block mt-1">Determinación indirecta</span>
                        </div>
                    </div>

                    {/* Auditoría QA/QC PLT Card */}
                    <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">QA/QC PLT</span>
                            {criticalCount > 0 ? (
                                <ShieldAlert size={16} className="text-red-400 animate-pulse" />
                            ) : (
                                <ShieldCheck size={16} className="text-emerald-400" />
                            )}
                        </div>
                        <div className="mt-4">
                            <div className="flex items-baseline gap-2">
                                <span className={`text-2xl font-black ${criticalCount > 0 ? 'text-red-400' : warningCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {pltAlerts.length}
                                </span>
                                <span className="text-xs text-slate-400 font-semibold">alertas</span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex gap-1.5 mt-1.5 flex-wrap">
                                <span className="bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">{criticalCount} Err</span>
                                <span className="bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">{warningCount} Adv</span>
                                <span className="bg-slate-500/10 text-slate-400 px-1.5 py-0.5 rounded border border-slate-500/20">{vacioCount} Vac</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Desglose Gráfico de Ensayos e ISRM */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Distribución Física e Instrumental */}
                    <div className="glass-panel p-5 rounded-xl border border-navy-800/40 bg-navy-900/10 lg:col-span-2 space-y-5 shadow-xl">
                        <div>
                            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                                Distribución Mecánica e Instrumental
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Balance de tipos de ensayos aplicados y tipología de rotura en núcleos
                            </p>
                        </div>

                        {/* Barras de Desglose de Tipos de Ensayo */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clasificación por Tipo de Ensayo</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { label: 'Diametral (D)', count: typeCounts.D, color: 'bg-emerald-500' },
                                    { label: 'Axial (A)', count: typeCounts.A, color: 'bg-cyan-500' },
                                    { label: 'Bloque (B)', count: typeCounts.B, color: 'bg-purple-500' },
                                    { label: 'Irregular (I)', count: typeCounts.I, color: 'bg-amber-500' },
                                ].map((item, idx) => {
                                    const pct = totalEnsayos > 0 ? (item.count / totalEnsayos) * 100 : 0;
                                    return (
                                        <div key={idx} className="bg-navy-950/45 p-3 rounded-lg border border-navy-900/60 space-y-1.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-slate-300">{item.label}</span>
                                                <span className="font-semibold text-slate-400">{item.count} ({pct.toFixed(0)}%)</span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-navy-900 overflow-hidden">
                                                <div style={{ width: `${pct}%` }} className={`h-full transition-all ${item.color}`} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Barras de Desglose de Tipos de Rotura */}
                        <div className="space-y-4 pt-4 border-t border-navy-850">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modos de Rotura de Probeta</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                    { label: 'En Matriz (M) [Válida]', count: failureCounts.M, color: 'bg-emerald-400' },
                                    { label: 'En Estructura (E) [No Válida]', count: failureCounts.E, color: 'bg-red-500' },
                                    { label: 'En Cizalla/Contacto (C) [No Válida]', count: failureCounts.C, color: 'bg-orange-400' },
                                ].map((item, idx) => {
                                    const pct = totalEnsayos > 0 ? (item.count / totalEnsayos) * 100 : 0;
                                    return (
                                        <div key={idx} className="bg-navy-950/45 p-3 rounded-lg border border-navy-900/60 space-y-1.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-slate-300">{item.label}</span>
                                                <span className="font-semibold text-slate-400">{item.count} ({pct.toFixed(0)}%)</span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-navy-900 overflow-hidden">
                                                <div style={{ width: `${pct}%` }} className={`h-full transition-all ${item.color}`} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {/* Gráfico de Resistencia ISRM */}
                    <div className="glass-panel p-5 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-4 shadow-xl">
                        <div>
                            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                                Clasificación de Resistencia (ISRM)
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Desglose cualitativo determinado por el UCS
                            </p>
                        </div>

                        <div className="space-y-3.5 text-xs font-semibold">
                            {[
                                { label: 'Extremadamente Fuerte (R6) (>250 MPa)', count: isrmCounts.R6, color: 'bg-emerald-400' },
                                { label: 'Muy Fuerte (R5) (100-250 MPa)', count: isrmCounts.R5, color: 'bg-cyan-500' },
                                { label: 'Fuerte (R4) (50-100 MPa)', count: isrmCounts.R4, color: 'bg-blue-500' },
                                { label: 'Resistencia Media (R3) (25-50 MPa)', count: isrmCounts.R3, color: 'bg-amber-400' },
                                { label: 'Débil (R2) (5-25 MPa)', count: isrmCounts.R2, color: 'bg-orange-400' },
                                { label: 'Muy Débil (R1) (1-5 MPa)', count: isrmCounts.R1, color: 'bg-red-500' },
                                { label: 'Extremadamente Débil (R0) (<1 MPa)', count: isrmCounts.R0 + isrmCounts.Suelo, color: 'bg-red-700' },
                            ].map((bin, i) => {
                                const pct = totalEnsayos > 0 ? (bin.count / totalEnsayos) * 100 : 0;
                                return (
                                    <div key={i} className="space-y-1">
                                        <div className="flex justify-between text-slate-300">
                                            <span>{bin.label}</span>
                                            <span className="text-slate-400 font-bold">{bin.count} ({pct.toFixed(0)}%)</span>
                                        </div>
                                        <div className="w-full h-1.5 rounded-full bg-navy-950 overflow-hidden">
                                            <div style={{ width: `${pct}%` }} className={`h-full transition-all ${bin.color}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

                {/* Listado Interactivo de Auditoría (PLT) */}
                <div className="glass-panel p-5 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-4 shadow-xl">
                    <div>
                        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                            Listado Auditor de Inconsistencias (QA/QC PLT)
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Detección de tramos huérfanos, discrepancias litológicas y UCS, o dimensiones de probetas inadecuadas
                        </p>
                    </div>

                    <div className="space-y-2.5">
                        {pltAlerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 border border-dashed border-navy-800 rounded-lg">
                                <CheckCircle size={44} className="text-emerald-500/20 mb-2" />
                                <p className="text-sm font-bold text-slate-300 uppercase tracking-wide">Sin Inconsistencias</p>
                                <p className="text-xs mt-1 text-slate-400">
                                    Todas las lecturas de carga puntual y relaciones dimensionales cumplen con los límites de consistencia física.
                                </p>
                            </div>
                        ) : (
                            [...pltAlerts]
                                .sort((a, b) => (a?.type === 'CRITICAL' ? -1 : 1) - (b?.type === 'CRITICAL' ? -1 : 1))
                                .map((alert, idx) => {
                                    if (!alert) return null;
                                    const isCritical = alert.type === 'CRITICAL';
                                    const context = getAlertContext(alert.field);
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => handleAlertFix(alert.field)}
                                            className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all hover:translate-x-1 active:scale-[0.99] flex justify-between items-center ${isCritical
                                                ? 'bg-red-500/5 dark:bg-red-950/20 border-red-500/20 text-red-200 hover:bg-red-500/10 hover:border-red-500/35'
                                                : 'bg-amber-500/5 dark:bg-amber-950/15 border-amber-500/25 text-amber-200 hover:bg-amber-500/10 hover:border-amber-500/35'
                                                }`}
                                        >
                                            <div className="flex gap-3 items-start pr-4">
                                                {isCritical ? (
                                                    <AlertOctagon size={18} className="text-red-400 shrink-0 mt-0.5" />
                                                ) : (
                                                    <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                                )}
                                                <div className="space-y-2 flex-1 min-w-0">
                                                    <div className="flex flex-wrap gap-1.5 items-center">
                                                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${isCritical
                                                            ? 'bg-red-500/20 border-red-500/40 text-red-300'
                                                            : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                                            }`}>
                                                            {isCritical ? 'Error crítico' : 'Aviso'}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800/70 border border-slate-700/60 text-slate-300">
                                                            <MapPin size={11} className="text-cyan-400 shrink-0" />
                                                            {context.tab}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                                                            <Tag size={11} className="shrink-0" />
                                                            {context.column}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm leading-snug text-slate-200 font-medium">{alert.message}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="flex items-center gap-1 bg-navy-950 hover:bg-navy-900 border border-navy-850 hover:border-navy-750 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 active:scale-95 shadow-sm"
                                            >
                                                <span>Corregir</span>
                                                <ArrowRight size={13} />
                                            </button>
                                        </div>
                                    );
                                })
                        )}
                    </div>
                </div>

            </div>
        );
    } catch (e) {
        console.error("QA/QC PLT Panel Render Error:", e);
        return (
            <div className="glass-panel p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-center text-red-400 my-8 max-w-xl mx-auto">
                <AlertOctagon className="mx-auto text-red-500 mb-2" size={36} />
                <h3 className="text-sm font-bold uppercase tracking-wider">Error al procesar QA/QC PLT</h3>
                <p className="text-xs mt-1 text-slate-400">
                    Ocurrió un error inesperado al procesar los datos de los ensayos de carga puntual. Verifique que no existan campos vacíos críticos en la tabla.
                </p>
            </div>
        );
    }
}