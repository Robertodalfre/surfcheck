import { Router } from 'express';
import { getSpotById } from '../domain/spots.model.js';
import { getCache, setCache } from '../services/cache.service.js';
import { fetchMarineForecast } from '../services/openMeteo.service.js';
import { fetchTideForTimes } from '../services/tides.service.js';
import { scoreHour, combine, toLabel, movingAverage } from '../scoring/scoring.engine.js';
import { groupGoodWindows } from '../scoring/windowing.js';
import logger from '../utils/logger.js';

const router = Router();

router.get('/:spotId', async (req, res) => {
  try {
    const spotId = String(req.params.spotId);
    const days = clampDays(Number(req.query.days ?? 3));
    const spot = getSpotById(spotId);
    if (!spot) return res.status(404).json({ error: 'spot_not_found' });

    const cacheKey = `forecast:${spotId}:${days}`;
    logger.info({ spotId, days, cacheKey }, 'forecast request');
    const wantFresh = isTrue(req.query.fresh);
    const cached = wantFresh ? null : getCache(cacheKey);
    if (cached) {
      logger.info({ spotId, days }, 'cache hit');
      const compact = isTrue(req.query.compact);
      if (compact) {
        const chartHours = clampChartHours(Number(req.query.chartHours ?? 72));
        const minimal = toMinimalPayload(cached, { chartHours, slots: isTrue(req.query.slots) });
        return res.json({ ...minimal, cache: { fresh: true } });
      }
      return res.json({ ...cached, cache: { fresh: true } });
    }

    const hoursRaw = await fetchMarineForecast({ lat: spot.lat, lon: spot.lon, days });
    // logger.info({ count: hoursRaw?.length || 0 }, 'marine+weather merged hours');

    // Fetch tide data aligned to the same hourly times (if available)
    let tide = { source: null, unit: 'm', events: [], heightsByTime: new Map(), min: null, max: null };
    try {
      const times = (hoursRaw || []).map(h => h.time).filter(Boolean);
      if (times.length > 0) {
        const tidesFresh = isTrue(req.query.tidesFresh);
        tide = await fetchTideForTimes({ lat: spot.lat, lon: spot.lon, times, days, spotId, tidesFresh });
      }
    } catch (e) {
      logger.warn({ err: String(e?.message || e) }, 'tide fetch failed, continuing without tide');
    }
    // try {
    //   const sampleIdx = (hoursRaw || []).findIndex(h => /T(06|09|12|15):00/.test(String(h?.time || '')));
    //   const s = (sampleIdx >= 0 ? hoursRaw[sampleIdx] : hoursRaw?.[0]) || null;
    //   if (s) {
    //     logger.info({
    //       spotId,
    //       time: s.time,
    //       wave_height: s.wave_height,
    //       wave_period: s.wave_period,
    //       swell_height: s.swell_height,
    //       swell_period: s.swell_period,
    //       wind_speed: s.wind_speed,
    //       wind_direction: s.wind_direction,
    //     }, 'hoursRaw sample (service output)');
    //   }
    // } catch {}

    // Merge tide height before scoring
    const hoursWithTide = hoursRaw.map((h) => {
      const th = tide?.heightsByTime instanceof Map ? tide.heightsByTime.get(h.time) : null;
      const tmin = Number.isFinite(tide?.min) ? Number(tide.min) : null;
      const tmax = Number.isFinite(tide?.max) ? Number(tide.max) : null;
      return { ...h, tide_height: Number.isFinite(th) ? th : null, tide_min: tmin, tide_max: tmax };
    });

    // Scoring base
    const hoursScored = hoursWithTide.map((h) => ({ ...h, ...scoreHour(h, spot) }));

    // Consistency: média móvel 3h aplicada como fator (0..1) via diferença local
    const baseScores = hoursScored.map((h) => h.score);
    const ma3 = movingAverage(baseScores, 3);
    const withConsistency = hoursScored.map((h, i) => {
      const diff = Math.abs(baseScores[i] - ma3[i]);
      const consistency = clamp01(1 - diff / 30); // tolera ~30 pts de serrilhado
      const final = combine({ ...h.scores, consistency });
      const label = toLabel(final);
      return { ...h, score: final, label, scores: { ...h.scores, consistency } };
    });

    // Enriquecer com contexto/advice por hora (leve e textual)
    const withContext = withConsistency.map((h) => {
      const contextAdvice = buildContextAdvice(h, spot);
      // Manter o meta do scoring engine (que tem board) e fazer merge com contextAdvice
      const mergedMeta = {
        ...h.meta, // meta do scoring engine (tem board, advice, flags)
        context: contextAdvice.context, // contexto detalhado da rota
        flags: {
          ...h.meta?.flags,
          ...contextAdvice.flags, // flags da rota (withinWindow, etc)
        }
      };
      
      return {
        ...h,
        // Alinhar "wave_height" ao swell para que o front (que usa wave_height para J/m²)
        // calcule energia com Hs (compatível com Surfguru) sem alterar o frontend
        wave_height: Number.isFinite(h?.swell_height) ? h.swell_height : h.wave_height,
        meta: mergedMeta,
      };
    });

    // Janelas
    const windows = groupGoodWindows(withConsistency, 60);
    // logger.info({ windows: windows.length }, 'good windows computed');

    const payload = {
      spot: summarizeSpot(spot),
      hours: withContext,
      windows,
      tide_events: Array.isArray(tide?.events) ? tide.events : [],
      params: { days, timezone: 'America/Sao_Paulo', windspeed_unit: 'kmh', tide_source: tide?.source || null, tide_unit: tide?.unit || 'm' },
    };
    // try {
    //   const sampleIdx2 = (withContext || []).findIndex(h => /T(06|09|12|15):00/.test(String(h?.time || '')));
    //   const s2 = (sampleIdx2 >= 0 ? withContext[sampleIdx2] : withContext?.[0]) || null;
    //   if (s2) {
    //     logger.info({
    //       spotId,
    //       time: s2.time,
    //       wave_height: s2.wave_height,
    //       wave_period: s2.wave_period,
    //       swell_height: s2.swell_height,
    //       swell_period: s2.swell_period,
    //       power_kwm: s2.power_kwm,
    //       score: s2.score,
    //       label: s2.label,
    //     }, 'payload sample (after scoring/context)');
    //   }
    // } catch {}

    setCache(cacheKey, payload);

    // Compact mode for mobile UI
    const compact = isTrue(req.query.compact);
    if (compact) {
      const chartHours = clampChartHours(Number(req.query.chartHours ?? 72));
      const minimal = toMinimalPayload(payload, { chartHours, slots: isTrue(req.query.slots) });
      return res.json({ ...minimal, cache: { fresh: false } });
    }

    return res.json({ ...payload, cache: { fresh: false } });
  } catch (err) {
    logger.error({ err: String(err?.stack || err) }, 'forecast error');
    return res.status(500).json({ error: 'internal_error', message: String(err?.message || err) });
  }
});

