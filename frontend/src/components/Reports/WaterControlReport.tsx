import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Label,
  Legend,
  Tooltip as ChartTooltip
} from 'recharts';

interface WaterReading {
  id: string;
  fecha: string;
  hora: string;
  turno: string;
  nivelAgua: number | '';
  profundidad: number | '';
  observacion: string;
}

interface WaterControlReportProps {
  activeTaladro: {
    name: string;
    proyecto: string;
    fecha_registro: string;
    collar_este: number;
    collar_norte: number;
    collar_cota: number;
    inclinacion: number;
  };
  waterReadings: WaterReading[];
  onWaterReadingsChange: (readings: WaterReading[]) => void;
  cliente: string;
  onClienteChange: (val: string) => void;
}

export default function WaterControlReport({
  activeTaladro,
  waterReadings,
  onWaterReadingsChange,
  cliente,
  onClienteChange
}: WaterControlReportProps) {

  // Process data points for Recharts Water Level graph (Only rows with numeric inputs)
  const chartData = useMemo(() => {
    return waterReadings
      .map(w => {
        const lvl = parseFloat(w.nivelAgua as any);
        const prof = parseFloat(w.profundidad as any);
        return {
          fechaLabel: w.fecha && w.hora ? `${w.fecha} ${w.hora}` : '',
          rawFecha: w.fecha,
          nivelAgua: isNaN(lvl) ? null : lvl,
          profundidad: isNaN(prof) ? null : prof
        };
      })
      .filter(d => d.nivelAgua !== null || d.profundidad !== null);
  }, [waterReadings]);

  const handleInputChange = (id: string, field: keyof WaterReading, value: string) => {
    const updated = waterReadings.map(r => {
      if (r.id === id) {
        if (field === 'nivelAgua' || field === 'profundidad') {
          return {
            ...r,
            [field]: value === '' ? '' : parseFloat(value) || ''
          };
        }
        return { ...r, [field]: value };
      }
      return r;
    });
    onWaterReadingsChange(updated);
  };

  // Helper format decimal commas for Spanish coordinate formats E:nnnnn,nn
  const formatCoordinate = (val?: number) => {
    if (val === undefined || isNaN(val)) return '0,00';
    return val.toFixed(2).replace('.', ',');
  };

  return (
    <div className="space-y-4">
      {/* Header Title */}
      <div className="border border-black p-2.5 text-center uppercase bg-zinc-50 font-bold">
        <h1 className="text-sm font-bold tracking-wider text-zinc-955">CONTROL DE NIVEL DE AGUA</h1>
        <h2 className="text-xs font-bold text-zinc-800 mt-0.5">SONDEO {activeTaladro.name}</h2>
      </div>

      {/* Metadata Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-black">
          <tbody>
            <tr className="text-xs">
              <td className="font-bold bg-zinc-100 border border-black w-[15%] p-1.5">PROYECTO:</td>
              <td colSpan={5} className="font-normal p-1.5 border border-black text-zinc-900 text-left">
                {activeTaladro.proyecto}
              </td>
            </tr>
            <tr className="text-xs">
              <td className="font-bold bg-zinc-100 border border-black w-[15%] p-1.5">CLIENTE:</td>
              <td colSpan={5} className="p-1.5 border border-black text-left">
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => onClienteChange(e.target.value)}
                  placeholder="Ingrese el nombre del cliente..."
                  className="screen-td-input text-left-important font-normal"
                />
              </td>
            </tr>
            <tr className="text-xs text-center">
              <td className="font-bold bg-zinc-100 border border-black p-1.5 text-left w-[15%]">FECHA INICIO:</td>
              <td className="p-1.5 border border-black w-[20%] font-normal text-zinc-900 text-center">
                {activeTaladro.fecha_registro || '-'}
              </td>
              <td className="font-bold bg-zinc-100 border border-black w-[15%] p-1.5 text-center">FECHA FIN:</td>
              <td className="p-1.5 border border-black w-[20%] font-normal text-zinc-900 text-center">-</td>
              <td className="font-bold bg-zinc-100 border border-black w-[15%] p-1.5 text-center">HOJA:</td>
              <td className="p-1.5 border border-black w-[15%] font-normal text-zinc-900 text-center">1 de 1</td>
            </tr>
            <tr className="text-xs text-center">
              <td className="font-bold bg-zinc-100 border border-black p-1.5 text-left w-[15%]">UBICACIÓN:</td>
              <td className="p-1.5 border border-black w-[20%] font-normal text-zinc-900 text-center">
                E: {formatCoordinate(activeTaladro.collar_este)}
              </td>
              <td className="p-1.5 border border-black w-[15%] font-normal text-zinc-900 text-center">
                N: {formatCoordinate(activeTaladro.collar_norte)}
              </td>
              <td className="p-1.5 border border-black w-[20%] font-normal text-zinc-900 text-center">
                Z: {formatCoordinate(activeTaladro.collar_cota)}
              </td>
              <td className="font-bold bg-zinc-100 border border-black w-[15%] p-1.5 text-center">INCLINACION:</td>
              <td className="p-1.5 border border-black w-[15%] font-normal text-zinc-900 text-center">
                {activeTaladro.inclinacion !== undefined ? `${activeTaladro.inclinacion}°` : '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Readings Grid - EXACTLY 36 ROWS */}
      <div className="space-y-1">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-black text-center text-xs">
            <thead>
              <tr className="bg-zinc-100 text-zinc-800 font-bold border border-black">
                <th className="py-1 border border-black w-12 text-center">N°</th>
                <th className="py-1 border border-black w-28 text-center">FECHA</th>
                <th className="py-1 border border-black w-20 text-center">HORA</th>
                <th className="py-1 border border-black w-16 text-center">TURNO</th>
                <th className="py-1 border border-black w-32 text-center">NIVEL DE AGUA (m)</th>
                <th className="py-1 border border-black w-32 text-center">PROFUNDIDAD (m)</th>
                <th className="py-1 border border-black text-left px-2">OBSERVACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {waterReadings.map((reading, index) => (
                <tr key={reading.id} className="h-6 border-b border-zinc-300">
                  <td className="font-normal text-zinc-500 border border-black text-[10px] bg-zinc-50/50">{index + 1}</td>
                  <td className="border border-black">
                    <input
                      type="text"
                      value={reading.fecha}
                      onChange={(e) => handleInputChange(reading.id, 'fecha', e.target.value)}
                      placeholder="-"
                      className="screen-td-input font-normal"
                    />
                  </td>
                  <td className="border border-black">
                    <input
                      type="text"
                      value={reading.hora}
                      onChange={(e) => handleInputChange(reading.id, 'hora', e.target.value)}
                      placeholder="-"
                      className="screen-td-input font-normal"
                    />
                  </td>
                  <td className="border border-black">
                    <input
                      type="text"
                      value={reading.turno}
                      onChange={(e) => handleInputChange(reading.id, 'turno', e.target.value.toUpperCase())}
                      placeholder="-"
                      className="screen-td-input font-normal"
                    />
                  </td>
                  <td className="border border-black">
                    <input
                      type="text"
                      value={reading.nivelAgua}
                      onChange={(e) => handleInputChange(reading.id, 'nivelAgua', e.target.value)}
                      placeholder="-"
                      className="screen-td-input font-normal text-center"
                    />
                  </td>
                  <td className="border border-black">
                    <input
                      type="text"
                      value={reading.profundidad}
                      onChange={(e) => handleInputChange(reading.id, 'profundidad', e.target.value)}
                      placeholder="-"
                      className="screen-td-input font-normal text-center"
                    />
                  </td>
                  <td className="border border-black">
                    <input
                      type="text"
                      value={reading.observacion}
                      onChange={(e) => handleInputChange(reading.id, 'observacion', e.target.value)}
                      placeholder="-"
                      className="screen-td-input text-left-important font-normal"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recharts Inverted Chart (0 top, 300 bottom) */}
      <div className="print-avoid-break space-y-1.5 pt-4 border-t border-zinc-200">
        <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider text-center">CONTROL DE NIVEL DE AGUA</h3>
        <div className="chart-container-print h-64 w-full bg-zinc-50 rounded-xl p-2 border border-zinc-200">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 15, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis
                dataKey="fechaLabel"
                tick={{ fontSize: 9, fill: '#000000', fontWeight: 'normal' }}
                angle={-90}
                textAnchor="end"
                height={60}
              />
              <YAxis
                domain={[0, 300]}
                reversed={true}
                ticks={[0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300]}
                tickFormatter={(val) => val.toFixed(2)}
                tick={{ fontSize: 9, fill: '#000000', fontWeight: 'normal' }}
              >
                <Label
                  value="PROFUNDIDAD (m)"
                  angle={-90}
                  position="insideLeft"
                  offset={-5}
                  style={{ textAnchor: 'middle', fill: '#000000', fontSize: 10, fontWeight: 'normal' }}
                />
              </YAxis>
              <ChartTooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#000000', color: '#000000', fontSize: '10px' }}
              />
              <Legend
                verticalAlign="bottom"
                align="left"
                height={36}
                wrapperStyle={{ fontSize: '10px', fontWeight: 'normal', color: '#000000', paddingLeft: '50px' }}
                iconType="rect"
              />
              <Line
                name="NIVEL DE AGUA (m)"
                type="monotone"
                dataKey="nivelAgua"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4, fill: '#2563eb', strokeWidth: 1 }}
              />
              <Line
                name="PROFUNDIDAD (m)"
                type="monotone"
                dataKey="profundidad"
                stroke="#ea580c"
                strokeWidth={2}
                dot={{ r: 4, fill: '#ea580c', strokeWidth: 1 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] font-normal text-center text-zinc-900 mt-1 uppercase">FECHA (días)</p>
      </div>
    </div>
  );
}