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
   * GET /api/v1/node-types
   * Get list of all node types with optional filtering
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
   * GET /api/v1/node-types/categories
   * Get all available node categories
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
   * GET /api/v1/node-types/:nodeType
   * Get detailed information for a specific node type
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
   * POST /api/v1/node-types/validate
   * Validate workflow or node configuration
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
