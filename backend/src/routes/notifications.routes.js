import { Router } from 'express';
import {
  generateNotificationsForScheduling,
  generateDailySummary,
  processAllNotifications,
  processFixedTimeNotifications,
  sendPushNotification,
  processRegionComparisonNotifications,
  generateRegionComparisonForMulti
} from '../services/notification.service.js';
import { getFirestore } from '../services/firebase.service.js';
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
 * POST /api/notifications/test-region-comparison
 * Gera e envia uma notificação comparativa para um multi-scheduling específico
 */
router.post('/test-region-comparison', requireAuth, async (req, res) => {
  try {
    const { multi_id } = req.body || {};
    if (!multi_id) {
      return res.status(400).json({ error: 'validation_error', message: 'multi_id é obrigatório' });
    }

    const { getMultiSchedulingById } = await import('../domain/multi-scheduling.model.js');
    const multi = await getMultiSchedulingById(multi_id);
    if (!multi || multi.uid !== req.user.uid) {
      return res.status(404).json({ error: 'not_found', message: 'Agendamento multi-pico não encontrado' });
    }

    const notification = await generateRegionComparisonForMulti(multi);
    if (!notification) {
      return res.status(400).json({ error: 'no_notification', message: 'Nenhum ranking disponível para notificar' });
    }

    const success = await sendPushNotification(notification);
    res.json({ success, notification });
  } catch (error) {
    logger.error({ error: error.message }, 'error testing region comparison notification');
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * POST /api/notifications/run-region-cron
 * Processa e envia notificações comparativas para todos os multi-schedulings ativos (Top 3)
 */
router.post('/run-region-cron', requireAuth, async (req, res) => {
  try {
    const results = await processRegionComparisonNotifications();
    const sent = results.filter(r => r.ok).length;
    res.json({ processed: results.length, sent, results });
  } catch (error) {
    logger.error({ error: error.message }, 'error running region comparison cron');
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

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
 * POST /api/notifications/register-token
 * Registra/atualiza o token FCM do usuário
 */
router.post('/register-token', requireAuth, async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'validation_error', message: 'token é obrigatório' });
    }

    const db = getFirestore();
    const ref = db.collection('user_devices').doc(req.user.uid);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data().tokens || []) : [];
    const tokens = Array.from(new Set([ ...existing, token ].filter(Boolean)));

    await ref.set({
      tokens,
      platform,
      updated_at: new Date()
    }, { merge: true });

    res.json({ success: true, tokens_count: tokens.length });
  } catch (error) {
    logger.error({ error: error.message }, 'error registering device token');
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * POST /api/notifications/run-cron
 * Executa manualmente o processamento periódico (debug)
 */
router.post('/run-cron', requireAuth, async (req, res) => {
  try {
    // Processar notificações baseadas em janelas de surf
    const notifications = await processAllNotifications();
    let sent = 0;
    for (const n of notifications) {
      const ok = await sendPushNotification(n);
      if (ok) sent++;
    }
    
    // Processar notificações de horário fixo
    const fixedResults = await processFixedTimeNotifications();
    const fixedSent = fixedResults.filter(r => r.ok).length;
    
    res.json({ 
      generated: notifications.length, 
      sent,
      fixed_time_triggered: fixedResults.length,
      fixed_time_sent: fixedSent
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error running notifications cron');
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * POST /api/notifications/test-fixed-time
 * Testa especificamente notificações de horário fixo (debug)
 */
router.post('/test-fixed-time', requireAuth, async (req, res) => {
  try {
    // Permitir override do horário para teste
    const testTime = req.body.test_time; // formato HH:mm
    const results = await processFixedTimeNotifications(testTime);
    const sent = results.filter(r => r.ok).length;
    
    res.json({ 
      triggered: results.length,
      sent,
      results,
      test_time: testTime || 'current_time'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error testing fixed-time notifications');
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * GET /api/notifications/debug-schedulings
 * Lista agendamentos ativos para debug
 */
router.get('/debug-schedulings', requireAuth, async (req, res) => {
  try {
    const { getActiveSchedulings } = await import('../domain/scheduling.model.js');
    const schedulings = await getActiveSchedulings();
    
    const debugInfo = schedulings.map(s => ({
      id: s.id,
      uid: s.uid,
      active: s.active,
      notifications: s.notifications,
      has_fixed_time: !!(s.notifications && s.notifications.fixed_time)
    }));
    
    res.json({ 
      total: schedulings.length,
      schedulings: debugInfo
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error debugging schedulings');
    res.status(500).json({ error: 'internal_error', message: error.message });
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

    // Criar notificação simulada com novo formato
    const styleEmoji = '🏄‍♂️'; // Default para simulação
    const swellHeight = (Math.random() * 1.5 + 0.5).toFixed(1);
    const swellPeriod = Math.floor(Math.random() * 5 + 10);
    const swellDirection = ['S', 'SSE', 'SE', 'ESE', 'E'][Math.floor(Math.random() * 5)];
    const windSpeed = Math.floor(Math.random() * 15 + 5);
    const powerKwm = (Math.random() * 3 + 2).toFixed(1);
    const conditionsSummary = window_score >= 80 ? 'boas condições de manhã' : 'condições ok de manhã';
    
    const notification = {
      id: `sim_${scheduling_id}_${Date.now()}`,
      type: 'next_day_forecast_simulation',
      scheduling_id,
      uid: req.user.uid,
      title: `${styleEmoji} Score ${(window_score / 10).toFixed(1)} - ${conditionsSummary} - BEST TIME 07:00 hrs`,
      body: `${swellHeight}m, ${swellPeriod}s, ${swellDirection} ${windSpeed}km/h - Energia: ${powerKwm} kW/m`,
      data: {
        spot_name,
        forecast_date: new Date().toISOString().split('T')[0],
        best_time: '07:00',
        score: window_score,
        swell_height: parseFloat(swellHeight),
        swell_direction_text: swellDirection,
        swell_period: swellPeriod,
        wind_speed: windSpeed,
        power_kwm: parseFloat(powerKwm),
        conditions_summary: conditionsSummary,
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

/**
 * POST /api/notifications/test-real-forecast
 * Testa notificação usando dados reais do next_day_forecast
 */
router.post('/test-real-forecast', requireAuth, async (req, res) => {
  try {
    const { scheduling_id } = req.body;

    if (!scheduling_id) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'ID do agendamento é obrigatório'
      });
    }

    // Buscar agendamento com forecast
    const { getSchedulingById } = await import('../domain/scheduling.model.js');
    const scheduling = await getSchedulingById(scheduling_id);
    
    if (!scheduling) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Agendamento não encontrado'
      });
    }

    if (!scheduling.next_day_forecast) {
      return res.status(400).json({
        error: 'no_forecast',
        message: 'Agendamento não possui dados de forecast. Execute a análise primeiro.'
      });
    }

    // Buscar dados do spot
    const { getSpotById } = await import('../domain/spots.model.js');
    const spot = getSpotById(scheduling.spot_id);
    
    if (!spot) {
      return res.status(404).json({
        error: 'spot_not_found',
        message: 'Pico não encontrado'
      });
    }

    // Criar notificação usando dados reais
    const { createNextDayForecastNotification } = await import('../services/notification.service.js');
    const notification = createNextDayForecastNotification(scheduling, spot);
    
    if (!notification) {
      return res.status(400).json({
        error: 'notification_creation_failed',
        message: 'Falha ao criar notificação com dados do forecast'
      });
    }

    // Enviar notificação
    const success = await sendPushNotification(notification);

    res.json({
      success,
      scheduling_id,
      spot_name: spot.name,
      forecast_data: scheduling.next_day_forecast,
      notification,
      message: success ? 'Notificação com dados reais enviada!' : 'Falha ao enviar notificação'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error testing real forecast notification');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * POST /api/notifications/update-forecasts
 * Executa manualmente a atualização de forecasts (debug/admin)
 */
router.post('/update-forecasts', requireAuth, async (req, res) => {
  try {
    logger.info({ uid: req.user.uid }, 'manual forecast update triggered');
    
    const { updateAllNextDayForecasts } = await import('../domain/scheduling.model.js');
    const results = await updateAllNextDayForecasts();
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const failures = results.filter(r => !r.success);
    
    res.json({
      success: true,
      total_schedulings: totalCount,
      successful_updates: successCount,
      failed_updates: totalCount - successCount,
      success_rate: totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) + '%' : '0%',
      results: results.map(r => ({
        scheduling_id: r.scheduling_id,
        success: r.success,
        best_time: r.forecast?.best_window?.time,
        score: r.forecast?.best_window?.score,
        error: r.error
      })),
      failures: failures.length > 0 ? failures : undefined,
      message: `Forecast update completed: ${successCount}/${totalCount} successful`,
      triggered_at: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error in manual forecast update');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

/**
 * POST /api/notifications/test-immediate
 * Testa notificação imediata para um agendamento (sem aguardar horário)
 */
router.post('/test-immediate', requireAuth, async (req, res) => {
  try {
    const { scheduling_id } = req.body;

    if (!scheduling_id) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'ID do agendamento é obrigatório'
      });
    }

    // Buscar agendamento
    const { getSchedulingById } = await import('../domain/scheduling.model.js');
    const scheduling = await getSchedulingById(scheduling_id);
    
    if (!scheduling) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Agendamento não encontrado'
      });
    }

    // Gerar notificações para o agendamento
    const { generateNotificationsForScheduling } = await import('../services/notification.service.js');
    const notifications = await generateNotificationsForScheduling(scheduling_id);
    
    if (!notifications.length) {
      return res.status(400).json({
        error: 'no_notifications',
        message: 'Nenhuma notificação gerada. Verifique se há janelas boas nas próximas horas.'
      });
    }

    // Enviar a primeira notificação imediatamente
    const notification = notifications[0];
    notification.scheduled_for = new Date(); // Enviar agora
    
    const success = await sendPushNotification(notification);

    res.json({
      success,
      scheduling_id,
      notification,
      total_notifications: notifications.length,
      message: success ? 'Notificação enviada imediatamente!' : 'Falha ao enviar notificação'
    });
  } catch (error) {
    logger.error({ error: error.message }, 'error testing immediate notification');
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

export default router;
