import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // API
  apiVersion: process.env.API_VERSION || 'v1',

  // Cache
  cacheTTL: parseInt(process.env.CACHE_TTL || '3600000', 10), // 1 hour default

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // n8n
  nodePackages: ['n8n-nodes-base'] as const,

  // Pagination
  defaultPageLimit: 20,
  maxPageLimit: 100,
} as const;

export type Config = typeof config;
