import { NodeMetadataService } from '../services/nodeMetadataService';
import type { INodeProperties } from 'n8n-workflow';
import {
  DeepValidationRequest,
  DeepValidationResponse,
  ParameterConstraintError,
} from '../types';

/**
 * Deep parameter validator with comprehensive constraint checking
 */
export class DeepValidator {
  constructor(private nodeService: NodeMetadataService) {}

  /**
   * Perform deep validation of node parameters
   */
  async validateParameters(request: DeepValidationRequest): Promise<DeepValidationResponse> {
    const errors: ParameterConstraintError[] = [];
    const warnings: ParameterConstraintError[] = [];
    const suggestions: string[] = [];

    // Validate node type exists
    const typeValidation = await this.nodeService.validateNodeType(
      request.nodeType,
      request.typeVersion
    );

    if (!typeValidation.valid) {
      return {
        valid: false,
        errors: [
          {
            field: 'nodeType',
            parameterPath: '',
            message: typeValidation.error || 'Invalid node type',
            severity: 'error',
            constraint: 'node_exists',
            nodeType: request.nodeType,
          },
        ],
        warnings: [],
        suggestions: [],
      };
    }

    // Get node details for schema
    const details = await this.nodeService.getNodeTypeDetails(request.nodeType);
    if (!details || !details.properties) {
      return {
        valid: false,
        errors: [
          {
            field: 'schema',
            parameterPath: '',
            message: 'Could not load parameter schema for node type',
            severity: 'error',
            constraint: 'schema_missing',
            nodeType: request.nodeType,
          },
        ],
        warnings: [],
        suggestions: [],
      };
    }

    // Validate each parameter deeply
    const properties = details.properties as INodeProperties[];

    // Check for required parameters
    for (const prop of properties) {
      if (prop.required && !(prop.name in request.parameters)) {
        errors.push({
          field: prop.name,
          parameterPath: prop.name,
          message: `Required parameter '${prop.displayName || prop.name}' is missing`,
          severity: 'error',
          constraint: 'required',
          nodeType: request.nodeType,
          suggestion: `Add '${prop.name}' to the parameters`,
        });
      }
    }

    // Validate provided parameters
    for (const [paramName, paramValue] of Object.entries(request.parameters)) {
      const paramSchema = properties.find(p => p.name === paramName);

      if (!paramSchema) {
        warnings.push({
          field: paramName,
          parameterPath: paramName,
          message: `Unknown parameter: ${paramName}`,
          severity: 'warning',
          constraint: 'unknown_parameter',
          nodeType: request.nodeType,
          actualValue: paramValue,
        });
        continue;
      }

      // Deep validation for this parameter
      const paramErrors = this.validateParameter(
        paramName,
        paramValue,
        paramSchema,
        request.nodeType,
        paramName
      );

      errors.push(...paramErrors.filter(e => e.severity === 'error'));
      warnings.push(...paramErrors.filter(e => e.severity === 'warning'));
    }

    // Generate suggestions based on errors
    if (errors.length > 0) {
      const errorTypes = new Set(errors.map(e => e.constraint));

      if (errorTypes.has('required')) {
        suggestions.push('Ensure all required parameters are provided');
      }
      if (errorTypes.has('type_mismatch')) {
        suggestions.push('Check that parameter types match the expected types');
      }
      if (errorTypes.has('enum_violation')) {
        suggestions.push('Use only allowed values from the options list');
      }
      if (errorTypes.has('range_violation')) {
        suggestions.push('Ensure numeric values are within allowed ranges');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate a single parameter with full constraint checking
   */
  private validateParameter(
    _paramName: string,
    value: any,
    schema: INodeProperties,
    nodeType: string,
    path: string
  ): ParameterConstraintError[] {
    const errors: ParameterConstraintError[] = [];

    // Skip validation for null/undefined values that aren't required
    if ((value === null || value === undefined) && !schema.required) {
      return errors;
    }

    // Type validation
    const typeError = this.validateParameterType(value, schema, nodeType, path);
    if (typeError) {
      errors.push(typeError);
      return errors; // Don't continue if type is wrong
    }

    // Constraint-based validation
    switch (schema.type) {
      case 'string':
        errors.push(...this.validateStringConstraints(value, schema, nodeType, path));
        break;

      case 'number':
        errors.push(...this.validateNumberConstraints(value, schema, nodeType, path));
        break;

      case 'options':
        errors.push(...this.validateOptionsConstraints(value, schema, nodeType, path));
        break;

      case 'multiOptions':
        errors.push(...this.validateMultiOptionsConstraints(value, schema, nodeType, path));
        break;

      case 'collection':
        errors.push(...this.validateCollectionConstraints(value, schema, nodeType, path));
        break;

      case 'fixedCollection':
        errors.push(...this.validateFixedCollectionConstraints(value, schema, nodeType, path));
        break;

      case 'json':
        errors.push(...this.validateJsonConstraints(value, schema, nodeType, path));
        break;
    }

    return errors;
  }

  /**
   * Validate parameter type matches schema
   */
  private validateParameterType(
    value: any,
    schema: INodeProperties,
    nodeType: string,
    path: string
  ): ParameterConstraintError | null {
    const expectedType = schema.type;

    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          return this.createError(
            schema.name,
            path,
            `Expected string but got ${typeof value}`,
            'error',
            'type_mismatch',
            nodeType,
            'string',
            value,
            `Convert value to string type`
          );
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return this.createError(
            schema.name,
            path,
            `Expected number but got ${typeof value}`,
            'error',
            'type_mismatch',
            nodeType,
            'number',
            value,
            `Provide a numeric value`
          );
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return this.createError(
            schema.name,
            path,
            `Expected boolean but got ${typeof value}`,
            'error',
            'type_mismatch',
            nodeType,
            'boolean',
            value,
            `Use true or false`
          );
        }
        break;

      case 'options':
        if (typeof value !== 'string' && typeof value !== 'number') {
          return this.createError(
            schema.name,
            path,
            `Expected string or number for options but got ${typeof value}`,
            'error',
            'type_mismatch',
            nodeType,
            'string | number',
            value
          );
        }
        break;

      case 'multiOptions':
        if (!Array.isArray(value)) {
          return this.createError(
            schema.name,
            path,
            `Expected array for multiOptions but got ${typeof value}`,
            'error',
            'type_mismatch',
            nodeType,
            'array',
            value,
            `Provide an array of values`
          );
        }
        break;

      case 'collection':
      case 'fixedCollection':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return this.createError(
            schema.name,
            path,
            `Expected object for ${expectedType} but got ${typeof value}`,
            'error',
            'type_mismatch',
            nodeType,
            'object',
            value
          );
        }
        break;

      case 'json':
        // JSON can be string or object
        if (typeof value !== 'string' && typeof value !== 'object') {
          return this.createError(
            schema.name,
            path,
            `Expected string or object for JSON but got ${typeof value}`,
            'error',
            'type_mismatch',
            nodeType,
            'string | object',
            value
          );
        }
        break;
    }

    return null;
  }

