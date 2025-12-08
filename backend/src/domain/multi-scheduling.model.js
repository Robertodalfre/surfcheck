import { v4 as uuidv4 } from 'uuid';
import { getFirestore, FirestoreUtils } from '../services/firebase.service.js';
import { ensureCollectionsExist } from '../services/firestore-init.service.js';
import logger from '../utils/logger.js';
import { getRegions, getSpotsByRegion } from './spots.model.js';
import { analyzeWindows } from '../services/window-analysis.service.js';

const COLLECTION_NAME = 'multi_schedulings';

/**
 * Modelo de dados para agendamentos multi-pico (por região)
 * @typedef {Object} MultiScheduling
 * @property {string} id
 * @property {string} uid
 * @property {string} region           // ex: 'ubatuba'
 * @property {string} regionName       // ex: 'Ubatuba (SP)'
 * @property {string[]} spots          // lista de spot_ids pertencentes à região
 * @property {boolean} active
 * @property {Date} created_at
 * @property {Date} updated_at
 * @property {Object} preferences      // mesmo formato do scheduling tradicional
 * @property {Object} notifications    // mesmo formato do scheduling tradicional
 * @property {Object|null} region_analysis // resultado consolidado (best_spot, spots_ranking...)
 */

function validatePreferences(preferences = {}) {
  return {
    days_ahead: 3,
    time_windows: ['morning', 'midday', 'afternoon'], // Expandir janelas para capturar melhor horário
    min_score: 0, // Score mínimo 0 para capturar todos os horários e mostrar o melhor real
    surf_style: 'any',
    wind_preference: 'any',
    min_energy: 0.5, // Energia mínima mais baixa
    ...preferences
  };
}

function validateNotifications(notifications = {}) {
  return {
    advance_hours: 1,
    push_enabled: true,
    daily_summary: true,
    special_alerts: true,
    fixed_time: null,
    timezone: 'America/Sao_Paulo',
    // Nota: frequência 2x/dia será aplicada nas rotinas de notificação (Fase 4)
    ...notifications
  };
}

export async function createMultiScheduling(data) {
  const db = getFirestore();

  // Validações básicas
  if (!data.uid || !data.region) {
    throw new Error('UID e region são obrigatórios');
  }

  const regions = getRegions();
  const regionDef = regions.find(r => r.id === data.region);
  if (!regionDef) {
    throw new Error(`Região '${data.region}' não encontrada`);
  }

  const regionSpots = getSpotsByRegion(data.region).map(s => s.id);
  if (!regionSpots || regionSpots.length === 0) {
    throw new Error(`Nenhum spot configurado para a região '${data.region}'`);
  }

  const preferences = validatePreferences(data.preferences || {});
  const notifications = validateNotifications(data.notifications || {});

  const multi = {
    id: uuidv4(),
    uid: data.uid,
    region: data.region,
    regionName: regionDef.name,
    spots: data.spots && data.spots.length > 0
      ? data.spots.filter(id => regionSpots.includes(id))
      : regionSpots, // por padrão, todos os spots da região
    active: data.active !== undefined ? data.active : true,
    preferences,
    notifications,
    created_at: new Date(),
    updated_at: new Date(),
    region_analysis: null // será preenchido por serviço específico (Fase 2)
  };

  // Apenas garantir coleções
  await ensureCollectionsExist();

  await db.collection(COLLECTION_NAME).doc(multi.id).set({
    ...multi,
    created_at: FirestoreUtils.dateToTimestamp(multi.created_at),
    updated_at: FirestoreUtils.dateToTimestamp(multi.updated_at)
  });

  logger.info({ id: multi.id, uid: multi.uid, region: multi.region }, 'multi scheduling created');
  return multi;
}

export async function getMultiSchedulingsByUser(uid) {
  const db = getFirestore();
  const snap = await db
    .collection(COLLECTION_NAME)
    .where('uid', '==', uid)
    .get();

  // Ordenar no código para evitar necessidade de índice composto
  const docs = snap.docs.map(FirestoreUtils.docToObject);
  return docs.sort((a, b) => {
    const dateA = a.created_at?.toDate?.() || new Date(a.created_at);
    const dateB = b.created_at?.toDate?.() || new Date(b.created_at);
    return dateB - dateA; // desc
  });
}

export async function getMultiSchedulingById(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION_NAME).doc(id).get();
  if (!doc.exists) return null;
  return FirestoreUtils.docToObject(doc);
}

export async function updateMultiScheduling(id, updates) {
  const db = getFirestore();
  const current = await getMultiSchedulingById(id);
  if (!current) throw new Error('Agendamento multi-pico não encontrado');

  const regionSpots = current.region ? getSpotsByRegion(current.region).map(s => s.id) : [];

  const payload = {
    updated_at: FirestoreUtils.dateToTimestamp(new Date())
  };

  if (updates.active !== undefined) payload.active = updates.active;
  if (updates.region && updates.region !== current.region) {
    // Trocar de região: recalcula regionName e spots compatíveis
    const regions = getRegions();
    const regionDef = regions.find(r => r.id === updates.region);
    if (!regionDef) throw new Error(`Região '${updates.region}' não encontrada`);
    payload.region = updates.region;
    payload.regionName = regionDef.name;
    payload.spots = getSpotsByRegion(updates.region).map(s => s.id);
  }
  if (updates.spots) {
    payload.spots = updates.spots.filter((id) => regionSpots.includes(id));
  }
  if (updates.preferences) payload.preferences = validatePreferences(updates.preferences);
  if (updates.notifications) payload.notifications = validateNotifications(updates.notifications);

  await db.collection(COLLECTION_NAME).doc(id).update(payload);
  logger.info({ id, updates: Object.keys(payload) }, 'multi scheduling updated');
  return await getMultiSchedulingById(id);
}

export async function deleteMultiScheduling(id) {
  const db = getFirestore();
  const doc = await db.collection(COLLECTION_NAME).doc(id).get();
  if (!doc.exists) throw new Error('Agendamento multi-pico não encontrado');
  await db.collection(COLLECTION_NAME).doc(id).delete();
  logger.info({ id }, 'multi scheduling deleted');
  return true;
}

export async function getActiveMultiSchedulings() {
  const db = getFirestore();
  const snap = await db
    .collection(COLLECTION_NAME)
    .where('active', '==', true)
    .get();
  
  return snap.docs.map(FirestoreUtils.docToObject);
}
