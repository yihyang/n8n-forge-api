import { NodeMetadataService } from '../services/nodeMetadataService';
import { ValidationRequest, ValidationResponse, ValidationError } from '../types';

/**
 * Validate workflow or node configuration
 */
export class Validator {
  constructor(private nodeService: NodeMetadataService) {}

  /**
   * Validate a workflow or single node
   */
  async validate(request: ValidationRequest): Promise<ValidationResponse> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (request.workflow) {
      // Validate all nodes in workflow
      for (const node of request.workflow.nodes) {
        const nodeErrors = await this.validateNode(node);
        errors.push(...nodeErrors.filter(e => e.severity === 'error'));
        warnings.push(...nodeErrors.filter(e => e.severity === 'warning'));
      }
    } else if (request.node) {
      // Validate single node
      const nodeErrors = await this.validateNode(request.node);
      errors.push(...nodeErrors.filter(e => e.severity === 'error'));
      warnings.push(...nodeErrors.filter(e => e.severity === 'warning'));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single node configuration
   */
  private async validateNode(node: {
    type: string;
    typeVersion?: number;
    parameters?: Record<string, any>;
  }): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check if node type exists
    const validation = await this.nodeService.validateNodeType(
      node.type,
      node.typeVersion
    );

    if (!validation.valid) {
      errors.push({
        field: 'type',
        message: validation.error || 'Invalid node type',
        severity: 'error',
        nodeType: node.type,
      });
      return errors; // Can't validate further if type is invalid
    }

    // Get node details for parameter validation
    const details = await this.nodeService.getNodeTypeDetails(node.type);
    if (!details) {
      errors.push({
        field: 'type',
        message: `Could not load details for node type: ${node.type}`,
        severity: 'error',
        nodeType: node.type,
      });
      return errors;
    }

    // Validate parameters if provided
    const properties = (details as any).properties;
    if (node.parameters && properties) {
      const paramErrors = this.validateParameters(
        node.parameters,
        properties,
        node.type
      );
      errors.push(...paramErrors);
    }

    // Check for required parameters
    if (properties) {
      const requiredParams = properties.filter((p: any) => p.required);
      for (const param of requiredParams) {
        if (!node.parameters || !(param.name in node.parameters)) {
          errors.push({
            field: param.name,
            message: `Required parameter '${param.displayName || param.name}' is missing`,
            severity: 'error',
            nodeType: node.type,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate node parameters against schema
   */
  private validateParameters(
    parameters: Record<string, any>,
    schema: any[],
    nodeType: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const paramSchema = schema.find(p => p.name === paramName);

      if (!paramSchema) {
        errors.push({
          field: paramName,
          message: `Unknown parameter: ${paramName}`,
          severity: 'warning',
          nodeType,
        });
        continue;
      }

      // Basic type validation
      if (paramSchema.type && paramValue !== null && paramValue !== undefined) {
        const typeValid = this.validateParameterType(
          paramValue,
          paramSchema.type
        );

        if (!typeValid) {
          errors.push({
            field: paramName,
            message: `Parameter '${paramName}' should be of type '${paramSchema.type}' but got '${typeof paramValue}'`,
            severity: 'error',
            nodeType,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate parameter type
   */
  private validateParameterType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'options':
      case 'multiOptions':
        return typeof value === 'string' || Array.isArray(value);
      case 'collection':
      case 'fixedCollection':
        return typeof value === 'object';
      case 'json':
        return typeof value === 'string' || typeof value === 'object';
      default:
        return true; // Unknown type, don't validate
    }
  }
}
