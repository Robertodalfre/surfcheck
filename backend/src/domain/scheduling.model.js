import { v4 as uuidv4 } from 'uuid';
import { getFirestore, FirestoreUtils } from '../services/firebase.service.js';
import { ensureCollectionsExist } from '../services/firestore-init.service.js';
import logger from '../utils/logger.js';
import { getSpotById } from './spots.model.js';
import { analyzeWindows } from '../services/window-analysis.service.js';
import { extractNextDayForecast } from '../services/forecast-extraction.service.js';

const COLLECTION_NAME = 'schedulings';

/**
 * Modelo de dados para agendamentos usando Firestore
 * @typedef {Object} Scheduling
 * @property {string} id - ID único do agendamento
 * @property {string} uid - Firebase User ID
 * @property {string} spot_id - ID do pico
 * @property {boolean} active - Se o agendamento está ativo
 * @property {Date} created_at - Data de criação
 * @property {Date} updated_at - Data de última atualização
 * @property {Object} preferences - Preferências do usuário
 * @property {Object} notifications - Configurações de notificação
 */

/**
 * Cria um novo agendamento
 * @param {Object} data - Dados do agendamento
 * @returns {Promise<Object>} Agendamento criado
 */
export async function createScheduling(data) {
  try {
    const db = getFirestore();
    
    // Validar dados obrigatórios
    if (!data.uid || !data.spot_id) {
      throw new Error('UID e spot_id são obrigatórios');
    }

    // Validar se o spot existe
    const spot = getSpotById(data.spot_id);
    if (!spot) {
      throw new Error(`Pico ${data.spot_id} não encontrado`);
    }

    // Validar preferências
    const validatedPreferences = validatePreferences(data.preferences || {});
    const validatedNotifications = validateNotifications(data.notifications || {});

    const scheduling = {
      id: uuidv4(),
      uid: data.uid,
      spot_id: data.spot_id,
      active: data.active !== undefined ? data.active : true,
      preferences: validatedPreferences,
      notifications: validatedNotifications,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Analisar janelas e extrair forecast do próximo dia
    try {
      const analysis = await analyzeWindows(scheduling);
      const nextDayForecast = extractNextDayForecast(analysis);
      
      if (nextDayForecast) {
        scheduling.next_day_forecast = nextDayForecast;
        logger.info({
          scheduling_id: scheduling.id,
          best_time: nextDayForecast.best_window.time,
          score: nextDayForecast.best_window.score
        }, 'next day forecast calculated for new scheduling');
      }
    } catch (forecastError) {
      logger.warn({
        scheduling_id: scheduling.id,
        error: forecastError.message
      }, 'failed to calculate next day forecast for new scheduling');
      // Continuar mesmo se o forecast falhar
    }

    // Salvar no Firestore
    await db.collection(COLLECTION_NAME).doc(scheduling.id).set({
      ...scheduling,
      created_at: FirestoreUtils.dateToTimestamp(scheduling.created_at),
      updated_at: FirestoreUtils.dateToTimestamp(scheduling.updated_at)
    });

    logger.info({ 
      scheduling_id: scheduling.id, 
      uid: scheduling.uid,
      spot_id: scheduling.spot_id 
    }, 'scheduling created');

    // Enriquecer com dados do spot
    return {
      ...scheduling,
      spot
    };
  } catch (error) {
    logger.error({ error: error.message }, 'failed to create scheduling');
    throw error;
  }
}

/**
 * Busca agendamentos por usuário
 * @param {string} uid - ID do usuário
 * @returns {Promise<Array>} Lista de agendamentos
 */
export async function getSchedulingsByUser(uid) {
  try {
    // Garantir que as coleções existem
    await ensureCollectionsExist();
    
    const db = getFirestore();
    
    const querySnapshot = await db
      .collection(COLLECTION_NAME)
      .where('uid', '==', uid)
      .orderBy('created_at', 'desc')
      .get();

    const schedulings = FirestoreUtils.docsToArray(querySnapshot);

    // Enriquecer com dados dos spots
    return schedulings.map(scheduling => ({
      ...scheduling,
      spot: getSpotById(scheduling.spot_id)
    }));
  } catch (error) {
    logger.error({ error: error.message, uid }, 'failed to get schedulings by user');
    throw error;
  }
}

/**
 * Busca agendamento por ID
 * @param {string} id - ID do agendamento
 * @returns {Promise<Object|null>} Agendamento encontrado ou null
 */
export async function getSchedulingById(id) {
  try {
    const db = getFirestore();
    
    const doc = await db.collection(COLLECTION_NAME).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    const scheduling = FirestoreUtils.docToObject(doc);
    
    // Enriquecer com dados do spot
    return {
      ...scheduling,
      spot: getSpotById(scheduling.spot_id)
    };
  } catch (error) {
    logger.error({ error: error.message, scheduling_id: id }, 'failed to get scheduling by id');
    throw error;
  }
}

/**
 * Atualiza um agendamento
 * @param {string} id - ID do agendamento
 * @param {Object} updates - Dados para atualizar
 * @returns {Promise<Object>} Agendamento atualizado
 */
export async function updateScheduling(id, updates) {
  try {
    const db = getFirestore();
    
    // Buscar agendamento atual
    const currentScheduling = await getSchedulingById(id);
    if (!currentScheduling) {
      throw new Error('Agendamento não encontrado');
    }

    // Preparar dados para atualização
    const updateData = {
      updated_at: FirestoreUtils.dateToTimestamp(new Date())
    };

    // Validar e adicionar campos permitidos
    if (updates.active !== undefined) {
      updateData.active = updates.active;
    }

    if (updates.preferences) {
      updateData.preferences = validatePreferences(updates.preferences);
    }

    if (updates.notifications) {
      updateData.notifications = validateNotifications(updates.notifications);
    }

    // Atualizar no Firestore
    await db.collection(COLLECTION_NAME).doc(id).update(updateData);

    logger.info({ 
      scheduling_id: id,
      updates: Object.keys(updateData)
    }, 'scheduling updated');

    // Retornar agendamento atualizado
    return await getSchedulingById(id);
  } catch (error) {
    logger.error({ error: error.message, scheduling_id: id }, 'failed to update scheduling');
    throw error;
  }
}

/**
 * Remove um agendamento
 * @param {string} id - ID do agendamento
 * @returns {Promise<boolean>} Sucesso da operação
 */
export async function deleteScheduling(id) {
  try {
    const db = getFirestore();
    
    // Verificar se existe
    const scheduling = await getSchedulingById(id);
    if (!scheduling) {
      throw new Error('Agendamento não encontrado');
    }

    // Remover do Firestore
    await db.collection(COLLECTION_NAME).doc(id).delete();

    logger.info({ scheduling_id: id }, 'scheduling deleted');
    
    return true;
  } catch (error) {
    logger.error({ error: error.message, scheduling_id: id }, 'failed to delete scheduling');
    throw error;
  }
}

/**
 * Busca todos os agendamentos ativos
 * @returns {Promise<Array>} Lista de agendamentos ativos
 */
export async function getActiveSchedulings() {
  try {
    const db = getFirestore();
    
    const querySnapshot = await db
      .collection(COLLECTION_NAME)
      .where('active', '==', true)
      .orderBy('created_at', 'desc')
      .get();

    const schedulings = FirestoreUtils.docsToArray(querySnapshot);

    // Enriquecer com dados dos spots
    return schedulings.map(scheduling => ({
      ...scheduling,
      spot: getSpotById(scheduling.spot_id)
    }));
  } catch (error) {
    logger.error({ error: error.message }, 'failed to get active schedulings');
    throw error;
  }
}

/**
 * Busca agendamentos por pico
 * @param {string} spotId - ID do pico
 * @returns {Promise<Array>} Lista de agendamentos do pico
 */
export async function getSchedulingsBySpot(spotId) {
  try {
    const db = getFirestore();
    
    const querySnapshot = await db
      .collection(COLLECTION_NAME)
      .where('spot_id', '==', spotId)
      .where('active', '==', true)
      .orderBy('created_at', 'desc')
      .get();

    const schedulings = FirestoreUtils.docsToArray(querySnapshot);
    const spot = getSpotById(spotId);

    return schedulings.map(scheduling => ({
      ...scheduling,
      spot
    }));
  } catch (error) {
    logger.error({ error: error.message, spot_id: spotId }, 'failed to get schedulings by spot');
    throw error;
  }
}

/**
 * Valida preferências do agendamento
 * @param {Object} preferences - Preferências a validar
 * @returns {Object} Preferências validadas
 */
function validatePreferences(preferences) {
  const validated = {
    days_ahead: 3,
    time_windows: ['morning'],
    min_score: 60,
    surf_style: 'any',
    wind_preference: 'any',
    min_energy: 1.0,
    ...preferences
  };

  // Validações específicas
  if (!Number.isInteger(validated.days_ahead) || validated.days_ahead < 1 || validated.days_ahead > 7) {
    validated.days_ahead = 3;
  }

  if (!Array.isArray(validated.time_windows) || validated.time_windows.length === 0) {
    validated.time_windows = ['morning'];
  } else {
    validated.time_windows = validated.time_windows.filter(tw => 
      validateTimeWindows([tw]).length > 0
    );
    if (validated.time_windows.length === 0) {
      validated.time_windows = ['morning'];
    }
  }

  if (typeof validated.min_score !== 'number' || validated.min_score < 0 || validated.min_score > 100) {
    validated.min_score = 60;
  }

  if (!validateSurfStyle([validated.surf_style]).length) {
    validated.surf_style = 'any';
  }

  if (!validateWindPreference([validated.wind_preference]).length) {
    validated.wind_preference = 'any';
  }

  if (typeof validated.min_energy !== 'number' || validated.min_energy < 0) {
    validated.min_energy = 1.0;
  }

  return validated;
}

/**
 * Valida configurações de notificação
 * @param {Object} notifications - Notificações a validar
 * @returns {Object} Notificações validadas
 */
function validateNotifications(notifications) {
  const validated = {
    push_enabled: true,
    advance_hours: 1,
    daily_summary: false,
    special_alerts: true,
    fixed_time: null,
    timezone: 'America/Sao_Paulo',
    ...notifications
  };

  // Validações específicas
  validated.push_enabled = Boolean(validated.push_enabled);
  validated.daily_summary = Boolean(validated.daily_summary);
  validated.special_alerts = Boolean(validated.special_alerts);

  if (typeof validated.advance_hours !== 'number' || validated.advance_hours < 0.5 || validated.advance_hours > 24) {
    validated.advance_hours = 1;
  }

  // fixed_time deve ser string HH:mm ou null
  if (validated.fixed_time !== null) {
    if (typeof validated.fixed_time !== 'string' || !/^\d{2}:\d{2}$/.test(validated.fixed_time)) {
      validated.fixed_time = null;
    }
  }

  // timezone deve ser string IANA válida (fallback simples)
  if (typeof validated.timezone !== 'string' || validated.timezone.length < 3) {
    validated.timezone = 'America/Sao_Paulo';
  }

  return validated;
}

/**
 * Valida janelas de tempo
 * @param {Array} timeWindows - Janelas de tempo
 * @returns {Array} Janelas válidas
 */
export function validateTimeWindows(timeWindows) {
  const validWindows = ['morning', 'midday', 'afternoon'];
  return timeWindows.filter(tw => validWindows.includes(tw));
}

/**
 * Valida estilo de surf
 * @param {Array} surfStyles - Estilos de surf
 * @returns {Array} Estilos válidos
 */
export function validateSurfStyle(surfStyles) {
  const validStyles = ['longboard', 'shortboard', 'any'];
  return surfStyles.filter(style => validStyles.includes(style));
}

/**
 * Valida preferência de vento
 * @param {Array} windPreferences - Preferências de vento
 * @returns {Array} Preferências válidas
 */
export function validateWindPreference(windPreferences) {
  const validPreferences = ['offshore', 'light', 'any'];
  return windPreferences.filter(pref => validPreferences.includes(pref));
}

/**
 * Atualiza o forecast do próximo dia para um agendamento específico
 * @param {string} schedulingId - ID do agendamento
 * @returns {Promise<Object|null>} Forecast atualizado ou null
 */
export async function updateNextDayForecast(schedulingId) {
  try {
    const scheduling = await getSchedulingById(schedulingId);
    if (!scheduling || !scheduling.active) {
      return null;
    }

    // Analisar janelas e extrair novo forecast
    const analysis = await analyzeWindows(scheduling);
    const nextDayForecast = extractNextDayForecast(analysis);
    
    if (!nextDayForecast) {
      logger.warn({ scheduling_id: schedulingId }, 'no forecast data available for update');
      return null;
    }

    // Atualizar no Firestore
    const db = getFirestore();
    await db.collection(COLLECTION_NAME).doc(schedulingId).update({
      next_day_forecast: nextDayForecast,
      updated_at: FirestoreUtils.dateToTimestamp(new Date())
    });

    logger.info({
      scheduling_id: schedulingId,
      best_time: nextDayForecast.best_window.time,
      score: nextDayForecast.best_window.score
    }, 'next day forecast updated');

    return nextDayForecast;
  } catch (error) {
    logger.error({
      error: error.message,
      scheduling_id: schedulingId
    }, 'failed to update next day forecast');
    return null;
  }
}

/**
 * Atualiza o forecast do próximo dia para todos os agendamentos ativos
 * @returns {Promise<Array>} Lista de resultados da atualização
 */
export async function updateAllNextDayForecasts() {
  try {
    const activeSchedulings = await getActiveSchedulings();
    const results = [];

    logger.info({ 
      total_schedulings: activeSchedulings.length 
    }, 'starting bulk forecast update');

    for (const scheduling of activeSchedulings) {
      try {
        const forecast = await updateNextDayForecast(scheduling.id);
        results.push({
          scheduling_id: scheduling.id,
          success: !!forecast,
          forecast
        });
      } catch (error) {
        results.push({
          scheduling_id: scheduling.id,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info({
      total: results.length,
      success: successCount,
      failed: results.length - successCount
    }, 'bulk forecast update completed');

    return results;
  } catch (error) {
    logger.error({ error: error.message }, 'failed to update all forecasts');
    return [];
  }
}
