import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { NodeMetadataService } from './services/nodeMetadataService';
import { createNodeTypesRouter } from './controllers/nodeTypesController';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './middleware/logger';

/**
 * Initialize and start the Express server
 */
async function startServer() {
  const app = express();

  // Middleware
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use(logger);

  // Health check endpoint
  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Health check
   *     description: Returns the health status of the API
   *     tags:
   *       - Health
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   */
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'n8n-forge-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Initialize node metadata service
  console.log('Initializing n8n-forge-api...');
  const nodeService = new NodeMetadataService();

  try {
    await nodeService.init();
    console.log('Node metadata service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize node metadata service:', error);
    process.exit(1);
  }

  // API routes
  const apiRouter = express.Router();

  // Swagger documentation
  apiRouter.use('/docs', swaggerUi.serve);
  apiRouter.get('/docs', swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'n8n Forge API Documentation',
  }));

  apiRouter.use('/node-types', createNodeTypesRouter(nodeService));

  app.use(`/api/${config.apiVersion}`, apiRouter);

  // Root endpoint
  /**
   * @openapi
   * /:
   *   get:
   *     summary: API information
   *     description: Returns basic information about the API and available endpoints
   *     tags:
   *       - Health
   *     responses:
   *       200:
   *         description: API information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 name:
   *                   type: string
   *                 version:
   *                   type: string
   *                 description:
   *                   type: string
   *                 endpoints:
   *                   type: object
   */
  app.get('/', (_req, res) => {
    res.json({
      name: 'n8n-forge-api',
      version: '1.0.0',
      description: 'REST API for n8n node type metadata and validation',
      documentation: `/api/${config.apiVersion}/docs`,
      endpoints: {
        health: '/health',
        docs: `/api/${config.apiVersion}/docs`,
        nodeTypes: `/api/${config.apiVersion}/node-types`,
        categories: `/api/${config.apiVersion}/node-types/categories`,
        nodeDetails: `/api/${config.apiVersion}/node-types/:nodeType`,
        validate: `/api/${config.apiVersion}/node-types/validate`,
      },
    });
  });

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Start server
  const server = app.listen(config.port, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('🚀 n8n-forge-api is running!');
    console.log('='.repeat(60));
    console.log(`📡 Server: http://localhost:${config.port}`);
    console.log(`🏥 Health: http://localhost:${config.port}/health`);
    console.log(`📚 Swagger Docs: http://localhost:${config.port}/api/${config.apiVersion}/docs`);
    console.log(`🔌 Node Types: http://localhost:${config.port}/api/${config.apiVersion}/node-types`);
    console.log('='.repeat(60));
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
