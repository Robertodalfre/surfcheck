import fetch from 'node-fetch';
import logger from '../utils/logger.js';
import { getFirestore } from './firebase.service.js';

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
    
    // Se API quota exceeded, gerar dados simulados para teste
    if (res.status === 402 && text.includes('quota exceeded')) {
      console.log('🧪 API quota exceeded - generating mock tide data for testing');
      const mockEvents = [];
      const startTime = new Date(start + 'T00:00:00Z');
      
      for (let day = 0; day < days; day++) {
        const dayStart = new Date(startTime.getTime() + day * 24 * 3600 * 1000);
        
        // 2 marés altas e 2 baixas por dia (padrão semidiurno)
        mockEvents.push(
          {
            time: new Date(dayStart.getTime() + 3 * 3600 * 1000).toISOString(), // 03:00
            type: 'high',
            height: 0.2 + Math.random() * 0.1 // 0.2-0.3m
          },
          {
            time: new Date(dayStart.getTime() + 9 * 3600 * 1000).toISOString(), // 09:00
            type: 'low',
            height: -0.3 - Math.random() * 0.1 // -0.3 a -0.4m
          },
          {
            time: new Date(dayStart.getTime() + 15 * 3600 * 1000).toISOString(), // 15:00
            type: 'high',
            height: 0.2 + Math.random() * 0.1 // 0.2-0.3m
          },
          {
            time: new Date(dayStart.getTime() + 21 * 3600 * 1000).toISOString(), // 21:00
            type: 'low',
            height: -0.1 - Math.random() * 0.1 // -0.1 a -0.2m
          }
        );
      }
      
      try { logger.info({ count: mockEvents.length }, 'mock tide extremes generated'); } catch {}
      return { source: 'mock', unit: 'm', events: mockEvents };
    }
    
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

// In-flight dedup map
const inFlight = new Map();

function keyForDay(spotId, dayISO) { return `${spotId}:${dayISO}`; }

function toDayISO(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toISOString().slice(0, 10);
}

function groupEventsByDay(events) {
  const map = new Map();
  for (const e of events || []) {
    const day = toDayISO(e.time);
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(e);
  }
  return map;
}

async function readDayFromCache(db, collection, spotId, dayISO) {
  const id = keyForDay(spotId, dayISO);
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  const expiresAt = data?.expiresAt?.toDate ? data.expiresAt.toDate() : (data?.expiresAt ? new Date(data.expiresAt) : null);
  if (expiresAt && expiresAt.getTime() < Date.now()) return null;
  return data;
}

async function writeDayToCache(db, collection, spotId, dayISO, payload, ttlHours) {
  const id = keyForDay(spotId, dayISO);
  const ref = db.collection(collection).doc(id);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(1, ttlHours) * 3600 * 1000);
  const doc = {
    source: payload?.source || 'stormglass',
    unit: payload?.unit || 'm',
    events: payload?.events || [],
    min: payload?.min ?? null,
    max: payload?.max ?? null,
    spotId,
    dayISO,
    createdAt: now,
    expiresAt,
  };
  await ref.set(doc, { merge: true });
  return doc;
}

export async function fetchTideForTimes({ lat, lon, times, days = 3, spotId = 'unknown', tidesFresh = false }) {
  const apiKey = process.env.VITE_API_KEY_STORMGLASS || process.env.STORMGLASS_API_KEY;
  if (!apiKey) throw new Error('Stormglass API key missing (VITE_API_KEY_STORMGLASS or STORMGLASS_API_KEY)');

  // Temporariamente desabilitar cache do Firestore
  const useFirestoreCache = process.env.USE_FIRESTORE_CACHE === 'true';
  // console.log(`🔧 Firestore cache ${useFirestoreCache ? 'ENABLED' : 'DISABLED'} for ${spotId}`);
  
  let db, collection, ttlHours;
  if (useFirestoreCache) {
    db = getFirestore();
    collection = process.env.FIRESTORE_TIDES_COLLECTION || 'tides';
    ttlHours = Number(process.env.TIDES_TTL_HOURS || 48);
  }

  const uniqueDays = Array.from(new Set((times || []).map(toDayISO)));
  const wantedDays = uniqueDays.length ? uniqueDays : [toISODate(new Date())];

  const dayPayloads = new Map();

  // Try cache first (unless tidesFresh or cache disabled)
  if (!tidesFresh && useFirestoreCache) {
    for (const day of wantedDays) {
      try {
        const cached = await readDayFromCache(db, collection, spotId, day);
        if (cached?.events?.length) {
          // console.log(`📖 Tide data loaded from cache for ${spotId} on ${day}`);
          dayPayloads.set(day, cached);
        } else {
          // console.log(`📭 No cached tide data found for ${spotId} on ${day}`);
        }
      } catch (error) {
        // console.error(`❌ Failed to read tide cache for ${spotId} on ${day}:`, error.message);
      }
    }
  }

  const missingDays = wantedDays.filter(d => !dayPayloads.has(d));

  if (missingDays.length) {
    // Deduplicate by a combined key range (min..max)
    const minDay = missingDays.slice().sort()[0];
    const maxDay = missingDays.slice().sort().slice(-1)[0];
    const inflightKey = `${spotId}:${minDay}..${maxDay}`;
    let promise = inFlight.get(inflightKey);
    if (!promise) {
      promise = (async () => {
        const startDate = new Date(minDay + 'T00:00:00Z');
        const daysSpan = Math.max(1, Math.ceil((new Date(maxDay + 'T00:00:00Z').getTime() - startDate.getTime()) / (24*3600*1000)) + 1);
        const ext = await fetchTideExtremes({ lat, lon, startDate, days: Math.max(daysSpan, days || 1), apiKey });
        const byDay = groupEventsByDay(ext.events);
        for (const [day, events] of byDay.entries()) {
          const { heightsByTime, min, max } = interpolateHeightsFromExtremes(events, (times || []).filter(t => toDayISO(t) === day));
          const doc = { source: 'stormglass', unit: 'm', events, min, max };
          
          // Only cache if Firestore is enabled
          if (useFirestoreCache) {
            try { 
              await writeDayToCache(db, collection, spotId, day, doc, ttlHours);
              // console.log(`✅ Tide data cached for ${spotId} on ${day}`);
            } catch (error) {
              console.error(`❌ Failed to cache tide data for ${spotId} on ${day}:`, error.message);
            }
          }
          
          dayPayloads.set(day, doc);
        }
        return true;
      })();
      inFlight.set(inflightKey, promise);
    }
    try { await promise; } finally { inFlight.delete(inflightKey); }
  }

  // Merge all events and interpolate for all times
  const allEvents = [];
  for (const day of wantedDays) {
    const doc = dayPayloads.get(day);
    if (doc?.events?.length) allEvents.push(...doc.events);
  }

  const { heightsByTime, min, max } = interpolateHeightsFromExtremes(allEvents, times || []);
  // try {
  //   const source = useFirestoreCache ? 'stormglass+cache' : 'stormglass-direct';
  //   logger.info({ spotId, tide_source: source, events: allEvents.length, days: wantedDays.length }, 'tide fetched');
  // } catch {}
  return { source: 'stormglass', unit: 'm', events: allEvents, heightsByTime, min, max };
}