  /**
   * Validate string-specific constraints
   */
  private validateStringConstraints(
    value: string,
    schema: INodeProperties,
    nodeType: string,
    path: string
  ): ParameterConstraintError[] {
    const errors: ParameterConstraintError[] = [];
    const schemaOptions = schema as any;

    // Pattern/regex validation
    if (schemaOptions.pattern) {
      const regex = new RegExp(schemaOptions.pattern);
      if (!regex.test(value)) {
        errors.push(
          this.createError(
            schema.name,
            path,
            `Value doesn't match required pattern: ${schemaOptions.pattern}`,
            'error',
            'pattern_violation',
            nodeType,
            schemaOptions.pattern,
            value,
            `Ensure value matches the expected format`
          )
        );
      }
    }

    // Min/max length
    if (schemaOptions.minLength !== undefined && value.length < schemaOptions.minLength) {
      errors.push(
        this.createError(
          schema.name,
          path,
          `String length ${value.length} is less than minimum ${schemaOptions.minLength}`,
          'error',
          'length_violation',
          nodeType,
          `>= ${schemaOptions.minLength}`,
          value.length
        )
      );
    }

    if (schemaOptions.maxLength !== undefined && value.length > schemaOptions.maxLength) {
      errors.push(
        this.createError(
          schema.name,
          path,
          `String length ${value.length} exceeds maximum ${schemaOptions.maxLength}`,
          'error',
          'length_violation',
          nodeType,
          `<= ${schemaOptions.maxLength}`,
          value.length
        )
      );
    }

    return errors;
  }

