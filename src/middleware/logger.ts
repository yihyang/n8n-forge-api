import morgan from 'morgan';
import { config } from '../config';

/**
 * Logger middleware using morgan
 */
export const logger = morgan(
  config.nodeEnv === 'production' ? 'combined' : 'dev',
  {
    skip: (req, _res) => {
      // Skip logging for health check endpoint
      return req.url === '/health';
    },
  }
);
