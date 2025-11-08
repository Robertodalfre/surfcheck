import { getSchedulingsByUser, getActiveSchedulings } from '../domain/scheduling.model.js';
import { analyzeWindows } from './window-analysis.service.js';
import logger from '../utils/logger.js';

/**
 * Serviço de analytics e histórico para agendamentos
 */

// Simulação de histórico em memória (em produção seria Firestore)
let windowHistory = [];
let userAnalytics = new Map();

/**
 * Registra uma janela no histórico
 * @param {string} uid - ID do usuário
 * @param {string} schedulingId - ID do agendamento
 * @param {Object} window - Dados da janela
 * @param {string} action - Ação realizada ('viewed', 'surfed', 'missed')
 */
export function recordWindowHistory(uid, schedulingId, window, action = 'viewed') {
  const record = {
    id: `${uid}_${schedulingId}_${window.start}_${Date.now()}`,
    uid,
    scheduling_id: schedulingId,
    window_data: window,
    action,
    timestamp: new Date(),
    score: window.avg_score,
    spot_id: window.spot?.id || 'unknown'
  };

  windowHistory.push(record);

  // Atualizar analytics do usuário
  updateUserAnalytics(uid, record);

  logger.info({
    uid,
    scheduling_id: schedulingId,
    action,
    score: window.avg_score
  }, 'window history recorded');
}

/**
 * Atualiza analytics do usuário
 * @param {string} uid - ID do usuário
 * @param {Object} record - Registro da janela
 */
function updateUserAnalytics(uid, record) {
  if (!userAnalytics.has(uid)) {
    userAnalytics.set(uid, {
      total_windows: 0,
      windows_surfed: 0,
      windows_missed: 0,
      avg_score_preference: 0,
      favorite_spots: new Map(),
      favorite_time_windows: new Map(),
      score_distribution: { low: 0, medium: 0, high: 0, epic: 0 },
      monthly_activity: new Map(),
      best_sessions: [],
      last_updated: new Date()
    });
  }

  const analytics = userAnalytics.get(uid);
  analytics.total_windows++;

  // Contar ações
  if (record.action === 'surfed') analytics.windows_surfed++;
  if (record.action === 'missed') analytics.windows_missed++;

  // Spots favoritos
  const spotCount = analytics.favorite_spots.get(record.spot_id) || 0;
  analytics.favorite_spots.set(record.spot_id, spotCount + 1);

  // Distribuição de scores
  const score = record.score;
  if (score >= 90) analytics.score_distribution.epic++;
  else if (score >= 80) analytics.score_distribution.high++;
  else if (score >= 60) analytics.score_distribution.medium++;
  else analytics.score_distribution.low++;

  // Atividade mensal
  const monthKey = record.timestamp.toISOString().substring(0, 7); // YYYY-MM
  const monthCount = analytics.monthly_activity.get(monthKey) || 0;
  analytics.monthly_activity.set(monthKey, monthCount + 1);

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
}

/**
 * Gera relatório de analytics para um usuário
 * @param {string} uid - ID do usuário
 * @returns {Promise<Object>} Relatório de analytics
 */
export async function generateUserAnalytics(uid) {
  try {
    const userSchedulings = getSchedulingsByUser(uid);
    const userHistory = windowHistory.filter(h => h.uid === uid);
    const analytics = userAnalytics.get(uid) || null;

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
    const userSchedulings = getSchedulingsByUser(uid);
    const userHistory = windowHistory.filter(h => h.uid === uid);
    
    if (userSchedulings.length === 0) {
      return { matches: [], message: 'Crie agendamentos para encontrar surfistas compatíveis' };
    }

    // Simular outros usuários (em produção seria busca real no banco)
    const otherUsers = ['user2', 'user3', 'user4', 'user5'];
    const matches = [];

    for (const otherUid of otherUsers) {
      const compatibility = calculateCompatibility(uid, otherUid);
      if (compatibility.score > 0.3) {
        matches.push({
          uid: otherUid,
          name: `Surfista ${otherUid.slice(-1)}`,
          compatibility_score: Math.round(compatibility.score * 100),
          common_spots: compatibility.common_spots,
          common_times: compatibility.common_times,
          match_reasons: compatibility.reasons
        });
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
 * @returns {Object} Dados de compatibilidade
 */
function calculateCompatibility(uid1, uid2) {
  // Simulação de compatibilidade (em produção seria cálculo real)
  const user1Schedulings = getSchedulingsByUser(uid1);
  
  // Simular dados do outro usuário
  const mockUser2Data = {
    spots: ['sape', 'itamambuca', 'maresias'],
    time_windows: ['morning', 'afternoon'],
    surf_style: Math.random() > 0.5 ? 'longboard' : 'shortboard',
    avg_score: Math.floor(Math.random() * 30 + 60)
  };

  let compatibilityScore = 0;
  const reasons = [];
  const commonSpots = [];
  const commonTimes = [];

  // Verificar spots em comum
  user1Schedulings.forEach(s => {
    if (mockUser2Data.spots.includes(s.spot_id)) {
      compatibilityScore += 0.3;
      commonSpots.push(s.spot_id);
      reasons.push(`Ambos surfam em ${s.spot_id}`);
    }
  });

  // Verificar horários em comum
  user1Schedulings.forEach(s => {
    s.preferences.time_windows.forEach(tw => {
      if (mockUser2Data.time_windows.includes(tw)) {
        compatibilityScore += 0.2;
        if (!commonTimes.includes(tw)) {
          commonTimes.push(tw);
          reasons.push(`Ambos preferem surfar de ${getTimeWindowLabel(tw)}`);
        }
      }
    });
  });

  // Verificar estilo de surf
  const user1Styles = user1Schedulings.map(s => s.preferences.surf_style);
  if (user1Styles.includes(mockUser2Data.surf_style) || user1Styles.includes('any')) {
    compatibilityScore += 0.1;
    reasons.push(`Estilos de surf compatíveis`);
  }

  return {
    score: Math.min(compatibilityScore, 1.0),
    common_spots: [...new Set(commonSpots)],
    common_times: [...new Set(commonTimes)],
    reasons
  };
}

/**
 * Gera badges/conquistas para o usuário
 * @param {string} uid - ID do usuário
 * @returns {Array} Lista de badges
 */
export function generateUserBadges(uid) {
  const userHistory = windowHistory.filter(h => h.uid === uid);
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
}

// Funções para desenvolvimento/teste
export function clearAnalyticsData() {
  windowHistory = [];
  userAnalytics.clear();
}

export function seedAnalyticsData(uid) {
  // Simular histórico para teste
  const testHistory = [
    { spot_id: 'sape', score: 85, action: 'surfed', days_ago: 5 },
    { spot_id: 'itamambuca', score: 92, action: 'surfed', days_ago: 10 },
    { spot_id: 'sape', score: 75, action: 'missed', days_ago: 15 },
    { spot_id: 'maresias', score: 88, action: 'surfed', days_ago: 20 },
    { spot_id: 'sape', score: 95, action: 'surfed', days_ago: 25 }
  ];

  testHistory.forEach(h => {
    const timestamp = new Date(Date.now() - h.days_ago * 24 * 60 * 60 * 1000);
    recordWindowHistory(uid, 'test-scheduling', {
      start: timestamp.toISOString(),
      avg_score: h.score,
      spot: { id: h.spot_id }
    }, h.action);
  });
}
