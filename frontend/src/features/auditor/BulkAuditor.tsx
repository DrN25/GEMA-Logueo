import React, { useState, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, AlertTriangle, ChevronLeft, ChevronRight,
  BarChart3, Database, RefreshCw, Activity, ShieldCheck, X, Download,
  Filter, Search, FileText, Calendar, User, Folder, Settings, ArrowLeft,
  Map, Layers
} from 'lucide-react';
import SheetSelectModal from './SheetSelectModal';

interface BulkAuditorProps {
  apiBase: string;
}

interface AuditHistoryItem {
  audit_id: string;
  fecha: string;
  archivo: string;
  total_filas: number;
  total_vacios: number;
  total_advertencias: number;
  total_alertas: number;
}

export default function BulkAuditor({ apiBase }: BulkAuditorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'loaded' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  // Sheet selection modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [sheetList, setSheetList] = useState<string[]>([]);
  const [uploadedFilename, setUploadedFilename] = useState<string>('');

  // History of audits
  const [history, setHistory] = useState<AuditHistoryItem[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>('');
  const [kpis, setKpis] = useState<any>(null);

  // Filters & paginated anomalies
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterCelda, setFilterCelda] = useState<string>('');
  const [filterColumna, setFilterColumna] = useState<string>('');
  const [filterCampania, setFilterCampania] = useState<string>('');
  const [filterGeotecnico, setFilterGeotecnico] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Interactive filters
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedObservation, setSelectedObservation] = useState<string | null>(null);
  const [isConsolidatedExpanded, setIsConsolidatedExpanded] = useState<boolean>(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  // Fetch data on filter changes
  useEffect(() => {
    if (status === 'loaded' && selectedAuditId) {
      fetchKpisAndIncidencias();
    }
  }, [selectedAuditId, filterTipo, filterCelda, filterColumna, filterCampania, filterGeotecnico, filterSearch, selectedYears, status]);

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
    try {
      const yearParam = selectedYears.length > 0 ? selectedYears.join(",") : "TODOS";
      const kpiUrl = selectedAuditId
        ? `${apiBase}/api/logueo/resumen-ligero?audit_id=${selectedAuditId}&years=${yearParam}`
        : `${apiBase}/api/logueo/resumen-ligero?years=${yearParam}`;

      const resKpi = await fetch(kpiUrl);
      if (resKpi.ok) {
        const data = await resKpi.json();
        setKpis(data);
        if (!selectedAuditId && data.audit_id) {
          setSelectedAuditId(data.audit_id);
        }
      }
      fetchPaginatedIncidencias(1);
    } catch (e) {
      console.error("Error cargando estadísticas cruzadas:", e);
    }
  };

  const fetchPaginatedIncidencias = async (currentPage: number) => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', String(currentPage));
      queryParams.append('limit', '50');
      if (selectedAuditId) queryParams.append('audit_id', selectedAuditId);
      if (filterTipo) queryParams.append('tipo', filterTipo);
      if (filterCelda) queryParams.append('celda', filterCelda);
      if (filterColumna) queryParams.append('columna', filterColumna);

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
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setStatus('uploading');
      setMessage('Analizando hojas disponibles en el libro de Excel...');

      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        const res = await fetch(`${apiBase}/api/logueo/sheets`, {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          setSheetList(data.sheets);
          setUploadedFilename(data.filename);
          setIsModalOpen(true);
          setStatus('idle');
          setMessage('');
        } else {
          const errData = await res.json();
          setStatus('error');
          setMessage(errData.detail || 'Ocurrió un error al subir el Excel.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Error de red al conectar con el servidor.');
      }
    }
  };

  const handleConfirmSheets = async (lggSheet: string, estSheet: string) => {
    setIsModalOpen(false);
    setStatus('processing');
    setMessage('Ejecutando validaciones geomecánicas cruzadas en segundo plano...');

    try {
      const res = await fetch(`${apiBase}/api/logueo/importar-excel-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadedFilename,
          lgg_sheet: lggSheet,
          est_sheet: estSheet
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedAuditId(data.audit_id);
        pollCompactData(data.audit_id);
      } else {
        setStatus('error');
        setMessage('Error al iniciar la validación en el backend.');
      }
    } catch (e) {
      setStatus('error');
      setMessage('Error de red al conectar.');
    }
  };

  const pollCompactData = (auditId: string) => {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${apiBase}/api/logueo/resumen-ligero?audit_id=${auditId}`);
        if (res.status === 200) {
          const data = await res.json();
          setKpis(data);
          setStatus('loaded');
          fetchHistory();
          clearInterval(timer);
        } else if (res.status === 202) {
          const data = await res.json();
          setMessage(data.message || 'Procesando reglas de consistencia...');
        } else if (res.status === 404 && attempts > 15) {
          setStatus('error');
          setMessage('No se encontró el reporte procesado en el servidor.');
          clearInterval(timer);
        }
      } catch (e) {
        console.warn("Esperando respuesta del servidor de fondo...");
      }
    }, 3000);
  };

  const handleSelectPastAudit = (auditId: string) => {
    setSelectedAuditId(auditId);
    clearAllFilters();
    setSelectedYears([]);
    setSelectedObservation(null);
    setStatus('loaded');
  };

  const handleFilterTipo = (tipo: string) => setFilterTipo(prev => prev === tipo ? '' : tipo);
  const handleFilterCelda = (celda: string) => setFilterCelda(prev => prev === celda ? '' : celda);
  const handleFilterColumna = (columna: string) => setFilterColumna(prev => prev === columna ? '' : columna);
  const handleFilterCampania = (camp: string) => setFilterCampania(prev => prev === camp ? '' : camp);
  const handleFilterGeotecnico = (geo: string) => setFilterGeotecnico(prev => prev === geo ? '' : geo);

  const toggleYearSelection = (year: string) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      } else {
        return [...prev, year];
      }
    });
  };

  const clearAllFilters = () => {
    setFilterTipo('');
    setFilterCelda('');
    setFilterColumna('');
    setFilterCampania('');
    setFilterGeotecnico('');
    setFilterSearch('');
    setSelectedYears([]);
    setSelectedObservation(null);
  };

  const handleDownloadExcel = () => {
    const queryParams = new URLSearchParams();
    if (selectedAuditId) queryParams.append('audit_id', selectedAuditId);
    queryParams.append('_t', String(Date.now()));
    window.open(`${apiBase}/api/logueo/reporte-excel?${queryParams.toString()}`);
  };

  const handleDownloadMD = () => {
    const queryParams = new URLSearchParams();
    if (selectedAuditId) queryParams.append('audit_id', selectedAuditId);
    if (selectedYears.length > 0) queryParams.append('years', selectedYears.join(","));
    window.open(`${apiBase}/api/logueo/reporte-markdown?${queryParams.toString()}`);
  };

  // KPI Calculations
  let numCeldasPadre = kpis?.familia1?.num_celdas_padre || 0;
  let totalDiscontinuidades = kpis?.familia1?.total_discontinuidades || 0;
  let totalMetrosMapped = kpis?.familia1?.total_metros || 0;
  let periodLabel = "Campaña Completa";

  if (kpis) {
    if (selectedYears.length > 0 && kpis.resumen_por_celda_padre) {
      const matchingCeldas = Object.entries(kpis.resumen_por_celda_padre).filter(
        ([_, cellData]: [any, any]) => selectedYears.includes(String(cellData.campania))
      );
      numCeldasPadre = matchingCeldas.length;
      totalDiscontinuidades = matchingCeldas.reduce((acc, [_, cellData]: [any, any]) => acc + (cellData.total_hijas || 0), 0);
      totalMetrosMapped = matchingCeldas.reduce((acc, [_, cellData]: [any, any]) => acc + (cellData.dist_celda || 0), 0);
      periodLabel = `Campaña: ${selectedYears.sort().join(", ")}`;
    } else if (kpis.distribucion_campania && kpis.distribucion_campania.length > 0) {
      const years = kpis.distribucion_campania.map((c: any) => parseInt(c.campania)).filter((y: any) => !isNaN(y));
      if (years.length > 0) {
        periodLabel = `Periodo: ${Math.min(...years)} - ${Math.max(...years)}`;
      }
    }
  }

  const colorVacios = "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
  const colorAdvertencias = "text-orange-500 bg-orange-500/10 border-orange-500/20";
  const colorAlertas = "text-red-500 bg-red-500/10 border-red-500/20";

  const getAlertRankStyle = (index: number) => {
    const rank = index + 1;
    if (rank >= 1 && rank <= 3) {
      return "text-red-500 font-extrabold text-xs bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 rounded shadow-[0_0_12px_rgba(239,68,68,0.25)]";
    }
    if (rank >= 4 && rank <= 10) {
      return "text-orange-500 font-extrabold text-xs bg-orange-500/10 border border-orange-500/30 px-2.5 py-0.5 rounded shadow-[0_0_8px_rgba(249,115,22,0.15)]";
    }
    return "text-yellow-400 font-bold text-xs bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded";
  };

  const getWarningRankStyle = (index: number) => {
    const rank = index + 1;
    if (rank >= 1 && rank <= 3) {
      return "text-orange-500 font-extrabold text-xs bg-orange-500/10 border border-orange-500/30 px-2.5 py-0.5 rounded shadow-[0_0_12px_rgba(249,115,22,0.25)]";
    }
    if (rank >= 4 && rank <= 10) {
      return "text-yellow-400 font-extrabold text-xs bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-0.5 rounded shadow-[0_0_8px_rgba(234,179,8,0.15)]";
    }
    return "text-amber-200 font-semibold text-xs bg-amber-500/10 border border-amber-200/20 px-1.5 py-0.5 rounded";
  };

  const pctFieldsCorrectos = kpis?.familia2 ? ((kpis.familia2.total_correctos / kpis.familia2.total_fields) * 100).toFixed(2) : '0';
  const pctFieldsVacios = kpis?.familia2 ? ((kpis.familia2.total_vacios / kpis.familia2.total_fields) * 100).toFixed(2) : '0';
  const pctFieldsAdvs = kpis?.familia2 ? ((kpis.familia2.total_advertencias / kpis.familia2.total_fields) * 100).toFixed(2) : '0';
  const pctFieldsAlertas = kpis?.familia2 ? ((kpis.familia2.total_alertas / kpis.familia2.total_fields) * 100).toFixed(2) : '0';

  const pctDiscsCorrectas = kpis?.familia3 ? ((kpis.familia3.discontinuidades_correctas / kpis.familia3.total_discontinuidades) * 100).toFixed(2) : '0';
  const pctDiscsVacias = kpis?.familia3 ? ((kpis.familia3.discontinuidades_vacios / kpis.familia3.total_discontinuidades) * 100).toFixed(2) : '0';
  const pctDiscsAdvs = kpis?.familia3 ? ((kpis.familia3.discontinuidades_advertencias / kpis.familia3.total_discontinuidades) * 100).toFixed(2) : '0';
  const pctDiscsAlertas = kpis?.familia3 ? ((kpis.familia3.discontinuidades_alertas / kpis.familia3.total_discontinuidades) * 100).toFixed(2) : '0';

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

  return (
    <div className="space-y-6 text-left animate-fade-in text-slate-200 min-h-screen p-4 bg-navy-950/20 backdrop-blur-md">
      
      {/* Modales */}
      <SheetSelectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setStatus('idle');
        }}
        sheets={sheetList}
        onConfirm={handleConfirmSheets}
      />

      {/* HISTORIAL DE AUDITORÍAS PASADAS */}
      <div className="rounded-xl border border-navy-800 bg-[#090f1d]/50 p-4 shadow-xl select-none">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Folder size={14} className="text-indigo-400" />
          <span>Historial de Importaciones Logueadas Auditadas</span>
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {history.length === 0 ? (
            <span className="text-xs text-slate-500 italic px-2">No hay auditorías registradas previamente.</span>
          ) : (
            history.map((audit) => {
              const isActive = selectedAuditId === audit.audit_id;
              return (
                <button
                  key={audit.audit_id}
                  onClick={() => handleSelectPastAudit(audit.audit_id)}
                  className={`flex-shrink-0 p-3 rounded-lg border text-left transition-all ${
                    isActive
                      ? 'bg-indigo-500/10 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/30'
                      : 'bg-[#0f172a]/40 border-navy-800 hover:border-slate-700 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-black text-slate-100 truncate max-w-[180px]" title={audit.archivo}>
                      {audit.archivo}
                    </span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-bold">
                      {audit.total_filas} registros
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 flex gap-2 font-semibold">
                    <span>{audit.fecha}</span>
                    <span className="text-red-400 font-bold">{audit.total_alertas} Alertas</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ÁREA DE CARGA INICIAL (Arrastrar Archivo) */}
      {status !== 'loaded' && !selectedAuditId && (
        <div className="rounded-xl border border-navy-850 p-8 space-y-6 max-w-xl mx-auto bg-[#090f1d]/50 shadow-2xl mt-8">
          <div className="text-center space-y-2">
            <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto shadow-md">
              <Database size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Auditar Planilla de Logueo</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                Sube un nuevo archivo de Excel para analizar la consistencia de corridas LGG y juntas estructurales.
              </p>
            </div>
          </div>

          <div className="border border-dashed border-slate-700 hover:border-indigo-500/45 rounded-xl p-6 text-center bg-slate-900/20 transition-all cursor-pointer relative group">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <FileSpreadsheet size={32} className="mx-auto text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" />
            <span className="text-xs font-semibold text-slate-300 block">
              {file ? file.name : 'Arrastra tu archivo .xlsx o haz clic para buscar'}
            </span>
          </div>

          {status === 'error' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs text-center font-bold">
              {message}
            </div>
          )}
        </div>
      )}

      {/* COMPRESOR LOADER */}
      {(status === 'uploading' || status === 'processing') && (
        <div className="rounded-xl border border-navy-800 text-center space-y-4 max-w-lg mx-auto bg-[#090f1d]/50 p-10 shadow-2xl animate-pulse">
          <Activity size={32} className="text-indigo-400 animate-spin mx-auto" />
          <p className="text-xs font-black uppercase tracking-wider">
            {status === 'uploading' ? 'Cargando Base de Datos...' : 'Auditoría en Ejecución'}
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
        </div>
      )}

      {/* DASHBOARD COMPLETO */}
      {(status === 'loaded' || selectedAuditId) && kpis && (
        <div className="space-y-6">

          {/* CABECERA */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#090f1d]/60 p-4 border border-navy-800 rounded-xl gap-4 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
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
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-2">Campañas:</span>
                  <button
                    onClick={() => setSelectedYears([])}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                      selectedYears.length === 0 ? 'bg-indigo-500 text-slate-950' : 'bg-navy-900/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todas
                  </button>
                  {kpis.distribucion_campania.map((c: any) => {
                    const isSelected = selectedYears.includes(String(c.campania));
                    return (
                      <button
                        key={c.campania}
                        onClick={() => toggleYearSelection(String(c.campania))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                          isSelected ? 'bg-indigo-500 text-slate-950' : 'bg-navy-900/40 text-slate-455 hover:text-slate-200'
                        }`}
                      >
                        {c.campania}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleDownloadExcel}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 border border-emerald-500/30 text-white px-4 py-2 rounded-lg text-xs font-black shadow-lg transition-all active:scale-95"
              >
                <Download size={14} />
                <span>Exportar Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => {
                  setSelectedAuditId('');
                  setStatus('idle');
                  setFile(null);
                }}
                className="bg-navy-900 hover:bg-navy-850 border border-navy-800 text-slate-300 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors"
              >
                Subir Otro Excel
              </button>
            </div>
          </div>

          {/* FILTROS ACTIVOS */}
          {(filterTipo || filterCelda || filterColumna || filterCampania || filterGeotecnico || filterSearch) && (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/25 rounded-xl gap-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <Filter size={18} className="text-indigo-400 shrink-0" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-slate-300 uppercase tracking-wider mr-1">Consultas Activas:</span>
                  {filterTipo && <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">Tipo: {filterTipo}</span>}
                  {filterCelda && <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">Taladro: {filterCelda}</span>}
                  {filterColumna && <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">Campo: {filterColumna}</span>}
                  {filterCampania && <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">Campaña: {filterCampania}</span>}
                  {filterGeotecnico && <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">Geólogo: {filterGeotecnico}</span>}
                  <button onClick={clearAllFilters} className="text-xs text-slate-400 hover:text-white underline font-extrabold ml-2">
                    Limpiar Todo
                  </button>
                </div>
              </div>
              <button
                onClick={handleDownloadMD}
                className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/35 hover:bg-indigo-500/25 text-indigo-300 px-3.5 py-2 rounded-lg text-xs font-black shadow-sm transition-all active:scale-95"
              >
                <Download size={14} />
                <span>Reporte Geotécnico (.md)</span>
              </button>
            </div>
          )}

          {/* MONITOR KPIS METRICAS GENERALES */}
          {kpis.familia1 && (
            <div className="rounded-xl border border-navy-800 bg-[#090f1d]/50 p-5 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-md">
              <div className="flex items-center justify-between p-2">
                <div className="space-y-1">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Taladros Mapeados</span>
                  <span className="text-3xl font-black text-indigo-400 font-mono block mt-1">
                    {numCeldasPadre.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block">{periodLabel}</span>
                </div>
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                  <Map size={24} />
                </div>
              </div>

              <div className="flex items-center justify-between p-2 border-l border-navy-850 pl-6">
                <div className="space-y-1">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Total de Filas Procesadas</span>
                  <span className="text-3xl font-black text-indigo-400 font-mono block mt-1">
                    {totalDiscontinuidades.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block">{periodLabel}</span>
                </div>
                <div className="p-3 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl">
                  <Layers size={24} />
                </div>
              </div>

              <div className="flex items-center justify-between p-2 border-l border-navy-850 pl-6">
                <div className="space-y-1">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Metros de Logueo Auditados</span>
                  <span className="text-3xl font-black text-indigo-400 font-mono block mt-1">
                    {totalMetrosMapped.toLocaleString()} <span className="text-xs text-slate-500 font-semibold">metros</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block">{periodLabel}</span>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  <Activity size={24} />
                </div>
              </div>
            </div>
          )}

          {/* MONITOR INTERACTIVO DE OBSERVACIONES POR AÑO */}
          {kpis.consolidado_observaciones && (
            <div className="rounded-xl border border-navy-800 bg-[#090f1d]/50 p-6 space-y-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-400 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-100">
                      Consolidado de Desviaciones Geotécnicas
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Vista unificada del control de calidad por campaña de perforación.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsConsolidatedExpanded(!isConsolidatedExpanded);
                    if (isConsolidatedExpanded) setSelectedObservation(null);
                  }}
                  className="bg-indigo-500 hover:bg-indigo-650 border border-indigo-400/30 text-slate-950 px-4 py-2 rounded-lg text-xs font-black transition-all shadow-md active:scale-95"
                >
                  {isConsolidatedExpanded ? "🙈 Ocultar Panel" : "👁️ Mostrar Panel de Consolidado"}
                </button>
              </div>

              {isConsolidatedExpanded && (
                <div className="border-t border-navy-850 pt-4 space-y-6">
                  {!selectedObservation ? (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-400">
                        Haz clic sobre una tipología para desplegar tendencias e identificar taladros anomalos.
                      </p>

                      <div className="overflow-x-auto rounded-lg border border-navy-800">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-800">
                              <th className="py-3 px-4 text-xs">Tipo de Desviación Geotécnica</th>
                              {uniqueYears.map(yr => {
                                const sev = kpis.consolidado_observaciones[yr].severity;
                                const badgeColor = sev === 'CRÍTICO'
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : sev === 'MODERADO'
                                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                                return (
                                  <th key={yr} className="py-3 px-4 text-center min-w-32 text-xs">
                                    <div className="font-black text-slate-200">{yr}</div>
                                    <div className={`mt-1 text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-lg uppercase ${badgeColor}`}>
                                      {sev}
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-navy-850 text-slate-300 font-semibold text-xs bg-slate-900/20">
                            {coreObservationTypes.map((obsType, oIdx) => (
                              <tr
                                key={oIdx}
                                onClick={() => setSelectedObservation(obsType)}
                                className="hover:bg-indigo-500/5 cursor-pointer transition-colors"
                              >
                                <td className="py-3 px-4 text-slate-100 font-black text-xs">{obsType}</td>
                                {uniqueYears.map(yr => {
                                  const val = kpis.consolidado_observaciones[yr]?.[obsType]?.incidents || 0;
                                  return (
                                    <td key={yr} className="py-3 px-4 text-center font-mono">
                                      <span className={`px-2 py-0.5 rounded text-xs font-black border ${
                                        val > 50
                                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                          : val > 10
                                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                            : val > 0
                                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                              : 'bg-slate-900/30 text-slate-650 border-transparent'
                                      }`}>
                                        {val.toLocaleString()}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-navy-800 pb-4 gap-4">
                        <div>
                          <button
                            onClick={() => setSelectedObservation(null)}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-wider mb-2"
                          >
                            <ArrowLeft size={14} />
                            <span>Volver al Consolidado General</span>
                          </button>
                          <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">
                            Falla: {selectedObservation}
                          </h3>
                        </div>
                      </div>

                      {/* CHART SIMULADO CON DIVS CSS */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900/30 border border-navy-850 p-4 rounded-xl space-y-3">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Ocurrencias Registradas por Año
                          </h4>
                          <div className="flex justify-between items-end h-40 border-b border-navy-850 pb-2">
                            {uniqueYears.map(yr => {
                              const val = kpis.consolidado_observaciones[yr]?.[selectedObservation]?.incidents || 0;
                              const maxVal = Math.max(...uniqueYears.map(y => kpis.consolidado_observaciones[y]?.[selectedObservation]?.incidents || 0), 1);
                              const heightPct = val > 0 ? 8 + (val / maxVal) * 92 : 0;
                              return (
                                <div key={yr} className="flex flex-col items-center flex-1 group">
                                  <span className="text-[10px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 mb-1">{val}</span>
                                  <div
                                    style={{ height: `${heightPct}%` }}
                                    className={`w-8 rounded-t border-t-2 transition-all ${
                                      val > 25 ? 'bg-red-500/20 hover:bg-red-500 border-red-500' : 'bg-orange-500/20 hover:bg-orange-500 border-orange-500'
                                    }`}
                                  />
                                  <span className="text-[10px] font-bold text-slate-500 mt-2">{yr}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="bg-slate-900/30 border border-navy-850 p-4 rounded-xl space-y-3">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Taladros Afectados por Año
                          </h4>
                          <div className="flex justify-between items-end h-40 border-b border-navy-850 pb-2">
                            {uniqueYears.map(yr => {
                              const val = kpis.consolidado_observaciones[yr]?.[selectedObservation]?.affected_stations || 0;
                              const maxVal = Math.max(...uniqueYears.map(y => kpis.consolidado_observaciones[y]?.[selectedObservation]?.affected_stations || 0), 1);
                              const heightPct = val > 0 ? 8 + (val / maxVal) * 92 : 0;
                              return (
                                <div key={yr} className="flex flex-col items-center flex-1 group">
                                  <span className="text-[10px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 mb-1">{val}</span>
                                  <div
                                    style={{ height: `${heightPct}%` }}
                                    className={`w-8 rounded-t border-t-2 transition-all ${
                                      val > 5 ? 'bg-red-500/20 hover:bg-red-500 border-red-500' : 'bg-yellow-500/20 hover:bg-yellow-500 border-yellow-500'
                                    }`}
                                  />
                                  <span className="text-[10px] font-bold text-slate-500 mt-2">{yr}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* TOP 3 TALADROS MAS CRITICOS POR AÑO */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          TOP 3 TALADROS MÁS AFECTADOS POR AÑO
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-navy-800 bg-[#090f1d]/20">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-navy-800">
                                <th className="py-2.5 px-3 text-center w-24 text-xs">Año</th>
                                <th className="py-2.5 px-3 text-xs">1° Más Crítico</th>
                                <th className="py-2.5 px-3 text-xs">2° Más Crítico</th>
                                <th className="py-2.5 px-3 text-xs">3° Más Crítico</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-navy-850 text-slate-300">
                              {uniqueYears.map(yr => {
                                const topList = kpis.consolidado_observaciones[yr]?.[selectedObservation]?.top_stations || [];
                                return (
                                  <tr key={yr} className="hover:bg-slate-900/10">
                                    <td className="py-3 px-3 text-center font-black text-xs bg-slate-950/40">{yr}</td>
                                    <td className="py-3 px-3">
                                      {topList[0] ? (
                                        <span className="font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded text-xs">
                                          {topList[0].celda} <span className="font-mono font-black">({topList[0].count})</span>
                                        </span>
                                      ) : <span className="text-slate-650">—</span>}
                                    </td>
                                    <td className="py-3 px-3">
                                      {topList[1] ? (
                                        <span className="font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded text-xs">
                                          {topList[1].celda} <span className="font-mono font-black">({topList[1].count})</span>
                                        </span>
                                      ) : <span className="text-slate-655">—</span>}
                                    </td>
                                    <td className="py-3 px-3">
                                      {topList[2] ? (
                                        <span className="font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded text-xs">
                                          {topList[2].celda} <span className="font-mono font-black">({topList[2].count})</span>
                                        </span>
                                      ) : <span className="text-slate-650">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* INTEGRIDAD POR CAMPOS VS DISCONTINUIDADES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* AUDITORÍA DE CAMPOS */}
            {kpis.familia2 && (
              <div className="rounded-xl border border-navy-800 bg-[#090f1d]/50 p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex justify-between">
                  <span>Auditoría de Datos por Celdas Individuales</span>
                  <span className="text-[10px] bg-slate-900 text-slate-500 px-2 py-0.5 rounded font-mono">
                    Total: {kpis.familia2.total_fields.toLocaleString()} celdas
                  </span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-[#10b981]/5 border border-[#10b981]/20 p-4 rounded-xl text-center shadow-inner">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Celdas OK</span>
                    <span className="text-2xl font-black text-[#10b981] block mt-2 font-mono">{kpis.familia2.total_correctos.toLocaleString()}</span>
                    <span className="text-[9px] font-extrabold text-[#10b981] block mt-2 bg-[#10b981]/15 border border-[#10b981]/30 py-0.5 rounded">
                      {pctFieldsCorrectos}%
                    </span>
                  </div>

                  <button
                    onClick={() => handleFilterTipo('VACIO')}
                    className={`border p-4 rounded-xl text-center transition-all ${
                      filterTipo === 'VACIO' ? 'bg-yellow-500/15 border-yellow-500' : 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10'
                    }`}
                  >
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Campos Vacíos</span>
                    <span className="text-2xl font-black text-yellow-500 block mt-2 font-mono">{kpis.familia2.total_vacios.toLocaleString()}</span>
                    <span className="text-[9px] font-extrabold text-yellow-500 block mt-2 bg-yellow-500/15 border border-yellow-500/30 py-0.5 rounded">
                      {pctFieldsVacios}%
                    </span>
                  </button>

                  <button
                    onClick={() => handleFilterTipo('ADVERTENCIA')}
                    className={`border p-4 rounded-xl text-center transition-all ${
                      filterTipo === 'ADVERTENCIA' ? 'bg-orange-500/15 border-orange-500' : 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10'
                    }`}
                  >
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Advertencias</span>
                    <span className="text-2xl font-black text-orange-500 block mt-2 font-mono">{kpis.familia2.total_advertencias.toLocaleString()}</span>
                    <span className="text-[9px] font-extrabold text-orange-500 block mt-2 bg-orange-500/15 border border-orange-500/30 py-0.5 rounded">
                      {pctFieldsAdvs}%
                    </span>
                  </button>

                  <button
                    onClick={() => handleFilterTipo('ALERTA')}
                    className={`border p-4 rounded-xl text-center transition-all ${
                      filterTipo === 'ALERTA' ? 'bg-red-500/15 border-red-500' : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                    }`}
                  >
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Alertas</span>
                    <span className="text-2xl font-black text-red-500 block mt-2 font-mono">{kpis.familia2.total_alertas.toLocaleString()}</span>
                    <span className="text-[9px] font-extrabold text-red-500 block mt-2 bg-red-500/15 border border-red-500/30 py-0.5 rounded">
                      {pctFieldsAlertas}%
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* AUDITORÍA DE REGISTROS (FILAS) */}
            {kpis.familia3 && (
              <div className="rounded-xl border border-navy-800 bg-[#090f1d]/50 p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex justify-between">
                  <span>Auditoría de Filas de Registro (Corridas/Juntas)</span>
                  <span className="text-[10px] bg-slate-900 text-slate-500 px-2 py-0.5 rounded font-mono">
                    Total: {kpis.familia3.total_discontinuidades.toLocaleString()} filas
                  </span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-[#10b981]/5 border border-[#10b981]/20 p-4 rounded-xl text-center shadow-inner">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Filas Correctas</span>
                    <span className="text-2xl font-black text-[#10b981] block mt-2 font-mono">{kpis.familia3.discontinuidades_correctas.toLocaleString()}</span>
                    <span className="text-[9px] font-extrabold text-[#10b981] block mt-2 bg-[#10b981]/15 border border-[#10b981]/30 py-0.5 rounded">
                      {pctDiscsCorrectas}%
                    </span>
                  </div>

                  <div className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-xl text-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase block font-medium">Filas con Vacíos</span>
                    <span className="text-2xl font-black text-yellow-500 block mt-2 font-mono">{kpis.familia3.discontinuidades_vacios.toLocaleString()}</span>
                    <span className="text-[9px] font-extrabold text-yellow-500 block mt-2 bg-yellow-500/15 border border-yellow-500/30 py-0.5 rounded">
                      {pctDiscsVacias}%
                    </span>
                  </div>

                  <div className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-xl text-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Filas con Advs</span>
                    <span className="text-2xl font-black text-orange-500 block mt-2 font-mono">{kpis.familia3.discontinuidades_advertencias.toLocaleString()}</span>
                    <span className="text-[9px] font-extrabold text-orange-500 block mt-2 bg-orange-500/15 border border-orange-500/30 py-0.5 rounded">
                      {pctDiscsAdvs}%
                    </span>
                  </div>

                  <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl text-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase block font-medium">Filas con Alertas</span>
                    <span className="text-2xl font-black text-red-500 block mt-2 font-mono">{kpis.familia3.discontinuidades_alertas.toLocaleString()}</span>
                    <span className="text-[9px] font-extrabold text-red-500 block mt-2 bg-red-500/15 border border-red-500/30 py-0.5 rounded">
                      {pctDiscsAlertas}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TABLAS COMPARATIVAS DE DISTRIBUCIÓN */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* DISTRIBUCIÓN POR CAMPAÑA */}
            <div className="rounded-xl border border-navy-800 bg-[#090f1d]/50 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                <Calendar size={14} className="text-indigo-400" />
                <span>Distribución por Campaña de Perforación</span>
              </h3>
              <div className="rounded-xl border border-navy-800 overflow-hidden bg-slate-950">
                <div className="max-h-56 overflow-y-auto scrollbar-thin">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 font-extrabold border-b border-navy-900">
                      <tr>
                        <th className="py-2.5 px-3">Campaña</th>
                        <th className="py-2.5 px-3 text-center">Registros (N)</th>
                        <th className="py-2.5 px-3 text-center text-red-400">Alertas (%)</th>
                        <th className="py-2.5 px-3 text-center text-orange-400">Advs (%)</th>
                        <th className="py-2.5 px-3 text-center text-yellow-400">Vacíos (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpis.distribucion_campania?.map((row: any, idx: number) => {
                        const isFiltered = filterCampania === row.campania;
                        return (
                          <tr
                            key={idx}
                            onClick={() => handleFilterCampania(row.campania)}
                            className={`border-b border-navy-900/60 cursor-pointer hover:bg-slate-900/30 ${
                              isFiltered ? 'bg-indigo-500/15' : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-bold text-slate-200">{row.campania}</td>
                            <td className="py-2 px-3 text-center font-mono">{row.discontinuidades}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-red-400">
                              {row.alertas_cant} <span className="text-[10px] text-slate-500 font-normal">({row.alertas_pct.toFixed(1)}%)</span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">
                              {row.advertencias_cant} <span className="text-[10px] text-slate-500 font-normal">({row.advertencias_pct.toFixed(1)}%)</span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">
                              {row.vacios_cant} <span className="text-[10px] text-slate-500 font-normal">({row.vacios_pct.toFixed(1)}%)</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* DISTRIBUCIÓN POR TALADROS MÁS COMPLEJOS */}
            <div className="rounded-xl border border-navy-800 bg-[#090f1d]/50 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                <BarChart3 size={14} className="text-indigo-400" />
                <span>Taladros con Más Incidencias Halladas</span>
              </h3>
              <div className="rounded-xl border border-navy-800 overflow-hidden bg-slate-950">
                <div className="max-h-56 overflow-y-auto scrollbar-thin">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 font-extrabold border-b border-navy-900">
                      <tr>
                        <th className="py-2.5 px-3">Taladro</th>
                        <th className="py-2.5 px-3 text-center">Registros (N)</th>
                        <th className="py-2.5 px-3 text-center text-red-400">Alertas</th>
                        <th className="py-2.5 px-3 text-center text-orange-400">Advs</th>
                        <th className="py-2.5 px-3 text-center text-yellow-400">Vacíos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpis.worst_cells?.slice(0, 10).map((row: any, idx: number) => {
                        const isFiltered = filterCelda === row.celda;
                        return (
                          <tr
                            key={idx}
                            onClick={() => handleFilterCelda(row.celda)}
                            className={`border-b border-navy-900/60 cursor-pointer hover:bg-slate-900/30 ${
                              isFiltered ? 'bg-indigo-500/15' : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-bold text-slate-200">{row.celda}</td>
                            <td className="py-2 px-3 text-center font-mono">{row.total_hijas}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-red-400">{row.alertas}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">{row.advertencias}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">{row.vacios}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RESPONSABLE / GEÓLOGOS */}
            <div className="rounded-xl border border-navy-800 bg-[#090f1d]/50 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                <User size={14} className="text-indigo-400" />
                <span>Anomalías Agrupadas por Geólogo</span>
              </h3>
              <div className="rounded-xl border border-navy-800 overflow-hidden bg-slate-950">
                <div className="max-h-56 overflow-y-auto scrollbar-thin">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 font-extrabold border-b border-navy-900">
                      <tr>
                        <th className="py-2.5 px-3">Geólogo</th>
                        <th className="py-2.5 px-3 text-center">Registros (N)</th>
                        <th className="py-2.5 px-3 text-center text-red-400">Alertas (%)</th>
                        <th className="py-2.5 px-3 text-center text-orange-400">Advs (%)</th>
                        <th className="py-2.5 px-3 text-center text-yellow-400">Vacíos (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpis.distribucion_geotecnico?.map((row: any, idx: number) => {
                        const isFiltered = filterGeotecnico === row.geotecnico;
                        return (
                          <tr
                            key={idx}
                            onClick={() => handleFilterGeotecnico(row.geotecnico)}
                            className={`border-b border-navy-900/60 cursor-pointer hover:bg-slate-900/30 ${
                              isFiltered ? 'bg-indigo-500/15' : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-bold text-slate-200 truncate max-w-[100px]">{row.geotecnico}</td>
                            <td className="py-2 px-3 text-center font-mono">{row.discontinuidades}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-red-400">
                              {row.alertas_cant} <span className="text-[10px] text-slate-500 font-normal">({row.alertas_pct.toFixed(1)}%)</span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-orange-400">
                              {row.advertencias_cant} <span className="text-[10px] text-slate-500 font-normal">({row.advertencias_pct.toFixed(1)}%)</span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-yellow-400">
                              {row.vacios_cant} <span className="text-[10px] text-slate-500 font-normal">({row.vacios_pct.toFixed(1)}%)</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* TOP ERRORES DETALLADOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ALERTAS CRITICAS */}
            <div className="rounded-xl border border-navy-800 bg-[#090f1d]/30 p-5 space-y-4 shadow-lg">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" />
                <span>Alertas Críticas con Mayor Ocurrencia</span>
              </h3>
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto p-1 scrollbar-thin">
                {kpis.error_types_detailed?.alertas?.map((item: any, idx: number) => {
                  const isFiltered = filterSearch === item.mensaje;
                  return (
                    <button
                      key={idx}
                      onClick={() => setFilterSearch(prev => prev === item.mensaje ? '' : item.mensaje)}
                      className={`w-full flex flex-col md:flex-row md:items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isFiltered
                          ? 'bg-red-500/10 border-red-500 shadow-md ring-1 ring-red-500/30'
                          : 'bg-[#0f172a]/30 border-navy-800 hover:bg-slate-900/30 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`shrink-0 ${getAlertRankStyle(idx)}`}>{idx + 1}</span>
                        <span className="text-red-400 font-black uppercase text-[10px] tracking-wider leading-relaxed block break-words">
                          {item.mensaje}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0 font-bold">
                        <span className="bg-[#02040a] border border-navy-900 text-slate-400 px-2 py-0.5 rounded text-[10px]">
                          {item.cantidad} casos
                        </span>
                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[10px]">
                          {item.pct.toFixed(1)}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ADVERTENCIAS */}
            <div className="rounded-xl border border-navy-800 bg-[#090f1d]/30 p-5 space-y-4 shadow-lg">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-350 border-b border-navy-850 pb-2 flex items-center gap-2">
                <Settings size={14} className="text-amber-500" />
                <span>Advertencias de Consistencia</span>
              </h3>
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto p-1 scrollbar-thin">
                {kpis.error_types_detailed?.advertencias?.map((item: any, idx: number) => {
                  const isFiltered = filterSearch === item.mensaje;
                  return (
                    <button
                      key={idx}
                      onClick={() => setFilterSearch(prev => prev === item.mensaje ? '' : item.mensaje)}
                      className={`w-full flex flex-col md:flex-row md:items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isFiltered
                          ? 'bg-orange-500/10 border-orange-500 shadow-md ring-1 ring-orange-500/30'
                          : 'bg-[#0f172a]/30 border-navy-800 hover:bg-slate-900/30 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`shrink-0 ${getWarningRankStyle(idx)}`}>{idx + 1}</span>
                        <span className="text-orange-400 font-black uppercase text-[10px] tracking-wider leading-relaxed block break-words">
                          {item.mensaje}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0 font-bold">
                        <span className="bg-[#02040a] border border-navy-900 text-slate-400 px-2 py-0.5 rounded text-[10px]">
                          {item.cantidad} casos
                        </span>
                        <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded text-[10px]">
                          {item.pct.toFixed(1)}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* VISOR DETALLADO GRID PAGINADO */}
          <div className="rounded-xl border border-navy-800 bg-[#090f1d]/30 p-6 space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <FileText size={14} className="text-indigo-400" />
                  <span>Buscador y Monitor de Anomalías Paginado</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Mostrando **{totalRecords.toLocaleString()}** registros que coinciden con las consultas.
                </p>
              </div>

              {/* BUSCADOR */}
              <div className="flex items-center gap-2 bg-slate-950 border border-navy-800 rounded-lg px-3 py-1.5 w-full sm:w-64">
                <Search size={14} className="text-slate-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar columna, taladro, error..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none w-full font-bold"
                />
                {filterSearch && (
                  <button onClick={() => setFilterSearch('')} className="text-slate-500 hover:text-slate-350">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* TABLA */}
            <div className="rounded-xl border border-navy-850 overflow-hidden bg-slate-950/20">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-navy-800 h-10 uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3 text-center">Fila Excel</th>
                      <th className="py-2.5 px-3">Módulo</th>
                      <th className="py-2.5 px-3">Taladro</th>
                      <th className="py-2.5 px-3">ID / Profundidad</th>
                      <th className="py-2.5 px-3">Campaña</th>
                      <th className="py-2.5 px-3">Geólogo</th>
                      <th className="py-2.5 px-3">Campo Falla</th>
                      <th className="py-2.5 px-3 text-center">Valor</th>
                      <th className="py-2.5 px-3 text-center">Gravedad</th>
                      <th className="py-2.5 px-3">Inconsistencia Geotécnica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidencias.map((inc, i) => (
                      <tr key={i} className="border-b border-navy-900/60 hover:bg-slate-900/10">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">{inc.fila_excel}</td>
                        <td className="py-2.5 px-3 font-extrabold text-slate-400">{inc.modulo || 'LGG'}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-200">{inc.celda_padre}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-300">{inc.celda_hija}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono">{inc.campania || 'N/A'}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-medium">{inc.geotecnico || 'N/A'}</td>
                        <td className="py-2.5 px-3 text-indigo-400 font-mono">{inc.columna}</td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {inc.valor_actual !== null ? String(inc.valor_actual) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            inc.tipo_incidencia === 'ALERTA'
                              ? colorAlertas
                              : inc.tipo_incidencia === 'ADVERTENCIA'
                                ? colorAdvertencias
                                : colorVacios
                          }`}>
                            {inc.tipo_incidencia === 'VACIO' ? 'VACÍO' : inc.tipo_incidencia}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 italic leading-snug">{inc.mensaje}</td>
                      </tr>
                    ))}
                    {incidencias.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500 italic">
                          No se hallaron complejidades para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CONTROLES PAGINACION */}
            <div className="flex justify-between items-center text-xs text-slate-400 pt-2 select-none font-bold">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => {
                    const newPage = page - 1;
                    setPage(newPage);
                    fetchPaginatedIncidencias(newPage);
                  }}
                  className="p-1.5 rounded-lg bg-[#090f1d] hover:bg-slate-900 border border-navy-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => {
                    const newPage = page + 1;
                    setPage(newPage);
                    fetchPaginatedIncidencias(newPage);
                  }}
                  className="p-1.5 rounded-lg bg-[#090f1d] hover:bg-slate-900 border border-navy-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
