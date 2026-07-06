import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  Activity,
  Layers,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Tag
} from 'lucide-react';
import type { ValidationAlert } from '../../../utils/qaqcValidator';
import type { Discontinuidad } from '../structuralColumns';

interface StructuralQaqcPanelProps {
  discontinuidades: Discontinuidad[];
  alerts: ValidationAlert[];
  onFocusField?: (fieldId: string) => void;
  onSwitchTab?: (tab: 'lgest' | 'qaqc') => void;
  darkMode?: boolean;
}

const safeFloat = (val: any, fallback = 0.0): number => {
  const parsed = parseFloat(val);
  return isNaN(parsed) || !isFinite(parsed) ? fallback : parsed;
};

export default function StructuralQaqcPanel({
  discontinuidades = [],
  alerts = [],
  onFocusField,
  onSwitchTab,
  darkMode: _darkMode = true
}: StructuralQaqcPanelProps) {
  try {
    const safeDiscs = Array.isArray(discontinuidades) ? discontinuidades : [];
    const safeAlerts = Array.isArray(alerts) ? alerts : [];

    // Filter structural-only alerts
    const structuralAlerts = safeAlerts.filter(a => a && a.field && a.field.startsWith('struct-'));

    // Map alert fields to display titles
    const getAlertContext = (fieldId: string) => {
      if (!fieldId) return { column: 'General' };

      const parts = fieldId.split('-'); // e.g. struct-jrc10-0 or struct-profundidad-1
      const key = parts[1]; // jrc10 or profundidad
      let column = 'General';
      switch (key) {
        case 'profundidad': column = 'Profundidad'; break;
        case 'tipo_estructura': column = 'Tipo Estructura'; break;
        case 'alfa': column = 'Alfa'; break;
        case 'beta': column = 'Beta'; break;
        case 'forma': column = 'Forma'; break;
        case 'rugosidad': column = 'Rugosidad'; break;
        case 'jrc10': column = 'JRC10'; break;
        case 'abertura': column = 'Abertura'; break;
        case 'weathering': column = 'Intemperismo'; break;
        case 'espesor': column = 'Espesor'; break;
        case 'relleno1': column = 'Relleno 1'; break;
        case 'relleno2': column = 'Relleno 2'; break;
        case 'dureza_pared': column = 'Dureza pared'; break;
        case 'agua': column = 'Presencia Agua'; break;
        case 'geotecnico': column = 'Geotécnico'; break;
        case 'comentario': column = 'Comentario'; break;
        case 'tipo': column = 'Tipo (Nat/Mec)'; break;
      }
      return { column };
    };

    // --- Calculations ---
    const totalEstrucs = safeDiscs.length;

    let naturalCount = 0;
    let mecanicaCount = 0;
    let sumAlfa = 0;
    let validAlfaCount = 0;
    let sumBeta = 0;
    let validBetaCount = 0;
    let sumJrc = 0;
    let validJrcCount = 0;

    safeDiscs.forEach(d => {
      if (d.tipo === 'Natural') {
        naturalCount++;
      } else {
        mecanicaCount++;
      }

      const alfaVal = safeFloat(d.alfa, -1);
      if (alfaVal !== -1) {
        sumAlfa += alfaVal;
        validAlfaCount++;
      }

      const betaVal = safeFloat(d.beta, -1);
      if (betaVal !== -1) {
        sumBeta += betaVal;
        validBetaCount++;
      }

      const jrcVal = safeFloat(d.jrc10, -1);
      if (jrcVal !== -1) {
        sumJrc += jrcVal;
        validJrcCount++;
      }
    });

    const avgAlfa = validAlfaCount > 0 ? sumAlfa / validAlfaCount : 0.0;
    const avgBeta = validBetaCount > 0 ? sumBeta / validBetaCount : 0.0;
    const avgJrc = validJrcCount > 0 ? sumJrc / validJrcCount : 0.0;

    const criticalCount = structuralAlerts.filter(a => a.type === 'CRITICAL').length;
    const warningCount = structuralAlerts.filter(a => a.type === 'WARNING').length;
    const vacioCount = structuralAlerts.filter(a => a.type === 'VACIO').length;

    const handleAlertFix = (fieldId: string) => {
      if (onSwitchTab) {
        onSwitchTab('lgest');
      }
      setTimeout(() => {
        if (onFocusField) {
          onFocusField(fieldId);
        }
      }, 80);
    };

    return (
      <div className="space-y-6 pb-12 animate-fade-in text-slate-200">
        {/* KPI Dashboard Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Discontinuities */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Estructuras</span>
              <Layers size={16} className="text-cyan-400" />
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-slate-100">{totalEstrucs}</span>
              <span className="text-xs text-slate-500 block mt-1">Registros estructurales</span>
            </div>
          </div>

          {/* Natural vs Mechanical */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Origen Juntas</span>
              <Activity size={16} className="text-emerald-400" />
            </div>
            <div className="mt-4">
              <div className="flex gap-4">
                <div>
                  <span className="text-lg font-extrabold text-emerald-400">{naturalCount}</span>
                  <span className="text-[10px] text-slate-500 block">Naturales</span>
                </div>
                <div>
                  <span className="text-lg font-extrabold text-blue-400">{mecanicaCount}</span>
                  <span className="text-[10px] text-slate-500 block">Mecánicas</span>
                </div>
              </div>
            </div>
          </div>

          {/* Average Angles */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ángulos Promedio</span>
              <Zap size={16} className="text-yellow-400" />
            </div>
            <div className="mt-4">
              <div className="flex gap-4">
                <div>
                  <span className="text-lg font-extrabold text-slate-200">{avgAlfa.toFixed(1)}°</span>
                  <span className="text-[10px] text-slate-500 block">Alfa (α)</span>
                </div>
                <div>
                  <span className="text-lg font-extrabold text-slate-200">{avgBeta.toFixed(1)}°</span>
                  <span className="text-[10px] text-slate-500 block">Beta (β)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Average JRC10 */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">JRC10 Promedio</span>
              <Tag size={16} className="text-purple-400" />
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black text-purple-400">{avgJrc.toFixed(1)}</span>
              <span className="text-xs text-slate-500 block mt-1">Rugosidad conjunta</span>
            </div>
          </div>

          {/* Auditor Alerts Card */}
          <div className="glass-panel p-4 rounded-xl border border-navy-800/40 bg-navy-900/10 flex flex-col justify-between shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Calidad Estructural</span>
              {criticalCount > 0 ? (
                <ShieldAlert size={16} className="text-red-400 animate-pulse" />
              ) : (
                <ShieldCheck size={16} className="text-emerald-400" />
              )}
            </div>
            <div className="mt-4">
              <div className="flex gap-3">
                <div>
                  <span className={`text-lg font-black ${criticalCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>{criticalCount}</span>
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Críticos</span>
                </div>
                <div>
                  <span className={`text-lg font-black ${warningCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{warningCount}</span>
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Avisos</span>
                </div>
                <div>
                  <span className={`text-lg font-black ${vacioCount > 0 ? 'text-slate-400' : 'text-slate-500'}`}>{vacioCount}</span>
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Vacíos</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quality Audit Layout */}
        <div className="grid grid-cols-1 gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-navy-800/40 bg-navy-950/20 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-navy-800/40 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Reporte de Auditoría QA/QC (Discontinuidades)</h3>
                <p className="text-[11px] text-slate-400">Verificaciones de consistencia espacial y física aplicadas a cada junta</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-navy-900 border border-navy-800 text-slate-400">
                {structuralAlerts.length} {structuralAlerts.length === 1 ? 'Alerta' : 'Alertas'}
              </span>
            </div>

            {structuralAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3">
                <CheckCircle size={40} className="text-emerald-500/80 stroke-[1.5]" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-slate-300">¡Macizo Estructural Consistente!</p>
                  <p className="text-xs text-slate-500">No se detectaron inconsistencias físicas ni profundidades huérfanas.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
                {structuralAlerts.map((alert, index) => {
                  const isCritical = alert.type === 'CRITICAL';
                  const context = getAlertContext(alert.field);

                  // Extract row number (1-based for the user)
                  const match = alert.field.match(/\d+/);
                  const rowNumber = match ? parseInt(match[0], 10) + 1 : 'N/A';

                  return (
                    <div
                      key={index}
                      onClick={() => handleAlertFix(alert.field)}
                      className={`group p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${isCritical
                        ? 'bg-red-500/5 hover:bg-red-500/10 border-red-500/25 hover:border-red-500/40'
                        : 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/25 hover:border-amber-500/40'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isCritical ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {isCritical ? <AlertOctagon size={16} /> : <AlertTriangle size={16} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-200">
                              Fila #{rowNumber}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-navy-900 text-slate-400">
                              Celdas: {context.column}
                            </span>
                          </div>
                          <p className="text-xs text-slate-350 mt-1 leading-relaxed">{alert.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wide">Corregir Celda</span>
                        <ArrowRight size={13} className="text-cyan-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering StructuralQaqcPanel:', error);
    return (
      <div className="p-6 text-center text-red-400 font-bold bg-red-950/20 border border-red-900/30 rounded-xl">
        Error al procesar el panel de análisis QA/QC estructural.
      </div>
    );
  }
}
