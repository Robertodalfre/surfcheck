import { analyzeWindows } from './window-analysis.service.js';
import { getSchedulingById, getActiveSchedulings } from '../domain/scheduling.model.js';
import logger from '../utils/logger.js';

/**
 * Serviço de notificações inteligentes para agendamentos de surf
 */

/**
 * Gera notificações para um agendamento específico
 * @param {string} schedulingId - ID do agendamento
 * @returns {Promise<Object[]>} Lista de notificações geradas
 */
export async function generateNotificationsForScheduling(schedulingId) {
  try {
    const scheduling = getSchedulingById(schedulingId);
    if (!scheduling || !scheduling.active) {
      return [];
    }

    // Analisar janelas
    const analysis = await analyzeWindows(scheduling);
    if (analysis.status !== 'success' || !analysis.next_good_windows.length) {
      return [];
    }

    const notifications = [];
    const now = new Date();

    // Processar cada janela boa
    for (const window of analysis.next_good_windows) {
      const windowStart = new Date(window.start);
      const hoursUntilWindow = (windowStart - now) / (1000 * 60 * 60);

      // Verificar se está dentro do prazo de antecedência configurado
      if (hoursUntilWindow > 0 && hoursUntilWindow <= scheduling.notifications.advance_hours) {
        const notification = createWindowNotification(scheduling, window, analysis.spot);
        notifications.push(notification);
      }

      // Alerta especial para scores muito altos
      if (scheduling.notifications.special_alerts && window.peak_score >= 90) {
        const specialNotification = createSpecialAlertNotification(scheduling, window, analysis.spot);
        notifications.push(specialNotification);
      }
    }

    return notifications;
  } catch (error) {
    logger.error({ 
      error: error.message, 
      scheduling_id: schedulingId 
    }, 'failed to generate notifications');
    return [];
  }
}

/**
 * Gera resumo diário para um usuário
 * @param {string} uid - ID do usuário
 * @returns {Promise<Object|null>} Resumo diário ou null
 */
export async function generateDailySummary(uid) {
  try {
    const userSchedulings = getActiveSchedulings().filter(s => s.uid === uid);
    if (!userSchedulings.length) {
      return null;
    }

    const allWindows = [];
    const spotAnalysis = {};

    // Analisar todos os agendamentos do usuário
    for (const scheduling of userSchedulings) {
      if (!scheduling.notifications.daily_summary) continue;

      const analysis = await analyzeWindows(scheduling);
      if (analysis.status === 'success' && analysis.windows.length > 0) {
        spotAnalysis[scheduling.spot_id] = {
          spot: analysis.spot,
          windows: analysis.windows.slice(0, 3), // Top 3
          preferences: scheduling.preferences
        };
        allWindows.push(...analysis.windows.map(w => ({ ...w, spot: analysis.spot })));
      }
    }

    if (Object.keys(spotAnalysis).length === 0) {
      return createNoGoodWindowsSummary(uid);
    }

    // Selecionar top 3 janelas do dia
    const topWindows = allWindows
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 3);

    return createDailySummaryNotification(uid, topWindows, spotAnalysis);
  } catch (error) {
    logger.error({ error: error.message, uid }, 'failed to generate daily summary');
    return null;
  }
}

/**
 * Processa notificações para todos os agendamentos ativos
 * @returns {Promise<Object[]>} Lista de todas as notificações geradas
 */
export async function processAllNotifications() {
  try {
    const activeSchedulings = getActiveSchedulings();
    const allNotifications = [];

    for (const scheduling of activeSchedulings) {
      if (!scheduling.notifications.push_enabled) continue;

      const notifications = await generateNotificationsForScheduling(scheduling.id);
      allNotifications.push(...notifications);
    }

    logger.info({ 
      total_schedulings: activeSchedulings.length,
      notifications_generated: allNotifications.length 
    }, 'processed all notifications');

    return allNotifications;
  } catch (error) {
    logger.error({ error: error.message }, 'failed to process all notifications');
    return [];
  }
}

/**
 * Cria notificação para uma janela específica
 * @param {Object} scheduling - Agendamento
 * @param {Object} window - Janela de surf
 * @param {Object} spot - Dados do pico
 * @returns {Object} Notificação formatada
 */
function createWindowNotification(scheduling, window, spot) {
  const windowStart = new Date(window.start);
  const timeStr = windowStart.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const dateStr = windowStart.toLocaleDateString('pt-BR', { 
    weekday: 'short', 
    day: '2-digit', 
    month: '2-digit' 
  });

  // Personalizar mensagem baseado no estilo
  const styleEmoji = getStyleEmoji(scheduling.preferences.surf_style);
  const qualityEmoji = getQualityEmoji(window.avg_score);

  const title = `${qualityEmoji} Janela boa em ${spot.name}!`;
  const body = `${dateStr} às ${timeStr} - ${window.description} ${styleEmoji}`;

  return {
    id: `window_${scheduling.id}_${window.start}`,
    type: 'window_alert',
    scheduling_id: scheduling.id,
    uid: scheduling.uid,
    title,
    body,
    data: {
      spot_id: spot.id,
      spot_name: spot.name,
      window_start: window.start,
      window_score: window.avg_score,
      window_duration: window.duration_hours,
      best_hour: window.best_hour
    },
    priority: window.avg_score >= 80 ? 'high' : 'normal',
    created_at: new Date(),
    scheduled_for: new Date(Date.now() + 5000) // 5 segundos para teste
  };
}

