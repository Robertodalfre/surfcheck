export type SpotMeta = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  beachAzimuth: number;
  swellWindow?: [number, number];
  idealApproach?: [number, number];
  bottomType?: string;
  windShelter?: { offshore: [number, number]; badOnshore?: [number, number] };
  tidePreference?: string[];
  tideSensitivity?: number;
  bestSwellDirections?: string[];
  idealPeriodRange?: [number, number];
  minSwellHeight?: number;
  windTolerance?: { offshoreMax?: number; onshoreMax?: number };
  hazards?: string[];
  suitableLevels?: string[];
  amenities?: string[];
  crowdLevel?: number;
  localNotes?: string;
};

export type ForecastCompact = {
  spot: SpotMeta;
  current: {
    time: string;
    score: number;
    label: string; // "épico" | "bom" | "ok" | "ruim"
    swell_height: number | null;
    swell_direction: number | null;
    swell_period: number | null;
    wind_speed: number | null;
    wind_direction: number | null;
    wave_height: number | null;
    power_kwm?: number | null;
    reasons: string[];
    meta?: { context: string; advice: string; flags: Record<string, any> };
  } | null;
  windows: { start: string; end: string; score_avg: number; highlights: { reason: string; count: number }[] }[];
  chart: { time: string; score: number }[];
  params: { days: number; timezone: string; windspeed_unit: string };
  cache: { fresh: boolean };
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export async function getForecastCompact(spotId: string, days = 3, chartHours = 72): Promise<ForecastCompact> {
  const url = `${API_URL}/forecast/${encodeURIComponent(spotId)}?days=${days}&compact=1&chartHours=${chartHours}&slots=1`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Forecast error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getSpots(): Promise<{ spots: SpotMeta[] }> {
  const url = `${API_URL}/spots`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spots error ${res.status}: ${text}`);
  }
  return res.json();
}

// Full forecast (non-compact) to access hourly metrics
export type ForecastFull = {
  spot: SpotMeta;
  hours: Array<{
    time: string;
    score: number;
    label: string;
    wave_height: number | null;
    swell_height: number | null;
    swell_direction: number | null;
    swell_period: number | null;
    wind_speed: number | null;
    wind_direction: number | null;
    power_kwm?: number | null;
    meta?: { context: string; advice: string; flags: Record<string, any> };
  }>;
  windows: any[];
  params: any;
};

export async function getForecastFull(spotId: string, days = 5): Promise<ForecastFull> {
  const url = `${API_URL}/forecast/${encodeURIComponent(spotId)}?days=${days}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Forecast error ${res.status}: ${text}`);
  }
  return res.json();
}
