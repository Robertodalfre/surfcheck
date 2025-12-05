import { analyzeWindows } from './window-analysis.service.js';
import { getSchedulingById, getActiveSchedulings } from '../domain/scheduling.model.js';
import { analyzeRegion } from './multi-spot-analysis.service.js';
import { getFirestore } from '../services/firebase.service.js';
import admin from 'firebase-admin';
import logger from '../utils/logger.js';

async function getUserTokens(uid) {
  try {
    const db = getFirestore();
    const docRef = db.collection('user_devices').doc(uid);
    const doc = await docRef.get();
    if (!doc.exists) return [];
    const data = doc.data() || {};
    return Array.isArray(data.tokens) ? data.tokens.filter(Boolean) : [];
  } catch (e) {
    logger.warn({ error: e.message, uid }, 'failed to get user tokens');
    return [];
  }
}
/**
 * Cria notificação de comparação regional (Top 3 spots)
 * @param {Object} params
 * @param {Object} params.multi - documento do multi_scheduling
 * @param {Object} params.analysis - retorno de analyzeRegion
 */
export function createRegionComparisonNotification({ multi, analysis }) {
  if (!analysis || analysis.status !== 'success' || !analysis.ranking?.length) return null;

  const top = analysis.ranking.slice(0, 3);
  const best = top[0];

  const scoreBest = Math.round(best.avg_score || best.peak_score || 0);
  const timeStr = best?.best_hour?.time
    ? new Date(best.best_hour.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--';

  const title = `🥇 Melhor pico agora: ${best.spot_name}`;
  const body = `Score ${scoreBest} às ${timeStr}\n` +
    top.map((s, i) => {
      const sc = Math.round(s.avg_score || s.peak_score || 0);
      const name = s.spot_name;
      return i === 0 ? `${name}: ${sc}` : `${name}: ${sc}`;
    }).join(' • ');

  return {
    id: `region_${multi.id}_${Date.now()}`,
    type: 'region_comparison',
    uid: multi.uid,
    title,
    body,
    data: {
      multi_id: multi.id,
      region: multi.region,
      region_name: multi.regionName,
      best_spot: best.spot_id,
      best_spot_name: best.spot_name,
      ranking: top
    },
    priority: scoreBest >= 80 ? 'high' : 'normal',
    created_at: new Date(),
    scheduled_for: new Date()
  };
}

/**
 * Gera notificação regional para um multi-scheduling
 */
export async function generateRegionComparisonForMulti(multi) {
  const analysis = await analyzeRegion({
    regionId: multi.region,
    preferences: multi.preferences || {},
    onlySpots: multi.spots,
    limit: 3
  });
  const notification = createRegionComparisonNotification({ multi, analysis });
  return notification;
}

/**
 * Processa e envia notificações regionais para todos os multi-schedulings ativos
 */
export async function processRegionComparisonNotifications() {
  const db = getFirestore();
  const snap = await db.collection('multi_schedulings').where('active', '==', true).get();
  const results = [];
  for (const doc of snap.docs) {
    const multi = { id: doc.id, ...doc.data() };
    try {
      const n = await generateRegionComparisonForMulti(multi);
      if (n) {
        const ok = await sendPushNotification(n);
        results.push({ multi_id: multi.id, ok });
      }
    } catch (e) {
      results.push({ multi_id: multi.id, ok: false, error: e.message });
    }
  }
  return results;
}

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
    const scheduling = await getSchedulingById(schedulingId);
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
        const notification = await createWindowNotification(scheduling, window, analysis.spot);
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
 * Cria notificação usando dados reais do next_day_forecast
 * @param {Object} scheduling - Agendamento com next_day_forecast
 * @param {Object} spot - Dados do pico
 * @returns {Object} Notificação formatada com dados reais
 */
export function createNextDayForecastNotification(scheduling, spot) {
  if (!scheduling.next_day_forecast || !scheduling.next_day_forecast.best_window) {
    return null;
  }

  const forecast = scheduling.next_day_forecast.best_window;
  const styleEmoji = getStyleEmoji(scheduling.preferences.surf_style);
  const qualityEmoji = getQualityEmoji(forecast.score);

  // Criar título com score e condições
  const title = `${styleEmoji} Score ${(forecast.score / 10).toFixed(1)} - ${forecast.conditions_summary} - BEST TIME ${forecast.time} hrs`;
  
  // Criar corpo com dados técnicos reais
  const body = `${forecast.swell_height}m, ${forecast.swell_period}s, ${forecast.swell_direction_text} ${forecast.wind_speed}km/h - Energia: ${forecast.power_kwm.toFixed(1)} kW/m`;

  return {
    id: `forecast_${scheduling.id}_${forecast.date}`,
    type: 'next_day_forecast',
    scheduling_id: scheduling.id,
    uid: scheduling.uid,
    title,
    body,
    data: {
      spot_id: spot.id,
      spot_name: spot.name,
      forecast_date: forecast.date,
      best_time: forecast.time,
      score: forecast.score,
      swell_height: forecast.swell_height,
      swell_direction_text: forecast.swell_direction_text,
      swell_period: forecast.swell_period,
      wind_speed: forecast.wind_speed,
      power_kwm: forecast.power_kwm,
      conditions_summary: forecast.conditions_summary
    },
    priority: forecast.score >= 80 ? 'high' : 'normal',
    created_at: new Date(),
    scheduled_for: new Date(Date.now() + 5000) // 5 segundos para teste
  };
}

/**
 * Cria notificação para uma janela específica usando SEMPRE o novo formato
 * @param {Object} scheduling - Agendamento
 * @param {Object} window - Janela de surf
 * @param {Object} spot - Dados do pico
 * @returns {Object} Notificação formatada
 */
async function createWindowNotification(scheduling, window, spot) {
  // Tentar usar dados do next_day_forecast primeiro
  if (scheduling.next_day_forecast) {
    return createNextDayForecastNotification(scheduling, spot);
  }

  // Se não tem forecast salvo, criar dados na hora usando a janela atual
  return await createNotificationFromWindow(scheduling, window, spot);
}

/**
 * Cria notificação usando dados da janela atual (formato novo)
 * @param {Object} scheduling - Agendamento
 * @param {Object} window - Janela de surf
 * @param {Object} spot - Dados do pico
 * @returns {Object} Notificação formatada no novo padrão
 */
async function createNotificationFromWindow(scheduling, window, spot) {
  const { directionToText } = await import('../utils/angles.js');
  
  // Extrair melhor horário da janela
  const bestHour = window.best_hour || {
    time: window.start,
    score: window.avg_score || window.peak_score || 70,
    swell_height: 1.5,
    swell_direction: 180,
    swell_period: 12,
    wind_speed: 15,
    wind_direction: 225,
    energy_jpm2: 4.2,
    power_kwm: 4.2
  };

  const bestTime = new Date(bestHour.time);
  const timeStr = bestTime.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  // Dados da notificação no novo formato
  const score = bestHour.score || window.avg_score || 70;
  const swellHeight = bestHour.swell_height || 1.5;
  const swellPeriod = bestHour.swell_period || 12;
  const swellDirection = bestHour.swell_direction || 180;
  const swellDirectionText = directionToText(swellDirection);
  const windSpeed = bestHour.wind_speed || 15;
  const powerKwm = bestHour.power_kwm || bestHour.energy_jpm2 || 4.2;
  
  // Gerar conditions_summary baseado no score
  const conditionsSummary = score >= 80 ? 'boas condições' : score >= 60 ? 'condições ok' : 'condições fracas';
  
  const styleEmoji = getStyleEmoji(scheduling.preferences.surf_style);

  // Título no novo formato
  const title = `${styleEmoji} Score ${(score / 10).toFixed(1)} - ${conditionsSummary} - BEST TIME ${timeStr} hrs`;
  
  // Corpo no novo formato (SEM "offshore")
  const body = `${swellHeight.toFixed(1)}m, ${swellPeriod}s, ${swellDirectionText} ${windSpeed}km/h - Energia: ${powerKwm.toFixed(1)} kW/m`;

  return {
    id: `forecast_${scheduling.id}_${Date.now()}`,
    type: 'next_day_forecast_live',
    scheduling_id: scheduling.id,
    uid: scheduling.uid,
    title,
    body,
    data: {
      spot_id: spot.id,
      spot_name: spot.name,
      forecast_date: bestTime.toISOString().split('T')[0],
      best_time: timeStr,
      score: score,
      swell_height: swellHeight,
      swell_direction_text: swellDirectionText,
      swell_period: swellPeriod,
      wind_speed: windSpeed,
      power_kwm: powerKwm,
      conditions_summary: conditionsSummary
    },
    priority: score >= 80 ? 'high' : 'normal',
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
    const tokens = await getUserTokens(notification.uid);
    if (!tokens.length) {
      logger.info({ uid: notification.uid }, 'no device tokens found, skipping push');
      return false;
    }

    const data = {};
    if (notification.data) {
      for (const [k, v] of Object.entries(notification.data)) {
        data[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }
    }

    const message = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data,
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png'
        },
        fcmOptions: {
          link: 'https://surfcheck.com.br/'
        }
      }
    };

    logger.info({ uid: notification.uid, tokens_count: tokens.length }, 'sending fcm multicast');
    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info({ successCount: response.successCount, failureCount: response.failureCount, uid: notification.uid }, 'fcm send result');

    // Limpeza de tokens inválidos
    if (response.failureCount > 0) {
      const invalidIdx = [];
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code || '';
          if (
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-registration-token')
          ) {
            invalidIdx.push(idx);
          }
        }
      });
      if (invalidIdx.length) {
        try {
          const toRemove = new Set(invalidIdx.map(i => tokens[i]));
          const db = getFirestore();
          const ref = db.collection('user_devices').doc(notification.uid);
          const snap = await ref.get();
          const existing = snap.exists ? (snap.data().tokens || []) : [];
          const filtered = existing.filter((t) => !toRemove.has(t));
          await ref.set({ tokens: filtered, updated_at: new Date() }, { merge: true });
          logger.info({ removed: toRemove.size }, 'cleaned invalid fcm tokens');
        } catch (e) {
          logger.warn({ error: (e && e.message) || String(e) }, 'failed to cleanup invalid tokens');
        }
      }
    }

    return response.successCount > 0;
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

