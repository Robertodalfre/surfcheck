import fetch from 'node-fetch';
import logger from '../utils/logger.js';

const MARINE_BASE = 'https://marine-api.open-meteo.com/v1/marine';
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';

// Marine vars (documentadas no endpoint Marine)
const MARINE_HOURLY = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'wind_wave_height',
  'wind_wave_direction',
  'wind_wave_period',
];

// Weather vars (vento 10m)
const WEATHER_HOURLY = [
  'wind_speed_10m',
  'wind_direction_10m',
];

export async function fetchMarineForecast({ lat, lon, days = 3 }) {
  const marineParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: MARINE_HOURLY.join(','),
    timezone: 'America/Sao_Paulo',
    forecast_days: String(days),
  });

  const weatherParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: WEATHER_HOURLY.join(','),
    timezone: 'America/Sao_Paulo',
    windspeed_unit: 'kmh',
    forecast_days: String(days),
  });

  const marineUrl = `${MARINE_BASE}?${marineParams.toString()}`;
  const weatherUrl = `${WEATHER_BASE}?${weatherParams.toString()}`;
  logger.info({ marineUrl, weatherUrl }, 'Fetching Open-Meteo Marine & Weather');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const [marineRes, weatherRes] = await Promise.all([
      fetch(marineUrl, { signal: controller.signal }),
      fetch(weatherUrl, { signal: controller.signal }),
    ]);

    if (!marineRes.ok) {
      const text = await marineRes.text().catch(() => '');
      logger.error({ status: marineRes.status, text }, 'Marine API error');
      throw new Error(`Marine error ${marineRes.status}: ${text}`);
    }
    if (!weatherRes.ok) {
      const text = await weatherRes.text().catch(() => '');
      logger.error({ status: weatherRes.status, text }, 'Weather API error');
      throw new Error(`Weather error ${weatherRes.status}: ${text}`);
    }

    const marine = await marineRes.json();
    const weather = await weatherRes.json();
    return mergeHourly(marine, weather);
  } finally {
    clearTimeout(timeout);
  }
}

function mergeHourly(marine, weather) {
  const t = marine?.hourly?.time || [];
  const wt = weather?.hourly?.time || [];
  const out = [];
  for (let i = 0; i < t.length; i++) {
    const time = t[i];
    const wi = wt.indexOf(time);
    out.push({
      time,
      wave_height: num(marine.hourly.wave_height?.[i]),
      wave_direction: num(marine.hourly.wave_direction?.[i]),
      wave_period: num(marine.hourly.wave_period?.[i]),
      swell_height: num(marine.hourly.swell_wave_height?.[i]),
      swell_direction: num(marine.hourly.swell_wave_direction?.[i]),
      swell_period: num(marine.hourly.swell_wave_period?.[i]),
      wind_wave_height: num(marine.hourly.wind_wave_height?.[i]),
      wind_wave_direction: num(marine.hourly.wind_wave_direction?.[i]),
      wind_wave_period: num(marine.hourly.wind_wave_period?.[i]),
      wind_speed: wi >= 0 ? num(weather.hourly.wind_speed_10m?.[wi]) : null,
      wind_direction: wi >= 0 ? num(weather.hourly.wind_direction_10m?.[wi]) : null,
    });
  }
  return out;
}

function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}
