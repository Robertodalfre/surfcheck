
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SurfHeader from '../components/SurfHeader';
import SurfStatus from '../components/SurfStatus';
import SurfConditions from '../components/SurfConditions';
import SurfSpotsList from '../components/SurfSpotsList';
import { getForecastCompact, type ForecastCompact, getForecastFull, type ForecastFull, getSpots, type SpotMeta } from '@/lib/api';

type Status = 'epic' | 'good' | 'ok' | 'bad';

const Index = () => {
  const [spotId, setSpotId] = useState<string>('sape');
  const [data, setData] = useState<ForecastCompact | null>(null);
  const [full, setFull] = useState<ForecastFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null); // '06:00' | '09:00' | '12:00' | '15:00'
  const [otherSpots, setOtherSpots] = useState<{ id: string; name: string; status: 'good'|'ok'|'bad'; height: string; }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSpots, setSearchSpots] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [res, resFull] = await Promise.all([
          getForecastCompact(spotId, 3, 72),
          getForecastFull(spotId, 3),
        ]);
        if (mounted) {
          setData(res);
          setFull(resFull);
        }
      } catch (e: any) {
        if (mounted) setError(String(e?.message || e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [spotId]);

  // Carregar lista de spots do backend para preencher "Outros picos" e a busca (lupa)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getSpots();
        if (!mounted) return;
        const spots = (res.spots || []) as SpotMeta[];
        // Opções desejadas
        const desired = ['sape', 'lagoinha', 'itamambuca'];
        // Lista para a lupa (os 3 fixos, se existirem)
        const sopts = spots.filter(s => desired.includes(s.id)).map(s => ({ id: s.id, name: s.name }));
        setSearchSpots(sopts);
        // Lista "Outros picos" (não inclui o atual)
        const mapped = spots
          .filter(s => desired.includes(s.id) && s.id !== spotId)
          .filter(s => s.id !== spotId)
          .map(s => ({ id: s.id, name: s.name, status: 'ok' as const, height: '—' }));
        setOtherSpots(mapped);
      } catch (e) {
        // Silenciar erro na lista de spots
      }
    })();
    return () => { mounted = false; };
  }, [spotId]);

  // After 17:00, show tomorrow's forecast
  const after1700 = new Date().getHours() >= 17;
  const effectiveDateKey = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (after1700 ? 1 : 0));
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [after1700]);

  const dayHours = useMemo(() => {
    if (!full?.hours) return [] as ForecastFull['hours'];
    return full.hours.filter(h => h.time.startsWith(effectiveDateKey));
  }, [full, effectiveDateKey]);

  // default selection once we have day hours (pick nearest to current time for today)
  useEffect(() => {
    if (!dayHours.length || selectedSlot) return;
    const order = ['06:00','09:00','12:00','15:00'];
    const avail = order.filter(hh => dayHours.some(h => h.time.includes(`T${hh}`)));
    if (!avail.length) return;
    if (after1700) {
      // showing tomorrow: default to first available (usually 06:00)
      setSelectedSlot(avail[0]);
      return;
    }
    const nowH = new Date().getHours();
    const toHour = (hh: string) => parseInt(hh.split(':')[0], 10);
    let best = avail[0];
    let bestDiff = Math.abs(toHour(best) - nowH);
    for (const hh of avail) {
      const diff = Math.abs(toHour(hh) - nowH);
      if (diff < bestDiff) { best = hh; bestDiff = diff; }
    }
    setSelectedSlot(best);
  }, [dayHours, selectedSlot, after1700]);

  const selectedHourObj = useMemo(() => {
    if (!dayHours.length) return null;
    if (selectedSlot) {
      const hit = dayHours.find(h => h.time.includes(`T${selectedSlot}`));
      if (hit) return hit;
    }
    // fallback: prefer 06,09,12,15
    const order = ['06:00','09:00','12:00','15:00'];
    return order.map(hh => dayHours.find(h => h.time.includes(`T${hh}`))).find(Boolean) || dayHours[0] || null;
  }, [dayHours, selectedSlot]);

  const availableSlots = useMemo(() => {
    const order = ['06:00','09:00','12:00','15:00'];
    return order.filter(hh => dayHours.some(h => h.time.includes(`T${hh}`)));
  }, [dayHours]);

  const goPrev = () => {
    if (!availableSlots.length) return;
    const cur = selectedSlot ?? availableSlots[0];
    const idx = availableSlots.indexOf(cur);
    const nextIdx = (idx - 1 + availableSlots.length) % availableSlots.length;
    setSelectedSlot(availableSlots[nextIdx]);
  };

  const goNext = () => {
    if (!availableSlots.length) return;
    const cur = selectedSlot ?? availableSlots[0];
    const idx = availableSlots.indexOf(cur);
    const nextIdx = (idx + 1) % availableSlots.length;
    setSelectedSlot(availableSlots[nextIdx]);
  };

  const currentSpot = useMemo(() => {
    if (!data?.current || !data?.spot) {
      return {
        location: 'Carregando…',
        status: 'ok' as Status,
        message: 'Aguarde',
        subtitle: 'Buscando previsão',
      };
    }
    const label = selectedHourObj?.label ?? data.current.label;
    const time = selectedHourObj?.time ?? data.current.time;
    return {
      location: `${data.spot.name} – Ubatuba`,
      status: labelToStatus(label),
      message: capitalizeFirst(label),
      subtitle: `${ctaFromLabel(label)} • ${fmtTime(time)}`,
    };
  }, [data, selectedHourObj]);

  const conditions = useMemo(() => {
    const c = selectedHourObj ?? data?.current;
    const waveHeight = c?.wave_height ?? null;
    const swellDir = c?.swell_direction ?? null;
    const period = c?.swell_period ?? null;
    const windSpd = c?.wind_speed ?? null;
    const windDir = c?.wind_direction ?? null;
    // Mostrar Força em Joules por metro quadrado (energia por área)
    // E ≈ (1/16) * rho * g * H^2, com rho=1025 kg/m³, g=9.81 m/s² e H (onda combinada)
    const energyJm2 = (() => {
      const rho = 1025;
      const g = 9.81;
      const K = (rho * g) / 16; // ~ 628.9
      const H = (c as any)?.wave_height as number | undefined;
      if (Number.isFinite(H)) return K * (H as number) * (H as number);
      const Hs = (c as any)?.swell_height as number | undefined;
      if (Number.isFinite(Hs)) return K * (Hs as number) * (Hs as number);
      return null;
    })();
    return {
      waveHeight: waveHeight != null ? `${waveHeight.toFixed(1)}m` : '—',
      swellDirection: swellDir != null ? degToCardinal(swellDir) : '—',
      period: period != null ? `${period.toFixed(0)}` : '—',
      windSpeed: windSpd != null ? `${windSpd.toFixed(0)}km/h` : '—',
      windDirection: windDir != null ? degToCardinal(windDir) : '—',
      power: energyJm2 != null ? `${Math.round(energyJm2)} J/m²` : '—',
    };
  }, [data, selectedHourObj]);

  // otherSpots agora vem do backend (getSpots), filtrado acima

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  const handleSearchClick = () => {
    setSearchOpen(true);
  };

  const handleSpotSelect = (spot: any) => {
    console.log('Selected spot:', spot);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto bg-background">
        <SurfHeader
          location={currentSpot.location}
          onMenuClick={handleMenuClick}
          onSearchClick={handleSearchClick}
        />

        <SurfStatus
          status={currentSpot.status}
          message={currentSpot.message}
          subtitle={currentSpot.subtitle}
          onPrev={goPrev}
          onNext={goNext}
          prevEnabled={availableSlots.length > 1}
          nextEnabled={availableSlots.length > 1}
        />

        {/* Horário selecionado (informativo) */}
        <div className="px-4 mt-2 flex items-center justify-center text-xs text-zinc-400">
          {selectedSlot ? `Horário: ${selectedSlot.replace(':00','h')}` : ''}
        </div>

        {/* Chips de horários do dia (06, 09, 12, 15) */}
        <div className="px-4 mt-2 flex justify-center">
          <div className="flex items-center justify-center gap-2">
            {['06:00','09:00','12:00','15:00'].map(hh => {
              const available = dayHours.some(h => h.time.includes(`T${hh}`));
              const active = selectedSlot === hh;
              return (
                <button
                  key={hh}
                  disabled={!available}
                  onClick={() => setSelectedSlot(hh)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    active ? 'border-[#00AEEF] text-white bg-zinc-900' : 'border-zinc-700 text-white/70'
                  } ${!available ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-900/60'}`}
                >
                  {hh.replace(':00','h')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contexto e dica do slot (meta) */}
        <div className="px-4 mt-2">
          {selectedHourObj?.meta?.context && (
            <div className="text-xs text-zinc-300 leading-snug text-center">
              {selectedHourObj.meta.context}
            </div>
          )}
          {selectedHourObj?.meta?.advice && (
            <div className="mt-1 text-[11px] text-white/80 flex items-center justify-center">
              <span className="px-2 py-0.5 rounded-full border border-[#00AEEF] text-[#00AEEF] bg-zinc-900/40">{selectedHourObj.meta.advice}</span>
            </div>
          )}
        </div>

        <SurfConditions
          waveHeight={conditions.waveHeight}
          swellDirection={conditions.swellDirection}
          period={conditions.period}
          windSpeed={conditions.windSpeed}
          windDirection={conditions.windDirection}
          power={conditions.power}
        />

        {error && (
          <div className="text-red-400 text-xs px-4 py-2">{error}</div>
        )}

        <SurfSpotsList
          spots={otherSpots}
          initialSpotId={spotId}
          onSpotSelect={handleSpotSelect}
          onSpotChange={(id) => {
            setSpotId(id);
            setSelectedSlot(null);
          }}
        />

        {/* Picker simples ativado pela lupa */}
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => setSearchOpen(false)} />
            <div className="relative bg-[#0a0a0a] border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto p-4 m-2">
              <div className="flex items-center justify-between mb-3">
                <div className="text-white font-semibold">Escolher pico</div>
                <button className="text-zinc-400 hover:text-white" onClick={() => setSearchOpen(false)}>✕</button>
              </div>
              <div className="space-y-2">
                {searchSpots.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSpotId(s.id); setSelectedSlot(null); setSearchOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-md border ${s.id===spotId ? 'border-[#00AEEF] text-white bg-zinc-900' : 'border-zinc-700 text-white/80 hover:bg-zinc-900/60'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;

function labelToStatus(label: string): Status {
  switch (label) {
    case 'épico': return 'epic';
    case 'bom': return 'good';
    case 'ok': return 'ok';
    case 'ruim': return 'bad';
    default: return 'ok';
  }
}

function degToCardinal(d: number) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const i = Math.round(((d % 360) / 22.5)) % 16;
  return dirs[i];
}

function capitalizeFirst(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ctaFromLabel(label: string) {
  switch (label) {
    case 'épico': return 'Vai surfar!';
    case 'bom': return 'Boa janela hoje';
    case 'ok': return 'Dá pra molhar o pé';
    case 'ruim': return 'Melhora depois';
    default: return '';
  }
}

function fmtTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
