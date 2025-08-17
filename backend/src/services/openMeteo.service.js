import fetch from 'node-fetch';
import logger from '../utils/logger.js';

const MARINE_BASE = 'https://marine-api.open-meteo.com/v1/marine';
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
// Permite forçar modelos do Marine via env (ex.: "gfs_wave"), senão usa best match
const MARINE_MODELS = process.env.OM_MARINE_MODELS;

// Marine vars (documentadas no endpoint Marine)
const MARINE_HOURLY = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'wave_peak_period', 
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'swell_wave_peak_period', 
  'wind_wave_height',
  'wind_wave_direction',
  'wind_wave_period',
  'wind_wave_peak_period', 
];

// Weather vars (vento 10m)
const WEATHER_HOURLY = [
  'wind_speed_10m',
  'wind_direction_10m',
];

export async function fetchMarineForecast({ lat, lon, days = 3 }) {
  let useModels = MARINE_MODELS && String(MARINE_MODELS).trim() ? String(MARINE_MODELS).trim() : null;

  // até 2 tentativas com backoff exponencial
  const maxAttempts = 2;
  const baseDelayMs = 600;
  const timeoutMs = 20000;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Monta URLs a cada tentativa (permite fallback sem models)
    const marineParams = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: MARINE_HOURLY.join(','),
      timezone: 'America/Sao_Paulo',
      forecast_days: String(days),
      cell_selection: 'sea',
    });
    if (useModels) marineParams.set('models', useModels);

    const weatherParams = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: WEATHER_HOURLY.join(','),
      timezone: 'America/Sao_Paulo',
      windspeed_unit: 'kmh',
      forecast_days: String(days),
      cell_selection: 'land',
    });

    const marineUrl = `${MARINE_BASE}?${marineParams.toString()}`;
    const weatherUrl = `${WEATHER_BASE}?${weatherParams.toString()}`;

    logger.info({ marineUrl, weatherUrl, attempt, marine_models: useModels || 'best-match' }, 'Fetching Open-Meteo Marine & Weather');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const [marineRes, weatherRes] = await Promise.all([
        fetch(marineUrl, { signal: controller.signal }),
        fetch(weatherUrl, { signal: controller.signal }),
      ]);

      if (!marineRes.ok) {
        const text = await marineRes.text().catch(() => '');
        logger.error({ status: marineRes.status, text, attempt }, 'Marine API error');
        // Fallback: se models inválido, remove e tenta novamente (best match)
        if (marineRes.status === 400 && useModels && /invalid String value/i.test(text)) {
          logger.warn({ useModels, attempt }, 'Invalid models parameter for Marine API. Falling back to best-match (no models)');
          useModels = null;
          if (attempt < maxAttempts) {
            // volta ao início do loop para nova tentativa sem models
            clearTimeout(timeout);
            continue;
          }
        }
        throw new Error(`Marine error ${marineRes.status}: ${text}`);
      }
      if (!weatherRes.ok) {
        const text = await weatherRes.text().catch(() => '');
        logger.error({ status: weatherRes.status, text, attempt }, 'Weather API error');
        throw new Error(`Weather error ${weatherRes.status}: ${text}`);
      }

      const marine = await marineRes.json();
      const weather = await weatherRes.json();
      try {
        logger.info({
          marine_units: marine?.hourly_units,
          marine_lat: marine?.latitude,
          marine_lon: marine?.longitude,
          marine_gen_ms: marine?.generationtime_ms,
          weather_units: weather?.hourly_units,
          weather_lat: weather?.latitude,
          weather_lon: weather?.longitude,
          weather_gen_ms: weather?.generationtime_ms,
        }, 'Open-Meteo responses meta');
      } catch {}
      return mergeHourly(marine, weather);
    } catch (err) {
      lastErr = err;
      logger.error({ err: String(err), attempt }, 'forecast error');
      if (attempt < maxAttempts) {
        // backoff exponencial simples
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  // fallback (não deveria chegar aqui)
  throw lastErr || new Error('Unknown forecast fetch error');
}

function mergeHourly(marine, weather) {
  const t = marine?.hourly?.time || [];
  const wt = weather?.hourly?.time || [];
  const out = [];
  // Counters de uso de pico vs médio
  let cnt = {
    wave_peak: 0, wave_mean: 0,
    swell_peak: 0, swell_mean: 0,
    wind_peak: 0, wind_mean: 0,
  };
  for (let i = 0; i < t.length; i++) {
    const time = t[i];
    const wi = wt.indexOf(time);

    // Para períodos, tratar valores <= 0 como ausentes
    const wave_peak = numPos(marine.hourly.wave_peak_period?.[i]);
    const wave_mean = numPos(marine.hourly.wave_period?.[i]);
    const swell_peak = numPos(marine.hourly.swell_wave_peak_period?.[i]);
    const swell_mean = numPos(marine.hourly.swell_wave_period?.[i]);
    const wind_peak = numPos(marine.hourly.wind_wave_peak_period?.[i]);
    const wind_mean = numPos(marine.hourly.wind_wave_period?.[i]);

    const wave_period = wave_peak ?? wave_mean;
    const swell_period = swell_peak ?? swell_mean;
    const wind_wave_period = wind_peak ?? wind_mean;

    const period_kind = {
      wave: wave_peak != null ? 'peak' : (wave_mean != null ? 'mean' : null),
      swell: swell_peak != null ? 'peak' : (swell_mean != null ? 'mean' : null),
    };

    if (wave_peak != null) cnt.wave_peak++; else if (wave_mean != null) cnt.wave_mean++;
    if (swell_peak != null) cnt.swell_peak++; else if (swell_mean != null) cnt.swell_mean++;
    if (wind_peak != null) cnt.wind_peak++; else if (wind_mean != null) cnt.wind_mean++;

    out.push({
      time,
      wave_height: num(marine.hourly.wave_height?.[i]),
      wave_direction: num(marine.hourly.wave_direction?.[i]),
      wave_period,
      swell_height: num(marine.hourly.swell_wave_height?.[i]),
      swell_direction: num(marine.hourly.swell_wave_direction?.[i]),
      swell_period,
      wind_wave_height: num(marine.hourly.wind_wave_height?.[i]),
      wind_wave_direction: num(marine.hourly.wind_wave_direction?.[i]),
      wind_wave_period,
      period_kind,
      wind_speed: wi >= 0 ? num(weather.hourly.wind_speed_10m?.[wi]) : null,
      wind_direction: wi >= 0 ? num(weather.hourly.wind_direction_10m?.[wi]) : null,
    });
  }
  // Log resumido do uso de pico vs médio e exemplo (preferir 12:00)
  try {
    const preferIdx = Math.max(0, t.findIndex(x => typeof x === 'string' && x.includes('T12:00')));
    const sample = out[preferIdx] || out[0] || null;
    logger.info({
      counts: cnt,
      sample: sample ? {
        time: sample.time,
        wave_height: sample.wave_height,
        wave_period: sample.wave_period,
        swell_height: sample.swell_height,
        swell_period: sample.swell_period,
        wind_wave_height: sample.wind_wave_height,
        wind_wave_period: sample.wind_wave_period,
        wind_speed: sample.wind_speed,
        wind_direction: sample.wind_direction,
      } : null,
    }, 'mergeHourly summary (peak vs mean and sample)');
  } catch {}
  return out;
}

function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

// Para variáveis de período: somente valores positivos fazem sentido
function numPos(x) {
  const v = Number(x);
  return Number.isFinite(v) && v > 0 ? v : null;
}
