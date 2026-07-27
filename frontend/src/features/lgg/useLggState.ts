import { useState, useMemo, useCallback, useRef } from 'react';
import { calculateRowRmr } from '../../utils/formulaEngine';
import { resolveLithologyCascade } from '../../utils/catalogData';

export interface Corrida {
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

export interface CorridaEnriquecida extends Corrida {
  rmr76Score: number | 'ERR';
  rmr89Score: number | 'ERR';
  rmr76Class: string;
  rmr89Class: string;
  rec_pct: number;
  rqd_pct: number;
  isErr: boolean;
  originalIndex: number;
}

interface UseLggStateProps {
  corridas: Corrida[];
  onCorridasChange: (corridas: Corrida[]) => void;
  waterTableM: number;
  defaultTurno?: string;
}

export function useLggState({
  corridas,
  onCorridasChange,
  waterTableM,
  defaultTurno = 'D'
}: UseLggStateProps) {
  // 1. Estados de Filtros Locales de Búsqueda
  const [filterLito, setFilterLito] = useState<string>('');
  const [filterResistencia, setFilterResistencia] = useState<string>('');
  const [filterRmrClass, setFilterRmrClass] = useState<string>('');
  const [filterGeotecnico, setFilterGeotecnico] = useState<string>('');

  const [appliedFilters, setAppliedFilters] = useState({
    lito: '',
    resistencia: '',
    rmrClass: '',
    geotecnico: ''
  });

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({
      lito: filterLito,
      resistencia: filterResistencia,
      rmrClass: filterRmrClass,
      geotecnico: filterGeotecnico
    });
  }, [filterLito, filterResistencia, filterRmrClass, filterGeotecnico]);

  const handleClearFilters = useCallback(() => {
    setFilterLito('');
    setFilterResistencia('');
    setFilterRmrClass('');
    setFilterGeotecnico('');
    setAppliedFilters({
      lito: '',
      resistencia: '',
      rmrClass: '',
      geotecnico: ''
    });
  }, []);

  // Cache persistente de resultados RMR por clave de cálculo
  const rmrCache = useRef<Map<string, CorridaEnriquecida>>(new Map());
  // Conservador de referencias estables para evitar re-renders innecesarios en React.memo
  const prevEnrichedRef = useRef<CorridaEnriquecida[]>([]);

  // 2. Lógica Reactiva de Cálculos Geomecánicos y RMR Enriquecido
  const corridasEnriquecidas = useMemo<CorridaEnriquecida[]>(() => {
    // Limpiar caché si crece desproporcionadamente
    if (rmrCache.current.size > corridas.length * 2) {
      rmrCache.current.clear();
    }

    const prevEnriched = prevEnrichedRef.current;

    const enriched = corridas.map((row, idx) => {
      const prev = prevEnriched[idx];

      // Verificación de igualdad superficial dinámica para conservar la misma referencia física
      // de la corrida si sus propiedades base no han mutado. Así React.memo saltará la fila.
      const isSameRow = prev &&
        prev.originalIndex === idx &&
        Object.keys(row).every(key => row[key as keyof Corrida] === prev[key as keyof Corrida]);

      if (isSameRow) {
        return prev; // Reutilización de referencia estricta en memoria
      }

      // Clave rápida de cálculo geomecánico que abarca todos los campos reactivos de la corrida
      const cacheKey = `${row.corrida}|${row.de}|${row.a}|${row.rec_m}|${row.rqd_m}|${row.lrf_m}|${row.frf}|${row.small_frag_m}|${row.lito1}|${row.lito2}|${row.lito3}|${row.resistencia}|${row.orientacion}|${row.offset}|${row.tipo_est1}|${row.tipo_est2}|${row.frac_nat}|${row.frac_buz30}|${row.frac_buz60}|${row.frac_buz90}|${row.abertura}|${row.rugosidad}|${row.jrc10}|${row.intemperismo}|${row.relleno1}|${row.relleno2}|${row.espesor}|${row.agua_obs}|${row.turno}|${row.comentarios}|${waterTableM}`;

      const cached = rmrCache.current.get(cacheKey);
      if (cached) {
        if (cached.originalIndex === idx) {
          return cached; // Reutilización de caché con índice idéntico
        }
        return { ...cached, originalIndex: idx }; // Copia ligera si cambió el índice
      }

      const rmrRes = calculateRowRmr(row, waterTableM);
      const isErr = !!rmrRes.error;

      let rmrClass89 = 'Muy Mala';
      if (!isErr && rmrRes.rmr_89 !== undefined) {
        rmrClass89 = rmrRes.rmr_89 >= 81 ? 'Muy Buena' :
          rmrRes.rmr_89 >= 61 ? 'Buena' :
            rmrRes.rmr_89 >= 41 ? 'Regular' :
              rmrRes.rmr_89 >= 21 ? 'Mala' : 'Muy Mala';
      }

      const calcFrf = row.lrf_m > 0 ? Math.floor(Math.round(row.lrf_m * 100) / 5) + 1 : 0;
      const frfVal = rmrRes.frf !== undefined ? rmrRes.frf : (row.frf !== undefined ? row.frf : calcFrf);

      const enrichedRow: CorridaEnriquecida = {
        ...row,
        frf: frfVal,
        rmr76Score: isErr || rmrRes.rmr_76 === undefined ? 'ERR' : rmrRes.rmr_76,
        rmr89Score: isErr || rmrRes.rmr_89 === undefined ? 'ERR' : rmrRes.rmr_89,
        rmr76Class: isErr ? 'ERROR' : rmrRes.class_76 || '',
        rmr89Class: isErr ? 'ERROR' : rmrClass89,
        rec_pct: isErr ? 0 : rmrRes.rec_pct || 0,
        rqd_pct: isErr ? 0 : rmrRes.rqd_pct || 0,
        isErr,
        originalIndex: idx
      };

      rmrCache.current.set(cacheKey, enrichedRow);
      return enrichedRow;
    });

    prevEnrichedRef.current = enriched;
    return enriched;
  }, [corridas, waterTableM]);

  // 3. Filtrar las corridas enriquecidas para mostrar en la grilla (preserva referencias estables)
  const filteredCorridas = useMemo(() => {
    return corridasEnriquecidas.filter((row) => {
      if (appliedFilters.lito) {
        const query = appliedFilters.lito.toUpperCase();
        const match = [row.lito1, row.lito2, row.lito3].some(l => l && l.toUpperCase().includes(query));
        if (!match) return false;
      }
      if (appliedFilters.resistencia) {
        if (row.resistencia !== appliedFilters.resistencia) return false;
      }
      if (appliedFilters.rmrClass) {
        if (row.rmr89Class !== appliedFilters.rmrClass) return false;
      }
      if (appliedFilters.geotecnico) {
        const query = appliedFilters.geotecnico.toLowerCase();
        const match = [row.comentarios].some(c => c && c.toLowerCase().includes(query));
        if (!match) return false;
      }
      return true;
    });
  }, [corridasEnriquecidas, appliedFilters]);

  // 4. KPIs Consolidados del Sondaje Activo (Dashboard)
  const kpiSummary = useMemo(() => {
    const totalCorridasKpi = corridas.length;
    const totalPerfKpi = corridas.reduce((acc, row) => acc + Math.max(0, (row.a - row.de)), 0);
    const firstDeKpi = corridas.length > 0 ? Math.min(...corridas.map(r => r.de)) : 0;
    const lastAKpi = corridas.length > 0 ? Math.max(...corridas.map(r => r.a)) : 0;

    let totalRec = 0;
    let totalRqd = 0;
    let validCount = 0;

    corridasEnriquecidas.forEach(r => {
      if (!r.isErr) {
        totalRec += r.rec_pct;
        totalRqd += r.rqd_pct;
        validCount++;
      }
    });

    const avgRecKpi = validCount > 0 ? parseFloat((totalRec / validCount).toFixed(1)) : 0.0;
    const avgRqdKpi = validCount > 0 ? parseFloat((totalRqd / validCount).toFixed(1)) : 0.0;

    return {
      totalCorridasKpi,
      totalPerfKpi,
      firstDeKpi,
      lastAKpi,
      avgRecKpi,
      avgRqdKpi
    };
  }, [corridas, corridasEnriquecidas]);

  // 5. Inserción de Nueva Fila de Corrida (Consecutiva)
  const addCorridaRow = useCallback(() => {
    const lastRow = corridas[corridas.length - 1];
    const newDe = lastRow ? lastRow.a : 0.0;
    const newA = lastRow ? parseFloat((newDe + 1.5).toFixed(2)) : 1.5;

    const newRow: Corrida = {
      corrida: corridas.length + 1,
      de: newDe,
      a: newA,
      rec_m: -1,         // <-- Vacío
      rqd_m: -1,         // <-- Vacío
      lrf_m: -1,         // <-- Vacío
      small_frag_m: -1,  // <-- Vacío
      lito1: '-1',       // <-- Vacío (Sin litología inicial)
      lito2: '-1',
      lito3: '-1',
      resistencia: '-1', // <-- Vacío
      orientacion: 'X',
      offset: -1,        // <-- Vacío
      tipo_est1: '-1',   // <-- Vacío
      tipo_est2: '-1',
      frac_nat: -1,      // <-- Vacío
      frac_buz30: -1,    // <-- Vacío
      frac_buz60: -1,    // <-- Vacío
      frac_buz90: -1,    // <-- Vacío
      abertura: -1,      // <-- Vacío
      rugosidad: -1,     // <-- Vacío
      jrc10: -1,         // <-- Vacío
      intemperismo: '-1',// <-- Vacío
      relleno1: '-1',    // <-- Vacío
      relleno2: '-1',
      espesor: -1,       // <-- Vacío
      agua_obs: '-1',    // <-- Vacío
      turno: defaultTurno,
      comentarios: ''
    };

    onCorridasChange([...corridas, newRow]);
  }, [corridas, onCorridasChange, defaultTurno]);

  // 6. Eliminación de Fila
  const deleteCorridaRow = useCallback((index: number) => {
    const updated = corridas
      .filter((_, i) => i !== index)
      .map((row, i) => ({ ...row, corrida: i + 1 }));
    onCorridasChange(updated);
  }, [corridas, onCorridasChange]);

  // 7. Inserción/Clonación de Fila
  const insertCorridaRow = useCallback((index: number) => {
    const original = corridas[index];
    if (!original) return;

    const cloned: Corrida = {
      ...original,
      corrida: index + 2,
      de: original.a,
      a: parseFloat((original.a + 1.5).toFixed(2))
    };

    const updated = [...corridas];
    updated.splice(index + 1, 0, cloned);

    const reindexed = updated.map((item, idx) => ({
      ...item,
      corrida: idx + 1
    }));

    onCorridasChange(reindexed);
  }, [corridas, onCorridasChange]);

  // 8. Modificación de Celda con Validaciones Geomecánicas Síncronas
  const handleCellChange = useCallback((index: number, field: keyof Corrida, value: any) => {
    const updated = [...corridas];
    let row = { ...updated[index] };

    if (field === 'lito1' || field === 'lito2' || field === 'lito3') {
      const resCascade = resolveLithologyCascade(
        field === 'lito1' ? value : (row.lito1 || 'LMT'),
        field === 'lito2' ? value : (row.lito2 || '-1'),
        field === 'lito3' ? value : (row.lito3 || '-1'),
        field,
        value
      );
      row.lito1 = resCascade.lito1;
      row.lito2 = resCascade.lito2 === '-' ? '-1' : resCascade.lito2;
      row.lito3 = resCascade.lito3 === '-' ? '-1' : resCascade.lito3;
    } else {
      let validatedValue = value;

      if (field === 'jrc10') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          if (parsed === -1) validatedValue = -1;
          else if (parsed < 0) validatedValue = 0;
          else if (parsed > 20) validatedValue = 20;
          else validatedValue = parsed;
        } else {
          validatedValue = -1;
        }
      } else if (field === 'rugosidad') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          if (parsed === -1) validatedValue = -1;
          else if (parsed < 0) validatedValue = 0;
          else if (parsed > 9) validatedValue = 9;
          else validatedValue = parsed;
        } else {
          validatedValue = -1;
        }
      } else {
        const camposMinimoCero: (keyof Corrida)[] = ['de', 'a'];
        const camposMinimoMenosUno: (keyof Corrida)[] = [
          'rec_m', 'rqd_m', 'lrf_m', 'small_frag_m', 'frac_nat',
          'frac_buz30', 'frac_buz60', 'frac_buz90', 'abertura', 'espesor', 'offset'
        ];

        if (field === 'offset') {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            if (parsed === -1) {
              validatedValue = -1;
            } else if (parsed < 0) {
              validatedValue = 0;
            } else if (parsed > 360) {
              validatedValue = 360;
            } else {
              validatedValue = parsed;
            }
          } else {
            validatedValue = 0;
          }
        } else if (camposMinimoCero.includes(field)) {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            validatedValue = parsed < 0 ? 0 : parsed;
          } else {
            validatedValue = 0;
          }
        } else if (camposMinimoMenosUno.includes(field)) {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            validatedValue = parsed < -1 ? -1 : parsed;
          } else {
            validatedValue = -1;
          }
        }
      }

      row = { ...row, [field]: validatedValue };
    }

    updated[index] = row;
    onCorridasChange(updated);
  }, [corridas, onCorridasChange]);

  return {
    corridasEnriquecidas,
    filteredCorridas,
    kpiSummary,
    filterLito,
    setFilterLito,
    filterResistencia,
    setFilterResistencia,
    filterRmrClass,
    setFilterRmrClass,
    filterGeotecnico,
    setFilterGeotecnico,
    appliedFilters,
    handleApplyFilters,
    handleClearFilters,
    addCorridaRow,
    deleteCorridaRow,
    insertCorridaRow,
    handleCellChange
  };
}