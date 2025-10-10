import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'n8n Forge API',
      version: '1.0.0',
      description: 'REST API service for n8n node type metadata and validation',
      contact: {
        name: 'API Support',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: `http://localhost:${config.port}/api/${config.apiVersion}`,
        description: 'API Base URL',
      },
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Node Types',
        description: 'Node type metadata and information',
      },
      {
        name: 'Validation',
        description: 'Workflow and node validation',
      },
    ],
    components: {
      schemas: {
        NodeTypeMetadata: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The technical name of the node type',
              example: 'n8n-nodes-base.httpRequest',
            },
            displayName: {
              type: 'string',
              description: 'The human-readable name of the node',
              example: 'HTTP Request',
            },
            description: {
              type: 'string',
              description: 'Description of what the node does',
              example: 'Makes an HTTP request and returns the response data',
            },
            category: {
              type: 'string',
              description: 'Category the node belongs to',
              example: 'Core Nodes',
            },
            version: {
              oneOf: [
                { type: 'number' },
                { type: 'array', items: { type: 'number' } },
              ],
              description: 'Version(s) of the node',
              example: 1,
            },
            defaultVersion: {
              type: 'number',
              description: 'Default version to use',
              example: 1,
            },
            icon: {
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    light: { type: 'string' },
                    dark: { type: 'string' },
                  },
                },
              ],
              description: 'Icon identifier or theme-specific icons',
            },
            group: {
              type: 'array',
              items: { type: 'string' },
              description: 'Node groups',
              example: ['trigger'],
            },
            inputs: {
              type: 'array',
              items: { type: 'string' },
              description: 'Input types accepted',
              example: ['main'],
            },
            outputs: {
              type: 'array',
              items: { type: 'string' },
              description: 'Output types produced',
              example: ['main'],
            },
            credentials: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  required: { type: 'boolean' },
                },
              },
              description: 'Credentials required by the node',
            },
            webhooks: {
              type: 'boolean',
              description: 'Whether the node uses webhooks',
            },
          },
        },
        NodeCategory: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Category identifier',
              example: 'Core Nodes',
            },
            displayName: {
              type: 'string',
              description: 'Display name of the category',
              example: 'Core Nodes',
            },
            count: {
              type: 'number',
              description: 'Number of nodes in this category',
              example: 42,
            },
            nodeTypes: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of node type names in this category',
              example: ['n8n-nodes-base.httpRequest', 'n8n-nodes-base.set'],
            },
          },
        },
        ValidationRequest: {
          type: 'object',
          properties: {
            workflow: {
              type: 'object',
              properties: {
                nodes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        description: 'Node type name',
                        example: 'n8n-nodes-base.httpRequest',
                      },
                      typeVersion: {
                        type: 'number',
                        description: 'Version of the node type',
                        example: 1,
                      },
                      parameters: {
                        type: 'object',
                        description: 'Node parameters',
                        additionalProperties: true,
                      },
                    },
                    required: ['type'],
                  },
                },
              },
              description: 'Workflow to validate',
            },
            node: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description: 'Node type name',
                  example: 'n8n-nodes-base.httpRequest',
                },
                typeVersion: {
                  type: 'number',
                  description: 'Version of the node type',
                  example: 1,
                },
                parameters: {
                  type: 'object',
                  description: 'Node parameters',
                  additionalProperties: true,
                },
              },
              required: ['type'],
              description: 'Single node to validate',
            },
          },
          description: 'Either workflow or node must be provided',
        },
        ValidationError: {
          type: 'object',
          properties: {
            field: {
              type: 'string',
              description: 'Field that has the error',
              example: 'parameters.url',
            },
            message: {
              type: 'string',
              description: 'Error message',
              example: 'URL is required',
            },
            severity: {
              type: 'string',
              enum: ['error', 'warning'],
              description: 'Severity of the issue',
            },
            nodeType: {
              type: 'string',
              description: 'Node type where error occurred',
              example: 'n8n-nodes-base.httpRequest',
            },
            nodeName: {
              type: 'string',
              description: 'Node name where error occurred',
            },
          },
        },
        ValidationResponse: {
          type: 'object',
          properties: {
            valid: {
              type: 'boolean',
              description: 'Whether the validation passed',
              example: true,
            },
            errors: {
              type: 'array',
              items: { $ref: '#/components/schemas/ValidationError' },
              description: 'List of validation errors',
            },
            warnings: {
              type: 'array',
              items: { $ref: '#/components/schemas/ValidationError' },
              description: 'List of validation warnings',
            },
          },
        },
        PaginationInfo: {
          type: 'object',
          properties: {
            total: {
              type: 'number',
              description: 'Total number of items',
              example: 150,
            },
            limit: {
              type: 'number',
              description: 'Number of items per page',
              example: 20,
            },
            offset: {
              type: 'number',
              description: 'Offset for pagination',
              example: 0,
            },
            hasMore: {
              type: 'boolean',
              description: 'Whether there are more items',
              example: true,
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              description: 'Response data',
            },
            pagination: {
              $ref: '#/components/schemas/PaginationInfo',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Node type not found',
            },
            statusCode: {
              type: 'number',
              description: 'HTTP status code',
              example: 404,
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok',
            },
            service: {
              type: 'string',
              example: 'n8n-forge-api',
            },
            version: {
              type: 'string',
              example: '1.0.0',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
            },
          },
        },
      },
    },
  },
  apis: ['./src/index.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

