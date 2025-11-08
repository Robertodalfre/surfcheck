import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';

type TideEvent = { time: string; type: 'high' | 'low'; height: number | null };

export interface TideChartProps {
  hours: Array<{ time: string; tide_height?: number | null }>;
  events?: TideEvent[];
  selectedTime?: string | null; // ISO string
  unit?: string; // 'm'
}

function fmtHourLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit' });
}

function fmtTooltipLabel(value: any) {
  return `${Number(value).toFixed(2)} m`;
}

export default function TideChart({ hours, events = [], selectedTime, unit = 'm' }: TideChartProps) {
  const data = useMemo(() => {
    return (hours || [])
      .filter(h => h.time && h.tide_height != null)
      .map(h => ({ time: h.time, hour: fmtHourLabel(h.time), tide: Number(h.tide_height) }));
  }, [hours]);

  const selectedX = selectedTime || null;

  if (!data.length) {
    return (
      <div className="w-full">
        <div className="text-sm text-white/80 mb-2 px-4">Tábua de maré ({unit})</div>
        <div className="h-40 w-full grid place-items-center border border-dashed border-zinc-700 rounded-md">
          <div className="text-xs text-zinc-400">Sem dados de maré para este dia</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-sm text-white/80 mb-2 px-4">Tábua de maré ({unit})</div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
            <defs>
              <linearGradient id="tideGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00AEEF" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#00AEEF" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="hour" stroke="#888" interval={2} />
            <YAxis stroke="#888" width={32} tickFormatter={(v) => `${v.toFixed(1)}`} />
            <Tooltip
              formatter={(v) => [fmtTooltipLabel(v), 'Maré']}
              labelFormatter={(label, payload: any) => {
                const t = payload?.[0]?.payload?.time;
                const d = t ? new Date(t) : null;
                return d ? d.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : String(label);
              }}
              contentStyle={{ background: '#0a0a0a', border: '1px solid #333', borderRadius: 8 }}
            />
            <Area type="monotone" dataKey="tide" stroke="#00AEEF" fill="url(#tideGradient)" strokeWidth={2} />
            {/* Eventos de preamar/baixamar */}
            {(events || []).map((ev, i) => {
              const x = (hours || []).find(h => h.time === ev.time)?.time || ev.time;
              const y = Number(ev.height);
              if (!Number.isFinite(y)) return null;
              const payload = data.find(d => d.time === x);
              if (!payload) return null;
              const color = ev.type === 'high' ? '#6ee7b7' : '#fca5a5';
              return <ReferenceDot key={`${ev.time}-${i}`} x={payload.hour} y={payload.tide} r={4} fill={color} stroke="#111" />;
            })}
            {/* Marcador da hora selecionada */}
            {selectedX && (() => {
              const payload = data.find(d => d.time === selectedX);
              if (!payload) return null;
              return <ReferenceDot x={payload.hour} y={payload.tide} r={5} fill="#fff" stroke="#00AEEF" />;
            })()}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
