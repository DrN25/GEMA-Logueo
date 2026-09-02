import { Layers, ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';

interface PltKpiMetricsProps {
    kpis: any;
    filterTipo: string;
    onFilterTipo: (tipo: string) => void;
}

export default function PltKpiMetrics({
    kpis,
    filterTipo,
    onFilterTipo
}: PltKpiMetricsProps) {
    if (!kpis) return null;

    const totalRegs = kpis.total_registros_evaluados || 0;
    const conformes = kpis.registros_conformes || 0;
    const integridadPct = kpis.integridad_global_pct || 100.0;
    const totalAlertas = kpis.total_alertas || 0;
    const totalAdvertencias = kpis.total_advertencias || 0;
    const totalVacios = kpis.total_vacios || 0;
    const totalTaladros = kpis.total_taladros_evaluados || 0;

    return (
        <div className="space-y-4">
            {/* Fila Principal de Tarjetas KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* 1. Taladros Evaluados */}
                <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-4 relative overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taladros DDH</span>
                        <Layers size={16} className="text-cyan-400" />
                    </div>
                    <div className="text-2xl font-black text-slate-100 mt-2">
                        {totalTaladros.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                        Sondajes evaluados
                    </div>
                </div>

                {/* 2. Muestras Totales */}
                <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-4 relative overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ensayos PLT</span>
                        <Layers size={16} className="text-blue-400" />
                    </div>
                    <div className="text-2xl font-black text-slate-100 mt-2">
                        {totalRegs.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-0.5 font-bold">
                        {conformes.toLocaleString()} conformes ({totalRegs > 0 ? (conformes/totalRegs*100).toFixed(1) : 100}%)
                    </div>
                </div>

                {/* 3. Integridad Global % */}
                <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-navy-900/80 to-cyan-950/30 p-4 relative overflow-hidden shadow-md">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">Salud Geomecánica</span>
                        <ShieldCheck size={16} className="text-cyan-400" />
                    </div>
                    <div className="text-2xl font-black text-cyan-300 mt-2">
                        {integridadPct.toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-cyan-400/70 mt-0.5 font-medium">
                        Índice de consistencia
                    </div>
                </div>

                {/* 4. Alertas Críticas (Filtrable) */}
                <button
                    onClick={() => onFilterTipo(filterTipo === 'ALERTA' ? '' : 'ALERTA')}
                    className={`rounded-xl border p-4 text-left transition-all relative overflow-hidden shadow-sm ${
                        filterTipo === 'ALERTA'
                            ? 'border-red-500 bg-red-950/40 ring-2 ring-red-500/30'
                            : 'border-navy-800 bg-navy-900/60 hover:border-red-500/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Alertas (Críticas)</span>
                        <AlertOctagon size={16} className="text-red-400" />
                    </div>
                    <div className="text-2xl font-black text-red-400 mt-2">
                        {totalAlertas.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-red-400/80 mt-0.5 font-semibold">
                        {filterTipo === 'ALERTA' ? '✓ Filtro Activo' : 'Clic para filtrar'}
                    </div>
                </button>

                {/* 5. Advertencias (Filtrable) */}
                <button
                    onClick={() => onFilterTipo(filterTipo === 'ADVERTENCIA' ? '' : 'ADVERTENCIA')}
                    className={`rounded-xl border p-4 text-left transition-all relative overflow-hidden shadow-sm ${
                        filterTipo === 'ADVERTENCIA'
                            ? 'border-orange-500 bg-orange-950/40 ring-2 ring-orange-500/30'
                            : 'border-navy-800 bg-navy-900/60 hover:border-orange-500/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">Advertencias</span>
                        <AlertTriangle size={16} className="text-orange-400" />
                    </div>
                    <div className="text-2xl font-black text-orange-400 mt-2">
                        {totalAdvertencias.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-orange-400/80 mt-0.5 font-semibold">
                        {filterTipo === 'ADVERTENCIA' ? '✓ Filtro Activo' : 'Clic para filtrar'}
                    </div>
                </button>

                {/* 6. Campos Vacíos (Filtrable) */}
                <button
                    onClick={() => onFilterTipo(filterTipo === 'VACIO' ? '' : 'VACIO')}
                    className={`rounded-xl border p-4 text-left transition-all relative overflow-hidden shadow-sm ${
                        filterTipo === 'VACIO'
                            ? 'border-yellow-500 bg-yellow-950/40 ring-2 ring-yellow-500/30'
                            : 'border-navy-800 bg-navy-900/60 hover:border-yellow-500/40'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider">Celdas Vacías</span>
                        <HelpCircle size={16} className="text-yellow-400" />
                    </div>
                    <div className="text-2xl font-black text-yellow-400 mt-2">
                        {totalVacios.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-yellow-400/80 mt-0.5 font-semibold">
                        {filterTipo === 'VACIO' ? '✓ Filtro Activo' : 'Clic para filtrar'}
                    </div>
                </button>
            </div>
        </div>
    );
}
