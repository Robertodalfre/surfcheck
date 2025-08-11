import { onRequest } from 'firebase-functions/v2/https';
import app from './src/app.js';

// HTTP function delegando para o app Express
export const api = onRequest({ region: 'southamerica-east1', cors: true }, app);
