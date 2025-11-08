import admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let app = null;
let firestoreInstance = null;

export function initializeFirebase() {
  if (app) return app;

  try {
    // Check if running in emulator mode
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      console.log('Using Firestore emulator at:', process.env.FIRESTORE_EMULATOR_HOST);
      app = admin.initializeApp({
        projectId: 'demo-project'
      });
      return app;
    }

    // Production mode - use service account
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.resolve(__dirname, '../../../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json');
    
    if (!credentialsPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set');
    }

    const serviceAccountJson = readFileSync(credentialsPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    const options = {
      credential: admin.credential.cert(serviceAccount)
    };
    
    if (serviceAccount.project_id) {
      options.projectId = serviceAccount.project_id;
    } else {
      options.projectId = 'surfcheck-44df4';
    }
    
    console.log('Firebase initialized with service account');
    console.log('Project ID:', options.projectId);
    console.log('Using Firestore region: southamerica-east1 (São Paulo)');
    console.log('Using default database');
    
    app = admin.initializeApp(options);
    return app;
    
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    throw error;
  }
}

export function getFirestore() {
  if (firestoreInstance) {
    return firestoreInstance;
  }
  
  try {
    // Check if running in emulator mode
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      if (!app) {
        initializeFirebase();
      }
      firestoreInstance = admin.firestore(app);
      return firestoreInstance;
    }

    // Production mode - use direct Firestore client with São Paulo region
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.resolve(__dirname, '../../../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json');
    
    firestoreInstance = new Firestore({
      projectId: 'surfcheck-44df4',
      keyFilename: credentialsPath
      // Removido databaseId para usar o database padrão
    });
    
    console.log('Firestore inicializado: região São Paulo, database padrão');
    return firestoreInstance;
    
  } catch (error) {
    console.error('Erro ao inicializar Firestore:', error.message);
    throw error;
  }
}
