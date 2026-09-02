import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Construction,
  Database
} from 'lucide-react';

import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import MainDashboard from './features/dashboard/MainDashboard';
import CollarView from './features/collar/CollarView';
import LggView from './features/lgg/LggView';
import StructuralView from './features/structural/StructuralView';
import RmrAnalysis from './features/rmr/RmrAnalysis';
import ValidationPanel from './components/common/ValidationPanel';
import CatalogsModal from './components/common/CatalogsModal';
import FormulasModal from './components/common/FormulasModal';
import SaveResultModal from './components/common/SaveResultModal';
import DiscardModal from './components/common/DiscardModal';
import SaveConfirmModal from './components/common/SaveConfirmModal';
import PltView from './features/plt/PltView';
import RqdDashboard from './features/dashboard/RqdDashboard';
import ReportsPdf from './features/reports/ReportsPdf';
import AuditoriaHub from './features/auditor/AuditoriaHub';

import { validateLogueoQAQC, type QaQcAlert } from './utils/qaQcRules';
import { validateLogueoMandatory, toVacioAlerts } from './utils/mandatoryRules';
import { subscribeTouched, resetTouchedFields } from './utils/qaQcTouch';
import { resolveLithologyCascade } from './utils/catalogData';
import { calculateRowRmr } from './utils/formulaEngine';
import { computeTaladroHash } from './utils/hashUtils';
import { computeTaladroDiff, computeAllTaladrosDiff, type TaladroDiffSummary } from './utils/diffUtils';
import {
  addPendingTaladro,
  removePendingTaladro,
  getUnsavedTaladros,
  safeSetItem,
  evictTaladro,
  getCachedTaladroRaw,
  setCachedTaladro,
  setCachedSnapshotData,
  setCachedSnapshotHash,
  getTaladroStorageKey,
  getSnapshotStorageKey
} from './utils/storageManager';
import {
  isTaladroPending,
  discardLocalTaladro,
  getLocalOnlyPendingSummaries,
  getPendingTaladroNames,
  verifyTaladroNameCollisions,
  clearTaladroValidation
} from './utils/taladroRegistry';

interface Survey {
  id?: number;   // SurveyID (para UPSERT backend)
  depth: number;
  dip: number;
  azimuth: number;
}

interface Corrida {
  corrida: number;
  de: number;
  a: number;
  rec_m: number;
  rqd_m: number;
  lrf_m: number;
  frf?: number;
  small_frag_m: number;
  lito1: string;
  lito2?: string;
  lito3?: string;
  resistencia: string;
  orientacion: string;
  tipo_est1: string;
  tipo_est2?: string;
  frac_nat: number;
  frac_buz30: number;
  frac_buz60: number;
  frac_buz90: number;
  abertura: number;
  rugosidad: number;
  jrc10: number;
  intemperismo: string;
  relleno1: string;
  relleno2?: string;
  espesor: number;
  agua_obs: string;
  comentarios?: string;
}

interface Discontinuidad {
  id: number;
  de: number;
  a: number;
  profundidad: number;
  litologia: string;
  tipo_estructura: string;
  alfa: number;
  beta: number;
  forma: number;
  rugosidad: number;
  jrc10: number;
  abertura: number;
  weathering: string;
  espesor: number;
  relleno1: string;
  relleno2?: string;
  dureza_pared: string;
  agua: string;
  geotecnico: string;
  comentario?: string;
  corrida: number;
  lito1?: string;
  lito2?: string;
  lito3?: string;
}

interface Collar {
  name: string;
  proyecto: string;
  geologo: string;
  diametro: string;
  inclinacion: number;
  campana: string;
  fecha_registro: string;
  nivel_freatico?: number;
  collar_eoh?: number;
  // Proyectado
  collar_este_proyectado?: number;
  collar_norte_proyectado?: number;
  collar_cota_proyectado?: number;
  prof_final_eoh_proyectada?: number;
  comentarios_proyectado?: string;
  // Oficial
  collar_este: number;
  collar_norte: number;
  collar_cota: number;
  prof_final_eoh?: number;
  comentarios?: string;
  turno: string;
}

export interface EnsayoPlt {
  id?: number;
  taladro?: string;
  fecha: string;
  nro_muestra: string;
  nro_caja: number;
  from_m: number;
  to_m: number;
  verif_corrida: string;
  long_de_corrida_m: number;
  este_m: number;
  norte_m: number;
  elevacion_msnm: number;
  long_de_muestra_mm: number;
  tipo_de_ensayo: string;
  diametro_taladro_nominacion: string;
  litologia_1?: string;
  litologia_2?: string;
  litologia_3?: string;
  tipo_litologico?: string;
  d_mm: number;
  verif_de_longitud: string;
  p_instr_kn: number;
  tipo_rotura_code: string;
  direccion_rotura_code: string;
  ejecutadoPor: string;
  is_mpa: number;
  fact_corr: number;
  is_50_mpa: number;
  factor_k?: number;
  ucs: number;
  isrm_indice_r: string;
  observaciones?: string;
  corrida_desde?: number;
  corrida_hasta?: number;
}

interface Taladro extends Collar {
  surveys: Survey[];
  corridas: Corrida[];
  discontinuidades: Discontinuidad[];
  ensayos_plt: EnsayoPlt[];
}

