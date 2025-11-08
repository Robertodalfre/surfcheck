import { v4 as uuidv4 } from 'uuid';
import { getFirestore, FirestoreUtils } from '../services/firebase.service.js';
import logger from '../utils/logger.js';
import { getSpotById } from './spots.model.js';

const COLLECTION_NAME = 'schedulings';

/**
 * Modelo de dados para agendamentos
 * @typedef {Object} Scheduling
 * @property {string} id - ID único do agendamento
 * @property {string} uid - Firebase User ID
 * @property {string} spot_id - ID do pico
 * @property {boolean} active - Se o agendamento está ativo
 * @property {Date} created_at - Data de criação
 * @property {Date} updated_at - Data de última atualização
 * @property {Object} preferences - Preferências do usuário
 * @property {number} preferences.days_ahead - Quantos dias à frente (1, 3, 5)
 * @property {string[]} preferences.time_windows - Janelas de tempo ['morning', 'midday', 'afternoon', 'evening']
 * @property {number} preferences.min_score - Score mínimo desejado (0-100)
 * @property {string} preferences.surf_style - Estilo de surf ('longboard', 'shortboard', 'any')
 * @property {string} preferences.wind_preference - Preferência de vento ('offshore', 'light', 'any')
 * @property {number} preferences.min_energy - Energia mínima em kW/m
 * @property {Object} notifications - Configurações de notificação
 * @property {boolean} notifications.push_enabled - Se notificações push estão ativas
 * @property {number} notifications.advance_hours - Horas de antecedência para alertas
 * @property {boolean} notifications.daily_summary - Resumo diário às 8h
 * @property {boolean} notifications.special_alerts - Alertas especiais para score > 90
 */

/**
 * Cria um novo agendamento
 * @param {Object} data - Dados do agendamento
 * @returns {Scheduling} Agendamento criado
 */
export function createScheduling(data) {
  // Validações básicas
  if (!data.uid) {
    throw new Error('UID do usuário é obrigatório');
  }
  
  if (!data.spot_id) {
    throw new Error('ID do pico é obrigatório');
  }

  // Verifica se o pico existe
  const spot = getSpotById(data.spot_id);
  if (!spot) {
    throw new Error(`Pico com ID '${data.spot_id}' não encontrado`);
  }

  // Valores padrão para preferências
  const defaultPreferences = {
    days_ahead: 3,
    time_windows: ['morning', 'afternoon'],
    min_score: 60,
    surf_style: 'any',
    wind_preference: 'offshore',
    min_energy: 3.0
  };

  // Valores padrão para notificações
  const defaultNotifications = {
    push_enabled: true,
    advance_hours: 1,
    daily_summary: true,
    special_alerts: true
  };

  const scheduling = {
    id: uuidv4(),
    uid: data.uid,
    spot_id: data.spot_id,
    active: data.active !== undefined ? data.active : true,
    created_at: new Date(),
    updated_at: new Date(),
    preferences: { ...defaultPreferences, ...data.preferences },
    notifications: { ...defaultNotifications, ...data.notifications }
  };

  schedulings.push(scheduling);
  return scheduling;
}

/**
 * Busca agendamentos por UID do usuário
 * @param {string} uid - Firebase User ID
 * @returns {Scheduling[]} Lista de agendamentos
 */
export function getSchedulingsByUser(uid) {
  return schedulings.filter(s => s.uid === uid);
}

/**
 * Busca agendamento por ID
 * @param {string} id - ID do agendamento
 * @returns {Scheduling|null} Agendamento encontrado ou null
 */
export function getSchedulingById(id) {
  return schedulings.find(s => s.id === id) || null;
}

/**
 * Atualiza um agendamento
 * @param {string} id - ID do agendamento
 * @param {Object} updates - Dados para atualizar
 * @returns {Scheduling|null} Agendamento atualizado ou null
 */
export function updateScheduling(id, updates) {
  const index = schedulings.findIndex(s => s.id === id);
  if (index === -1) return null;

  // Não permite alterar campos protegidos
  const { id: _, uid: __, created_at: ___, ...allowedUpdates } = updates;
  
  schedulings[index] = {
    ...schedulings[index],
    ...allowedUpdates,
    updated_at: new Date()
  };

  return schedulings[index];
}

/**
 * Remove um agendamento
 * @param {string} id - ID do agendamento
 * @returns {boolean} True se removido com sucesso
 */
export function deleteScheduling(id) {
  const index = schedulings.findIndex(s => s.id === id);
  if (index === -1) return false;

  schedulings.splice(index, 1);
  return true;
}

/**
 * Busca agendamentos ativos
 * @returns {Scheduling[]} Lista de agendamentos ativos
 */
export function getActiveSchedulings() {
  return schedulings.filter(s => s.active);
}

/**
 * Busca agendamentos por pico
 * @param {string} spotId - ID do pico
 * @returns {Scheduling[]} Lista de agendamentos para o pico
 */
export function getSchedulingsBySpot(spotId) {
  return schedulings.filter(s => s.spot_id === spotId);
}

/**
 * Valida janelas de tempo
 * @param {string[]} timeWindows - Array de janelas
 * @returns {boolean} True se válido
 */
export function validateTimeWindows(timeWindows) {
  const validWindows = ['morning', 'midday', 'afternoon', 'evening'];
  return Array.isArray(timeWindows) && 
         timeWindows.length > 0 && 
         timeWindows.every(w => validWindows.includes(w));
}

/**
 * Valida estilo de surf
 * @param {string} surfStyle - Estilo de surf
 * @returns {boolean} True se válido
 */
export function validateSurfStyle(surfStyle) {
  const validStyles = ['longboard', 'shortboard', 'any'];
  return validStyles.includes(surfStyle);
}

/**
 * Valida preferência de vento
 * @param {string} windPreference - Preferência de vento
 * @returns {boolean} True se válido
 */
export function validateWindPreference(windPreference) {
  const validPreferences = ['offshore', 'light', 'any'];
  return validPreferences.includes(windPreference);
}

// Para desenvolvimento - função para limpar dados
export function clearAllSchedulings() {
  schedulings = [];
}

// Para desenvolvimento - função para popular dados de teste
export function seedTestData() {
  clearAllSchedulings();
  
  // Dados de teste
  const testSchedulings = [
    {
      uid: 'test-user-1',
      spot_id: 'sape',
      preferences: {
        days_ahead: 3,
        time_windows: ['morning', 'afternoon'],
        min_score: 70,
        surf_style: 'longboard',
        wind_preference: 'offshore',
        min_energy: 2.5
      }
    },
    {
      uid: 'test-user-1',
      spot_id: 'itamambuca',
      preferences: {
        days_ahead: 5,
        time_windows: ['morning'],
        min_score: 80,
        surf_style: 'shortboard',
        wind_preference: 'offshore',
        min_energy: 4.0
      }
    }
  ];

  testSchedulings.forEach(data => createScheduling(data));
}
