import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';

import spotsRouter from './routes/spots.routes.js';
import forecastRouter from './routes/forecast.routes.js';
import schedulingRouter from './routes/scheduling.routes.js';
import notificationsRouter from './routes/notifications.routes.js';
import analyticsRouter from './routes/analytics.routes.js';
import regionsRouter from './routes/regions.routes.js';
import multiSchedulingRouter from './routes/multi-scheduling.routes.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/spots', spotsRouter);
app.use('/forecast', forecastRouter);
app.use('/scheduling', schedulingRouter);
app.use('/notifications', notificationsRouter);
app.use('/analytics', analyticsRouter);
app.use('/regions', regionsRouter);
app.use('/multi-scheduling', multiSchedulingRouter);

export default app;
