import React, { useState, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  FileSpreadsheet,
  Upload,
  Check,
  CheckCircle2,
  AlertTriangle,
  Info,
  Filter,
  ArrowRight,
  RefreshCw,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  EXPECTED_FIELDS,
  EXPECTED_STRUCT_FIELDS,
  EXPECTED_PLT_FIELDS,
  EXPECTED_SURVEY_FIELDS,
  findHeaderRowGeneric,
  suggestMappingGeneric,
  processExcelDataGeneric,
  type ImportSummary
} from '../../utils/excelMapper';
import {
  LITHOLOGY_CATALOG,
  STRENGTH_CATALOG,
  GROUNDWATER_CATALOG,
  RELLENO_CATALOG,
  STRUCTURE_CATALOG,
  resolveLithologyCascade,
  normalizeStrength
} from '../../utils/catalogData';

interface InfoBannerProps {
  title: string;
  description: React.ReactNode;
}

function InfoBanner({ title, description }: InfoBannerProps) {
  return (
    <div className="flex gap-3.5 p-4 rounded-xl bg-blue-500/5 dark:bg-cyan-950/20 border border-blue-500/20 dark:border-cyan-500/20 text-xs text-slate-300 leading-relaxed shadow-sm">
      <Info className="text-blue-500 dark:text-cyan-400 shrink-0 mt-0.5" size={16} />
      <div>
        <span className="font-bold text-slate-200 block mb-0.5">{title}</span>
        <span>{description}</span>
      </div>
    </div>
  );
}

