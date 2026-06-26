import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, MapPin, Database, AlertTriangle, Upload } from 'lucide-react';
import type { ValidationAlert } from '../../utils/qaqcValidator';
import ExcelImportModal from '../LggGrid/ExcelImportModal';

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
}

export default function CollarSurveyForm({
  collar,
  surveys,
  alerts,
  onCollarChange,
  onSurveysChange
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

  // --- Name Edit Safe State ---
  const [tempName, setTempName] = useState(safeCollar.name || '');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    setTempName(safeCollar.name || '');
  }, [safeCollar.name]);

  const handleNameBlur = () => {
    const trimmed = tempName.trim().toUpperCase();
    if (!trimmed) {
      setTempName(safeCollar.name || '');
      return;
    }
    if (trimmed !== safeCollar.name) {
      onCollarChange({ ...safeCollar, name: trimmed });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTempName(safeCollar.name || '');
      e.currentTarget.blur();
    }
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
      return 'border-navy-700 focus:border-blue-500 focus:ring-blue-500/20';
    }
    if (parentAlert.type === 'CRITICAL') {
      return 'border-red-500 text-red-700 dark:text-red-200 focus:border-red-500 focus:ring-red-500/20 bg-red-500/5';
    }
    return 'border-amber-500 text-amber-700 dark:text-amber-200 focus:border-amber-500 focus:ring-amber-500/20 bg-amber-500/5';
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

      {/* Identificación del Taladro */}
      <div className="glass-panel p-5 rounded-xl border border-navy-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        {/* Código del Taladro */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Código de Taladro (Enter para renombrar)
          </label>
          <div className="relative">
            <input
              id="input-sondaje-name"
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value.toUpperCase())}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 tracking-wider text-sm"
            />
            {tempName.length > 3 && (
              <CheckCircle2 size={18} className="absolute right-3 top-2.5 text-emerald-500" />
            )}
          </div>
        </div>

        {/* Campaña */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Campaña</label>
          <input
            type="text"
            value={safeCollar.campana || ''}
            onChange={(e) => onCollarChange({ ...safeCollar, campana: e.target.value })}
            className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
          />
        </div>

        {/* Turno */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Turno</label>
          <select
            value={safeCollar.turno || 'D'}
            onChange={(e) => onCollarChange({ ...safeCollar, turno: e.target.value })}
            className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2 py-2 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
          >
            <option value="D">Día</option>
            <option value="N">Noche</option>
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
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
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
                className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-1.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-normal"
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
              className="flex items-center gap-1.5 bg-navy-900 hover:bg-navy-850 text-slate-300 dark:text-slate-300 border border-navy-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
            >
              <Upload size={14} className="text-emerald-400" />
              <span>Importar Excel</span>
            </button>
            <button
              onClick={addSurveyRow}
              className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-800 dark:text-cyan-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="text-xs text-slate-500 font-bold uppercase tracking-wider border-b border-navy-800">
                <th className="py-2.5 px-3">
                  Profundidad <span className="normal-case">(m)</span>
                </th>
                <th className="py-2.5 px-3">Dip / Inclinación (0-90°)</th>
                <th className="py-2.5 px-3">Azimut UTM (0-360°)</th>
                <th className="py-2.5 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {safeSurveys.map((survey, index) => {
                return (
                  <tr key={index} className="border-b border-navy-900/60 hover:bg-navy-900/15">

                    {/* Celda: Profundidad */}
                    <td className="py-3 px-3">
                      <input
                        id={`survey-depth-${index}`}
                        type="number"
                        value={toInputValue(survey.depth)}
                        onChange={(e) => handleSurveyChangeNoClamping(index, 'depth', fromInputValue(e.target.value))}
                        onBlur={() => handleSurveyBlur(index, 'depth')} // <-- Clampa a los rangos permitidos al salir de la celda
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={`w-32 bg-navy-900 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${getInputStyle(`survey-depth-${index}`)}`}
                        placeholder="Vacío"
                      />
                    </td>

                    {/* Celda: Dip */}
                    <td className="py-3 px-3">
                      <input
                        id={`survey-dip-${index}`}
                        type="number"
                        step="0.1"
                        value={toInputValue(survey.dip)}
                        onChange={(e) => handleSurveyChangeNoClamping(index, 'dip', fromInputValue(e.target.value))}
                        onBlur={() => handleSurveyBlur(index, 'dip')} // <-- Clampa a los rangos permitidos al salir de la celda
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={`w-32 bg-navy-900 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${getInputStyle(`survey-dip-${index}`)}`}
                        placeholder="Vacío"
                      />
                    </td>

                    {/* Celda: Azimut */}
                    <td className="py-3 px-3">
                      <input
                        type="number"
                        step="0.1"
                        value={toInputValue(survey.azimuth)}
                        onChange={(e) => handleSurveyChangeNoClamping(index, 'azimuth', fromInputValue(e.target.value))}
                        onBlur={() => handleSurveyBlur(index, 'azimuth')} // <-- Clampa a los rangos permitidos al salir de la celda
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={`w-32 bg-navy-900 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${getInputStyle(`survey-azimuth-${index}`)}`}
                        placeholder="Vacío"
                      />
                    </td>

                    {/* Celda: Acción */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => deleteSurveyRow(index)}
                        className="p-1.5 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 shadow-sm active:scale-90 flex items-center justify-center mx-auto"
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
        onImport={(importedRows) => {
          onSurveysChange(importedRows);
        }}
      />
    </div>
  );
}