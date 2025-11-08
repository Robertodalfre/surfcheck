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
    tide_height?: number | null;
    energy_jpm2?: number | null;
    power_kwm?: number | null;
    reasons: string[];
    meta?: { context: string; advice: string; flags: Record<string, any> };
  } | null;
  windows: { start: string; end: string; score_avg: number; highlights: { reason: string; count: number }[] }[];
  chart: { time: string; score: number }[];
  tide_events?: Array<{ time: string; type: 'high' | 'low'; height: number | null }>;
  params: { days: number; timezone: string; windspeed_unit: string; tide_source?: string | null; tide_unit?: string };
  cache: { fresh: boolean };
};

// Define URL base da API com fallback inteligente
// - Se VITE_API_URL estiver definida e não vazia, usa-a
// - Caso contrário, em produção usa same-origin (Hosting com rewrites)
// - Em desenvolvimento usa http://localhost:4000
const envUrl = (import.meta.env.VITE_API_URL ?? '').toString().trim();
const API_URL = envUrl || (import.meta.env.PROD ? window.location.origin : 'http://localhost:4000');

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} at ${url}: ${text}`);
  }
  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await res.text();
    throw new Error(`Resposta não-JSON de ${url}. Content-Type: ${contentType}. Trecho: ${text.slice(0, 120)}...`);
  }
  return res.json();
}

export async function getForecastCompact(spotId: string, days = 3, chartHours = 72): Promise<ForecastCompact> {
  const url = `${API_URL}/forecast/${encodeURIComponent(spotId)}?days=${days}&compact=1&chartHours=${chartHours}&slots=1`;
  return fetchJson<ForecastCompact>(url);
}

export async function getSpots(): Promise<{ spots: SpotMeta[] }> {
  const url = `${API_URL}/spots`;
  return fetchJson<{ spots: SpotMeta[] }>(url);
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
    tide_height?: number | null;
    energy_jpm2?: number | null;
    power_kwm?: number | null;
    meta?: { context: string; advice: string; flags: Record<string, any> };
  }>;
  windows: any[];
  tide_events?: Array<{ time: string; type: 'high' | 'low'; height: number | null }>;
  params: { days: number; timezone: string; windspeed_unit: string; tide_source?: string | null; tide_unit?: string };
};

export async function getForecastFull(spotId: string, days = 5): Promise<ForecastFull> {
  const url = `${API_URL}/forecast/${encodeURIComponent(spotId)}?days=${days}`;
  return fetchJson<ForecastFull>(url);
}

// Exportar API_URL para uso em outros módulos
export { API_URL };
