import {
    ChevronUp,
    ChevronDown
} from 'lucide-react';
import type { EnsayoPlt } from '../../App';
import type { ValidationAlert } from '../../utils/qaqcValidator';

interface QaqcPltDashboardPanelProps {
    ensayos_plt: EnsayoPlt[];
    alerts: ValidationAlert[];
    onSwitchTab: (tab: 'plt' | 'qaqc') => void;
    darkMode?: boolean;
}

const safeFloat = (val: any, fallback = 0.0): number => {
    const parsed = parseFloat(val);
    return isNaN(parsed) || !isFinite(parsed) ? fallback : parsed;
};

// Colores estándar de ISRM
const ISRM_COLORS: Record<string, string> = {
    Suelo: 'bg-blue-600/35 border-blue-500/50 text-blue-200',
    R0: 'bg-sky-900/40 border-sky-700/50 text-sky-200',
    R1: 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200',
    R2: 'bg-emerald-900/40 border-emerald-600/50 text-emerald-300',
    R3: 'bg-amber-900/40 border-amber-600/50 text-amber-300',
    R4: 'bg-orange-900/40 border-orange-600/50 text-orange-300',
    R5: 'bg-red-950/40 border-red-700/50 text-red-200',
    R6: 'bg-purple-950/40 border-purple-700/50 text-purple-200',
};

const CHART_COLORS = ["#29b6f6", "#26a69a", "#66bb6a", "#ffa726", "#ef5350", "#ab47bc", "#f06292", "#80cbc4"];

// Constantes de geometría para el Donut Chart en SVG Nativo
const DONUT_R = 35;
const DONUT_C = 2 * Math.PI * DONUT_R; // Circunferencia aproximada: ~219.91

