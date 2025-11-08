import { getSchedulingsByUser, getActiveSchedulings } from '../domain/scheduling.model.firestore.js';
import { analyzeWindows } from './window-analysis.service.js';
import { getFirestore, FirestoreUtils } from './firebase.service.js';
import { ensureCollectionsExist } from './firestore-init.service.js';
import logger from '../utils/logger.js';

const WINDOW_HISTORY_COLLECTION = 'window_history';
const USER_ANALYTICS_COLLECTION = 'user_analytics';

/**
 * Serviço de analytics e histórico para agendamentos usando Firestore
 */

/**
 * Registra uma janela no histórico
 * @param {string} uid - ID do usuário
 * @param {string} schedulingId - ID do agendamento
 * @param {Object} window - Dados da janela
 * @param {string} action - Ação realizada ('viewed', 'surfed', 'missed')
 */
export async function recordWindowHistory(uid, schedulingId, window, action = 'viewed') {
  try {
    const db = getFirestore();
    
    const record = {
      id: `${uid}_${schedulingId}_${window.start}_${Date.now()}`,
      uid,
      scheduling_id: schedulingId,
      window_data: window,
      action,
      timestamp: new Date(),
      score: window.avg_score || 0,
      spot_id: window.spot?.id || 'unknown'
    };

    // Salvar no Firestore
    await db.collection(WINDOW_HISTORY_COLLECTION).doc(record.id).set({
      ...record,
      timestamp: FirestoreUtils.dateToTimestamp(record.timestamp)
    });

    // Atualizar analytics do usuário
    await updateUserAnalytics(uid, record);

    logger.info({
      uid,
      scheduling_id: schedulingId,
      action,
      score: window.avg_score
    }, 'window history recorded');

    return record;
  } catch (error) {
    logger.error({ error: error.message, uid, scheduling_id: schedulingId }, 'failed to record window history');
    throw error;
  }
}

/**
 * Atualiza analytics do usuário
 * @param {string} uid - ID do usuário
 * @param {Object} record - Registro da janela
 */
async function updateUserAnalytics(uid, record) {
  try {
    const db = getFirestore();
    const analyticsRef = db.collection(USER_ANALYTICS_COLLECTION).doc(uid);
    
    // Buscar analytics atual ou criar novo
    const analyticsDoc = await analyticsRef.get();
    let analytics;
    
    if (analyticsDoc.exists) {
      analytics = FirestoreUtils.docToObject(analyticsDoc);
    } else {
      analytics = {
        uid,
        total_windows: 0,
        windows_surfed: 0,
        windows_missed: 0,
        avg_score_preference: 0,
        favorite_spots: {},
        favorite_time_windows: {},
        score_distribution: { low: 0, medium: 0, high: 0, epic: 0 },
        monthly_activity: {},
        best_sessions: [],
        created_at: new Date(),
        last_updated: new Date()
      };
    }

    // Atualizar contadores
    analytics.total_windows++;
    if (record.action === 'surfed') analytics.windows_surfed++;
    if (record.action === 'missed') analytics.windows_missed++;

    // Spots favoritos
    analytics.favorite_spots[record.spot_id] = (analytics.favorite_spots[record.spot_id] || 0) + 1;

    // Distribuição de scores
    const score = record.score;
    if (score >= 90) analytics.score_distribution.epic++;
    else if (score >= 80) analytics.score_distribution.high++;
    else if (score >= 60) analytics.score_distribution.medium++;
    else analytics.score_distribution.low++;

    // Atividade mensal
    const monthKey = record.timestamp.toISOString().substring(0, 7); // YYYY-MM
    analytics.monthly_activity[monthKey] = (analytics.monthly_activity[monthKey] || 0) + 1;

    // Melhores sessões (top 10)
    if (record.action === 'surfed') {
      analytics.best_sessions.push({
        date: record.timestamp,
        score: record.score,
        spot_id: record.spot_id,
        window_data: record.window_data
      });
      
      analytics.best_sessions.sort((a, b) => b.score - a.score);
      analytics.best_sessions = analytics.best_sessions.slice(0, 10);
    }

    analytics.last_updated = new Date();

    // Salvar no Firestore
    await analyticsRef.set({
      ...analytics,
      created_at: FirestoreUtils.dateToTimestamp(analytics.created_at),
      last_updated: FirestoreUtils.dateToTimestamp(analytics.last_updated),
      best_sessions: analytics.best_sessions.map(session => ({
        ...session,
        date: FirestoreUtils.dateToTimestamp(session.date)
      }))
    });

  } catch (error) {
    logger.error({ error: error.message, uid }, 'failed to update user analytics');
    throw error;
  }
}

