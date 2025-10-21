import { NodeMetadataService } from './nodeMetadataService';
import {
  RequirementValidationRequest,
  RequirementValidationResponse,
  RequirementFeasibility,
  NodeTypeMetadata,
} from '../types';

/**
 * Validates workflow requirements against available node capabilities
 */
export class RequirementValidator {
  constructor(private nodeService: NodeMetadataService) {}

  /**
   * Validate if requirements can be fulfilled with available nodes
   */
  async validateRequirements(
    request: RequirementValidationRequest
  ): Promise<RequirementValidationResponse> {
    const stepResults: RequirementFeasibility[] = [];
    const suggestions: string[] = [];
    const warnings: string[] = [];

    // Get all available nodes for matching
    const { nodes: allNodes } = await this.nodeService.getNodeTypes({ limit: 10000 });

    for (let i = 0; i < request.steps.length; i++) {
      const step = request.steps[i];
      const result = await this.validateStep(step, i, allNodes);
      stepResults.push(result);

      if (!result.feasible) {
        warnings.push(
          `Step ${i + 1} may not be feasible: ${result.issues?.join(', ') || 'Unknown issue'}`
        );
      }
    }

    // Generate overall suggestions
    const infeasibleSteps = stepResults.filter(r => !r.feasible);

    if (infeasibleSteps.length > 0) {
      suggestions.push(
        `${infeasibleSteps.length} step(s) may require alternative approaches or custom code nodes`
      );

      // Check if alternatives are available
      const stepsWithAlternatives = infeasibleSteps.filter(
        s => s.alternativeNodes && s.alternativeNodes.length > 0
      );

      if (stepsWithAlternatives.length > 0) {
        suggestions.push(
          `Consider using alternative nodes suggested for ${stepsWithAlternatives.length} step(s)`
        );
      }
    }

    // Check for credential requirements
    const requiredCredentials = new Set(
      request.steps.flatMap(s => s.requiresCredentials || [])
    );

    if (requiredCredentials.size > 0) {
      suggestions.push(
        `Workflow will require credentials for: ${Array.from(requiredCredentials).join(', ')}`
      );
    }

    // Check for trigger requirements
    const triggerSteps = request.steps.filter(s => s.requiresTrigger);
    if (triggerSteps.length === 0) {
      warnings.push(
        'No trigger node specified - workflow will need a manual trigger or schedule'
      );
    } else if (triggerSteps.length > 1) {
      warnings.push(
        'Multiple trigger nodes specified - only the first one will be used'
      );
    }

    return {
      overallFeasible: infeasibleSteps.length === 0,
      stepResults,
      suggestions,
      warnings,
    };
  }

  /**
   * Validate a single step against available nodes
   */
  private async validateStep(
    step: {
      description: string;
      suggestedNodeType?: string;
      requiredInputs?: string[];
      expectedOutputs?: string[];
      requiresTrigger?: boolean;
      requiresWebhook?: boolean;
      requiresCredentials?: string[];
    },
    stepIndex: number,
    allNodes: NodeTypeMetadata[]
  ): Promise<RequirementFeasibility> {
    // If a specific node type is suggested, validate it
    if (step.suggestedNodeType) {
      const validation = await this.nodeService.validateNodeType(step.suggestedNodeType);

      if (validation.valid) {
        const nodeDetails = await this.nodeService.getNodeTypeDetails(step.suggestedNodeType);

        // Validate capabilities
        const issues = this.validateNodeCapabilities(step, nodeDetails, allNodes);

        if (issues.length === 0) {
          return {
            stepIndex,
            feasible: true,
            suggestedNodeType: step.suggestedNodeType,
          };
        } else {
          // Node exists but may not fully meet requirements
          const alternatives = this.findAlternativeNodes(step, allNodes);

          return {
            stepIndex,
            feasible: alternatives.length > 0,
            suggestedNodeType: step.suggestedNodeType,
            alternativeNodes: alternatives,
            issues,
          };
        }
      } else {
        // Suggested node doesn't exist - find alternatives
        const alternatives = this.findAlternativeNodes(step, allNodes);

        return {
          stepIndex,
          feasible: alternatives.length > 0,
          alternativeNodes: alternatives,
          issues: [validation.error || 'Suggested node type not found'],
          missingCapabilities: ['Node type does not exist'],
        };
      }
    }

    // No specific node suggested - find matching nodes
    const matchingNodes = this.findAlternativeNodes(step, allNodes);

    if (matchingNodes.length === 0) {
      // No suitable nodes found
      const missingCapabilities = [];

      if (step.requiresTrigger) {
        missingCapabilities.push('Trigger capability');
      }
      if (step.requiresWebhook) {
        missingCapabilities.push('Webhook capability');
      }
      if (step.requiresCredentials && step.requiresCredentials.length > 0) {
        missingCapabilities.push(`Credentials: ${step.requiresCredentials.join(', ')}`);
      }

      return {
        stepIndex,
        feasible: false,
        issues: ['No suitable nodes found for this step'],
        missingCapabilities,
        alternativeNodes: [
          {
            nodeType: 'n8n-nodes-base.code',
            displayName: 'Code',
            matchScore: 0.5,
            reason: 'Can implement custom logic for this step',
          },
        ],
      };
    }

    // Return the best matching node
    return {
      stepIndex,
      feasible: true,
      suggestedNodeType: matchingNodes[0].nodeType,
      alternativeNodes: matchingNodes,
    };
  }

