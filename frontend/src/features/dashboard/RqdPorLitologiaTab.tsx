import { useState, useMemo } from 'react';
import { Shield } from 'lucide-react';
import { LITHOLOGY_CATALOG } from '../../utils/catalogData';

interface DashPoint {
    taladro: string;
    corrida: string;
    prof_m: number;
    rqd_pct: number;
    spacing_mm: number;
    ff_per_m: number;
    ph_teorico: number;
    lito1?: string;
    lito3?: string;
    rmr89?: number;
    elev_m?: number;
}

interface BoxplotStats {
    code: string;
    classLabel: string;
    count: number;
    min: number;
    max: number;
    q1: number;
    median: number;
    q3: number;
    avg: number;
    iqr: number;
    whiskMin: number;
    whiskMax: number;
    outliers: number[];
    color: string;
}

function getLithologyClass(code: string): string {
    const upper = code.trim().toUpperCase();
    if (["MZB", "MBF", "MBF1", "MBF2", "MBF_P", "MZM", "MZM_F", "MZM_M", "MZH", "MZH_1", "MZH_2", "MZD", "MZQ", "AN", "GD"].includes(upper)) return "INTRUSIVOS";
    if (["LMT", "LMT_C", "LMT_M", "LMT_MG", "LMT_S", "LMT_U", "SHL", "HFL", "SHL_MA", "MARA", "MARA_BX"].includes(upper)) return "SEDIMENTARIOS";
    if (["GSK", "PSK", "MSK", "ESK", "MBC", "MBL", "QZT", "QT"].includes(upper)) return "METAMORFICAS";
    if (["TBX", "HBX", "MBX", "BX"].includes(upper)) return "BRECHAS";
    if (["EPG", "EGT", "ENDO"].includes(upper)) return "ENDOSKARN";
    return "DESCONOCIDO";
}

