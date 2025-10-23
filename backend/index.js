import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import app from './src/app.js';

// HTTP function delegando para o app Express
const STORMGLASS_API_KEY = defineSecret('STORMGLASS_API_KEY');
export const api = onRequest({ region: 'southamerica-east1', cors: true, secrets: [STORMGLASS_API_KEY] }, app);
