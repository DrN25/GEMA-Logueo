import { useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle, Minimize2, MapPin, Tag, ArrowLeftRight, HelpCircle } from 'lucide-react';
import type { QaQcAlert } from '../../utils/qaQcRules';

interface ValidationPanelProps {
  alerts: QaQcAlert[];
  onFocusField: (fieldId: string) => void;
}

export default function ValidationPanel({ alerts, onFocusField }: ValidationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const [position, setPosition] = useState<'left' | 'right'>(() => {
    return (localStorage.getItem('geotech_qaqc_panel_pos') as 'left' | 'right') || 'right';
  });

  const togglePosition = () => {
    const newPos = position === 'right' ? 'left' : 'right';
    setPosition(newPos);
    localStorage.setItem('geotech_qaqc_panel_pos', newPos);
  };

  const getAlertContext = (fieldId: string) => {
    if (!fieldId) return { tab: 'LGG', column: 'General' };

    if (fieldId.startsWith('header-')) {
      const colName = fieldId.split('-').slice(1).join('-');
      let column = 'General';
      switch (colName) {
        case 'name': column = 'Código'; break;
        case 'proyecto': column = 'Proyecto'; break;
        case 'geologo': column = 'Geólogo'; break;
        case 'diametro': column = 'Diámetro'; break;
        case 'inclinacion': column = 'Inclinación'; break;
        case 'campana': column = 'Campaña'; break;
        case 'turno': column = 'Turno'; break;
        case 'collar_este': column = 'Este Oficial'; break;
        case 'collar_norte': column = 'Norte Oficial'; break;
        case 'collar_cota': column = 'Cota Oficial'; break;
        case 'prof_final_eoh': column = 'Prof. EOH'; break;
        case 'collar_este_proyectado': column = 'Este Proyect.'; break;
        case 'collar_norte_proyectado': column = 'Norte Proyect.'; break;
        case 'collar_cota_proyectado': column = 'Cota Proyect.'; break;
        case 'prof_final_eoh_proyectada': column = 'EOH Proyect.'; break;
      }
      return { tab: 'Collar', column };
    }

    if (fieldId.startsWith('survey-')) {
      const parts = fieldId.split('-');
      const colName = parts[1] || '';
      let column = 'Lectura';
      if (colName === 'depth') column = 'Profundidad';
      else if (colName === 'dip') column = 'Dip';
      else if (colName === 'azimuth') column = 'Azimut';
      return { tab: 'Survey', column };
    }

    if (fieldId.startsWith('plt-cell-')) {
      const colName = fieldId.split('-')[2] || '';
      let column = 'General';
      switch (colName) {
        case 'fecha': column = 'Fecha'; break;
        case 'nro_muestra': column = 'Nro Muestra'; break;
        case 'nro_caja': column = 'Nro Caja'; break;
        case 'from_m': column = 'From'; break;
        case 'to_m': column = 'To'; break;
        case 'este_m': column = 'Este'; break;
        case 'norte_m': column = 'Norte'; break;
        case 'elevacion_msnm': column = 'Elevación'; break;
        case 'long_de_muestra_mm': column = 'Long. Muestra'; break;
        case 'tipo_de_ensayo': column = 'Tipo Ensayo'; break;
        case 'diametro_taladro_nominacion': column = 'Diám. Taladro'; break;
        case 'd_mm': column = 'D (mm)'; break;
        case 'p_instr_kn': column = 'P instr'; break;
        case 'tipo_rotura_code': column = 'Tipo Rotura'; break;
        case 'direccion_rotura_code': column = 'Dir. Rotura'; break;
        case 'ejecutadoPor': column = 'Ejecutado por'; break;
        case 'observaciones': column = 'Observaciones'; break;
      }
      return { tab: 'PLT', column };
    }

    if (fieldId.startsWith('struct-cell-')) {
      const colName = fieldId.split('-')[2] || '';
      let column = 'General';
      switch (colName) {
        case 'profundidad': column = 'Profundidad'; break;
        case 'tipo_estructura': column = 'Tipo Estruct.'; break;
        case 'alfa': column = 'Alfa'; break;
        case 'beta': column = 'Beta'; break;
        case 'forma': column = 'Forma'; break;
        case 'rugosidad': column = 'Rugosidad'; break;
        case 'jrc10': column = 'JRC10'; break;
        case 'abertura': column = 'Abertura'; break;
        case 'weathering': column = 'Intemp.'; break;
        case 'espesor': column = 'Espesor'; break;
        case 'relleno1': column = 'Relleno 1'; break;
        case 'relleno2': column = 'Relleno 2'; break;
        case 'dureza_pared': column = 'Dureza Pared'; break;
        case 'agua': column = 'Presen. Agua'; break;
        case 'geotecnico': column = 'Geotécnico'; break;
        case 'comentario': column = 'Comentario'; break;
        case 'tipo': column = 'Tipo'; break;
      }
      return { tab: 'LG EST', column };
    }

    if (fieldId.startsWith('lgg-cell-')) {
      const colName = fieldId.split('-')[2] || '';
      let column = 'General';
      switch (colName) {
        case 'de': column = 'Desde'; break;
        case 'a': column = 'Hasta'; break;
        case 'rec_m': column = 'Recup.'; break;
        case 'rqd_m': column = 'RQD'; break;
        case 'lrf_m': column = 'LRF'; break;
        case 'small_frag_m': column = 'Frag < 10'; break;
        case 'frac_nat': column = 'Fracturas'; break;
        case 'abertura': column = 'Abertura'; break;
        case 'espesor': column = 'Espesor'; break;
        case 'intemperismo': column = 'Intemp.'; break;
        case 'resistencia': column = 'Resist.'; break;
        case 'lito1': column = 'Lito 1'; break;
        case 'tipo_est1': column = 'Tipo Est.'; break;
        case 'agua_obs': column = 'Agua'; break;
      }
      return { tab: 'LGG', column };
    }

    return { tab: 'LGG', column: 'General' };
  };

  const criticalCount = alerts.filter(a => a.type === 'CRITICA').length;
  const warningCount = alerts.filter(a => a.type === 'ADVERTENCIA').length;
  const vacioCount = alerts.filter(a => a.type === 'VACIO').length;

  if (!isOpen) {
    return (
      <div className={`fixed bottom-6 ${position === 'right' ? 'right-6' : 'left-6'} z-40 flex items-center gap-1.5 group transition-all duration-300`}>

        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); togglePosition(); }}
          className={`w-6 h-6 rounded-full bg-cyan-950/90 border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 flex items-center justify-center shadow-md transition-all duration-300 opacity-50 group-hover:opacity-100 active:scale-90 z-50 ${position === 'right' ? 'order-first' : 'order-last'
            }`}
          title="Mover panel al lado opuesto"
        >
          <ArrowLeftRight size={11} />
        </button>

        <button
          onClick={() => setIsOpen(true)}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center border shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 backdrop-blur-md opacity-75 hover:opacity-100 ${criticalCount > 0
              ? 'bg-red-50 dark:bg-red-950/85 border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.15)] dark:shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.55)]'
              : warningCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/85 border-amber-200 dark:border-amber-500/50 text-amber-600 dark:text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)] dark:shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.45)]'
                : vacioCount > 0
                  ? 'bg-slate-50 dark:bg-slate-900/85 border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 shadow-sm' // Gris Slate Neutro
                  : 'bg-emerald-50 dark:bg-emerald-950/85 border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] dark:shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.35)]'
            }`}
          title={`${alerts.length} validaciones pendientes. Haz clic para expandir.`}
        >
          {alerts.length > 0 && (
            <span className={`absolute inset-0 rounded-full animate-ping opacity-25 ${criticalCount > 0 ? 'bg-red-500' : warningCount > 0 ? 'bg-amber-500' : 'bg-slate-500'
              }`} />
          )}

          {criticalCount > 0 ? (
            <AlertOctagon size={24} className="animate-pulse" />
          ) : warningCount > 0 ? (
            <AlertTriangle size={24} />
          ) : vacioCount > 0 ? (
            <HelpCircle size={24} className="text-slate-500 dark:text-slate-400" /> // Icono de ayuda neutro
          ) : (
            <CheckCircle size={24} />
          )}

          {alerts.length > 0 && (
            <span className={`absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1.5 rounded-full text-xs font-black flex items-center justify-center border shadow-md ${criticalCount > 0
                ? 'bg-red-500 border-red-400 text-white'
                : warningCount > 0
                  ? 'bg-amber-500 border-amber-400 text-black'
                  : 'bg-slate-500 border-slate-400 text-white'
              }`}>
              {alerts.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 ${position === 'right' ? 'right-6' : 'left-6'} z-40 w-80 glass-panel rounded-xl border border-navy-800 shadow-2xl p-4 flex flex-col max-h-[380px] overflow-hidden select-none backdrop-blur-md animate-fade-in-up`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-navy-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Validaciones</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1.5 mr-1 flex-wrap justify-end">
            {criticalCount > 0 && (
              <span className="bg-red-500/20 border border-red-500/40 text-red-400 text-xxs font-extrabold px-1.5 py-0.5 rounded-md animate-pulse">
                {criticalCount} CRÍT.
              </span>
            )}
            {warningCount > 0 && (
              <span className="bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xxs font-extrabold px-1.5 py-0.5 rounded-md">
                {warningCount} AVISO
              </span>
            )}
            {vacioCount > 0 && (
              <span className="bg-slate-500/10 border border-slate-500/30 text-slate-450 text-xxs font-extrabold px-1.5 py-0.5 rounded-md">
                {vacioCount} VACÍOS
              </span>
            )}
          </div>

          <button
            onClick={togglePosition}
            className="p-1 rounded-md text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            title="Mover panel al lado opuesto"
          >
            <ArrowLeftRight size={13} />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-350 hover:bg-navy-800/80 transition-colors"
            title="Minimizar panel"
          >
            <Minimize2 size={14} />
          </button>
        </div>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
            <CheckCircle size={36} className="text-emerald-500/40 mb-2" />
            <p className="text-sm font-medium text-slate-400">Sin inconsistencias</p>
            <p className="text-xs mt-0.5">El logueo cumple con el balance físico.</p>
          </div>
        ) : (
          [...alerts]
            .sort((a, b) => {
              const weight = { 'CRITICA': 0, 'CRITICAL': 0, 'ADVERTENCIA': 1, 'WARNING': 1, 'VACIO': 2 };
              return weight[a.type] - weight[b.type];
            })
            .map((alert, idx) => {
              const isCritical = alert.type === 'CRITICA';
              const isWarning = alert.type === 'ADVERTENCIA';
              const context = getAlertContext(alert.fieldId);

              return (
                <div
                  key={idx}
                  onClick={() => onFocusField(alert.fieldId)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${isCritical
                      ? 'bg-red-50 dark:bg-red-950/45 border-red-200 dark:border-red-800/40 text-red-800 dark:text-slate-200 hover:bg-red-100 dark:hover:bg-red-950/60'
                      : isWarning
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/30 text-amber-800 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                        : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/30 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/50'
                    }`}
                >
                  <div className="flex gap-2.5 items-start">
                    {isCritical ? (
                      <AlertOctagon size={16} className="text-red-400 shrink-0 mt-0.5" />
                    ) : isWarning ? (
                      <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <HelpCircle size={16} className="text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isCritical
                            ? 'bg-red-500/20 border-red-500/40 text-red-300'
                            : isWarning
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-slate-500/20 border-slate-500/30 text-slate-400'
                          }`}>
                          {isCritical ? 'Error' : isWarning ? 'Aviso' : 'Vacío'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800/70 border border-slate-700/60 text-slate-300">
                          <MapPin size={10} className="text-cyan-400 shrink-0" />
                          {context.tab}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                          <Tag size={10} className="shrink-0" />
                          {context.column}
                        </span>
                      </div>
                      <p className="text-xs leading-snug text-slate-200 font-medium">{alert.message}</p>
                    </div>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}