export default function QaqcPltDashboardPanel({
    ensayos_plt = [],
    alerts = [],
    onSwitchTab: _onSwitchTab,
    darkMode: _darkMode = true
}: QaqcPltDashboardPanelProps) {
    const safePlts = Array.isArray(ensayos_plt) ? ensayos_plt : [];
    const safeAlerts = Array.isArray(alerts) ? alerts : [];

    // Filtrar alertas únicamente de PLT
    const pltAlerts = safeAlerts.filter(a => a && a.field && a.field.startsWith('plt-'));
    // const criticalCount = pltAlerts.filter(a => a.type === 'CRITICAL').length;
    // const warningCount = pltAlerts.filter(a => a.type === 'WARNING').length;

    // 1. Filtrar ensayos válidos según criterios físicos rigurosos (excluye L < D, P<=0, From>To)
    const ensayosValidos = safePlts.filter(p => {
        const from = parseFloat(p.from_m as any) || 0;
        const to = parseFloat(p.to_m as any) || 0;
        const d = parseFloat(p.d_mm as any) || 0;
        const p_instr = parseFloat(p.p_instr_kn as any) || 0;
        const long_muestra = parseFloat(p.long_de_muestra_mm as any) || 0;
        return from < to && p_instr > 0 && d > 0 && long_muestra >= d && p.verif_corrida === 'OK';
    });

    const totalCount = safePlts.length;
    const validCount = ensayosValidos.length;
    const obsCount = pltAlerts.length;

    // --- CÁLCULOS ESTADÍSTICOS ---
    let sumLoad = 0;
    let sumUcs = 0;
    let sumIs50 = 0;

    const isrmCounts: Record<string, number> = { Suelo: 0, R0: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0 };
    const litoGroups: Record<string, { ucsList: number[]; is50List: number[] }> = {};
    const taladroUcsGroups: Record<string, number[]> = {};

    ensayosValidos.forEach(p => {
        const load = safeFloat(p.p_instr_kn);
        const ucsVal = safeFloat(p.ucs);
        const is50 = safeFloat(p.is_50_mpa);
        const lito = p.litologia_1 || 'S/D';
        const tal = p.taladro || 'TALADRO';

        sumLoad += load;
        sumUcs += ucsVal;
        sumIs50 += is50;

        // ISRM
        const rIdx = p.isrm_indice_r;
        if (rIdx && rIdx in isrmCounts) {
            isrmCounts[rIdx]++;
        }

        // Litología agrupación
        if (!litoGroups[lito]) {
            litoGroups[lito] = { ucsList: [], is50List: [] };
        }
        litoGroups[lito].ucsList.push(ucsVal);
        litoGroups[lito].is50List.push(is50);

        // Taladro agrupación
        if (!taladroUcsGroups[tal]) {
            taladroUcsGroups[tal] = [];
        }
        taladroUcsGroups[tal].push(ucsVal);
    });

    // const avgLoad = validCount > 0 ? sumLoad / validCount : 0;
    const avgUcs = validCount > 0 ? sumUcs / validCount : 0;
    const avgIs50 = validCount > 0 ? sumIs50 / validCount : 0;

    // Clase ISRM Predominante
    let maxCount = -1;
    let clasePredominante = 'S/D';
    Object.entries(isrmCounts).forEach(([clase, count]) => {
        if (count > maxCount && count > 0) {
            maxCount = count;
            clasePredominante = clase;
        }
    });

    // Data 1: UCS promedio por Taladro
    const taladroData = Object.entries(taladroUcsGroups).map(([tal, list]) => ({
        taladro: tal,
        promedio: parseFloat((list.reduce((a, b) => a + b, 0) / list.length).toFixed(2)),
    }));

    // Data 2: Is(50) promedio por Litología
    const litoStats = Object.entries(litoGroups).map(([lito, data]) => {
        const count = data.ucsList.length;
        const avgUcsLito = data.ucsList.reduce((a, b) => a + b, 0) / count;
        const avgIs50Lito = data.is50List.reduce((a, b) => a + b, 0) / count;

        // Desviación estándar
        const variance = data.ucsList.reduce((acc, val) => acc + Math.pow(val - avgUcsLito, 2), 0) / count;
        const stdDev = Math.sqrt(variance);

        return {
            litologia: lito,
            count,
            avgUcs: avgUcsLito,
            promedioIs50: parseFloat(avgIs50Lito.toFixed(4)),
            promedioUCS: parseFloat(avgUcsLito.toFixed(2)),
            desviacion: parseFloat(stdDev.toFixed(2)),
        };
    }).sort((a, b) => b.promedioUCS - a.promedioUCS);

    // Data 3: UCS vs Profundidad por Taladro
    const taladrosUnicos = [...new Set(ensayosValidos.map(v => v.taladro).filter(Boolean))];
    const scatterSeries = taladrosUnicos.map((tal, m) => ({
        taladro: tal,
        color: CHART_COLORS[m % CHART_COLORS.length],
        data: ensayosValidos
            .filter(g => g.taladro === tal)
            .map(g => ({
                prof: parseFloat(g.from_m as any) || 0,
                ucs: parseFloat(g.ucs as any) || 0,
                isrm: g.isrm_indice_r || 'R0',
                muestra: g.nro_muestra || 'S/D'
            }))
            .sort((a, b) => a.prof - b.prof)
    }));

    // Data 4: Tarta de distribución ISRM
    const pieData = Object.entries(isrmCounts)
        .filter(([_, count]) => count > 0)
        .map(([clase, count]) => {
            // Mapear colores de clases de barra
            const colorsMap: Record<string, string> = {
                Suelo: '#3b82f6',
                R0: '#64748b',
                R1: '#10b981',
                R2: '#0d9488',
                R3: '#f59e0b',
                R4: '#f97316',
                R5: '#ef4444',
                R6: '#8b5cf6'
            };
            return {
                name: clase,
                value: count,
                color: colorsMap[clase] || '#64748b'
            };
        });

    // Listados de Extremos
    const topCompetentes = [...ensayosValidos]
        .sort((a, b) => safeFloat(b.ucs) - safeFloat(a.ucs))
        .slice(0, 5);

    const topDebiles = [...ensayosValidos]
        .sort((a, b) => safeFloat(a.ucs) - safeFloat(b.ucs))
        .slice(0, 5);

    const formatPercent = (val: number, total: number) => {
        return total === 0 ? "—" : `${(val / total * 100).toFixed(1)}%`;
    };

    // --- PARSEO DE COORDENADAS PARA GRÁFICOS SVG NATIVOS ---
    const allDepths = ensayosValidos.map(p => parseFloat(p.from_m as any) || 0);
    const allUcs = ensayosValidos.map(p => parseFloat(p.ucs as any) || 0);
    const maxDepthAxis = Math.max(...allDepths, 50) * 1.1;
    const maxUcsAxis = Math.max(...allUcs, 100) * 1.1;

    // Variable de acumulación para el cálculo de offsets del donut chart
    let accumulatedPercent = 0;

    return (
        <div className="space-y-6 pb-12 animate-fade-in text-slate-200">

            {/* Indicadores Clave de Desempeño (KPIs) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
                <div className="bg-card border border-navy-800/40 rounded-xl p-3 flex flex-col gap-1 shadow-md bg-navy-900/10">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Total Ensayos</span>
                    <span className="text-2xl font-black text-slate-100">{totalCount}</span>
                </div>
                <div className="bg-card border border-navy-800/40 rounded-xl p-3 flex flex-col gap-1 shadow-md bg-navy-900/10">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Válidos</span>
                    <span className="text-2xl font-black text-emerald-400">{validCount} <span className="text-xs text-slate-500 font-semibold">({formatPercent(validCount, totalCount)})</span></span>
                </div>
                <div className="bg-card border border-navy-800/40 rounded-xl p-3 flex flex-col gap-1 shadow-md bg-navy-900/10">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Con Obs. QA/QC</span>
                    <span className="text-2xl font-black text-yellow-400">{obsCount} <span className="text-xs text-slate-500 font-semibold">({formatPercent(obsCount, totalCount)})</span></span>
                </div>
                <div className="bg-card border border-navy-800/40 rounded-xl p-3 flex flex-col gap-1 shadow-md bg-navy-900/10">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Prom. Is(50)</span>
                    <span className="text-2xl font-black text-cyan-400">{avgIs50 > 0 ? `${avgIs50.toFixed(3)} MPa` : '—'}</span>
                </div>
                <div className="bg-card border border-navy-800/40 rounded-xl p-3 flex flex-col gap-1 shadow-md bg-navy-900/10">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Promedio UCS</span>
                    <span className="text-2xl font-black text-emerald-400">{avgUcs > 0 ? `${avgUcs.toFixed(1)} MPa` : '—'}</span>
                </div>
                <div className="bg-card border border-navy-800/40 rounded-xl p-3 flex flex-col gap-1 shadow-md bg-navy-900/10">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Clase Predominante</span>
                    <div className="mt-1">
                        {clasePredominante !== 'S/D' ? (
                            <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded text-xs font-black border ${ISRM_COLORS[clasePredominante]}`}>
                                {clasePredominante}
                            </span>
                        ) : (
                            <span className="text-slate-500 text-sm font-bold">S/D</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Gráficos de Análisis de Resistencia (Fila 1) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Gráfico A: UCS Promedio por Taladro (Nativo) */}
                <div className="bg-card border border-navy-800/40 rounded-xl p-5 bg-navy-900/10 shadow-lg flex flex-col justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">UCS Promedio (MPa) por Taladro</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Comparativa de resistencia a la compresión media registrada por sondaje</p>
                    </div>
                    {taladroData.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-xs text-slate-500 italic">No hay datos geomecánicos calculados.</div>
                    ) : (
                        <div className="mt-4 flex flex-col gap-3.5">
                            {taladroData.map((item, idx) => {
                                const maxVal = Math.max(...taladroData.map(t => t.promedio), 1);
                                const pct = (item.promedio / maxVal) * 100;
                                return (
                                    <div key={item.taladro} className="space-y-1">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-300">{item.taladro}</span>
                                            <span className="font-bold font-mono text-cyan-400">{item.promedio.toFixed(2)} MPa</span>
                                        </div>
                                        <div className="w-full h-3 rounded-md bg-navy-950/80 overflow-hidden flex border border-navy-800/40">
                                            <div
                                                style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                                                className="h-full rounded-r transition-all"
                                                title={`UCS Promedio: ${item.promedio} MPa`}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Gráfico B: Is(50) por Litología (Nativo) */}
                <div className="bg-card border border-navy-800/40 rounded-xl p-5 bg-navy-900/10 shadow-lg flex flex-col justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Is(50) Corregido (MPa) por Litología</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Resistencia puntual promedio ajustada a diámetro estándar de 50mm</p>
                    </div>
                    {litoStats.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-xs text-slate-500 italic">No hay datos geomecánicos calculados.</div>
                    ) : (
                        <div className="mt-4 flex flex-col gap-3.5">
                            {litoStats.map((item) => {
                                const maxVal = Math.max(...litoStats.map(t => t.promedioIs50), 0.1);
                                const pct = (item.promedioIs50 / maxVal) * 100;
                                return (
                                    <div key={item.litologia} className="space-y-1">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-300">{item.litologia}</span>
                                            <span className="font-bold font-mono text-emerald-400">{item.promedioIs50.toFixed(4)} MPa</span>
                                        </div>
                                        <div className="w-full h-3 rounded-md bg-navy-950/80 overflow-hidden flex border border-navy-800/40">
                                            <div
                                                style={{ width: `${pct}%` }}
                                                className="h-full bg-teal-500 rounded-r transition-all"
                                                title={`Is(50) Promedio: ${item.promedioIs50} MPa`}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* Perfil Vertical y Distribución de Clases (Fila 2) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Gráfico C: Perfil de Resistencia UCS vs Profundidad (SVG Coordinado Nativo) */}
                <div className="lg:col-span-2 bg-card border border-navy-800/40 rounded-xl p-5 bg-navy-900/10 shadow-lg">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Perfil de UCS (MPa) vs Profundidad (m)</h3>
                    {ensayosValidos.length === 0 ? (
                        <div className="h-60 flex items-center justify-center text-xs text-slate-500 italic">No hay datos geomecánicos calculados.</div>
                    ) : (
                        <div className="relative w-full h-60">
                            <svg className="w-full h-full" viewBox="0 0 500 240">
                                {/* Cuadrícula de fondo */}
                                <line x1="40" y1="20" x2="480" y2="20" stroke="rgba(49, 59, 73, 0.4)" strokeWidth="1" />
                                <line x1="40" y1="70" x2="480" y2="70" stroke="rgba(49, 59, 73, 0.4)" strokeWidth="1" />
                                <line x1="40" y1="120" x2="480" y2="120" stroke="rgba(49, 59, 73, 0.4)" strokeWidth="1" />
                                <line x1="40" y1="170" x2="480" y2="170" stroke="rgba(49, 59, 73, 0.4)" strokeWidth="1" />
                                <line x1="40" y1="210" x2="480" y2="210" stroke="rgba(49, 59, 73, 0.8)" strokeWidth="1.5" />
                                <line x1="40" y1="20" x2="40" y2="210" stroke="rgba(49, 59, 73, 0.8)" strokeWidth="1.5" />

                                {/* Marcadores e indicadores de los ejes */}
                                <text x="40" y="222" fill="#64748b" fontSize="8" textAnchor="middle">0</text>
                                <text x="150" y="222" fill="#64748b" fontSize="8" textAnchor="middle">{(maxDepthAxis * 0.25).toFixed(0)}m</text>
                                <text x="260" y="222" fill="#64748b" fontSize="8" textAnchor="middle">{(maxDepthAxis * 0.5).toFixed(0)}m</text>
                                <text x="370" y="222" fill="#64748b" fontSize="8" textAnchor="middle">{(maxDepthAxis * 0.75).toFixed(0)}m</text>
                                <text x="480" y="222" fill="#64748b" fontSize="8" textAnchor="middle">{maxDepthAxis.toFixed(0)}m</text>

                                <text x="34" y="213" fill="#64748b" fontSize="8" textAnchor="end">0</text>
                                <text x="34" y="173" fill="#64748b" fontSize="8" textAnchor="end">{(maxUcsAxis * 0.25).toFixed(0)}</text>
                                <text x="34" y="123" fill="#64748b" fontSize="8" textAnchor="end">{(maxUcsAxis * 0.5).toFixed(0)}</text>
                                <text x="34" y="73" fill="#64748b" fontSize="8" textAnchor="end">{(maxUcsAxis * 0.75).toFixed(0)}</text>
                                <text x="34" y="23" fill="#64748b" fontSize="8" textAnchor="end">{maxUcsAxis.toFixed(0)}</text>

                                {/* Etiquetas de ejes */}
                                <text x="260" y="236" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle">Profundidad (m)</text>
                                <text x="14" y="115" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="middle" transform="rotate(-90 14 115)">UCS (MPa)</text>

                                {/* Pintar los puntos (Scatter) de las muestras válidas */}
                                {scatterSeries.map((series) =>
                                    series.data.map((pt, pIdx) => {
                                        const cx = 40 + (pt.prof / maxDepthAxis) * 440;
                                        const cy = 210 - (pt.ucs / maxUcsAxis) * 190;
                                        return (
                                            <g key={`${series.taladro}-${pIdx}`} className="group/point">
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r="4.5"
                                                    fill={series.color}
                                                    className="transition-all duration-150 hover:r-6 hover:stroke-slate-100 hover:stroke-2 cursor-pointer"
                                                />
                                                <title>{`Muestra: ${pt.muestra}\nTaladro: ${series.taladro}\nProfundidad: ${pt.prof.toFixed(2)}m\nUCS: ${pt.ucs.toFixed(1)} MPa (${pt.isrm})`}</title>
                                            </g>
                                        );
                                    })
                                )}
                            </svg>

                            {/* Leyenda de la dispersión */}
                            <div className="flex flex-wrap gap-3.5 justify-center mt-2 text-[10px] font-bold text-slate-400">
                                {scatterSeries.map((series) => (
                                    <div key={series.taladro} className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: series.color }} />
                                        <span>{series.taladro}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Gráfico D: Distribución de Tarta ISRM (Donut Chart SVG Nativo Integrado) */}
                <div className="bg-card border border-navy-800/40 rounded-xl p-5 bg-navy-900/10 shadow-lg flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Proporción de Clases Geomecánicas</h3>
                    {pieData.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-xs text-slate-500 italic">No hay datos geomecánicos calculados.</div>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-4">
                            {/* Donut SVG */}
                            <div className="relative w-36 h-36 shrink-0">
                                <svg className="w-full h-full" viewBox="0 0 120 120">
                                    {pieData.map((entry) => {
                                        const percent = validCount > 0 ? entry.value / validCount : 0;
                                        const strokeLength = percent * DONUT_C;
                                        const strokeDashoffset = -accumulatedPercent * DONUT_C;
                                        accumulatedPercent += percent;

                                        return (
                                            <g key={entry.name} className="group/slice">
                                                <circle
                                                    cx="60"
                                                    cy="60"
                                                    r={DONUT_R}
                                                    fill="transparent"
                                                    stroke={entry.color}
                                                    strokeWidth="10"
                                                    strokeDasharray={`${strokeLength} ${DONUT_C}`}
                                                    strokeDashoffset={strokeDashoffset}
                                                    transform="rotate(-90 60 60)"
                                                    className="transition-all duration-200 hover:stroke-[12] cursor-pointer"
                                                />
                                                <title>{`Clase: ${entry.name}\nn: ${entry.value} (${(percent * 100).toFixed(1)}%)`}</title>
                                            </g>
                                        );
                                    })}
                                    {/* Central Hole Labels */}
                                    <text x="60" y="58" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="bold" className="font-sans">
                                        {validCount}
                                    </text>
                                    <text x="60" y="70" textAnchor="middle" fill="#64748b" fontSize="6" fontWeight="bold" className="font-sans uppercase tracking-wider">
                                        Válidos
                                    </text>
                                </svg>
                            </div>

                            {/* Leyenda List */}
                            <div className="flex-1 flex flex-col gap-2.5 w-full">
                                {pieData.map((entry) => {
                                    const pct = (entry.value / validCount) * 100;
                                    return (
                                        <div key={entry.name} className="space-y-1">
                                            <div className="flex justify-between items-center text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                                    <span className="font-bold text-slate-300">{entry.name}</span>
                                                </div>
                                                <span className="font-bold text-slate-400">{entry.value} ({pct.toFixed(0)}%)</span>
                                            </div>
                                            <div className="w-full h-1 rounded-full bg-navy-950/80 overflow-hidden flex border border-navy-800/40">
                                                <div
                                                    style={{ width: `${pct}%`, backgroundColor: entry.color }}
                                                    className="h-full rounded-r transition-all"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Tablas de Detalle y Extremos (Fila 3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Tabla Detalle por Litología */}
                <div className="bg-card border border-navy-800/40 rounded-xl p-5 bg-navy-900/10 shadow-lg lg:col-span-2 space-y-4">
                    <div>
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">UCS Promedio y Desviación por Litología</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Muestra el desglose de resistencia media y homogeneidad por unidad de roca matriz</p>
                    </div>
                    <div className="overflow-auto max-h-[220px] scrollbar-thin">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="border-b border-navy-800 text-slate-400 uppercase tracking-wider text-[10px]">
                                    <th className="py-2.5 px-3">Litología</th>
                                    <th className="py-2.5 px-3 text-center">n (Muestras)</th>
                                    <th className="py-2.5 px-3 text-right">Promedio Is(50) (MPa)</th>
                                    <th className="py-2.5 px-3 text-right">Promedio UCS (MPa)</th>
                                    <th className="py-2.5 px-3 text-right">Desviación Estándar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {litoStats.map((item) => (
                                    <tr key={item.litologia} className="border-b border-navy-900 hover:bg-navy-900/20 text-slate-200">
                                        <td className="py-2 px-3 font-bold text-cyan-400">{item.litologia}</td>
                                        <td className="py-2 px-3 text-center font-semibold text-slate-400">{item.count}</td>
                                        <td className="py-2 px-3 text-right font-mono">{item.promedioIs50.toFixed(4)}</td>
                                        <td className="py-2 px-3 text-right font-bold font-mono text-emerald-400">{item.promedioUCS.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right font-mono text-slate-400">± {item.desviacion.toFixed(2)}</td>
                                    </tr>
                                ))}
                                {litoStats.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-500 italic">No hay muestras válidas calculadas para realizar la estadística.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tarjeta de Referencia de Clases ISRM */}
                <div className="bg-card border border-navy-800/40 rounded-xl p-5 bg-navy-900/10 shadow-lg space-y-4">
                    <div>
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Referencia de Resistencia ISRM</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Rangos de resistencia teóricos con su conteo en este proyecto</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
                        {[
                            { cls: 'R6', rango: '> 250 MPa', desc: 'Extremad. fuerte', count: isrmCounts.R6 },
                            { cls: 'R5', rango: '100–250 MPa', desc: 'Muy fuerte', count: isrmCounts.R5 },
                            { cls: 'R4', rango: '50–100 MPa', desc: 'Fuerte', count: isrmCounts.R4 },
                            { cls: 'R3', rango: '25–50 MPa', desc: 'Med. resistente', count: isrmCounts.R3 },
                            { cls: 'R2', rango: '5–25 MPa', desc: 'Blanda', count: isrmCounts.R2 },
                            { cls: 'R1', rango: '1–5 MPa', desc: 'Muy blanda', count: isrmCounts.R1 },
                            { cls: 'R0', rango: '< 1 MPa', desc: 'Extremad. blanda', count: isrmCounts.R0 + isrmCounts.Suelo },
                        ].map(({ cls, rango, desc, count }) => (
                            <div key={cls} className="bg-navy-950/40 rounded p-2 text-xs flex items-center justify-between border border-navy-900/60 hover:bg-navy-900/20">
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center justify-center w-8 h-5 rounded font-black text-[10px] border ${ISRM_COLORS[cls]}`}>
                                        {cls}
                                    </span>
                                    <div className="text-[10px] text-slate-400">
                                        <span className="font-bold text-slate-300 block leading-tight">{desc}</span>
                                        <span className="font-mono">{rango}</span>
                                    </div>
                                </div>
                                <div className="text-right font-black text-sm text-cyan-400 px-2">{count}</div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Extremos (Top Competentes y Top Débiles) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Top 5 Mayor UCS */}
                <div className="glass-panel p-5 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <ChevronUp size={18} />
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                            Top 5 Muestras más Competentes (Mayor UCS)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse text-left">
                            <thead>
                                <tr className="border-b border-navy-800 text-slate-400 uppercase tracking-wider text-[10px]">
                                    <th className="py-2">Muestra</th>
                                    <th className="py-2 text-center">Profundidad</th>
                                    <th className="py-2 text-center">Litología</th>
                                    <th className="py-2 text-right">Carga P (kN)</th>
                                    <th className="py-2 text-right">UCS (MPa)</th>
                                    <th className="py-2 text-center">Clase</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topCompetentes.map((p) => (
                                    <tr key={p.nro_muestra} className="border-b border-navy-900 text-slate-300">
                                        <td className="py-2 font-bold text-slate-200">{p.nro_muestra}</td>
                                        <td className="py-2 text-center font-mono">{(p.from_m || 0).toFixed(2)}m - {(p.to_m || 0).toFixed(2)}m</td>
                                        <td className="py-2 text-center font-bold text-cyan-400">{p.litologia_1 || 'S/D'}</td>
                                        <td className="py-2 text-right font-mono">{safeFloat(p.p_instr_kn).toFixed(2)}</td>
                                        <td className="py-2 text-right font-black font-mono text-emerald-400">{safeFloat(p.ucs).toFixed(1)}</td>
                                        <td className="py-2 text-center">
                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-black border ${ISRM_COLORS[p.isrm_indice_r || 'R0']}`}>
                                                {p.isrm_indice_r}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {topCompetentes.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-slate-500 italic">Sin datos válidos</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top 5 Menor UCS */}
                <div className="glass-panel p-5 rounded-xl border border-navy-800/40 bg-navy-900/10 space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 text-orange-400">
                        <ChevronDown size={18} />
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                            Top 5 Muestras más Débiles (Menor UCS)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse text-left">
                            <thead>
                                <tr className="border-b border-navy-800 text-slate-400 uppercase tracking-wider text-[10px]">
                                    <th className="py-2">Muestra</th>
                                    <th className="py-2 text-center">Profundidad</th>
                                    <th className="py-2 text-center">Litología</th>
                                    <th className="py-2 text-right">Carga P (kN)</th>
                                    <th className="py-2 text-right">UCS (MPa)</th>
                                    <th className="py-2 text-center">Clase</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topDebiles.map((p) => (
                                    <tr key={p.nro_muestra} className="border-b border-navy-900 text-slate-300">
                                        <td className="py-2 font-bold text-slate-200">{p.nro_muestra}</td>
                                        <td className="py-2 text-center font-mono">{(p.from_m || 0).toFixed(2)}m - {(p.to_m || 0).toFixed(2)}m</td>
                                        <td className="py-2 text-center font-bold text-cyan-400">{p.litologia_1 || 'S/D'}</td>
                                        <td className="py-2 text-right font-mono">{safeFloat(p.p_instr_kn).toFixed(2)}</td>
                                        <td className="py-2 text-right font-black font-mono text-orange-400">{safeFloat(p.ucs).toFixed(1)}</td>
                                        <td className="py-2 text-center">
                                            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-black border ${ISRM_COLORS[p.isrm_indice_r || 'R0']}`}>
                                                {p.isrm_indice_r}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {topDebiles.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-slate-500 italic">Sin datos válidos</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

        </div>
    );
}