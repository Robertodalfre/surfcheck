import { Router } from 'express';
import {
  generateUserAnalytics,
  generateUserMatches,
  generateUserBadges,
  recordWindowHistory,
  seedAnalyticsData,
  clearAnalyticsData
} from '../services/analytics.service.firestore.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Middleware para validar autenticação
 */
function requireAuth(req, res, next) {
  const uid = req.headers['x-user-id'] || req.query.uid;
  
  if (!uid) {
    return res.status(401).json({ 
      error: 'unauthorized', 
      message: 'UID do usuário é obrigatório' 
    });
  }
  
  req.user = { uid };
  next();
}

/**
 * GET /api/analytics/dashboard
 * Dashboard completo de analytics do usuário
 */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const analytics = await generateUserAnalytics(req.user.uid);
    const badges = generateUserBadges(req.user.uid);
    
    res.json({
      uid: req.user.uid,
      analytics,
      badges,
      generated_at: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error generating analytics dashboard');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/matches
 * Sistema de match com outros surfistas
 */
router.get('/matches', requireAuth, async (req, res) => {
  try {
    const matches = await generateUserMatches(req.user.uid);
    
    res.json({
      uid: req.user.uid,
      ...matches
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error generating user matches');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/badges
 * Badges/conquistas do usuário
 */
router.get('/badges', requireAuth, (req, res) => {
  try {
    const badges = generateUserBadges(req.user.uid);
    
    res.json({
      uid: req.user.uid,
      badges,
      total_badges: badges.length,
      generated_at: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error generating user badges');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * POST /api/analytics/record-session
 * Registra uma sessão de surf no histórico
 */
router.post('/record-session', requireAuth, (req, res) => {
  try {
    const { scheduling_id, window_data, action = 'surfed' } = req.body;

    if (!scheduling_id || !window_data) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'scheduling_id e window_data são obrigatórios'
      });
    }

    if (!['surfed', 'missed', 'viewed'].includes(action)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'action deve ser: surfed, missed ou viewed'
      });
    }

    recordWindowHistory(req.user.uid, scheduling_id, window_data, action);

    res.json({
      success: true,
      message: 'Sessão registrada no histórico',
      action,
      recorded_at: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error recording session');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * POST /api/analytics/seed-data
 * Popula dados de teste para analytics (desenvolvimento)
 */
router.post('/seed-data', requireAuth, (req, res) => {
  try {
    seedAnalyticsData(req.user.uid);
    
    res.json({
      success: true,
      message: 'Dados de teste criados',
      uid: req.user.uid,
      seeded_at: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error seeding analytics data');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * DELETE /api/analytics/clear-data
 * Limpa todos os dados de analytics (desenvolvimento)
 */
router.delete('/clear-data', requireAuth, (req, res) => {
  try {
    clearAnalyticsData();
    
    res.json({
      success: true,
      message: 'Dados de analytics limpos',
      cleared_at: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error clearing analytics data');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/summary
 * Resumo rápido de analytics
 */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const analytics = await generateUserAnalytics(req.user.uid);
    const badges = generateUserBadges(req.user.uid);
    
    // Resumo simplificado
    const summary = {
      uid: req.user.uid,
      stats: {
        total_sessions: analytics.summary.windows_surfed,
        surf_rate: analytics.summary.surf_rate,
        avg_score: analytics.summary.avg_surfed_score,
        total_badges: badges.length
      },
      latest_badge: badges[0] || null,
      top_spot: analytics.preferences.top_spots[0] || null,
      recommendations_count: analytics.recommendations.length,
      generated_at: new Date()
    };
    
    res.json(summary);
  } catch (error) {
    logger.error({ error: error.message }, 'error generating analytics summary');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

export default router;
