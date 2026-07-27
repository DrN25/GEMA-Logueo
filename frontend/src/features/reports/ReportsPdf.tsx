import { useState, useEffect, useMemo } from 'react';
import { calculateRowRmr } from '../../utils/formulaEngine';
import { FileText, Printer } from 'lucide-react';
import WaterControlReport from './WaterControlReport';
import DailyOperationReport from './DailyOperationReport';

interface Survey {
  depth: number;
  dip: number;
  azimuth: number;
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

interface Discontinuidad {
  id: number;
  de: number;
  a: number;
  profundidad: number;
  litologia: string;
  tipo_estructura: string;
  alfa: number;
  beta: number;
  forma: number;
  rugosidad: number;
  jrc10: number;
  abertura: number;
  weathering: string;
  espesor: number;
  relleno1: string;
  relleno2?: string;
  dureza_pared: string;
  agua: string;
  geotecnico: string;
  comentario?: string;
  corrida: number;
  tipo: string;
}

interface EnsayoPlt {
  id?: number;
  fecha: string;
  nro_muestra: string;
  nro_caja: number;
  from_m: number;
  to_m: number;
  verif_corrida: string;
  long_de_corrida_m: number;
  este_m: number;
  norte_m: number;
  elevacion_msnm: number;
  long_de_muestra_mm: number;
  tipo_de_ensayo: string;
  diametro_taladro_nominacion: string;
  d_mm: number;
  verif_de_longitud: string;
  p_instr_kn: number;
  tipo_rotura_code: string;
  direccion_rotura_code: string;
  ejecutadoPor: string;
  is_mpa: number;
  fact_corr: number;
  is_50_mpa: number;
  factor_k?: number;
  ucs: number;
  isrm_indice_r: string;
  observaciones?: string;
  corrida_desde?: number;
  corrida_hasta?: number;
}

interface Collar {
  name: string;
  proyecto: string;
  geologo: string;
  diametro: string;
  inclinacion: number;
  campana: string;
  fecha_registro: string;
  nivel_freatico?: number;
  collar_este_proyectado?: number;
  collar_norte_proyectado?: number;
  collar_cota_proyectado?: number;
  prof_final_eoh_proyectada?: number;
  comentarios_proyectado?: string;
  collar_este: number;
  collar_norte: number;
  collar_cota: number;
  prof_final_eoh?: number;
  comentarios?: string;
  turno: string;
}

interface Taladro extends Collar {
  surveys: Survey[];
  corridas: Corrida[];
  discontinuidades: Discontinuidad[];
  ensayos_plt: EnsayoPlt[];
}

interface TaladroSummary {
  name: string;
  proyecto: string;
  geologo: string;
  diametro: string;
  inclinacion: number;
  fecha_registro: string;
  corridas_count: number;
  surveys_count: number;
}

interface ReportsPdfProps {
  activeTaladro: Taladro;
  taladros: TaladroSummary[];
  onSelectTaladro: (name: string) => void;
}

interface WaterReading {
  id: string;
  fecha: string;
  hora: string;
  turno: string;
  nivelAgua: number | '';
  profundidad: number | '';
  observacion: string;
}

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

const getNextDay = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  } catch (e) {
    return dateStr;
  }
};

const calculateHours = (desde: string, hasta: string): number => {
  if (!desde || !hasta) return 0;
  const [h1, m1] = desde.split(':').map(Number);
  const [h2, m2] = hasta.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diffMins < 0) {
    diffMins += 24 * 60;
  }
  return parseFloat((diffMins / 60).toFixed(2));
};

const calculateHoursWithDates = (desdeF: string, desdeH: string, hastaF: string, hastaH: string): number => {
  if (!desdeF || !desdeH || !hastaF || !hastaH) return 0;
  try {
    const d1 = new Date(`${desdeF}T${desdeH}`);
    const d2 = new Date(`${hastaF}T${hastaH}`);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return calculateHours(desdeH, hastaH);
    }
    const diffMs = d2.getTime() - d1.getTime();
    if (diffMs <= 0) return 0;
    return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
  } catch (e) {
    return calculateHours(desdeH, hastaH);
  }
};