  /**
   * Validate number-specific constraints
   */
  private validateNumberConstraints(
    value: number,
    schema: INodeProperties,
    nodeType: string,
    path: string
  ): ParameterConstraintError[] {
    const errors: ParameterConstraintError[] = [];
    const schemaOptions = schema as any;

    // Min/max value
    if (schemaOptions.min !== undefined && value < schemaOptions.min) {
      errors.push(
        this.createError(
          schema.name,
          path,
          `Value ${value} is less than minimum ${schemaOptions.min}`,
          'error',
          'range_violation',
          nodeType,
          `>= ${schemaOptions.min}`,
          value,
          `Use a value >= ${schemaOptions.min}`
        )
      );
    }

    if (schemaOptions.max !== undefined && value > schemaOptions.max) {
      errors.push(
        this.createError(
          schema.name,
          path,
          `Value ${value} exceeds maximum ${schemaOptions.max}`,
          'error',
          'range_violation',
          nodeType,
          `<= ${schemaOptions.max}`,
          value,
          `Use a value <= ${schemaOptions.max}`
        )
      );
    }

    // Precision/step validation
    if (schemaOptions.precision !== undefined) {
      const decimals = (value.toString().split('.')[1] || '').length;
      if (decimals > schemaOptions.precision) {
        errors.push(
          this.createError(
            schema.name,
            path,
            `Value has ${decimals} decimal places but maximum is ${schemaOptions.precision}`,
            'warning',
            'precision_violation',
            nodeType,
            schemaOptions.precision,
            decimals
          )
        );
      }
    }

    return errors;
  }

  /**
   * Validate options (enum) constraints
   */
  private validateOptionsConstraints(
    value: string | number,
    schema: INodeProperties,
    nodeType: string,
    path: string
  ): ParameterConstraintError[] {
    const errors: ParameterConstraintError[] = [];
    const schemaOptions = schema as any;

    if (schemaOptions.options && Array.isArray(schemaOptions.options)) {
      const validValues = schemaOptions.options.map((opt: any) => opt.value);

      if (!validValues.includes(value)) {
        errors.push(
          this.createError(
            schema.name,
            path,
            `Value '${value}' is not in allowed options: ${validValues.join(', ')}`,
            'error',
            'enum_violation',
            nodeType,
            validValues,
            value,
            `Use one of: ${validValues.slice(0, 5).join(', ')}${validValues.length > 5 ? '...' : ''}`
          )
        );
      }
    }

    return errors;
  }

  /**
   * Validate multiOptions constraints
   */
  private validateMultiOptionsConstraints(
    value: any[],
    schema: INodeProperties,
    nodeType: string,
    path: string
  ): ParameterConstraintError[] {
    const errors: ParameterConstraintError[] = [];
    const schemaOptions = schema as any;

    if (schemaOptions.options && Array.isArray(schemaOptions.options)) {
      const validValues = schemaOptions.options.map((opt: any) => opt.value);

      for (const item of value) {
        if (!validValues.includes(item)) {
          errors.push(
            this.createError(
              schema.name,
              path,
              `Value '${item}' in array is not in allowed options`,
              'error',
              'enum_violation',
              nodeType,
              validValues,
              item,
              `Use only values from: ${validValues.join(', ')}`
            )
          );
        }
      }
    }

    // Min/max items
    if (schemaOptions.minItems !== undefined && value.length < schemaOptions.minItems) {
      errors.push(
        this.createError(
          schema.name,
          path,
          `Array has ${value.length} items but minimum is ${schemaOptions.minItems}`,
          'error',
          'array_size_violation',
          nodeType,
          schemaOptions.minItems,
          value.length
        )
      );
    }

    if (schemaOptions.maxItems !== undefined && value.length > schemaOptions.maxItems) {
      errors.push(
        this.createError(
          schema.name,
          path,
          `Array has ${value.length} items but maximum is ${schemaOptions.maxItems}`,
          'error',
          'array_size_violation',
          nodeType,
          schemaOptions.maxItems,
          value.length
        )
      );
    }

    return errors;
  }

