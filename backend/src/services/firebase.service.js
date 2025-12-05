import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;
let isInitialized = false;

/**
 * Inicializa Firebase Admin SDK
 */
export function initializeFirebase() {
  if (isInitialized) {
    return db;
  }

  try {
    // Se estiver em Cloud Functions/Run, use credenciais padrão do ambiente
    const isCloudEnv = Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.GOOGLE_CLOUD_PROJECT);
    if (isCloudEnv) {
      admin.initializeApp();
      db = admin.firestore();
      const databaseId = process.env.FIRESTORE_DATABASE_ID || 'surfcheckid';
      db.settings({ ignoreUndefinedProperties: true, databaseId });
      isInitialized = true;
      logger.info({ project_id: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT, database_id: databaseId }, 'Firebase Admin initialized with ADC (cloud env)');
      return db;
    }

    let serviceAccount;

    // Tentar carregar credenciais de diferentes formas
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Método 1: Arquivo de credenciais
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('.')
        ? join(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
        : process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    } else if (process.env.FIREBASE_PRIVATE_KEY) {
      // Método 2: Variáveis de ambiente individuais
      serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
        token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: `https://www.googleapis.com/oauth2/v1/certs`,
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
      };
    } else {
      // Método 3: Tentar arquivo padrão na pasta keys
      const defaultPath = join(process.cwd(), '..', 'keys', 'surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json');
      try {
        serviceAccount = JSON.parse(readFileSync(defaultPath, 'utf8'));
        logger.info('Using default Firebase credentials from keys folder');
      } catch (error) {
        throw new Error('Firebase credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or individual env vars');
      }
    }

    // Inicializar Firebase Admin (ambiente local/servidor)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    db = admin.firestore();
    
    // Configurações do Firestore
    const databaseId = process.env.FIRESTORE_DATABASE_ID || 'surfcheckid';
    db.settings({
      ignoreUndefinedProperties: true,
      databaseId
    });

    isInitialized = true;
    
    logger.info({
      project_id: serviceAccount.project_id,
      client_email: serviceAccount.client_email,
      database_id: process.env.FIRESTORE_DATABASE_ID || 'surfcheckid'
    }, 'Firebase Admin initialized successfully');

    return db;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to initialize Firebase Admin');
    throw error;
  }
}

/**
 * Retorna instância do Firestore
 */
export function getFirestore() {
  if (!db) {
    return initializeFirebase();
  }
  return db;
}

/**
 * Verifica se um token de autenticação é válido
 * @param {string} token - Token de autenticação
 * @returns {Promise<Object>} Dados do usuário decodificados
 */
export async function verifyAuthToken(token) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to verify auth token');
    throw new Error('Invalid authentication token');
  }
}

/**
 * Utilitários para conversão de dados Firestore
 */
export const FirestoreUtils = {
  /**
   * Converte timestamp Firestore para Date
   */
  timestampToDate(timestamp) {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp._seconds) return new Date(timestamp._seconds * 1000);
    return new Date(timestamp);
  },

  /**
   * Converte Date para timestamp Firestore
   */
  dateToTimestamp(date) {
    if (!date) return null;
    if (date instanceof Date) return admin.firestore.Timestamp.fromDate(date);
    return admin.firestore.Timestamp.fromDate(new Date(date));
  },

  /**
   * Converte documento Firestore para objeto JS
   */
  docToObject(doc) {
    if (!doc.exists) return null;
    
    const data = doc.data();
    const result = { id: doc.id };
    
    // Converter timestamps automaticamente
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && value.toDate) {
        result[key] = value.toDate();
      } else {
        result[key] = value;
      }
    }
    
    return result;
  },

  /**
   * Converte array de documentos Firestore
   */
  docsToArray(querySnapshot) {
    return querySnapshot.docs.map(doc => this.docToObject(doc));
  }
};

// Inicializar automaticamente se não estiver em teste
if (process.env.NODE_ENV !== 'test') {
  initializeFirebase();
}