/**
 * Gera relatório de analytics para um usuário
 * @param {string} uid - ID do usuário
 * @returns {Promise<Object>} Relatório de analytics
 */
export async function generateUserAnalytics(uid) {
  try {
    // Garantir que as coleções existem
    await ensureCollectionsExist();
    
    const db = getFirestore();
    
    // Buscar dados do usuário
    const userSchedulings = await getSchedulingsByUser(uid);
    
    // Buscar histórico de janelas
    const historySnapshot = await db
      .collection(WINDOW_HISTORY_COLLECTION)
      .where('uid', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();
    
    const userHistory = FirestoreUtils.docsToArray(historySnapshot);
    
    // Buscar analytics agregados
    const analyticsDoc = await db.collection(USER_ANALYTICS_COLLECTION).doc(uid).get();
    const analytics = analyticsDoc.exists ? FirestoreUtils.docToObject(analyticsDoc) : null;

    // Calcular estatísticas básicas
    const totalSchedulings = userSchedulings.length;
    const activeSchedulings = userSchedulings.filter(s => s.active).length;
    const totalWindowsViewed = userHistory.length;
    const windowsSurfed = userHistory.filter(h => h.action === 'surfed').length;
    const windowsMissed = userHistory.filter(h => h.action === 'missed').length;

    // Calcular taxa de aproveitamento
    const surfRate = totalWindowsViewed > 0 ? (windowsSurfed / totalWindowsViewed * 100) : 0;

    // Spots mais utilizados
    const spotUsage = {};
    userHistory.forEach(h => {
      spotUsage[h.spot_id] = (spotUsage[h.spot_id] || 0) + 1;
    });
    const topSpots = Object.entries(spotUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([spotId, count]) => ({ spot_id: spotId, count }));

    // Horários preferidos (baseado no histórico)
    const timePreferences = {};
    userHistory.forEach(h => {
      const hour = new Date(h.window_data.start).getHours();
      let timeWindow;
      if (hour >= 5 && hour < 9) timeWindow = 'morning';
      else if (hour >= 9 && hour < 14) timeWindow = 'midday';
      else if (hour >= 14 && hour < 18) timeWindow = 'afternoon';
      else timeWindow = 'evening';
      
      timePreferences[timeWindow] = (timePreferences[timeWindow] || 0) + 1;
    });

    // Score médio das janelas surfadas
    const surfedWindows = userHistory.filter(h => h.action === 'surfed');
    const avgSurfedScore = surfedWindows.length > 0 
      ? surfedWindows.reduce((sum, h) => sum + h.score, 0) / surfedWindows.length
      : 0;

    // Tendências mensais
    const monthlyStats = {};
    userHistory.forEach(h => {
      const month = h.timestamp.toISOString().substring(0, 7);
      if (!monthlyStats[month]) {
        monthlyStats[month] = { total: 0, surfed: 0, avg_score: 0 };
      }
      monthlyStats[month].total++;
      if (h.action === 'surfed') {
        monthlyStats[month].surfed++;
        monthlyStats[month].avg_score += h.score;
      }
    });

    // Calcular médias mensais
    Object.values(monthlyStats).forEach(stats => {
      if (stats.surfed > 0) {
        stats.avg_score = stats.avg_score / stats.surfed;
      }
    });

    return {
      uid,
      generated_at: new Date(),
      summary: {
        total_schedulings: totalSchedulings,
        active_schedulings: activeSchedulings,
        total_windows_viewed: totalWindowsViewed,
        windows_surfed: windowsSurfed,
        windows_missed: windowsMissed,
        surf_rate: Math.round(surfRate),
        avg_surfed_score: Math.round(avgSurfedScore)
      },
      preferences: {
        top_spots: topSpots,
        time_preferences: timePreferences,
        score_threshold: avgSurfedScore > 0 ? Math.round(avgSurfedScore - 10) : 70
      },
      trends: {
        monthly_stats: monthlyStats,
        best_sessions: analytics?.best_sessions || [],
        score_distribution: analytics?.score_distribution || { low: 0, medium: 0, high: 0, epic: 0 }
      },
      recommendations: generateRecommendations(uid, userSchedulings, userHistory)
    };
  } catch (error) {
    logger.error({ error: error.message, uid }, 'failed to generate user analytics');
    throw error;
  }
}

/**
 * Gera recomendações personalizadas
 * @param {string} uid - ID do usuário
 * @param {Array} schedulings - Agendamentos do usuário
 * @param {Array} history - Histórico do usuário
 * @returns {Array} Lista de recomendações
 */
function generateRecommendations(uid, schedulings, history) {
  const recommendations = [];

  // Analisar padrões do usuário
  const surfedWindows = history.filter(h => h.action === 'surfed');
  const missedWindows = history.filter(h => h.action === 'missed');

  // Recomendação 1: Ajustar score mínimo
  if (surfedWindows.length > 0) {
    const avgSurfedScore = surfedWindows.reduce((sum, h) => sum + h.score, 0) / surfedWindows.length;
    const currentMinScores = schedulings.map(s => s.preferences.min_score);
    const avgMinScore = currentMinScores.reduce((sum, s) => sum + s, 0) / currentMinScores.length;

    if (avgSurfedScore < avgMinScore - 10) {
      recommendations.push({
        type: 'adjust_score',
        title: 'Ajustar Score Mínimo',
        description: `Você tem surfado janelas com score médio de ${Math.round(avgSurfedScore)}. Considere baixar seu score mínimo para ${Math.round(avgSurfedScore - 5)}.`,
        action: 'lower_min_score',
        suggested_value: Math.round(avgSurfedScore - 5),
        confidence: 0.8
      });
    }
  }

  // Recomendação 2: Horários mais produtivos
  const timeStats = {};
  surfedWindows.forEach(h => {
    const hour = new Date(h.window_data.start).getHours();
    let timeWindow;
    if (hour >= 5 && hour < 9) timeWindow = 'morning';
    else if (hour >= 9 && hour < 14) timeWindow = 'midday';
    else if (hour >= 14 && hour < 18) timeWindow = 'afternoon';
    else timeWindow = 'evening';
    
    timeStats[timeWindow] = (timeStats[timeWindow] || 0) + 1;
  });

  const bestTimeWindow = Object.entries(timeStats)
    .sort(([,a], [,b]) => b - a)[0];

  if (bestTimeWindow && bestTimeWindow[1] >= 3) {
    recommendations.push({
      type: 'optimize_time',
      title: 'Otimizar Horários',
      description: `Você surfa mais no período da ${getTimeWindowLabel(bestTimeWindow[0])}. Considere focar seus agendamentos neste horário.`,
      action: 'focus_time_window',
      suggested_value: bestTimeWindow[0],
      confidence: 0.7
    });
  }

  // Recomendação 3: Novos picos
  const surfedSpots = new Set(surfedWindows.map(h => h.spot_id));
  if (surfedSpots.size < 3 && schedulings.length < 5) {
    recommendations.push({
      type: 'explore_spots',
      title: 'Explorar Novos Picos',
      description: 'Você tem surfado poucos picos diferentes. Que tal criar agendamentos para novos locais?',
      action: 'add_more_spots',
      suggested_value: null,
      confidence: 0.6
    });
  }

  // Recomendação 4: Melhorar aproveitamento
  const surfRate = history.length > 0 ? (surfedWindows.length / history.length) : 0;
  if (surfRate < 0.3 && history.length >= 10) {
    recommendations.push({
      type: 'improve_efficiency',
      title: 'Melhorar Aproveitamento',
      description: `Você tem surfado apenas ${Math.round(surfRate * 100)}% das janelas. Considere ajustar suas preferências ou horários.`,
      action: 'adjust_preferences',
      suggested_value: null,
      confidence: 0.5
    });
  }

  return recommendations;
}

/**
 * Retorna label amigável para janela de tempo
 * @param {string} timeWindow - Janela de tempo
 * @returns {string} Label
 */
function getTimeWindowLabel(timeWindow) {
  const labels = {
    morning: 'manhã',
    midday: 'meio-dia',
    afternoon: 'tarde',
    evening: 'final do dia'
  };
  return labels[timeWindow] || timeWindow;
}

/**
 * Gera sistema de match/compatibilidade entre usuários
 * @param {string} uid - ID do usuário
 * @returns {Promise<Object>} Dados de match
 */
export async function generateUserMatches(uid) {
  try {
    // Garantir que as coleções existem
    await ensureCollectionsExist();
    
    const userSchedulings = await getSchedulingsByUser(uid);
    
    if (userSchedulings.length === 0) {
      return { matches: [], message: 'Crie agendamentos para encontrar surfistas compatíveis' };
    }

    const db = getFirestore();
    
    // Buscar outros usuários com agendamentos ativos
    const otherUsersSnapshot = await db
      .collection('schedulings')
      .where('active', '==', true)
      .get();
    
    const otherUsers = new Set();
    otherUsersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.uid !== uid) {
        otherUsers.add(data.uid);
      }
    });

    const matches = [];

    for (const otherUid of Array.from(otherUsers).slice(0, 10)) {
      try {
        const compatibility = await calculateCompatibility(uid, otherUid);
        if (compatibility.score > 0.3) {
          matches.push({
            uid: otherUid,
            name: `Surfista ${otherUid.slice(-4)}`,
            compatibility_score: Math.round(compatibility.score * 100),
            common_spots: compatibility.common_spots,
            common_times: compatibility.common_times,
            match_reasons: compatibility.reasons
          });
        }
      } catch (error) {
        logger.warn({ error: error.message, other_uid: otherUid }, 'failed to calculate compatibility');
      }
    }

    matches.sort((a, b) => b.compatibility_score - a.compatibility_score);

    return {
      uid,
      matches: matches.slice(0, 5),
      generated_at: new Date()
    };
  } catch (error) {
    logger.error({ error: error.message, uid }, 'failed to generate user matches');
    throw error;
  }
}

