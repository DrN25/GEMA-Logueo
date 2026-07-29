import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, CheckCircle2, MapPin, Database, AlertTriangle, Upload, Edit2, Lock, X, Info } from 'lucide-react';
import ExcelImportModal from '../../components/common/ExcelImportModal';
import type { ValidationAlert } from '../../utils/qaqcValidator';

interface Survey {
  depth: number;
  dip: number;
  azimuth: number;
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

interface CollarSurveyFormProps {
  collar: Collar;
  surveys: Survey[];
  alerts: ValidationAlert[];
  onCollarChange: (collar: Collar) => void;
  onSurveysChange: (surveys: Survey[]) => void;
  existingTaladrosNames?: string[];
  availableCampanas?: string[];
}

export default function CollarSurveyForm({
  collar,
  surveys,
  alerts,
  onCollarChange,
  onSurveysChange,
  existingTaladrosNames = [],
  availableCampanas = ["Campaña 2020", "Campaña 2021", "Campaña 2022", "Campaña 2023", "Campaña 2024", "Campaña 2025", "Campaña 2026"]
}: CollarSurveyFormProps) {

  // --- Objetos de Respaldo Seguros ---
  const safeCollar: Collar = collar || {
    name: '',
    proyecto: '',
    geologo: '',
    diametro: '',
    inclinacion: 90,
    campana: '',
    fecha_registro: '',
    // Proyectado
    collar_este_proyectado: 0,
    collar_norte_proyectado: 0,
    collar_cota_proyectado: 0,
    prof_final_eoh_proyectada: 0,
    comentarios_proyectado: '',
    // Oficial
    collar_este: 0,
    collar_norte: 0,
    collar_cota: 0,
    prof_final_eoh: 0,
    comentarios: '',
    turno: 'D'
  };

  const safeSurveys = surveys || [];
  const safeAlerts = alerts || [];

  // --- Modal de Renombrado & Validaciones ---
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [tempName, setTempName] = useState(safeCollar.name || '');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [renameNotification, setRenameNotification] = useState<{ oldName: string; newName: string } | null>(null);

  useEffect(() => {
    setTempName(safeCollar.name || '');
  }, [safeCollar.name]);

  const cleanTempName = tempName.trim().toUpperCase();
  const currentCode = (safeCollar.name || '').trim().toUpperCase();

  const isDuplicateName = useMemo(() => {
    if (!cleanTempName || cleanTempName === currentCode) return false;
    return existingTaladrosNames.some(
      n => n.trim().toUpperCase() === cleanTempName && n.trim().toUpperCase() !== currentCode
    );
  }, [cleanTempName, currentCode, existingTaladrosNames]);

  const isEmptyName = !cleanTempName;
  const isNameChanged = cleanTempName !== currentCode;
  const isValidNewName = isNameChanged && !isDuplicateName && !isEmptyName;

  const handleApplyRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValidNewName) return;
    const oldCode = safeCollar.name;
    onCollarChange({ ...safeCollar, name: cleanTempName });
    setIsRenameModalOpen(false);
    setRenameNotification({ oldName: oldCode, newName: cleanTempName });
  };



  // --- Funciones de Conversión de Vacíos para Surveys (Manejo de -1) ---
  const toInputValue = (val: number | null | undefined): string => {
    if (val === undefined || val === null || val === -1) {
      return '';
    }
    return val.toString();
  };

  const fromInputValue = (valStr: string): number => {
    if (!valStr || valStr.trim() === '') return -1;
    const parsed = parseFloat(valStr);
    return isNaN(parsed) ? -1 : parsed;
  };

  const isEmptyValue = (val: number | null | undefined): boolean => {
    return val === undefined || val === null || val === -1;
  };

  // --- Funciones de Conversión de Vacíos para Collar (Manejo de 0 como Vacío) ---
  const toCollarInputValue = (val: number | null | undefined): string => {
    if (val === undefined || val === null || val === -1 || val === 0) {
      return '';
    }
    return val.toString();
  };

  const fromCollarInputValue = (valStr: string): number => {
    if (!valStr || valStr.trim() === '') return 0;
    const parsed = parseFloat(valStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  const isCollarEmptyValue = (val: number | null | undefined): boolean => {
    return val === undefined || val === null || val === -1 || val === 0;
  };

  // --- Cambios en tiempo de escritura (onChange) sin clamping agresivo ---
  const handleCollarChangeWithClamping = (field: keyof Collar, rawValue: number) => {
    let value = rawValue;
    // Las coordenadas y el EOH no pueden ser negativos en ningún momento
    if (value < 0) {
      value = 0;
    }
    onCollarChange({ ...safeCollar, [field]: value });
  };

  const handleSurveyChangeNoClamping = (index: number, field: keyof Survey, rawValue: number) => {
    const updated = [...safeSurveys];
    updated[index] = { ...updated[index], [field]: rawValue };
    onSurveysChange(updated);
  };

  // --- Autocorrector de cascada al perder el foco (onBlur) en el EOH ---
  const handleEOHBlur = () => {
    const eoh = Number(safeCollar.prof_final_eoh);
    if (!isCollarEmptyValue(eoh) && !isNaN(eoh)) {
      // Coerción a Number estricta para evitar fallas de tipado de Javascript en comparaciones
      const needsClamping = safeSurveys.some(survey => {
        const currentDepth = Number(survey.depth);
        return currentDepth !== -1 && !isNaN(currentDepth) && currentDepth > eoh;
      });

      if (needsClamping) {
        const updatedSurveys = safeSurveys.map(survey => {
          const currentDepth = Number(survey.depth);
          if (currentDepth !== -1 && !isNaN(currentDepth) && currentDepth > eoh) {
            return { ...survey, depth: eoh }; // Reducimos al valor límite válido
          }
          return survey;
        });
        onSurveysChange(updatedSurveys);
      }
    }
  };

  // --- Autocorrector al perder el foco (onBlur) en las celdas de la tabla ---
  const handleSurveyBlur = (index: number, field: keyof Survey) => {
    const survey = safeSurveys[index];
    if (!survey || survey[field] === -1) return;

    let value = Number(survey[field]);
    if (isNaN(value)) return;

    if (field === 'depth') {
      if (value < 0) value = 0;
      const eoh = Number(safeCollar.prof_final_eoh);
      if (!isCollarEmptyValue(eoh) && value > eoh) {
        value = eoh; // Autocorrige al valor del EOH
      }
    } else if (field === 'dip') {
      if (value < 0) value = 0;
      if (value > 90) value = 90; // Autocorrige al límite de 90°
    } else if (field === 'azimuth') {
      if (value < 0) value = 0;
      if (value > 360) value = 360; // Autocorrige al límite de 360°
    }

    const updated = [...safeSurveys];
    updated[index] = { ...updated[index], [field]: value };
    onSurveysChange(updated);
  };

  // --- Lógica de Creación Inteligente de Lecturas ---
  const addSurveyRow = () => {
    if (safeSurveys.length === 0) {
      const newSurvey: Survey = {
        depth: 0,
        dip: 0,
        azimuth: 0
      };
      onSurveysChange([newSurvey]);
    } else {
      const lastRow = safeSurveys[safeSurveys.length - 1];
      const eoh = safeCollar.prof_final_eoh;

      const defaultDepth = (!isCollarEmptyValue(eoh)) ? eoh! : 0;

      const newSurvey: Survey = {
        depth: defaultDepth,
        dip: lastRow ? lastRow.dip : 0,
        azimuth: lastRow ? lastRow.azimuth : 0
      };
      onSurveysChange([...safeSurveys, newSurvey]);
    }
  };

  const deleteSurveyRow = (index: number) => {
    const updated = safeSurveys.filter((_, i) => i !== index);
    onSurveysChange(updated);
  };

  // --- Estilos de Alertas ---
  const getInputStyle = (fieldId: string) => {
    const parentAlert = safeAlerts.find(a => a.field === fieldId);
    if (!parentAlert) {
      return 'border-navy-800 bg-navy-950/80 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 text-slate-100';
    }
    if (parentAlert.type === 'CRITICAL') {
      return 'border-rose-500/80 text-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 bg-rose-500/10';
    }
    return 'border-amber-500/80 text-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 bg-amber-500/10';
  };

  // Verifica si alguna lectura actual excede el EOH para la barra de advertencia
  const hasInconsistentDepths = safeSurveys.some(
    s => !isEmptyValue(s.depth) && !isCollarEmptyValue(safeCollar.prof_final_eoh) && Number(s.depth) > Number(safeCollar.prof_final_eoh!)
  );

  return (
    <div className="space-y-6 select-none w-full">
      {/* Panel de Introducción */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800/40 flex justify-between items-center shadow-lg bg-navy-900/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-cyan-400 border border-blue-500/20">
            <MapPin size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-wide">
              Collar & Survey de Sondaje
            </h2>
            <p className="text-xs text-slate-400">
              Ubicación espacial, coordenadas del collar, y lecturas de trayectoria (Dip/Azimut)
            </p>
          </div>
        </div>
      </div>

      {renameNotification && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs shadow-md animate-fade-in">
          <div className="flex items-center gap-3">
            <Info size={18} className="text-cyan-400 shrink-0" />
            <div>
              <p className="font-bold text-slate-100">
                Sondaje renombrado localmente: <span className="line-through text-slate-400">{renameNotification.oldName}</span> &rarr; <span className="text-cyan-300 font-black">{renameNotification.newName}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                El cambio se encuentra resguardado en la memoria de la aplicación. Para actualizar la base de datos SQL Server, recuerde presionar <strong>"Guardar Cambios"</strong> en la barra superior.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRenameNotification(null)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Identificación del Taladro */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        {/* Código del Taladro */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Código de Taladro
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id="input-sondaje-name"
                type="text"
                readOnly
                value={safeCollar.name}
                className="w-full bg-navy-950/80 border border-navy-800 rounded-lg pl-9 pr-4 py-2 text-cyan-300 font-black tracking-wider text-sm cursor-not-allowed select-all shadow-inner"
              />
              <Lock size={15} className="absolute left-3 top-2.5 text-cyan-500/60" />
            </div>
            <button
              type="button"
              onClick={() => {
                setTempName(safeCollar.name || '');
                setIsRenameModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 px-3 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm whitespace-nowrap"
              title="Renombrar código de taladro"
            >
              <Edit2 size={13} />
              <span>Editar</span>
            </button>
          </div>
        </div>

        {/* Campaña */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Campaña</label>
          <select
            value={safeCollar.campana || ''}
            onChange={(e) => onCollarChange({ ...safeCollar, campana: e.target.value })}
            className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 font-semibold cursor-pointer  transition-all"
          >
            {safeCollar.campana && !availableCampanas.includes(safeCollar.campana) && (
              <option value={safeCollar.campana} className="bg-navy-950 text-slate-200 py-1.5">
                {safeCollar.campana.replace(/^CAMPAÑA\s*/i, '').replace(/^CAMPAÑA_/i, '').trim()}
              </option>
            )}
            {availableCampanas.map((c) => (
              <option key={c} value={c} className="bg-navy-950 text-slate-200 py-1.5">
                {c.replace(/^CAMPAÑA\s*/i, '').replace(/^CAMPAÑA_/i, '').trim()}
              </option>
            ))}
          </select>
        </div>

        {/* Turno */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Turno</label>
          <select
            value={safeCollar.turno || 'D'}
            onChange={(e) => onCollarChange({ ...safeCollar, turno: e.target.value })}
            className="w-full bg-navy-950 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 font-semibold cursor-pointer  transition-all"
          >
            <option value="D" className="bg-navy-950 text-slate-200 py-1.5">Día</option>
            <option value="N" className="bg-navy-950 text-slate-200 py-1.5">Noche</option>
          </select>
        </div>
      </div>

      {/* Grid de Collar: Proyectado vs Oficial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* REGISTRO DE COLLAR PROYECTADO */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800/80 space-y-4 bg-navy-900/10">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest border-b border-navy-800 pb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            REGISTRO DE COLLAR PROYECTADO
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Este Proyectado */}
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Este Proyectado (X - m)
              </label>
              <input
                type="number"
                value={toCollarInputValue(safeCollar.collar_este_proyectado)}
                onChange={(e) => handleCollarChangeWithClamping('collar_este_proyectado', fromCollarInputValue(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                className={`w-full bg-navy-900 border rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 ${getInputStyle('collar_este_proyectado')}`}
                placeholder="Vacío"
              />
            </div>

            {/* Norte Proyectado */}
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Norte Proyectado (Y - m)
              </label>
              <input
                type="number"
                value={toCollarInputValue(safeCollar.collar_norte_proyectado)}
                onChange={(e) => handleCollarChangeWithClamping('collar_norte_proyectado', fromCollarInputValue(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                className={`w-full bg-navy-900 border rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 ${getInputStyle('collar_norte_proyectado')}`}
                placeholder="Vacío"
              />
            </div>

            {/* Cota Proyectada */}
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Cota Proyectada (Z - msnm)
              </label>
              <input
                type="number"
                value={toCollarInputValue(safeCollar.collar_cota_proyectado)}
                onChange={(e) => handleCollarChangeWithClamping('collar_cota_proyectado', fromCollarInputValue(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                className={`w-full bg-navy-900 border rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 ${getInputStyle('collar_cota_proyectado')}`}
                placeholder="Vacío"
              />
            </div>

            {/* Profundidad Final EOH Proyectada */}
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Prof. EOH Proyectada (m)
              </label>
              <input
                type="number"
                step="0.01"
                value={toCollarInputValue(safeCollar.prof_final_eoh_proyectada)}
                onChange={(e) => handleCollarChangeWithClamping('prof_final_eoh_proyectada', fromCollarInputValue(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                className={`w-full bg-navy-900 border rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 ${getInputStyle('prof_final_eoh_proyectada')}`}
                placeholder="Vacío"
              />
            </div>

            {/* Comentarios Proyectado */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Comentarios Proyectado
              </label>
              <textarea
                value={safeCollar.comentarios_proyectado || ''}
                onChange={(e) => onCollarChange({ ...safeCollar, comentarios_proyectado: e.target.value })}
                rows={2}
                className="w-full bg-navy-950/80 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 placeholder-slate-600 font-medium  transition-all"
                placeholder="Notas o comentarios sobre la perforación proyectada..."
              />
            </div>
          </div>
        </div>

        {/* REGISTRO DE COLLAR OFICIAL */}
        <div className="glass-panel p-5 rounded-xl border border-navy-800/80 space-y-4 bg-navy-900/10">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest border-b border-navy-800 pb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            REGISTRO DE COLLAR OFICIAL
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Este Oficial */}
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Este Oficial (X - m)
              </label>
              <input
                type="number"
                value={toCollarInputValue(safeCollar.collar_este)}
                onChange={(e) => handleCollarChangeWithClamping('collar_este', fromCollarInputValue(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                className={`w-full bg-navy-900 border rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 ${getInputStyle('collar_este')}`}
                placeholder="Vacío"
              />
            </div>

            {/* Norte Oficial */}
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Norte Oficial (Y - m)
              </label>
              <input
                type="number"
                value={toCollarInputValue(safeCollar.collar_norte)}
                onChange={(e) => handleCollarChangeWithClamping('collar_norte', fromCollarInputValue(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                className={`w-full bg-navy-900 border rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 ${getInputStyle('collar_norte')}`}
                placeholder="Vacío"
              />
            </div>

            {/* Cota Oficial */}
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Cota Oficial (Z - msnm)
              </label>
              <input
                type="number"
                value={toCollarInputValue(safeCollar.collar_cota)}
                onChange={(e) => handleCollarChangeWithClamping('collar_cota', fromCollarInputValue(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                className={`w-full bg-navy-900 border rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 ${getInputStyle('collar_cota')}`}
                placeholder="Vacío"
              />
            </div>

            {/* Profundidad Final EOH Oficial */}
            <div className="space-y-1.5 col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Prof. Final EOH Oficial (m)
              </label>
              <input
                type="number"
                step="0.01"
                value={toCollarInputValue(safeCollar.prof_final_eoh)}
                onChange={(e) => handleCollarChangeWithClamping('prof_final_eoh', fromCollarInputValue(e.target.value))}
                onBlur={handleEOHBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                onWheel={(e) => e.currentTarget.blur()}
                className={`w-full bg-navy-900 border rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 ${getInputStyle('prof_final_eoh')}`}
                placeholder="Vacío"
              />
            </div>

            {/* Comentarios Oficial */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Comentarios
              </label>
              <textarea
                value={safeCollar.comentarios || ''}
                onChange={(e) => onCollarChange({ ...safeCollar, comentarios: e.target.value })}
                rows={2}
                className="w-full bg-navy-950/80 border border-navy-800 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 placeholder-slate-600 font-medium  transition-all"
                placeholder="Notas o comentarios sobre la perforación oficial final..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* REGISTRO DE SURVEY */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4">
        <div className="flex justify-between items-center border-b border-navy-800 pb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              REGISTRO DE SURVEY
            </h3>
            <span className="bg-navy-950 border border-navy-800 text-[10px] px-2 py-0.5 rounded-full text-slate-400 flex items-center gap-1.5 font-semibold">
              <Database size={12} className="text-cyan-400" />
              <span>{safeSurveys.length} {safeSurveys.length === 1 ? 'survey' : 'surveys'}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Upload size={14} className="text-emerald-400" />
              <span>Importar Excel</span>
            </button>
            <button
              onClick={addSurveyRow}
              className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus size={14} />
              <span>Agregar lectura</span>
            </button>
          </div>
        </div>

        {/* Alerta de consistencia */}
        {hasInconsistentDepths && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              Inconsistencia detectada: Tienes registros de profundidad que superan el límite de perforación (EOH: {isEmptyValue(safeCollar.prof_final_eoh) ? 'Sin Definir' : `${safeCollar.prof_final_eoh} m`}).
            </span>
          </div>
        )}

        {/* Tabla de Survey Equilibrada de Ancho Completo sin huecos negros vacíos */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs text-slate-400 font-bold uppercase tracking-wider border-b border-navy-800 bg-navy-900/40 h-10">
                <th className="py-2.5 px-6 w-[30%]">
                  Profundidad <span className="normal-case text-slate-500">(m)</span>
                </th>
                <th className="py-2.5 px-6 w-[32%]">
                  Dip / Inclinación <span className="normal-case text-slate-500">(0-90°)</span>
                </th>
                <th className="py-2.5 px-6 w-[32%]">
                  Azimut UTM <span className="normal-case text-slate-500">(0-360°)</span>
                </th>
                <th className="py-2.5 px-4 w-[6%] text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/50">
              {safeSurveys.map((survey, index) => {
                return (
                  <tr key={index} className="border-b border-navy-900/60 hover:bg-navy-900/20 transition-colors h-12">

                    {/* Celda: Profundidad */}
                    <td className="py-2 px-6">
                      <input
                        id={`survey-depth-${index}`}
                        type="number"
                        value={toInputValue(survey.depth)}
                        onChange={(e) => handleSurveyChangeNoClamping(index, 'depth', fromInputValue(e.target.value))}
                        onBlur={() => handleSurveyBlur(index, 'depth')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={`w-full max-w-xs bg-navy-950/80 border rounded-lg px-3.5 py-2 text-xs font-semibold focus:outline-none ${getInputStyle(`survey-depth-${index}`)}`}
                        placeholder="0.0 m"
                      />
                    </td>

                    {/* Celda: Dip */}
                    <td className="py-2 px-6">
                      <input
                        id={`survey-dip-${index}`}
                        type="number"
                        step="0.1"
                        value={toInputValue(survey.dip)}
                        onChange={(e) => handleSurveyChangeNoClamping(index, 'dip', fromInputValue(e.target.value))}
                        onBlur={() => handleSurveyBlur(index, 'dip')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={`w-full max-w-xs bg-navy-950/80 border rounded-lg px-3.5 py-2 text-xs font-semibold focus:outline-none ${getInputStyle(`survey-dip-${index}`)}`}
                        placeholder="0.0°"
                      />
                    </td>

                    {/* Celda: Azimut */}
                    <td className="py-2 px-6">
                      <input
                        type="number"
                        step="0.1"
                        value={toInputValue(survey.azimuth)}
                        onChange={(e) => handleSurveyChangeNoClamping(index, 'azimuth', fromInputValue(e.target.value))}
                        onBlur={() => handleSurveyBlur(index, 'azimuth')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={`w-full max-w-xs bg-navy-950/80 border rounded-lg px-3.5 py-2 text-xs font-semibold focus:outline-none ${getInputStyle(`survey-azimuth-${index}`)}`}
                        placeholder="0.0°"
                      />
                    </td>

                    {/* Celda: Acción */}
                    <td className="py-2 px-4 text-center">
                      <button
                        onClick={() => deleteSurveyRow(index)}
                        className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40 transition-all duration-200 shadow-sm active:scale-90 flex items-center justify-center mx-auto cursor-pointer"
                        title="Eliminar lectura"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>

                  </tr>
                );
              })}
              {safeSurveys.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                    Sin lecturas de survey ingresadas. Haz clic en "Agregar lectura" para registrar la inclinación.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeTaladroName={safeCollar.name}
        importType="SURVEY"
        onImport={(importedRows: any[]) => {
          onSurveysChange(importedRows);
        }}
      />

      {/* Modal de Renombrado Seguro */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in text-left">
          <div className="glass-panel w-full max-w-md p-6 rounded-xl border border-navy-800 space-y-4 shadow-2xl bg-navy-900/95">
            <div className="flex justify-between items-center border-b border-navy-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-cyan-400" />
                <h3 className="text-sm font-black text-slate-100 tracking-wide uppercase">
                  Renombrar Código de Sondaje
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-navy-800"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyRename} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Código Actual: <span className="text-slate-200 font-bold">{safeCollar.name}</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="ej. FEGT25-002"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value.toUpperCase())}
                    className={`w-full bg-navy-950 border rounded-lg px-4 py-2 text-slate-100 text-xs focus:outline-none font-bold tracking-wider ${isDuplicateName || isEmptyName
                        ? 'border-rose-500/80 text-rose-300 focus:ring-1 focus:ring-rose-500'
                        : isNameChanged
                          ? 'border-emerald-500/80 text-emerald-300 focus:ring-1 focus:ring-emerald-500'
                          : 'border-navy-800 focus:ring-cyan-500'
                      }`}
                  />
                  {isDuplicateName || isEmptyName ? (
                    <AlertTriangle size={16} className="absolute right-3 top-2.5 text-rose-500 animate-pulse" />
                  ) : isNameChanged ? (
                    <CheckCircle2 size={16} className="absolute right-3 top-2.5 text-emerald-500" />
                  ) : (
                    <CheckCircle2 size={16} className="absolute right-3 top-2.5 text-slate-600" />
                  )}
                </div>

                {isDuplicateName && (
                  <p className="text-[10px] font-bold text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>El código '{cleanTempName}' ya pertenece a otro sondaje en el proyecto.</span>
                  </p>
                )}
                {isEmptyName && (
                  <p className="text-[10px] font-bold text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>El código de taladro no puede estar vacío.</span>
                  </p>
                )}
                {isNameChanged && !isDuplicateName && !isEmptyName && (
                  <p className="text-[10px] font-bold text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span>Código único disponible para renombrar.</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-navy-800">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isValidNewName}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${isValidNewName
                      ? 'bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20 cursor-pointer'
                      : 'bg-navy-900 border border-navy-800 text-slate-600 cursor-not-allowed opacity-50'
                    }`}
                >
                  Aplicar Renombrado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}