/**
 * Cria alerta especial para scores muito altos
 * @param {Object} scheduling - Agendamento
 * @param {Object} window - Janela de surf
 * @param {Object} spot - Dados do pico
 * @returns {Object} Notificação especial
 */
function createSpecialAlertNotification(scheduling, window, spot) {
  const windowStart = new Date(window.start);
  const dateStr = windowStart.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: '2-digit', 
    month: '2-digit' 
  });

  return {
    id: `special_${scheduling.id}_${window.start}`,
    type: 'special_alert',
    scheduling_id: scheduling.id,
    uid: scheduling.uid,
    title: `🔥 ÉPICO em ${spot.name}!`,
    body: `${dateStr} - Score ${Math.round(window.peak_score)}! ${window.description}`,
    data: {
      spot_id: spot.id,
      spot_name: spot.name,
      window_start: window.start,
      peak_score: window.peak_score,
      is_epic: true
    },
    priority: 'high',
    created_at: new Date(),
    scheduled_for: new Date(Date.now() + 2000) // 2 segundos para teste
  };
}

/**
 * Cria resumo diário
 * @param {string} uid - ID do usuário
 * @param {Array} topWindows - Melhores janelas
 * @param {Object} spotAnalysis - Análise por pico
 * @returns {Object} Notificação de resumo
 */
function createDailySummaryNotification(uid, topWindows, spotAnalysis) {
  const spotsCount = Object.keys(spotAnalysis).length;
  const totalWindows = Object.values(spotAnalysis).reduce((sum, s) => sum + s.windows.length, 0);
  
  let title = `🌊 Bom dia! ${totalWindows} janelas em ${spotsCount} picos`;
  let body = '';

  if (topWindows.length > 0) {
    const bestWindow = topWindows[0];
    const bestTime = new Date(bestWindow.start).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    body = `Melhor: ${bestWindow.spot.name} às ${bestTime} (${Math.round(bestWindow.avg_score)})`;
  }

  return {
    id: `daily_${uid}_${new Date().toISOString().split('T')[0]}`,
    type: 'daily_summary',
    uid,
    title,
    body,
    data: {
      spots_count: spotsCount,
      total_windows: totalWindows,
      top_windows: topWindows.slice(0, 3),
      spot_analysis: spotAnalysis
    },
    priority: 'normal',
    created_at: new Date(),
    scheduled_for: new Date() // Enviar imediatamente
  };
}

/**
 * Cria resumo quando não há janelas boas
 * @param {string} uid - ID do usuário
 * @returns {Object} Notificação de resumo
 */
function createNoGoodWindowsSummary(uid) {
  return {
    id: `daily_empty_${uid}_${new Date().toISOString().split('T')[0]}`,
    type: 'daily_summary',
    uid,
    title: '🌊 Bom dia!',
    body: 'Nenhuma janela boa hoje. Que tal ajustar suas preferências?',
    data: {
      spots_count: 0,
      total_windows: 0,
      suggestion: 'lower_criteria'
    },
    priority: 'low',
    created_at: new Date(),
    scheduled_for: new Date()
  };
}

/**
 * Retorna emoji baseado no estilo de surf
 * @param {string} surfStyle - Estilo de surf
 * @returns {string} Emoji
 */
function getStyleEmoji(surfStyle) {
  switch (surfStyle) {
    case 'longboard': return '🏄‍♂️';
    case 'shortboard': return '🏄';
    default: return '🤙';
  }
}

/**
 * Retorna emoji baseado na qualidade
 * @param {number} score - Score da janela
 * @returns {string} Emoji
 */
function getQualityEmoji(score) {
  if (score >= 90) return '🔥';
  if (score >= 80) return '⭐';
  if (score >= 70) return '👍';
  if (score >= 60) return '👌';
  return '🌊';
}

/**
 * Simula envio de notificação push (para desenvolvimento)
 * @param {Object} notification - Notificação a ser enviada
 * @returns {Promise<boolean>} Sucesso do envio
 */
export async function sendPushNotification(notification) {
  try {
    // Em produção, aqui seria a integração com Firebase Cloud Messaging
    logger.info({
      notification_id: notification.id,
      type: notification.type,
      uid: notification.uid,
      title: notification.title
    }, 'push notification sent (simulated)');

    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return true;
  } catch (error) {
    logger.error({ 
      error: error.message, 
      notification_id: notification.id 
    }, 'failed to send push notification');
    return false;
  }
}

/**
 * Agenda processamento de notificações (cron job simulado)
 * @param {number} intervalMinutes - Intervalo em minutos
 * @returns {Function} Função para parar o agendamento
 */
export function scheduleNotificationProcessing(intervalMinutes = 30) {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  const processAndSend = async () => {
    try {
      const notifications = await processAllNotifications();
      
      for (const notification of notifications) {
        const now = new Date();
        if (notification.scheduled_for <= now) {
          await sendPushNotification(notification);
        }
      }
    } catch (error) {
      logger.error({ error: error.message }, 'scheduled notification processing failed');
    }
  };

  // Executar imediatamente e depois a cada intervalo
  processAndSend();
  const intervalId = setInterval(processAndSend, intervalMs);

  logger.info({ interval_minutes: intervalMinutes }, 'notification processing scheduled');

  // Retornar função para parar
  return () => {
    clearInterval(intervalId);
    logger.info('notification processing stopped');
  };
}