/**
 * Calcula compatibilidade entre dois usuários
 * @param {string} uid1 - ID do primeiro usuário
 * @param {string} uid2 - ID do segundo usuário
 * @returns {Promise<Object>} Dados de compatibilidade
 */
async function calculateCompatibility(uid1, uid2) {
  try {
    const user1Schedulings = await getSchedulingsByUser(uid1);
    const user2Schedulings = await getSchedulingsByUser(uid2);

    let compatibilityScore = 0;
    const reasons = [];
    const commonSpots = [];
    const commonTimes = [];

    // Verificar spots em comum
    const user1Spots = new Set(user1Schedulings.map(s => s.spot_id));
    const user2Spots = new Set(user2Schedulings.map(s => s.spot_id));
    
    for (const spot of user1Spots) {
      if (user2Spots.has(spot)) {
        compatibilityScore += 0.3;
        commonSpots.push(spot);
        reasons.push(`Ambos surfam em ${spot}`);
      }
    }

    // Verificar horários em comum
    const user1Times = new Set();
    const user2Times = new Set();
    
    user1Schedulings.forEach(s => {
      s.preferences.time_windows.forEach(tw => user1Times.add(tw));
    });
    
    user2Schedulings.forEach(s => {
      s.preferences.time_windows.forEach(tw => user2Times.add(tw));
    });

    for (const time of user1Times) {
      if (user2Times.has(time)) {
        compatibilityScore += 0.2;
        commonTimes.push(time);
        reasons.push(`Ambos preferem surfar de ${getTimeWindowLabel(time)}`);
      }
    }

    // Verificar estilos de surf similares
    const user1Styles = new Set(user1Schedulings.map(s => s.preferences.surf_style));
    const user2Styles = new Set(user2Schedulings.map(s => s.preferences.surf_style));
    
    for (const style of user1Styles) {
      if (user2Styles.has(style) || style === 'any' || user2Styles.has('any')) {
        compatibilityScore += 0.1;
        reasons.push(`Estilos de surf compatíveis`);
        break;
      }
    }

    return {
      score: Math.min(compatibilityScore, 1.0),
      common_spots: [...new Set(commonSpots)],
      common_times: [...new Set(commonTimes)],
      reasons: [...new Set(reasons)]
    };
  } catch (error) {
    logger.error({ error: error.message, uid1, uid2 }, 'failed to calculate compatibility');
    return { score: 0, common_spots: [], common_times: [], reasons: [] };
  }
}

