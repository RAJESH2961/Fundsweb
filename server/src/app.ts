import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import routes from './routes';
import { swaggerSpec } from './swagger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 500,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => res.json({ success: true, message: 'OK' }));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
