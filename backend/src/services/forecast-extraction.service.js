import { directionToText } from '../utils/angles.js';
import logger from '../utils/logger.js';

/**
 * Extrai o melhor horário do próximo dia a partir da análise de janelas
 * @param {Object} analysis - Resultado da análise de janelas (analyzeWindows)
 * @returns {Object|null} Dados do melhor horário formatados para notificação
 */
export function extractNextDayForecast(analysis) {
  try {
    if (!analysis || analysis.status !== 'success' || !analysis.windows?.length) {
      return null;
    }

    // Encontrar a melhor janela (primeira da lista já está ordenada por score)
    const bestWindow = analysis.windows[0];
    if (!bestWindow) {
      return null;
    }

    // Encontrar o melhor horário dentro da janela
    const bestHour = findBestHourInWindow(bestWindow);
    if (!bestHour) {
      return null;
    }

    const windowStart = new Date(bestWindow.start);
    const bestHourTime = new Date(bestHour.time);
    
    // Extrair dados do melhor horário
    const forecastData = {
      best_window: {
        time: bestHourTime.toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        date: bestHourTime.toISOString().split('T')[0],
        score: Math.round(bestHour.score || bestWindow.avg_score || 0),
        swell_height: Number(bestHour.swell_height || 0),
        swell_direction: Number(bestHour.swell_direction || 0),
        swell_direction_text: directionToText(bestHour.swell_direction),
        swell_period: Number(bestHour.swell_period || 0),
        wind_speed: Number(bestHour.wind_speed || 0),
        wind_direction: Number(bestHour.wind_direction || 0),
        energy_joules: Number(bestHour.energy_jpm2 || 0),
        power_kwm: Number(bestHour.power_kwm || 0),
        conditions_summary: extractConditionsSummary(bestHour, analysis.spot)
      },
      updated_at: new Date().toISOString()
    };

    logger.info({
      spot_id: analysis.spot?.id,
      best_time: forecastData.best_window.time,
      score: forecastData.best_window.score,
      swell_height: forecastData.best_window.swell_height
    }, 'extracted next day forecast');

    return forecastData;
  } catch (error) {
    logger.error({ 
      error: error.message,
      spot_id: analysis?.spot?.id 
    }, 'failed to extract next day forecast');
    return null;
  }
}

/**
 * Encontra o melhor horário dentro de uma janela
 * Regra: priorizar horários entre 06:00 e 16:00 (horário local)
 * @param {Object} window - Janela de surf
 * @returns {Object|null} Melhor horário
 */
function findBestHourInWindow(window) {
  // Se a janela já tem um best_hour definido, usar ele
  if (window.best_hour) {
    return window.best_hour;
  }

  // Se tem array de horas, priorizar horas dentro do range 06:00–16:00
  if (window.hours && Array.isArray(window.hours) && window.hours.length) {
    const hoursInRange = window.hours.filter((h) => {
      if (!h.time) return false;
      const d = new Date(h.time);
      const hour = d.getHours();
      return hour >= 6 && hour <= 16;
    });

    const candidateHours = hoursInRange.length ? hoursInRange : window.hours;

    return candidateHours.reduce((best, current) => {
      const currentScore = current.score || 0;
      const bestScore = best.score || 0;
      return currentScore > bestScore ? current : best;
    });
  }

  // Fallback: usar dados da própria janela
  return {
    time: window.start,
    score: window.avg_score || window.peak_score || 0,
    swell_height: window.swell_height || 0,
    swell_direction: window.swell_direction || 0,
    swell_period: window.swell_period || 0,
    wind_speed: window.wind_speed || 0,
    wind_direction: window.wind_direction || 0,
    energy_jpm2: window.energy_jpm2 || 0,
    power_kwm: window.power_kwm || 0
  };
}

/**
 * Extrai resumo das condições a partir dos metadados
 * @param {Object} hour - Dados do horário
 * @param {Object} spot - Dados do pico
 * @returns {string} Resumo das condições
 */
function extractConditionsSummary(hour, spot) {
  // Usar o advice do meta se disponível
  if (hour.meta && hour.meta.advice) {
    return hour.meta.advice;
  }

  // Fallback: gerar resumo básico baseado no score
  const score = hour.score || 0;
  const timeOfDay = getTimeOfDayFromHour(hour.time);
  
  if (score >= 80) {
    return `condições épicas ${timeOfDay}`;
  } else if (score >= 60) {
    return `boas condições ${timeOfDay}`;
  } else if (score >= 40) {
    return `condições ok ${timeOfDay}`;
  } else {
    return `condições fracas ${timeOfDay}`;
  }
}

/**
 * Determina período do dia baseado no horário
 * @param {string} timeString - Horário em ISO string
 * @returns {string} Período do dia
 */
function getTimeOfDayFromHour(timeString) {
  if (!timeString) return 'durante o dia';
  
  const hour = new Date(timeString).getHours();
  
  if (hour >= 5 && hour < 9) return 'de manhã';
  if (hour >= 9 && hour < 14) return 'no meio-dia';
  if (hour >= 14 && hour < 18) return 'de tarde';
  if (hour >= 18 && hour < 20) return 'no final do dia';
  
  return 'durante o dia';
}