/**
 * Gera badges/conquistas para o usuário
 * @param {string} uid - ID do usuário
 * @returns {Promise<Array>} Lista de badges
 */
export async function generateUserBadges(uid) {
  try {
    const db = getFirestore();
    
    // Buscar histórico do usuário
    const historySnapshot = await db
      .collection(WINDOW_HISTORY_COLLECTION)
      .where('uid', '==', uid)
      .orderBy('timestamp', 'asc')
      .get();
    
    const userHistory = FirestoreUtils.docsToArray(historySnapshot);
    const surfedWindows = userHistory.filter(h => h.action === 'surfed');
    const badges = [];

    // Badge: Primeiros passos
    if (surfedWindows.length >= 1) {
      badges.push({
        id: 'first_session',
        name: 'Primeira Sessão',
        description: 'Surfou sua primeira janela agendada',
        icon: '🏄‍♂️',
        earned_at: surfedWindows[0].timestamp,
        rarity: 'common'
      });
    }

    // Badge: Surfista dedicado
    if (surfedWindows.length >= 10) {
      badges.push({
        id: 'dedicated_surfer',
        name: 'Surfista Dedicado',
        description: 'Surfou 10 janelas agendadas',
        icon: '🌊',
        earned_at: surfedWindows[9].timestamp,
        rarity: 'uncommon'
      });
    }

    // Badge: Caçador de épicos
    const epicWindows = surfedWindows.filter(h => h.score >= 90);
    if (epicWindows.length >= 3) {
      badges.push({
        id: 'epic_hunter',
        name: 'Caçador de Épicos',
        description: 'Surfou 3 janelas com score 90+',
        icon: '🔥',
        earned_at: epicWindows[2].timestamp,
        rarity: 'rare'
      });
    }

    // Badge: Madrugador
    const morningWindows = surfedWindows.filter(h => {
      const hour = new Date(h.window_data.start).getHours();
      return hour >= 5 && hour < 8;
    });
    if (morningWindows.length >= 5) {
      badges.push({
        id: 'early_bird',
        name: 'Madrugador',
        description: 'Surfou 5 vezes antes das 8h',
        icon: '🌅',
        earned_at: morningWindows[4].timestamp,
        rarity: 'uncommon'
      });
    }

    // Badge: Explorador
    const uniqueSpots = new Set(surfedWindows.map(h => h.spot_id));
    if (uniqueSpots.size >= 5) {
      badges.push({
        id: 'explorer',
        name: 'Explorador',
        description: 'Surfou em 5 picos diferentes',
        icon: '🗺️',
        earned_at: new Date(),
        rarity: 'rare'
      });
    }

    return badges.sort((a, b) => new Date(b.earned_at) - new Date(a.earned_at));
  } catch (error) {
    logger.error({ error: error.message, uid }, 'failed to generate user badges');
    return [];
  }
}

