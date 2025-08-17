import { angDiff, inSector, to360 } from '../utils/angles.js';
import logger from '../utils/logger.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function scoreHour(hour, spot) {
  const scores = {
    swellAngle: scoreSwellAngle(hour, spot),
    window: scoreWindow(hour, spot),
    energy: 0, // placeholder, set below after computing power
    texture: scoreTexture(hour),
    wind: scoreWind(hour, spot),
    steepness: scoreSteepness(hour, spot),
  };
  // Energia via potência da onda (kW/m) usando o swell (Hs/Tp)
  const H = hour.swell_height ?? 0;
  const T = (hour.swell_period ?? hour.wave_period ?? 0);
  const power_kwm = wavePowerKwM(H, T);
  scores.energy = energyScoreFromPower(power_kwm, spot?.bottomType);
  // base score (sem consistency/tide)
  const base = combine({ ...scores, consistency: 1, tide: 1 });
  // consistency será aplicada fora (média móvel)
  const label = toLabel(base);
  const reasons = buildReasons(hour, spot, scores, base);
  // Log apenas para horários-chave para evitar ruído excessivo
  try {
    const t = String(hour?.time || '');
    if (/T(06|09|12|15):00/.test(t)) {
      logger.info({
        time: t,
        spot: spot?.id,
        H_swell_height: Number.isFinite(H) ? H : null,
        T_swell_period: Number.isFinite(T) ? T : null,
        P_kwm: Number.isFinite(power_kwm) ? power_kwm : null,
        swell_height: Number.isFinite(hour?.swell_height) ? hour.swell_height : null,
        swell_period: Number.isFinite(hour?.swell_period) ? hour.swell_period : null,
        wind_speed: Number.isFinite(hour?.wind_speed) ? hour.wind_speed : null,
        wind_direction: Number.isFinite(hour?.wind_direction) ? hour.wind_direction : null,
        label,
        score: base,
      }, 'scoring sample');
    }
  } catch {}
  return { scores, score: base, label, reasons, power_kwm };
}

export function combine(scores) {
  const out = (
    0.20 * (scores.swellAngle ?? 0) +
    0.15 * (scores.window ?? 0) +
    0.20 * (scores.energy ?? 0) +
    0.15 * (scores.texture ?? 0) +
    0.15 * (scores.wind ?? 0) +
    0.10 * (scores.steepness ?? 0) +
    0.05 * (scores.consistency ?? 1) +
    0.00 * (scores.tide ?? 1)
  );
  return Math.round(100 * out);
}

export function toLabel(score) {
  if (score >= 80) return 'épico';
  if (score >= 60) return 'bom';
  if (score >= 40) return 'ok';
  return 'ruim';
}

function scoreSwellAngle(h, s) {
  if (h.swell_direction == null) return 0;
  const d = angDiff(h.swell_direction, s.beachAzimuth);
  const [aMin, aMax] = s.idealApproach;
  if (d >= aMin && d <= aMax) return 1;
  const pad = 15; // transição suave
  if (d < aMin) return clamp01(1 - (aMin - d) / pad);
  return clamp01(1 - (d - aMax) / pad);
}

function scoreWindow(h, s) {
  const dir = h.swell_direction;
  if (dir == null) return 0;
  if (!inSector(dir, s.swellWindow)) return 0;
  for (const blk of (s.shadowBlocks || [])) {
    if (inSector(dir, blk)) return 0.1;
  }
  return 1;
}

// Energia baseada em potência (kW/m)
export function wavePowerKwM(H, T) {
  if (!Number.isFinite(H) || !Number.isFinite(T) || H <= 0 || T <= 0) return 0;
  return 0.49 * H * H * T;
}

export function energyScoreFromPower(P, bottomType) {
  // Quebras mais rasas (beachbreak) sofrem em mares muito pesados
  const heavyPenalty = bottomType === 'beach' && P > 12 ? 0.1 : 0.0;
  // Mapear potência para score 0..1 com pontos de ancoragem
  // <3 kW/m: ~0.20
  // 3–7: 0.20–0.50
  // 7–12: 0.50–0.80
  // >12: ~0.95 (menos penalidade, depois aplica heavyPenalty)
  let s;
  if (P <= 0) s = 0;
  else if (P < 3) s = 0.2 * (P / 3); // 0..0.2
  else if (P < 7) s = 0.2 + (0.3 * (P - 3) / 4); // 0.2..0.5
  else if (P < 12) s = 0.5 + (0.3 * (P - 7) / 5); // 0.5..0.8
  else s = 0.95; // pesado
  s = Math.max(0, s - heavyPenalty);
  return clamp01(s);
}

