import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet, AlertTriangle, Database, ShieldCheck, Download,
  Loader2, Info, RefreshCw, Trash2, X
} from 'lucide-react';
import BulkImportWizard from './BulkImportWizard';

// Subcomponent imports
import AuditHistory from './components/AuditHistory';
import type { AuditHistoryItem } from './components/AuditHistory';
import KpiMetrics from './components/KpiMetrics';
import ConsolidatedDeviations from './components/ConsolidatedDeviations';
import DistributionBreakdown from './components/DistributionBreakdown';
import AnomaliesViewer from './components/AnomaliesViewer';

interface BulkAuditorProps {
  apiBase: string;
}

export default function BulkAuditor({ apiBase }: BulkAuditorProps) {
  const [file, setFile] = useState<File | null>(null);

  // Lifted state initialized from localStorage for persistence
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'loaded' | 'error'>(() => {
    const saved = localStorage.getItem('geolog_bulk_auditor_status');
    return (saved as any) || 'idle';
  });

  const [message, setMessage] = useState<string>(() => {
    return localStorage.getItem('geolog_bulk_auditor_message') || '';
  });

  const [selectedAuditId, setSelectedAuditId] = useState<string>(() => {
    return localStorage.getItem('geolog_bulk_auditor_audit_id') || '';
  });

  const [uploadedFilename, setUploadedFilename] = useState<string>(() => {
    return localStorage.getItem('geolog_bulk_auditor_filename') || '';
  });

  const [excelReady, setExcelReady] = useState<boolean>(false);

  // Sheet selection modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [sheetList, setSheetList] = useState<string[]>([]);

  // History and KPIs
  const [history, setHistory] = useState<AuditHistoryItem[]>([]);
  const [kpis, setKpis] = useState<any>(null);

  // Filters & paginated anomalies
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterCelda, setFilterCelda] = useState<string>('');
  const [filterCampania, setFilterCampania] = useState<string>('');
  const [filterGeotecnico, setFilterGeotecnico] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Interactive filters
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedObservation, setSelectedObservation] = useState<string | null>(null);
  const [isConsolidatedExpanded, setIsConsolidatedExpanded] = useState<boolean>(false);

  // Background processing states
  const [processingAuditId, setProcessingAuditId] = useState<string>(() => {
    return localStorage.getItem('geolog_bulk_auditor_processing_id') || '';
  });
  const [showProgressToast, setShowProgressToast] = useState<string>('');

  const [loadingTable, setLoadingTable] = useState<boolean>(false);

  const pollingRef = useRef<any>(null);
  const excelPollingRef = useRef<any>(null);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('geolog_bulk_auditor_status', status);
  }, [status]);

  useEffect(() => {
    localStorage.setItem('geolog_bulk_auditor_message', message);
  }, [message]);

  useEffect(() => {
    localStorage.setItem('geolog_bulk_auditor_audit_id', selectedAuditId);
  }, [selectedAuditId]);

  useEffect(() => {
    localStorage.setItem('geolog_bulk_auditor_filename', uploadedFilename);
  }, [uploadedFilename]);

  useEffect(() => {
    if (processingAuditId) {
      localStorage.setItem('geolog_bulk_auditor_processing_id', processingAuditId);
    } else {
      localStorage.removeItem('geolog_bulk_auditor_processing_id');
    }
  }, [processingAuditId]);

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  // Polling for background processing status
  useEffect(() => {
    if (processingAuditId) {
      startProcessingPolling(processingAuditId);
    } else {
      stopProcessingPolling();
    }
  }, [processingAuditId]);

  useEffect(() => {
    if (selectedAuditId && (status === 'loaded' || status === 'processing')) {
      checkExcelStatus(selectedAuditId);
    } else {
      stopExcelPolling();
    }
  }, [selectedAuditId, status]);

  // Fetch metrics when active audit or filters change
  useEffect(() => {
    if (status === 'loaded' && selectedAuditId) {
      fetchKpisAndIncidencias();
    }
  }, [selectedAuditId, filterTipo, filterCelda, filterCampania, filterGeotecnico, filterSearch, selectedYears, status]);

  const startProcessingPolling = (auditId: string) => {
    stopProcessingPolling();

    // Poll immediately
    pollResumen(auditId);

    pollingRef.current = setInterval(() => {
      pollResumen(auditId);
    }, 4000);
  };

  const stopProcessingPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const pollResumen = async (auditId: string) => {
    try {
      const yearParam = selectedYears.length > 0 ? selectedYears.join(",") : "TODOS";
      const res = await fetch(`${apiBase}/api/logueo/resumen-ligero?audit_id=${auditId}&years=${yearParam}`);
      if (res.ok) {
        if (res.status === 202) {
          // Still processing
          return;
        }
        const data = await res.json();

        // Background process finished!
        setProcessingAuditId('');
        stopProcessingPolling();
        fetchHistory(); // refresh history list

        // If user is currently looking at this active load screen, transition to dashboard
        if (status === 'processing' && selectedAuditId === auditId) {
          setKpis(data);
          setStatus('loaded');
        } else {
          // Show a nice success toast that background import finished
          setShowProgressToast(`¡Auditoría completada con éxito! La planilla "${data.nombre_archivo || 'importada'}" ya está disponible.`);
        }
      }
    } catch (e) {
      console.warn("Error consultando resumen en polling:", e);
    }
  };

  const checkExcelStatus = async (auditId: string) => {
    stopExcelPolling();
    setExcelReady(false);

    const check = async () => {
      try {
        const res = await fetch(`${apiBase}/api/logueo/estado-reporte?audit_id=${auditId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.excel_ready) {
            setExcelReady(true);
            stopExcelPolling();
            return true;
          }
        }
      } catch (e) {
        console.warn("Error consultando estado del reporte Excel:", e);
      }
      return false;
    };

    const isReady = await check();
    if (isReady) return;

    excelPollingRef.current = setInterval(async () => {
      await check();
    }, 4000);
  };

  const stopExcelPolling = () => {
    if (excelPollingRef.current) {
      clearInterval(excelPollingRef.current);
      excelPollingRef.current = null;
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${apiBase}/api/logueo/auditorias`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("Error al cargar historial de auditorías:", e);
    }
  };

  const fetchKpisAndIncidencias = async () => {
    setLoadingTable(true);
    try {
      const yearParam = selectedYears.length > 0 ? selectedYears.join(",") : "TODOS";
      const kpiUrl = `${apiBase}/api/logueo/resumen-ligero?audit_id=${selectedAuditId}&years=${yearParam}`;

      const resKpi = await fetch(kpiUrl);
      if (resKpi.ok) {
        const data = await resKpi.json();
        setKpis(data);
      }
      await fetchPaginatedIncidencias(1);
    } catch (e) {
      console.error("Error cargando estadísticas cruzadas:", e);
      setLoadingTable(false);
    }
  };

  const fetchPaginatedIncidencias = async (currentPage: number) => {
    setLoadingTable(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', String(currentPage));
      queryParams.append('limit', '50');
      if (selectedAuditId) queryParams.append('audit_id', selectedAuditId);
      if (filterTipo) queryParams.append('tipo', filterTipo);
      if (filterCelda) queryParams.append('celda', filterCelda);

      if (selectedYears.length > 0) {
        queryParams.append('campania', selectedYears.join(","));
      } else if (filterCampania) {
        queryParams.append('campania', filterCampania);
      }

      if (filterGeotecnico) queryParams.append('geotecnico', filterGeotecnico);
      if (filterSearch) queryParams.append('search', filterSearch);

      const res = await fetch(`${apiBase}/api/logueo/incidencias-paginadas?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIncidencias(data.data);
        setPage(data.page);
        setTotalPages(data.total_pages);
        setTotalRecords(data.total_records);
      }
    } catch (e) {
      console.error("Error cargando grilla paginada:", e);
    } finally {
      setLoadingTable(false);
    }
  };

  // Reemplaza los estados de SheetSelectModal por estos:
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

  // Reemplaza handleFileChange y handleConfirmSheets por esta única función:
  const handleWizardConfirm = async (payload: any) => {
    setIsWizardOpen(false);
    setStatus('processing');
    setMessage('Ejecutando auditoría geotécnica cruzada en segundo plano...');

    const formData = new FormData();
    formData.append('file_lgg_est', payload.files.lgg_est);
    if (payload.files.collar) formData.append('file_collar', payload.files.collar);
    if (payload.files.survey) formData.append('file_survey', payload.files.survey);

    // Convertir el diccionario de configuración de mapeos a JSON string
    formData.append('config_json', JSON.stringify(payload.config));

    try {
      // AQUÍ ESTAMOS APUNTANDO AL BACKEND, LO ACTUALIZAREMOS EN EL SIGUIENTE PASO
      const res = await fetch(`${apiBase}/api/logueo/importar-excel-bulk-v2`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedAuditId(data.audit_id);
        setProcessingAuditId(data.audit_id);
      } else {
        const err = await res.json();
        setStatus('error');
        setMessage(err.detail || 'Fallo al iniciar el pipeline de importación.');
      }
    } catch (e) {
      setStatus('error');
      setMessage('Error de comunicación con el servidor al iniciar auditoría.');
    }
  };

  const handleCancelProcess = async () => {
    stopProcessingPolling();
    stopExcelPolling();

    const auditIdToCancel = processingAuditId || selectedAuditId;

    // Reset local frontend state immediately
    setStatus('idle');
    setFile(null);
    setSelectedAuditId('');
    setProcessingAuditId('');
    setUploadedFilename('');
    setKpis(null);
    setIncidencias([]);
    setMessage('');
    setExcelReady(false);

    // Clean up local storage
    localStorage.removeItem('geolog_bulk_auditor_status');
    localStorage.removeItem('geolog_bulk_auditor_message');
    localStorage.removeItem('geolog_bulk_auditor_audit_id');
    localStorage.removeItem('geolog_bulk_auditor_filename');
    localStorage.removeItem('geolog_bulk_auditor_processing_id');

    if (auditIdToCancel) {
      try {
        await fetch(`${apiBase}/api/logueo/cancelar-auditoria?audit_id=${auditIdToCancel}`, {
          method: 'POST'
        });
      } catch (e) {
        console.warn("Error calling cancelar-auditoria on backend:", e);
      }
    }
  };

  const clearAllFilters = () => {
    setFilterTipo('');
    setFilterCelda('');
    setFilterCampania('');
    setFilterGeotecnico('');
    setFilterSearch('');
    setSelectedYears([]);
    setSelectedObservation(null);
  };

  const handleSelectPastAudit = (auditId: string) => {
    setSelectedAuditId(auditId);
    clearAllFilters();
    setStatus('loaded');
  };

  const handleExportExcel = () => {
    if (!excelReady || !selectedAuditId) return;
    window.open(`${apiBase}/api/logueo/reporte-excel?audit_id=${selectedAuditId}`, '_blank');
  };

  const handleExportMarkdown = () => {
    if (!selectedAuditId) return;
    const yearParam = selectedYears.length > 0 ? selectedYears.join(",") : "TODOS";
    window.open(`${apiBase}/api/logueo/reporte-markdown?audit_id=${selectedAuditId}&years=${yearParam}`, '_blank');
  };

  // KPIs helpers
  const numCeldasPadre = kpis?.familia1?.num_celdas_padre || 0;
  const totalDiscontinuidades = kpis?.familia1?.total_discontinuidades || 0;
  const totalMetrosMapped = kpis?.familia1?.total_metros || 0;

  const coreObservationTypes = kpis?.consolidado_observaciones
    ? Array.from(
      new Set(
        Object.values(kpis.consolidado_observaciones).flatMap((yearData: any) =>
          Object.keys(yearData).filter(k => k !== 'severity' && k !== 'total_incidents')
        )
      )
    ).sort()
    : [];

  const uniqueYears = kpis?.consolidado_observaciones
    ? Object.keys(kpis.consolidado_observaciones).sort()
    : [];

  const periodLabel = selectedYears.length > 0
    ? `Campañas: ${selectedYears.join(', ')}`
    : 'Todos los periodos evaluados';

  return (
    <div className="space-y-6 text-left animate-fade-in text-slate-200 min-h-screen p-4 bg-navy-950/20 backdrop-blur-md">

      {/* Modales */}
      <BulkImportWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onConfirm={handleWizardConfirm}
      />

      {/* HISTORIAL DE AUDITORÍAS PASADAS */}
      {status !== 'uploading' && (
        <AuditHistory
          history={history}
          selectedAuditId={selectedAuditId}
          onSelectAudit={handleSelectPastAudit}
        />
      )}

      {/* TOASTS Y BANNER DE PROCESAMIENTO EN SEGUNDO PLANO */}
      {showProgressToast && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-450 font-semibold animate-fade-in">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>{showProgressToast}</span>
          </div>
          <button onClick={() => setShowProgressToast('')} className="text-slate-400 hover:text-slate-200">
            <X size={14} />
          </button>
        </div>
      )}

      {processingAuditId && status === 'loaded' && (
        <div className="bg-cyan-950/40 border border-cyan-500/20 rounded-xl p-3.5 flex items-center justify-between text-xs text-cyan-400 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.05)] animate-fade-in">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-cyan-450" />
            <span>Procesando nueva planilla en segundo plano...</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedAuditId(processingAuditId);
                setStatus('processing');
              }}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 px-2.5 py-1 rounded text-xs font-black transition-all"
            >
              Ver Progreso
            </button>
            <button
              onClick={handleCancelProcess}
              className="bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded text-xs font-bold hover:bg-red-500/20 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ÁREA DE CARGA INICIAL (Botón para abrir Wizard) */}
      {status !== 'loaded' && !selectedAuditId && status !== 'uploading' && status !== 'processing' && (
        <div className="rounded-2xl border border-cyan-500/15 p-10 space-y-8 max-w-xl mx-auto bg-gradient-to-b from-[#0e172a]/60 to-[#090f1d]/90 shadow-2xl mt-12 relative overflow-hidden backdrop-blur-md shadow-[0_0_50px_rgba(6,182,212,0.05)]">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl"></div>

          <div className="text-center space-y-3 relative z-10">
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl w-16 h-16 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/5 animate-pulse">
              <Database size={28} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-100">Revisión Geomecánica Avanzada</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed font-semibold">
                Cruza y revisa masivamente la consistencia entre Logueo General, Estructural, Metadatos de Collar y Trayectorias (Surveys).
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="w-full border border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10 rounded-2xl p-8 text-center transition-all cursor-pointer relative group shadow-inner flex flex-col items-center gap-3"
          >
            <div className="p-3 bg-slate-900/80 rounded-xl group-hover:bg-cyan-500/20 transition-colors shadow-sm">
              <FileSpreadsheet size={36} className="text-cyan-500 group-hover:text-cyan-300 transition-colors" />
            </div>
            <div>
              <span className="text-sm font-black text-slate-200 block group-hover:text-cyan-300 transition-colors">
                Iniciar Asistente de Revisión
              </span>
              <span className="text-xs text-slate-500 block mt-1 font-bold">
                Soporta subida multi-archivo (.xlsx)
              </span>
            </div>
          </button>

          {status === 'error' && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs text-center font-bold flex items-center justify-center gap-2 relative z-10">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{message}</span>
            </div>
          )}
        </div>
      )}

      {/* LOADER Y ESTADO DE PROCESAMIENTO (Con Cancelación) */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="rounded-2xl border border-cyan-500/15 text-center space-y-6 max-w-lg mx-auto bg-[#090f1d]/90 p-10 shadow-2xl animate-fade-in shadow-[0_0_50px_rgba(6,182,212,0.1)] mt-12">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-cyan-400 rounded-full animate-spin"></div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center justify-center gap-1.5">
              <RefreshCw size={14} className="animate-spin" />
              <span>{status === 'uploading' ? 'Cargando Base de Datos...' : 'Revisión Geotécnica en Ejecución'}</span>
            </p>
            <p className="text-xs text-slate-350 leading-relaxed font-semibold">
              {status === 'uploading'
                ? 'Estamos subiendo y pre-analizando el archivo Excel en el servidor...'
                : 'Analizando las reglas de consistencia física y cruzada entre LGG y Estructural. Esto puede tomar de 5 a 15 minutos para planillas muy grandes.'
              }
            </p>
          </div>
          {status === 'processing' && (
            <div className="p-3 bg-cyan-950/20 border border-cyan-500/10 text-cyan-400 rounded-lg text-xs font-semibold leading-relaxed text-left flex items-start gap-2">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>Nota:</strong> Este proceso corre de forma asíncrona en segundo plano. Si lo deseas, puedes navegar a otros módulos o realizar logueos normales; el análisis continuará compilándose.
              </span>
            </div>
          )}
          <div className="pt-2">
            <button
              onClick={handleCancelProcess}
              className="w-full flex items-center justify-center gap-2 bg-red-500/15 hover:bg-red-550 border border-red-500/30 hover:border-red-550 text-red-400 px-4 py-2.5 rounded-lg text-xs font-black transition-all active:scale-95 shadow-md"
            >
              <Trash2 size={14} />
              <span>Cancelar Proceso</span>
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD COMPLETO */}
      {(status === 'loaded' || selectedAuditId) && kpis && status !== 'uploading' && status !== 'processing' && (
        <div className="space-y-6 animate-fade-in">

          {/* CABECERA */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#090f1d]/60 p-4 border border-cyan-500/10 rounded-xl gap-4 shadow-md backdrop-blur-sm shadow-[0_0_30px_rgba(6,182,212,0.02)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h1 className="text-xs font-black uppercase tracking-widest">Auditoría Geotécnica de Integridad</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Planilla Activa: <span className="font-bold text-slate-100">{kpis?.nombre_archivo || 'Por Defecto'}</span>
                  </p>
                </div>
              </div>

              {/* SELECTOR CAMPANAS */}
              {kpis.distribucion_campania && kpis.distribucion_campania.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 border border-navy-900 rounded-xl p-1">
                  <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest px-2">Campañas:</span>
                  <button
                    onClick={() => setSelectedYears([])}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${selectedYears.length === 0 ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-navy-900/60 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Todas
                  </button>
                  {uniqueYears.map(yr => {
                    const isSelected = selectedYears.includes(yr);
                    return (
                      <button
                        key={yr}
                        onClick={() => {
                          setSelectedYears(prev =>
                            prev.includes(yr) ? prev.filter(y => y !== yr) : [...prev, yr]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${isSelected ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-navy-900/60 text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* BOTONES ACCION CABECERA */}
            <div className="flex gap-2.5 w-full sm:w-auto shrink-0 justify-end">
              <button
                onClick={handleCancelProcess}
                className="flex items-center gap-1.5 bg-[#0f172a]/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-3.5 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
              >
                <Trash2 size={14} className="text-red-400" />
                <span>Cerrar Planilla</span>
              </button>

              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1.5 bg-[#0f172a]/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-350 px-3.5 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
              >
                <Download size={14} />
                <span>Exportar MD</span>
              </button>

              <button
                disabled={!excelReady}
                onClick={handleExportExcel}
                className={`flex items-center gap-1.5 border px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 relative group ${excelReady
                  ? 'bg-cyan-500 hover:bg-cyan-600 border-cyan-400/30 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'bg-[#0f172a]/50 border-navy-850 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                title={!excelReady ? 'El reporte de excel se está pregenerando en segundo plano' : 'Descargar reporte completo'}
              >
                {!excelReady ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-cyan-400" />
                    <span>Excel Espera...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Exportar Excel</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* KPIs Y METRICAS */}
          <KpiMetrics
            kpis={kpis}
            numCeldasPadre={numCeldasPadre}
            totalDiscontinuidades={totalDiscontinuidades}
            totalMetrosMapped={totalMetrosMapped}
            periodLabel={periodLabel}
            filterTipo={filterTipo}
            onFilterTipo={(tipo) => setFilterTipo(prev => prev === tipo ? '' : tipo)}
          />

          {/* CONSOLIDADO INTERACTIVO ANUAL */}
          <ConsolidatedDeviations
            kpis={kpis}
            uniqueYears={uniqueYears}
            coreObservationTypes={coreObservationTypes}
            selectedObservation={selectedObservation}
            setSelectedObservation={setSelectedObservation}
            isConsolidatedExpanded={isConsolidatedExpanded}
            setIsConsolidatedExpanded={setIsConsolidatedExpanded}
          />

          {/* TABLAS DE DISTRIBUCION */}
          <DistributionBreakdown
            kpis={kpis}
            filterCampania={filterCampania}
            onFilterCampania={(camp) => setFilterCampania(prev => prev === camp ? '' : camp)}
            filterCelda={filterCelda}
            onFilterCelda={(celda) => setFilterCelda(prev => prev === celda ? '' : celda)}
            filterGeotecnico={filterGeotecnico}
            onFilterGeotecnico={(geo) => setFilterGeotecnico(prev => prev === geo ? '' : geo)}
          />

          {/* LISTADO DE INCIDENCIAS DETALLADAS PAGINADAS */}
          <AnomaliesViewer
            incidencias={incidencias}
            totalRecords={totalRecords}
            filterSearch={filterSearch}
            onFilterSearch={(search) => setFilterSearch(search)}
            page={page}
            totalPages={totalPages}
            onPageChange={(newPage) => {
              setPage(newPage);
              fetchPaginatedIncidencias(newPage);
            }}
            kpis={kpis}
            isLoading={loadingTable}
          />

        </div>
      )}

    </div>
  );
}
