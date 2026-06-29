import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { EnsayoPlt } from '../../App';
import {
  NOMINAL_DIAMETERS,
  resolveLithologyCascade
} from '../../utils/catalogData';

interface UsePltStateProps {
  ensayos_plt: EnsayoPlt[];
  onEnsayosPltChange: (plts: EnsayoPlt[]) => void;
  corridas: any[];
  collar: any;
  selectedRowIndex: number | null;
  onSelectRow: (index: number | null) => void;
}

export function usePltState({
  ensayos_plt,
  onEnsayosPltChange,
  corridas,
  collar,
  selectedRowIndex,
  onSelectRow
}: UsePltStateProps) {
  const [activeSubTab, setActiveSubTab] = useState<'plt' | 'dashboard' | 'qaqc'>('plt');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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

  const handleCellChange = useCallback((rowIdx: number, key: keyof EnsayoPlt, value: any) => {
    const updated = [...ensayos_plt];
    const row = { ...updated[rowIdx] } as any;

    // --- RECONOCIMIENTO DE CAMPOS VACÍOS ---
    if (value === '-1' || value === -1 || value === '') {
      if (key === 'fecha') value = collar.fecha_registro || '';
      else if (['tipo_de_ensayo', 'diametro_taladro_nominacion', 'tipo_rotura_code', 'direccion_rotura_code', 'litologia_1', 'litologia_2', 'litologia_3'].includes(key as string)) value = '-1';
      else value = -1; // Permitir que los campos numéricos se guarden como -1 (Sin dato)
    }

    // --- VALIDACIÓN DE LÍMITES MÍNIMOS EN JAVASCRIPT ---
    const numericKeys = [
      'nro_caja', 'corrida_desde', 'corrida_hasta', 'from_m', 'to_m',
      'este_m', 'norte_m', 'elevacion_msnm', 'd_mm', 'p_instr_kn'
    ];

    if (numericKeys.includes(key as string)) {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        value = parsed < -1 ? -1 : parsed;
      } else {
        value = -1; // Forzar a -1 si se borra o hay un error de parseo
      }
    }

    row[key] = value;

    // A. CO-SINCRONIZACIÓN DE DIÁMETRO DE TALADRO <-> D (MM)
    if (key === 'diametro_taladro_nominacion') {
      const nominal = NOMINAL_DIAMETERS[value as string];
      if (nominal) row.d_mm = nominal;
    } else if (key === 'd_mm') {
      const valNum = parseFloat(value) || 0;
      const closestCode = Object.entries(NOMINAL_DIAMETERS).find(([_, v]) => Math.abs(v - valNum) < 0.2);
      if (closestCode) row.diametro_taladro_nominacion = closestCode[0];
    }

    // B. CÁLCULO DE INTERVALOS, METRAJES Y AUTOCOMPLETADO INTELIGENTE DESDE LGG [2]
    if (key === 'from_m' || key === 'to_m' || key === 'corrida_desde' || key === 'corrida_hasta') {
      let from = parseFloat(key === 'from_m' ? value : row.from_m) || 0;
      let to = parseFloat(key === 'to_m' ? value : row.to_m) || 0;
      let c_desde = parseFloat(key === 'corrida_desde' ? value : row.corrida_desde) || 0;
      let c_hasta = parseFloat(key === 'corrida_hasta' ? value : row.corrida_hasta) || 0;

      // Autocompletado inteligente desde LGG al escribir From/To
      if (key === 'from_m' || key === 'to_m') {
        const match = corridas.find(c => c.de <= from && to <= c.a);
        if (match) {
          c_desde = match.de;
          c_hasta = match.a;
          row.corrida_desde = match.de;
          row.corrida_hasta = match.a;

          // Sugerencia automática de litologías de LGG [2]
          row.litologia_1 = match.lito1;
          row.litologia_2 = match.lito2 === "-1" ? "-" : match.lito2;
          row.litologia_3 = match.lito3 === "-1" ? "-" : match.lito3;

          // Se resuelve la cascada geomecánica con estas litologías sugeridas
          const resCascade = resolveLithologyCascade(row.litologia_1, row.litologia_2, row.litologia_3, 'litologia_1', row.litologia_1);
          row.litologia_1 = resCascade.lito1;
          row.litologia_2 = resCascade.lito2;
          row.litologia_3 = resCascade.lito3;
          row.tipo_litologico = resCascade.clase;
          row.factor_k = resCascade.k;
        }
      }

      row.long_de_muestra_mm = parseFloat(((to - from) * 1000).toFixed(1));
      row.long_de_corrida_m = parseFloat((c_hasta - c_desde).toFixed(2));

      // Verif. corrida -> Corrida Desde <= From <= To <= Corrida Hasta
      row.verif_corrida = (c_desde <= from && from <= to && to <= c_hasta) ? "OK" : "Error";
    }

    // C. CASCADA DE LITOLOGÍAS (ENFOQUE DE LIDERAZGO DE MAYOR NÚMERO)
    if (key === 'litologia_1' || key === 'litologia_2' || key === 'litologia_3') {
      const resCascade = resolveLithologyCascade(
        key === 'litologia_1' ? value : (row.litologia_1 || 'MZB'),
        key === 'litologia_2' ? value : (row.litologia_2 || 'MZB'),
        key === 'litologia_3' ? value : (row.litologia_3 || 'MZB_EQ'),
        key,
        value
      );
      row.litologia_1 = resCascade.lito1;
      row.litologia_2 = resCascade.lito2;
      row.litologia_3 = resCascade.lito3;
      row.tipo_litologico = resCascade.clase;
      row.factor_k = resCascade.k;
    }

    // D. CÁLCULOS MATEMÁTICOS DEL ENSAYO PLT (CÁLCULO CON PRECISIÓN ABSOLUTA)
    const d = cleanNum(row.d_mm);
    const p = cleanNum(row.p_instr_kn);
    const long_muestra = cleanNum(row.long_de_muestra_mm);

    // Verif. de longitud -> Long. de Muestra (mm) > D (mm)
    row.verif_de_longitud = (long_muestra > d && d > 0) ? "OK" : "Error";

    if (d > 0 && p > 0) {
      // 1. Calcular valores intermedios brutos (Doble Precisión de JS)
      const is_raw = (p * 1000) / (d * d);              // 3.8626222...
      const fact_corr_raw = Math.pow(d / 50.0, 0.45);   // 1.0938676...
      const is_50_raw = is_raw * fact_corr_raw;          // 4.2252115...
      const k = parseFloat(row.factor_k as any) || 10.0; // 13.34
      const ucs_raw = is_50_raw * k;                     // 56.3643...

      // 2. Redondear ÚNICAMENTE al guardar/mostrar en las celdas
      row.is_mpa = parseFloat(is_raw.toFixed(2));              // Muestra: 3.86
      row.fact_corr = parseFloat(fact_corr_raw.toFixed(3));    // Muestra: 1.094

      // Is(50) calculado con precisión absoluta ahora da exactamente 4.23 (4.2252... redondeado arriba)
      row.is_50_mpa = parseFloat(is_50_raw.toFixed(2));        // Muestra: 4.23 (¡Corregido!)

      // UCS calculado con precisión absoluta da 56.36
      row.ucs = parseFloat(ucs_raw.toFixed(2));                // Muestra: 56.36
      row.isrm_indice_r = resolveIsrmIndex(row.ucs);
    } else {
      row.is_mpa = 0.0;
      row.fact_corr = 0.0;
      row.is_50_mpa = 0.0;
      row.ucs = 0.0;
      row.isrm_indice_r = 'R0';
    }

    updated[rowIdx] = row as any;
    onEnsayosPltChange(updated);
  }, [ensayos_plt, onEnsayosPltChange, corridas, collar.fecha_registro]);

  const addRow = useCallback(() => {
    const lastRow = ensayos_plt[ensayos_plt.length - 1];
    const newIdx = ensayos_plt.length + 1;
    const newRow: EnsayoPlt = {
      fecha: lastRow ? lastRow.fecha : (collar.fecha_registro || new Date().toISOString().split('T')[0]),
      nro_muestra: `M${newIdx.toString().padStart(2, '0')}`,
      nro_caja: lastRow ? lastRow.nro_caja : 1,
      from_m: lastRow ? lastRow.to_m : 0.0,
      to_m: lastRow ? lastRow.to_m + 0.15 : 0.15,
      verif_corrida: 'OK',
      long_de_corrida_m: 1.5,
      este_m: collar.collar_este || 0.0,
      norte_m: collar.collar_norte || 0.0,
      elevacion_msnm: collar.collar_cota || 0.0,
      long_de_muestra_mm: 150.0,
      tipo_de_ensayo: 'D',
      diametro_taladro_nominacion: lastRow ? lastRow.diametro_taladro_nominacion : 'HQ',
      d_mm: lastRow ? lastRow.d_mm : 61.1,
      verif_de_longitud: 'OK',
      p_instr_kn: 0.0,
      tipo_rotura_code: 'M',
      direccion_rotura_code: 'NA',
      ejecutadoPor: lastRow ? lastRow.ejecutadoPor : 'CBA',
      is_mpa: 0.0,
      fact_corr: 1.094,
      is_50_mpa: 0.0,
      factor_k: 8.29,
      ucs: 0.0,
      isrm_indice_r: 'R0',
      observaciones: '',
      corrida_desde: lastRow ? lastRow.corrida_desde : 0.0,
      corrida_hasta: lastRow ? lastRow.corrida_hasta : 1.5,
      litologia_1: 'MZB',
      litologia_2: 'MZB',
      litologia_3: 'MZB_EQ',
      tipo_litologico: 'Intrusivas'
    };

    const newRows = [...ensayos_plt, newRow];
    onEnsayosPltChange(newRows);
    onSelectRow(newRows.length - 1);

    setTimeout(() => {
      const nextId = `plt-cell-${ensayos_plt.length}-nro_muestra`;
      const el = document.getElementById(nextId) as HTMLInputElement;
      if (el) { el.focus(); el.select(); }
    }, 100);
  }, [ensayos_plt, onEnsayosPltChange, collar, onSelectRow]);

  const deleteRow = useCallback((rowIdx: number) => {
    const updated = ensayos_plt.filter((_, idx) => idx !== rowIdx);
    onEnsayosPltChange(updated);
    if (selectedRowIndex === rowIdx) {
      onSelectRow(updated.length > 0 ? 0 : null);
    } else if (selectedRowIndex !== null && selectedRowIndex > rowIdx) {
      onSelectRow(selectedRowIndex - 1);
    }
  }, [ensayos_plt, onEnsayosPltChange, selectedRowIndex, onSelectRow]);

  const handleExportExcel = useCallback(() => {
    try {
      const campaignVal = collar.name ? collar.name.match(/\d+/)?.[0] || '2026' : '2026';
      const exportRows = ensayos_plt.map((plt) => {
        return {
          'Campaña': campaignVal,
          'Fecha': plt.fecha,
          'Taladro': collar.name || '',
          'Nro Muestra': plt.nro_muestra,
          'Nro Caja': plt.nro_caja,
          'Corrida Desde (m)': plt.corrida_desde || 0,
          'Corrida Hasta (m)': plt.corrida_hasta || 0,
          'From': plt.from_m,
          'To': plt.to_m,
          'Verif. corrida': plt.verif_corrida,
          'Long. de Corrida (m)': plt.long_de_corrida_m,
          'Este (m)': plt.este_m,
          'Norte (m)': plt.norte_m,
          'Elevación (msnm)': plt.elevacion_msnm,
          'Long. de Muestra (mm)': plt.long_de_muestra_mm,
          'Tipo de Ensayo': plt.tipo_de_ensayo,
          'Diametro de Taladro': plt.diametro_taladro_nominacion,
          'Litologia 1': plt.litologia_1 || '',
          'Litologia 2': plt.litologia_2 || '',
          'Litologia 3': plt.litologia_3 || '',
          'Tipo litológico': plt.tipo_litologico || '',
          'D (mm)': plt.d_mm,
          'Verif. de longitud': plt.verif_de_longitud,
          'P instr (kN)': plt.p_instr_kn,
          'Tipo de Rotura': plt.tipo_rotura_code,
          'Dirección de rotura': plt.direccion_rotura_code,
          'Ejecutado por': plt.ejecutadoPor,
          'Is (Mpa)': plt.is_mpa,
          'Fact. Corr': plt.fact_corr,
          'Is(50) (Mpa)': plt.is_50_mpa,
          'Factor K': plt.factor_k || '',
          'UCS': plt.ucs,
          'ISRM Indice R': plt.isrm_indice_r,
          'Observaciones': plt.observaciones || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ENSAYO PLT');
      XLSX.writeFile(wb, `${collar.name || 'TALADRO'}_Ensayos_PLT.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Error al exportar los datos a Excel.');
    }
  }, [ensayos_plt, collar]);

  return {
    activeSubTab,
    setActiveSubTab,
    isImportModalOpen,
    setIsImportModalOpen,
    selectedRowIndex,
    setSelectedRowIndex: onSelectRow,
    handleCellChange,
    addRow,
    deleteRow,
    handleExportExcel
  };
}