export default function RqdPorLitologiaTab({ visiblePoints }: { visiblePoints: DashPoint[] }) {
    const [hoveredLito, setHoveredLito] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number>(-1);

    // Procesar estadísticas de percentiles y bigotes en base a visiblePoints (data real)
    const boxplotStatsList = useMemo((): BoxplotStats[] => {
        const rawGroups: Record<string, number[]> = {};

        visiblePoints.forEach(p => {
            const litoCode = (p.lito3 || p.lito1 || 'S/D').trim().toUpperCase();
            if (!litoCode || litoCode === '-1' || litoCode === '-' || litoCode === 'S/D') return;
            if (p.rqd_pct === -1) return;

            if (!rawGroups[litoCode]) {
                rawGroups[litoCode] = [];
            }
            rawGroups[litoCode].push(p.rqd_pct);
        });

        const knownLitos = ["LMT_M", "LMT_S", "MZM_M", "OVD", "MZD"];
        knownLitos.forEach(l => {
            if (!rawGroups[l]) rawGroups[l] = [];
        });

        return Object.entries(rawGroups).map(([code, values]) => {
            const classLabel = getLithologyClass(code);
            const color = LITHOLOGY_CATALOG[code]?.bg || '#475569';

            if (values.length === 0) {
                return {
                    code,
                    classLabel,
                    count: 0,
                    min: 0, max: 0, q1: 0, median: 0, q3: 0, avg: 0, iqr: 0,
                    whiskMin: 0, whiskMax: 0, outliers: [], color
                };
            }

            const n = values.length;
            const sorted = [...values].sort((a, b) => a - b);

            const min = sorted[0];
            const max = sorted[n - 1];
            const avg = sorted.reduce((a, b) => a + b, 0) / n;

            const q1 = sorted[Math.floor(n * 0.25)];
            const median = sorted[Math.floor(n * 0.5)];
            const q3 = sorted[Math.floor(n * 0.75)];
            const iqr = q3 - q1;

            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;

            const whiskMin = sorted.find(v => v >= lowerFence) ?? min;
            const whiskMax = [...sorted].reverse().find(v => v <= upperFence) ?? max;

            const outliers = sorted.filter(v => v < whiskMin || v > whiskMax);

            return {
                code,
                classLabel,
                count: n,
                min,
                max,
                q1,
                median,
                q3,
                avg: parseFloat(avg.toFixed(1)),
                iqr: parseFloat(iqr.toFixed(1)),
                whiskMin,
                whiskMax,
                outliers,
                color
            };
        });
    }, [visiblePoints]);

    const autoInterpretation = useMemo(() => {
        const activeStats = boxplotStatsList.filter(s => s.count > 0);
        if (activeStats.length === 0) return null;

        const maxMedian = [...activeStats].sort((a, b) => b.median - a.median)[0];
        const minMedian = [...activeStats].sort((a, b) => a.median - b.median)[0];
        const maxIqr = [...activeStats].sort((a, b) => b.iqr - a.iqr)[0];
        const maxOutliers = [...activeStats].sort((a, b) => b.outliers.length - a.outliers.length)[0];
        const emptyLitos = boxplotStatsList.filter(s => s.count === 0).map(s => s.code);

        return {
            maxMedian,
            minMedian,
            maxIqr,
            maxOutliers,
            emptyLitos
        };
    }, [boxplotStatsList]);

    // Obtener los datos de la litología sobre la que está el cursor
    const activeHoveredStat = useMemo(() => {
        if (!hoveredLito) return null;
        return boxplotStatsList.find(s => s.code === hoveredLito) || null;
    }, [hoveredLito, boxplotStatsList]);

    return (
        <div className="space-y-6 animate-fade-in text-slate-300 bg-[#090f1d] p-6 rounded-xl border border-navy-800/80 shadow-2xl select-none">

            {/* Títulos */}
            <div className="space-y-1">
                <h2 className="text-md font-bold text-slate-100 tracking-wide uppercase">RQD por Litología 3</h2>
                <p className="text-xs text-slate-400 font-semibold">Permite comparar dispersión y outliers por litología.</p>
            </div>

            {/* ── GRÁFICO BOXPLOT COHERENTE Y ALINEADO ── */}
            <div className="relative w-full h-[360px] border-b border-navy-800 mt-6 flex">

                {/* Y-Axis Labels */}
                <div className="w-10 flex flex-col justify-between text-[10px] font-bold text-slate-500 border-r border-navy-850 h-[300px] pr-2 text-right relative">
                    <span>100</span>
                    <span>75</span>
                    <span>50</span>
                    <span>25</span>
                    <span>0</span>
                    <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-navy-800" />
                    <span className="absolute left-[-15px] top-[140px] -rotate-90 text-[9px] uppercase tracking-wider text-slate-500 font-black">RQD (%)</span>
                </div>

                {/* Boxplot Render Area */}
                <div className="flex-1 h-[300px] relative flex justify-around pl-4">

                    {/* Guías Horizontales Geomecánicas */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                        <div className="w-full border-b border-navy-850/60" />
                        <div className="w-full border-b border-emerald-500/25 border-dashed" style={{ top: '25%' }} />
                        <div className="w-full border-b border-amber-500/25 border-dashed" style={{ top: '50%' }} />
                        <div className="w-full border-b border-red-500/25 border-dashed" style={{ top: '75%' }} />
                        <div className="w-full border-b border-navy-850/60" style={{ top: '100%' }} />
                    </div>

                    {/* Cajas Individuales */}
                    {boxplotStatsList.map((stat, idx) => {
                        const toY = (val: number) => 100 - val;
                        const hasData = stat.count > 0;

                        return (
                            <div
                                key={stat.code}
                                className="flex flex-col items-center justify-end w-20 relative h-full group z-10"
                                onMouseEnter={() => {
                                    setHoveredLito(stat.code);
                                    setHoveredIndex(idx);
                                }}
                                onMouseLeave={() => {
                                    setHoveredLito(null);
                                    setHoveredIndex(-1);
                                }}
                            >
                                {hasData ? (
                                    <div className="w-10 h-full relative">

                                        {/* Bigote Vertical */}
                                        <div
                                            className="absolute left-[19px] w-[2px] bg-slate-500 border-dashed"
                                            style={{
                                                top: `${toY(stat.whiskMax)}%`,
                                                height: `${stat.whiskMax - stat.whiskMin}%`
                                            }}
                                        />

                                        {/* Tope Horizontal Superior */}
                                        <div className="absolute left-3 right-3 h-[2px] bg-slate-500" style={{ top: `${toY(stat.whiskMax)}%` }} />

                                        {/* Tope Horizontal Inferior */}
                                        <div className="absolute left-3 right-3 h-[2px] bg-slate-500" style={{ top: `${toY(stat.whiskMin)}%` }} />

                                        {/* Caja Intercuartil Principal (Q1 a Q3) */}
                                        <div
                                            className="absolute left-0 right-0 border-2 rounded-sm cursor-pointer transition-all hover:brightness-110"
                                            style={{
                                                top: `${toY(stat.q3)}%`,
                                                height: `${Math.max(4, stat.q3 - stat.q1)}%`,
                                                backgroundColor: `${stat.color}45`,
                                                borderColor: stat.color
                                            }}
                                        />

                                        {/* Línea de la Mediana (Blanco Puro) */}
                                        <div className="absolute left-0 right-0 h-[2px] bg-white shadow-md" style={{ top: `${toY(stat.median)}%` }} />

                                        {/* Marcación de Outliers */}
                                        {stat.outliers.map((o, oIdx) => (
                                            <div
                                                key={oIdx}
                                                className="absolute w-1.5 h-1.5 rounded-full border border-slate-950"
                                                style={{
                                                    top: `${toY(o)}%`,
                                                    left: '17px',
                                                    backgroundColor: stat.color
                                                }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="w-10 h-full flex items-center justify-center">
                                        <span className="text-[10px] text-slate-650 italic">S/D</span>
                                    </div>
                                )}

                                {/* Etiquetas de las Categorías en el Eje X */}
                                <span className="absolute bottom-[-24px] text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.code}</span>
                            </div>
                        );
                    })}

                    {/* ── TOOLTIP FLOTANTE TOTALMENTE SÓLIDO (FUERA DE LAS COLUMNAS) ── */}
                    {activeHoveredStat && hoveredIndex !== -1 && (
                        <div
                            className="absolute border-2 rounded-lg p-3 w-48 text-left text-[10px] pointer-events-none animate-fade-in space-y-1"
                            style={{
                                backgroundColor: '#0a1124',           // Fondo 100% Sólido sin transparencias
                                borderColor: '#1e293b',               // Borde estructural sólido
                                zIndex: 99999,                        // Prioridad absoluta por encima de todas las cajas
                                opacity: 1,                           // Opacidad forzada a 1
                                bottom: '30%',
                                // Posicionar el tooltip dinámicamente de forma lateral respecto a la columna que tiene el foco
                                left: `calc(${(hoveredIndex / boxplotStatsList.length) * 100}% + 25px)`,
                                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.95)'
                            }}
                        >
                            <p className="font-black text-slate-100 text-xs tracking-wider uppercase" style={{ color: activeHoveredStat.color }}>{activeHoveredStat.code}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide border-b border-navy-850 pb-1">{activeHoveredStat.classLabel} - N = {activeHoveredStat.count}</p>

                            <div className="grid grid-cols-2 gap-y-0.5 pt-1 font-mono font-medium text-slate-300">
                                <span>Máx</span><span className="text-right font-bold text-white">{activeHoveredStat.max}</span>
                                <span>Q3</span><span className="text-right font-bold text-white">{activeHoveredStat.q3}</span>
                                <span>Mediana</span><span className="text-right font-bold text-white">{activeHoveredStat.median}</span>
                                <span className="text-slate-450">Promedio</span><span className="text-right font-bold text-slate-300">{activeHoveredStat.avg}</span>
                                <span>Q1</span><span className="text-right font-bold text-white">{activeHoveredStat.q1}</span>
                                <span>Mín</span><span className="text-right font-bold text-white">{activeHoveredStat.min}</span>
                                <span className="text-slate-450">IQR</span><span className="text-right font-bold text-slate-300">{activeHoveredStat.iqr}</span>
                                <span className="text-slate-450">Outliers</span><span className="text-right font-bold text-slate-300">{activeHoveredStat.outliers.length}</span>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Etiqueta del Eje X */}
            <div className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-2">
                Litología
            </div>

            {/* Leyenda de Clases Geológicas */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-[9px] font-black uppercase tracking-wider text-slate-500 pt-2">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#60a5fa]" /> INTRUSIVOS</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#eab308]" /> SEDIMENTARIOS</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#f472b6]" /> BRECHAS</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#4ade80]" /> METAMORFICAS</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#fb7185]" /> ENDOSKARN</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#64748b]" /> DESCONOCIDO</div>
            </div>

            {/* Leyenda de Guías Geomecánicas */}
            <div className="flex flex-wrap gap-x-5 justify-center text-[9px] font-bold text-slate-500">
                <div className="flex items-center gap-2"><span className="w-5 h-[1.5px] border-b border-red-500 border-dashed" /> RQD 25% (Muy mala calidad)</div>
                <div className="flex items-center gap-2"><span className="w-5 h-[1.5px] border-b border-amber-500 border-dashed" /> RQD 50% (Regular)</div>
                <div className="flex items-center gap-2"><span className="w-5 h-[1.5px] border-b border-emerald-500 border-dashed" /> RQD 75% (Buena calidad)</div>
            </div>

            {/* Nota Explicativa */}
            <div className="p-3.5 bg-navy-950/40 border border-navy-800/40 rounded-lg text-slate-400 text-xs font-semibold leading-relaxed">
                Este gráfico permite comparar la dispersión, mediana y valores atípicos del RQD por Litología 3. Los valores -1 fueron tratados como sin información y no fueron graficados.
            </div>

            {/* Interpretación Automática */}
            {autoInterpretation && (
                <div className="border border-navy-800/80 rounded-lg p-4 bg-navy-950/20 space-y-3 font-sans">
                    <h3 className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Shield size={12} /> Interpretación automática
                    </h3>
                    <ul className="space-y-2 text-xs font-semibold text-slate-300 leading-normal pl-4 list-disc">
                        {autoInterpretation.maxMedian && (
                            <li>
                                Mayor mediana de RQD: <strong className="text-white">{autoInterpretation.maxMedian.code} ({autoInterpretation.maxMedian.median}%)</strong> — {autoInterpretation.maxMedian.classLabel}.
                            </li>
                        )}
                        {autoInterpretation.minMedian && (
                            <li>
                                Menor mediana de RQD: <strong className="text-white">{autoInterpretation.minMedian.code} ({autoInterpretation.minMedian.median}%)</strong> — {autoInterpretation.minMedian.classLabel}.
                            </li>
                        )}
                        {autoInterpretation.maxIqr && (
                            <li>
                                Mayor dispersión (IQR = <strong className="text-white">{autoInterpretation.maxIqr.iqr}%</strong>): <strong className="text-white">{autoInterpretation.maxIqr.code}</strong>.
                            </li>
                        )}
                        {autoInterpretation.maxOutliers && autoInterpretation.maxOutliers.outliers.length > 0 && (
                            <li>
                                Más outliers: <strong className="text-white">{autoInterpretation.maxOutliers.code}</strong> con <strong className="text-white">{autoInterpretation.maxOutliers.outliers.length} valores atípicos</strong>.
                            </li>
                        )}
                        {autoInterpretation.emptyLitos.length > 0 && (
                            <li>
                                Litologías no en tabla maestra: <strong className="text-slate-400">{autoInterpretation.emptyLitos.join(', ')}</strong>.
                            </li>
                        )}
                    </ul>
                </div>
            )}

        </div>
    );
}