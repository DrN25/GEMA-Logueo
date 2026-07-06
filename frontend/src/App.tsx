import { useState, useEffect, useMemo } from 'react';
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
import PltView from './features/plt/PltView';
import RqdDashboard from './features/dashboard/RqdDashboard';
import ReportsPdf from './features/reports/ReportsPdf';
import BulkAuditor from './features/auditor/BulkAuditor';

import { validateCollarAndSurvey, validateRowQAQC, validateStructuralQAQC, validatePltQAQC, type ValidationAlert } from './utils/qaqcValidator';
import { resolveLithologyCascade } from './utils/catalogData';

interface Survey {
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
  small_frag_m: number;
  mec_frac: number;
  lito1: string;
  lito2?: string;
  lito3?: string;
  resistencia: string;
  orientacion: string;
  offset?: number;
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
  turno?: string;
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
  tipo: string;
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
}

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function App() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [taladros, setTaladros] = useState<TaladroSummary[]>([]);
  const [activeTaladro, setActiveTaladro] = useState<Taladro | null>(null);
  const [originalName, setOriginalName] = useState<string | null>(null);

  // Theme and UI States
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [showCatalogsModal, setShowCatalogsModal] = useState<boolean>(false);
  const [showFormulasModal, setShowFormulasModal] = useState<boolean>(false);

  // Synchronization feedback states
  const [syncStatus, setSyncStatus] = useState<'synced' | 'unsaved' | 'saving' | 'offline'>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('Conectado al servidor de base de datos.');

  const [isLoadingTaladro, setIsLoadingTaladro] = useState<boolean>(false);

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

  // Fetch drillhole lists on mount
  useEffect(() => {
    fetchTaladros();
  }, []);

  // Auto-select first taladro if none is active to enable all tabs
  useEffect(() => {
    if (!activeTaladro && taladros.length > 0) {
      handleSelectTaladro(taladros[0].name, false);
    }
  }, [taladros, activeTaladro]);

  const fetchTaladros = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/taladros`);
      if (res.ok) {
        const data = await res.json();
        setTaladros(data);
        setSyncStatus('synced');
      } else {
        throw new Error("HTTP error " + res.status);
      }
    } catch (e) {
      console.warn("Backend server not reachable. Loading cached storage local database.", e);
      setSyncStatus('offline');
      setSyncMessage("Servidor backend offline. Usando almacenamiento local temporal.");

      // Load offline summaries from localStorage
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
    }
  };

  const handleSelectTaladro = async (name: string, shouldSwitchView: boolean = true) => {
    setIsLoadingTaladro(true); // 1. Activar Modal de Carga
    setSyncStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/api/taladros/${name}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.ensayos_plt) data.ensayos_plt = [];
        setActiveTaladro(data);
        setOriginalName(data.name);
        setSyncStatus('synced');
        if (shouldSwitchView) {
          setCurrentView('collar'); // 2. Redireccionar a Collar y Survey en lugar de LGG
        }
        setSelectedRowIndex(0);
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warn("Loading taladro offline for name: ", name);
      const cachedTaladro = localStorage.getItem(`geolog_taladro_${name}`);
      if (cachedTaladro) {
        const parsed = JSON.parse(cachedTaladro);
        if (!parsed.ensayos_plt) parsed.ensayos_plt = [];
        setActiveTaladro(parsed);
        setOriginalName(parsed.name);
        setSyncStatus('offline');
      } else {
        // Inicializar fallback estructural offline
        const defaultTal: Taladro = {
          name,
          proyecto: "Proyecto A",
          geologo: "RD/RB",
          diametro: "HQ3",
          inclinacion: -60.0,
          campana: "2026",
          fecha_registro: new Date().toISOString().split('T')[0],
          collar_este_proyectado: 1205.4,
          collar_norte_proyectado: 8432.8,
          collar_cota_proyectado: 4120.0,
          prof_final_eoh_proyectada: 150.0,
          comentarios_proyectado: "",
          collar_este: 1205.4,
          collar_norte: 8432.8,
          collar_cota: 4120.0,
          prof_final_eoh: 150.0,
          comentarios: "",
          turno: "D",
          surveys: [
            { depth: 0, dip: -60.0, azimuth: 120.0 },
            { depth: 50.0, dip: -60.5, azimuth: 121.2 }
          ],
          corridas: [
            {
              corrida: 1, de: 0, a: 1.5, rec_m: 1.5, rqd_m: 1.3, lrf_m: 0.1, small_frag_m: 0.1,
              mec_frac: 0, lito1: "LMT", resistencia: "R4", orientacion: "X", offset: 0.0,
              tipo_est1: "JN", frac_nat: 1, frac_buz30: 0, frac_buz60: 1, frac_buz90: 0,
              abertura: 0.1, rugosidad: 2, jrc10: 10, intemperismo: "UWF", relleno1: "cwf",
              espesor: 0, agua_obs: "CDC", comentarios: "Corrida inicial"
            }
          ],
          discontinuidades: [],
          ensayos_plt: []
        };
        setActiveTaladro(defaultTal);
        setOriginalName(defaultTal.name);
        setSyncStatus('unsaved');
      }
      if (shouldSwitchView) {
        setCurrentView('collar'); // 2. Redireccionar a Collar y Survey en caso offline también
      }
      setSelectedRowIndex(0);
    } finally {
      setIsLoadingTaladro(false); // 3. Desactivar Modal de Carga
    }
  };

  const handleCreateTaladro = async (newTaladro: Taladro, targetView: string = 'collar') => {
    setSyncStatus('saving');
    // Save locally first
    localStorage.setItem(`geolog_taladro_${newTaladro.name}`, JSON.stringify(newTaladro));

    // Add to summaries list
    const newSummary: TaladroSummary = {
      name: newTaladro.name,
      proyecto: newTaladro.proyecto,
      geologo: newTaladro.geologo,
      diametro: newTaladro.diametro,
      inclinacion: newTaladro.inclinacion,
      fecha_registro: newTaladro.fecha_registro,
      corridas_count: newTaladro.corridas.length,
      surveys_count: newTaladro.surveys.length
    };

    const updatedSummaries = [...taladros.filter(t => t.name !== newTaladro.name), newSummary];
    setTaladros(updatedSummaries);
    localStorage.setItem('geolog_taladros_summaries', JSON.stringify(updatedSummaries));

    // Try posting to backend database
    try {
      const res = await fetch(`${API_BASE}/api/taladros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTaladro)
      });
      if (res.ok) {
        setSyncStatus('synced');
        setSyncMessage(`Taladro ${newTaladro.name} creado exitosamente en SQL Server.`);
      } else {
        throw new Error();
      }
    } catch (e) {
      setSyncStatus('offline');
      setSyncMessage(`Guardado en caché offline. No hay conexión con el backend.`);
    }

    setActiveTaladro(newTaladro);
    setOriginalName(newTaladro.name);
    setCurrentView(targetView);
  };

  const handleRenameTaladro = (newName: string) => {
    if (!activeTaladro) return;
    const oldName = activeTaladro.name;
    const trimmedNewName = newName.trim().toUpperCase();
    if (!trimmedNewName || oldName === trimmedNewName) return;

    const updatedTal = { ...activeTaladro, name: trimmedNewName };
    setActiveTaladro(updatedTal);
    setSyncStatus('unsaved');
    setSyncMessage(`Taladro renombrado localmente a ${trimmedNewName}. Guarde los cambios para actualizar la base de datos.`);

    const updatedSummaries = taladros.map(t => {
      if (t.name === oldName) {
        return {
          ...t,
          name: trimmedNewName,
          corridas_count: updatedTal.corridas.length,
          surveys_count: updatedTal.surveys.length
        };
      }
      return t;
    });
    setTaladros(updatedSummaries);
    localStorage.setItem('geolog_taladros_summaries', JSON.stringify(updatedSummaries));

    const cachedData = localStorage.getItem(`geolog_taladro_${oldName}`);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      parsed.name = trimmedNewName;
      localStorage.setItem(`geolog_taladro_${trimmedNewName}`, JSON.stringify(parsed));
      localStorage.removeItem(`geolog_taladro_${oldName}`);
    } else {
      localStorage.setItem(`geolog_taladro_${trimmedNewName}`, JSON.stringify(updatedTal));
    }
  };

  const handleImportExcel = async (importedRows: Corrida[], createNewWithName?: string) => {
    if (createNewWithName) {
      const newTal: Taladro = {
        name: createNewWithName.trim().toUpperCase(),
        proyecto: activeTaladro?.proyecto || "Proyecto A",
        geologo: activeTaladro?.geologo || "RD/RB",
        diametro: activeTaladro?.diametro || "HQ3",
        inclinacion: activeTaladro?.inclinacion || -60.0,
        campana: activeTaladro?.campana || "2026",
        fecha_registro: new Date().toISOString().split('T')[0],
        // Proyectado
        collar_este_proyectado: 0.0,
        collar_norte_proyectado: 0.0,
        collar_cota_proyectado: 0.0,
        prof_final_eoh_proyectada: 0.0,
        comentarios_proyectado: '',
        // Oficial
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
      await handleCreateTaladro(newTal, 'lgg');
    } else {
      handleCorridasChange(importedRows);
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
        tipo: row.tipo || 'Natural'
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

      // AUTOCOMPLETADO GEOLÓGICO:
      // Se ignoran datos externos y se extrae la información del taladro actual
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

      // Se ejecuta la resolución en cascada geomecánica oficial
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
        fecha: r.fecha || new Date().toISOString().split('T')[0],
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
    if (!confirm(`¿Está seguro de que desea eliminar permanentemente el taladro ${name}? Se borrará de la base de datos.`)) {
      return;
    }

    setSyncStatus('saving');
    const updatedSummaries = taladros.filter(t => t.name !== name);
    setTaladros(updatedSummaries);
    localStorage.setItem('geolog_taladros_summaries', JSON.stringify(updatedSummaries));
    localStorage.removeItem(`geolog_taladro_${name}`);

    try {
      const res = await fetch(`${API_BASE}/api/taladros/${name}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSyncStatus('synced');
        setSyncMessage(`Taladro ${name} eliminado con éxito del servidor.`);
      } else {
        throw new Error();
      }
    } catch (e) {
      setSyncStatus('offline');
      setSyncMessage(`Taladro ${name} eliminado localmente.`);
    }

    if (activeTaladro?.name === name) {
      setActiveTaladro(null);
    }
    setCurrentView('dashboard');
  };

  const handleSaveActive = async () => {
    if (!activeTaladro) return;

    setSyncStatus('saving');
    setSyncMessage("Sincronizando con SQL Server local...");

    // Update localStorage first
    localStorage.setItem(`geolog_taladro_${activeTaladro.name}`, JSON.stringify(activeTaladro));

    // Update summary counts
    const summaryIndex = taladros.findIndex(t => t.name === activeTaladro.name);
    if (summaryIndex !== -1) {
      const updatedSummaries = [...taladros];
      updatedSummaries[summaryIndex] = {
        ...updatedSummaries[summaryIndex],
        corridas_count: activeTaladro.corridas.length,
        surveys_count: activeTaladro.surveys.length
      };
      setTaladros(updatedSummaries);
      localStorage.setItem('geolog_taladros_summaries', JSON.stringify(updatedSummaries));
    }

    try {
      const res = await fetch(`${API_BASE}/api/taladros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeTaladro)
      });

      if (res.ok) {
        if (originalName && originalName !== activeTaladro.name) {
          try {
            await fetch(`${API_BASE}/api/taladros/${originalName}`, {
              method: 'DELETE'
            });
          } catch (delErr) {
            console.error("Failed to delete old taladro after rename:", delErr);
          }
        }
        setOriginalName(activeTaladro.name);
        setSyncStatus('synced');
        setSyncMessage("Cambios guardados y auditados con éxito en SQL Server.");
      } else {
        // CAPTURA DE ERROR DE BASE DE DATOS O SERVIDOR (ej. 500 Internal Server Error)
        const errorData = await res.json().catch(() => ({ detail: "Error interno del servidor SQL Server." }));
        setSyncStatus('offline');
        setSyncMessage(`Fallo al guardar: ${errorData.detail || "Error de consistencia o de restricciones en la base de datos."}`);
      }
    } catch (e) {
      // CAPTURA DE ERROR DE CONEXIÓN O RED
      setSyncStatus('offline');
      setSyncMessage("Fallo en la conexión: No se pudo establecer comunicación con el servidor.");
    }
  };

  // ─── VALIDACIÓN QA/QC CON DEBOUNCE (750ms) ───────────────────────────────
  //
  // Estrategia: las validaciones NO corren mientras el usuario está escribiendo.
  // Solo se ejecutan 750ms después del último cambio en el estado.
  //
  // ¿Cómo funciona?
  //   - Cada vez que activeTaladro cambia (cada keystroke), el timer anterior
  //     se cancela y se inicia uno nuevo de 750ms.
  //   - Solo si el usuario no toca nada en 750ms, el snapshot se actualiza
  //     y las validaciones corren.
  //   - Durante la escritura activa: validationSnapshot se congela en su
  //     valor anterior → activeAlerts no cambia → ninguna fila se invalida.
  //
  // Los límites numéricos (jrc10: 0-20, rugosidad: 0-9, etc.) NO son parte
  // de este sistema — se aplican en handleCellChange de forma sincrónica,
  // antes de actualizar el estado, por lo que siguen funcionando al instante.

  const [validationSnapshot, setValidationSnapshot] = useState<typeof activeTaladro>(null);

  useEffect(() => {
    if (!activeTaladro) {
      setValidationSnapshot(null);
      return;
    }
    const timer = setTimeout(() => {
      setValidationSnapshot(activeTaladro);
    }, 750);
    // El cleanup cancela el timer si activeTaladro cambia antes de que expire
    return () => clearTimeout(timer);
  }, [activeTaladro]);

  const activeAlerts = useMemo((): ValidationAlert[] => {
    if (!validationSnapshot) return [];

    const surveyAlerts = validateCollarAndSurvey(validationSnapshot, validationSnapshot.surveys);

    const lggAlerts = validationSnapshot.corridas.flatMap((row, idx) =>
      validateRowQAQC(row, idx, validationSnapshot.corridas)
    );

    const structuralAlerts = validateStructuralQAQC(
      validationSnapshot.discontinuidades,
      validationSnapshot.corridas
    );

    const pltAlerts = validatePltQAQC(
      validationSnapshot.ensayos_plt || [],
      validationSnapshot.corridas,
      validationSnapshot
    );

    return [...surveyAlerts, ...lggAlerts, ...structuralAlerts, ...pltAlerts];
  }, [validationSnapshot]);

  // Mapped field focusing logic from ValidationPanel
  const handleFocusField = (fieldId: string) => {
    // 1. Redireccionar de inmediato a la pestaña destino
    let targetView = 'lgg';
    let idPrefix = 'lgg-cell';
    const isStruct = fieldId.startsWith('struct-');
    const isPlt = fieldId.startsWith('plt-');

    if (fieldId.startsWith('survey-') || fieldId.startsWith('collar-')) {
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

    // 2. Extraer índice y campo de forma genérica (ej. "plt-from_m-12" -> index: 12, fieldName: "from_m")
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

    // Sincronizar la selección global de fila de inmediato para habilitar los inputs correspondientes
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
          tdElement.click(); // Activa la fila y enfoca automáticamente
        }
      }
    }, 100);
  };

  const handleCollarChange = (updatedCollar: Collar) => {
    if (!activeTaladro) return;
    const oldName = activeTaladro.name;
    const newName = updatedCollar.name.trim().toUpperCase();

    if (oldName !== newName && newName.length > 0) {
      // Sync rename locally in cache
      const cachedData = localStorage.getItem(`geolog_taladro_${oldName}`);
      let updatedTal = { ...activeTaladro, ...updatedCollar, name: newName };
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        parsed.name = newName;
        Object.assign(parsed, updatedCollar);
        localStorage.setItem(`geolog_taladro_${newName}`, JSON.stringify(parsed));
        updatedTal = parsed;
      } else {
        localStorage.setItem(`geolog_taladro_${newName}`, JSON.stringify(updatedTal));
      }
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

      setSyncStatus('unsaved');
      setSyncMessage(`Taladro renombrado localmente a ${newName}. Guarde los cambios para actualizar la base de datos.`);
      setActiveTaladro(updatedTal);
    } else {
      setActiveTaladro({
        ...activeTaladro,
        ...updatedCollar
      });
      setSyncStatus('unsaved');
    }
  };

  const handleSurveysChange = (updatedSurveys: Survey[]) => {
    if (!activeTaladro) return;
    const hasChanged = JSON.stringify(activeTaladro.surveys) !== JSON.stringify(updatedSurveys);
    if (!hasChanged) return; // Salir de inmediato si no hay un cambio real

    setActiveTaladro({
      ...activeTaladro,
      surveys: updatedSurveys
    });
    setSyncStatus('unsaved');
  };

  const handleCorridasChange = (updatedCorridas: Corrida[]) => {
    if (!activeTaladro) return;
    const hasChanged = JSON.stringify(activeTaladro.corridas) !== JSON.stringify(updatedCorridas);
    if (!hasChanged) return; // Salir de inmediato si no hay un cambio real

    // Auto-update structural discontinuities runs on depth changes
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
    setSyncStatus('unsaved');
  };

  const handleDiscontinuidadesChange = (updatedDiscs: Discontinuidad[]) => {
    if (!activeTaladro) return;
    const hasChanged = JSON.stringify(activeTaladro.discontinuidades) !== JSON.stringify(updatedDiscs);
    if (!hasChanged) return; // Salir de inmediato si no hay un cambio real

    setActiveTaladro({
      ...activeTaladro,
      discontinuidades: updatedDiscs
    });
    setSyncStatus('unsaved');
  };

  const handleEnsayosPltChange = (updatedPlts: EnsayoPlt[]) => {
    if (!activeTaladro) return;
    const hasChanged = JSON.stringify(activeTaladro.ensayos_plt) !== JSON.stringify(updatedPlts);
    if (!hasChanged) return; // Salir de inmediato si no hay un cambio real

    setActiveTaladro({
      ...activeTaladro,
      ensayos_plt: updatedPlts
    });
    setSyncStatus('unsaved');
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
          handleSaveActive={handleSaveActive}
          setActiveTaladro={setActiveTaladro}
          setCurrentView={setCurrentView}
          onOpenCatalogs={() => setShowCatalogsModal(true)}
        />

        {/* Screen Content Wrapper - Cambiado a overflow-hidden porque los scrolls se manejan internamente */}
        <div className="flex-1 p-6 relative flex flex-col overflow-hidden">

          {/* 1. Dashboard Principal (Solo se desmonta si no hay taladro activo) */}
          {(!activeTaladro || currentView === 'dashboard' || currentView === 'list') && (
            <div className="flex-1 flex flex-col min-h-0">
              <MainDashboard
                taladros={taladros}
                onSelectTaladro={handleSelectTaladro}
                onCreateTaladro={handleCreateTaladro}
                onDeleteTaladro={handleDeleteTaladro}
              />
            </div>
          )}

          {/* 2. VISTAS CORE EN MODO KEEP-ALIVE (Toggles CSS instantáneos sin desmontar DOM) */}
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
                />
              </div>

              {/* Vista Logueo Geotécnico General (LGG) */}
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
                  activeTaladroGeologo={activeTaladro.geologo}
                  activeTaladroFecha={activeTaladro.fecha_registro}
                  sidebarCollapsed={sidebarCollapsed}
                  onFocusField={handleFocusField}
                  onCreateTaladro={(newTal) => handleCreateTaladro(newTal, 'lgg')}
                  onRenameTaladro={handleRenameTaladro}
                  onImportExcel={handleImportExcel}
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
                  // --- MEJORA: Sincronizar selección de fila con App.tsx ---
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
                  // --- MEJORA: Sincronizar selección de fila con App.tsx ---
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
                  Configuración de Parámetros
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-navy-900/60">
                    <span>Campaña</span>
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
                      <option value="D">Día</option>
                      <option value="N">Noche</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span>Diámetro Predeterminado</span>
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
              <BulkAuditor apiBase={API_BASE} />
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
                    Importación y Exportación de Datos
                  </h2>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
                    <Construction size={12} className="animate-spin" />
                    Módulo En Progreso / In Progress
                  </div>
                </div>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Este módulo facilitará la importación directa de datos históricos en formato BCP y la exportación unificada de registros a plantillas estructuradas de geotecnia minera para software especializado como <span className="text-slate-200 font-semibold">Leapfrog</span>, <span className="text-slate-200 font-semibold">gINT</span> y <span className="text-slate-200 font-semibold">Vulcan</span>.
                </p>
                <div className="pt-4 border-t border-navy-800/60 max-w-md mx-auto">
                  <p className="text-xs text-slate-500">
                    La conexión duplicada con SQL Server local se encuentra activa. Las rutinas de persistencia normalizadas ya están preparadas en el backend API.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating validation QA/QC panel (handles its own positioning left/right) — hidden on Carga para Revisión */}
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

      {/* Modal de Carga a pantalla completa durante la sincronización */}
      {isLoadingTaladro && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel p-8 rounded-2xl border border-navy-800 flex flex-col items-center gap-4 bg-[#090f1d]/95 text-center shadow-2xl">
            <div className="relative w-16 h-16">
              {/* Dos spinners concéntricos en dirección opuesta */}
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/10 border-t-cyan-500 animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-blue-500/10 border-b-blue-500 animate-spin [animation-duration:1.2s] [animation-direction:reverse]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-100 uppercase tracking-wider">Cargando Taladro</h3>
              <p className="text-[11px] text-slate-400 font-semibold">Sincronizando con base de datos SQL Server local...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
