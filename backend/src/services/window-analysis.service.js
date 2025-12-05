import { fetchMarineForecast } from './openMeteo.service.js';
import { fetchTideForTimes } from './tides.service.js';
import { scoreHour, combine, toLabel } from '../scoring/scoring.engine.js';
import { getSpotById } from '../domain/spots.model.js';
import logger from '../utils/logger.js';

/**
 * Analisa janelas de surf baseado nas preferências do agendamento
 * @param {Object} scheduling - Agendamento com preferências
 * @returns {Promise<Object>} Análise das janelas
 */
export async function analyzeWindows(scheduling) {
  try {
    const spot = getSpotById(scheduling.spot_id);
    if (!spot) {
      throw new Error(`Pico ${scheduling.spot_id} não encontrado`);
    }

    // Buscar previsão para o período configurado
    const days = scheduling.preferences.days_ahead || 3;
    const hoursRaw = await fetchMarineForecast({ 
      lat: spot.lat, 
      lon: spot.lon, 
      days 
    });

    if (!hoursRaw || hoursRaw.length === 0) {
      return {
        scheduling_id: scheduling.id,
        spot,
        preferences: scheduling.preferences,
        windows: [],
        next_good_windows: [],
        analysis_time: new Date(),
        status: 'no_data'
      };
    }

    // Buscar dados de maré se disponível
    let tide = { heightsByTime: new Map(), events: [] };
    try {
      const times = hoursRaw.map(h => h.time).filter(Boolean);
      if (times.length > 0) {
        tide = await fetchTideForTimes({ 
          lat: spot.lat, 
          lon: spot.lon, 
          times, 
          days, 
          spotId: scheduling.spot_id 
        });
      }
    } catch (e) {
      logger.warn({ err: String(e?.message || e) }, 'tide fetch failed in window analysis');
    }

    // Enriquecer horas com dados de maré
    const hoursWithTide = hoursRaw.map((h) => {
      const th = tide?.heightsByTime instanceof Map ? tide.heightsByTime.get(h.time) : null;
      return { ...h, tide_height: Number.isFinite(th) ? th : null };
    });

    // Aplicar scoring
    const hoursScored = hoursWithTide.map((h) => ({ ...h, ...scoreHour(h, spot) }));

    // Filtrar horas baseado nas preferências do usuário
    const filteredHours = filterHoursByPreferences(hoursScored, scheduling.preferences);

    // Agrupar em janelas contínuas
    const windows = groupIntoWindows(filteredHours, scheduling.preferences);

    // Selecionar as melhores janelas
    const nextGoodWindows = selectBestWindows(windows, 5);

    return {
      scheduling_id: scheduling.id,
      spot,
      preferences: scheduling.preferences,
      windows: nextGoodWindows,
      next_good_windows: nextGoodWindows.slice(0, 3), // Top 3 para notificações
      analysis_time: new Date(),
      status: 'success',
      total_hours_analyzed: hoursScored.length,
      hours_matching_criteria: filteredHours.length
    };

  } catch (error) {
    logger.error({ 
      error: error.message, 
      scheduling_id: scheduling.id 
    }, 'window analysis failed');
    
    return {
      scheduling_id: scheduling.id,
      spot: getSpotById(scheduling.spot_id),
      preferences: scheduling.preferences,
      windows: [],
      next_good_windows: [],
      analysis_time: new Date(),
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Filtra horas baseado nas preferências do usuário
 * @param {Array} hours - Horas com scoring
 * @param {Object} preferences - Preferências do agendamento
 * @returns {Array} Horas filtradas
 */
function filterHoursByPreferences(hours, preferences) {
  return hours.filter(hour => {
    const hourOfDay = new Date(hour.time).getHours();

    // Regra global: considerar apenas horas entre 06:00 e 16:00
    // (independente das preferências de janela do usuário)
    if (hourOfDay < 6 || hourOfDay > 16) {
      return false;
    }

    // Filtro de score mínimo
    if (hour.score < preferences.min_score) {
      return false;
    }

    // Filtro de energia mínima
    if (preferences.min_energy && hour.power_kwm && hour.power_kwm < preferences.min_energy) {
      return false;
    }

    // Filtro de janela de tempo
    if (preferences.time_windows && preferences.time_windows.length > 0) {
      const timeWindow = getTimeWindow(hourOfDay);
      if (!preferences.time_windows.includes(timeWindow)) {
        return false;
      }
    }

    // Filtro de estilo de surf (baseado na altura da onda)
    if (preferences.surf_style && preferences.surf_style !== 'any') {
      if (!matchesSurfStyle(hour, preferences.surf_style)) {
        return false;
      }
    }

    // Filtro de preferência de vento
    if (preferences.wind_preference && preferences.wind_preference !== 'any') {
      if (!matchesWindPreference(hour, preferences.wind_preference)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Determina a janela de tempo baseada na hora
 * @param {number} hour - Hora do dia (0-23)
 * @returns {string} Janela de tempo
 */
function getTimeWindow(hour) {
  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  return 'other';
}

/**
 * Verifica se a condição combina com o estilo de surf
 * @param {Object} hour - Hora com dados
 * @param {string} surfStyle - Estilo preferido
 * @returns {boolean}
 */
function matchesSurfStyle(hour, surfStyle) {
  const waveHeight = hour.swell_height || hour.wave_height || 0;
  
  switch (surfStyle) {
    case 'longboard':
      // Longboard prefere ondas menores e mais limpas
      return waveHeight >= 0.5 && waveHeight <= 1.5;
    case 'shortboard':
      // Shortboard prefere ondas maiores com mais força
      return waveHeight >= 1.0 && (hour.power_kwm || 0) >= 3.0;
    default:
      return true;
  }
}

/**
 * Verifica se a condição de vento combina com a preferência
 * @param {Object} hour - Hora com dados
 * @param {string} windPreference - Preferência de vento
 * @returns {boolean}
 */
function matchesWindPreference(hour, windPreference) {
  const windSpeed = hour.wind_speed || 0;
  
  switch (windPreference) {
    case 'offshore':
      // Verifica se é offshore baseado nas flags do scoring
      return hour.meta?.flags?.isOffshoreSector === true && windSpeed <= 25;
    case 'light':
      // Vento fraco, qualquer direção
      return windSpeed <= 10;
    default:
      return true;
  }
}

/**
 * Agrupa horas filtradas em janelas contínuas
 * @param {Array} hours - Horas filtradas
 * @param {Object} preferences - Preferências
 * @returns {Array} Janelas agrupadas
 */
function groupIntoWindows(hours, preferences) {
  if (hours.length === 0) return [];

  const windows = [];
  let currentWindow = null;

  hours.forEach((hour, index) => {
    const hourTime = new Date(hour.time);
    
    if (!currentWindow) {
      // Iniciar nova janela
      currentWindow = {
        start: hour.time,
        end: hour.time,
        hours: [hour],
        avg_score: hour.score,
        peak_score: hour.score,
        duration_hours: 1
      };
    } else {
      const lastHour = new Date(currentWindow.end);
      const timeDiff = (hourTime - lastHour) / (1000 * 60 * 60); // diferença em horas
      
      if (timeDiff <= 2) {
        // Continuar janela atual (até 2h de gap)
        currentWindow.end = hour.time;
        currentWindow.hours.push(hour);
        currentWindow.duration_hours = currentWindow.hours.length;
        currentWindow.avg_score = currentWindow.hours.reduce((sum, h) => sum + h.score, 0) / currentWindow.hours.length;
        currentWindow.peak_score = Math.max(currentWindow.peak_score, hour.score);
      } else {
        // Finalizar janela atual e iniciar nova
        if (currentWindow.duration_hours >= 1) { // Mínimo 1h
          windows.push(finalizeWindow(currentWindow, preferences));
        }
        
        currentWindow = {
          start: hour.time,
          end: hour.time,
          hours: [hour],
          avg_score: hour.score,
          peak_score: hour.score,
          duration_hours: 1
        };
      }
    }
  });

  // Adicionar última janela se válida
  if (currentWindow && currentWindow.duration_hours >= 1) {
    windows.push(finalizeWindow(currentWindow, preferences));
  }

  return windows;
}

/**
 * Finaliza uma janela com informações adicionais
 * @param {Object} window - Janela básica
 * @param {Object} preferences - Preferências do usuário
 * @returns {Object} Janela finalizada
 */
function finalizeWindow(window, preferences) {
  const bestHour = window.hours.reduce((best, hour) => 
    hour.score > best.score ? hour : best
  );

  // Gerar descrição personalizada
  const description = generateWindowDescription(window, preferences);
  
  return {
    ...window,
    best_hour: {
      time: bestHour.time,
      score: bestHour.score,
      label: bestHour.label,
      swell_height: bestHour.swell_height,
      swell_period: bestHour.swell_period,
      wind_speed: bestHour.wind_speed,
      wind_direction: bestHour.wind_direction,
      tide_height: bestHour.tide_height,
      power_kwm: bestHour.power_kwm
    },
    description,
    quality_rating: getQualityRating(window.avg_score),
    recommended_for: getRecommendedFor(window, preferences)
  };
}

/**
 * Gera descrição personalizada da janela
 * @param {Object} window - Janela
 * @param {Object} preferences - Preferências
 * @returns {string} Descrição
 */
function generateWindowDescription(window, preferences) {
  const bestHour = window.hours.reduce((best, hour) => 
    hour.score > best.score ? hour : best
  );

  const parts = [];
  
  // Altura e período
  if (bestHour.swell_height) {
    parts.push(`${bestHour.swell_height.toFixed(1)}m`);
  }
  if (bestHour.swell_period) {
    parts.push(`${Math.round(bestHour.swell_period)}s`);
  }

  // Vento
  if (bestHour.wind_speed !== null) {
    const windDesc = bestHour.meta?.flags?.isOffshoreSector ? 'offshore' : 'vento';
    parts.push(`${windDesc} ${Math.round(bestHour.wind_speed)}km/h`);
  }

  // Energia
  if (bestHour.power_kwm) {
    parts.push(`${bestHour.power_kwm.toFixed(1)} kW/m`);
  }

  const baseDesc = parts.join(', ');
  
  // Personalizar baseado no estilo
  let styleNote = '';
  if (preferences.surf_style === 'longboard') {
    styleNote = ' - ideal pro long';
  } else if (preferences.surf_style === 'shortboard') {
    styleNote = ' - força boa pro short';
  }

  return `${baseDesc}${styleNote}`;
}

/**
 * Determina rating de qualidade
 * @param {number} avgScore - Score médio
 * @returns {string} Rating
 */
function getQualityRating(avgScore) {
  if (avgScore >= 90) return 'épico';
  if (avgScore >= 80) return 'excelente';
  if (avgScore >= 70) return 'bom';
  if (avgScore >= 60) return 'ok';
  return 'regular';
}

/**
 * Determina para quem é recomendado
 * @param {Object} window - Janela
 * @param {Object} preferences - Preferências
 * @returns {string[]} Recomendações
 */
function getRecommendedFor(window, preferences) {
  const recommendations = [];
  const bestHour = window.hours.reduce((best, hour) => 
    hour.score > best.score ? hour : best
  );

  const waveHeight = bestHour.swell_height || bestHour.wave_height || 0;
  const power = bestHour.power_kwm || 0;

  if (waveHeight <= 1.2 && power <= 4) {
    recommendations.push('iniciantes');
  }
  if (waveHeight >= 0.8 && waveHeight <= 2.0) {
    recommendations.push('intermediários');
  }
  if (waveHeight >= 1.5 || power >= 6) {
    recommendations.push('avançados');
  }

  return recommendations.length > 0 ? recommendations : ['todos os níveis'];
}

/**
 * Seleciona as melhores janelas
 * @param {Array} windows - Todas as janelas
 * @param {number} limit - Limite de janelas
 * @returns {Array} Melhores janelas
 */
function selectBestWindows(windows, limit = 5) {
  return windows
    .sort((a, b) => {
      // Priorizar por score médio, depois por duração
      const scoreDiff = b.avg_score - a.avg_score;
      if (Math.abs(scoreDiff) > 5) return scoreDiff;
      return b.duration_hours - a.duration_hours;
    })
    .slice(0, limit)
    .sort((a, b) => new Date(a.start) - new Date(b.start)); // Ordenar por tempo
}
