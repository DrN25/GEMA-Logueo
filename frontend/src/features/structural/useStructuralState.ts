import { useState, useMemo, useCallback, useRef } from 'react';
import type { Discontinuidad, Corrida } from './structuralColumns';
import { normalizeStrength } from '../../utils/catalogData';

interface UseStructuralStateProps {
  discontinuidades: Discontinuidad[];
  corridas: Corrida[];
  onDiscontinuidadesChange: (discontinuidades: Discontinuidad[]) => void;
  geologo: string;
  onSelectRow: (index: number | null) => void;
}

const EDITABLE_COLS: (keyof Discontinuidad)[] = [
  'profundidad', 'tipo_estructura', 'alfa', 'beta', 'forma', 'rugosidad',
  'jrc10', 'abertura', 'weathering', 'espesor', 'relleno1', 'relleno2',
  'dureza_pared', 'agua', 'geotecnico', 'comentario'
];

export function useStructuralState({
  discontinuidades,
  corridas,
  onDiscontinuidadesChange,
  geologo,
  onSelectRow,
}: UseStructuralStateProps) {
  // --- Filtros ---
  const [filterTipoEst, setFilterTipoEst] = useState<string>('');
  const [filterWeathering, setFilterWeathering] = useState<string>('');
  const [appliedFilters, setAppliedFilters] = useState({
    tipoEst: '',
    weathering: ''
  });

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({
      tipoEst: filterTipoEst,
      weathering: filterWeathering
    });
  }, [filterTipoEst, filterWeathering]);

  const handleClearFilters = useCallback(() => {
    setFilterTipoEst('');
    setFilterWeathering('');
    setAppliedFilters({
      tipoEst: '',
      weathering: ''
    });
  }, []);

  // --- MAPEO Y ESTABILIZACIÓN EN MEMORIA DE DISCONTINUIDADES ---
  const prevMappedRef = useRef<{ disc: Discontinuidad; originalIndex: number }[]>([]);

  const mappedDiscontinuidades = useMemo(() => {
    const prevMapped = prevMappedRef.current;

    const mapped = discontinuidades.map((disc, originalIndex) => {
      const prev = prevMapped[originalIndex];

      // Verificación de consistencia referencial para conservar referencias estables de React.memo
      const isSameDisc = prev &&
        prev.originalIndex === originalIndex &&
        Object.keys(disc).every(key => disc[key as keyof Discontinuidad] === prev.disc[key as keyof Discontinuidad]);

      if (isSameDisc) {
        return prev; // Mantiene la misma referencia exacta
      }

      return { disc, originalIndex };
    });

    prevMappedRef.current = mapped;
    return mapped;
  }, [discontinuidades]);

  const filteredDiscontinuidades = useMemo(() => {
    return mappedDiscontinuidades.filter(({ disc }) => {
      if (appliedFilters.tipoEst && disc.tipo_estructura !== appliedFilters.tipoEst) {
        return false;
      }
      if (appliedFilters.weathering && disc.weathering !== appliedFilters.weathering) {
        return false;
      }
      return true;
    });
  }, [mappedDiscontinuidades, appliedFilters]);

  // --- Manipulación de Celdas ---
  const handleCellChange = useCallback((index: number, field: keyof Discontinuidad, value: any) => {
    const updated = [...discontinuidades];

    if (field === 'profundidad') {
      const depth = parseFloat(value);
      if (isNaN(depth)) {
        updated[index] = {
          ...updated[index],
          profundidad: value
        };
      } else {
        const matchingCorrida = corridas.find(c => depth >= c.de && depth < c.a) || corridas.find(c => depth === c.a);

        if (matchingCorrida) {
          updated[index] = {
            ...updated[index],
            profundidad: depth,
            de: matchingCorrida.de,
            a: matchingCorrida.a,
            corrida: matchingCorrida.corrida,
            litologia: matchingCorrida.lito1,
            lito1: matchingCorrida.lito1,
            lito2: matchingCorrida.lito2 || '-1',
            lito3: matchingCorrida.lito3 || '-1',
            dureza_pared: normalizeStrength(matchingCorrida.resistencia)
          };
        } else {
          updated[index] = {
            ...updated[index],
            profundidad: depth,
            de: 0.0,
            a: 0.0,
            corrida: 0,
            litologia: '',
            lito1: '',
            lito2: '-1',
            lito3: '-1',
            dureza_pared: '-1'
          };
        }
      }
    } else {
      let validatedValue = value;

      if (field === 'alfa') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          if (parsed === -1) {
            validatedValue = -1;
          } else if (parsed < 0) {
            validatedValue = 0;
          } else if (parsed > 90) {
            validatedValue = 90;
          } else {
            validatedValue = parsed;
          }
        } else {
          validatedValue = -1;
        }
      }
      else if (field === 'beta') {
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
          validatedValue = -1;
        }
      }
      else if (field === 'jrc10') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          if (parsed === -1) validatedValue = -1;
          else if (parsed < 0) validatedValue = 0;
          else if (parsed > 20) validatedValue = 20;
          else validatedValue = parsed;
        } else {
          validatedValue = -1;
        }
      }
      else if (field === 'rugosidad') {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed)) {
          if (parsed === -1) validatedValue = -1;
          else if (parsed < 0) validatedValue = 0;
          else if (parsed > 9) validatedValue = 9;
          else validatedValue = parsed;
        } else {
          validatedValue = -1;
        }
      }
      else {
        const camposNumericos: (keyof Discontinuidad)[] = ['abertura', 'espesor', 'forma'];
        if (camposNumericos.includes(field)) {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            validatedValue = parsed < -1 ? -1 : parsed;
          } else {
            validatedValue = -1;
          }
        }
      }

      updated[index] = { ...updated[index], [field]: validatedValue };
    }

    onDiscontinuidadesChange(updated);
  }, [discontinuidades, corridas, onDiscontinuidadesChange]);

  // --- Agregar Nueva Fila ---
  const addDiscontinuidadRow = useCallback(() => {
    const lastRow = discontinuidades[discontinuidades.length - 1];
    const newId = lastRow ? lastRow.id + 1 : 1;
    let initialDepth = 0.0;

    if (lastRow) {
      initialDepth = lastRow.profundidad;
    } else if (corridas.length > 0) {
      initialDepth = corridas[0].de;
    }

    const matchingCorrida = corridas.find(c => initialDepth >= c.de && initialDepth < c.a) || corridas.find(c => initialDepth === c.a);

    const newRow: Discontinuidad = {
      id: newId,
      de: matchingCorrida ? matchingCorrida.de : 0.0,
      a: matchingCorrida ? matchingCorrida.a : 0.0,
      profundidad: initialDepth,
      litologia: '-1',      // <-- Vacío
      lito1: '-1',          // <-- Vacío
      lito2: '-1',
      lito3: '-1',
      tipo_estructura: "-1",// <-- Vacío
      alfa: -1,             // <-- Vacío
      beta: -1,             // <-- Vacío
      forma: -1,            // <-- Vacío
      rugosidad: -1,        // <-- Vacío
      jrc10: -1,            // <-- Vacío
      abertura: -1,         // <-- Vacío
      weathering: "-1",     // <-- Vacío
      espesor: -1,          // <-- Vacío
      relleno1: "-1",       // <-- Vacío
      relleno2: "-1",
      dureza_pared: "-1",   // <-- Vacío
      agua: "-1",           // <-- Vacío
      geotecnico: "",
      comentario: "",
      corrida: matchingCorrida ? matchingCorrida.corrida : 0
    };

    onDiscontinuidadesChange([...discontinuidades, newRow]);
    onSelectRow(discontinuidades.length);
  }, [discontinuidades, corridas, geologo, onDiscontinuidadesChange, onSelectRow]);

  // --- Insertar Fila (Clonación y Reindexación) ---
  const insertDiscontinuidadRow = useCallback((index: number) => {
    const prevRow = discontinuidades[index];
    if (!prevRow) return;

    const newRow: Discontinuidad = {
      id: 0,
      de: prevRow.de,
      a: prevRow.a,
      corrida: prevRow.corrida,
      litologia: prevRow.litologia,
      dureza_pared: prevRow.dureza_pared,
      geotecnico: prevRow.geotecnico,
      tipo_estructura: prevRow.tipo_estructura,
      weathering: prevRow.weathering,
      relleno1: prevRow.relleno1,
      relleno2: prevRow.relleno2,
      agua: prevRow.agua,
      forma: prevRow.forma,
      rugosidad: prevRow.rugosidad,
      profundidad: prevRow.profundidad,
      alfa: -1,
      beta: -1,
      jrc10: -1,
      abertura: -1,
      espesor: 0.0,
      comentario: ""
    };

    const updated = [...discontinuidades];
    updated.splice(index + 1, 0, newRow);

    const reindexed = updated.map((item, idx) => ({
      ...item,
      id: idx + 1
    }));

    onDiscontinuidadesChange(reindexed);
  }, [discontinuidades, onDiscontinuidadesChange]);

  // --- Eliminar Fila ---
  const deleteRow = useCallback((index: number) => {
    const updated = discontinuidades
      .filter((_, i) => i !== index)
      .map((row, i) => ({ ...row, id: i + 1 }));
    onDiscontinuidadesChange(updated);
    onSelectRow(updated.length > 0 ? 0 : null);
  }, [discontinuidades, onDiscontinuidadesChange, onSelectRow]);

  // --- Teclado / Navegación ---
  const handleKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    colName: keyof Discontinuidad
  ) => {
    const colIndex = EDITABLE_COLS.indexOf(colName);
    if (colIndex === -1) return;

    let targetRow = rowIndex;
    let targetColIndex = colIndex;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      targetRow = Math.max(0, rowIndex - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      targetRow = Math.min(discontinuidades.length - 1, rowIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      const target = e.target as HTMLInputElement;
      if (e.currentTarget.tagName === 'SELECT' || target.selectionStart === 0) {
        e.preventDefault();
        targetColIndex = Math.max(0, colIndex - 1);
      } else {
        return;
      }
    } else if (e.key === 'ArrowRight') {
      const target = e.target as HTMLInputElement;
      if (e.currentTarget.tagName === 'SELECT' || target.selectionEnd === target.value.length) {
        e.preventDefault();
        targetColIndex = Math.min(EDITABLE_COLS.length - 1, colIndex + 1);
      } else {
        return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (colIndex === EDITABLE_COLS.length - 1) {
        addDiscontinuidadRow();
        setTimeout(() => {
          const nextElement = document.getElementById(`struct-cell-${discontinuidades.length}-0`);
          if (nextElement) {
            nextElement.focus();
          }
        }, 100);
        return;
      } else {
        targetColIndex = colIndex + 1;
      }
    } else {
      return;
    }

    const nextElementId = `struct-cell-${targetRow}-${targetColIndex}`;
    onSelectRow(targetRow);

    setTimeout(() => {
      const element = document.getElementById(nextElementId) as HTMLInputElement | HTMLSelectElement;
      if (element) {
        element.focus();
        if (element.tagName === 'INPUT') {
          (element as HTMLInputElement).select();
        }
      }
    }, 10);
  }, [discontinuidades.length, addDiscontinuidadRow, onSelectRow]);

  return {
    filteredDiscontinuidades,
    filterTipoEst,
    setFilterTipoEst,
    filterWeathering,
    setFilterWeathering,
    handleApplyFilters,
    handleClearFilters,
    handleCellChange,
    addDiscontinuidadRow,
    insertDiscontinuidadRow,
    deleteRow,
    handleKeyDown
  };
}