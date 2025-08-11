
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getForecastFull, type ForecastFull } from '@/lib/api';

interface SurfSpot {
  id: string;
  name: string;
  status: 'good' | 'ok' | 'bad';
  height: string;
}

interface SurfSpotsListProps {
  spots: SurfSpot[];
  initialSpotId?: string;
  onSpotSelect?: (spot: SurfSpot) => void;
  onSpotChange?: (spotId: string) => void;
}

const SurfSpotsList = ({ spots, initialSpotId = 'sape', onSpotSelect, onSpotChange }: SurfSpotsListProps) => {
  const [spotId, setSpotId] = useState<string>(initialSpotId);
  const [full, setFull] = useState<ForecastFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [selDate, setSelDate] = useState<string | null>(null); // YYYY-MM-DD
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getForecastFull(spotId, 5);
        if (!mounted) return;
        setFull(data);
        // pick tomorrow if exists else first day
        const uniqueDays = Array.from(new Set((data.hours || []).map(h => h.time.slice(0,10))));
        const today = new Date().toISOString().slice(0,10);
        const tomorrow = uniqueDays.find(d => d > today) || uniqueDays[0] || null;
        setSelDate(tomorrow);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [spotId]);

  const saoPauloDate = (iso: string) => {
    // Assume API times already in America/Sao_Paulo ISO local (no Z). Use as-is.
    return new Date(iso);
  };

  const cardinal = (deg?: number | null) => {
    if (deg == null || !Number.isFinite(deg)) return '-';
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const ix = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
    return dirs[ix];
  };

  const fmt = (v?: number | null, digits = 1) => {
    if (v == null || !Number.isFinite(v)) return '-';
    return v.toFixed(digits);
  };

  // Wave power (kW/m) helpers
  const wavePower = (H?: number | null, T?: number | null) => {
    if (!Number.isFinite(H as number) || !Number.isFinite(T as number)) return null;
    const h = Number(H); const t = Number(T);
    if (h <= 0 || t <= 0) return null;
    return 0.49 * h * h * t;
  };
  const powerLabel = (P?: number | null) => {
    if (!Number.isFinite(P as number)) return '';
    const p = Number(P);
    if (p < 3) return 'energia fraca';
    if (p < 7) return 'energia média';
    if (p < 12) return 'energia forte';
    return 'energia pesada';
  };

  const fmtTime = (iso?: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Build day cards from forecast
  const days = useMemo(() => {
    if (!full?.hours) return [] as { key: string; dow: string; day: string }[];
    const seen = new Set<string>();
    const result: { key: string; dow: string; day: string }[] = [];
    for (const h of full.hours) {
      const dkey = h.time.slice(0,10);
      if (seen.has(dkey)) continue;
      seen.add(dkey);
      const d = saoPauloDate(h.time);
      const dow = d.toLocaleDateString('pt-BR', { weekday: 'short' }).split('-')[0].slice(0,3).toLowerCase();
      const day = String(d.getDate());
      result.push({ key: dkey, dow, day });
    }
    return result.slice(0,5);
  }, [full]);

  // For selected day, pick preferred hour: 09:00, else 12, 15, 06, else first
  const selectedHour = useMemo(() => {
    if (!full?.hours || !selDate) return null;
    const targetHours = ['09:00','12:00','15:00','06:00'];
    const dayHours = full.hours.filter(h => h.time.startsWith(selDate));
    const byPref = targetHours
      .map(hh => dayHours.find(h => h.time.includes(`T${hh}`)))
      .find(Boolean);
    return byPref || dayHours[0] || null;
  }, [full, selDate]);

  const dayHours = useMemo(() => {
    if (!full?.hours || !selDate) return [] as ForecastFull['hours'];
    return full.hours.filter(h => h.time.startsWith(selDate));
  }, [full, selDate]);

  const modalTimes = ['06:00','07:00','08:00','09:00','10:00','12:00','14:00','15:00','16:00','17:00'];
  const detailHours = useMemo(() => {
    if (!dayHours.length) return [] as ForecastFull['hours'];
    const base = modalTimes
      .map(t => dayHours.find(h => h.time.includes(`T${t}`)))
      .filter(Boolean) as ForecastFull['hours'];
    // Hide past slots only if selected day is today
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayKey = `${yyyy}-${mm}-${dd}`;
    if (selDate === todayKey) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      return base.filter(h => {
        const d = new Date(h.time);
        const mins = d.getHours() * 60 + d.getMinutes();
        return mins >= nowMin;
      });
    }
    return base;
  }, [dayHours]);

  const topHours = useMemo(() => {
    if (!detailHours.length) return [] as ForecastFull['hours'];
    const sorted = [...detailHours].sort((a,b) => ((b.score ?? -1) - (a.score ?? -1)));
    return sorted.slice(0, 3);
  }, [detailHours]);
  const getRank = (h: ForecastFull['hours'][number]) => {
    const idx = topHours.findIndex(x => x.time === h.time);
    return idx === -1 ? 0 : (idx + 1); // 1,2,3
  };

  const summarizeDay = () => {
    const hs = dayHours;
    if (!hs.length) return null;
    const nums = (arr: (number|null)[]) => arr.filter(v => v != null && Number.isFinite(v)) as number[];
    const wv = nums(hs.map(h => h.wave_height));
    const sh = nums(hs.map(h => h.swell_height));
    const sp = nums(hs.map(h => h.swell_period));
    const ws = nums(hs.map(h => h.wind_speed));
    const sd = nums(hs.map(h => h.swell_direction));
    const wd = nums(hs.map(h => h.wind_direction));
    const avg = (a: number[]) => a.length ? (a.reduce((p,c)=>p+c,0)/a.length) : undefined;
    const min = (a: number[]) => a.length ? Math.min(...a) : undefined;
    const max = (a: number[]) => a.length ? Math.max(...a) : undefined;
    return {
      waveMin: min(wv), waveMax: max(wv),
      swellMin: min(sh), swellMax: max(sh),
      periodMin: min(sp), periodMax: max(sp),
      windMin: min(ws), windMax: max(ws),
      swellDirAvg: avg(sd), windDirAvg: avg(wd),
    };
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <TrendingUp className="w-4 h-4 text-surf-good" strokeWidth={1.5} />;
      case 'ok':
        return <Minus className="w-4 h-4 text-surf-ok" strokeWidth={1.5} />;
      case 'bad':
        return <TrendingDown className="w-4 h-4 text-surf-bad" strokeWidth={1.5} />;
      default:
        return <Minus className="w-4 h-4 text-muted" strokeWidth={1.5} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'border-surf-good/30 hover:border-surf-good/50';
      case 'ok':
        return 'border-surf-ok/30 hover:border-surf-ok/50';
      case 'bad':
        return 'border-surf-bad/30 hover:border-surf-bad/50';
      default:
        return 'border-border/30 hover:border-border/50';
    }
  };

  return (
    <>
    <div className="px-4 pb-8">
      {/* Tabs */}
      <div className="px-1 mb-3">
        <div className="flex w-full items-center rounded-2xl border border-zinc-700 overflow-hidden">
          <button className="w-full text-center py-2 text-white text-xs bg-zinc-900 border-b-2 border-[#00AEEF]">
            Próximos dias
          </button>
        </div>
      </div>

      {/* Bloco principal de previsão */}
      <div className="border-4 border-[#00AEEF] rounded-md p-3">
        <div className="flex gap-3 items-start">
          {/* Barra lateral de dias */}
          <div className="w-20 flex flex-col gap-3 shrink-0">
            {days.slice(0,2).map((it) => (
              <button
                key={it.key}
                onClick={() => setSelDate(it.key)}
                className={`px-2 py-3 text-center border-4 rounded-sm ${selDate===it.key ? 'border-[#00AEEF]' : 'border-[#00AEEF]/60 opacity-80'}`}
              >
                <div className="text-[#00AEEF] text-sm font-semibold lowercase">{it.dow}</div>
                <div className="text-white text-xl font-bold leading-none">{it.day}</div>
              </button>
            ))}
          </div>

          {/* Conteúdo principal */}
          <div className="flex-1">
            {/* Top: altura da onda à esquerda; clima + botão à direita (responsivo) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
              {/* Esquerda: onda */}
              <div className="relative flex items-center justify-center w-28 h-28 rounded-full border-4 border-[#00AEEF] mx-auto sm:mx-0">
                <div className="text-center">
                  <div className="text-white text-3xl font-bold leading-tight">{loading ? '...' : `${fmt(selectedHour?.wave_height)} m`}</div>
                  <div className="text-[#00AEEF] text-sm font-semibold">{loading ? '' : fmt(selectedHour?.swell_height)}</div>
                </div>
              </div>
              {/* Direita: clima e botão empilhados */}
              <div className="flex flex-col gap-2 sm:items-end w-full">
                <div className="flex items-center gap-2 text-white self-center sm:self-end">
                  <svg viewBox="0 0 24 24" className="w-9 h-9 stroke-white" fill="none" strokeWidth="1.5">
                    <path d="M3 15a4 4 0 0 0 4 4h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5-2"/>
                  </svg>
                  <span className="text-white text-lg font-bold">29°</span>
                </div>
                <div className="w-full flex justify-center sm:justify-end">
                  <button
                    disabled={!dayHours.length}
                    onClick={() => setShowDetails(true)}
                    className={`px-3 py-1.5 text-xs rounded-full border ${dayHours.length ? 'border-[#00AEEF] text-[#00AEEF] hover:bg-zinc-900/50' : 'border-zinc-700 text-zinc-500 cursor-not-allowed'}`}
                  >
                    Detalhes do dia
                  </button>
                </div>
                {/* <div className="text-xs text-zinc-400 leading-tight text-right mt-1 w-full">{loading ? '' : `Horário: ${fmtTime(selectedHour?.time)}`}</div> */}
              </div>
            </div>

            {/* Bottom: swell dir + período, vento + velocidade */}
            <div className="flex items-end gap-8">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-[#00AEEF] text-white text-xl font-bold">{loading ? '·' : cardinal(selectedHour?.swell_direction)}</div>
                <div className="text-[#00AEEF] text-base font-semibold mt-2 leading-none">{loading ? '·' : `${fmt(selectedHour?.swell_period, 0)} s`}</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-[#00AEEF] text-white text-xl font-bold">{loading ? '·' : cardinal(selectedHour?.wind_direction)}</div>
                <div className="text-white text-base font-medium mt-2 leading-none">{loading ? '·' : `${fmt(selectedHour?.wind_speed, 0)} km/h`}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contexto e dica do slot selecionado (abaixo do card) */}
      <div className="mt-2 px-1">
        {selectedHour?.meta?.context && (
          <div className="text-xs text-zinc-300 leading-snug text-center">
            {selectedHour.meta.context}
          </div>
        )}
        {selectedHour?.meta?.advice && (
          <div className="mt-1 text-[11px] text-white/80 flex items-center justify-center">
            <span className="px-2 py-0.5 rounded-full border border-[#00AEEF] text-[#00AEEF] bg-zinc-900/40">{selectedHour.meta.advice}</span>
          </div>
        )}
        {/* Energia/Power badge */}
        {(() => {
          const P = (selectedHour as any)?.power_kwm
            ?? wavePower(selectedHour?.swell_height, selectedHour?.swell_period);
          if (!Number.isFinite(P)) return null;
          const label = powerLabel(P as number);
          return (
            <div className="mt-2 text-[11px] text-white/80 flex items-center justify-center">
              <span className="px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-200 bg-zinc-900/40">
                {label}: {fmt(P as number, 1)} kW/m
              </span>
            </div>
          );
        })()}
      </div>


      {/* Seleção de dias (rolável) */}
      <div className="mt-5 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {days.map((it) => (
          <button
            key={it.key}
            onClick={() => setSelDate(it.key)}
            className={`min-w-[70px] text-center border-4 rounded-sm px-3 py-3 ${selDate===it.key ? 'border-[#00AEEF]' : 'border-[#00AEEF]/60'}`}
          >
            <div className="text-[#00AEEF] text-sm font-semibold lowercase">{it.dow}</div>
            <div className="text-white text-xl font-bold leading-none">{it.day}</div>
          </button>
        ))}
      </div>
      {/* Outros Picos */}
      <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">
        Outros picos
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {spots.map((spot) => (
          <button
            key={spot.id}
            onClick={() => {
              setSpotId(spot.id);
              setSelDate(null);
              onSpotSelect?.(spot);
              onSpotChange?.(spot.id);
            }}
            className={`px-3 py-1.5 rounded-full border text-xs transition-all hover:scale-105 active:scale-95 ${
              spotId === spot.id ? 'border-[#00AEEF] text-white bg-zinc-900' : `text-white/80 ${getStatusColor(spot.status)}`
            }`}
            title={spot.name}
          >
            <span className="inline-flex items-center gap-2">
              {getStatusIcon(spot.status)}
              <span>{spot.name}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
    {showDetails && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/70" onClick={() => setShowDetails(false)} />
        <div className="relative bg-[#0a0a0a] border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white font-semibold">Detalhes do dia {selDate}</div>
            <button className="text-zinc-400 hover:text-white" onClick={() => setShowDetails(false)}>✕</button>
          </div>

          {/* Resumo do dia */}
          {(() => { const s = summarizeDay(); if (!s) return null; return (
            <div className="mb-3 text-sm text-zinc-300">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-zinc-400 text-xs">Altura (m)</div>
                  <div>{fmt(s.waveMin)} – {fmt(s.waveMax)}</div>
                </div>
                <div>
                  <div className="text-zinc-400 text-xs">Swell (m)</div>
                  <div>{fmt(s.swellMin)} – {fmt(s.swellMax)}</div>
                </div>
                <div>
                  <div className="text-zinc-400 text-xs">Período (s)</div>
                  <div>{fmt(s.periodMin,0)} – {fmt(s.periodMax,0)}</div>
                </div>
                <div>
                  <div className="text-zinc-400 text-xs">Vento (km/h)</div>
                  <div>{fmt(s.windMin,0)} – {fmt(s.windMax,0)}</div>
                </div>
                {(() => {
                  // Power stats (kW/m)
                  const hs = dayHours;
                  const arr = hs.map(h => (h as any).power_kwm
                    ?? wavePower(h.swell_height, h.swell_period)
                  ).filter(v => Number.isFinite(v)) as number[];
                  if (!arr.length) return null;
                  const pmin = Math.min(...arr), pmax = Math.max(...arr);
                  return (
                    <div className="col-span-2">
                      <div className="text-zinc-400 text-xs">Potência (kW/m)</div>
                      <div>{fmt(pmin,1)} – {fmt(pmax,1)}</div>
                    </div>
                  );
                })()}
                <div>
                  <div className="text-zinc-400 text-xs">Dir. Swell</div>
                  <div>{cardinal(s.swellDirAvg)}</div>
                </div>
                <div>
                  <div className="text-zinc-400 text-xs">Dir. Vento</div>
                  <div>{cardinal(s.windDirAvg)}</div>
                </div>
              </div>
            </div>
          ); })()}

          {/* Horas do dia */}
          <div>
            <div className="text-white font-medium mb-2">Horas</div>
            <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-full border border-yellow-400 text-yellow-400">1º melhor</span>
              <span className="px-2 py-0.5 rounded-full border border-[#00AEEF] text-[#00AEEF]">2º melhor</span>
              <span className="px-2 py-0.5 rounded-full border border-emerald-400 text-emerald-400">3º melhor</span>
            </div>
            <div className="space-y-2">
              {detailHours.map(h => {
                const rank = getRank(h);
                const cls = rank === 1
                  ? 'border-yellow-400 ring-1 ring-yellow-400/40'
                  : rank === 2
                    ? 'border-[#00AEEF] ring-1 ring-[#00AEEF]/40'
                    : rank === 3
                      ? 'border-emerald-400 ring-1 ring-emerald-400/40'
                      : 'border-zinc-700';
                const badge = rank === 1 ? {label: '1º melhor', cls: 'border-yellow-400 text-yellow-400'}
                  : rank === 2 ? {label: '2º melhor', cls: 'border-[#00AEEF] text-[#00AEEF]'}
                  : rank === 3 ? {label: '3º melhor', cls: 'border-emerald-400 text-emerald-400'}
                  : null;
                const P = (h as any).power_kwm
                  ?? wavePower(h.swell_height, h.swell_period);
                return (
                  <div key={h.time} className={`relative rounded-md p-2 border ${cls}`}>
                    {badge && (
                      <span className={`absolute -top-2 -right-2 text-[10px] px-2 py-0.5 rounded-full border bg-zinc-900 ${badge.cls}`}>{badge.label}</span>
                    )}
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-white font-semibold">{fmtTime(h.time)}</div>
                    <div className="text-zinc-300">
                      {fmt(h.wave_height)} m · {cardinal(h.swell_direction)} · {fmt(h.swell_period,0)}s · {cardinal(h.wind_direction)} {fmt(h.wind_speed,0)}km/h
                      {Number.isFinite(P as number) ? ` · ${fmt(P as number,1)} kW/m` : ''}
                    </div>
                  </div>
                  {h.meta?.context && (
                    <div className="mt-1 text-xs text-zinc-400">{h.meta.context}</div>
                  )}
                  {h.meta?.advice && (
                    <div className="mt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#00AEEF] text-[#00AEEF] bg-zinc-900/40">{h.meta.advice}</span>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sobre o pico (metadados) */}
          {full?.spot && (
            <div className="mt-4">
              <div className="text-white font-medium mb-2">Sobre o pico</div>
              <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300">
                <div><span className="text-zinc-400 text-xs">Nome</span><div>{full.spot.name}</div></div>
                <div><span className="text-zinc-400 text-xs">Azimute praia</span><div>{fmt(full.spot.beachAzimuth,0)}°</div></div>
                {full.spot.swellWindow && (
                  <div className="col-span-2"><span className="text-zinc-400 text-xs">Janela de swell</span><div>{full.spot.swellWindow[0]}°–{full.spot.swellWindow[1]}°</div></div>
                )}
                {full.spot.idealPeriodRange && (
                  <div><span className="text-zinc-400 text-xs">Período ideal</span><div>{full.spot.idealPeriodRange[0]}–{full.spot.idealPeriodRange[1]} s</div></div>
                )}
                {Number.isFinite(full.spot.minSwellHeight as any) && (
                  <div><span className="text-zinc-400 text-xs">Altura mínima</span><div>{fmt(full.spot.minSwellHeight as number)} m</div></div>
                )}
                {full.spot.windShelter?.offshore && (
                  <div><span className="text-zinc-400 text-xs">Offshore</span><div>{full.spot.windShelter.offshore[0]}°–{full.spot.windShelter.offshore[1]}°</div></div>
                )}
                {full.spot.windShelter?.badOnshore && (
                  <div><span className="text-zinc-400 text-xs">Onshore ruim</span><div>{full.spot.windShelter.badOnshore[0]}°–{full.spot.windShelter.badOnshore[1]}°</div></div>
                )}
                {full.spot.bestSwellDirections && full.spot.bestSwellDirections.length > 0 && (
                  <div className="col-span-2"><span className="text-zinc-400 text-xs">Melhores direções</span><div>{full.spot.bestSwellDirections.join(', ')}</div></div>
                )}
                {full.spot.localNotes && (
                  <div className="col-span-2"><span className="text-zinc-400 text-xs">Notas locais</span><div className="text-zinc-300">{full.spot.localNotes}</div></div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
};

export default SurfSpotsList;
