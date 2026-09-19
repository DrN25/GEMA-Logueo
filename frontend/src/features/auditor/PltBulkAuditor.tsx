import { useState, useEffect } from 'react';
import {
    FileSpreadsheet, AlertTriangle, Download,
    Loader2, PlusCircle
} from 'lucide-react';

import PltImportWizard from './components/PltImportWizard';
import PltAuditHistory, { type PltAuditHistoryItem } from './components/PltAuditHistory';
import PltKpiMetrics from './components/PltKpiMetrics';
import PltConsolidatedDeviations from './components/PltConsolidatedDeviations';
import PltDistributionBreakdown from './components/PltDistributionBreakdown';
import PltAnomaliesViewer from './components/PltAnomaliesViewer';
import AuditYearSelector, { ALL_AUDIT_YEARS } from './components/AuditYearSelector';

interface PltBulkAuditorProps {
    apiBase: string;
    selectedYears?: string[];
    onSelectedYearsChange?: (years: string[]) => void;
}

export default function PltBulkAuditor({
    apiBase,
    selectedYears: propSelectedYears,
    onSelectedYearsChange
}: PltBulkAuditorProps) {
    const [internalYears, setInternalYears] = useState<string[]>(() => {
        const saved = localStorage.getItem('gema_selected_audit_years');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch {}
        }
        return ALL_AUDIT_YEARS;
    });

    const activeYears = propSelectedYears !== undefined ? propSelectedYears : internalYears;
    const setActiveYears = (years: string[]) => {
        if (onSelectedYearsChange) {
            onSelectedYearsChange(years);
        } else {
            setInternalYears(years);
            localStorage.setItem('gema_selected_audit_years', JSON.stringify(years));
        }
    };

    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'loaded' | 'error'>(() => {
        const saved = localStorage.getItem('gema_plt_bulk_auditor_status');
        return (saved as any) || 'idle';
    });

    const [message, setMessage] = useState<string>(() => {
        return localStorage.getItem('gema_plt_bulk_auditor_message') || '';
    });

    const [selectedAuditId, setSelectedAuditId] = useState<string>(() => {
        return localStorage.getItem('gema_plt_bulk_auditor_audit_id') || '';
    });

    const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

    // Historial e indicadores KPI
    const [history, setHistory] = useState<PltAuditHistoryItem[]>([]);
    const [kpis, setKpis] = useState<any>(null);

    // Paginación y filtros
    const [incidencias, setIncidencias] = useState<any[]>([]);
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalRecords, setTotalRecords] = useState<number>(0);

    const [filterTipo, setFilterTipo] = useState<string>('');
    const [filterCampania, setFilterCampania] = useState<string>('');
    const [filterTaladro, setFilterTaladro] = useState<string>('');
    const [selectedRuleCode, setSelectedRuleCode] = useState<string | null>(null);
    const [filterSearch, setFilterSearch] = useState<string>('');

    const [loadingTable, setLoadingTable] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);

    // Sincronización con localStorage
    useEffect(() => {
        localStorage.setItem('gema_plt_bulk_auditor_status', status);
    }, [status]);

    useEffect(() => {
        localStorage.setItem('gema_plt_bulk_auditor_message', message);
    }, [message]);

    useEffect(() => {
        localStorage.setItem('gema_plt_bulk_auditor_audit_id', selectedAuditId);
    }, [selectedAuditId]);

    // Cargar historial al montar
    useEffect(() => {
        fetchHistory();
        if (selectedAuditId) {
            fetchKpisAndIncidencias();
        }
    }, []);

    // Actualizar datos al cambiar filtros o campañas seleccionadas
    useEffect(() => {
        if (status === 'loaded' || selectedAuditId) {
            fetchPaginatedIncidencias(1);
        }
    }, [filterTipo, filterCampania, filterTaladro, selectedRuleCode, filterSearch, activeYears]);

    useEffect(() => {
        if (status === 'loaded' && selectedAuditId) {
            fetchKpisAndIncidencias();
        }
    }, [activeYears]);

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${apiBase}/api/auditoria/plt/historial`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history || []);
            }
        } catch (e) {
            console.error("Error al cargar historial PLT:", e);
        }
    };

    const fetchKpisAndIncidencias = async () => {
        setLoadingTable(true);
        try {
            const isAll = activeYears.length === ALL_AUDIT_YEARS.length;
            const campParam = isAll
                ? (filterCampania || "")
                : (activeYears.length > 0 ? activeYears.join(",") : "NONE");
            const kpiUrl = `${apiBase}/api/auditoria/plt/resumen-ligero?audit_id=${selectedAuditId}&campania=${campParam}`;
            const resKpi = await fetch(kpiUrl);
            if (resKpi.ok) {
                const data = await resKpi.json();
                setKpis(data);
                setStatus('loaded');
            }
            await fetchPaginatedIncidencias(1);
        } catch (e) {
            console.error("Error cargando KPIs PLT:", e);
        } finally {
            setLoadingTable(false);
        }
    };

    const fetchPaginatedIncidencias = async (targetPage: number) => {
        setLoadingTable(true);
        try {
            const params = new URLSearchParams();
            params.append('page', String(targetPage));
            params.append('limit', '50');
            if (selectedAuditId) params.append('audit_id', selectedAuditId);
            if (filterTipo) params.append('tipo_incidencia', filterTipo);

            const isAll = activeYears.length === ALL_AUDIT_YEARS.length;
            const campParam = isAll
                ? (filterCampania || "")
                : (activeYears.length > 0 ? activeYears.join(",") : "NONE");
            if (campParam) params.append('campania', campParam);

            if (filterTaladro) params.append('taladro', filterTaladro);
            if (selectedRuleCode) params.append('rule_code', selectedRuleCode);
            if (filterSearch) params.append('search', filterSearch);

            const res = await fetch(`${apiBase}/api/auditoria/plt/incidencias-paginadas?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setIncidencias(data.items || []);
                setPage(data.page || 1);
                setTotalPages(data.total_pages || 1);
                setTotalRecords(data.total_items || 0);
            }
        } catch (e) {
            console.error("Error cargando anomalías paginadas:", e);
        } finally {
            setLoadingTable(false);
        }
    };

    const handleUpload = async (file: File, lggFile?: File | null) => {
        setStatus('uploading');
        setMessage(`Subiendo y auditando ${file.name}${lggFile ? ` (con cruce ${lggFile.name})` : ''}...`);
        const formData = new FormData();
        formData.append('file', file);
        if (lggFile) {
            formData.append('lgg_file', lggFile);
        }

        try {
            const res = await fetch(`${apiBase}/api/auditoria/plt/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Error al procesar el archivo Excel.');
            }

            const data = await res.json();
            setSelectedAuditId(data.audit_id);
            setKpis(data.metricas || data.summary);
            setStatus('loaded');
            setMessage(data.message || 'Auditoría completada exitosamente.');
            await fetchHistory();
            await fetchPaginatedIncidencias(1);
        } catch (e: any) {
            setStatus('error');
            setMessage(e.message || 'Error durante la auditoría.');
            throw e;
        }
    };

    const handleSelectAudit = (auditId: string) => {
        setSelectedAuditId(auditId);
        setFilterTipo('');
        setFilterCampania('');
        setFilterTaladro('');
        setSelectedRuleCode(null);
        setFilterSearch('');
        fetchKpisAndIncidencias();
    };

    const handleClearHistory = async () => {
        if (!confirm('¿Deseas limpiar todo el historial de auditorías PLT?')) return;
        try {
            await fetch(`${apiBase}/api/auditoria/plt/historial`, { method: 'DELETE' });
            setHistory([]);
            if (status === 'loaded') {
                setStatus('idle');
                setKpis(null);
                setIncidencias([]);
            }
        } catch (e) {
            console.error("Error al limpiar historial:", e);
        }
    };

    const handleDownloadExcel = async () => {
        setIsDownloading(true);
        try {
            const isAll = activeYears.length === ALL_AUDIT_YEARS.length;
            const campParam = isAll
                ? (filterCampania || "")
                : (activeYears.length > 0 ? activeYears.join(",") : "");
            const url = `${apiBase}/api/auditoria/plt/reporte-excel?audit_id=${selectedAuditId}${campParam ? `&campania=${campParam}` : ''}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('No se pudo descargar el reporte Excel.');

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const tag = isAll ? (selectedAuditId || 'latest') : `${selectedAuditId || 'latest'}_${activeYears.join('-')}`;
            a.download = `Reporte_Auditoria_PLT_Regulares_${tag}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (e: any) {
            alert(e.message || 'Error al descargar el reporte Excel.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-navy-950 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin">
            {/* Cabecera Principal */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-navy-900/60 border border-navy-800 p-5 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
                        <FileSpreadsheet size={24} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="text-base sm:text-lg font-black tracking-wider text-slate-100 uppercase">
                                Auditoría QA/QC — Ensayos PLT Regulares (DDH)
                            </h1>
                            {kpis?.has_lgg_crosscheck ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                                    Cruce LGG Activo
                                </span>
                            ) : kpis ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/25">
                                    Modo Autónomo (Sin LGG)
                                </span>
                            ) : null}
                        </div>
                        <p className="text-xs text-slate-400">
                            Validación de duplicados, consistencia de Factor K vs Litología y cruce con corridas LGG
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                        onClick={() => setIsWizardOpen(true)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all shadow-md shadow-cyan-500/20"
                    >
                        <PlusCircle size={15} />
                        <span>Nueva Auditoría</span>
                    </button>

                    {status === 'loaded' && (
                        <button
                            onClick={handleDownloadExcel}
                            disabled={isDownloading}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-md shadow-emerald-500/20"
                        >
                            {isDownloading ? (
                                <Loader2 size={15} className="animate-spin" />
                            ) : (
                                <Download size={15} />
                            )}
                            <span>Descargar Reporte Excel</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Historial de Auditorías */}
            {history.length > 0 && (
                <PltAuditHistory
                    history={history}
                    selectedAuditId={selectedAuditId}
                    onSelectAudit={handleSelectAudit}
                    onClearHistory={handleClearHistory}
                />
            )}

            {/* Estado Inicial / Sin Auditoría */}
            {status === 'idle' && history.length === 0 && (
                <div className="rounded-2xl border border-dashed border-navy-800 bg-navy-900/30 p-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-4 bg-navy-900 text-cyan-400 rounded-2xl border border-navy-800">
                        <FileSpreadsheet size={40} />
                    </div>
                    <div className="max-w-md space-y-1">
                        <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider">
                            No hay auditorías PLT activas
                        </h3>
                        <p className="text-xs text-slate-400">
                            Carga una planilla Excel de Ensayos PLT Regulares (DDH) para ejecutar el motor de validación geomecánica de 34 columnas.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsWizardOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
                    >
                        <PlusCircle size={15} />
                        <span>Cargar Archivo Excel</span>
                    </button>
                </div>
            )}

            {/* Estado de Error */}
            {status === 'error' && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="shrink-0" />
                        <span>{message || 'Ocurrió un error al procesar la auditoría.'}</span>
                    </div>
                    <button
                        onClick={() => setIsWizardOpen(true)}
                        className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* Panel Principal cuando hay datos cargados */}
            {kpis && (
                <>
                    {/* Selector de Años / Campañas a Auditar */}
                    <AuditYearSelector
                        selectedYears={activeYears}
                        onYearsChange={setActiveYears}
                        title="Campañas de Perforación Evaluadas:"
                    />

                    {/* Tarjetas KPI */}
                    <PltKpiMetrics
                        kpis={kpis}
                        filterTipo={filterTipo}
                        onFilterTipo={setFilterTipo}
                    />

                    {/* Desglose por Campaña y Top 5 Taladros */}
                    <PltDistributionBreakdown
                        kpis={kpis}
                        filterCampania={filterCampania}
                        onFilterCampania={setFilterCampania}
                        filterTaladro={filterTaladro}
                        onFilterTaladro={setFilterTaladro}
                    />

                    {/* Consolidado de Desviaciones */}
                    <PltConsolidatedDeviations
                        kpis={kpis}
                        selectedRuleCode={selectedRuleCode}
                        onSelectRuleCode={setSelectedRuleCode}
                    />

                    {/* Visor de Anomalías Fila a Fila */}
                    <PltAnomaliesViewer
                        incidencias={incidencias}
                        totalRecords={totalRecords}
                        page={page}
                        totalPages={totalPages}
                        onPageChange={(newPage) => {
                            setPage(newPage);
                            fetchPaginatedIncidencias(newPage);
                        }}
                        filterSearch={filterSearch}
                        onFilterSearch={setFilterSearch}
                        isLoading={loadingTable}
                    />
                </>
            )}

            {/* Modal Wizard de Importación */}
            <PltImportWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onUpload={handleUpload}
                isUploading={status === 'uploading'}
            />
        </div>
    );
}