export default function ReportsPdf({ activeTaladro, taladros, onSelectTaladro }: ReportsPdfProps) {
  const [activeTab, setActiveTab] = useState<'water' | 'daily'>('water');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTurno, setSelectedTurno] = useState<'D' | 'N'>('D');

  // --- LOCAL STATES FOR PERSISTENCE ---
  const [waterReadings, setWaterReadings] = useState<WaterReading[]>([]);
  const [cliente, setCliente] = useState<string>('Servicio de Investigación Geotécnica');
  const [dailyReportMetadata, setDailyReportMetadata] = useState({
    supervisor: 'RD/RB',
    equipo: 'PE7-132',
    modelo: '-',
    desdeTime: '07:00',
    hastaTime: '19:00',
    paralizacion: '0 hrs',
    perforista: 'V. Estrada',
    ayudante1: 'P. Landa',
    ayudante2: 'J. Cardozo',
    jefeProyecto: 'C. Tavera',
    planActividades: '- Continuar con la perforación',
    observaciones: '',
    observacionesGenerales: '',
    otrosParalizaciones: '',
    depthFrom: '',
    depthTo: '',

    hoja: '',
    zona: '',

    profInicioNQ3: '',
    profInicioHQ3: '',
    profInicioCasing: '',
    profFinalNQ3: '',
    profFinalHQ3: '',
    profFinalCasing: '',
    longNQ3: '',
    longHQ3: '',
    longCasing: '',

    qaqcDesde: '-',
    qaqcHasta: '-',
    qaqcLong: '-',
    qaqcComentarios: '-',

    permEnsayo: '-',
    permDesde: '-',
    permHasta: '-',
    permTramo: '-',
    permTipo: '-',
    permTipoK: '-',
    permObs: '-',

    fotoDesde: '-',
    fotoHasta: '-',
    fotoAvance: '-',
    fotoComentarios: '-',

    insumo1_prod: '-',
    insumo1_cant: '-',
    insumo2_prod: '-',
    insumo2_cant: '-',

    recOrientacionLabel: '',
    muestraRocaLajaLabel: '',
    resumenPerforacionComentario: '-',
    resumenLogueoComentario: '-',
    resumenQaqcComentario: '-',
    resumenTeleviewComentario: '-',
    resumenPltComentario: '-',
    resumenMuestreoComentario: '-',
  });

  const [dailyActivities, setDailyActivities] = useState<ActivityRow[]>([]);

  const availableDates = useMemo<string[]>(() => {
    if (!activeTaladro) return [];
    const dates = new Set<string>();
    if (activeTaladro.fecha_registro) dates.add(activeTaladro.fecha_registro);
    activeTaladro.ensayos_plt?.forEach(p => {
      if (p.fecha) dates.add(p.fecha);
    });
    if (dates.size === 0) {
      dates.add(new Date().toISOString().split('T')[0]);
    }
    return Array.from(dates).sort();
  }, [activeTaladro]);

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (activeTaladro) {
      const dates = new Set<string>();
      if (activeTaladro.fecha_registro) dates.add(activeTaladro.fecha_registro);
      activeTaladro.ensayos_plt?.forEach(p => {
        if (p.fecha) dates.add(p.fecha);
      });
      const sortedDates = Array.from(dates).sort();
      setSelectedDate(sortedDates[sortedDates.length - 1] || new Date().toISOString().split('T')[0]);
      setSelectedTurno((activeTaladro.turno as 'D' | 'N') || 'D');
    }
  }, [activeTaladro?.name]);

  useEffect(() => {
    if (!activeTaladro) return;
    const key = `geolog_water_readings_${activeTaladro.name}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.length < 36) {
        const padded = [...parsed];
        for (let i = parsed.length; i < 36; i++) {
          padded.push({
            id: `w_empty_${i}_${Date.now()}`,
            fecha: '',
            hora: '',
            turno: '',
            nivelAgua: '',
            profundidad: '',
            observacion: ''
          });
        }
        setWaterReadings(padded);
      } else {
        setWaterReadings(parsed);
      }
    } else {
      let fmtDate = selectedDate;
      if (selectedDate.includes('-')) {
        const [y, m, d] = selectedDate.split('-');
        fmtDate = `${parseInt(d)}/${parseInt(m)}/${y}`;
      }
      const initial: WaterReading[] = [
        { id: 'w1', fecha: fmtDate, hora: '21:00', turno: 'N', nivelAgua: 9.40, profundidad: 45.50, observacion: 'Inicio de turno' },
        { id: 'w2', fecha: fmtDate, hora: '08:30', turno: 'D', nivelAgua: 9.40, profundidad: 45.50, observacion: 'Inicio de turno' },
        { id: 'w3', fecha: fmtDate, hora: '21:00', turno: 'N', nivelAgua: 12.10, profundidad: 79.30, observacion: 'Inicio de turno' }
      ];
      for (let i = initial.length; i < 36; i++) {
        initial.push({
          id: `w_empty_${i}_${Date.now()}`,
          fecha: '',
          hora: '',
          turno: '',
          nivelAgua: '',
          profundidad: '',
          observacion: ''
        });
      }
      setWaterReadings(initial);
      localStorage.setItem(key, JSON.stringify(initial));
    }
  }, [activeTaladro?.name]);

  useEffect(() => {
    if (!activeTaladro) return;
    const cached = localStorage.getItem(`geolog_client_${activeTaladro.name}`);
    if (cached) {
      setCliente(cached);
    } else {
      setCliente('Servicio de Investigación Geotécnica');
    }
  }, [activeTaladro?.name]);

  const handleClienteChange = (val: string) => {
    setCliente(val);
    if (activeTaladro) {
      localStorage.setItem(`geolog_client_${activeTaladro.name}`, val);
    }
  };

  const handleWaterReadingsChange = (updated: WaterReading[]) => {
    setWaterReadings(updated);
    if (activeTaladro) {
      localStorage.setItem(`geolog_water_readings_${activeTaladro.name}`, JSON.stringify(updated));
    }
  };

  useEffect(() => {
    if (!activeTaladro || !selectedDate) return;
    const key = `geolog_daily_${activeTaladro.name}_${selectedDate}_${selectedTurno}`;
    const cached = localStorage.getItem(key);

    const startDepth = activeTaladro.corridas[0]?.de || 0.0;
    const endDepth = activeTaladro.corridas[activeTaladro.corridas.length - 1]?.a || 0.0;

    if (cached) {
      const data = JSON.parse(cached);
      const acts = (data.activities || []).map((a: any) => ({
        ...a,
        desdeFecha: a.desdeFecha || selectedDate,
        hastaFecha: a.hastaFecha || selectedDate
      }));
      setDailyReportMetadata(data.metadata);
      setDailyActivities(acts);
    } else {
      const defaultMeta = {
        supervisor: 'RD/RB',
        equipo: 'PE7-132',
        modelo: '-',
        desdeTime: selectedTurno === 'D' ? '07:00' : '19:00',
        hastaTime: selectedTurno === 'D' ? '19:00' : '07:00',
        paralizacion: '0 hrs',
        perforista: 'V. Estrada',
        ayudante1: 'P. Landa',
        ayudante2: 'J. Cardozo',
        jefeProyecto: 'C. Tavera',
        planActividades: '- Continuar con la perforación',
        observaciones: 'Ingrese notas geológicas adicionales aquí...',
        observacionesGenerales: '',
        otrosParalizaciones: '',
        depthFrom: String(startDepth.toFixed(2)),
        depthTo: String(endDepth.toFixed(2)),

        hoja: '',
        zona: '',

        profInicioNQ3: '',
        profInicioHQ3: '',
        profInicioCasing: '',
        profFinalNQ3: '',
        profFinalHQ3: '',
        profFinalCasing: '',
        longNQ3: '',
        longHQ3: '',
        longCasing: '',

        qaqcDesde: '-',
        qaqcHasta: '-',
        qaqcLong: '-',
        qaqcComentarios: '-',

        permEnsayo: '-',
        permDesde: '-',
        permHasta: '-',
        permTramo: '-',
        permTipo: '-',
        permTipoK: '-',
        permObs: '-',

        fotoDesde: '-',
        fotoHasta: '-',
        fotoAvance: '-',
        fotoComentarios: '-',

        insumo1_prod: '-',
        insumo1_cant: '-',
        insumo2_prod: '-',
        insumo2_cant: '-',

        recOrientacionLabel: `Recuperación de línea de orientacion sondaje ${activeTaladro.name}`,
        muestraRocaLajaLabel: `Muestra de roca en laja ${startDepth.toFixed(2)} m - ${endDepth.toFixed(2)} m, sondaje ${activeTaladro.name}`,
        resumenPerforacionComentario: '-',
        resumenLogueoComentario: '-',
        resumenQaqcComentario: '-',
        resumenTeleviewComentario: '-',
        resumenPltComentario: '-',
        resumenMuestreoComentario: '-',
      };

      const defaultActivities: ActivityRow[] = selectedTurno === 'N' ? [
        { id: 'a1', actividad: 'TRASLADO DE PERSONAL', desdeFecha: selectedDate, desde: '19:00', hastaFecha: selectedDate, hasta: '19:30', horas: 0.5, idHerramienta: '-' },
        { id: 'a2', actividad: 'INSPECCION DE MAQUINA Y HERRAMIENTAS DE GESTION', desdeFecha: selectedDate, desde: '19:30', hastaFecha: selectedDate, hasta: '20:30', horas: 1.0, idHerramienta: '-' },
        { id: 'a3', actividad: 'NIVEL DE AGUA', desdeFecha: selectedDate, desde: '20:30', hastaFecha: selectedDate, hasta: '21:00', horas: 0.5, idHerramienta: '-' },
        { id: 'a4', actividad: 'ACONDICIONANDO SONDAJE', desdeFecha: selectedDate, desde: '21:00', hastaFecha: selectedDate, hasta: '21:30', horas: 0.5, idHerramienta: '-' },
        { id: 'a5', actividad: 'PERFORACION CON BROCA', desdeFecha: selectedDate, desde: '21:30', hastaFecha: getNextDay(selectedDate), hasta: '01:00', horas: 3.5, idHerramienta: '629435' },
        { id: 'a6', actividad: 'MOVIMIENTO DE TUBERIA PARA EL ENSANCHADO', desdeFecha: getNextDay(selectedDate), desde: '01:00', hastaFecha: getNextDay(selectedDate), hasta: '02:00', horas: 1.0, idHerramienta: '-' },
        { id: 'a7', actividad: 'DESCANSO DEL PERSONAL', desdeFecha: getNextDay(selectedDate), desde: '02:00', hastaFecha: getNextDay(selectedDate), hasta: '03:00', horas: 1.0, idHerramienta: '-' },
        { id: 'a8', actividad: 'MOVIMIENTO DE TUBERIA PARA EL ENSANCHADO', desdeFecha: getNextDay(selectedDate), desde: '03:00', hastaFecha: getNextDay(selectedDate), hasta: '03:30', horas: 0.5, idHerramienta: '-' },
        { id: 'a9', actividad: 'ENSANCHE CON TRICONO', desdeFecha: getNextDay(selectedDate), desde: '03:30', hastaFecha: getNextDay(selectedDate), hasta: '06:30', horas: 3.0, idHerramienta: '629436' },
        { id: 'a10', actividad: 'TRASLADO DE PERSONAL', desdeFecha: getNextDay(selectedDate), desde: '06:30', hastaFecha: getNextDay(selectedDate), hasta: '07:00', horas: 0.5, idHerramienta: '-' }
      ] : [
        { id: 'a1', actividad: 'TRASLADO DE PERSONAL', desdeFecha: selectedDate, desde: '07:00', hastaFecha: selectedDate, hasta: '07:30', horas: 0.5, idHerramienta: '-' },
        { id: 'a2', actividad: 'INSPECCION DE MAQUINA Y HERRAMIENTAS DE GESTION', desdeFecha: selectedDate, desde: '07:30', hastaFecha: selectedDate, hasta: '08:30', horas: 1.0, idHerramienta: '-' },
        { id: 'a3', actividad: 'PERFORACION CON BROCA', desdeFecha: selectedDate, desde: '08:30', hastaFecha: selectedDate, hasta: '13:00', horas: 4.5, idHerramienta: '629435' },
        { id: 'a4', actividad: 'DESCANSO DEL PERSONAL', desdeFecha: selectedDate, desde: '13:00', hastaFecha: selectedDate, hasta: '14:00', horas: 1.0, idHerramienta: '-' },
        { id: 'a5', actividad: 'PERFORACION CON BROCA', desdeFecha: selectedDate, desde: '14:00', hastaFecha: selectedDate, hasta: '18:00', horas: 4.0, idHerramienta: '629435' },
        { id: 'a6', actividad: 'TRASLADO DE PERSONAL', desdeFecha: selectedDate, desde: '18:00', hastaFecha: selectedDate, hasta: '19:00', horas: 1.0, idHerramienta: '-' }
      ];

      setDailyReportMetadata(defaultMeta);
      setDailyActivities(defaultActivities);
      localStorage.setItem(key, JSON.stringify({ metadata: defaultMeta, activities: defaultActivities }));
    }
  }, [activeTaladro?.name, selectedDate, selectedTurno]);

  const saveDailyReport = (meta: typeof dailyReportMetadata, acts: ActivityRow[]) => {
    setDailyReportMetadata(meta);
    setDailyActivities(acts);
    if (activeTaladro && selectedDate) {
      const key = `geolog_daily_${activeTaladro.name}_${selectedDate}_${selectedTurno}`;
      localStorage.setItem(key, JSON.stringify({ metadata: meta, activities: acts }));
    }
  };

  const handleMetadataChange = (meta: any) => {
    saveDailyReport(meta, dailyActivities);
  };

  const handleActivitiesChange = (acts: ActivityRow[]) => {
    saveDailyReport(dailyReportMetadata, acts);
  };

  const filteredCorridas = useMemo(() => {
    if (!activeTaladro || !activeTaladro.corridas) return [];
    const from = parseFloat(dailyReportMetadata.depthFrom);
    const to = parseFloat(dailyReportMetadata.depthTo);
    if (isNaN(from) || isNaN(to)) return activeTaladro.corridas;

    return activeTaladro.corridas.filter(c => c.de >= from && c.a <= to);
  }, [activeTaladro?.corridas, dailyReportMetadata.depthFrom, dailyReportMetadata.depthTo]);

  const runningTotals = useMemo(() => {
    let totalMeters = 0;
    let totalRec = 0;
    filteredCorridas.forEach(c => {
      totalMeters += (c.a - c.de);
      totalRec += c.rec_m;
    });

    const firstCorrida = filteredCorridas[0];
    const lastCorrida = filteredCorridas[filteredCorridas.length - 1];
    const desdeVal = firstCorrida ? firstCorrida.de.toFixed(2) : '0.00';
    const hastaVal = lastCorrida ? lastCorrida.a.toFixed(2) : '0.00';

    const avgRecPercent = totalMeters > 0 ? (totalRec / totalMeters) * 100 : 0.0;
    return {
      count: filteredCorridas.length,
      desde: desdeVal,
      hasta: hastaVal,
      meters: parseFloat(totalMeters.toFixed(2)),
      rec: parseFloat(totalRec.toFixed(2)),
      recPercent: parseFloat(avgRecPercent.toFixed(2))
    };
  }, [filteredCorridas]);

  const pltStats = useMemo(() => {
    if (!activeTaladro || !activeTaladro.ensayos_plt) {
      return { count: 0, label: '', avgUcs: 0 };
    }
    const matches = activeTaladro.ensayos_plt.filter(p => p.fecha === selectedDate);
    const count = matches.length;
    const ucsSum = matches.reduce((sum, p) => sum + (p.ucs || 0), 0);
    const avgUcs = count > 0 ? parseFloat((ucsSum / count).toFixed(1)) : 0;

    let label = '';
    if (count > 0) {
      const sorted = [...matches].sort((a, b) => a.nro_muestra.localeCompare(b.nro_muestra));
      const firstSample = sorted[0]?.nro_muestra || '';
      const lastSample = sorted[sorted.length - 1]?.nro_muestra || '';
      label = ` (M${firstSample}-M${lastSample})`;
    }
    return { count, label, avgUcs };
  }, [activeTaladro?.ensayos_plt, selectedDate]);

  const geomechMetrics = useMemo(() => {
    if (filteredCorridas.length === 0) {
      return {
        avgRqd: 0,
        avgRmr89: 0,
        dominantLito: '-',
        avgRmrClass: '-'
      };
    }

    let rqdSum = 0;
    let rmr89Sum = 0;
    const litoCount: Record<string, number> = {};

    filteredCorridas.forEach(c => {
      const length = c.a - c.de;
      const rqdPct = length > 0 ? (c.rqd_m / length) * 100 : 0;
      rqdSum += rqdPct;

      const rmrResult = calculateRowRmr(c, activeTaladro.nivel_freatico || 97.0);
      if (rmrResult && !rmrResult.error) {
        rmr89Sum += rmrResult.rmr_89 || 0;
      }

      const mainLito = c.lito3 && c.lito3 !== "-1" ? c.lito3 : c.lito1;
      if (mainLito) {
        litoCount[mainLito] = (litoCount[mainLito] || 0) + 1;
      }
    });

    let dominantLito = '-';
    let maxCount = 0;
    Object.entries(litoCount).forEach(([lito, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantLito = lito;
      }
    });

    const avgRqd = rqdSum / filteredCorridas.length;
    const avgRmr89 = rmr89Sum / filteredCorridas.length;

    let avgRmrClass = '-';
    if (avgRmr89 >= 81) avgRmrClass = "Muy Buena";
    else if (avgRmr89 >= 61) avgRmrClass = "Buena";
    else if (avgRmr89 >= 41) avgRmrClass = "Regular";
    else if (avgRmr89 >= 21) avgRmrClass = "Mala";
    else if (avgRmr89 > 0) avgRmrClass = "Muy Mala";

    return {
      avgRqd: parseFloat(avgRqd.toFixed(1)),
      avgRmr89: parseFloat(avgRmr89.toFixed(1)),
      dominantLito,
      avgRmrClass
    };
  }, [filteredCorridas, activeTaladro.nivel_freatico]);

  const structuralStats = useMemo(() => {
    if (!activeTaladro || !activeTaladro.discontinuidades) {
      return { count: 0, avgJrc: 0 };
    }
    const from = parseFloat(dailyReportMetadata.depthFrom);
    const to = parseFloat(dailyReportMetadata.depthTo);
    if (isNaN(from) || isNaN(to)) return { count: 0, avgJrc: 0 };

    const matches = activeTaladro.discontinuidades.filter(d => d.profundidad >= from && d.profundidad <= to);
    const count = matches.length;
    const jrcSum = matches.reduce((sum, d) => sum + (d.jrc10 || 0), 0);
    const avgJrc = count > 0 ? parseFloat((jrcSum / count).toFixed(1)) : 0;

    return { count, avgJrc };
  }, [activeTaladro?.discontinuidades, dailyReportMetadata.depthFrom, dailyReportMetadata.depthTo]);

  const waterReadingsForDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-');
    const formatted = `${parseInt(d)}/${parseInt(m)}/${y}`;

    const matches = waterReadings.filter(w => (w.fecha === formatted || w.fecha === selectedDate) && w.nivelAgua !== '');

    const ini = matches.find(m => m.hora <= '12:00' || m.observacion.toLowerCase().includes('inic') || m.observacion.toLowerCase().includes('comienzo')) || { hora: '21:00:00', profundidad: runningTotals.desde, nivelAgua: '12.10', observacion: '-' };
    const fin = matches.find(m => m.hora > '18:00' || m.observacion.toLowerCase().includes('fin') || m.observacion.toLowerCase().includes('termino')) || { hora: '-', profundidad: '-', nivelAgua: '-', observacion: '-' };
    const add = matches.find(m => m !== ini && m !== fin) || { hora: '-', profundidad: '-', nivelAgua: '-', observacion: '-' };

    return { ini, add, fin };
  }, [waterReadings, selectedDate, runningTotals.desde]);

  const addActivityRow = () => {
    const newAct: ActivityRow = {
      id: `a_${Date.now()}`,
      actividad: '',
      desdeFecha: selectedDate,
      desde: '07:00',
      hastaFecha: selectedDate,
      hasta: '12:00',
      horas: 5.0,
      idHerramienta: '-'
    };
    saveDailyReport(dailyReportMetadata, [...dailyActivities, newAct]);
  };

  const removeActivityRow = (id: string) => {
    saveDailyReport(dailyReportMetadata, dailyActivities.filter(a => a.id !== id));
  };

  const handleActivityChange = (id: string, field: keyof ActivityRow, val: any) => {
    const updated = dailyActivities.map(a => {
      if (a.id === id) {
        const updatedRow = { ...a, [field]: val };
        if (field === 'desde' || field === 'hasta' || field === 'desdeFecha' || field === 'hastaFecha') {
          updatedRow.horas = calculateHoursWithDates(
            updatedRow.desdeFecha,
            updatedRow.desde,
            updatedRow.hastaFecha,
            updatedRow.hasta
          );
        }
        return updatedRow;
      }
      return a;
    });
    saveDailyReport(dailyReportMetadata, updated);
  };

  const azimutDisplay = activeTaladro.surveys[0]?.azimuth !== undefined ? `${activeTaladro.surveys[0].azimuth}°` : '-';

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 space-y-4 select-text font-arial">

      {/* Global CSS style overrides strictly for print to support formal Excel tables and prevent page truncating */}
      <style dangerouslySetInnerHTML={{
        __html: `
        /* Force Arial font family for everything */
        * {
          font-family: Arial, Helvetica, sans-serif !important;
        }

        @media print {
          /* Force standard light styling for print and hide browser defaults */
          @page {
            size: portrait;
            margin: 0 !important; /* Hides default browser headers/footers completely */
          }
          
          html, body {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            position: static !important;
            padding: 0 !important;
            margin: 0 !important;
            background-color: white !important;
            color: black !important;
            width: 100% !important;
          }
          
          /* Nullify fixed viewport heights and overflow scroll blocks in parent containers */
          #root, #root > div, main, main > div, .flex-1, .overflow-y-auto, .overflow-hidden {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            position: static !important;
            display: block !important; 
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
          }
          
          /* Hide non-printable selectors/chrome */
          aside, header, nav, .no-print, button, select, input[type="date"], [role="dialog"], .fixed {
            display: none !important;
          }
          
          /* Specifically hide sidebar container transition wrapper */
          .transition-all.duration-300 {
            display: none !important;
          }

          /* Specifically hide floating validation panel */
          .fixed.bottom-6.right-6 {
            display: none !important;
          }

          .print-card {
            background: white !important;
            color: black !important;
            border: none !important;
            box-shadow: none !important;
            padding: 15mm 15mm 15mm 15mm !important; /* Simulates portrait page margins natively without triggering headers */
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            position: static !important;
            display: block !important;
          }

          /* Reset inputs to flat print markers (Force NOT bold for clean representation) */
          .print-input, input, select, textarea {
            border: none !important;
            background: transparent !important;
            color: black !important;
            font-weight: normal !important;
            font-size: 11px !important; /* Matches target document text density */
            padding: 0 !important;
            text-align: center !important;
            box-shadow: none !important;
            outline: none !important;
            width: 100% !important;
            appearance: none !important;
            resize: none !important;
          }

          .text-left-important {
            text-align: left !important;
          }
          
          textarea {
            text-align: left !important;
          }

          /* Solid thin black table grid borders */
          table, th, td {
            border: 1px solid black !important;
            border-collapse: collapse !important;
            color: black !important;
            background: transparent !important;
          }
          
          th {
            font-weight: bold !important;
            font-size: 11px !important; 
            background-color: #f4f4f5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          td {
            font-size: 11px !important; 
            padding: 3px 5px !important; 
            height: auto !important; 
          }

          .yellow-banner {
            background-color: #f4cc70 !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            border: 1px solid black !important;
            font-weight: bold !important;
            font-size: 11px !important;
            padding: 3px 0 !important;
            text-align: center !important;
          }
          
          tr, .print-avoid-break {
            page-break-inside: avoid !important;
          }
          
          .chart-container-print {
            height: 280px !important; 
            width: 100% !important;
          }

          /* 3-Page layout simulated wrapper class */
          .print-page-container {
            min-height: 290mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
          }
          .print-page-container:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            min-height: auto !important;
          }
        }
      ` }} />

      {/* Toolbar / Selectors Section (no-print) */}
      <div className="glass-panel p-4 rounded-xl border border-navy-800 bg-navy-950/20 shadow-md space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-cyan-400 rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Exportación PDF (Fidelidad de Campo)</h2>
              <p className="text-xs text-slate-400">Replicación exacta de formatos físicos A4 del proyecto de perforación</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg border border-emerald-500/20 shadow-md active:scale-95 transition-all"
            >
              <Printer size={14} />
              <span>Exportar PDF / Imprimir</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-navy-850/60">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Taladro Activo</label>
            <select
              value={activeTaladro.name}
              onChange={(e) => onSelectTaladro(e.target.value)}
              className="w-full bg-navy-900 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              {taladros.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fecha del Reporte</label>
            <div className="flex gap-1.5">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 bg-navy-900 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none font-bold"
              >
                {availableDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-navy-900 border border-navy-800 rounded-lg px-2 text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Turno del Reporte</label>
            <select
              value={selectedTurno}
              onChange={(e) => setSelectedTurno(e.target.value as 'D' | 'N')}
              className="w-full bg-navy-900 border border-navy-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none font-bold"
            >
              <option value="D">Día (D)</option>
              <option value="N">Noche (N)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Formato de Salida</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveTab('water')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${activeTab === 'water' ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300' : 'bg-navy-900 border-navy-800 text-slate-400 hover:text-slate-200'}`}
              >
                Control de Agua
              </button>
              <button
                onClick={() => setActiveTab('daily')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${activeTab === 'daily' ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300' : 'bg-navy-900 border-navy-800 text-slate-400 hover:text-slate-200'}`}
              >
                Reporte Diario
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* WYSIWYG White Paper Container */}
      <div className="print-card w-full max-w-[950px] mx-auto bg-white text-zinc-900 border border-zinc-200 shadow-2xl p-6 md:p-8 rounded-lg select-text">

        {/* Style helper for screen inputs */}
        <style dangerouslySetInnerHTML={{
          __html: `
          .screen-td-input {
            width: 100%;
            background-color: #f4f4f5 !important;
            border: 1px solid #d4d4d8 !important;
            color: #000000 !important;
            text-align: center;
            font-size: 11px !important; 
            padding: 2px 4px;
            font-weight: normal !important;
            border-radius: 3px;
          }
          .screen-td-input:focus {
            outline: none !important;
            border-color: #a1a1aa !important;
            background-color: #ffffff !important;
          }
          .text-left-important {
            text-align: left !important;
          }
          @media print {
            .screen-td-input {
              border: none !important;
              background-color: transparent !important;
              color: black !important;
              padding: 0 !important;
              font-weight: normal !important;
              font-size: 11px !important;
            }
          }
        ` }} />

        {/* Tab 1: Water Control Report */}
        {activeTab === 'water' && (
          <WaterControlReport
            activeTaladro={activeTaladro}
            waterReadings={waterReadings}
            onWaterReadingsChange={handleWaterReadingsChange}
            cliente={cliente}
            onClienteChange={handleClienteChange}
          />
        )}

        {/* Tab 2: Daily Operation Report */}
        {activeTab === 'daily' && (
          <DailyOperationReport
            activeTaladro={activeTaladro}
            selectedDate={selectedDate}
            selectedTurno={selectedTurno}
            dailyReportMetadata={dailyReportMetadata}
            onMetadataChange={handleMetadataChange}
            dailyActivities={dailyActivities}
            onActivitiesChange={handleActivitiesChange}
            filteredCorridas={filteredCorridas}
            runningTotals={runningTotals}
            pltStats={pltStats}
            geomechMetrics={geomechMetrics}
            structuralStats={structuralStats}
            waterReadingsForDate={waterReadingsForDate}
            addActivityRow={addActivityRow}
            removeActivityRow={removeActivityRow}
            handleActivityChange={handleActivityChange}
            azimutDisplay={azimutDisplay}
          />
        )}

      </div>
    </div>
  );
}