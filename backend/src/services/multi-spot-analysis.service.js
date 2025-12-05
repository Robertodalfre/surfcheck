import { getSpotsByRegion, getSpotById } from '../domain/spots.model.js';
import { analyzeWindows } from './window-analysis.service.js';
import logger from '../utils/logger.js';

/**
 * Analisa uma região comparando os spots e retorna ranking (limit 3)
 * @param {Object} params
 * @param {string} params.regionId
 * @param {Object} params.preferences
 * @param {string[]} [params.onlySpots] - opcional, restringe a spots específicos da região
 * @param {number} [params.limit=3]
 */
export async function analyzeRegion({ regionId, preferences, onlySpots = null, limit = 3 }) {
  const spots = getSpotsByRegion(regionId);
  if (!spots || spots.length === 0) {
    return { status: 'no_spots', region: regionId, ranking: [], best_spot: null, best_window: null };
  }

  const spotList = onlySpots && onlySpots.length
    ? spots.filter((s) => onlySpots.includes(s.id))
    : spots;

  const results = [];

  for (const spot of spotList) {
    try {
      // Monta um scheduling temporário só para reusar a análise existente
      const tempScheduling = {
        id: `region-${regionId}-${spot.id}`,
        spot_id: spot.id,
        preferences: preferences || {},
        active: true
      };

      const analysis = await analyzeWindows(tempScheduling);
      const win = analysis?.windows?.[0];
      if (!win) continue;

      results.push({
        spot_id: spot.id,
        spot_name: spot.name,
        avg_score: win.avg_score,
        peak_score: win.peak_score,
        best_hour: win.best_hour,
        window: {
          start: win.start,
          end: win.end,
          duration_hours: win.duration_hours,
          description: win.description,
          quality_rating: win.quality_rating
        }
      });
    } catch (e) {
      logger.warn({ regionId, spot: spot.id, err: String(e?.message || e) }, 'region spot analysis failed');
    }
  }

  // Ordenar e limitar
  const ranking = results
    .sort((a, b) => b.avg_score - a.avg_score)
    .slice(0, limit);

  const best = ranking[0] || null;

  return {
    status: 'success',
    region: regionId,
    best_spot: best ? { spot_id: best.spot_id, spot_name: best.spot_name } : null,
    best_window: best ? { ...best.best_hour, window: best.window } : null,
    ranking
  };
}
