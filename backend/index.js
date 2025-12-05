import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import express from 'express';
import app from './src/app.js';
import { processAllNotifications, sendPushNotification, processFixedTimeNotifications, processRegionComparisonNotifications } from './src/services/notification.service.js';
import { updateAllNextDayForecasts } from './src/domain/scheduling.model.js';
import logger from './src/utils/logger.js';

// Monta o app tanto na raiz quanto sob /api (compatibilidade)
const router = express();
router.use(app);
router.use('/api', app);

const STORMGLASS_API_KEY = defineSecret('STORMGLASS_API_KEY');
export const api = onRequest({ region: 'southamerica-east1', cors: true, secrets: [STORMGLASS_API_KEY] }, router);

// Cron: processar notificações de janelas a cada 15 minutos
export const notificationsCron15 = onSchedule({
  region: 'southamerica-east1',
  schedule: 'every 15 minutes',
  timeZone: 'America/Sao_Paulo'
}, async (event) => {
  try {
    const notifications = await processAllNotifications();
    let sent = 0;
    for (const n of notifications) {
      if (n.scheduled_for && new Date(n.scheduled_for) > new Date()) continue;
      const ok = await sendPushNotification(n);
      if (ok) sent++;
    }
    logger.info({ generated: notifications.length, sent }, 'cron(15m) notifications processed');
  } catch (e) {
    logger.error({ error: e.message }, 'cron(15m) failed');
  }
});

// Cron: notificações comparativas regionais 2x/dia (06:00 e 18:00)
export const regionComparisonMorning = onSchedule({
  region: 'southamerica-east1',
  schedule: '0 6 * * *', // 06:00 todos os dias
  timeZone: 'America/Sao_Paulo'
}, async () => {
  try {
    const results = await processRegionComparisonNotifications();
    const sent = results.filter(r => r.ok).length;
    logger.info({ processed: results.length, sent }, 'region comparison notifications (06:00) processed');
  } catch (e) {
    logger.error({ error: e.message }, 'region comparison (06:00) failed');
  }
});

export const regionComparisonEvening = onSchedule({
  region: 'southamerica-east1',
  schedule: '0 18 * * *', // 18:00 todos os dias
  timeZone: 'America/Sao_Paulo'
}, async () => {
  try {
    const results = await processRegionComparisonNotifications();
    const sent = results.filter(r => r.ok).length;
    logger.info({ processed: results.length, sent }, 'region comparison notifications (18:00) processed');
  } catch (e) {
    logger.error({ error: e.message }, 'region comparison (18:00) failed');
  }
});

// Cron: processar lembretes de horário fixo a cada 1 minuto
export const notificationsFixedEveryMinute = onSchedule({
  region: 'southamerica-east1',
  schedule: 'every 1 minutes',
  timeZone: 'America/Sao_Paulo'
}, async (event) => {
  try {
    await processFixedTimeNotifications();
  } catch (e) {
    logger.error({ error: e.message }, 'cron(1m) fixed-time failed');
  }
});

// Cron: atualizar forecast do próximo dia todos os dias às 22h
export const updateForecastsDaily = onSchedule({
  region: 'southamerica-east1',
  schedule: '0 22 * * *', // Todos os dias às 22:00
  timeZone: 'America/Sao_Paulo'
}, async (event) => {
  try {
    logger.info('starting daily forecast update at 22:00');
    
    const results = await updateAllNextDayForecasts();
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    logger.info({
      total_schedulings: totalCount,
      successful_updates: successCount,
      failed_updates: totalCount - successCount,
      success_rate: totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) + '%' : '0%'
    }, 'daily forecast update completed');
    
    // Log detalhes dos erros se houver
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      logger.warn({
        failed_schedulings: failures.map(f => ({
          scheduling_id: f.scheduling_id,
          error: f.error
        }))
      }, 'some forecast updates failed');
    }
    
  } catch (e) {
    logger.error({ error: e.message }, 'daily forecast update failed');
  }
});
