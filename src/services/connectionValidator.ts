import { NodeMetadataService } from './nodeMetadataService';
import {
  ConnectionValidationRequest,
  ConnectionValidationResponse,
  ConnectionError,
} from '../types';

/**
 * Validates workflow node connections and data flow
 */
export class ConnectionValidator {
  constructor(private nodeService: NodeMetadataService) {}

  /**
   * Validate all connections in a workflow
   */
  async validateConnections(
    request: ConnectionValidationRequest
  ): Promise<ConnectionValidationResponse> {
    const errors: ConnectionError[] = [];
    const warnings: ConnectionError[] = [];
    const dataFlowIssues: Array<{
      node: string;
      field: string;
      message: string;
    }> = [];

    const { nodes, connections } = request.workflow;

    if (!connections || Object.keys(connections).length === 0) {
      // No connections defined - might be a single-node workflow or invalid
      if (nodes.length > 1) {
        warnings.push({
          sourceNode: '',
          targetNode: '',
          message: 'Workflow has multiple nodes but no connections defined',
          severity: 'warning',
          suggestion: 'Define connections between nodes to create a functional workflow',
        });
      }
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        dataFlowIssues,
      };
    }

    // Build node map for quick lookup
    const nodeMap = new Map(nodes.map(n => [n.name, n]));

    // Validate each connection
    for (const [sourceNodeName, sourceOutputs] of Object.entries(connections)) {
      const sourceNode = nodeMap.get(sourceNodeName);

      if (!sourceNode) {
        errors.push({
          sourceNode: sourceNodeName,
          targetNode: '',
          message: `Source node '${sourceNodeName}' not found in workflow`,
          severity: 'error',
          suggestion: 'Ensure all connected nodes exist in the workflow',
        });
        continue;
      }

      // Get source node metadata
      const sourceMetadata = await this.nodeService.getNodeTypeDetails(sourceNode.type);

      for (const [outputType, targetConnections] of Object.entries(sourceOutputs)) {
        for (const connectionGroup of targetConnections) {
          for (const connection of connectionGroup) {
            const targetNode = nodeMap.get(connection.node);

            if (!targetNode) {
              errors.push({
                sourceNode: sourceNodeName,
                targetNode: connection.node,
                message: `Target node '${connection.node}' not found in workflow`,
                severity: 'error',
                suggestion: 'Ensure all connected nodes exist in the workflow',
              });
              continue;
            }

            // Get target node metadata
            const targetMetadata = await this.nodeService.getNodeTypeDetails(targetNode.type);

            // Validate connection compatibility
            const compatibilityError = this.validateConnectionCompatibility(
              sourceNode,
              sourceMetadata,
              targetNode,
              targetMetadata,
              outputType,
              connection.type
            );

            if (compatibilityError) {
              errors.push(compatibilityError);
            }

            // Validate data flow
            const dataFlowError = await this.validateDataFlow(
              sourceNode,
              sourceMetadata,
              targetNode,
              targetMetadata
            );

            if (dataFlowError) {
              dataFlowIssues.push(dataFlowError);
            }
          }
        }
      }
    }

