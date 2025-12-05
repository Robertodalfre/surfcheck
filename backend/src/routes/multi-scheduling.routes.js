import { Router } from 'express';
import {
  createMultiScheduling,
  getMultiSchedulingsByUser,
  getMultiSchedulingById,
  updateMultiScheduling,
  deleteMultiScheduling,
} from '../domain/multi-scheduling.model.js';
import { analyzeRegion } from '../services/multi-spot-analysis.service.js';

const router = Router();

function requireAuth(req, res, next) {
  const uid = req.headers['x-user-id'] || req.query.uid;
  if (!uid) return res.status(401).json({ error: 'unauthorized', message: 'UID do usuário é obrigatório' });
  req.user = { uid };
  next();
}

// Listar agendamentos multi-pico do usuário
router.get('/', requireAuth, async (req, res) => {
  const items = await getMultiSchedulingsByUser(req.user.uid);
  res.json({ items, total: items.length });
});

// Criar novo agendamento multi-pico
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = { ...req.body, uid: req.user.uid };
    const created = await createMultiScheduling(data);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: 'invalid_request', message: error.message });
  }
});

// Obter por id
router.get('/:id', requireAuth, async (req, res) => {
  const item = await getMultiSchedulingById(req.params.id);
  if (!item || item.uid !== req.user.uid) return res.status(404).json({ error: 'not_found' });
  res.json(item);
});

// Atualizar
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const current = await getMultiSchedulingById(req.params.id);
    if (!current || current.uid !== req.user.uid) return res.status(404).json({ error: 'not_found' });
    const updated = await updateMultiScheduling(req.params.id, req.body || {});
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: 'invalid_request', message: error.message });
  }
});

// Deletar
router.delete('/:id', requireAuth, async (req, res) => {
  const current = await getMultiSchedulingById(req.params.id);
  if (!current || current.uid !== req.user.uid) return res.status(404).json({ error: 'not_found' });
  await deleteMultiScheduling(req.params.id);
  res.json({ ok: true });
});

// Análise comparativa (top-3 por padrão)
router.get('/:id/analysis', requireAuth, async (req, res) => {
  const item = await getMultiSchedulingById(req.params.id);
  if (!item || item.uid !== req.user.uid) return res.status(404).json({ error: 'not_found' });
  const limit = Math.max(1, Math.min(5, Number(req.query.limit) || 3));

  try {
    const result = await analyzeRegion({
      regionId: item.region,
      preferences: item.preferences || {},
      onlySpots: item.spots,
      limit
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

export default router;
