import { Router } from 'express';
import { getAllSpots } from '../domain/spots.model.js';

const router = Router();

router.get('/', (_req, res) => {
  const spots = getAllSpots();
  res.json({ spots });
});

export default router;