interface TaladroSummary {
  name: string;
  proyecto: string;
  geologo: string;
  diametro: string;
  inclinacion: number;
  fecha_registro: string;
  corridas_count: number;
  surveys_count: number;
  perf_total?: number;
}

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function App() {
  const [currentView, setCurrentView] = useState<string>(() => {
    return localStorage.getItem('geolog_active_view') || 'dashboard';
  });
  const [taladros, setTaladros] = useState<TaladroSummary[]>([]);
  const [activeTaladro, setActiveTaladro] = useState<Taladro | null>(() => {
    try {
      const savedName = localStorage.getItem('geolog_active_taladro_name');
      if (savedName) {
        const cachedStr = getCachedTaladroRaw(savedName);
        if (cachedStr) {
          const parsed = JSON.parse(cachedStr);
          if (!parsed.ensayos_plt) parsed.ensayos_plt = [];
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Error al restaurar taladro activo desde localStorage:", e);
    }
    return null;
  });
  const [originalName, setOriginalName] = useState<string | null>(() => {
    return localStorage.getItem('geolog_active_taladro_name') || null;
  });

  // Theme and UI States
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [showCatalogsModal, setShowCatalogsModal] = useState<boolean>(false);
  const [showFormulasModal, setShowFormulasModal] = useState<boolean>(false);

  // Catálogo de Campañas dinámico desde la BD
  const [availableCampanas, setAvailableCampanas] = useState<string[]>([
    "Campaña 2020", "Campaña 2021", "Campaña 2022", "Campaña 2023", "Campaña 2024", "Campaña 2025", "Campaña 2026"
  ]);

  useEffect(() => {
    fetchCampanas();
  }, []);

  const fetchCampanas = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/catalogs/campanas`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAvailableCampanas(data);
        }
      }
    } catch (e) {
      console.warn("Could not fetch campanas catalog from backend:", e);
    }
  };

  // Estados del Dashboard: KPIs, paginación, filtros de fecha y búsqueda por botón
  const [dashboardKpis, setDashboardKpis] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('geolog_dashboard_page');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (e) {}
    return 1;
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('geolog_dashboard_pagesize');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (e) {}
    return 20;
  });
  const [activeDateRange, setActiveDateRange] = useState<string>(() => {
    try {
      return localStorage.getItem('geolog_dashboard_date_range') || 'todo';
    } catch (e) {
      return 'todo';
    }
  });
  const [searchTerm, setSearchTerm] = useState<string>(() => {
    try {
      return localStorage.getItem('geolog_dashboard_search_term') || '';
    } catch (e) {
      return '';
    }
  });
  const [isGlobalSearch, setIsGlobalSearch] = useState<boolean>(() => {
    try {
      return localStorage.getItem('geolog_dashboard_is_global') === 'true';
    } catch (e) {
      return false;
    }
  });

  // Filtros avanzados del dashboard (proyecto / geólogo / diámetro)
  const [advancedFilters, setAdvancedFilters] = useState<{ proyecto: string; geologo: string; diametro: string }>({
    proyecto: '',
    geologo: '',
    diametro: ''
  });

  // Totales devueltos por el servidor (paginación server-side)
  const [serverTotalFiltered, setServerTotalFiltered] = useState<number>(0);
  const [serverTotalPages, setServerTotalPages] = useState<number>(1);

  // Persistir parámetros de dashboard en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('geolog_dashboard_page', String(page));
    } catch (e) {}
  }, [page]);

  useEffect(() => {
    try {
      localStorage.setItem('geolog_dashboard_pagesize', String(pageSize));
    } catch (e) {}
  }, [pageSize]);

  useEffect(() => {
    try {
      localStorage.setItem('geolog_dashboard_date_range', activeDateRange);
    } catch (e) {}
  }, [activeDateRange]);

  useEffect(() => {
    try {
      localStorage.setItem('geolog_dashboard_search_term', searchTerm);
    } catch (e) {}
  }, [searchTerm]);

  useEffect(() => {
    try {
      localStorage.setItem('geolog_dashboard_is_global', String(isGlobalSearch));
    } catch (e) {}
  }, [isGlobalSearch]);

  // Synchronization feedback states
  const [syncStatus, setSyncStatus] = useState<'synced' | 'unsaved' | 'saving' | 'offline'>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('Conectado al servidor de base de datos.');

  const [isLoadingTaladro, setIsLoadingTaladro] = useState<boolean>(false);

  // Snapshot y Hash del estado del taladro en BD
  const [dbSnapshotHash, setDbSnapshotHash] = useState<number | null>(() => {
    try {
      const savedName = localStorage.getItem('geolog_active_taladro_name');
      if (savedName) {
        const savedHash = localStorage.getItem(`geolog_snapshot_hash_${savedName}`);
        if (savedHash) {
          const parsed = Number(savedHash);
          return isNaN(parsed) ? null : parsed;
        }
      }
    } catch (e) {}
    return null;
  });

  const [dbSnapshotData, setDbSnapshotData] = useState<Taladro | null>(() => {
    try {
      const savedName = localStorage.getItem('geolog_active_taladro_name');
      if (savedName) {
        const cachedSnapshot = localStorage.getItem(`geolog_snapshot_data_${savedName}`);
        if (cachedSnapshot) {
          const parsed = JSON.parse(cachedSnapshot);
          if (!parsed.ensayos_plt) parsed.ensayos_plt = [];
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  });

  // Modal de resultado de guardado con reporte de auditoría
  const [saveResultModal, setSaveResultModal] = useState<{
    show: boolean;
    success: boolean;
    message: string;
    details?: string;
    diffSummary?: TaladroDiffSummary | null;
  }>({ show: false, success: false, message: '' });

  // Modal de pre-confirmación de guardado
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState<boolean>(false);

  // Modal de confirmación para descartar cambios
  const [showDiscardModal, setShowDiscardModal] = useState<boolean>(false);

  // Contador reactivo de taladros con cambios pendientes
  const [unsavedTaladrosCount, setUnsavedTaladrosCount] = useState<number>(() => {
    return getUnsavedTaladros().length;
  });

  // Resúmenes de borradores locales puros (que NO existen en BD)
  const pendingTaladroSummaries = useMemo(
    () => getLocalOnlyPendingSummaries(taladros.map(t => t.name)),
    [taladros, activeTaladro, syncStatus, unsavedTaladrosCount]
  );

  // Nombres de TODOS los taladros pendientes (para marcar badge BORRADOR en filas de BD)
  const pendingTaladroNames = useMemo(
    () => getPendingTaladroNames(),
    [activeTaladro, syncStatus, unsavedTaladrosCount]
  );

  // Initialize Dark Mode Class
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Params de filtro compartidos entre el listado paginado y los KPIs (patrón Mapeo)
  const buildDashboardQueryParams = (dr?: string, term?: string, globalSearch?: boolean, adv?: { proyecto: string; geologo: string; diametro: string }) => {
    const params = new URLSearchParams();
    const drActive = dr || activeDateRange;
    const now = new Date();
    const toLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (drActive !== 'todo') {
      if (drActive === 'hoy') {
        params.set('fecha_desde', toLocal(now));
        params.set('fecha_hasta', toLocal(now));
      } else if (drActive === 'ayer') {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        params.set('fecha_desde', toLocal(y));
        params.set('fecha_hasta', toLocal(y));
      } else if (drActive === 'semana') {
        const w = new Date(now); w.setDate(w.getDate() - 7);
        params.set('fecha_desde', toLocal(w));
        params.set('fecha_hasta', toLocal(now));
      } else if (drActive === 'mes') {
        const m = new Date(now); m.setDate(m.getDate() - 30);
        params.set('fecha_desde', toLocal(m));
        params.set('fecha_hasta', toLocal(now));
      } else if (drActive === 'ano') {
        params.set('fecha_desde', `${now.getFullYear()}-01-01`);
        params.set('fecha_hasta', toLocal(now));
      }
    }
    const gSearch = globalSearch !== undefined ? globalSearch : isGlobalSearch;
    if (gSearch) params.set('search_global', 'true');
    const termActive = term !== undefined ? term : searchTerm;
    if (termActive.trim()) params.set('q', termActive.trim());
    const advActive = adv || advancedFilters;
    if (advActive.proyecto.trim()) params.set('proyecto', advActive.proyecto.trim());
    if (advActive.geologo.trim()) params.set('geologo', advActive.geologo.trim());
    if (advActive.diametro.trim()) params.set('diametro', advActive.diametro.trim());
    return params;
  };

  // Cargar estadísticas KPI del Dashboard desde el servidor (con los mismos filtros del listado)
  const fetchDashboardStats = async (dr?: string, term?: string, globalSearch?: boolean, adv?: { proyecto: string; geologo: string; diametro: string }) => {
    try {
      const params = buildDashboardQueryParams(dr, term, globalSearch, adv);
      const res = await fetch(`${API_BASE}/api/taladros/dashboard-stats?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDashboardKpis(data);
      }
    } catch (e) {
      console.warn("No se pudieron cargar estadísticas KPI del servidor backend:", e);
    }
  };

  // Fetch drillhole lists on mount
  useEffect(() => {
    fetchTaladros();
  }, []);

  // Filtrado y paginación en memoria para resiliencia offline/online
  // Fecha local YYYY-MM-DD (evita el desfase UTC de toISOString en zonas negativas)
  const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Modo offline: los filtros/paginación viven en el servidor; solo en modo offline
  // se filtran/paginan los summaries del caché local en memoria.
  const isOfflineMode = syncStatus === 'offline';

  const filteredTaladros = useMemo(() => {
    // ONLINE: la lista ya viene filtrada y paginada del servidor.
    if (!isOfflineMode) return taladros;

    // OFFLINE: filtrar el caché completo en memoria (respaldo).
    let list = [...taladros];

    // Helper para extraer YYYY-MM-DD
    const getFechaStr = (f?: string) => f ? f.split('T')[0] : '';
    const now = new Date();
    const todayStr = toLocalDateStr(now);

    // 1. Filtrado por rango de fechas (Hoy, Ayer, Últimos 7/30 días, Este Año, Todo)
    if (!isGlobalSearch) {
      if (activeDateRange === 'hoy') {
        list = list.filter(t => getFechaStr(t.fecha_registro) === todayStr);
      } else if (activeDateRange === 'ayer') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yestStr = toLocalDateStr(yesterday);
        list = list.filter(t => getFechaStr(t.fecha_registro) === yestStr);
      } else if (activeDateRange === 'semana') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStartStr = toLocalDateStr(weekAgo);
        list = list.filter(t => getFechaStr(t.fecha_registro) >= weekStartStr);
      } else if (activeDateRange === 'mes') {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        const monthStartStr = toLocalDateStr(monthAgo);
        list = list.filter(t => getFechaStr(t.fecha_registro) >= monthStartStr);
      } else if (activeDateRange === 'ano') {
        const yearStartStr = `${now.getFullYear()}-01-01`;
        list = list.filter(t => getFechaStr(t.fecha_registro) >= yearStartStr);
      }
    }

    // 2. Filtros avanzados (proyecto / geólogo / diámetro) — antes de paginar
    const advP = advancedFilters.proyecto.trim().toLowerCase();
    const advG = advancedFilters.geologo.trim().toLowerCase();
    const advD = advancedFilters.diametro.trim().toLowerCase();
    if (advP || advG || advD) {
      list = list.filter(t =>
        (!advP || (t.proyecto && t.proyecto.toLowerCase().includes(advP))) &&
        (!advG || (t.geologo && t.geologo.toLowerCase().includes(advG))) &&
        (!advD || (t.diametro && t.diametro.toLowerCase().includes(advD)))
      );
    }

    // 3. Búsqueda por texto (código de taladro, geólogo o proyecto)
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase().trim();
      list = list.filter(t =>
        t.name.toLowerCase().includes(query) ||
        (t.geologo && t.geologo.toLowerCase().includes(query)) ||
        (t.proyecto && t.proyecto.toLowerCase().includes(query))
      );
    }

    return list;
  }, [taladros, activeDateRange, searchTerm, isGlobalSearch, advancedFilters, isOfflineMode]);

  // ─── CÁLCULO DINÁMICO DE KPIS PARA EL DASHBOARD ───
  const computedDashboardKpis = useMemo(() => {
    if (dashboardKpis) return dashboardKpis;
    const list = filteredTaladros;
    const total_taladros = list.length;
    const todayStr = toLocalDateStr(new Date());

    let perf_total_m = 0;
    let perf_total_hoy = 0;
    let totalWeightedRmr = 0;
    let totalRmrMeters = 0;
    let totalWeightedRqd = 0;
    let totalRqdMeters = 0;
    let geologo_mas_reciente = '';

    list.forEach((tSummary) => {
      let tObj: Taladro | null = null;
      if (activeTaladro && activeTaladro.name === tSummary.name) {
        tObj = activeTaladro;
      } else {
        const cached = localStorage.getItem(`geolog_taladro_${tSummary.name}`);
        if (cached) {
          try {
            tObj = JSON.parse(cached);
          } catch (e) {}
        }
      }

      if (!geologo_mas_reciente && tSummary.geologo) {
        geologo_mas_reciente = tSummary.geologo;
      }

      let taladroMeters = 0;

      if (tObj && tObj.corridas && tObj.corridas.length > 0) {
        tObj.corridas.forEach((c) => {
          const de = parseFloat(String(c.de || 0));
          const a = parseFloat(String(c.a || 0));
          const perf = Math.max(0, a - de);
          taladroMeters += perf;

          const rqd_m = parseFloat(String(c.rqd_m || 0));
          if (perf > 0) {
            const rqd_pct = Math.min(100, Math.max(0, (rqd_m / perf) * 100));
            totalWeightedRqd += rqd_pct * perf;
            totalRqdMeters += perf;

            const rmrRes = calculateRowRmr(c, tObj?.nivel_freatico || 97.0);
            if (rmrRes && !rmrRes.error && typeof rmrRes.rmr_89 === 'number') {
              totalWeightedRmr += rmrRes.rmr_89 * perf;
              totalRmrMeters += perf;
            }
          }
        });
      } else if (tSummary.perf_total && tSummary.perf_total > 0) {
        taladroMeters = tSummary.perf_total;
      } else if (tObj && tObj.collar_eoh && tObj.collar_eoh > 0) {
        taladroMeters = tObj.collar_eoh;
      } else if (tSummary.corridas_count && tSummary.corridas_count > 0) {
        taladroMeters = tSummary.corridas_count * 1.5;
      }

      perf_total_m += taladroMeters;

      const fStr = tSummary.fecha_registro ? tSummary.fecha_registro.split('T')[0] : '';
      if (fStr === todayStr) {
        perf_total_hoy += taladroMeters;
      }
    });

    const rmr_promedio = totalRmrMeters > 0 ? totalWeightedRmr / totalRmrMeters : 0;
    const rqd_promedio = totalRqdMeters > 0 ? totalWeightedRqd / totalRqdMeters : 0;

    return {
      total_taladros,
      perf_total_m,
      perf_total_hoy,
      rmr_promedio: parseFloat(rmr_promedio.toFixed(1)),
      rqd_promedio: parseFloat(rqd_promedio.toFixed(1)),
      geologo_mas_reciente: geologo_mas_reciente || (activeTaladro?.geologo || 'RD/RB')
    };
  }, [filteredTaladros, activeTaladro]);

  const totalFilteredTaladros = isOfflineMode ? filteredTaladros.length : serverTotalFiltered;
  const totalDashboardPages = isOfflineMode
    ? Math.max(1, Math.ceil(totalFilteredTaladros / pageSize))
    : serverTotalPages;

  const paginatedTaladros = useMemo(() => {
    // ONLINE: el servidor ya paginó (items de la página actual).
    if (!isOfflineMode) return filteredTaladros;
    // OFFLINE: paginar en memoria.
    const start = (page - 1) * pageSize;
    return filteredTaladros.slice(start, start + pageSize);
  }, [filteredTaladros, page, pageSize, isOfflineMode]);

  // Handlers para bÃºsqueda y paginaciÃ³n
  const handleSearchSubmit = (term: string, isGlobal: boolean) => {
    setSearchTerm(term);
    setIsGlobalSearch(isGlobal);
    fetchTaladros(1, activeDateRange, term, isGlobal, advancedFilters);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setIsGlobalSearch(false);
    fetchTaladros(1, activeDateRange, '', false, advancedFilters);
  };

  const handleFilterChange = (filters: { dateRange?: string }) => {
    if (filters.dateRange) {
      setActiveDateRange(filters.dateRange);
      fetchTaladros(1, filters.dateRange, searchTerm, isGlobalSearch, advancedFilters);
    }
  };

  const handleAdvancedFiltersChange = (filters: { proyecto: string; geologo: string; diametro: string }) => {
    setAdvancedFilters(filters);
    fetchTaladros(1, activeDateRange, searchTerm, isGlobalSearch, filters);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchTaladros(newPage, activeDateRange, searchTerm, isGlobalSearch, advancedFilters);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    fetchTaladros(1, activeDateRange, searchTerm, isGlobalSearch, advancedFilters);
  };

  // Persistir la vista activa y el taladro activo en localStorage
  useEffect(() => {
    localStorage.setItem('geolog_active_view', currentView);
  }, [currentView]);

  useEffect(() => {
    if (activeTaladro && activeTaladro.name) {
      localStorage.setItem('geolog_active_taladro_name', activeTaladro.name);
    } else {
      localStorage.removeItem('geolog_active_taladro_name');
    }
  }, [activeTaladro]);

  // Restaurar taladro activo en recarga/refresh de pagina SOLO si el usuario
  // estaba en una vista de edicion y existe un taladro guardado.
  // En la vista 'dashboard', NUNCA se auto-selecciona ningun taladro de fondo.
  useEffect(() => {
    if (currentView === 'dashboard') return;
    if (!activeTaladro && taladros.length > 0) {
      const savedTaladroName = localStorage.getItem('geolog_active_taladro_name');
      if (savedTaladroName) {
        fetch(`${API_BASE}/api/taladros/existe?name=${encodeURIComponent(savedTaladroName)}`)
          .then(r => r.json())
          .then(({ exists }) => {
            if (exists) handleSelectTaladro(savedTaladroName, false);
            else if (isTaladroPending(savedTaladroName)) handleSelectTaladro(savedTaladroName, false);
          })
          .catch(() => {
            // Servidor caido: reabrir si esta en la lista local o en pendientes
            if (taladros.some(t => t.name === savedTaladroName) || isTaladroPending(savedTaladroName)) {
              handleSelectTaladro(savedTaladroName, false);
            }
          });
      }
    }
  }, [taladros, activeTaladro, currentView]);

  const fetchTaladros = async (
    p?: number,
    dr?: string,
    term?: string,
    globalSearch?: boolean,
    adv?: { proyecto: string; geologo: string; diametro: string },
  ) => {
    setDashboardLoading(true);
    try {
      // Patrón GEMA-Mapeo: la paginación y los filtros viven en el servidor.
      const params = buildDashboardQueryParams(dr, term, globalSearch, adv);
      params.set('page', String(p || page));
      params.set('page_size', String(pageSize));

      const drActive = dr || activeDateRange;
      const termActive = term !== undefined ? term : searchTerm;
      const gSearch = globalSearch !== undefined ? globalSearch : isGlobalSearch;
      const advActive = adv || advancedFilters;

      const res = await fetch(`${API_BASE}/api/taladros?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTaladros(data.items || []);
        setServerTotalFiltered(data.total_filtered ?? (data.items || []).length);
        setServerTotalPages(Math.max(1, data.total_pages || 1));
        // KPIs filtrados (mismos filtros que la página)
        fetchDashboardStats(drActive, termActive, gSearch, advActive);
        setSyncStatus('synced');
        setSyncMessage('Conectado al servidor de base de datos.');
      } else {
        throw new Error("HTTP error " + res.status);
      }
    } catch (e) {
      console.warn("Backend server not reachable. Loading cached storage local database.", e);
      setSyncStatus('offline');
      setSyncMessage("Servidor backend offline. Usando almacenamiento local temporal.");

      // Load offline summaries from localStorage (cache completo para filtrar en memoria)
      const cached = localStorage.getItem('geolog_taladros_summaries');
      if (cached) {
        setTaladros(JSON.parse(cached));
      } else {
        // Mock data fallback if no cache
        const mockSummary: TaladroSummary[] = [
          {
            name: "FEGT25-001",
            proyecto: "Proyecto A",
            geologo: "RD/RB",
            diametro: "HQ3",
            inclinacion: -60.0,
            fecha_registro: "2026-06-02",
            corridas_count: 3,
            surveys_count: 2
          }
        ];
        setTaladros(mockSummary);
        localStorage.setItem('geolog_taladros_summaries', JSON.stringify(mockSummary));
      }
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleSelectTaladro = async (name: string, shouldSwitchView: boolean = true) => {
    setIsLoadingTaladro(true);
    try {
      const res = await fetch(`${API_BASE}/api/taladros/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.ensayos_plt) data.ensayos_plt = [];
        
        // Pre-sincronizar discontinuidades con corridas al cargar de BD
        if (data.corridas && data.discontinuidades) {
          data.discontinuidades = data.discontinuidades.map((disc: any) => {
            const match = data.corridas.find((c: any) => disc.profundidad >= c.de && disc.profundidad <= c.a);
            if (match) {
              return {
                ...disc,
                de: match.de,
                a: match.a,
                corrida: match.corrida,
                litologia: match.lito1,
                lito1: match.lito1,
                lito2: match.lito2 || '-1',
                lito3: match.lito3 || '-1',
                litologia2: match.lito2 || '-1',
                litologia3: match.lito3 || '-1',
                dureza_pared: match.resistencia
              };
            }
            return {
              ...disc,
              lito1: disc.litologia ?? disc.lito1 ?? '-1',
              lito2: disc.litologia2 ?? disc.lito2 ?? '-1',
              lito3: disc.litologia3 ?? disc.lito3 ?? '-1'
            };
          });
        }

        // Snapshot original de la BD (fuente de verdad para auditoría y dirty detection)
        const dbSnapshot = JSON.parse(JSON.stringify(data));
        const dbHash = computeTaladroHash(data);
        setDbSnapshotData(dbSnapshot);
        setDbSnapshotHash(dbHash);
        setCachedSnapshotData(data.name, dbSnapshot);
        setCachedSnapshotHash(data.name, dbHash);

        // Verificar si existe un borrador con cambios pendientes en localStorage
        let taladroToActivate = data;
        let isUnsaved = false;
        try {
          if (isTaladroPending(name)) {
            const cachedDraftStr = getCachedTaladroRaw(name);
            if (cachedDraftStr) {
              const cachedDraft = JSON.parse(cachedDraftStr);
              if (!cachedDraft.ensayos_plt) cachedDraft.ensayos_plt = [];
              if (computeTaladroHash(cachedDraft) !== dbHash) {
                taladroToActivate = cachedDraft;
                isUnsaved = true;
              }
            }
          }
        } catch (err) {
          console.warn("Error leyendo borrador de localStorage:", err);
        }

        if (!isUnsaved) {
          // Si el taladro no tiene modificaciones pendientes, resguardar copia limpia y desmarcar en pending
          setCachedTaladro(name, data);
          removePendingTaladro(name);
        } else {
          addPendingTaladro(name);
        }

        setActiveTaladro(taladroToActivate);
        setOriginalName(data.name);
        setSyncStatus(isUnsaved ? 'unsaved' : 'synced');
        setUnsavedTaladrosCount(getUnsavedTaladros().length);
        if (shouldSwitchView) {
          setCurrentView('collar');
        }
        setSelectedRowIndex(0);
      } else {
        throw new Error("HTTP " + res.status);
      }
    } catch (e) {
      console.warn("Loading taladro offline for name: ", name);
      const cachedDraftStr = getCachedTaladroRaw(name);
      if (cachedDraftStr) {
        const parsed = JSON.parse(cachedDraftStr);
        if (!parsed.ensayos_plt) parsed.ensayos_plt = [];

        if (parsed.corridas && parsed.discontinuidades) {
          parsed.discontinuidades = parsed.discontinuidades.map((disc: any) => {
            const match = parsed.corridas.find((c: any) => disc.profundidad >= c.de && disc.profundidad <= c.a);
            if (match) {
              return {
                ...disc,
                de: match.de,
                a: match.a,
                corrida: match.corrida,
                litologia: match.lito1,
                lito1: match.lito1,
                lito2: match.lito2 || '-1',
                lito3: match.lito3 || '-1',
                litologia2: match.lito2 || '-1',
                litologia3: match.lito3 || '-1',
                dureza_pared: match.resistencia
              };
            }
            return {
              ...disc,
              lito1: disc.litologia ?? disc.lito1 ?? '-1',
              lito2: disc.litologia2 ?? disc.lito2 ?? '-1',
              lito3: disc.litologia3 ?? disc.lito3 ?? '-1'
            };
          });
        }

        // Buscar si existe un snapshot limpio previo guardado de BD
        let dbSnapshot = null;
        let dbHash = null;
        try {
          const cachedSnapStr = localStorage.getItem(`geolog_snapshot_data_${name}`);
          if (cachedSnapStr) {
            dbSnapshot = JSON.parse(cachedSnapStr);
            dbHash = computeTaladroHash(dbSnapshot);
          }
        } catch (err) {}

        const isPureLocal = !dbSnapshot;
        if (!dbSnapshot) {
          dbHash = null;
        }

        const isUnsaved = isPureLocal || (computeTaladroHash(parsed) !== dbHash);
        setDbSnapshotData(dbSnapshot);
        setDbSnapshotHash(dbHash);
        setActiveTaladro(parsed);
        setOriginalName(isPureLocal ? null : parsed.name);
        setSyncStatus(isUnsaved ? 'unsaved' : 'synced');
        if (isUnsaved) {
          addPendingTaladro(name);
        } else {
          removePendingTaladro(name);
        }
        setUnsavedTaladrosCount(getUnsavedTaladros().length);
      } else {
        const defaultTal: Taladro = {
          name,
          proyecto: "Proyecto A",
          geologo: "RD/RB",
          diametro: "HQ3",
          inclinacion: -60.0,
          campana: "2026",
          fecha_registro: toLocalDateStr(new Date()),
          collar_este_proyectado: 0,
          collar_norte_proyectado: 0,
          collar_cota_proyectado: 0,
          prof_final_eoh_proyectada: 0,
          comentarios_proyectado: "",
          collar_este: 0,
          collar_norte: 0,
          collar_cota: 0,
          prof_final_eoh: 0,
          comentarios: "",
          turno: "D",
          surveys: [],
          corridas: [],
          discontinuidades: [],
          ensayos_plt: []
        };
        setActiveTaladro(defaultTal);
        setOriginalName(null);
        setDbSnapshotHash(null);
        setDbSnapshotData(null);
        setSyncStatus('unsaved');
        addPendingTaladro(name);
        setUnsavedTaladrosCount(getUnsavedTaladros().length);
      }
      if (shouldSwitchView) {
        setCurrentView('collar');
      }
      setSelectedRowIndex(0);
    } finally {
      setIsLoadingTaladro(false);
    }
  };

  const checkNameExists = useCallback(async (name: string): Promise<boolean> => {
    const clean = name.trim().toUpperCase();
    if (!clean) return false;
    try {
      const res = await fetch(`${API_BASE}/api/taladros/existe?name=${encodeURIComponent(clean)}`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      return !!data.exists;
    } catch (e) {
      return taladros.some(t => t.name.toUpperCase() === clean);
    }
  }, [taladros]);

  const handleCreateTaladro = (newTaladro: Taladro, targetView: string = 'collar') => {
    const cleanName = newTaladro.name.trim().toUpperCase();
    const taladroObj = { ...newTaladro, name: cleanName };

    setCachedTaladro(cleanName, taladroObj);
    addPendingTaladro(cleanName);

    setActiveTaladro(taladroObj);
    setOriginalName(null);
    setDbSnapshotHash(null);
    setDbSnapshotData(null);
    setSyncStatus('unsaved');
    setUnsavedTaladrosCount(getUnsavedTaladros().length);
    setCurrentView(targetView);
  };

  const handleRenameTaladro = async (newName: string) => {
    if (!activeTaladro) return;
    const oldName = activeTaladro.name;
    const trimmedNewName = newName.trim().toUpperCase();
    if (!trimmedNewName || oldName === trimmedNewName) return;

    const isDuplicate = await checkNameExists(trimmedNewName);
    if (isDuplicate) {
      alert(`⚠️ El código de taladro '${trimmedNewName}' ya pertenece a otro sondaje registrado en el proyecto. No se permiten nombres duplicados.`);
      return;
    }

    const updatedTal = { ...activeTaladro, name: trimmedNewName };
    setActiveTaladro(updatedTal);

    setCachedTaladro(trimmedNewName, updatedTal);
    localStorage.removeItem(getTaladroStorageKey(oldName));

    if (isTaladroPending(oldName)) {
      removePendingTaladro(oldName);
      addPendingTaladro(trimmedNewName);
    }
    setUnsavedTaladrosCount(getUnsavedTaladros().length);
  };

  const handleImportExcel = (importedRows: Corrida[], createNewWithName?: string) => {
    if (createNewWithName) {
      const newTal: Taladro = {
        name: createNewWithName.trim().toUpperCase(),
        proyecto: activeTaladro?.proyecto || "Proyecto A",
        geologo: activeTaladro?.geologo || "RD/RB",
        diametro: activeTaladro?.diametro || "HQ3",
        inclinacion: activeTaladro?.inclinacion || -60.0,
        campana: activeTaladro?.campana || "2026",
        fecha_registro: toLocalDateStr(new Date()),
        collar_este_proyectado: 0.0,
        collar_norte_proyectado: 0.0,
        collar_cota_proyectado: 0.0,
        prof_final_eoh_proyectada: 0.0,
        comentarios_proyectado: '',
        collar_este: 0.0,
        collar_norte: 0.0,
        collar_cota: 0.0,
        prof_final_eoh: 0.0,
        comentarios: '',
        turno: activeTaladro?.turno || "D",
        surveys: [],
        corridas: importedRows,
        discontinuidades: [],
        ensayos_plt: []
      };
      handleCreateTaladro(newTal, 'lgg');
    } else {
      handleCorridasChange(importedRows);
    }
  };

  const handleImportBatchExcel = (batchTaladros: { name: string; rows: Corrida[]; isNew: boolean }[]) => {
    if (!batchTaladros || batchTaladros.length === 0) return;

    let lastCreatedOrActiveName = activeTaladro?.name;

    batchTaladros.forEach(item => {
      const trimmedName = item.name.trim().toUpperCase();
      if (!trimmedName) return;

      if (item.isNew) {
        const newTal: Taladro = {
          name: trimmedName,
          proyecto: activeTaladro?.proyecto || "Proyecto A",
          geologo: activeTaladro?.geologo || "RD/RB",
          diametro: activeTaladro?.diametro || "HQ3",
          inclinacion: activeTaladro?.inclinacion || -60.0,
          campana: activeTaladro?.campana || "2026",
          fecha_registro: toLocalDateStr(new Date()),
          collar_este_proyectado: 0.0,
          collar_norte_proyectado: 0.0,
          collar_cota_proyectado: 0.0,
          prof_final_eoh_proyectada: 0.0,
          comentarios_proyectado: '',
          collar_este: 0.0,
          collar_norte: 0.0,
          collar_cota: 0.0,
          prof_final_eoh: 0.0,
          comentarios: '',
          turno: activeTaladro?.turno || "D",
          surveys: [],
          corridas: item.rows,
          discontinuidades: [],
          ensayos_plt: []
        };
        setCachedTaladro(trimmedName, newTal);
        addPendingTaladro(trimmedName);
        lastCreatedOrActiveName = trimmedName;
      } else {
        if (activeTaladro && activeTaladro.name.trim().toUpperCase() === trimmedName) {
          handleCorridasChange(item.rows);
        } else {
          const cachedStr = getCachedTaladroRaw(trimmedName);
          if (cachedStr) {
            try {
              const parsed = JSON.parse(cachedStr);
              parsed.corridas = item.rows;
              setCachedTaladro(trimmedName, parsed);
              addPendingTaladro(trimmedName);
            } catch (e) {}
          }
        }
      }
    });

    setUnsavedTaladrosCount(getUnsavedTaladros().length);

    if (lastCreatedOrActiveName && lastCreatedOrActiveName !== activeTaladro?.name) {
      handleSelectTaladro(lastCreatedOrActiveName, false);
    }
  };

  const handleImportStructExcelData = (importedRows: any[]) => {
    if (!activeTaladro) return;

    const resolvedRows = importedRows.map((row, index) => {
      const depth = parseFloat(row.profundidad) || 0;
      const matchingCorrida = activeTaladro.corridas.find(c => depth >= c.de && depth < c.a) || activeTaladro.corridas.find(c => depth === c.a);

      let de = 0;
      let a = 0;
      let corrida = 0;
      let litologia = '';
      let dureza_pared = row.dureza_pared || '-1';

      if (matchingCorrida) {
        de = matchingCorrida.de;
        a = matchingCorrida.a;
        corrida = matchingCorrida.corrida;
        litologia = (matchingCorrida.lito3 && matchingCorrida.lito3 !== '-1' && matchingCorrida.lito3.trim() !== '')
          ? matchingCorrida.lito3
          : matchingCorrida.lito1;
        dureza_pared = matchingCorrida.resistencia;
      }

      return {
        id: index + 1,
        de,
        a,
        profundidad: depth,
        litologia,
        tipo_estructura: row.tipo_estructura || 'JN',
        alfa: parseFloat(row.alfa) || 0,
        beta: parseFloat(row.beta) || -1,
        forma: parseInt(row.forma) || 4,
        rugosidad: parseInt(row.rugosidad) || 2,
        jrc10: parseInt(row.jrc10) || 10,
        abertura: parseFloat(row.abertura) || 0.1,
        weathering: row.weathering || 'UWF',
        espesor: parseFloat(row.espesor) || 0,
        relleno1: row.relleno1 || 'cwf',
        relleno2: row.relleno2 || '-1',
        dureza_pared,
        agua: row.agua || 'CDC',
        geotecnico: row.geotecnico || activeTaladro.geologo || '',
        comentario: row.comentario || '',
        corrida,
      };
    });

    handleDiscontinuidadesChange(resolvedRows);
  };

  const handleImportPltExcelData = (importedRows: any[]) => {
    if (!activeTaladro) return;

    const cleanNum = (val: any): number => {
      const num = parseFloat(val);
      return isNaN(num) || num === -1 ? 0 : num;
    };

    const resolveIsrmIndex = (ucs: number): string => {
      if (ucs <= 0.25) return "Suelo";
      if (ucs <= 1.0) return "R0";
      if (ucs <= 5.0) return "R1";
      if (ucs <= 25.0) return "R2";
      if (ucs <= 50.0) return "R3";
      if (ucs <= 100.0) return "R4";
      if (ucs <= 250.0) return "R5";
      return "R6";
    };

    const resolvedRows = importedRows.map((r, index) => {
      const from = parseFloat(r.from_m) || 0;
      const to = parseFloat(r.to_m) || 0;

      // Cruce espacial para ubicar la corrida correspondiente de LGG
      const match = activeTaladro.corridas.find(c => c.de <= from && to <= c.a);

      let c_desde = r.corrida_desde !== undefined ? parseFloat(r.corrida_desde) || 0 : 0;
      let c_hasta = r.corrida_hasta !== undefined ? parseFloat(r.corrida_hasta) || 0 : 0;

      // AUTOCOMPLETADO GEOLÃ“GICO:
      // Se ignoran datos externos y se extrae la informaciÃ³n del taladro actual
      let lito1 = 'MZB';
      let lito2 = '-';
      let lito3 = '-';

      if (match) {
        c_desde = match.de;
        c_hasta = match.a;
        lito1 = match.lito1;
        lito2 = (match.lito2 === "-1" || !match.lito2) ? "-" : match.lito2;
        lito3 = (match.lito3 === "-1" || !match.lito3) ? "-" : match.lito3;
      }

      // Se ejecuta la resoluciÃ³n en cascada geomecÃ¡nica oficial
      const resCascade = resolveLithologyCascade(
        lito1,
        lito2,
        lito3,
        'litologia_1',
        lito1
      );

      const resolvedLito1 = resCascade.lito1;
      const resolvedLito2 = resCascade.lito2 === "-" ? "-1" : resCascade.lito2;
      const resolvedLito3 = resCascade.lito3 === "-" ? "-1" : resCascade.lito3;
      const tipo_litologico = resCascade.clase;
      const factor_k = resCascade.k;

      const d = cleanNum(r.d_mm);
      const p = cleanNum(r.p_instr_kn);
      const long_muestra = parseFloat(((to - from) * 1000).toFixed(1));
      const long_corrida = parseFloat((c_hasta - c_desde).toFixed(2));

      const verif_de_longitud = (long_muestra > d && d > 0) ? "OK" : "Error";
      const verif_corrida = (c_desde <= from && from <= to && to <= c_hasta) ? "OK" : "Error";

      let is_mpa = 0;
      let fact_corr = 0;
      let is_50_mpa = 0;
      let ucs = 0;
      let isrm_indice_r = 'R0';

      if (d > 0 && p > 0) {
        const is_raw = (p * 1000) / (d * d);
        const fact_corr_raw = Math.pow(d / 50.0, 0.45);
        const is_50_raw = is_raw * fact_corr_raw;
        const ucs_raw = is_50_raw * factor_k;

        is_mpa = parseFloat(is_raw.toFixed(2));
        fact_corr = parseFloat(fact_corr_raw.toFixed(3));
        is_50_mpa = parseFloat(is_50_raw.toFixed(2));
        ucs = parseFloat(ucs_raw.toFixed(2));
        isrm_indice_r = resolveIsrmIndex(ucs);
      }

      return {
        fecha: r.fecha || toLocalDateStr(new Date()),
        nro_muestra: r.nro_muestra || `M${(index + 1).toString().padStart(2, '0')}`,
        nro_caja: parseInt(r.nro_caja) || 1,
        from_m: from,
        to_m: to,
        verif_corrida,
        long_de_corrida_m: long_corrida,
        este_m: parseFloat(r.este_m) || activeTaladro.collar_este || 0.0,
        norte_m: parseFloat(r.norte_m) || activeTaladro.collar_norte || 0.0,
        elevacion_msnm: parseFloat(r.elevacion_msnm) || activeTaladro.collar_cota || 0.0,
        long_de_muestra_mm: long_muestra,
        tipo_de_ensayo: r.tipo_de_ensayo || 'D',
        diametro_taladro_nominacion: r.diametro_taladro_nominacion || 'HQ',
        litologia_1: resolvedLito1,
        litologia_2: resolvedLito2,
        litologia_3: resolvedLito3,
        tipo_litologico,
        d_mm: d,
        verif_de_longitud,
        p_instr_kn: p,
        tipo_rotura_code: r.tipo_rotura_code || 'M',
        direccion_rotura_code: r.direccion_rotura_code || 'NA',
        ejecutadoPor: r.ejecutadoPor || 'CBA',
        is_mpa,
        fact_corr,
        is_50_mpa,
        factor_k,
        ucs,
        isrm_indice_r,
        observaciones: r.observaciones || '',
        corrida_desde: c_desde,
        corrida_hasta: c_hasta
      };
    });

    handleEnsayosPltChange(resolvedRows);
  };

  const handleDeleteTaladro = async (name: string) => {
    const isPureLocal = !localStorage.getItem(getSnapshotStorageKey(name));
    const confirmMsg = isPureLocal
      ? `¿Está seguro de que desea descartar el borrador local ${name}?`
      : `¿Está seguro de que desea eliminar permanentemente el taladro ${name}? Se borrará de la base de datos.`;

    if (!confirm(confirmMsg)) {
      return;
    }

    if (isPureLocal) {
      discardLocalTaladro(name);
      const updatedSummaries = taladros.filter(t => t.name !== name);
      setTaladros(updatedSummaries);
      safeSetItem('geolog_taladros_summaries', JSON.stringify(updatedSummaries));

      if (activeTaladro?.name === name) {
        setActiveTaladro(null);
        setDbSnapshotHash(null);
        setDbSnapshotData(null);
      }
      setUnsavedTaladrosCount(getUnsavedTaladros().length);
      setCurrentView('dashboard');
      fetchTaladros(page, activeDateRange, searchTerm, isGlobalSearch, advancedFilters);
      return;
    }

    setSyncStatus('saving');
    const updatedSummaries = taladros.filter(t => t.name !== name);
    safeSetItem('geolog_taladros_summaries', JSON.stringify(updatedSummaries));
    evictTaladro(name);
    removePendingTaladro(name);
    setUnsavedTaladrosCount(getUnsavedTaladros().length);

    try {
      const res = await fetch(`${API_BASE}/api/taladros/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSyncStatus('synced');
        setSyncMessage(`Taladro ${name} eliminado con éxito del servidor.`);
      } else {
        throw new Error("HTTP " + res.status);
      }
    } catch (e) {
      setSyncStatus('offline');
      setSyncMessage(`Taladro ${name} eliminado localmente.`);
    }

    if (activeTaladro?.name === name) {
      setActiveTaladro(null);
      setDbSnapshotHash(null);
      setDbSnapshotData(null);
    }
    setCurrentView('dashboard');
    fetchTaladros(page, activeDateRange, searchTerm, isGlobalSearch, advancedFilters);
  };

  const handleSaveActive = async () => {
    if (!activeTaladro) return;

    // QA/QC Validation check before saving
    const mandatoryErrors = validateLogueoMandatory(activeTaladro);
    if (mandatoryErrors.length > 0) {
      setSaveResultModal({
        show: true,
        success: false,
        message: `No se puede guardar ${activeTaladro.name}: existen ${mandatoryErrors.length} campos obligatorios vacíos.`,
        details: mandatoryErrors.map(e => `${e.fieldLabel || e.fieldKey}: ${e.message}`).join('\n')
      });
      return;
    }

    // Name collision check if renaming
    if (originalName && originalName !== activeTaladro.name) {
      const check = await verifyTaladroNameCollisions([activeTaladro.name], API_BASE, taladros.map(t => t.name));
      if (!check.ok) {
        setSaveResultModal({
          show: true,
          success: false,
          message: `No se puede guardar: el código de taladro '${activeTaladro.name}' ya existe en el proyecto.`
        });
        return;
      }
    }

    setSyncStatus('saving');
    setSyncMessage("Sincronizando con SQL Server...");

    // 1. Actualizar localStorage como respaldo seguro con safeSetItem
    setCachedTaladro(activeTaladro.name, activeTaladro);

    // 2. Actualizar summaries
    const summaryIndex = taladros.findIndex(t => t.name === activeTaladro.name);
    if (summaryIndex !== -1) {
      const updatedSummaries = [...taladros];
      updatedSummaries[summaryIndex] = {
        ...updatedSummaries[summaryIndex],
        corridas_count: activeTaladro.corridas.length,
        surveys_count: activeTaladro.surveys.length
      };
      safeSetItem('geolog_taladros_summaries', JSON.stringify(updatedSummaries));
    }

    try {
      // 3. POST atómico al backend (todo o nada)
      const res = await fetch(`${API_BASE}/api/taladros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeTaladro)
      });

      if (res.ok) {
        // 4. Si hubo rename, borrar el viejo en BD y en localStorage
        if (originalName && originalName !== activeTaladro.name) {
          try {
            await fetch(`${API_BASE}/api/taladros/${encodeURIComponent(originalName)}`, { method: 'DELETE' });
          } catch (delErr) {
            console.error("Failed to delete old taladro after rename:", delErr);
          }
          discardLocalTaladro(originalName);
        }

        // 5. Calcular auditoría de cambios
        const diffSummary = computeTaladroDiff(dbSnapshotData, activeTaladro);

        // 6. Actualizar snapshot hash y snapshot data
        const newSnapshot = JSON.parse(JSON.stringify(activeTaladro));
        const newHash = computeTaladroHash(activeTaladro);
        setDbSnapshotData(newSnapshot);
        setDbSnapshotHash(newHash);
        setCachedSnapshotData(activeTaladro.name, newSnapshot);
        setCachedSnapshotHash(activeTaladro.name, newHash);
        setOriginalName(activeTaladro.name);
        setSyncStatus('synced');
        removePendingTaladro(activeTaladro.name);
        setUnsavedTaladrosCount(getUnsavedTaladros().length);
        setSyncMessage("Cambios guardados y auditados con éxito en SQL Server.");

        // 7. Modal de éxito con reporte de auditoría
        setSaveResultModal({
          show: true,
          success: true,
          message: diffSummary.isNewTaladro
            ? `Nuevo taladro ${activeTaladro.name} creado con éxito en SQL Server.`
            : `Sincronización completada para ${activeTaladro.name}.`,
          diffSummary
        });

        // Refetch de la página actual
        fetchTaladros(page, activeDateRange, searchTerm, isGlobalSearch, advancedFilters);
      } else {
        const errorData = await res.json().catch(() => ({ detail: "Error interno del servidor." }));
        const detail = errorData.detail || "Error de consistencia o restricciones en la base de datos.";
        setSyncStatus('unsaved');
        setSyncMessage(`Fallo al guardar: ${detail}`);
        setSaveResultModal({
          show: true,
          success: false,
          message: `No se pudo guardar el taladro ${activeTaladro.name}. Ningún registro fue modificado en la base de datos.`,
          details: detail
        });
      }
    } catch (e) {
      setSyncStatus('unsaved');
      setSyncMessage("Sin conexión con el servidor.");
      setSaveResultModal({
        show: true,
        success: false,
        message: `No se pudo establecer conexión con el servidor de base de datos.`,
        details: "Verifique que el backend esté corriendo y que la red esté disponible. Sus datos están preservados en almacenamiento local."
      });
    }
  };

  // ─── MANEJADOR DE CONFIRMACIÓN DE GUARDADO (DESDE MODAL) ─────────────────────
  const handleConfirmSave = async (scope: 'active' | 'all' = 'active') => {
    setShowSaveConfirmModal(false);
    setIsLoadingTaladro(true);

    try {
      if (scope === 'all') {
        let unsavedNames = getUnsavedTaladros();
        if (activeTaladro && !unsavedNames.includes(activeTaladro.name)) {
          unsavedNames.push(activeTaladro.name);
        }

        if (unsavedNames.length === 0) {
          setIsLoadingTaladro(false);
          return;
        }

        setSyncStatus('saving');
        setSyncMessage(`Sincronizando ${unsavedNames.length} sondajes con SQL Server...`);

        let savedCount = 0;
        let errorsCount = 0;

        for (const name of unsavedNames) {
          let taladroData: Taladro | null = (activeTaladro && activeTaladro.name === name) ? activeTaladro : null;
          if (!taladroData) {
            const cachedStr = getCachedTaladroRaw(name);
            if (cachedStr) {
              try {
                taladroData = JSON.parse(cachedStr);
              } catch (err) {}
            }
          }

          if (taladroData) {
            // Verificar obligatorios
            const mandatory = validateLogueoMandatory(taladroData);
            if (mandatory.length > 0) {
              errorsCount++;
              continue;
            }

            try {
              const res = await fetch(`${API_BASE}/api/taladros`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taladroData)
              });
              if (res.ok) {
                savedCount++;
                removePendingTaladro(name);
                const dbSnapshot = JSON.parse(JSON.stringify(taladroData));
                const dbHash = computeTaladroHash(taladroData);
                setCachedSnapshotData(name, dbSnapshot);
                setCachedSnapshotHash(name, dbHash);
              } else {
                errorsCount++;
              }
            } catch (e) {
              errorsCount++;
            }
          }
        }

        if (activeTaladro && isTaladroPending(activeTaladro.name) === false) {
          const newHash = computeTaladroHash(activeTaladro);
          setDbSnapshotData(JSON.parse(JSON.stringify(activeTaladro)));
          setDbSnapshotHash(newHash);
          setSyncStatus('synced');
        }
        setUnsavedTaladrosCount(getUnsavedTaladros().length);

        setSaveResultModal({
          show: true,
          success: errorsCount === 0,
          message: errorsCount === 0
            ? `Se guardaron exitosamente ${savedCount} sondaje(s) en SQL Server.`
            : `Sincronización parcial: ${savedCount} guardados, ${errorsCount} con errores.`
        });
        fetchTaladros(page, activeDateRange, searchTerm, isGlobalSearch, advancedFilters);
      } else {
        await handleSaveActive();
      }
    } finally {
      setIsLoadingTaladro(false);
    }
  };

  // ─── DESCARTAR CAMBIOS NO GUARDADOS (REVERT A BASELINE DE BD) ────────────────
  const handleConfirmDiscard = (scope: 'active' | 'all' = 'active') => {
    setShowDiscardModal(false);
    if (scope === 'all') {
      const unsavedNames = getUnsavedTaladros();
      for (const name of unsavedNames) {
        const snapRaw = localStorage.getItem(getSnapshotStorageKey(name));
        if (snapRaw) {
          try {
            const parsedSnap = JSON.parse(snapRaw);
            const snapHash = computeTaladroHash(parsedSnap);
            setCachedTaladro(name, parsedSnap);
            setCachedSnapshotData(name, parsedSnap);
            setCachedSnapshotHash(name, snapHash);
            removePendingTaladro(name);
            clearTaladroValidation(name);
            if (activeTaladro && activeTaladro.name.trim().toUpperCase() === name.trim().toUpperCase()) {
              setActiveTaladro(parsedSnap);
              setDbSnapshotData(parsedSnap);
              setDbSnapshotHash(snapHash);
            }
          } catch (e) {
            discardLocalTaladro(name);
          }
        } else {
          discardLocalTaladro(name);
          if (activeTaladro && activeTaladro.name.trim().toUpperCase() === name.trim().toUpperCase()) {
            setActiveTaladro(null);
            setDbSnapshotHash(null);
            setDbSnapshotData(null);
            setCurrentView('dashboard');
          }
        }
      }
      setUnsavedTaladrosCount(0);
      setSyncStatus('synced');
      setSyncMessage("Todos los cambios no guardados han sido descartados.");
      fetchTaladros(page, activeDateRange, searchTerm, isGlobalSearch, advancedFilters);
    } else {
      if (!activeTaladro) return;
      const name = activeTaladro.name;

      let snap = dbSnapshotData;
      if (!snap) {
        try {
          const snapRaw = localStorage.getItem(getSnapshotStorageKey(name));
          if (snapRaw) snap = JSON.parse(snapRaw);
        } catch (e) {}
      }

      const isFromDb = taladros.some(t => t.name.trim().toUpperCase() === name.trim().toUpperCase());
      if (isFromDb && !snap) {
        // Fallback para taladros de BD: recargar versión original sin deseleccionar
        handleSelectTaladro(name, false);
        return;
      }

      if (snap) {
        const restored = JSON.parse(JSON.stringify(snap));
        const restoredHash = computeTaladroHash(restored);
        setActiveTaladro(restored);
        setDbSnapshotData(restored);
        setDbSnapshotHash(restoredHash);
        setCachedTaladro(name, restored);
        setCachedSnapshotData(name, restored);
        setCachedSnapshotHash(name, restoredHash);
        removePendingTaladro(name);
        clearTaladroValidation(name);
        setSyncStatus('synced');
        setSyncMessage(`Cambios descartados. Se restauró la versión de la base de datos para ${name}.`);
      } else {
        discardLocalTaladro(name);
        setActiveTaladro(null);
        setDbSnapshotHash(null);
        setDbSnapshotData(null);
        setCurrentView('dashboard');
        setSyncMessage(`Taladro borrador ${name} descartado.`);
      }
      setUnsavedTaladrosCount(getUnsavedTaladros().length);
    }
  };

  // ─── DIRTY STATE DETECTION CON SNAPSHOT HASH (debounced 300ms) ───────────────
  useEffect(() => {
    if (!activeTaladro) {
      setSyncStatus('synced');
      return;
    }
    if (syncStatus === 'saving') return;

    // Si el taladro nunca ha estado en BD (borrador puro sin snapshot), siempre es dirty
    if (dbSnapshotHash === null) {
      const isKnownInDb = taladros.some(t => t.name.trim().toUpperCase() === activeTaladro.name.trim().toUpperCase());
      const hasDbSnapshot = !!localStorage.getItem(getSnapshotStorageKey(activeTaladro.name));
      if (!isKnownInDb && !hasDbSnapshot) {
        setSyncStatus('unsaved');
        addPendingTaladro(activeTaladro.name);
        setUnsavedTaladrosCount(getUnsavedTaladros().length);
      }
      return;
    }

    const timer = setTimeout(() => {
      const currentHash = computeTaladroHash(activeTaladro);
      const isDirty = String(currentHash) !== String(dbSnapshotHash);
      setSyncStatus(isDirty ? 'unsaved' : 'synced');
      if (isDirty) {
        addPendingTaladro(activeTaladro.name);
      } else {
        removePendingTaladro(activeTaladro.name);
      }
      setUnsavedTaladrosCount(getUnsavedTaladros().length);
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTaladro, dbSnapshotHash, taladros]);

  // ─── AUTO-SAVE A LOCALSTORAGE (debounced 1s) ─────────────────────────────────
  useEffect(() => {
    if (!activeTaladro) return;
    const timer = setTimeout(() => {
      setCachedTaladro(activeTaladro.name, activeTaladro);
    }, 1000);
    return () => clearTimeout(timer);
  }, [activeTaladro]);

  // ─── VALIDACIÓN QA/QC CON DEBOUNCE (750ms) ──────────────────────────────────

  const [validationSnapshot, setValidationSnapshot] = useState<typeof activeTaladro>(null);

  useEffect(() => {
    if (!activeTaladro) {
      setValidationSnapshot(null);
      return;
    }
    const timer = setTimeout(() => {
      setValidationSnapshot(activeTaladro);
    }, 750);
    return () => clearTimeout(timer);
  }, [activeTaladro]);

  // Re-render de validaciones cuando se marca un campo como "tocado" (blur)
  const [touchedTick, setTouchedTick] = useState(0);
  useEffect(() => {
    return subscribeTouched(() => setTouchedTick(t => t + 1));
  }, []);

  // Resetear el registro de campos "tocados" al cambiar de taladro activo
  useEffect(() => {
    resetTouchedFields();
  }, [activeTaladro?.name]);

  const activeAlerts = useMemo((): QaQcAlert[] => {
    if (!validationSnapshot) return [];

    // Motor QA/QC SSOT (misma arquitectura que GEMA-Mapeo)
    const qaqc = validateLogueoQAQC(
      validationSnapshot,
      validationSnapshot.surveys || [],
      validationSnapshot.corridas || [],
      validationSnapshot.discontinuidades || [],
      validationSnapshot.ensayos_plt || [],
      true // evaluateAll: siempre evaluar todo (red de seguridad)
    );
    // Campos obligatorios (VACIO) â€” filas vacantes ignoradas
    const vacios = toVacioAlerts(validateLogueoMandatory(validationSnapshot));
    return [...qaqc, ...vacios];
  }, [validationSnapshot, touchedTick]);

  // Mapped field focusing logic from ValidationPanel
  const handleFocusField = (fieldId: string) => {
    // 1. Redireccionar de inmediato a la pestaÃ±a destino
    let targetView = 'lgg';
    let idPrefix = 'lgg-cell';
    const isStruct = fieldId.startsWith('struct-');
    const isPlt = fieldId.startsWith('plt-');

    if (fieldId.startsWith('survey-') || fieldId.startsWith('collar-') || fieldId.startsWith('header-')) {
      targetView = 'collar';
    } else if (fieldId.endsWith('-input') || fieldId === 'input-sondaje-name') {
      targetView = 'collar';
    } else if (isStruct) {
      targetView = 'lgest';
      idPrefix = 'struct-cell';
    } else if (isPlt) {
      targetView = 'reports_plt';
      idPrefix = 'plt-cell';
    }

    setCurrentView(targetView);

    // 2. Extraer Ã­ndice y campo de forma genÃ©rica (ej. "plt-from_m-12" -> index: 12, fieldName: "from_m")
    const parts = fieldId.split('-');
    let index: number | null = null;
    let fieldName = '';

    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      const parsedIndex = parseInt(lastPart, 10);

      if (!isNaN(parsedIndex)) {
        index = parsedIndex;
        if (isStruct || isPlt || fieldId.startsWith('survey-')) {
          fieldName = parts[1]; // e.g. "profundidad", "from_m"
        } else {
          fieldName = parts[0]; // e.g. "de", "rec_m" (LGG)
        }
      }
    }

    // Sincronizar la selecciÃ³n global de fila de inmediato para habilitar los inputs correspondientes
    if (index !== null) {
      setSelectedRowIndex(index);
    }

    // 3. Esperar renderizado y enfocar el ID estandarizado
    setTimeout(() => {
      let element = document.getElementById(`${idPrefix}-${index}-${fieldName}`)
        || document.getElementById(fieldId);

      if (element) {
        // Scroll centrado suave y foco sin salto brusco
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        element.focus({ preventScroll: true });
        if (element.tagName === 'INPUT') (element as HTMLInputElement).select();
      } else if (index !== null) {
        // Si el input no existe (modo lectura), pulsamos su celda TD para activarlo
        const tdElement = document.getElementById(`${idPrefix}-td-${index}-${fieldName}`);
        if (tdElement) {
          tdElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          tdElement.click(); // Activa la fila y enfoca automÃ¡ticamente
        }
      }
    }, 100);
  };

  const handleCollarChange = (updatedCollar: Collar) => {
    if (!activeTaladro) return;
    const oldName = activeTaladro.name;
    const newName = updatedCollar.name.trim().toUpperCase();

    if (oldName !== newName && newName.length > 0) {
      // Siempre usar activeTaladro como base (estado mÃ¡s reciente en RAM)
      // NUNCA usar datos del cache localStorage que pueden estar desactualizados
      const updatedTal = { ...activeTaladro, ...updatedCollar, name: newName };
      localStorage.setItem(`geolog_taladro_${newName}`, JSON.stringify(updatedTal));
      localStorage.removeItem(`geolog_taladro_${oldName}`);

      const updatedSummaries = taladros.map(t => {
        if (t.name === oldName) {
          return {
            ...t,
            name: newName,
            proyecto: updatedCollar.proyecto,
            geologo: updatedCollar.geologo,
            diametro: updatedCollar.diametro,
            inclinacion: updatedCollar.inclinacion
          };
        }
        return t;
      });
      setTaladros(updatedSummaries);
      localStorage.setItem('geolog_taladros_summaries', JSON.stringify(updatedSummaries));

      setActiveTaladro(updatedTal);
      // Dirty state se recalcula automÃ¡ticamente por el useEffect de hash
    } else {
      setActiveTaladro({
        ...activeTaladro,
        ...updatedCollar
      });
      // Dirty state se recalcula automÃ¡ticamente por el useEffect de hash
    }
  };

  const handleSurveysChange = (updatedSurveys: Survey[]) => {
    if (!activeTaladro) return;
    if (activeTaladro.surveys === updatedSurveys) return; // ComparaciÃ³n por referencia O(1)
    setActiveTaladro({ ...activeTaladro, surveys: updatedSurveys });
  };

  const handleCorridasChange = (updatedCorridas: Corrida[]) => {
    if (!activeTaladro) return;
    if (activeTaladro.corridas === updatedCorridas) return; // ComparaciÃ³n por referencia O(1)

    // Auto-update structural discontinuities on depth changes
    const updatedDiscs = activeTaladro.discontinuidades.map(disc => {
      const match = updatedCorridas.find(c => disc.profundidad >= c.de && disc.profundidad <= c.a);
      if (match) {
        return {
          ...disc,
          de: match.de,
          a: match.a,
          corrida: match.corrida,
          litologia: match.lito1,
          dureza_pared: match.resistencia
        };
      }
      return disc;
    });

    setActiveTaladro({
      ...activeTaladro,
      corridas: updatedCorridas,
      discontinuidades: updatedDiscs
    });
  };

  const handleDiscontinuidadesChange = (updatedDiscs: Discontinuidad[]) => {
    if (!activeTaladro) return;
    if (activeTaladro.discontinuidades === updatedDiscs) return; // ComparaciÃ³n por referencia O(1)
    setActiveTaladro({ ...activeTaladro, discontinuidades: updatedDiscs });
  };

  const handleEnsayosPltChange = (updatedPlts: EnsayoPlt[]) => {
    if (!activeTaladro) return;
    if (activeTaladro.ensayos_plt === updatedPlts) return; // ComparaciÃ³n por referencia O(1)
    setActiveTaladro({ ...activeTaladro, ensayos_plt: updatedPlts });
  };



  return (
    <div className="flex h-screen overflow-hidden text-slate-200 bg-navy-950 font-sans">

      {/* Sidebar Panel */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
        <Sidebar
          currentView={currentView}
          onViewChange={(view) => {
            if (view === 'catalogos') {
              setShowCatalogsModal(true);
            } else if (view === 'formulas') {
              setShowFormulasModal(true);
            } else {
              setCurrentView(view);
            }
          }}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          selectedTaladro={activeTaladro ? activeTaladro.name : null}
          activeTaladroObj={activeTaladro}
          hasUnsavedChanges={syncStatus === 'unsaved'}
          onClearActiveTaladro={() => {
            setActiveTaladro(null);
            setCurrentView('dashboard');
          }}
        />
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <Topbar
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          activeTaladro={activeTaladro}
          currentView={currentView}
          syncStatus={syncStatus}
          syncMessage={syncMessage}
          unsavedCount={unsavedTaladrosCount}
          handleSaveActive={() => setShowSaveConfirmModal(true)}
          onDiscardClick={() => setShowDiscardModal(true)}
          setActiveTaladro={setActiveTaladro}
          setCurrentView={setCurrentView}
          onOpenCatalogs={() => setShowCatalogsModal(true)}
        />

        {/* Screen Content Wrapper - Cambiado a overflow-hidden porque los scrolls se manejan internamente */}
        <div className="flex-1 p-6 relative flex flex-col overflow-hidden">

          {/* 1. Dashboard Principal (Solo se desmonta si no hay taladro activo) */}
          {(!activeTaladro || currentView === 'dashboard') && (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              <MainDashboard
                taladros={paginatedTaladros}
                kpis={computedDashboardKpis}
                page={page}
                pageSize={pageSize}
                totalFiltered={totalFilteredTaladros}
                totalPages={totalDashboardPages}
                loading={dashboardLoading}
                searchTerm={searchTerm}
                isGlobalSearch={isGlobalSearch}
                activeDateRange={activeDateRange}
                onSearchSubmit={handleSearchSubmit}
                onClearSearch={handleClearSearch}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onFilterChange={handleFilterChange}
                onAdvancedFiltersChange={handleAdvancedFiltersChange}
                advancedFilters={advancedFilters}
                onSelectTaladro={handleSelectTaladro}
                onCreateTaladro={handleCreateTaladro}
                onDeleteTaladro={handleDeleteTaladro}
                availableCampanas={availableCampanas}
                pendingTaladros={pendingTaladroSummaries}
                pendingTaladroNames={pendingTaladroNames}
              />
            </div>
          )}

          {/* 2. VISTAS CORE EN MODO KEEP-ALIVE (Toggles CSS instantÃ¡neos sin desmontar DOM) */}
          {activeTaladro && (
            <>
              {/* Vista Collar y Survey */}
              <div className={currentView === 'collar' ? "flex-1 flex flex-col min-h-0 overflow-y-auto" : "hidden"}>
                <CollarView
                  collar={activeTaladro}
                  surveys={activeTaladro.surveys}
                  alerts={activeAlerts}
                  onCollarChange={handleCollarChange}
                  onSurveysChange={handleSurveysChange}
                  existingTaladrosNames={taladros.map(t => t.name)}
                  checkNameExists={checkNameExists}
                  availableCampanas={availableCampanas}
                />
              </div>

              {/* Vista Logueo GeotÃ©cnico General (LGG) */}
              <div className={currentView === 'lgg' ? "flex-1 flex flex-col min-h-0" : "hidden"}>
                <LggView
                  corridas={activeTaladro.corridas}
                  alerts={activeAlerts}
                  onCorridasChange={handleCorridasChange}
                  selectedRowIndex={selectedRowIndex}
                  onSelectRow={setSelectedRowIndex}
                  waterTableM={97.0}
                  darkMode={darkMode}
                  activeTaladroName={activeTaladro.name}
                  existingTaladrosNames={taladros.map(t => t.name)}
                  checkNameExists={checkNameExists}
                  activeTaladroGeologo={activeTaladro.geologo}
                  activeTaladroFecha={activeTaladro.fecha_registro}
                  sidebarCollapsed={sidebarCollapsed}
                  onFocusField={handleFocusField}
                  onCreateTaladro={(newTal) => handleCreateTaladro(newTal, 'lgg')}
                  onRenameTaladro={handleRenameTaladro}
                  onImportExcel={handleImportExcel}
                  onImportBatchExcel={handleImportBatchExcel}
                  syncStatus={syncStatus}
                  defaultTurno={activeTaladro.turno}
                />
              </div>

              {/* Vista Logueo Estructural */}
              <div className={currentView === 'lgest' ? "flex-1 flex flex-col min-h-0" : "hidden"}>
                <StructuralView
                  discontinuidades={activeTaladro.discontinuidades}
                  corridas={activeTaladro.corridas}
                  onDiscontinuidadesChange={handleDiscontinuidadesChange}
                  geologo={activeTaladro.geologo}
                  activeTaladroName={activeTaladro.name}
                  alerts={activeAlerts}
                  onImportExcel={handleImportStructExcelData}
                  darkMode={darkMode}
                  sidebarCollapsed={sidebarCollapsed}
                  onFocusField={handleFocusField}
                  // --- MEJORA: Sincronizar selecciÃ³n de fila con App.tsx ---
                  selectedRowIndex={selectedRowIndex}
                  onSelectRow={setSelectedRowIndex}
                />
              </div>

              {/* Vista Ensayos PLT */}
              <div className={currentView === 'reports_plt' ? "flex-1 flex flex-col min-h-0" : "hidden"}>
                <PltView
                  ensayos_plt={activeTaladro.ensayos_plt || []}
                  onEnsayosPltChange={handleEnsayosPltChange}
                  corridas={activeTaladro.corridas}
                  collar={activeTaladro}
                  alerts={activeAlerts}
                  onImportExcel={handleImportPltExcelData}
                  darkMode={darkMode}
                  // --- MEJORA: Sincronizar selecciÃ³n de fila con App.tsx ---
                  selectedRowIndex={selectedRowIndex}
                  onSelectRow={setSelectedRowIndex}
                />
              </div>
            </>
          )}

          {/* 3. VISTAS LIGERAS CONDICIONALES (Se montan bajo demanda) */}
          {activeTaladro && currentView === 'rmr' && (
            <div className={currentView === 'rmr' ? "flex-1 flex flex-col min-h-0" : "hidden"}>
              <RmrAnalysis
                corridas={activeTaladro.corridas}
                waterTableM={97.0}
                activeTaladroName={activeTaladro.name}
                geologo={activeTaladro.geologo}
                fecha={activeTaladro.fecha_registro}
              />
            </div>
          )}

          {activeTaladro && currentView === 'dashboard_rqd' && (
            <div className="flex-1 overflow-y-auto">
              <RqdDashboard
                activeTaladro={activeTaladro}
                taladros={taladros}
                onSelectTaladro={(name) => handleSelectTaladro(name, false)}
              />
            </div>
          )}

          {activeTaladro && currentView === 'reports_pdf' && (
            <div className="flex-1 overflow-y-auto">
              <ReportsPdf
                activeTaladro={activeTaladro}
                taladros={taladros}
                onSelectTaladro={(name) => handleSelectTaladro(name, false)}
              />
            </div>
          )}

          {activeTaladro && currentView === 'config' && (
            <div className="flex-1 overflow-y-auto">
              <div className="glass-panel p-6 rounded-xl border border-navy-800 space-y-4 max-w-xl mx-auto text-slate-300">
                <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wide border-b border-navy-800 pb-2">
                  ConfiguraciÃ³n de ParÃ¡metros
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-navy-900/60">
                    <span>CampaÃ±a</span>
                    <input
                      type="text"
                      value={activeTaladro.campana}
                      onChange={(e) => handleCollarChange({ ...activeTaladro, campana: e.target.value })}
                      className="bg-navy-900 border border-navy-700 rounded px-2.5 py-1 text-center w-32 text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-navy-900/60">
                    <span>Turno Predeterminado</span>
                    <select
                      value={activeTaladro.turno}
                      onChange={(e) => handleCollarChange({ ...activeTaladro, turno: e.target.value })}
                      className="bg-navy-900 border border-navy-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
                    >
                      <option value="D">DÃ­a</option>
                      <option value="N">Noche</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span>DiÃ¡metro Predeterminado</span>
                    <select
                      value={activeTaladro.diametro}
                      onChange={(e) => handleCollarChange({ ...activeTaladro, diametro: e.target.value })}
                      className="bg-navy-900 border border-navy-700 rounded px-2 py-1 text-slate-200 focus:outline-none"
                    >
                      <option value="HQ3">HQ3</option>
                      <option value="NQ3">NQ3</option>
                      <option value="PQ3">PQ3</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'revision' && (
            <div className="flex-1 overflow-y-auto">
              <AuditoriaHub apiBase={API_BASE} />
            </div>
          )}

          {activeTaladro && currentView === 'import' && (
            <div className="flex-1 overflow-y-auto">
              <div className="glass-panel p-8 rounded-xl border border-navy-800 space-y-6 max-w-2xl mx-auto text-center text-slate-300 shadow-2xl relative overflow-hidden backdrop-blur-md">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-500" />
                <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 dark:text-cyan-400 flex items-center justify-center mx-auto ring-4 ring-blue-500/5 animate-pulse">
                  <Database size={32} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">
                    ImportaciÃ³n y ExportaciÃ³n de Datos
                  </h2>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
                    <Construction size={12} className="animate-spin" />
                    MÃ³dulo En Progreso / In Progress
                  </div>
                </div>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Este mÃ³dulo facilitarÃ¡ la importaciÃ³n directa de datos histÃ³ricos en formato BCP y la exportaciÃ³n unificada de registros a plantillas estructuradas de geotecnia minera para software especializado como <span className="text-slate-200 font-semibold">Leapfrog</span>, <span className="text-slate-200 font-semibold">gINT</span> y <span className="text-slate-200 font-semibold">Vulcan</span>.
                </p>
                <div className="pt-4 border-t border-navy-800/60 max-w-md mx-auto">
                  <p className="text-xs text-slate-500">
                    La conexiÃ³n duplicada con SQL Server local se encuentra activa. Las rutinas de persistencia normalizadas ya estÃ¡n preparadas en el backend API.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating validation QA/QC panel (handles its own positioning left/right) â€” hidden on Carga para RevisiÃ³n */}
        {activeTaladro && currentView !== 'revision' && (
          <ValidationPanel
            alerts={activeAlerts}
            onFocusField={handleFocusField}
          />
        )}

      </main>

      {/* Catalogs Modal Overlay */}
      <CatalogsModal
        isOpen={showCatalogsModal}
        onClose={() => setShowCatalogsModal(false)}
      />

      {/* Formulas Modal Overlay */}
      <FormulasModal
        isOpen={showFormulasModal}
        onClose={() => setShowFormulasModal(false)}
      />

      {/* Modal de resultado de guardado */}
      <SaveResultModal
        show={saveResultModal.show}
        success={saveResultModal.success}
        message={saveResultModal.message}
        details={saveResultModal.details}
        diffSummary={saveResultModal.diffSummary}
        activeTaladroName={activeTaladro?.name}
        onClose={() => setSaveResultModal({ show: false, success: false, message: '' })}
      />

      {/* Modal para descartar cambios no guardados */}
      <DiscardModal
        show={showDiscardModal}
        activeTaladroName={activeTaladro?.name || ''}
        activeDiffSummary={showDiscardModal && activeTaladro ? computeTaladroDiff(dbSnapshotData, activeTaladro) : null}
        allDiffSummary={showDiscardModal ? computeAllTaladrosDiff(activeTaladro, dbSnapshotData) : null}
        onConfirm={handleConfirmDiscard}
        onClose={() => setShowDiscardModal(false)}
      />

      {/* Modal de pre-confirmaciÃ³n de guardado */}
      <SaveConfirmModal
        show={showSaveConfirmModal}
        activeTaladroName={activeTaladro?.name || ''}
        activeTaladro={showSaveConfirmModal ? activeTaladro : null}
        activeDiffSummary={showSaveConfirmModal && activeTaladro ? computeTaladroDiff(dbSnapshotData, activeTaladro) : null}
        allDiffSummary={showSaveConfirmModal ? computeAllTaladrosDiff(activeTaladro, dbSnapshotData) : null}
        onConfirm={handleConfirmSave}
        onClose={() => setShowSaveConfirmModal(false)}
      />

      {/* Modal de Carga / Bloqueo a pantalla completa durante la sincronizaciÃ³n */}
      {isLoadingTaladro && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-navy-950/85 backdrop-blur-md animate-fade-in pointer-events-auto cursor-wait">
          <div className="glass-panel p-8 rounded-2xl border border-navy-800 flex flex-col items-center gap-4 bg-navy-900/95 text-center shadow-2xl max-w-sm">
            <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Dos spinners concÃ©ntricos en direcciÃ³n opuesta */}
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/10 border-t-cyan-500 animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-emerald-500/10 border-b-emerald-500 animate-spin [animation-duration:1.2s] [animation-direction:reverse]" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider">Sincronizando con SQL Server</h3>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                Guardando datos en la base de datos oficial. Por favor no cambie de pestaÃ±a ni cierre la aplicaciÃ³n.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}