import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';

import spotsRouter from './routes/spots.routes.js';
import forecastRouter from './routes/forecast.routes.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/spots', spotsRouter);
app.use('/forecast', forecastRouter);

export default app;