export async function processFixedTimeNotifications(testTime = null) {
  try {
    const schedulings = await getActiveSchedulings();
    const now = new Date();
    const results = [];

    for (const s of schedulings) {
      const fixed = s.notifications && s.notifications.fixed_time;
      if (!fixed) continue;
      const tz = (s.notifications && s.notifications.timezone) || 'America/Sao_Paulo';
      let current;
      if (testTime) {
        current = testTime;
      } else {
        const formatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
        const parts = formatter.formatToParts(now);
        const hh = parts.find(p => p.type === 'hour')?.value || '00';
        const mm = parts.find(p => p.type === 'minute')?.value || '00';
        current = `${hh}:${mm}`;
      }
      
      logger.info({ 
        scheduling_id: s.id, 
        fixed_time: fixed, 
        timezone: tz, 
        current_time: current,
        match: current === fixed
      }, 'checking fixed-time notification');
      
      if (current !== fixed) continue;

      // Preferir sempre o novo formato baseado em next_day_forecast
      let title;
      let body;
      let data = { scheduling_id: s.id };

      if (s.next_day_forecast && s.next_day_forecast.best_window) {
        const f = s.next_day_forecast.best_window;

        const styleEmoji = getStyleEmoji(s.preferences?.surf_style || ['any']);
        const score = f.score || 0;
        const scoreDisplay = (score / 10).toFixed(1);
        const conditions = f.conditions_summary || 'boas condições';
        const time = f.time || '07:00';

        const swellHeight = f.swell_height ?? 0;
        const swellPeriod = f.swell_period ?? 0;
        const swellDirText = f.swell_direction_text || 'S';
        const windSpeed = f.wind_speed ?? 0;
        const powerKwm = f.power_kwm ?? 0;

        title = `${styleEmoji} Score ${scoreDisplay} - ${conditions} - BEST TIME ${time} hrs`;
        body = `${swellHeight.toFixed(1)}m, ${swellPeriod}s, ${swellDirText} ${windSpeed}km/h - Energia: ${powerKwm.toFixed(1)} kW/m`;

        data = {
          ...data,
          forecast_date: f.date,
          best_time: time,
          score,
          swell_height: swellHeight,
          swell_direction_text: swellDirText,
          swell_period: swellPeriod,
          wind_speed: windSpeed,
          power_kwm: powerKwm,
          conditions_summary: conditions
        };
      } else {
        // Fallback antigo, caso ainda não exista forecast salvo
        title = '⏰ Lembrete SurfCheck';
        body = 'Seu lembrete diário está ativo. Abra para ver as melhores janelas!';
      }

      const n = {
        id: `fixed_${s.id}_${now.toISOString().slice(0,16)}`,
        type: 'fixed_time',
        scheduling_id: s.id,
        uid: s.uid,
        title,
        body,
        data,
        priority: 'normal',
        created_at: new Date(),
        scheduled_for: new Date()
      };
      const ok = await sendPushNotification(n);
      results.push({ scheduling_id: s.id, ok });
    }

    logger.info({ triggered: results.length }, 'processed fixed-time notifications');
    return results;
  } catch (e) {
    logger.error({ error: e.message }, 'failed to process fixed-time notifications');
    return [];
  }
}