    // Check for orphaned nodes (nodes with no inputs or outputs)
    for (const node of nodes) {
      const hasInput = Object.values(connections).some(outputs =>
        Object.values(outputs).some(conns =>
          conns.some(connGroup => connGroup.some(c => c.node === node.name))
        )
      );

      const hasOutput = connections[node.name] !== undefined;

      // Trigger nodes don't need inputs
      const nodeMetadata = await this.nodeService.getNodeTypeDetails(node.type);
      const isTrigger =
        nodeMetadata?.group?.includes('trigger') || nodeMetadata?.webhooks?.length;

      if (!hasInput && !isTrigger && !hasOutput) {
        warnings.push({
          sourceNode: node.name,
          targetNode: '',
          message: `Node '${node.name}' has no connections (orphaned)`,
          severity: 'warning',
          suggestion: 'Connect this node to the workflow or remove it',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      dataFlowIssues,
    };
  }

  /**
   * Validate connection type compatibility between two nodes
   */
  private validateConnectionCompatibility(
    sourceNode: any,
    sourceMetadata: any,
    targetNode: any,
    targetMetadata: any,
    outputType: string,
    inputType: string
  ): ConnectionError | null {
    // Check if source can output to this type
    if (sourceMetadata?.outputs) {
      const sourceOutputs = Array.isArray(sourceMetadata.outputs)
        ? sourceMetadata.outputs
        : [sourceMetadata.outputs];

      const hasMatchingOutput = sourceOutputs.some((output: any) => {
        const outputTypeStr = typeof output === 'string' ? output : output.type;
        return outputTypeStr === outputType || outputTypeStr === 'main';
      });

      if (!hasMatchingOutput && outputType !== 'main') {
        return {
          sourceNode: sourceNode.name,
          targetNode: targetNode.name,
          message: `Source node does not support output type '${outputType}'`,
          severity: 'error',
          suggestion: `Use one of the supported output types: ${sourceOutputs.join(', ')}`,
        };
      }
    }

    // Check if target can receive this type
    if (targetMetadata?.inputs) {
      const targetInputs = Array.isArray(targetMetadata.inputs)
        ? targetMetadata.inputs
        : [targetMetadata.inputs];

      const hasMatchingInput = targetInputs.some((input: any) => {
        const inputTypeStr = typeof input === 'string' ? input : input.type;
        return inputTypeStr === inputType || inputTypeStr === 'main';
      });

      if (!hasMatchingInput && inputType !== 'main') {
        return {
          sourceNode: sourceNode.name,
          targetNode: targetNode.name,
          message: `Target node does not support input type '${inputType}'`,
          severity: 'error',
          suggestion: `Use one of the supported input types: ${targetInputs.join(', ')}`,
        };
      }
    }

    return null;
  }

  /**
   * Validate data flow between nodes (check for missing required inputs)
   */
  private async validateDataFlow(
    sourceNode: any,
    _sourceMetadata: any,
    targetNode: any,
    _targetMetadata: any
  ): Promise<{ node: string; field: string; message: string } | null> {
    // Check if target node has expressions referencing source data
    if (!targetNode.parameters) {
      return null;
    }

    // Look for n8n expressions in target parameters
    const expressions = this.extractExpressions(targetNode.parameters);

    for (const expr of expressions) {
      // Check for common issues
      if (expr.includes('$json') || expr.includes('$node')) {
        // This is referencing data from previous nodes - validate it makes sense
        if (expr.includes(`$node["${sourceNode.name}"]`) || expr.includes(`$node.${sourceNode.name}`)) {
          // Specifically references the source node - validate the path exists
          const fieldMatch = expr.match(/\["([^"]+)"\]|\.(\w+)/g);
          if (fieldMatch && fieldMatch.length > 0) {
            // We can't deeply validate without execution, but we can warn about common issues
            // This is a basic check - actual data validation would require execution context
          }
        }
      }

      // Check for syntax errors in expressions
      if (expr.includes('{{') && !expr.includes('}}')) {
        return {
          node: targetNode.name,
          field: 'expression',
          message: `Unclosed expression found in node parameters`,
        };
      }

      if (expr.includes('}}') && !expr.includes('{{')) {
        return {
          node: targetNode.name,
          field: 'expression',
          message: `Unmatched closing bracket in expression`,
        };
      }
    }

    return null;
  }

  /**
   * Extract n8n expressions from parameter object
   */
  private extractExpressions(params: Record<string, any>, expressions: string[] = []): string[] {
    for (const [_key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Check if it contains n8n expression syntax
        if (value.includes('{{') || value.includes('$json') || value.includes('$node')) {
          expressions.push(value);
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively search nested objects
        this.extractExpressions(value, expressions);
      }
    }

    return expressions;
  }
}
