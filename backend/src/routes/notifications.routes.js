import { Router } from 'express';
import {
  generateNotificationsForScheduling,
  generateDailySummary,
  processAllNotifications,
  sendPushNotification
} from '../services/notification.service.js';
import { getSchedulingsByUser } from '../domain/scheduling.model.firestore.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * Middleware para validar autenticação (mesmo do scheduling)
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
 * GET /api/notifications/preview/:schedulingId
 * Preview das notificações que seriam geradas para um agendamento
 */
router.get('/preview/:schedulingId', requireAuth, async (req, res) => {
  try {
    const notifications = await generateNotificationsForScheduling(req.params.schedulingId);
    
    res.json({
      scheduling_id: req.params.schedulingId,
      notifications,
      count: notifications.length,
      preview_time: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error generating notification preview');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/notifications/daily-summary
 * Gera resumo diário para o usuário autenticado
 */
router.get('/daily-summary', requireAuth, async (req, res) => {
  try {
    const summary = await generateDailySummary(req.user.uid);
    
    if (!summary) {
      return res.json({
        uid: req.user.uid,
        summary: null,
        message: 'Nenhum agendamento ativo com resumo diário habilitado'
      });
    }

    res.json({
      uid: req.user.uid,
      summary,
      generated_at: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error generating daily summary');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * POST /api/notifications/test-send
 * Envia notificação de teste para o usuário
 */
router.post('/test-send', requireAuth, async (req, res) => {
  try {
    const { title, body, type = 'test' } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Título e corpo são obrigatórios'
      });
    }

    const testNotification = {
      id: `test_${req.user.uid}_${Date.now()}`,
      type,
      uid: req.user.uid,
      title,
      body,
      data: {
        is_test: true,
        sent_by: req.user.uid
      },
      priority: 'normal',
      created_at: new Date(),
      scheduled_for: new Date()
    };

    const success = await sendPushNotification(testNotification);

    res.json({
      success,
      notification: testNotification,
      message: success ? 'Notificação de teste enviada' : 'Falha ao enviar notificação'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error sending test notification');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * POST /api/notifications/process-all
 * Processa todas as notificações pendentes (para debug/admin)
 */
router.post('/process-all', requireAuth, async (req, res) => {
  try {
    const notifications = await processAllNotifications();
    
    // Enviar todas as notificações geradas
    const results = [];
    for (const notification of notifications) {
      const success = await sendPushNotification(notification);
      results.push({
        notification_id: notification.id,
        type: notification.type,
        success,
        title: notification.title
      });
    }

    res.json({
      total_processed: notifications.length,
      results,
      processed_at: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error processing all notifications');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * GET /api/notifications/user-stats
 * Estatísticas de notificações do usuário
 */
router.get('/user-stats', requireAuth, async (req, res) => {
  try {
    const userSchedulings = getSchedulingsByUser(req.user.uid);
    
    const stats = {
      uid: req.user.uid,
      total_schedulings: userSchedulings.length,
      active_schedulings: userSchedulings.filter(s => s.active).length,
      push_enabled: userSchedulings.filter(s => s.notifications.push_enabled).length,
      daily_summary_enabled: userSchedulings.filter(s => s.notifications.daily_summary).length,
      special_alerts_enabled: userSchedulings.filter(s => s.notifications.special_alerts).length,
      avg_advance_hours: userSchedulings.length > 0 
        ? userSchedulings.reduce((sum, s) => sum + s.notifications.advance_hours, 0) / userSchedulings.length
        : 0
    };

    res.json({
      stats,
      generated_at: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error getting user notification stats');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * POST /api/notifications/simulate-window
 * Simula uma janela boa para testar notificações
 */
router.post('/simulate-window', requireAuth, async (req, res) => {
  try {
    const { scheduling_id, window_score = 85, spot_name = 'Pico Teste' } = req.body;

    if (!scheduling_id) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'ID do agendamento é obrigatório'
      });
    }

    // Criar janela simulada
    const simulatedWindow = {
      start: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min no futuro
      end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3h de duração
      avg_score: window_score,
      peak_score: window_score + 5,
      duration_hours: 3,
      description: `${(Math.random() * 2 + 0.5).toFixed(1)}m, ${Math.floor(Math.random() * 5 + 10)}s, offshore ${Math.floor(Math.random() * 10 + 10)}km/h`,
      quality_rating: window_score >= 90 ? 'épico' : window_score >= 80 ? 'excelente' : 'bom',
      best_hour: {
        time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        score: window_score,
        swell_height: Math.random() * 2 + 0.5,
        wind_speed: Math.random() * 15 + 5
      }
    };

    // Criar notificação simulada
    const notification = {
      id: `sim_${scheduling_id}_${Date.now()}`,
      type: 'window_alert',
      scheduling_id,
      uid: req.user.uid,
      title: `${window_score >= 90 ? '🔥' : '⭐'} Janela simulada em ${spot_name}!`,
      body: `Teste - ${simulatedWindow.description}`,
      data: {
        spot_name,
        window_start: simulatedWindow.start,
        window_score: simulatedWindow.avg_score,
        is_simulation: true
      },
      priority: window_score >= 80 ? 'high' : 'normal',
      created_at: new Date(),
      scheduled_for: new Date()
    };

    const success = await sendPushNotification(notification);

    res.json({
      success,
      simulated_window: simulatedWindow,
      notification,
      message: 'Janela simulada e notificação enviada'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error simulating window notification');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

export default router;
