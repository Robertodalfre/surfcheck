import { Router } from 'express';
import { getRegions, getSpotsByRegion } from '../domain/spots.model.js';
import { analyzeRegion } from '../services/multi-spot-analysis.service.js';

const router = Router();

function requireAuth(req, res, next) {
  const uid = req.headers['x-user-id'] || req.query.uid;
  if (!uid) {
    return res.status(401).json({ error: 'unauthorized', message: 'UID do usuário é obrigatório' });
  }
  req.user = { uid };
  next();
}

// Lista regiões disponíveis
router.get('/', requireAuth, (_req, res) => {
  const regions = getRegions();
  res.json({ regions, total: regions.length });
});

// Lista spots de uma região
router.get('/:regionId/spots', requireAuth, (req, res) => {
  const { regionId } = req.params;
  const spots = getSpotsByRegion(regionId);
  res.json({ region: regionId, spots, total: spots.length });
});

// Análise rápida da região (ranking top-N, default 3)
router.get('/:regionId/analysis', requireAuth, async (req, res) => {
  try {
    const { regionId } = req.params;
    const limit = Math.max(1, Math.min(5, Number(req.query.limit) || 3));
    const preferences = req.body?.preferences || {}; // opcional

    const result = await analyzeRegion({ regionId, preferences, limit });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

export default router;