export interface BatchImportItem {
  name: string;
  rows: any[];
  isNew: boolean;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTaladroName: string;
  existingTaladrosNames?: string[];
  importType?: 'LGG' | 'STRUCT' | 'PLT' | 'SURVEY';
  onImport: (importedRows: any[], createNewWithName?: string, batchTaladros?: BatchImportItem[]) => void;
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  activeTaladroName,
  existingTaladrosNames = [],
  importType = 'LGG',
  onImport
}: ExcelImportModalProps) {
  if (!isOpen) return null;

  // Se fuerza el casteo para evitar el estrechamiento de tipos de TS causado por el valor por defecto
  const currentImportType = importType as 'LGG' | 'STRUCT' | 'PLT' | 'SURVEY';

  const expectedFields =
    currentImportType === 'STRUCT' ? EXPECTED_STRUCT_FIELDS :
      currentImportType === 'PLT' ? EXPECTED_PLT_FIELDS :
        currentImportType === 'SURVEY' ? EXPECTED_SURVEY_FIELDS :
          EXPECTED_FIELDS;

  const requiredRowCheckKeys =
    currentImportType === 'STRUCT' ? ['profundidad'] :
      currentImportType === 'PLT' ? ['nro_muestra', 'from_m', 'to_m'] :
        currentImportType === 'SURVEY' ? ['depth'] :
          ['de', 'a'];

  // File loading states
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Parsed workbook data
  const [rawGrid, setRawGrid] = useState<any[][] | null>(null);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);

  // Mapping state: EXPECTED_FIELD_KEY -> EXCEL_COLUMN_INDEX
  const [mappings, setMappings] = useState<Record<string, number>>({});

  // Grouped summary data
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  // Filter settings
  const [excelTaladroFilter, setExcelTaladroFilter] = useState<string>('');
  const [importDestination, setImportDestination] = useState<'active' | 'new'>('active');

  // Selección Múltiple de Taladros en Excel: excelName -> { selected: boolean, targetName: string }
  const [selectedTaladrosMap, setSelectedTaladrosMap] = useState<Record<string, { selected: boolean; targetName: string }>>({});

  // Double confirmation & Success overlays
  const [showWarningOverlay, setShowWarningOverlay] = useState(false);
  const [warningTitle, setWarningTitle] = useState('Revisión de Importación');
  const [missingFieldsToWarn, setMissingFieldsToWarn] = useState<string[]>([]);
  const [isPerformanceWarnActive, setIsPerformanceWarnActive] = useState(false);
  const [pendingRows, setPendingRows] = useState<any[]>([]);

  // Confirmation step & Final Success Modal states
  const [showConfirmOverlay, setShowConfirmOverlay] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [pendingBatchTaladros, setPendingBatchTaladros] = useState<BatchImportItem[] | null>(null);
  const [pendingSingleRows, setPendingSingleRows] = useState<any[]>([]);
  const [pendingCreateNewWithName, setPendingCreateNewWithName] = useState<string | undefined>(undefined);
  const [importSummaryDetails, setImportSummaryDetails] = useState<{
    taladrosCount: number;
    rowsCount: number;
    details: { excelName?: string; targetName: string; rows: number; isNew: boolean }[];
  } | null>(null);

  const parseYearAndNumber = (name: string) => {
    const clean = name.toUpperCase().trim();
    const segments = clean.match(/\d+/g);
    if (!segments || segments.length === 0) {
      return { year: null, holeNumber: null };
    }
    let year: number | null = null;
    let holeNumber: number | null = null;

    if (segments.length >= 2) {
      const firstNum = parseInt(segments[0], 10);
      const lastNum = parseInt(segments[segments.length - 1], 10);
      year = firstNum >= 100 ? firstNum % 100 : firstNum;
      holeNumber = lastNum;
    } else if (segments.length === 1) {
      const numStr = segments[0];
      if (numStr.length >= 5) {
        if (numStr.startsWith('20') && numStr.length >= 7) {
          const yearPart = parseInt(numStr.substring(0, 4), 10);
          year = yearPart % 100;
          holeNumber = parseInt(numStr.substring(4), 10);
        } else {
          const yearPart = parseInt(numStr.substring(0, 2), 10);
          year = yearPart;
          holeNumber = parseInt(numStr.substring(2), 10);
        }
      } else {
        holeNumber = parseInt(numStr, 10);
      }
    }
    return { year, holeNumber };
  };

  const isTaladroMatch = (name1: string, name2: string): boolean => {
    const clean1 = name1.toUpperCase().trim();
    const clean2 = name2.toUpperCase().trim();
    if (clean1 === clean2) return true;

    const p1 = parseYearAndNumber(clean1);
    const p2 = parseYearAndNumber(clean2);

    if (p1.year === null || p2.year === null || p1.holeNumber === null || p2.holeNumber === null) {
      const d1 = clean1.replace(/[^0-9]/g, '');
      const d2 = clean2.replace(/[^0-9]/g, '');
      return d1.length > 0 && d1 === d2;
    }

    return p1.year === p2.year && p1.holeNumber === p2.holeNumber;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse Excel file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    loadWorkbook(selectedFile);
  };

  const loadWorkbook = (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        setSheets(workbook.SheetNames);
        // Default to first sheet or primary geotech sheet
        const defaultSheet = workbook.SheetNames.find(name => {
          const upper = name.toUpperCase();
          if (currentImportType === 'STRUCT') {
            return upper.includes('STRUCT') || upper.includes('ESTRUCT') || upper.includes('EST');
          }
          if (currentImportType === 'PLT') {
            return upper.includes('PLT') || upper.includes('ENSAYO');
          }
          if (currentImportType === 'SURVEY') {
            return upper.includes('SURVEY') || upper.includes('TRAYECTORIA') || upper.includes('DESVIACION') || upper.includes('MEDICION');
          }
          return upper.includes('LGG') || upper.includes('LOGUEO') || upper.includes('GENERAL');
        }) || workbook.SheetNames[0];

        setSelectedSheet(defaultSheet);
        parseSheet(workbook, defaultSheet);
      } catch (err) {
        alert("Error al procesar el archivo Excel. Asegúrate de que sea un archivo válido.");
        console.error(err);
        resetState();
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const parseSheet = (workbook: XLSX.WorkBook, sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    // Convert sheet to 2D array grid (raw data)
    const dataGrid: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    if (dataGrid.length === 0) {
      alert("La hoja seleccionada está vacía.");
      return;
    }

    setRawGrid(dataGrid);

    // 1. Detect header row
    const detectedHeaderIdx = findHeaderRowGeneric(dataGrid, expectedFields);
    setHeaderRowIdx(detectedHeaderIdx);

    // 2. Extract column header strings (letters + labels)
    const headerRow = dataGrid[detectedHeaderIdx] || [];
    const headers = headerRow.map((cellVal, index) => {
      const colLetter = XLSX.utils.encode_col(index);
      const label = cellVal !== null && cellVal !== undefined ? String(cellVal).trim() : '';
      return label ? `${colLetter}: ${label}` : `${colLetter}: [Vacía]`;
    });
    setExcelHeaders(headers);

    // 3. Suggest mapping
    const rawHeadersOnly = headerRow.map(c => c !== null && c !== undefined ? String(c) : '');
    const suggested = suggestMappingGeneric(rawHeadersOnly, expectedFields);
    setMappings(suggested);

    // 4. Group and summarize rows
    const sum = processExcelDataGeneric(dataGrid, detectedHeaderIdx, suggested, expectedFields, requiredRowCheckKeys);
    setSummary(sum);

    // 5. Inicializar mapa de selección multi-taladro
    const initialMap: Record<string, { selected: boolean; targetName: string }> = {};
    sum.uniqueTaladros.forEach(tName => {
      const isMatchActive = isTaladroMatch(tName, activeTaladroName);
      initialMap[tName] = {
        selected: true,
        targetName: isMatchActive ? activeTaladroName : tName.trim().toUpperCase()
      };
    });
    setSelectedTaladrosMap(initialMap);

    // Suggest matching drillhole by name if possible
    const bestTaladroMatch = sum.uniqueTaladros.find(t =>
      t.toLowerCase().includes(activeTaladroName.toLowerCase()) ||
      activeTaladroName.toLowerCase().includes(t.toLowerCase())
    ) || sum.uniqueTaladros[0] || '';
    setExcelTaladroFilter(bestTaladroMatch);
    setImportDestination(isTaladroMatch(bestTaladroMatch, activeTaladroName) ? 'active' : 'new');
  };

  // Re-process rows when mappings change
  const handleMappingChange = (fieldKey: string, colIdx: number) => {
    if (!rawGrid) return;

    const updatedMappings = { ...mappings };

    // Enforce uniqueness: if this column was mapped to another field, clear it
    if (colIdx !== -1) {
      Object.keys(updatedMappings).forEach(key => {
        if (updatedMappings[key] === colIdx && key !== fieldKey) {
          delete updatedMappings[key];
        }
      });
      updatedMappings[fieldKey] = colIdx;
    } else {
      delete updatedMappings[fieldKey];
    }

    setMappings(updatedMappings);

    // Re-run grouping on new mappings
    const sum = processExcelDataGeneric(rawGrid, headerRowIdx, updatedMappings, expectedFields, requiredRowCheckKeys);
    setSummary(sum);
  };

  const formatPreviewNum = (val: any, decimals: number = 2): string => {
    if (val === undefined || val === null || val === '') return '—';
    const num = parseFloat(val);
    if (isNaN(num)) return String(val);
    if (num === -1) return '-1';
    const factor = Math.pow(10, decimals);
    return String(Math.round((num + Number.EPSILON) * factor) / factor);
  };

  const getTaladroValidationStatus = useCallback((_excelName: string, targetName: string) => {
    const cleanTarget = targetName.trim().toUpperCase();
    if (!cleanTarget) {
      return { isError: true, text: 'Nombre requerido', bg: 'bg-red-500/10 border-red-500/30 text-red-400' };
    }

    if (cleanTarget === activeTaladroName.toUpperCase()) {
      return { isError: false, text: 'Taladro Activo (Actualiza corridas)', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' };
    }

    const existsInDb = (existingTaladrosNames || []).some(n => n.toUpperCase() === cleanTarget);
    if (existsInDb) {
      return { isError: true, text: 'Existe en BD (Debes renombrarlo)', bg: 'bg-red-500/10 border-red-500/30 text-red-400' };
    }

    // Check duplicate among selected items
    const selectedTargets = Object.entries(selectedTaladrosMap)
      .filter(([_, v]) => v.selected)
      .map(([_, v]) => v.targetName.trim().toUpperCase());
    const countInSelection = selectedTargets.filter(t => t === cleanTarget).length;
    if (countInSelection > 1) {
      return { isError: true, text: 'Nombre duplicado en selección', bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400' };
    }

    return { isError: false, text: 'Listo para crear e importar', bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' };
  }, [activeTaladroName, existingTaladrosNames, selectedTaladrosMap]);

  const isImportBlocked = useMemo(() => {
    if (currentImportType === 'LGG' && summary) {
      const selectedEntries = Object.entries(selectedTaladrosMap).filter(([_, v]) => v.selected);
      if (selectedEntries.length === 0) return true;
      return selectedEntries.some(([excelName, cfg]) => getTaladroValidationStatus(excelName, cfg.targetName).isError);
    }
    return (
      (currentImportType === 'STRUCT' || currentImportType === 'PLT' || currentImportType === 'SURVEY') &&
      excelTaladroFilter.trim() !== '' &&
      !isTaladroMatch(excelTaladroFilter, activeTaladroName)
    );
  }, [currentImportType, summary, selectedTaladrosMap, activeTaladroName, existingTaladrosNames, excelTaladroFilter, getTaladroValidationStatus]);

  // Parse preview rows based on current mappings
  const getPreviewRows = () => {
    if (!summary || !excelTaladroFilter) return [];
    const filteredRawRows = summary.rowsByTaladro[excelTaladroFilter] || [];
    return filteredRawRows.slice(0, 5);
  };

  const processExcelRowsToCorridas = (rawRows: any[]): any[] => {
    const findCatalogKey = (val: any, catalog: Record<string, any>, fallback: string): string => {
      const cleaned = String(val || '').trim();
      if (!cleaned || cleaned === '-1' || cleaned.toUpperCase() === 'NONE') return fallback;
      if (catalog === STRENGTH_CATALOG) {
        const norm = normalizeStrength(cleaned);
        if (norm !== '-1') return norm;
      }
      const matched = Object.keys(catalog).find(k => k.toLowerCase() === cleaned.toLowerCase());
      return matched || fallback;
    };

    const findOption = (val: any, options: string[], fallback: string): string => {
      const cleaned = String(val || '').trim();
      if (!cleaned || cleaned === '-1' || cleaned.toUpperCase() === 'NONE') return fallback;
      const matched = options.find(o => o.toLowerCase() === cleaned.toLowerCase());
      return matched || fallback;
    };

    const parseRound = (val: any, fallback: number = 0, decimals: number = 2): number => {
      if (val === undefined || val === null || val === '') return fallback;
      const num = parseFloat(val);
      if (isNaN(num)) return fallback;
      if (num === -1) return -1;
      const factor = Math.pow(10, decimals);
      return Math.round((num + Number.EPSILON) * factor) / factor;
    };

    return rawRows.map((r, index) => {
      const de = parseRound(r.de, 0);
      const a = parseRound(r.a, 0);
      const rec = parseRound(r.rec_m, 0);
      const rqd = parseRound(r.rqd_m, 0);
      const lrf = parseRound(r.lrf_m, 0);
      const small = parseRound(r.small_frag_m, 0);

      const fn = parseInt(r.frac_nat) || 0;
      const f30 = parseInt(r.frac_buz30) || 0;
      const f60 = parseInt(r.frac_buz60) || 0;
      const f90 = parseInt(r.frac_buz90) || 0;

      const rawLito1 = findCatalogKey(r.lito1, LITHOLOGY_CATALOG, 'LMT');
      const rawLito2 = findCatalogKey(r.lito2, LITHOLOGY_CATALOG, '-1');
      const rawLito3 = findCatalogKey(r.lito3, LITHOLOGY_CATALOG, '-1');

      const resCascade = resolveLithologyCascade(
        rawLito1,
        rawLito2 === "-1" ? "-" : rawLito2,
        rawLito3 === "-1" ? "-" : rawLito3,
        'lito1',
        rawLito1
      );
      const lito1 = resCascade.lito1;
      const lito2 = resCascade.lito2 === "-" ? "-1" : resCascade.lito2;
      const lito3 = resCascade.lito3 === "-" ? "-1" : resCascade.lito3;
      const resist = findCatalogKey(r.resistencia, STRENGTH_CATALOG, '-1');
      const orient = findOption(r.orientacion, ["N", "S", "X"], 'X');
      const est1 = findCatalogKey(r.tipo_est1, STRUCTURE_CATALOG, '-1');
      const est2 = findCatalogKey(r.tipo_est2, STRUCTURE_CATALOG, '-1');
      const weathering = findOption(r.intemperismo, ["UWF", "SWD", "MWM", "HWA", "CWC", "RS", "-1"], '-1');
      const rel1 = findCatalogKey(r.relleno1, RELLENO_CATALOG, '-1');
      const rel2 = findCatalogKey(r.relleno2, RELLENO_CATALOG, '-1');

      const abertura = parseRound(r.abertura, 0);
      const rugosidad = parseInt(r.rugosidad) || 1;
      const jrc = parseInt(r.jrc10) || 10;
      const espesor = parseRound(r.espesor, 0);
      const agua = findCatalogKey(r.agua_obs, GROUNDWATER_CATALOG, 'CDC');

      const rawTurno = String(r.turno || '').trim().toUpperCase();
      const turno = (rawTurno === 'DIA' || rawTurno === 'D' || rawTurno === 'DAY') ? 'D' : (rawTurno === 'NOCHE' || rawTurno === 'N' || rawTurno === 'NIGHT') ? 'N' : 'D';

      const comentarios = String(r.comentarios || '').trim();

      return {
        corrida: index + 1,
        de,
        a,
        rec_m: rec,
        rqd_m: rqd,
        lrf_m: lrf,
        small_frag_m: small,
        lito1,
        lito2,
        lito3,
        resistencia: resist,
        orientacion: orient,
        offset: parseRound(r.offset, 0),
        tipo_est1: est1,
        tipo_est2: est2,
        frac_nat: fn,
        frac_buz30: f30,
        frac_buz60: f60,
        frac_buz90: f90,
        abertura,
        rugosidad,
        jrc10: jrc,
        intemperismo: weathering,
        relleno1: rel1,
        relleno2: rel2,
        espesor,
        agua_obs: agua,
        turno,
        comentarios: (comentarios === 'None' || comentarios === 'null') ? '' : comentarios
      };
    });
  };

  const getFilteredRowsToImport = (): any[] => {
    if (!summary || !excelTaladroFilter) return [];
    return summary.rowsByTaladro[excelTaladroFilter] || [];
  };

  const prepareAndOpenConfirmation = (batchTaladros?: BatchImportItem[], singleRows?: any[]) => {
    if (batchTaladros && batchTaladros.length > 0) {
      setPendingBatchTaladros(batchTaladros);
      setPendingSingleRows([]);
      setPendingCreateNewWithName(undefined);
      setImportSummaryDetails({
        taladrosCount: batchTaladros.length,
        rowsCount: batchTaladros.reduce((sum, item) => sum + item.rows.length, 0),
        details: batchTaladros.map(item => ({
          excelName: item.name,
          targetName: item.name,
          rows: item.rows.length,
          isNew: item.isNew
        }))
      });
    } else if (singleRows && singleRows.length > 0) {
      setPendingBatchTaladros(null);
      setPendingSingleRows(singleRows);
      const createNewWithName = importDestination === 'new' ? excelTaladroFilter : undefined;
      const targetName = importDestination === 'new' ? excelTaladroFilter : activeTaladroName;
      setPendingCreateNewWithName(createNewWithName);
      setImportSummaryDetails({
        taladrosCount: 1,
        rowsCount: singleRows.length,
        details: [{
          excelName: excelTaladroFilter,
          targetName,
          rows: singleRows.length,
          isNew: importDestination === 'new'
        }]
      });
    }
    setShowWarningOverlay(false);
    setShowConfirmOverlay(true);
  };

  const executeFinalImport = () => {
    if (pendingBatchTaladros && pendingBatchTaladros.length > 0) {
      onImport([], undefined, pendingBatchTaladros);
    } else if (pendingSingleRows && pendingSingleRows.length > 0) {
      executeImport(pendingSingleRows, pendingCreateNewWithName);
    }
    setShowConfirmOverlay(false);
    setShowSuccessOverlay(true);
  };

  const handleConfirmImport = () => {
    if (currentImportType === 'LGG' && summary) {
      const selectedEntries = Object.entries(selectedTaladrosMap).filter(([_, v]) => v.selected);
      if (selectedEntries.length === 0) {
        alert("Selecciona al menos un taladro para importar.");
        return;
      }

      const hasErrors = selectedEntries.some(([excelName, cfg]) => getTaladroValidationStatus(excelName, cfg.targetName).isError);
      if (hasErrors) {
        alert("Existen taladros seleccionados con errores de nombre o duplicidad. Corrígelos antes de confirmar.");
        return;
      }

      const batchTaladros: BatchImportItem[] = selectedEntries.map(([excelName, cfg]) => {
        const rawRowsForThisTal = summary.rowsByTaladro[excelName] || [];
        const processedRows = processExcelRowsToCorridas(rawRowsForThisTal);
        const finalTargetName = cfg.targetName.trim().toUpperCase();
        return {
          name: finalTargetName,
          rows: processedRows,
          isNew: finalTargetName !== activeTaladroName.toUpperCase()
        };
      });

      prepareAndOpenConfirmation(batchTaladros);
      return;
    }

    const rowsToImport = getFilteredRowsToImport();

    if (rowsToImport.length === 0) {
      alert("No hay registros válidos para importar con el taladro seleccionado.");
      return;
    }

    const missingFields: string[] = [];
    expectedFields.forEach(field => {
      let isOptionalIgnored = false;
      if (currentImportType === 'STRUCT') {
        isOptionalIgnored = field.key === 'beta' || field.key === 'jrc10' || field.key === 'relleno2' || field.key === 'comentario' || field.key === 'tipo';
      } else if (currentImportType === 'PLT') {
        isOptionalIgnored = field.key === 'fecha' || field.key === 'este_m' || field.key === 'norte_m' || field.key === 'elevacion_msnm' || field.key === 'diametro_taladro_nominacion' || field.key === 'tipo_rotura_code' || field.key === 'direccion_rotura_code' || field.key === 'ejecutadoPor' || field.key === 'observaciones' || field.key === 'corrida_desde' || field.key === 'corrida_hasta';
      } else if (currentImportType === 'SURVEY') {
        isOptionalIgnored = false;
      } else {
        isOptionalIgnored = field.key === 'campana' || field.key === 'turno' || field.key === 'comentarios';
      }
      if (!isOptionalIgnored && mappings[field.key] === undefined) {
        missingFields.push(field.label);
      }
    });

    const isLarge = rowsToImport.length > 200;
    const hasMissing = missingFields.length > 0;

    // VALIDACIONES ESPECÍFICAS PARA PLT
    const pltWarnings: string[] = [];
    if (currentImportType === 'PLT') {
      rowsToImport.forEach((row, idx) => {
        const f = parseFloat(row.from_m) || 0;
        const t = parseFloat(row.to_m) || 0;
        const d = parseFloat(row.d_mm) || 0;
        const p = parseFloat(row.p_instr_kn) || 0;
        if (f >= t) {
          pltWarnings.push(`Fila ${idx + 1}: Rango de intervalo incoherente (From: ${f}m >= To: ${t}m).`);
        }
        if (d <= 0) {
          pltWarnings.push(`Fila ${idx + 1}: Diámetro 'D' nulo o negativo (${d} mm).`);
        }
        if (p <= 0) {
          pltWarnings.push(`Fila ${idx + 1}: Carga 'P instr' nula o negativa (${p} kN).`);
        }
      });
    }

    if (hasMissing || isLarge || pltWarnings.length > 0) {
      let title = "Confirmar Importación";
      if (pltWarnings.length > 0) {
        title = "Inconsistencias Físicas Detectadas en PLT";
      } else if (hasMissing && isLarge) {
        title = "Revisión de Mapeo y Rendimiento";
      } else if (hasMissing) {
        title = "Revisión de Mapeo de Columnas";
      } else {
        title = "Advertencia de Rendimiento";
      }

      setWarningTitle(title);
      setMissingFieldsToWarn(missingFields.concat(pltWarnings));
      setIsPerformanceWarnActive(isLarge);
      setPendingRows(rowsToImport);
      setShowWarningOverlay(true);
    } else {
      prepareAndOpenConfirmation(undefined, rowsToImport);
    }
  };

  const executeImport = (rows: any[], targetCreateNewWithName?: string) => {
    // Case-insensitive catalog matchers
    const findCatalogKey = (val: any, catalog: Record<string, any>, fallback: string): string => {
      const cleaned = String(val || '').trim();
      if (!cleaned || cleaned === '-1' || cleaned.toUpperCase() === 'NONE') return fallback;
      if (catalog === STRENGTH_CATALOG) {
        const norm = normalizeStrength(cleaned);
        if (norm !== '-1') return norm;
      }
      const matched = Object.keys(catalog).find(k => k.toLowerCase() === cleaned.toLowerCase());
      return matched || fallback;
    };

    const findOption = (val: any, options: string[], fallback: string): string => {
      const cleaned = String(val || '').trim();
      if (!cleaned || cleaned === '-1' || cleaned.toUpperCase() === 'NONE') return fallback;
      const matched = options.find(o => o.toLowerCase() === cleaned.toLowerCase());
      return matched || fallback;
    };

    const parseRound = (val: any, fallback: number = 0, decimals: number = 2): number => {
      if (val === undefined || val === null || val === '') return fallback;
      const num = parseFloat(val);
      if (isNaN(num)) return fallback;
      if (num === -1) return -1;
      const factor = Math.pow(10, decimals);
      return Math.round((num + Number.EPSILON) * factor) / factor;
    };

    // Función auxiliar para normalizar formatos de fecha de Excel a "YYYY-MM-DD"
    const parseExcelDate = (val: any): string => {
      if (val === undefined || val === null || val === '') {
        return new Date().toISOString().split('T')[0];
      }

      // Caso 1: Si es un objeto Date de JS
      if (val instanceof Date && !isNaN(val.getTime())) {
        return val.toISOString().split('T')[0];
      }

      // Caso 2: Si es un número serial de Excel (ej: 44064)
      const num = Number(val);
      if (!isNaN(num) && num > 10000 && num < 100000) {
        const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
        if (!isNaN(jsDate.getTime())) {
          return jsDate.toISOString().split('T')[0];
        }
      }

      // Caso 3: Si es un string (ej: "21/08/2020", "2020-08-21")
      const str = String(val).trim();
      const parts = str.split(/[\/\-\s]/);
      if (parts.length >= 3) {
        const p0 = parts[0];
        const p1 = parts[1];
        const p2 = parts[2];

        // Caso YYYY-MM-DD o YYYY/MM/DD
        if (p0.length === 4) {
          const year = p0;
          const month = p1.padStart(2, '0');
          const day = p2.slice(0, 2).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }

        // Caso DD/MM/YYYY o MM/DD/YYYY
        if (p2.length >= 4) {
          const year = p2.slice(0, 4);
          const val0 = parseInt(p0, 10);
          const val1 = parseInt(p1, 10);

          let day = String(val0).padStart(2, '0');
          let month = String(val1).padStart(2, '0');

          // Si el segundo elemento es mayor a 12, asumimos formato MM/DD/YYYY
          if (val1 > 12 && val0 <= 12) {
            day = String(val1).padStart(2, '0');
            month = String(val0).padStart(2, '0');
          }

          return `${year}-${month}-${day}`;
        }
      }

      // Fallback genérico para strings
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }

      return new Date().toISOString().split('T')[0];
    };

    if (currentImportType === 'STRUCT') {
      const standardRows = rows.map((r, index) => {
        const profundidad = parseRound(r.profundidad, 0);
        const alfa = parseRound(r.alfa, 45.0);
        const beta = parseRound(r.beta, -1);
        const forma = parseInt(r.forma) || 4;
        const rugosidad = parseInt(r.rugosidad) || 2;
        const jrc = parseInt(r.jrc10) || 10;
        const abertura = parseRound(r.abertura, 0.1);
        const weathering = findOption(r.weathering, ["UWF", "SWD", "MWM", "HWA", "CWC", "RS", "-1"], 'UWF');
        const espesor = parseRound(r.espesor, 0);
        const rel1 = findCatalogKey(r.relleno1, RELLENO_CATALOG, 'cwf');
        const rel2 = findCatalogKey(r.relleno2, RELLENO_CATALOG, '-1');
        const dureza = findCatalogKey(r.dureza_pared, STRENGTH_CATALOG, 'R4');
        const agua = findCatalogKey(r.agua, GROUNDWATER_CATALOG, 'CDC');
        const geotecnico = String(r.geotecnico || '').trim();
        const comentario = String(r.comentario || '').trim();
        const tipo = findOption(r.tipo, ["Natural", "Mecánica"], 'Natural');
        const tipo_est = findCatalogKey(r.tipo_estructura, STRUCTURE_CATALOG, 'JN');

        return {
          id: index + 1,
          profundidad,
          tipo_estructura: tipo_est,
          alfa,
          beta,
          forma,
          rugosidad,
          jrc10: jrc,
          abertura,
          weathering,
          espesor,
          relleno1: rel1,
          relleno2: rel2,
          dureza_pared: dureza,
          agua,
          geotecnico,
          comentario: (comentario === 'None' || comentario === 'null') ? '' : comentario,
          tipo
        };
      });
      onImport(standardRows);
      onClose();
      return;
    }

    if (currentImportType === 'SURVEY') {
      const standardRows = rows.map((r) => {
        const depth = parseRound(r.depth, 0);
        const dip = parseRound(r.dip, 0);
        const azimuth = parseRound(r.azimuth, 0);
        return {
          depth,
          dip,
          azimuth
        };
      });
      onImport(standardRows);
      onClose();
      return;
    }

    if (currentImportType === 'PLT') {
      const standardRows = rows.map((r, index) => {
        const from_m = parseRound(r.from_m, 0);
        const to_m = parseRound(r.to_m, 0);
        const nro_muestra = String(r.nro_muestra || `M${(index + 1).toString().padStart(2, '0')}`).trim();
        const nro_caja = parseInt(r.nro_caja) || 1;
        const este = parseRound(r.este_m, 0);
        const norte = parseRound(r.norte_m, 0);
        const elev = parseRound(r.elevacion_msnm, 0);
        const tipo_ensayo = findOption(r.tipo_de_ensayo, ['D', 'A', 'B', 'I'], 'D');
        const diam_nomin = findOption(r.diametro_taladro_nominacion, ['BQ', 'NQ', 'HQ', 'PQ'], 'HQ');
        const d_mm = parseRound(r.d_mm, 61.1);
        const p_kn = parseRound(r.p_instr_kn, 0, 3);
        const rotura = findOption(r.tipo_rotura_code, ['M', 'E', 'C'], 'M');
        const dir_rot = findOption(r.direccion_rotura_code, ['Pa', 'Pe', 'NA'], 'NA');
        const ejecutado = String(r.ejecutadoPor || '').trim();
        const obs = String(r.observaciones || '').trim();

        const c_desde = r.corrida_desde !== undefined ? parseRound(r.corrida_desde, 0) : undefined;
        const c_hasta = r.corrida_hasta !== undefined ? parseRound(r.corrida_hasta, 0) : undefined;

        return {
          fecha: parseExcelDate(r.fecha),
          nro_muestra,
          nro_caja,
          from_m,
          to_m,
          este_m: este,
          norte_m: norte,
          elevacion_msnm: elev,
          tipo_de_ensayo: tipo_ensayo,
          diametro_taladro_nominacion: diam_nomin,
          d_mm,
          p_instr_kn: p_kn,
          tipo_rotura_code: rotura,
          direccion_rotura_code: dir_rot,
          ejecutadoPor: ejecutado,
          observaciones: (obs === 'None' || obs === 'null') ? '' : obs,
          corrida_desde: c_desde,
          corrida_hasta: c_hasta
        };
      });
      onImport(standardRows);
      onClose();
      return;
    }

    // Convert imported raw records to standard frontend Corrida objects (LGG)
    const standardRows = rows.map((r, index) => {
      // Parse values or fallback to default geotech values
      const de = parseRound(r.de, 0);
      const a = parseRound(r.a, 0);
      const rec = parseRound(r.rec_m, 0);
      const rqd = parseRound(r.rqd_m, 0);
      const lrf = parseRound(r.lrf_m, 0);
      const small = parseRound(r.small_frag_m, 0);

      // Natural fractures and bins
      const fn = parseInt(r.frac_nat) || 0;
      const f30 = parseInt(r.frac_buz30) || 0;
      const f60 = parseInt(r.frac_buz60) || 0;
      const f90 = parseInt(r.frac_buz90) || 0;

      // Clean text lists/codes using case-insensitive dictionary lookup
      const rawLito1 = findCatalogKey(r.lito1, LITHOLOGY_CATALOG, 'LMT');
      const rawLito2 = findCatalogKey(r.lito2, LITHOLOGY_CATALOG, '-1');
      const rawLito3 = findCatalogKey(r.lito3, LITHOLOGY_CATALOG, '-1');

      const resCascade = resolveLithologyCascade(
        rawLito1,
        rawLito2 === "-1" ? "-" : rawLito2,
        rawLito3 === "-1" ? "-" : rawLito3,
        'lito1',
        rawLito1
      );
      const lito1 = resCascade.lito1;
      const lito2 = resCascade.lito2 === "-" ? "-1" : resCascade.lito2;
      const lito3 = resCascade.lito3 === "-" ? "-1" : resCascade.lito3;
      const resist = findCatalogKey(r.resistencia, STRENGTH_CATALOG, '-1');
      const orient = findOption(r.orientacion, ["N", "S", "X"], 'X');
      const est1 = findCatalogKey(r.tipo_est1, STRUCTURE_CATALOG, '-1');
      const est2 = findCatalogKey(r.tipo_est2, STRUCTURE_CATALOG, '-1');
      const weathering = findOption(r.intemperismo, ["UWF", "SWD", "MWM", "HWA", "CWC", "RS", "-1"], '-1');
      const rel1 = findCatalogKey(r.relleno1, RELLENO_CATALOG, '-1');
      const rel2 = findCatalogKey(r.relleno2, RELLENO_CATALOG, '-1');

      const abertura = parseRound(r.abertura, 0);
      const rugosidad = parseInt(r.rugosidad) || 1;
      const jrc = parseInt(r.jrc10) || 10;
      const espesor = parseRound(r.espesor, 0);
      const agua = findCatalogKey(r.agua_obs, GROUNDWATER_CATALOG, 'CDC');

      const rawTurno = String(r.turno || '').trim().toUpperCase();
      const turno = (rawTurno === 'DIA' || rawTurno === 'D' || rawTurno === 'DAY') ? 'D' : (rawTurno === 'NOCHE' || rawTurno === 'N' || rawTurno === 'NIGHT') ? 'N' : 'D';

      const comentarios = String(r.comentarios || '').trim();

      return {
        corrida: index + 1,
        de,
        a,
        rec_m: rec,
        rqd_m: rqd,
        lrf_m: lrf,
        small_frag_m: small,
        lito1,
        lito2,
        lito3,
        resistencia: resist,
        orientacion: orient,
        offset: parseRound(r.offset, 0),
        tipo_est1: est1,
        tipo_est2: est2,
        frac_nat: fn,
        frac_buz30: f30,
        frac_buz60: f60,
        frac_buz90: f90,
        abertura,
        rugosidad,
        jrc10: jrc,
        intemperismo: weathering,
        relleno1: rel1,
        relleno2: rel2,
        espesor,
        agua_obs: agua,
        turno,
        comentarios: (comentarios === 'None' || comentarios === 'null') ? '' : comentarios
      };
    });

    onImport(standardRows, targetCreateNewWithName !== undefined ? targetCreateNewWithName : (importDestination === 'new' ? excelTaladroFilter : undefined));
  };

  const resetState = () => {
    setFile(null);
    setSheets([]);
    setSelectedSheet('');
    setRawGrid(null);
    setExcelHeaders([]);
    setMappings({});
    setSummary(null);
    setExcelTaladroFilter('');
    setImportDestination('active');
    setShowWarningOverlay(false);
    setShowConfirmOverlay(false);
    setShowSuccessOverlay(false);
    setPendingBatchTaladros(null);
    setPendingSingleRows([]);
    setPendingCreateNewWithName(undefined);
    setImportSummaryDetails(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col border border-navy-800 rounded-2xl shadow-2xl relative overflow-hidden bg-navy-900/90">

        {/* Top colorful bar */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 w-full" />

        {/* Head */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-navy-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                Importar desde Excel ({currentImportType})
              </h3>
              <p className="text-xs text-slate-400">
                {currentImportType === 'STRUCT'
                  ? 'Carga de planillas de logueo estructural orientado (LG EST)'
                  : currentImportType === 'PLT'
                    ? 'Carga de planillas de ensayos de carga puntual (PLT)'
                    : 'Carga de planillas de logueo geomecánico por corrida (LGG)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-navy-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Step 1: Upload Dropzone */}
          {!file && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-navy-800 hover:border-emerald-500/40 bg-navy-950/40 hover:bg-navy-950/60 rounded-xl p-8 text-center cursor-pointer transition-all space-y-4 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Upload size={22} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-200">
                    Arrastra tu planilla Excel aquí o haz clic para explorar
                  </p>
                  <p className="text-xs text-slate-500">
                    Soporta formatos estándar de geotecnia (.xlsx, .xls)
                  </p>
                </div>
              </div>
              <InfoBanner
                title="Información Importante"
                description={
                  currentImportType === 'STRUCT'
                    ? "Para importar con éxito, el archivo Excel debe contener las discontinuidades registradas con su profundidad y mediciones. El sistema detectará el layout e intentará mapear las columnas automáticamente."
                    : currentImportType === 'PLT'
                      ? "Para importar con éxito, el archivo Excel debe contener los ensayos de carga puntual con sus dimensiones y cargas. El sistema detectará el layout e intentará mapear las columnas automáticamente."
                      : "Para importar con éxito, el archivo Excel debe contener la información geomecánica estructurada por corridas. No importa si las cabeceras empiezan algunas filas más abajo o si están en un orden diferente, el sistema detectará el layout e intentará mapear las columnas automáticamente."
                }
              />
            </div>
          )}

          {/* Active File info */}
          {file && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-navy-950/60 border border-navy-800/80 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-lg">
                  <FileSpreadsheet size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-200 truncate max-w-md">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {sheets.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hoja:</span>
                    <select
                      value={selectedSheet}
                      onChange={(e) => {
                        setSelectedSheet(e.target.value);
                        // Re-parse sheet
                        setLoading(true);
                        // Wait briefly to show spinner
                        setTimeout(() => {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                            const workbook = XLSX.read(data, { type: 'array' });
                            parseSheet(workbook, e.target.value);
                            setLoading(false);
                          };
                          reader.readAsArrayBuffer(file);
                        }, 50);
                      }}
                      className="bg-navy-900 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      {sheets.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <button
                  onClick={resetState}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors border border-navy-800 hover:border-red-500/20"
                >
                  Cambiar archivo
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw size={24} className="animate-spin text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-500 font-semibold">Procesando y parseando datos del Excel...</p>
            </div>
          )}

          {/* Step 2: Extraction Pre-Filters */}
          {file && !loading && summary && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-300 font-black uppercase tracking-wider text-xs border-b border-navy-800/40 pb-1.5">
                <Filter size={14} className="text-emerald-400" />
                <span>1. Selección y Mapeo de Taladros a Importar</span>
              </div>

              {currentImportType === 'LGG' ? (
                <div className="space-y-4">
                  <InfoBanner
                    title="Selección Múltiple de Taladros y Validación de Duplicados"
                    description={<>Se detectaron <span className="text-slate-200 font-bold">{summary.uniqueTaladros.length} taladros</span> en el archivo Excel ({summary.totalRows} filas). Puedes seleccionar varios taladros para importarlos juntos. Si un nombre ya existe en la base de datos, <strong>debes cambiarle el nombre</strong> en la casilla editable para poder importarlo.</>}
                  />

                  <div className="border border-navy-800 rounded-xl bg-navy-950/40 overflow-hidden">
                    <div className="p-3 bg-navy-900/60 border-b border-navy-800 flex justify-between items-center text-xs">
                      <label className="flex items-center gap-2 font-bold text-slate-200 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={summary.uniqueTaladros.every(t => selectedTaladrosMap[t]?.selected)}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            const newMap = { ...selectedTaladrosMap };
                            summary.uniqueTaladros.forEach(t => {
                              if (newMap[t]) newMap[t].selected = isChecked;
                            });
                            setSelectedTaladrosMap(newMap);
                          }}
                          className="rounded border-navy-700 bg-navy-950 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4"
                        />
                        <span>Seleccionar Todos ({summary.uniqueTaladros.length} taladros)</span>
                      </label>
                      <span className="text-slate-400 text-[11px]">
                        Taladro Activo: <strong className="text-cyan-400">{activeTaladroName}</strong>
                      </span>
                    </div>

                    <div className="max-h-[220px] overflow-y-auto divide-y divide-navy-900/60 text-xs">
                      {summary.uniqueTaladros.map(excelName => {
                        const config = selectedTaladrosMap[excelName] || { selected: true, targetName: excelName };
                        const status = getTaladroValidationStatus(excelName, config.targetName);
                        const rowCount = summary.rowsByTaladro[excelName]?.length || 0;

                        return (
                          <div key={excelName} className={`p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${config.selected ? 'bg-navy-900/20' : 'opacity-60 bg-navy-950/30'}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={config.selected}
                                onChange={(e) => {
                                  setSelectedTaladrosMap({
                                    ...selectedTaladrosMap,
                                    [excelName]: { ...config, selected: e.target.checked }
                                  });
                                }}
                                className="rounded border-navy-700 bg-navy-950 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4 cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-200 block truncate">{excelName}</span>
                                <span className="text-[10px] text-slate-500 font-semibold">{rowCount} corridas en Excel</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <div className="flex items-center gap-1.5 flex-1 sm:w-56">
                                <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">BD:</span>
                                <input
                                  type="text"
                                  value={config.targetName}
                                  onChange={(e) => {
                                    const val = e.target.value.toUpperCase();
                                    setSelectedTaladrosMap({
                                      ...selectedTaladrosMap,
                                      [excelName]: { ...config, targetName: val }
                                    });
                                  }}
                                  disabled={!config.selected}
                                  placeholder="Código del taladro..."
                                  className={`w-full bg-navy-950 border rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none ${status.isError ? 'border-rose-500/80 text-rose-300' : 'border-navy-800 text-slate-100 focus:border-cyan-500'}`}
                                />
                              </div>

                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border shrink-0 ${status.bg}`}>
                                {status.text}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-navy-950/20 border border-navy-800/40 rounded-xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Select Taladro from Excel */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Seleccionar Taladro del Excel a extraer:
                      </label>
                      <select
                        value={excelTaladroFilter}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExcelTaladroFilter(val);
                          setImportDestination(isTaladroMatch(val, activeTaladroName) ? 'active' : 'new');
                        }}
                        className="w-full bg-navy-900 border border-navy-800 hover:border-navy-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                      >
                        <option value="">-- SELECCIONAR --</option>
                        {summary.uniqueTaladros.map(t => (
                          <option key={t} value={t}>
                            {t} ({summary.rowsByTaladro[t]?.length || 0} registros)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Matching Info */}
                    <div className="bg-navy-900/40 border border-navy-850 rounded-lg p-3.5 flex flex-col justify-center">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">Taladro Activo:</span>
                        <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">{activeTaladroName}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-navy-850/60">
                        <span className="text-slate-400 font-medium">Registros a importar al grid:</span>
                        <span className="font-black text-emerald-400">
                          {excelTaladroFilter ? summary.rowsByTaladro[excelTaladroFilter]?.length || 0 : 0} filas
                        </span>
                      </div>
                    </div>
                  </div>

                  {excelTaladroFilter && !isTaladroMatch(excelTaladroFilter, activeTaladroName) && (
                    <div className="mt-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 space-y-3 shadow-lg">
                      <div className="flex items-center gap-2 text-red-400 text-sm font-bold uppercase tracking-wider">
                        <AlertTriangle size={16} />
                        <span>Error de Consistencia: Taladro No Coincide</span>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed font-medium font-sans">
                        El taladro seleccionado del Excel (<span className="font-bold text-red-400">{excelTaladroFilter}</span>) es diferente al taladro activo actual (<span className="font-bold text-cyan-400">{activeTaladroName}</span>).
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed font-sans">
                        Para Logueo Estructural, Ensayos PLT y Surveys, está prohibido importar registros a un taladro diferente al activo para prevenir inconsistencias espaciales o datos huérfanos. Por favor, selecciona el taladro correcto en tu archivo Excel o cambia de taladro en el sistema.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Column Mapping Grid */}
          {file && !loading && summary && excelTaladroFilter && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-300 font-black uppercase tracking-wider text-xs border-b border-navy-800/40 pb-1.5">
                <ArrowRight size={14} className="text-emerald-400" />
                <span>2. Mapeo de Columnas (Excel vs Sistema)</span>
              </div>

              <InfoBanner
                title="Mapeo e Integridad de Columnas"
                description="El sistema sugiere de forma automática las columnas basándose en sus nombres y sinónimos. Los campos que no se puedan asociar aparecerán resaltados en rojo. Puedes continuar con la importación aunque falten mapear, pero se rellenarán con valores por defecto (vacíos)."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1 border border-navy-850 rounded-xl p-3 bg-navy-950/20">
                {expectedFields.map(field => {
                  const currentMappedIdx = mappings[field.key];
                  const isMapped = currentMappedIdx !== undefined;
                  let isOptionalIgnored = false;
                  if (currentImportType === 'STRUCT') {
                    isOptionalIgnored = field.key === 'beta' || field.key === 'jrc10' || field.key === 'relleno2' || field.key === 'comentario' || field.key === 'tipo';
                  } else if (currentImportType === 'PLT') {
                    isOptionalIgnored = field.key === 'fecha' || field.key === 'este_m' || field.key === 'norte_m' || field.key === 'elevacion_msnm' || field.key === 'diametro_taladro_nominacion' || field.key === 'tipo_rotura_code' || field.key === 'direccion_rotura_code' || field.key === 'ejecutadoPor' || field.key === 'observaciones' || field.key === 'corrida_desde' || field.key === 'corrida_hasta';
                  } else if (currentImportType === 'SURVEY') {
                    isOptionalIgnored = false;
                  } else {
                    isOptionalIgnored = field.key === 'campana' || field.key === 'turno' || field.key === 'comentarios';
                  }

                  return (
                    <div
                      key={field.key}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${isMapped
                        ? 'bg-navy-900/40 border-navy-800/60'
                        : isOptionalIgnored
                          ? 'bg-navy-900/10 border-navy-850/40 opacity-70'
                          : 'bg-red-500/5 border-red-500/25 shadow-[0_0_10px_rgba(239,68,68,0.05)]'
                        }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-200 truncate">{field.label}</span>
                          {field.required && (
                            <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-1 py-0.2 rounded">REQUERIDO</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate">Campo BD: {field.key}</span>
                      </div>

                      <select
                        value={currentMappedIdx !== undefined ? currentMappedIdx : -1}
                        onChange={(e) => handleMappingChange(field.key, parseInt(e.target.value))}
                        className={`max-w-[180px] bg-navy-950 border rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${isMapped
                          ? 'border-emerald-500/30 text-emerald-400 font-medium'
                          : isOptionalIgnored
                            ? 'border-navy-800'
                            : 'border-red-500/40 text-red-400/80 font-medium'
                          }`}
                      >
                        <option value="-1">-- Sin Mapear (Vacío) --</option>
                        {excelHeaders.map((headerText, index) => (
                          <option key={index} value={index}>
                            {headerText}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Live Data Preview */}
          {file && !loading && summary && excelTaladroFilter && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-navy-800/40 pb-1.5">
                <span className="text-slate-300 font-black uppercase tracking-wider text-xs flex items-center gap-2">
                  <Check size={14} className="text-emerald-400" />
                  <span>3. Vista Previa de Datos Importados (Primeras 5 filas)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-semibold italic">Mapeado en tiempo real</span>
              </div>

              <InfoBanner
                title="Vista Previa de los Datos"
                description="Visualiza los primeros 5 registros de cómo serán formateados. Al dar confirmar, se importarán los registros seleccionados y la rejilla principal autocompletará y auditará en tiempo real todos los tramos."
              />

              <div className="overflow-x-auto border border-navy-850 rounded-xl bg-navy-950/45">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="bg-navy-900 text-slate-400 uppercase tracking-wide border-b border-navy-800">
                      <th className="py-2 px-3">Fila</th>
                      {currentImportType === 'SURVEY' ? (
                        <>
                          <th className="py-2 px-3 border-l border-navy-800">Profundidad (m)</th>
                          <th className="py-2 px-3 border-l border-navy-800">Dip (°)</th>
                          <th className="py-2 px-3 border-l border-navy-800">Azimut (°)</th>
                        </>
                      ) : currentImportType === 'STRUCT' ? (
                        <>
                          <th className="py-2 px-3 border-l border-navy-800">Profundidad</th>
                          <th className="py-2 px-3 border-l border-navy-800">Estructura</th>
                          <th className="py-2 px-3 border-l border-navy-800">Alfa (°)</th>
                          <th className="py-2 px-3 border-l border-navy-800">Beta (°)</th>
                          <th className="py-2 px-3 border-l border-navy-800">Forma</th>
                          <th className="py-2 px-3 border-l border-navy-800">Rugosidad</th>
                          <th className="py-2 px-3 border-l border-navy-800">Abertura</th>
                          <th className="py-2 px-3 border-l border-navy-800">Weathering</th>
                          <th className="py-2 px-3 border-l border-navy-800">Relleno 1</th>
                          <th className="py-2 px-3 border-l border-navy-800">Espesor (mm)</th>
                        </>
                      ) : currentImportType === 'PLT' ? (
                        <>
                          <th className="py-2 px-3 border-l border-navy-800">Nro Muestra</th>
                          <th className="py-2 px-3 border-l border-navy-800">Nro Caja</th>
                          <th className="py-2 px-3 border-l border-navy-800">Desde (m)</th>
                          <th className="py-2 px-3 border-l border-navy-800">Hasta (m)</th>
                          <th className="py-2 px-3 border-l border-navy-800">D (mm)</th>
                          <th className="py-2 px-3 border-l border-navy-800">P instr (kN)</th>
                          <th className="py-2 px-3 border-l border-navy-800">Tipo Ensayo</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2 px-3 border-l border-navy-800">Desde</th>
                          <th className="py-2 px-3 border-l border-navy-800">Hasta</th>
                          <th className="py-2 px-3 border-l border-navy-800">Lito 1</th>
                          <th className="py-2 px-3 border-l border-navy-800">Resistencia</th>
                          <th className="py-2 px-3 border-l border-navy-800">Recup (m)</th>
                          <th className="py-2 px-3 border-l border-navy-800">RQD (m)</th>
                          <th className="py-2 px-3 border-l border-navy-800">Intemperismo</th>
                          <th className="py-2 px-3 border-l border-navy-800">Relleno 1</th>
                          <th className="py-2 px-3 border-l border-navy-800">Espesor (mm)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {getPreviewRows().map((row, idx) => (
                      <tr key={idx} className="border-b border-navy-900/50 hover:bg-navy-900/10 text-slate-300">
                        <td className="py-2 px-3 font-bold text-slate-500">{idx + 1}</td>
                        {currentImportType === 'SURVEY' ? (
                          <>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.depth)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30 font-semibold text-cyan-400">{formatPreviewNum(row.dip)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.azimuth)}</td>
                          </>
                        ) : currentImportType === 'STRUCT' ? (
                          <>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.profundidad)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30 font-semibold text-cyan-400">{row.tipo_estructura !== undefined ? String(row.tipo_estructura) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.alfa)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.beta)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{row.forma !== undefined ? String(row.forma) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{row.rugosidad !== undefined ? String(row.rugosidad) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.abertura)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{row.weathering !== undefined ? String(row.weathering) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{row.relleno1 !== undefined ? String(row.relleno1) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.espesor)}</td>
                          </>
                        ) : currentImportType === 'PLT' ? (
                          <>
                            <td className="py-2 px-3 border-l border-navy-900/30 font-semibold text-cyan-400">{row.nro_muestra !== undefined ? String(row.nro_muestra) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{row.nro_caja !== undefined ? String(row.nro_caja) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.from_m)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.to_m)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.d_mm)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.p_instr_kn, 3)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{row.tipo_de_ensayo !== undefined ? String(row.tipo_de_ensayo) : '—'}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.de)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.a)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30 font-semibold text-cyan-400">{row.lito1 !== undefined ? String(row.lito1) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30 font-semibold text-purple-400">{row.resistencia !== undefined ? String(row.resistencia) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.rec_m)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.rqd_m)}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{row.intemperismo !== undefined ? String(row.intemperismo) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{row.relleno1 !== undefined ? String(row.relleno1) : '—'}</td>
                            <td className="py-2 px-3 border-l border-navy-900/30">{formatPreviewNum(row.espesor)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                    {getPreviewRows().length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500 font-semibold italic">
                          Mapea las columnas obligatorias y selecciona un taladro para ver la vista previa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer controls */}
        <div className="flex justify-between items-center px-6 py-4 bg-navy-950/80 border-t border-navy-800/80">
          <div className="text-xs text-slate-400">
            {file && summary && (
              currentImportType === 'LGG' ? (
                <span>
                  Se importarán <strong className="text-emerald-400 font-extrabold">{Object.values(selectedTaladrosMap).filter(v => v.selected).length} taladros seleccionados</strong> ({Object.entries(selectedTaladrosMap).filter(([_, v]) => v.selected).reduce((sum, [k]) => sum + (summary.rowsByTaladro[k]?.length || 0), 0)} corridas en total).
                </span>
              ) : (
                <span>
                  Se importarán <span className="font-bold text-emerald-400">{getFilteredRowsToImport().length}</span> de <span className="font-bold text-slate-400">{summary.totalRows}</span> registros válidos.
                </span>
              )
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="bg-navy-900 hover:bg-navy-850 text-slate-300 border border-navy-800 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={!file || loading || !excelTaladroFilter || isImportBlocked}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md ${file && !loading && excelTaladroFilter && !isImportBlocked
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/20'
                : 'bg-navy-950 text-slate-500 border border-navy-850 cursor-not-allowed'
                }`}
            >
              <span>Confirmar Importación</span>
            </button>
          </div>
        </div>

        {/* Performance & Mapping Warning Dialog Overlay */}
        {showWarningOverlay && (
          <div className="absolute inset-0 bg-navy-950/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-lg border border-navy-800 rounded-2xl p-6 space-y-6 text-center shadow-2xl relative bg-navy-900/95 flex flex-col max-h-[85vh] overflow-hidden">

              {/* Icon & Title */}
              <div className="space-y-2 shrink-0">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto animate-pulse">
                  <AlertTriangle size={24} />
                </div>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                  {warningTitle}
                </h4>
              </div>

              {/* Scrollable warning content */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-5 text-left leading-relaxed">

                {/* 1. Missing Fields Warning (Badges Grid) */}
                {missingFieldsToWarn.length > 0 && (
                  <div className="space-y-3 bg-red-950/20 border border-red-900/30 p-4 rounded-xl">
                    <div className="flex gap-2 items-center text-red-400 text-xs font-bold uppercase tracking-wide">
                      <AlertTriangle size={14} />
                      <span>Campos sin Mapear Detectados</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Los siguientes parámetros se importarán con sus valores por defecto (vacíos) porque no están asociados a ninguna columna del Excel. Por favor, asegúrate de que no existan en el archivo o de que no sean necesarios:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {missingFieldsToWarn.map(fieldName => (
                        <span
                          key={fieldName}
                          className="px-2.5 py-1 bg-red-500/10 border border-red-500/25 text-red-400 rounded-lg text-[10px] font-extrabold uppercase tracking-wide shadow-sm"
                        >
                          {fieldName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Performance / High Volume Warning */}
                {isPerformanceWarnActive && (
                  <div className="space-y-3 bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl">
                    <div className="flex gap-2 items-center text-amber-400 text-xs font-bold uppercase tracking-wide">
                      <RefreshCw size={14} className="animate-spin duration-1000" />
                      <span>Advertencia de Rendimiento (Alta Densidad)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Vas a inyectar <span className="text-amber-400 font-bold">{pendingRows.length} corridas</span> directamente en el navegador. Las validaciones de consistencia física QA/QC y el motor RMR76/89 se ejecutarán de forma local en tiempo real, lo que podría generar una breve demora de procesamiento en equipos menos potentes.
                    </p>
                  </div>
                )}

                {/* 3. Drillhole Target Info */}
                {excelTaladroFilter && excelTaladroFilter !== activeTaladroName && (
                  <div className="space-y-3 bg-cyan-500/5 border border-cyan-500/15 p-4 rounded-xl">
                    <div className="flex gap-2 items-center text-cyan-400 text-sm font-bold uppercase tracking-wider">
                      <Info size={16} className="text-cyan-400" />
                      <span>Destino de Importación Seleccionado</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed font-medium">
                      {importDestination === 'new' ? (
                        <span>
                          Se creará un <strong>nuevo taladro</strong> llamado <strong className="text-cyan-400 font-bold">"{excelTaladroFilter}"</strong> y se importarán las corridas en él, haciéndolo el taladro activo actual.
                        </span>
                      ) : (
                        <span>
                          Se importarán las corridas directamente sobre el <strong>taladro activo actual</strong> <strong className="text-emerald-400 font-bold">"{activeTaladroName}"</strong>.
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {/* Combined Call to Action */}
                <div className="p-3 bg-navy-950/40 border border-navy-850 rounded-xl text-center">
                  <p className="text-xs text-slate-300 font-bold">
                    ¿Deseas continuar con la importación de todas formas?
                  </p>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 shrink-0 border-t border-navy-800/40">
                <button
                  onClick={() => setShowWarningOverlay(false)}
                  className="flex-1 bg-navy-950 hover:bg-navy-900 border border-navy-800 hover:border-navy-750 text-slate-300 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                >
                  Cancelar e Ir a Mapeo
                </button>
                <button
                  onClick={() => {
                    prepareAndOpenConfirmation(undefined, pendingRows);
                  }}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-navy-950 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md shadow-cyan-500/15"
                >
                  Continuar a Resumen
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Modal de Confirmación e Información Pre-Importación */}
        {showConfirmOverlay && importSummaryDetails && (
          <div className="absolute inset-0 bg-navy-950/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-xl border border-navy-800 rounded-2xl p-6 space-y-6 text-center shadow-2xl relative bg-navy-900/95 flex flex-col max-h-[85vh] overflow-hidden">
              <div className="space-y-2 shrink-0">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/10">
                  <Layers size={24} />
                </div>
                <h4 className="text-base font-black text-slate-100 uppercase tracking-wider">
                  Confirmar Importación de Datos
                </h4>
                <p className="text-xs text-slate-400">
                  Revisa el desglose de información que se inyectará en la base de datos.
                </p>
              </div>

              {/* Highlights grid */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div className="bg-navy-950/60 border border-navy-800 p-3 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Taladros a Procesar</span>
                  <span className="text-lg font-black text-cyan-400">{importSummaryDetails.taladrosCount}</span>
                </div>
                <div className="bg-navy-950/60 border border-navy-800 p-3 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Registros / Corridas</span>
                  <span className="text-lg font-black text-emerald-400">{importSummaryDetails.rowsCount}</span>
                </div>
              </div>

              {/* Drillhole Detail List */}
              <div className="flex-1 overflow-y-auto border border-navy-800 rounded-xl bg-navy-950/40 text-xs text-left">
                <div className="p-2.5 bg-navy-900/80 border-b border-navy-800 font-bold text-slate-300 flex justify-between">
                  <span>Detalle por Sondaje</span>
                  <span>Acción / Registros</span>
                </div>
                <div className="divide-y divide-navy-900/60">
                  {importSummaryDetails.details.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">{item.targetName}</span>
                        {item.excelName && item.excelName !== item.targetName && (
                          <span className="text-[10px] text-slate-400">Orig: {item.excelName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.isNew ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'}`}>
                          {item.isNew ? 'Nuevo Sondaje' : 'Actualiza Activo'}
                        </span>
                        <span className="font-extrabold text-slate-300">{item.rows} filas</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2 shrink-0 border-t border-navy-800/40">
                <button
                  onClick={() => setShowConfirmOverlay(false)}
                  className="flex-1 bg-navy-950 hover:bg-navy-900 border border-navy-800 text-slate-300 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                >
                  Cancelar / Revisar Mapeo
                </button>
                <button
                  onClick={executeFinalImport}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                >
                  <Check size={16} />
                  <span>Sí, Importar Datos</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Final de Éxito de Importación */}
        {showSuccessOverlay && importSummaryDetails && (
          <div className="absolute inset-0 bg-navy-950/95 z-50 flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel w-full max-w-md border border-emerald-500/30 rounded-2xl p-6 space-y-6 text-center shadow-2xl relative bg-navy-900/95 flex flex-col">
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 animate-bounce">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider">
                  ¡Importación Completada!
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Se han validado e inyectado exitosamente <strong className="text-emerald-400 font-bold">{importSummaryDetails.taladrosCount} taladro(s)</strong> con un total de <strong className="text-emerald-400 font-bold">{importSummaryDetails.rowsCount} registro(s)</strong>.
                </p>
              </div>

              <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-3 max-h-40 overflow-y-auto divide-y divide-navy-900/50 text-left text-xs">
                {importSummaryDetails.details.map((item, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between">
                    <span className="font-bold text-slate-200">{item.targetName}</span>
                    <span className="text-[11px] text-emerald-400 font-extrabold">{item.rows} registros ✔</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setShowSuccessOverlay(false);
                  resetState();
                  onClose();
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                <span>Finalizar y Ver Registros</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}