import { Router, Request, Response, NextFunction } from 'express';
import { NodeMetadataService } from '../services/nodeMetadataService';
import { Validator } from '../utils/validator';
import { ApiError } from '../middleware/errorHandler';
import { config } from '../config';
import { NodeTypeFilters, ValidationRequest } from '../types';

export function createNodeTypesRouter(
  nodeService: NodeMetadataService
): Router {
  const router = Router();
  const validator = new Validator(nodeService);

  /**
   * @openapi
   * /api/v1/node-types:
   *   get:
   *     summary: Get all node types
   *     description: Retrieve a list of all available n8n node types with optional filtering and pagination
   *     tags:
   *       - Node Types
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by category name
   *         example: Core Nodes
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term to filter node types by name or description
   *         example: http
   *       - in: query
   *         name: group
   *         schema:
   *           type: string
   *         description: Filter by node group
   *         example: trigger
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Maximum number of results to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Offset for pagination
   *     responses:
   *       200:
   *         description: List of node types retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/NodeTypeMetadata'
   *       400:
   *         description: Invalid request parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: NodeTypeFilters = {
        category: req.query.category as string,
        search: req.query.search as string,
        group: req.query.group as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };

      // Validate pagination params
      if (filters.limit && filters.limit > config.maxPageLimit) {
        throw new ApiError(400, `Limit cannot exceed ${config.maxPageLimit}`);
      }

      if (filters.offset && filters.offset < 0) {
        throw new ApiError(400, 'Offset cannot be negative');
      }

      const { nodes, total } = await nodeService.getNodeTypes(filters);

      const limit = filters.limit || config.defaultPageLimit;
      const offset = filters.offset || 0;

      res.json({
        success: true,
        data: nodes,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/v1/node-types/categories:
   *   get:
   *     summary: Get all node categories
   *     description: Retrieve a list of all available node categories with counts
   *     tags:
   *       - Node Types
   *     responses:
   *       200:
   *         description: List of categories retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/NodeCategory'
   */
  router.get(
    '/categories',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const categories = await nodeService.getCategories();

        res.json({
          success: true,
          data: categories,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * @openapi
   * /api/v1/node-types/{nodeType}:
   *   get:
   *     summary: Get node type details
   *     description: Retrieve detailed information for a specific node type
   *     tags:
   *       - Node Types
   *     parameters:
   *       - in: path
   *         name: nodeType
   *         required: true
   *         schema:
   *           type: string
   *         description: The full node type name (e.g., n8n-nodes-base.httpRequest)
   *         example: n8n-nodes-base.httpRequest
   *     responses:
   *       200:
   *         description: Node type details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/NodeTypeMetadata'
   *       400:
   *         description: Node type parameter is required
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Node type not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get(
    '/:nodeType(*)',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const nodeType = req.params.nodeType;

        if (!nodeType) {
          throw new ApiError(400, 'Node type parameter is required');
        }

        const details = await nodeService.getNodeTypeDetails(nodeType);

        if (!details) {
          throw new ApiError(404, `Node type '${nodeType}' not found`);
        }

        res.json({
          success: true,
          data: details,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * @openapi
   * /api/v1/node-types/validate:
   *   post:
   *     summary: Validate workflow or node
   *     description: Validate a workflow or a single node configuration against n8n node type definitions
   *     tags:
   *       - Validation
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ValidationRequest'
   *           examples:
   *             validateNode:
   *               summary: Validate a single node
   *               value:
   *                 node:
   *                   type: n8n-nodes-base.httpRequest
   *                   typeVersion: 1
   *                   parameters:
   *                     url: https://api.example.com
   *                     method: GET
   *             validateWorkflow:
   *               summary: Validate a workflow
   *               value:
   *                 workflow:
   *                   nodes:
   *                     - type: n8n-nodes-base.httpRequest
   *                       typeVersion: 1
   *                       parameters:
   *                         url: https://api.example.com
   *                         method: GET
   *                     - type: n8n-nodes-base.set
   *                       typeVersion: 1
   *                       parameters:
   *                         values:
   *                           string:
   *                             - name: result
   *                               value: success
   *     responses:
   *       200:
   *         description: Validation completed successfully
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/ValidationResponse'
   *       400:
   *         description: Invalid request body
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post(
    '/validate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validationRequest: ValidationRequest = req.body;

        if (!validationRequest.workflow && !validationRequest.node) {
          throw new ApiError(
            400,
            'Either workflow or node must be provided for validation'
          );
        }

        const result = await validator.validate(validationRequest);

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
