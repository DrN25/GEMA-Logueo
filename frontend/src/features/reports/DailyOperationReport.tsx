import { Camera, Plus, Trash2 } from 'lucide-react';

interface ActivityRow {
  id: string;
  actividad: string;
  desdeFecha: string;
  desde: string; // Hora de inicio
  hastaFecha: string;
  hasta: string; // Hora de fin
  horas: number;
  idHerramienta: string;
}

interface Corrida {
  corrida: number;
  de: number;
  a: number;
  rec_m: number;
  rqd_m: number;
  lrf_m: number;
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

interface DailyOperationReportProps {
  activeTaladro: {
    name: string;
    proyecto: string;
    geologo: string;
    diametro: string;
    inclinacion: number;
    prof_final_eoh?: number;
    collar_este?: number;
    collar_norte?: number;
    collar_cota?: number;
  };
  selectedDate: string;
  selectedTurno: 'D' | 'N';
  dailyReportMetadata: {
    supervisor: string;
    equipo: string;
    modelo: string;
    desdeTime: string;
    hastaTime: string;
    paralizacion: string;
    perforista: string;
    ayudante1: string;
    ayudante2: string;
    jefeProyecto: string;
    planActividades: string;
    observaciones: string;
    observacionesGenerales?: string;
    otrosParalizaciones: string;
    depthFrom: string;
    depthTo: string;
    hoja: string;
    zona: string;
    azimut?: string;

    // Avance Diario
    profInicioNQ3: string;
    profInicioHQ3: string;
    profInicioCasing: string;
    profFinalNQ3: string;
    profFinalHQ3: string;
    profFinalCasing: string;
    longNQ3: string;
    longHQ3: string;
    longCasing: string;

    // QA/QC
    qaqcDesde: string;
    qaqcHasta: string;
    qaqcLong: string;
    qaqcComentarios: string;

    // Permeabilidad
    permEnsayo: string;
    permDesde: string;
    permHasta: string;
    permTramo: string;
    permTipo: string;
    permTipoK: string;
    permObs: string;

    // Foto cajas
    fotoDesde: string;
    fotoHasta: string;
    fotoAvance: string;
    fotoComentarios: string;

    // Insumos
    insumo1_prod: string;
    insumo1_cant: string;
    insumo2_prod: string;
    insumo2_cant: string;

    // Captions & Comment Overrides
    recOrientacionLabel: string;
    muestraRocaLajaLabel: string;
    resumenPerforacionComentario: string;
    resumenLogueoComentario: string;
    resumenQaqcComentario: string;
    resumenTeleviewComentario: string;
    resumenPltComentario: string;
    resumenMuestreoComentario: string;
  };
  onMetadataChange: (meta: any) => void;
  dailyActivities: ActivityRow[];
  onActivitiesChange: (activities: ActivityRow[]) => void;
  filteredCorridas: Corrida[];
  runningTotals: {
    count: number;
    desde: string;
    hasta: string;
    meters: number;
    rec: number;
    recPercent: number;
  };
  pltStats: {
    count: number;
    label: string;
    avgUcs: number;
  };
  geomechMetrics: {
    avgRqd: number;
    avgRmr89: number;
    dominantLito: string;
    avgRmrClass: string;
  };
  structuralStats: {
    count: number;
    avgJrc: number;
  };
  waterReadingsForDate: {
    ini: { hora: string; profundidad: string | number; nivelAgua: string | number; observacion: string };
    add: { hora: string; profundidad: string | number; nivelAgua: string | number; observacion: string };
    fin: { hora: string; profundidad: string | number; nivelAgua: string | number; observacion: string };
  };
  addActivityRow: () => void;
  removeActivityRow: (id: string) => void;
  handleActivityChange: (id: string, field: keyof ActivityRow, val: any) => void;
  azimutDisplay: string;
}

export default function DailyOperationReport({
  activeTaladro,
  selectedDate,
  selectedTurno,
  dailyReportMetadata,
  onMetadataChange,
  dailyActivities,
  filteredCorridas,
  runningTotals,
  pltStats,
  geomechMetrics,
  structuralStats,
  waterReadingsForDate,
  addActivityRow,
  removeActivityRow,
  handleActivityChange,
  azimutDisplay
}: DailyOperationReportProps) {

  const updateMetaField = (field: string, val: string) => {
    onMetadataChange({
      ...dailyReportMetadata,
      [field]: val
    });
  };

  const startD = runningTotals.desde !== '-' ? runningTotals.desde : '0.00';
  const endD = runningTotals.hasta !== '-' ? runningTotals.hasta : '0.00';

  return (
    <div className="space-y-3 daily-report-container text-black font-sans">

      {/* Estilos locales mejorados con forzado de color en impresión */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .daily-report-container {
          font-family: Arial, Helvetica, sans-serif !important;
          font-size: 8.5px !important;
          color: #000000 !important;
        }
        .daily-report-container * {
          color: #000000 !important;
          border-color: #000000 !important;
        }
        .daily-report-container table {
          border-collapse: collapse !important;
          border: 1px solid #000000 !important;
          width: 100% !important;
          margin-bottom: 2px !important;
        }
        .daily-report-container td, .daily-report-container th {
          border: 1px solid #000000 !important;
          font-size: 8px !important;
          padding: 2px 4px !important;
          font-weight: normal !important;
        }
        .daily-report-container th.bold-header {
          font-weight: bold !important;
          font-size: 8px !important;
        }
        .daily-report-container .yellow-banner-row {
          background-color: #f4cc70 !important;
          font-weight: bold !important;
          font-size: 8.5px !important;
          text-align: center !important;
          text-transform: uppercase !important;
          border: 1px solid #000000 !important;
        }
        .daily-report-container .yellow-banner-row-left {
          background-color: #f4cc70 !important;
          font-weight: bold !important;
          font-size: 8.5px !important;
          text-align: left !important;
          text-transform: uppercase !important;
          border: 1px solid #000000 !important;
          padding: 3px 6px !important;
        }
        .daily-report-container .metadata-table {
          background-color: #cccccc !important;
          border: 1px solid #000000 !important;
          border-collapse: collapse !important;
          width: 100% !important;
          margin-bottom: 6px !important;
        }
        .daily-report-container .metadata-table td {
          border: none !important;
          padding: 3px 6px !important;
          background-color: #cccccc !important;
          font-size: 8px !important;
        }
        .daily-report-container .gray-label-cell {
          background-color: #f4f4f5 !important;
          font-weight: normal !important;
          font-size: 8px !important;
        }
        .daily-report-container input, .daily-report-container select, .daily-report-container textarea {
          font-size: 8px !important;
          border: none !important;
          outline: none !important;
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          font-weight: normal !important;
          text-align: center !important;
        }
        .daily-report-container textarea {
          text-align: left !important;
        }
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .daily-report-container .metadata-table, .daily-report-container .metadata-table td {
            background-color: #cccccc !important;
          }
          .daily-report-container .yellow-banner-row, .daily-report-container .yellow-banner-row-left {
            background-color: #f4cc70 !important;
          }
          .daily-report-container .gray-label-cell {
            background-color: #f4f4f5 !important;
          }
          .daily-report-container .metadata-table input {
            background: transparent !important;
            background-color: transparent !important;
          }
        }
      `}} />

      {/* Header Title */}
      <div className="border border-black p-2 text-center uppercase bg-white mb-2">
        <h1 className="text-[11px] font-bold tracking-wider">HOJA DE REPORTE DIARIO</h1>
      </div>

      {/* General Info Metadata Table (Gris oscuro, sin celdas internas visibles, E, N y Z separados) */}
      <table className="metadata-table">
        <tbody>
          {/* Row 1 */}
          <tr>
            <td colSpan={1} className="font-bold">Proyecto:</td>
            <td colSpan={3}>{activeTaladro.proyecto}</td>
            <td colSpan={1} className="font-bold">Supervisor:</td>
            <td colSpan={3}>
              <input
                type="text"
                value={dailyReportMetadata.supervisor}
                onChange={(e) => updateMetaField('supervisor', e.target.value)}
                style={{ textAlign: 'left' }}
              />
            </td>
            <td colSpan={1} className="font-bold text-center">Hoja:</td>
            <td colSpan={1}>
              <input
                type="text"
                value={dailyReportMetadata.hoja}
                onChange={(e) => updateMetaField('hoja', e.target.value)}
              />
            </td>
            <td colSpan={1} className="font-bold text-center">Zona:</td>
            <td colSpan={1}>
              <input
                type="text"
                value={dailyReportMetadata.zona}
                onChange={(e) => updateMetaField('zona', e.target.value)}
              />
            </td>
          </tr>

          {/* Row 2 */}
          <tr>
            <td colSpan={1} className="font-bold">Sondaje:</td>
            <td colSpan={2} className="font-bold">{activeTaladro.name}</td>
            <td colSpan={1} className="font-bold">Equipo:</td>
            <td colSpan={2}>
              <input
                type="text"
                value={dailyReportMetadata.equipo}
                onChange={(e) => updateMetaField('equipo', e.target.value)}
                style={{ textAlign: 'left' }}
              />
            </td>
            <td colSpan={1} className="font-bold">Modelo:</td>
            <td colSpan={5}>
              <input
                type="text"
                value={dailyReportMetadata.modelo}
                onChange={(e) => updateMetaField('modelo', e.target.value)}
                style={{ textAlign: 'left' }}
              />
            </td>
          </tr>

          {/* Row 3 */}
          <tr>
            <td colSpan={1} className="font-bold">Fecha:</td>
            <td colSpan={2}>{selectedDate} ({selectedTurno})</td>
            <td colSpan={1} className="font-bold">Desde:</td>
            <td colSpan={1}>
              <input
                type="text"
                value={dailyReportMetadata.desdeTime}
                onChange={(e) => updateMetaField('desdeTime', e.target.value)}
              />
            </td>
            <td colSpan={1} className="font-bold">Hasta:</td>
            <td colSpan={1}>
              <input
                type="text"
                value={dailyReportMetadata.hastaTime}
                onChange={(e) => updateMetaField('hastaTime', e.target.value)}
              />
            </td>
            <td colSpan={3} className="font-bold">Paralización (Horas total):</td>
            <td colSpan={2}>
              <input
                type="text"
                value={dailyReportMetadata.paralizacion}
                onChange={(e) => updateMetaField('paralizacion', e.target.value)}
              />
            </td>
          </tr>

          {/* Row 4 */}
          <tr>
            <td colSpan={1} className="font-bold">Coordenadas:</td>
            <td colSpan={1}>
              <span className="font-bold">E:</span> {activeTaladro.collar_este?.toFixed(2) || '0.00'}
            </td>
            <td colSpan={1}>
              <span className="font-bold">N:</span> {activeTaladro.collar_norte?.toFixed(2) || '0.00'}
            </td>
            <td colSpan={1}>
              <span className="font-bold">Z:</span> {activeTaladro.collar_cota?.toFixed(2) || '0.00'}
            </td>
            <td colSpan={1} className="font-bold">Inclinación:</td>
            <td colSpan={1}>{activeTaladro.inclinacion}°</td>
            <td colSpan={1} className="font-bold">Azimut:</td>
            <td colSpan={2}>
              <input
                type="text"
                value={dailyReportMetadata.azimut || azimutDisplay}
                onChange={(e) => updateMetaField('azimut', e.target.value)}
              />
            </td>
            <td colSpan={1} className="font-bold">Prof. (m):</td>
            <td colSpan={2}>{activeTaladro.prof_final_eoh !== undefined && activeTaladro.prof_final_eoh > 0 ? activeTaladro.prof_final_eoh.toFixed(2) : '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* SECTION: PERFORACIÓN */}
      <table className="w-full text-center">
        <thead>
          <tr>
            <th colSpan={10} className="yellow-banner-row">
              PERFORACIÓN
            </th>
          </tr>
          <tr className="bg-[#f4cc70] font-bold">
            <th className="bold-header">Tipo perforación</th>
            <th className="bold-header">Acción</th>
            <th className="bold-header">Tipo herram.</th>
            <th className="bold-header">Diámetro</th>
            <th className="bold-header">ID herramienta</th>
            <th className="bold-header">Desde</th>
            <th className="bold-header">Hasta</th>
            <th className="bold-header">Total</th>
            <th className="bold-header">Recup.</th>
            <th className="bold-header">Recup.%</th>
          </tr>
        </thead>
        <tbody>
          {filteredCorridas.map((c, idx) => (
            <tr key={idx}>
              <td>DIAMANTINA</td>
              <td>PERFORACION</td>
              <td>BROCA</td>
              <td>{activeTaladro.diametro || 'HQ3'}</td>
              <td>
                <input
                  type="text"
                  value={c.offset || '629435'}
                  onChange={() => { }}
                />
              </td>
              <td>{c.de.toFixed(2)}</td>
              <td>{c.a.toFixed(2)}</td>
              <td>{(c.a - c.de).toFixed(2)}</td>
              <td>{c.rec_m.toFixed(2)}</td>
              <td>
                {((c.rec_m / (c.a - c.de)) * 100).toFixed(2)}
              </td>
            </tr>
          ))}
          {filteredCorridas.length === 0 && (
            <tr>
              <td colSpan={10} className="py-2 text-zinc-400 italic text-[10px]">
                Ninguna corrida coincide en el rango
              </td>
            </tr>
          )}
          {/* Fila de Totales: Fondo gris claro, sin bordes verticales */}
          <tr className="bg-[#f4f4f5]">
            <td colSpan={2} style={{ borderRight: 'none', borderLeft: 'none', textAlign: 'left', fontWeight: 'bold' }} className="bold-header pl-2">
              Corridas: <span style={{ fontWeight: 'normal' }}>{runningTotals.count}</span>
            </td>
            <td colSpan={3} style={{ borderRight: 'none', borderLeft: 'none', textAlign: 'right', fontWeight: 'bold' }} className="bold-header pr-2">
              Totales
            </td>
            <td style={{ borderRight: 'none', borderLeft: 'none' }}>{runningTotals.desde}</td>
            <td style={{ borderRight: 'none', borderLeft: 'none' }}>{runningTotals.hasta}</td>
            <td style={{ borderRight: 'none', borderLeft: 'none' }}>{runningTotals.meters.toFixed(2)}</td>
            <td style={{ borderRight: 'none', borderLeft: 'none' }}>{runningTotals.rec.toFixed(2)}</td>
            <td style={{ borderRight: 'none', borderLeft: 'none' }}>{runningTotals.recPercent.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* SECTION: ACTIVIDADES */}
      <table className="w-full text-center">
        <thead>
          <tr>
            <th colSpan={8} className="yellow-banner-row relative">
              <div className="flex justify-between items-center px-2">
                <span className="mx-auto pl-6">ACTIVIDADES</span>
                <button
                  type="button"
                  onClick={addActivityRow}
                  className="no-print bg-emerald-600 hover:bg-emerald-700 text-white p-0.5 rounded cursor-pointer transition-colors"
                  title="Agregar Actividad"
                >
                  <Plus size={11} />
                </button>
              </div>
            </th>
          </tr>
          <tr className="bg-[#f4cc70] font-bold">
            <th className="bold-header" style={{ textAlign: 'left', paddingLeft: '8px' }}>Actividad</th>
            <th className="bold-header w-[14%]">Desde (Fecha)</th>
            <th className="bold-header w-[10%]">Desde (Hora)</th>
            <th className="bold-header w-[14%]">Hasta (Fecha)</th>
            <th className="bold-header w-[10%]">Hasta (Hora)</th>
            <th className="bold-header w-[8%]">Horas</th>
            <th className="bold-header w-[14%]">ID herramienta</th>
            <th className="bold-header no-print w-[6%]"></th>
          </tr>
        </thead>
        <tbody>
          {dailyActivities.map((act) => (
            <tr key={act.id}>
              <td style={{ textAlign: 'left', paddingLeft: '8px' }}>
                <input
                  type="text"
                  value={act.actividad}
                  onChange={(e) => handleActivityChange(act.id, 'actividad', e.target.value)}
                  placeholder="Ingrese actividad..."
                  style={{ textAlign: 'left' }}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={act.desdeFecha}
                  onChange={(e) => handleActivityChange(act.id, 'desdeFecha', e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={act.desde}
                  onChange={(e) => handleActivityChange(act.id, 'desde', e.target.value)}
                  placeholder="HH:MM"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={act.hastaFecha}
                  onChange={(e) => handleActivityChange(act.id, 'hastaFecha', e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={act.hasta}
                  onChange={(e) => handleActivityChange(act.id, 'hasta', e.target.value)}
                  placeholder="HH:MM"
                />
              </td>
              <td style={{ fontWeight: 'bold' }}>{act.horas.toFixed(2)}</td>
              <td>
                <input
                  type="text"
                  value={act.idHerramienta}
                  onChange={(e) => handleActivityChange(act.id, 'idHerramienta', e.target.value)}
                />
              </td>
              <td className="no-print text-center">
                <button
                  type="button"
                  onClick={() => removeActivityRow(act.id)}
                  className="text-red-600 hover:text-red-800 transition-colors inline-flex items-center justify-center p-1"
                  title="Eliminar fila"
                >
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
          <tr className="bg-[#f4f4f5]">
            <td colSpan={5} style={{ borderRight: 'none', borderLeft: 'none' }}></td>
            <td style={{ borderRight: 'none', borderLeft: 'none', fontWeight: 'bold' }} className="bold-header">
              {dailyActivities.reduce((sum, a) => sum + a.horas, 0).toFixed(2)}
            </td>
            <td style={{ borderRight: 'none', borderLeft: 'none' }}></td>
            <td className="no-print" style={{ borderRight: 'none', borderLeft: 'none' }}></td>
          </tr>
        </tbody>
      </table>

      {/* GRID COLUMN LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">

        {/* LEFT COLUMN - SUB-TABLES */}
        <div className="space-y-3">

          {/* 4. MATERIALES E INSUMOS UTILIZADOS */}
          <table className="w-full text-center">
            <thead>
              <tr>
                <th colSpan={3} className="yellow-banner-row-left">
                  4. MATERIALES E INSUMOS UTILIZADOS
                </th>
              </tr>
              <tr className="gray-label-cell">
                <td style={{ width: '12%' }}>Item</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Producto</td>
                <td style={{ width: '28%' }}>Cantidad</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 'bold' }} className="bold-header">1</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>
                  <input
                    type="text"
                    value={dailyReportMetadata.insumo1_prod}
                    onChange={(e) => updateMetaField('insumo1_prod', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.insumo1_cant}
                    onChange={(e) => updateMetaField('insumo1_cant', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold' }} className="bold-header">2</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>
                  <input
                    type="text"
                    value={dailyReportMetadata.insumo2_prod}
                    onChange={(e) => updateMetaField('insumo2_prod', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.insumo2_cant}
                    onChange={(e) => updateMetaField('insumo2_cant', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* 3. PERSONAL EN PLATAFORMA */}
          <table className="w-full">
            <thead>
              <tr>
                <th colSpan={2} className="yellow-banner-row-left">
                  3. PERSONAL EN PLATAFORMA
                </th>
              </tr>
              <tr className="gray-label-cell">
                <td style={{ width: '33%', textAlign: 'center' }}>Función</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Nombre y Apellidos</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }} className="bold-header">PERFORISTA</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>
                  <input
                    type="text"
                    value={dailyReportMetadata.perforista}
                    onChange={(e) => updateMetaField('perforista', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }} className="bold-header">AYUDANTE DE MAQUINA</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>
                  <input
                    type="text"
                    value={dailyReportMetadata.ayudante1}
                    onChange={(e) => updateMetaField('ayudante1', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }} className="bold-header">AYUDANTE DE MAQUINA</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>
                  <input
                    type="text"
                    value={dailyReportMetadata.ayudante2}
                    onChange={(e) => updateMetaField('ayudante2', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }} className="bold-header">SUPERVISOR</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>
                  <input
                    type="text"
                    value={dailyReportMetadata.supervisor}
                    onChange={(e) => updateMetaField('supervisor', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', fontWeight: 'bold' }} className="bold-header">JEFE DE PROYECTO</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>
                  <input
                    type="text"
                    value={dailyReportMetadata.jefeProyecto}
                    onChange={(e) => updateMetaField('jefeProyecto', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* COMENTARIOS */}
          <table className="w-full">
            <thead>
              <tr>
                <th className="yellow-banner-row-left">Comentarios:</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 bg-white">
                  <div className="space-y-1 font-sans text-black leading-normal min-h-[85px]">
                    <p>- Avance de perforacion en linea {activeTaladro.diametro || 'HQ3'} desde {startD} m hasta {endD} m.</p>
                    {pltStats.count > 0 && (
                      <p>- Selección y ensayo de {pltStats.count.toString().padStart(2, '0')} muestras PLT{pltStats.label}.</p>
                    )}
                    {geomechMetrics.avgRmr89 > 0 && (
                      <>
                        <p>- RQD Promedio: {geomechMetrics.avgRqd}% \| RMR'89 Promedio: {geomechMetrics.avgRmr89} ({geomechMetrics.avgRmrClass}).</p>
                        <p>- Litología principal del tramo: {geomechMetrics.dominantLito}.</p>
                      </>
                    )}
                    {structuralStats.count > 0 && (
                      <p>- Discontinuidades estructurales: {structuralStats.count} registradas en el tramo (JRC promedio: {structuralStats.avgJrc}).</p>
                    )}
                    <textarea
                      value={dailyReportMetadata.observaciones}
                      onChange={(e) => updateMetaField('observaciones', e.target.value)}
                      placeholder="Ingrese notas geológicas adicionales aquí..."
                      className="w-full h-12 mt-1 placeholder-zinc-400 font-normal"
                      style={{ textAlign: 'left', resize: 'none' }}
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* AVANCE DIARIO */}
          <table className="w-full text-center">
            <thead>
              <tr>
                <th colSpan={4} className="yellow-banner-row">AVANCE DIARIO</th>
              </tr>
              <tr className="bg-[#f4cc70] font-bold">
                <th className="bold-header" style={{ textAlign: 'left', paddingLeft: '8px' }}>Descripción</th>
                <th className="bold-header">Línea NQ3</th>
                <th className="bold-header">Línea HQ3</th>
                <th className="bold-header">Casing HWT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Profundidad inicio del turno (m)</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.profInicioNQ3}
                    onChange={(e) => updateMetaField('profInicioNQ3', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.profInicioHQ3}
                    onChange={(e) => updateMetaField('profInicioHQ3', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.profInicioCasing}
                    onChange={(e) => updateMetaField('profInicioCasing', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Profundidad final del turno (m)</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.profFinalNQ3}
                    onChange={(e) => updateMetaField('profFinalNQ3', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.profFinalHQ3}
                    onChange={(e) => updateMetaField('profFinalHQ3', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.profFinalCasing}
                    onChange={(e) => updateMetaField('profFinalCasing', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Longitud perforada en el turno (m)</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.longNQ3}
                    onChange={(e) => updateMetaField('longNQ3', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.longHQ3}
                    onChange={(e) => updateMetaField('longHQ3', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.longCasing}
                    onChange={(e) => updateMetaField('longCasing', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* REVISIÓN DEL LOGUEO GEOTÉCNICO DIRECCIONADO (QA/QC) */}
          <table className="w-full text-center">
            <thead>
              <tr>
                <th colSpan={4} className="yellow-banner-row">
                  REVISIÓN DEL LOGUEO GEOTÉCNICO DIRECCIONADO EN PLATAFORMA DE PERFORACIÓN (QA/QC)
                </th>
              </tr>
              <tr className="bg-[#f4cc70] font-bold">
                <th className="bold-header">Desde (m)</th>
                <th className="bold-header">Hasta (m)</th>
                <th className="bold-header">Longitud (m)</th>
                <th className="bold-header">Comentarios</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.qaqcDesde}
                    onChange={(e) => updateMetaField('qaqcDesde', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.qaqcHasta}
                    onChange={(e) => updateMetaField('qaqcHasta', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.qaqcLong}
                    onChange={(e) => updateMetaField('qaqcLong', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.qaqcComentarios}
                    onChange={(e) => updateMetaField('qaqcComentarios', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* ENSAYO DE PERMEABILIDAD (Lefranc o Lugeon) */}
          <table className="w-full text-center">
            <thead>
              <tr>
                <th colSpan={3} className="yellow-banner-row">ENSAYO DE PERMEABILIDAD (LEFRANC O LUGEON)</th>
              </tr>
              <tr className="bg-[#f4cc70] font-bold">
                <th className="bold-header" style={{ width: '25%' }}>N° de ensayo</th>
                <th className="bold-header" style={{ width: '25%' }}>-</th>
                <th className="bold-header" style={{ width: '50%' }}>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Desde (m)</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.permDesde}
                    onChange={(e) => updateMetaField('permDesde', e.target.value)}
                  />
                </td>
                <td rowSpan={5} style={{ verticalAlign: 'top', padding: '4px' }}>
                  <textarea
                    value={dailyReportMetadata.permObs}
                    onChange={(e) => updateMetaField('permObs', e.target.value)}
                    style={{ height: '65px', resize: 'none' }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Hasta (m)</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.permHasta}
                    onChange={(e) => updateMetaField('permHasta', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Tramo (m)</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.permTramo}
                    onChange={(e) => updateMetaField('permTramo', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Tipo de ensayo</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.permTipo}
                    onChange={(e) => updateMetaField('permTipo', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Tipo de ensayo de K</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.permTipoK}
                    onChange={(e) => updateMetaField('permTipoK', e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* CONTROL DE NIVEL DE AGUA EN POZO */}
          <table className="w-full text-center">
            <thead>
              <tr>
                <th colSpan={5} className="yellow-banner-row">CONTROL DE NIVEL DE AGUA EN POZO</th>
              </tr>
              <tr className="bg-[#f4cc70] font-bold">
                <th className="bold-header" style={{ textAlign: 'left', paddingLeft: '8px' }}>Designación</th>
                <th className="bold-header">Hora</th>
                <th className="bold-header">Prof. (m)</th>
                <th className="bold-header">Nv. Agua (m)</th>
                <th className="bold-header">Comentarios</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Inic. de turno</td>
                <td>{waterReadingsForDate.ini.hora}</td>
                <td>{waterReadingsForDate.ini.profundidad}</td>
                <td>{waterReadingsForDate.ini.nivelAgua}</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>{waterReadingsForDate.ini.observacion}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Adicional</td>
                <td>{waterReadingsForDate.add.hora}</td>
                <td>{waterReadingsForDate.add.profundidad}</td>
                <td>{waterReadingsForDate.add.nivelAgua}</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>{waterReadingsForDate.add.observacion}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>Fin de turno</td>
                <td>{waterReadingsForDate.fin.hora}</td>
                <td>{waterReadingsForDate.fin.profundidad}</td>
                <td>{waterReadingsForDate.fin.nivelAgua}</td>
                <td style={{ textAlign: 'left', paddingLeft: '8px' }}>{waterReadingsForDate.fin.observacion}</td>
              </tr>
            </tbody>
          </table>

          {/* FOTOGRAFIADO DE CAJAS */}
          <table className="w-full text-center">
            <thead>
              <tr>
                <th colSpan={4} className="yellow-banner-row">FOTOGRAFIADO DE CAJAS</th>
              </tr>
              <tr className="bg-[#f4cc70] font-bold">
                <th className="bold-header">Desde (m)</th>
                <th className="bold-header">Hasta (m)</th>
                <th className="bold-header">Avance (m)</th>
                <th className="bold-header">Comentarios</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.fotoDesde}
                    onChange={(e) => updateMetaField('fotoDesde', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.fotoHasta}
                    onChange={(e) => updateMetaField('fotoHasta', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.fotoAvance}
                    onChange={(e) => updateMetaField('fotoAvance', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.fotoComentarios}
                    onChange={(e) => updateMetaField('fotoComentarios', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>

        </div>

        {/* RIGHT COLUMN - VISUAL REGISTER AND OPERATION SUMMARIES */}
        <div className="space-y-3">

          {/* PHOTOGRAPHY BOX */}
          <table className="w-full">
            <thead>
              <tr>
                <th className="yellow-banner-row-left">
                  <div className="flex justify-between items-center w-full">
                    <span>FOTOGRAFÍA</span>
                    <span style={{ fontSize: '7.5px', fontStyle: 'italic', paddingRight: '8px' }}>REGISTRO DE TESTIGOS</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="p-3 bg-zinc-50/10 flex flex-col items-center justify-center h-[162px] border-dashed border-2 relative">
                    <Camera size={26} className="text-zinc-400 mb-1" />
                    <p style={{ fontSize: '8px', fontWeight: 'bold' }}>ESPACIO PARA FOTO OPERATIVA</p>
                    <p style={{ fontSize: '7px' }}>Anexo Digital de Registro Diario</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="text-center font-normal text-[8px] px-1 space-y-1">
            <input
              type="text"
              value={dailyReportMetadata.recOrientacionLabel}
              onChange={(e) => updateMetaField('recOrientacionLabel', e.target.value)}
              className="border-dashed text-center"
            />
            <input
              type="text"
              value={dailyReportMetadata.muestraRocaLajaLabel}
              onChange={(e) => updateMetaField('muestraRocaLajaLabel', e.target.value)}
              className="border-dashed text-center"
            />
          </div>

          {/* RESUMEN DE AVANCES DE ACTIVIDADES REALIZADAS AL CIERRE DEL TURNO */}
          <table className="w-full text-center">
            <thead>
              <tr>
                <th colSpan={6} className="yellow-banner-row">
                  RESUMEN DE AVANCES DE ACTIVIDADES REALIZADAS AL CIERRE DEL TURNO
                </th>
              </tr>
              <tr className="bg-[#f4cc70]">
                <th className="bold-header" style={{ textAlign: 'left', paddingLeft: '8px' }}>Designación</th>
                <th className="bold-header">Desde (m)</th>
                <th className="bold-header">Hasta (m)</th>
                <th className="bold-header">Longitud (m)</th>
                <th className="bold-header">Avance Acumulado (%)</th>
                <th className="bold-header">Comentarios</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px', fontWeight: 'bold' }} className="bold-header">Perforación</td>
                <td>0.00</td>
                <td>{endD}</td>
                <td>{endD}</td>
                <td>
                  {activeTaladro.prof_final_eoh && activeTaladro.prof_final_eoh > 0
                    ? `${((parseFloat(endD) / activeTaladro.prof_final_eoh) * 100).toFixed(2)}%`
                    : '0.00%'
                  }
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.resumenPerforacionComentario}
                    onChange={(e) => updateMetaField('resumenPerforacionComentario', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px', fontWeight: 'bold' }} className="bold-header">Logueo en plataforma</td>
                <td>0.00</td>
                <td>{endD}</td>
                <td>{endD}</td>
                <td>
                  {activeTaladro.prof_final_eoh && activeTaladro.prof_final_eoh > 0
                    ? `${((parseFloat(endD) / activeTaladro.prof_final_eoh) * 100).toFixed(2)}%`
                    : '0.00%'
                  }
                </td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.resumenLogueoComentario}
                    onChange={(e) => updateMetaField('resumenLogueoComentario', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px', fontWeight: 'bold' }} className="bold-header">Logueo QA/QC</td>
                <td>0.00</td>
                <td>{endD}</td>
                <td>{endD}</td>
                <td>0.00%</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.resumenQaqcComentario}
                    onChange={(e) => updateMetaField('resumenQaqcComentario', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px', fontWeight: 'bold' }} className="bold-header">Teleview</td>
                <td>0.00</td>
                <td>0.00</td>
                <td>0.00</td>
                <td>0.00%</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.resumenTeleviewComentario}
                    onChange={(e) => updateMetaField('resumenTeleviewComentario', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px', fontWeight: 'bold' }} className="bold-header">Ensayo PLT</td>
                <td>0.00</td>
                <td>0.00</td>
                <td>0.00</td>
                <td>-</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.resumenPltComentario}
                    onChange={(e) => updateMetaField('resumenPltComentario', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '8px', fontWeight: 'bold' }} className="bold-header">Muestreo</td>
                <td>0.00</td>
                <td>0.00</td>
                <td>0.00</td>
                <td>0.00%</td>
                <td>
                  <input
                    type="text"
                    value={dailyReportMetadata.resumenMuestreoComentario}
                    onChange={(e) => updateMetaField('resumenMuestreoComentario', e.target.value)}
                    style={{ textAlign: 'left' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* PLAN ACTIVIDADES PARA PROXIMO TURNO */}
          <table className="w-full">
            <thead>
              <tr>
                <th className="yellow-banner-row-left" style={{ paddingLeft: '8px' }}>
                  PLAN ACTIVIDADES PARA PROXIMO TURNO
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <textarea
                    value={dailyReportMetadata.planActividades}
                    onChange={(e) => updateMetaField('planActividades', e.target.value)}
                    style={{ height: '36px', resize: 'none' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* OBSERVACIONES */}
          <table className="w-full">
            <thead>
              <tr>
                <th className="yellow-banner-row-left" style={{ paddingLeft: '8px' }}>
                  OBSERVACIONES
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <textarea
                    value={dailyReportMetadata.observacionesGenerales || ''}
                    onChange={(e) => updateMetaField('observacionesGenerales', e.target.value)}
                    placeholder="..."
                    style={{ height: '36px', resize: 'none' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {/* OTROS (Indicar motivos de paralización de la perforación) */}
          <table className="w-full">
            <thead>
              <tr>
                <th className="yellow-banner-row-left" style={{ paddingLeft: '8px' }}>
                  OTROS (INDICAR MOTIVOS DE PARALIZACIÓN DE LA PERFORACIÓN)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <textarea
                    value={dailyReportMetadata.otrosParalizaciones}
                    onChange={(e) => updateMetaField('otrosParalizaciones', e.target.value)}
                    placeholder="..."
                    style={{ height: '36px', resize: 'none' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>

        </div>
      </div>

      {/* SIGNATURES */}
      <div className="hidden print:flex justify-around items-center pt-6 text-center text-[10px] print-avoid-break">
        <div className="w-1/3 border-t border-black pt-1">
          <p className="font-bold">Supervisor de Perforación</p>
          <p>Contratista</p>
        </div>
        <div className="w-1/3 border-t border-black pt-1">
          <p className="font-bold">Geólogo Supervisor</p>
          <p>Servicio Geotécnico</p>
        </div>
      </div>
    </div>
  );
}