/**
 * Popula dados de teste para analytics
 * @param {string} uid - ID do usuário
 */
export async function seedAnalyticsData(uid) {
  try {
    // Simular histórico para teste
    const testHistory = [
      { spot_id: 'sape', score: 85, action: 'surfed', days_ago: 5 },
      { spot_id: 'itamambuca', score: 92, action: 'surfed', days_ago: 10 },
      { spot_id: 'sape', score: 75, action: 'missed', days_ago: 15 },
      { spot_id: 'maresias', score: 88, action: 'surfed', days_ago: 20 },
      { spot_id: 'sape', score: 95, action: 'surfed', days_ago: 25 }
    ];

    for (const h of testHistory) {
      const timestamp = new Date(Date.now() - h.days_ago * 24 * 60 * 60 * 1000);
      await recordWindowHistory(uid, 'test-scheduling', {
        start: timestamp.toISOString(),
        avg_score: h.score,
        spot: { id: h.spot_id }
      }, h.action);
    }

    logger.info({ uid, records: testHistory.length }, 'analytics test data seeded');
  } catch (error) {
    logger.error({ error: error.message, uid }, 'failed to seed analytics data');
    throw error;
  }
}

/**
 * Limpa dados de analytics (para desenvolvimento)
 * @param {string} uid - ID do usuário (opcional, se não fornecido limpa tudo)
 */
export async function clearAnalyticsData(uid = null) {
  try {
    const db = getFirestore();
    
    if (uid) {
      // Limpar dados de um usuário específico
      const historySnapshot = await db
        .collection(WINDOW_HISTORY_COLLECTION)
        .where('uid', '==', uid)
        .get();
      
      const batch = db.batch();
      historySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Limpar analytics do usuário
      batch.delete(db.collection(USER_ANALYTICS_COLLECTION).doc(uid));
      
      await batch.commit();
      
      logger.info({ uid }, 'user analytics data cleared');
    } else {
      // Limpar todos os dados (cuidado!)
      logger.warn('clearing all analytics data');
      
      // Implementar limpeza geral se necessário
      // Por segurança, não implementando por enquanto
    }
  } catch (error) {
    logger.error({ error: error.message, uid }, 'failed to clear analytics data');
    throw error;
  }
}
