import fetch from 'node-fetch';
import logger from '../utils/logger.js';

const SG_BASE = 'https://api.stormglass.io/v2';

function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

export async function fetchTideExtremes({ lat, lon, startDate, days = 3, apiKey }) {
  const start = toISODate(startDate || new Date());
  const endDate = new Date(start + 'T00:00:00Z');
  endDate.setUTCDate(endDate.getUTCDate() + Math.max(1, days));
  const end = toISODate(endDate);
  const url = `${SG_BASE}/tide/extremes/point?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lon)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Stormglass extremes ${res.status}: ${text}`);
  }
  const json = await res.json();
  const events = Array.isArray(json?.data) ? json.data.map(e => ({
    time: e.time,
    type: e.type, // 'high' | 'low'
    height: Number.isFinite(Number(e.height)) ? Number(e.height) : null,
  })) : [];
  try { logger.info({ count: events.length }, 'stormglass extremes fetched'); } catch {}
  return { source: 'stormglass', unit: 'm', events };
}

function interpolateHeightsFromExtremes(events, times) {
  if (!Array.isArray(events) || events.length < 2 || !Array.isArray(times)) return { heightsByTime: new Map(), min: null, max: null };
  const sorted = [...events].sort((a,b) => new Date(a.time) - new Date(b.time));
  const heightsByTime = new Map();
  let globalMin = Infinity, globalMax = -Infinity;
  for (const t of times) {
    const dt = new Date(t);
    let prev = null, next = null;
    for (let i = 0; i < sorted.length; i++) {
      const ei = sorted[i];
      const ti = new Date(ei.time);
      if (ti <= dt) prev = ei;
      if (ti >= dt) { next = ei; break; }
    }
    if (!prev) prev = sorted[0];
    if (!next) next = sorted[sorted.length - 1];
    const t0 = new Date(prev.time).getTime();
    const t1 = new Date(next.time).getTime();
    const tt = dt.getTime();
    const h0 = Number(prev.height);
    const h1 = Number(next.height);
    let h;
    if (!Number.isFinite(h0) || !Number.isFinite(h1) || t1 === t0) {
      h = Number.isFinite(h0) ? h0 : (Number.isFinite(h1) ? h1 : null);
    } else {
      const u = clamp01((tt - t0) / (t1 - t0));
      // interpolação suave coseno (aproximação semidiurna)
      const s = (1 - Math.cos(Math.PI * u)) / 2; // 0..1
      h = h0 + (h1 - h0) * s;
    }
    heightsByTime.set(t, Number.isFinite(h) ? h : null);
    if (Number.isFinite(h)) {
      if (h < globalMin) globalMin = h;
      if (h > globalMax) globalMax = h;
    }
  }
  if (globalMin === Infinity) { globalMin = null; globalMax = null; }
  return { heightsByTime, min: globalMin, max: globalMax };
}

export async function fetchTideForTimes({ lat, lon, times, days = 3 }) {
  const apiKey = process.env.VITE_API_KEY_STORMGLASS || process.env.STORMGLASS_API_KEY;
  if (!apiKey) throw new Error('Stormglass API key missing (VITE_API_KEY_STORMGLASS or STORMGLASS_API_KEY)');
  const ext = await fetchTideExtremes({ lat, lon, startDate: times?.[0] || new Date(), days, apiKey });
  const { heightsByTime, min, max } = interpolateHeightsFromExtremes(ext.events, times || []);
  const unit = 'm';
  const source = 'stormglass';
  return { source, unit, events: ext.events, heightsByTime, min, max };
}