function byBottomType(type) {
  switch (type) {
    case 'point':
      return { H: [0.4, 2.2], T: [11, 16] };
    case 'reef':
      return { H: [0.6, 3.0], T: [11, 17] };
    default: // beachbreak
      return { H: [0.4, 2.5], T: [9, 14] };
  }
}

function bandScore(value, lo, hi) {
  if (value >= lo && value <= hi) return 1;
  const pad = (hi - lo) * 0.75; // decaimento suave
  if (value < lo) return clamp01(1 - (lo - value) / pad);
  return clamp01(1 - (value - hi) / pad);
}

function scoreTexture(h) {
  const Hs = h.swell_height ?? 0;
  if (Hs <= 0) return 0; // sem swell, não dá para avaliar textura
  const chop = (h.wind_wave_height ?? 0) / Math.max(1e-3, Hs);
  return clamp01(1 - chop); // >0.5 já cai bem
}

function scoreWind(h, s) {
  if (h.wind_direction == null) return 0;
  const offshore = to360(s.beachAzimuth + 180);
  const d = angDiff(h.wind_direction, offshore);
  const v = h.wind_speed ?? 0;
  const dirScore = d < 30 ? 1 : d < 60 ? 0.6 : d < 90 ? 0.3 : 0.1;
  let vScore = 1; // ideal ~ 8–18 km/h
  if (v < 4) vScore = 0.7;
  else if (v > 28) vScore = 0.3;
  return dirScore * vScore;
}

function scoreSteepness(h, s) {
  const H = h.swell_height ?? 0;
  const T = h.swell_period ?? 0;
  if (H <= 0 || T <= 0) return 0;
  const L0 = 1.56 * T * T;
  const S = H / Math.max(1e-3, L0);
  // Defaults por tipo
  const ranges = steepRanges(s.bottomType);
  if (S >= ranges.ideal[0] && S <= ranges.ideal[1]) return 1;
  if (S < ranges.ideal[0]) return clamp01((S - ranges.hard[0]) / (ranges.ideal[0] - ranges.hard[0]));
  return clamp01((ranges.hard[1] - S) / (ranges.hard[1] - ranges.ideal[1]));
}

function steepRanges(type) {
  switch (type) {
    case 'point':
      return { ideal: [0.015, 0.03], hard: [0.01, 0.05] };
    case 'reef':
      return { ideal: [0.018, 0.032], hard: [0.012, 0.055] };
    default: // beachbreak
      return { ideal: [0.02, 0.035], hard: [0.015, 0.05] };
  }
}

function buildReasons(h, s, scores, finalScore) {
  const r = [];
  // Swell vs Praia
  if (scores.swellAngle >= 0.9) r.push('ângulo do swell ideal');
  else if (scores.swellAngle <= 0.3) r.push('swell batendo de frente/fechando');
  // Janela / sombra
  if (scores.window <= 0.15) r.push('fora da janela de swell ou sombreamento');
  // Energia
  {
    const P = Number.isFinite(h.power_kwm) ? Number(h.power_kwm) : null;
    if (P != null) {
      if (P < 3) r.push('baixa energia do swell');
      else if (P < 7) r.push('energia média');
      else if (P < 12) r.push('boa energia do swell');
      else r.push('energia muito forte');
    } else {
      if (scores.energy >= 0.85) r.push('energia muito forte');
      else if (scores.energy >= 0.6) r.push('boa energia do swell');
      else if (scores.energy <= 0.3) r.push('baixa energia do swell');
    }
  }
  // Textura
  if (scores.texture <= 0.5) r.push('mar mexido/chop alto');
  else if (scores.texture >= 0.9) r.push('textura limpa');
  // Vento
  if (scores.wind >= 0.8) r.push('offshore moderado');
  else if (scores.wind <= 0.3) r.push('vento onshore/cruzado forte');
  // Steepness
  if (scores.steepness >= 0.85) r.push('inclinação favorável (abre bem)');
  else if (scores.steepness <= 0.3) r.push('inclinação desfavorável (fecha/mole)');
  // Final
  if (finalScore >= 80) r.unshift('condição épica');
  else if (finalScore >= 60) r.unshift('condição boa');
  else if (finalScore >= 40) r.unshift('condição ok');
  else r.unshift('condição ruim');
  return r;
}

export function movingAverage(arr, window = 3) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const a = Math.max(0, i - (window - 1));
    const slice = arr.slice(a, i + 1);
    const mean = slice.reduce((p, c) => p + c, 0) / slice.length;
    out.push(mean);
  }
  return out;
}
