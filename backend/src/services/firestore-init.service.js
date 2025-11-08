import { getFirestore } from '../services/firebase.service.js';
import admin from 'firebase-admin';
import logger from '../utils/logger.js';

/**
 * Serviço para inicialização automática das coleções do Firestore
 * Similar ao padrão usado para a coleção 'tides'
 */

let initialized = false;

/**
 * Verifica se uma coleção existe e tem documentos
 */
async function collectionExists(db, collectionName) {
  try {
    const snapshot = await db.collection(collectionName).limit(1).get();
    return !snapshot.empty;
  } catch (error) {
    logger.warn({ error: error.message, collection: collectionName }, 'error checking collection existence');
    return false;
  }
}

/**
 * Cria documento inicial na coleção schedulings
 */
async function initSchedulingsCollection(db) {
  try {
    logger.info('📝 Criando coleção "schedulings"...');
    
    const schedulingsRef = db.collection('schedulings').doc('_init_document');
    await schedulingsRef.set({
      _type: 'init_document',
      message: 'Documento inicial para criar a coleção schedulings',
      createdAt: admin.firestore.Timestamp.now(),
      source: 'auto-init-service',
      temporary: true,
      // Estrutura de exemplo para referência
      example_structure: {
        uid: 'string - ID do usuário',
        spot_id: 'string - ID do pico',
        active: 'boolean - Se o agendamento está ativo',
        preferences: {
          surf_style: 'array - ["longboard", "shortboard"]',
          time_windows: 'array - ["06:00-09:00", "16:00-19:00"]',
          min_score: 'number - Score mínimo (0-100)',
          wind_preference: 'string - "offshore", "onshore", "any"',
          swell_direction: 'array - [180, 220] (graus)'
        },
        notifications: {
          enabled: 'boolean - Se notificações estão ativas',
          advance_hours: 'number - Horas de antecedência',
          daily_summary: 'boolean - Se envia resumo diário'
        },
        created_at: 'timestamp',
        updated_at: 'timestamp'
      }
    });
    
    logger.info('✅ Coleção "schedulings" criada com sucesso!');
    return true;
  } catch (error) {
    logger.error({ error: error.message }, 'failed to create schedulings collection');
    return false;
  }
}

/**
 * Cria documento inicial na coleção analytics
 */
async function initAnalyticsCollection(db) {
  try {
    logger.info('📝 Criando coleção "analytics"...');
    
    const analyticsRef = db.collection('analytics').doc('_init_document');
    await analyticsRef.set({
      _type: 'init_document',
      message: 'Documento inicial para criar a coleção analytics',
      createdAt: admin.firestore.Timestamp.now(),
      source: 'auto-init-service',
      temporary: true,
      // Estrutura de exemplo para referência
      example_structure: {
        uid: 'string - ID do usuário',
        data: {
          windows_viewed: 'number - Janelas visualizadas',
          windows_surfed: 'number - Janelas surfadas',
          total_sessions: 'number - Total de sessões',
          surf_rate: 'number - Taxa de surf (%)',
          avg_surfed_score: 'number - Score médio das sessões',
          last_activity: 'timestamp - Última atividade',
          favorite_spots: 'array - Picos favoritos',
          preferred_times: 'object - Horários preferidos',
          badges: 'array - Badges conquistados'
        },
        created_at: 'timestamp',
        updated_at: 'timestamp'
      }
    });
    
    logger.info('✅ Coleção "analytics" criada com sucesso!');
    return true;
  } catch (error) {
    logger.error({ error: error.message }, 'failed to create analytics collection');
    return false;
  }
}

/**
 * Cria documento inicial na coleção window_history (para histórico de janelas)
 */
async function initWindowHistoryCollection(db) {
  try {
    logger.info('📝 Criando coleção "window_history"...');
    
    const historyRef = db.collection('window_history').doc('_init_document');
    await historyRef.set({
      _type: 'init_document',
      message: 'Documento inicial para criar a coleção window_history',
      createdAt: admin.firestore.Timestamp.now(),
      source: 'auto-init-service',
      temporary: true,
      // Estrutura de exemplo para referência
      example_structure: {
        uid: 'string - ID do usuário',
        scheduling_id: 'string - ID do agendamento',
        window_data: {
          spot_id: 'string - ID do pico',
          start_time: 'timestamp - Início da janela',
          end_time: 'timestamp - Fim da janela',
          score: 'number - Score da janela',
          conditions: 'object - Condições da janela'
        },
        action: 'string - "surfed", "missed", "viewed"',
        timestamp: 'timestamp - Quando a ação ocorreu'
      }
    });
    
    logger.info('✅ Coleção "window_history" criada com sucesso!');
    return true;
  } catch (error) {
    logger.error({ error: error.message }, 'failed to create window_history collection');
    return false;
  }
}

/**
 * Inicializa todas as coleções necessárias automaticamente
 */
export async function ensureCollectionsExist() {
  if (initialized) {
    return true;
  }

  try {
    logger.info('🔍 Verificando coleções do Firestore...');
    
    const db = getFirestore();
    
    // Lista de coleções necessárias
    const collections = [
      { name: 'schedulings', initFn: initSchedulingsCollection },
      { name: 'analytics', initFn: initAnalyticsCollection },
      { name: 'window_history', initFn: initWindowHistoryCollection }
    ];

    let createdCount = 0;
    
    for (const collection of collections) {
      const exists = await collectionExists(db, collection.name);
      
      if (!exists) {
        logger.info({ collection: collection.name }, 'collection not found, creating...');
        const success = await collection.initFn(db);
        if (success) {
          createdCount++;
        }
      } else {
        logger.info({ collection: collection.name }, 'collection already exists');
      }
    }

    if (createdCount > 0) {
      logger.info({ created: createdCount }, 'collections auto-initialized');
    } else {
      logger.info('all collections already exist');
    }

    initialized = true;
    return true;
    
  } catch (error) {
    logger.error({ error: error.message }, 'failed to ensure collections exist');
    return false;
  }
}

/**
 * Limpa documentos de inicialização (opcional, para limpeza)
 */
export async function cleanupInitDocuments() {
  try {
    logger.info('🧹 Limpando documentos de inicialização...');
    
    const db = getFirestore();
    const collections = ['schedulings', 'analytics', 'window_history'];
    
    for (const collectionName of collections) {
      try {
        const initDocRef = db.collection(collectionName).doc('_init_document');
        const doc = await initDocRef.get();
        
        if (doc.exists) {
          await initDocRef.delete();
          logger.info({ collection: collectionName }, 'init document removed');
        }
      } catch (error) {
        logger.warn({ error: error.message, collection: collectionName }, 'failed to remove init document');
      }
    }
    
    logger.info('✅ Limpeza de documentos de inicialização concluída');
    
  } catch (error) {
    logger.error({ error: error.message }, 'failed to cleanup init documents');
  }
}

export default {
  ensureCollectionsExist,
  cleanupInitDocuments
};
