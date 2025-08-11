import 'dotenv/config';
import pino from 'pino';
import app from './app.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => logger.info({ PORT }, 'SurfCheck backend running (local dev)'));
