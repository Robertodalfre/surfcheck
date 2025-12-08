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

// Debug logs para verificar se as rotas estão sendo registradas
logger.info('🚀 Registrando rotas...');
app.use('/spots', spotsRouter);
logger.info('✅ Rota /spots registrada');
app.use('/forecast', forecastRouter);
logger.info('✅ Rota /forecast registrada');
app.use('/scheduling', schedulingRouter);
logger.info('✅ Rota /scheduling registrada');
app.use('/notifications', notificationsRouter);
logger.info('✅ Rota /notifications registrada');
app.use('/analytics', analyticsRouter);
logger.info('✅ Rota /analytics registrada');
app.use('/regions', regionsRouter);
logger.info('✅ Rota /regions registrada');
app.use('/multi-scheduling', multiSchedulingRouter);
logger.info('✅ Rota /multi-scheduling registrada');
logger.info('🎉 Todas as rotas registradas com sucesso!');

export default app;
