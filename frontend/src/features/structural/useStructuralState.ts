import { useState, useMemo, useCallback, useRef } from 'react';
import type { Discontinuidad, Corrida } from './structuralColumns';

interface UseStructuralStateProps {
  discontinuidades: Discontinuidad[];
  corridas: Corrida[];
  onDiscontinuidadesChange: (discontinuidades: Discontinuidad[]) => void;
  geologo: string;
}

const EDITABLE_COLS: (keyof Discontinuidad)[] = [
  'profundidad', 'tipo_estructura', 'alfa', 'beta', 'forma', 'rugosidad',
  'jrc10', 'abertura', 'weathering', 'espesor', 'relleno1', 'relleno2',
  'dureza_pared', 'agua', 'geotecnico', 'comentario', 'tipo'
];

export function useStructuralState({
  discontinuidades,
  corridas,
  onDiscontinuidadesChange,
  geologo
}: UseStructuralStateProps) {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

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
            dureza_pared: matchingCorrida.resistencia
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
      litologia: matchingCorrida ? matchingCorrida.lito1 : '',
      lito1: matchingCorrida ? matchingCorrida.lito1 : '',
      lito2: matchingCorrida ? (matchingCorrida.lito2 || '-1') : '-1',
      lito3: matchingCorrida ? (matchingCorrida.lito3 || '-1') : '-1',
      tipo_estructura: "JN",
      alfa: 45.0,
      beta: -1,
      forma: 4,
      rugosidad: 2,
      jrc10: 10,
      abertura: 0.1,
      weathering: "UWF",
      espesor: 0.0,
      relleno1: "cwf",
      relleno2: "-1",
      dureza_pared: matchingCorrida ? matchingCorrida.resistencia : "R4",
      agua: "CDC",
      geotecnico: geologo || "",
      comentario: "",
      corrida: matchingCorrida ? matchingCorrida.corrida : 0,
      tipo: "Natural"
    };

    onDiscontinuidadesChange([...discontinuidades, newRow]);
  }, [discontinuidades, corridas, geologo, onDiscontinuidadesChange]);

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
      tipo: prevRow.tipo,
      forma: prevRow.forma,
      rugosidad: prevRow.rugosidad,
      profundidad: prevRow.profundidad,
      alfa: 45.0,
      beta: -1,
      jrc10: 10,
      abertura: 0.1,
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
  }, [discontinuidades, onDiscontinuidadesChange]);

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

    setTimeout(() => {
      const element = document.getElementById(nextElementId) as HTMLInputElement | HTMLSelectElement;
      if (element) {
        element.focus();
        if (element.tagName === 'INPUT') {
          (element as HTMLInputElement).select();
        }
      }
    }, 10);
  }, [discontinuidades.length, addDiscontinuidadRow]);

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
    handleKeyDown,
    selectedRowIndex,
    setSelectedRowIndex
  };
}