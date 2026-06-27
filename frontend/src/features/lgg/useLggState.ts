import { useState, useMemo, useCallback } from 'react';
import { calculateRowRmr } from '../../utils/formulaEngine';
import { resolveLithologyCascade } from '../../utils/catalogData';

export interface Corrida {
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

  // 2. Lógica Reactiva de Cálculos Geomecánicos y RMR Enriquecido
  const corridasEnriquecidas = useMemo<CorridaEnriquecida[]>(() => {
    return corridas.map((row, idx) => {
      const rmrRes = calculateRowRmr(row, waterTableM);
      const isErr = !!rmrRes.error;

      // Determinar clase verbal RMR89
      let rmrClass89 = 'Muy Mala';
      if (!isErr && rmrRes.rmr_89 !== undefined) {
        rmrClass89 = rmrRes.rmr_89 >= 81 ? 'Muy Buena' :
                     rmrRes.rmr_89 >= 61 ? 'Buena' :
                     rmrRes.rmr_89 >= 41 ? 'Regular' :
                     rmrRes.rmr_89 >= 21 ? 'Mala' : 'Muy Mala';
      }

      return {
        ...row,
        rmr76Score: isErr || rmrRes.rmr_76 === undefined ? 'ERR' : rmrRes.rmr_76,
        rmr89Score: isErr || rmrRes.rmr_89 === undefined ? 'ERR' : rmrRes.rmr_89,
        rmr76Class: isErr ? 'ERROR' : rmrRes.class_76 || '',
        rmr89Class: isErr ? 'ERROR' : rmrClass89,
        rec_pct: isErr ? 0 : rmrRes.rec_pct || 0,
        rqd_pct: isErr ? 0 : rmrRes.rqd_pct || 0,
        isErr,
        originalIndex: idx
      };
    });
  }, [corridas, waterTableM]);

  // 3. Filtrar las corridas enriquecidas para mostrar en la grilla
  const filteredCorridas = useMemo(() => {
    return corridasEnriquecidas.filter((row) => {
      // Litología
      if (appliedFilters.lito) {
        const query = appliedFilters.lito.toUpperCase();
        const match = [row.lito1, row.lito2, row.lito3].some(l => l && l.toUpperCase().includes(query));
        if (!match) return false;
      }
      // Resistencia
      if (appliedFilters.resistencia) {
        if (row.resistencia !== appliedFilters.resistencia) return false;
      }
      // Calidad de Roca RMR89
      if (appliedFilters.rmrClass) {
        if (row.rmr89Class !== appliedFilters.rmrClass) return false;
      }
      // Geotécnico / Comentarios
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

    // Promedios
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
      rec_m: parseFloat((newA - newDe).toFixed(2)),
      rqd_m: parseFloat((newA - newDe).toFixed(2)),
      lrf_m: 0.0,
      small_frag_m: 0.0,
      mec_frac: 0,
      lito1: lastRow ? lastRow.lito1 : 'LMT',
      lito2: '-1',
      lito3: '-1',
      resistencia: lastRow ? lastRow.resistencia : 'R4',
      orientacion: 'X',
      offset: 0.0,
      tipo_est1: 'JN',
      tipo_est2: '-1',
      frac_nat: 0,
      frac_buz30: 0,
      frac_buz60: 0,
      frac_buz90: 0,
      abertura: 0.1,
      rugosidad: 2,
      jrc10: 17,
      intemperismo: 'UWF',
      relleno1: 'cwf',
      relleno2: '-1',
      espesor: 0.0,
      agua_obs: 'CDC',
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

  // 7. Modificación de Celda con Validaciones de Negocio e Integridad Geomecánica
  const handleCellChange = useCallback((index: number, field: keyof Corrida, value: any) => {
    const updated = [...corridas];
    let row = { ...updated[index] };

    // Validaciones específicas
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
          'rec_m', 'rqd_m', 'lrf_m', 'small_frag_m', 'mec_frac', 'frac_nat',
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
    // Listas filtradas y enriquecidas
    corridasEnriquecidas,
    filteredCorridas,
    kpiSummary,

    // Métodos de filtros
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

    // Métodos de grilla
    addCorridaRow,
    deleteCorridaRow,
    handleCellChange
  };
}