  /**
   * Validate if a node has the required capabilities
   */
  private validateNodeCapabilities(
    step: any,
    nodeDetails: any,
    _allNodes: NodeTypeMetadata[]
  ): string[] {
    const issues: string[] = [];

    // Check trigger requirement
    if (step.requiresTrigger) {
      const isTrigger =
        nodeDetails?.group?.includes('trigger') ||
        nodeDetails?.webhooks?.length > 0 ||
        nodeDetails?.category === 'trigger';

      if (!isTrigger) {
        issues.push('Node is not a trigger node');
      }
    }

    // Check webhook requirement
    if (step.requiresWebhook) {
      const hasWebhook = nodeDetails?.webhooks && nodeDetails.webhooks.length > 0;

      if (!hasWebhook) {
        issues.push('Node does not support webhooks');
      }
    }

    // Check credential requirements
    if (step.requiresCredentials && step.requiresCredentials.length > 0) {
      const nodeCredentials = nodeDetails?.credentials?.map((c: any) => c.name) || [];

      for (const requiredCred of step.requiresCredentials) {
        // Fuzzy match credential names
        const hasMatchingCred = nodeCredentials.some((cred: string) =>
          cred.toLowerCase().includes(requiredCred.toLowerCase()) ||
          requiredCred.toLowerCase().includes(cred.toLowerCase())
        );

        if (!hasMatchingCred) {
          issues.push(`Missing credential: ${requiredCred}`);
        }
      }
    }

    return issues;
  }

  /**
   * Find alternative nodes that could fulfill the step requirements
   */
  private findAlternativeNodes(
    step: any,
    allNodes: NodeTypeMetadata[]
  ): Array<{
    nodeType: string;
    displayName: string;
    matchScore: number;
    reason: string;
  }> {
    const alternatives: Array<{
      nodeType: string;
      displayName: string;
      matchScore: number;
      reason: string;
    }> = [];

    for (const node of allNodes) {
      let score = 0;
      const reasons: string[] = [];

      // Check trigger requirement
      if (step.requiresTrigger) {
        if (node.category === 'trigger' || node.group?.includes('trigger') || node.webhooks) {
          score += 40;
          reasons.push('Trigger node');
        } else {
          continue; // Skip non-trigger nodes if trigger is required
        }
      }

      // Check webhook requirement
      if (step.requiresWebhook) {
        if (node.webhooks) {
          score += 30;
          reasons.push('Supports webhooks');
        } else {
          continue; // Skip nodes without webhook support
        }
      }

      // Check credential requirements
      if (step.requiresCredentials && step.requiresCredentials.length > 0) {
        const nodeCredentials = node.credentials?.map(c => c.name.toLowerCase()) || [];

        for (const requiredCred of step.requiresCredentials) {
          const hasMatchingCred = nodeCredentials.some(cred =>
            cred.includes(requiredCred.toLowerCase()) ||
            requiredCred.toLowerCase().includes(cred)
          );

          if (hasMatchingCred) {
            score += 20;
            reasons.push(`Supports ${requiredCred}`);
          }
        }
      }

      // Semantic matching based on description
      const descLower = step.description.toLowerCase();
      const nodeNameLower = node.displayName.toLowerCase();
      const nodeDescLower = node.description.toLowerCase();

      // Check for keyword matches
      const keywords = this.extractKeywords(descLower);

      for (const keyword of keywords) {
        if (nodeNameLower.includes(keyword) || nodeDescLower.includes(keyword)) {
          score += 10;
          reasons.push(`Matches keyword: ${keyword}`);
        }
      }

      // Boost score for commonly useful nodes
      if (
        node.name.includes('code') ||
        node.name.includes('function') ||
        node.name.includes('set')
      ) {
        score += 5;
      }

      // Only include nodes with some match
      if (score > 0) {
        alternatives.push({
          nodeType: node.name,
          displayName: node.displayName,
          matchScore: Math.min(score, 100),
          reason: reasons.join(', ') || 'General match',
        });
      }
    }

    // Sort by score descending
    alternatives.sort((a, b) => b.matchScore - a.matchScore);

    // Return top 5
    return alternatives.slice(0, 5);
  }

  /**
   * Extract keywords from description for matching
   */
  private extractKeywords(description: string): string[] {
    // Remove common words and extract meaningful keywords
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
      'when',
      'where',
      'which',
      'who',
      'what',
      'how',
    ]);

    const words = description
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Remove duplicates
    return Array.from(new Set(words));
  }
}