function summarizeSpot(s) {
  return {
    id: s.id,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    beachAzimuth: s.beachAzimuth,
    swellWindow: s.swellWindow,
    idealApproach: s.idealApproach,
    bottomType: s.bottomType,
    windShelter: s.windShelter,
    tidePreference: s.tidePreference,
    tideSensitivity: s.tideSensitivity,
    bestSwellDirections: s.bestSwellDirections,
    idealPeriodRange: s.idealPeriodRange,
    minSwellHeight: s.minSwellHeight,
    windTolerance: s.windTolerance,
    hazards: s.hazards,
    suitableLevels: s.suitableLevels,
    amenities: s.amenities,
    crowdLevel: s.crowdLevel,
    localNotes: s.localNotes,
  };
}

function clampDays(n) {
  if (!Number.isFinite(n)) return 3;
  return Math.min(8, Math.max(1, Math.floor(n)));
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function isTrue(v) {
  if (v === undefined) return false;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function clampChartHours(n) {
  if (!Number.isFinite(n)) return 72;
  return Math.min(168, Math.max(12, Math.floor(n)));
}

function toMinimalPayload(fullPayload, opts) {
  const { chartHours, slots } = opts || {};
  const hours = fullPayload.hours || [];

  if (slots) {
    const slotsArr = buildFourSlots(hours);
    const selected = pickNearestSlot(slotsArr, new Date());
    return {
      spot: fullPayload.spot,
      current: selected ? {
        time: selected.time,
        score: selected.score,
        label: selected.label,
        swell_height: selected.swell_height,
        swell_direction: selected.swell_direction,
        swell_period: selected.swell_period,
        wind_speed: selected.wind_speed,
        wind_direction: selected.wind_direction,
        wave_height: selected.wave_height,
        tide_height: selected.tide_height,
        energy_jpm2: selected.energy_jpm2,
        power_kwm: selected.power_kwm,
        reasons: selected.reasons,
        meta: selected.meta,
      } : null,
      windows: fullPayload.windows || [],
      tide_events: fullPayload.tide_events || [],
      chart: slotsArr.map(s => ({ time: s.time, score: s.score })),
      params: fullPayload.params,
    };
  }

  const chart = hours.slice(0, chartHours || 72).map(h => ({ time: h.time, score: h.score }));
  const current = hours[0];
  return {
    spot: fullPayload.spot,
    current: current ? {
      time: current.time,
      score: current.score,
      label: current.label,
      swell_height: current.swell_height,
      swell_direction: current.swell_direction,
      swell_period: current.swell_period,
      wind_speed: current.wind_speed,
      wind_direction: current.wind_direction,
      wave_height: current.wave_height,
      tide_height: current.tide_height,
      energy_jpm2: current.energy_jpm2,
      power_kwm: current.power_kwm,
      reasons: current.reasons,
      meta: current.meta,
    } : null,
    windows: fullPayload.windows || [],
    tide_events: fullPayload.tide_events || [],
    chart,
    params: fullPayload.params,
  };
}

function buildFourSlots(hours) {
  if (!Array.isArray(hours)) return [];
  const targetHours = new Set([6, 9, 12, 15]);
  return hours.filter(h => {
    if (!h?.time) return false;
    const hh = Number(String(h.time).slice(11, 13));
    return targetHours.has(hh);
  });
}

function pickNearestSlot(slotsArr, nowDate) {
  if (!Array.isArray(slotsArr) || slotsArr.length === 0) return null;
  const now = nowDate instanceof Date ? nowDate : new Date();
  let best = slotsArr[0];
  let bestDiff = Math.abs(new Date(best.time) - now);
  for (let i = 1; i < slotsArr.length; i++) {
    const d = Math.abs(new Date(slotsArr[i].time) - now);
    if (d < bestDiff) {
      best = slotsArr[i];
      bestDiff = d;
    }
  }
  return best;
}

export default router;

// Helpers para contexto/advice
function buildContextAdvice(h, spot) {
  const dirCard = degToCardinal(h.swell_direction);
  const windCard = degToCardinal(h.wind_direction);
  const withinWindow = within(h.swell_direction, spot.swellWindow);

  // Period assessment
  let periodTag = '—';
  let periodOK = true;
  if (Array.isArray(spot.idealPeriodRange) && Number.isFinite(h.swell_period)) {
    const [pMin, pMax] = spot.idealPeriodRange;
    if (h.swell_period < pMin) { periodTag = 'período curto'; periodOK = false; }
    else if (h.swell_period > (pMax || pMin + 4)) { periodTag = 'período longo'; periodOK = true; }
    else { periodTag = 'período ideal'; periodOK = true; }
  }

  // Height assessment
  const heightOK = Number.isFinite(spot.minSwellHeight) ? (h.swell_height >= spot.minSwellHeight) : true;
  const heightTag = Number.isFinite(h.swell_height)
    ? (heightOK ? 'altura ok' : 'altura baixa')
    : 'altura —';

  // Wind sector and strength relative to offshore/badOnshore
  const isOffshoreSector = inSector(h.wind_direction, spot.windShelter?.offshore);
  const isBadOnshoreSector = inSector(h.wind_direction, spot.windShelter?.badOnshore);
  const offMax = spot.windTolerance?.offshoreMax ?? 22;
  const onMax = spot.windTolerance?.onshoreMax ?? 10;
  const windSpeed = Number.isFinite(h.wind_speed) ? h.wind_speed : null;
  const windTooStrongOff = isOffshoreSector && windSpeed != null && windSpeed > offMax;
  const windTooStrongOn = isBadOnshoreSector && windSpeed != null && windSpeed > onMax;
  const windPhrase = (() => {
    if (windSpeed == null) return `Vento ${windCard}`;
    if (isOffshoreSector) return `Offshore ${windCard} ${fmtNum(windSpeed,0)}km/h${windTooStrongOff ? ' (forte)' : ''}`;
    if (isBadOnshoreSector) return `Onshore ${windCard} ${fmtNum(windSpeed,0)}km/h${windTooStrongOn ? ' (forte)' : ''}`;
    return `Vento ${windCard} ${fmtNum(windSpeed,0)}km/h`;
  })();

  // Texture via chopIndex if disponível
  let textureTag = '';
  if (Number.isFinite(h.wind_wave_height) && Number.isFinite(h.swell_height) && h.swell_height > 0) {
    const chop = h.wind_wave_height / h.swell_height;
    if (chop < 0.35) textureTag = 'textura limpa';
    else if (chop < 0.7) textureTag = 'textura ok';
    else textureTag = 'mar mexido';
  }

  // Power/energy tag
  const P = Number.isFinite(h.power_kwm)
    ? Number(h.power_kwm)
    : (Number.isFinite(h.wave_height) && Number.isFinite(h.wave_period))
      ? (0.49 * h.wave_height * h.wave_height * h.wave_period)
      : (Number.isFinite(h.swell_height) && Number.isFinite(h.swell_period))
        ? (0.49 * h.swell_height * h.swell_height * h.swell_period)
        : null;
  let powerTag = '';
  if (P != null) {
    if (P < 3) powerTag = `energia fraca (${fmtNum(P,1)} kW/m)`;
    else if (P < 7) powerTag = `energia média (${fmtNum(P,1)} kW/m)`;
    else if (P < 12) powerTag = `energia forte (${fmtNum(P,1)} kW/m)`;
    else powerTag = `energia pesada (${fmtNum(P,1)} kW/m)`;
  }

  // Contexto textual: sempre factual
  const bits = [];
  bits.push(`Swell ${dirCard} ${fmtNum(h.swell_height)}m ${fmtNum(h.swell_period,0)}s`);
  bits.push(windPhrase);
  bits.push(withinWindow ? 'dentro da janela' : 'fora da janela');
  if (textureTag) bits.push(textureTag);
  if (periodTag !== '—') bits.push(periodTag);
  if (!heightOK) bits.push('altura baixa');
  if (powerTag) bits.push(powerTag);
  const context = bits.join(' · ');

  // Advice objetivo: destaca o fator dominante
  let advice = '';
  if (!withinWindow) advice = 'Swell fora da janela da praia';
  else if (isBadOnshoreSector && windTooStrongOn) advice = 'Onshore forte atrapalhando';
  else if (isBadOnshoreSector) advice = 'Onshore presente, pode prejudicar';
  else if (windTooStrongOff) advice = 'Offshore forte, pode segurar a parede';
  else if (!heightOK) advice = 'Altura abaixo do ideal do pico';
  else if (!periodOK) advice = 'Período curto para o pico';
  else if (textureTag === 'mar mexido') advice = 'Textura mexida pelo vento';
  else advice = 'Condições alinhadas ao pico';
  // Nota adicional para beachbreak em mar pesado
  if (spot?.bottomType === 'beach' && P != null && P > 12) {
    advice = advice || '';
    advice += (advice ? ' · ' : '') + 'Mar pesado para beachbreak raso';
  }

  const flags = {
    withinWindow,
    periodOK,
    heightOK,
    isOffshoreSector,
    isBadOnshoreSector,
    windTooStrongOff,
    windTooStrongOn,
    textureTag,
    // Compatibilidade com frontend: expor score também em flags
    score: Number.isFinite(h.score) ? Number(h.score) : null,        // 0..100
    score10: Number.isFinite(h.score) ? Number(h.score) / 10 : null, // 0..10
    label: h.label,
  };

  return { context, advice, flags };
}

function within(deg, range) {
  if (!Array.isArray(range) || range.length !== 2) return true;
  const [a,b] = range;
  return deg >= a && deg <= b;
}

function inSector(deg, sector) {
  if (!Array.isArray(sector) || sector.length !== 2) return false;
  const [a, b] = sector;
  return deg >= a && deg <= b;
}

function degToCardinal(deg) {
  if (!Number.isFinite(deg)) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[idx];
}

function fmtNum(x, digits=1) {
  if (!Number.isFinite(x)) return '—';
  return Number(x).toFixed(digits);
}