  /**
   * Validate collection constraints (recursive)
   */
  private validateCollectionConstraints(
    value: Record<string, any>,
    schema: INodeProperties,
    nodeType: string,
    path: string
  ): ParameterConstraintError[] {
    const errors: ParameterConstraintError[] = [];
    const schemaOptions = schema as any;

    // Validate nested values if options are defined
    if (schemaOptions.options && Array.isArray(schemaOptions.options)) {
      for (const [key, val] of Object.entries(value)) {
        for (const nestedProp of schemaOptions.options) {
          if (key in val) {
            const nestedErrors = this.validateParameter(
              key,
              val[key],
              nestedProp,
              nodeType,
              `${path}.${key}`
            );
            errors.push(...nestedErrors);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Validate fixedCollection constraints (recursive)
   */
  private validateFixedCollectionConstraints(
    value: Record<string, any>,
    schema: INodeProperties,
    nodeType: string,
    path: string
  ): ParameterConstraintError[] {
    const errors: ParameterConstraintError[] = [];
    const schemaOptions = schema as any;

    if (schemaOptions.options && Array.isArray(schemaOptions.options)) {
      for (const collectionDef of schemaOptions.options) {
        const collectionName = collectionDef.name;

        if (collectionName in value) {
          const collectionValue = value[collectionName];

          // Fixed collections should be arrays
          if (!Array.isArray(collectionValue)) {
            errors.push(
              this.createError(
                schema.name,
                `${path}.${collectionName}`,
                `Expected array for fixed collection '${collectionName}'`,
                'error',
                'type_mismatch',
                nodeType,
                'array',
                typeof collectionValue
              )
            );
            continue;
          }

          // Validate each item in the collection
          if (collectionDef.values && Array.isArray(collectionDef.values)) {
            for (let i = 0; i < collectionValue.length; i++) {
              const item = collectionValue[i];

              for (const valueProp of collectionDef.values) {
                if (valueProp.name in item) {
                  const itemErrors = this.validateParameter(
                    valueProp.name,
                    item[valueProp.name],
                    valueProp,
                    nodeType,
                    `${path}.${collectionName}[${i}].${valueProp.name}`
                  );
                  errors.push(...itemErrors);
                }
              }
            }
          }
        }
      }
    }

    return errors;
  }

  /**
   * Validate JSON constraints
   */
  private validateJsonConstraints(
    value: string | object,
    schema: INodeProperties,
    nodeType: string,
    path: string
  ): ParameterConstraintError[] {
    const errors: ParameterConstraintError[] = [];

    // If it's a string, try to parse it
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
      } catch (error) {
        errors.push(
          this.createError(
            schema.name,
            path,
            `Invalid JSON string: ${(error as Error).message}`,
            'error',
            'json_parse_error',
            nodeType,
            'valid JSON',
            value,
            `Ensure the string is valid JSON format`
          )
        );
      }
    }

    return errors;
  }

  /**
   * Create a standardized error object
   */
  private createError(
    field: string,
    path: string,
    message: string,
    severity: 'error' | 'warning',
    constraint: string,
    nodeType: string,
    expectedValue?: any,
    actualValue?: any,
    suggestion?: string
  ): ParameterConstraintError {
    return {
      field,
      parameterPath: path,
      message,
      severity,
      constraint,
      nodeType,
      expectedValue,
      actualValue,
      suggestion,
    };
  }
}
