import path from 'path';
import { LazyPackageDirectoryLoader } from 'n8n-core';
import type { INodeTypeDescription, INodeType, IVersionedNodeType } from 'n8n-workflow';
import { Cache } from '../utils/cache';
import { config } from '../config';
import {
  NodeTypeMetadata,
  NodeTypeDetails,
  NodeCategory,
  NodeTypeFilters,
} from '../types';

/**
 * Service for loading and managing n8n node type metadata
 */
export class NodeMetadataService {
  private cache: Cache<NodeTypeMetadata>;
  private detailsCache: Cache<NodeTypeDetails>;
  private loader: LazyPackageDirectoryLoader | null = null;
  private initialized = false;
  private nodeTypesMap = new Map<string, INodeType | IVersionedNodeType>();

  constructor() {
    this.cache = new Cache<NodeTypeMetadata>(config.cacheTTL);
    this.detailsCache = new Cache<NodeTypeDetails>(config.cacheTTL);
  }

  /**
   * Initialize the service by loading all node types
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Initializing NodeMetadataService...');

    try {
      // Find n8n-nodes-base package path
      const n8nNodesBasePath = require.resolve('n8n-nodes-base/package.json');
      const packageDir = path.dirname(n8nNodesBasePath);

      console.log(`Loading nodes from: ${packageDir}`);

      // Create lazy loader for n8n-nodes-base
      this.loader = new LazyPackageDirectoryLoader(packageDir);
      await this.loader.loadAll();

      const { known } = this.loader;
      console.log(`Loaded ${Object.keys(known.nodes).length} node types`);

      // Cache all node metadata
      for (const [nodeType, _info] of Object.entries(known.nodes)) {
        try {
          const nodeClass = this.loader.getNode(nodeType);
          const fullNodeType = `n8n-nodes-base.${nodeType}`;

          // Store the node class for later use
          this.nodeTypesMap.set(fullNodeType, nodeClass.type);

          // Extract and cache metadata
          const metadata = this.extractNodeMetadata(nodeClass.type, fullNodeType);
          this.cache.set(fullNodeType, metadata);
        } catch (error) {
          console.error(`Error loading node ${nodeType}:`, error);
        }
      }

      this.initialized = true;
      console.log('NodeMetadataService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NodeMetadataService:', error);
      throw error;
    }
  }

  /**
   * Extract simplified metadata from a node type
   */
  private extractNodeMetadata(
    nodeType: INodeType | IVersionedNodeType,
    fullName: string
  ): NodeTypeMetadata {
    const description = this.getNodeDescription(nodeType);

    return {
      name: fullName,
      displayName: description.displayName,
      description: description.description,
      category: this.getNodeCategory(description),
      version: description.version,
      defaultVersion: description.defaultVersion,
      icon: description.icon,
      group: description.group,
      inputs: this.extractInputs(description),
      outputs: this.extractOutputs(description),
      credentials: description.credentials?.map((c: any) => ({
        name: c.name,
        required: c.required,
      })),
      properties: description.properties,
      webhooks: !!description.webhooks && description.webhooks.length > 0,
    };
  }

  /**
   * Get node description (handles both regular and versioned nodes)
   */
  private getNodeDescription(
    nodeType: INodeType | IVersionedNodeType
  ): INodeTypeDescription {
    if ('description' in nodeType) {
      return nodeType.description as INodeTypeDescription;
    } else if ('nodeVersions' in (nodeType as any)) {
      // Versioned node - get the latest version
      const versionedNode = nodeType as any;
      const versions = Object.keys(versionedNode.nodeVersions).map(Number).sort((a, b) => b - a);
      const latestVersion = versions[0];
      return versionedNode.nodeVersions[latestVersion].description;
    }
    throw new Error('Invalid node type structure');
  }

  /**
   * Determine node category from description
   */
  private getNodeCategory(description: INodeTypeDescription): string {
    if (description.group?.includes('trigger')) return 'trigger';
    if (description.group?.includes('transform')) return 'transform';
    if (description.webhooks && description.webhooks.length > 0) return 'trigger';
    return 'action';
  }

  /**
   * Extract input types
   */
  private extractInputs(description: INodeTypeDescription): string[] {
    if (!description.inputs) return [];
    if (typeof description.inputs === 'string') return [description.inputs];
    return description.inputs.map((input: any) =>
      typeof input === 'string' ? input : input.type
    );
  }

  /**
   * Extract output types
   */
  private extractOutputs(description: INodeTypeDescription): string[] {
    if (!description.outputs) return [];
    if (typeof description.outputs === 'string') return [description.outputs];
    return description.outputs.map((output: any) =>
      typeof output === 'string' ? output : output.type
    );
  }

  /**
   * Get all node types with optional filtering
   */
  async getNodeTypes(filters: NodeTypeFilters = {}): Promise<{
    nodes: NodeTypeMetadata[];
    total: number;
  }> {
    if (!this.initialized) {
      await this.init();
    }

    let nodes = this.cache.keys().map(key => this.cache.get(key)!);

    // Apply filters
    if (filters.category) {
      nodes = nodes.filter(n => n.category === filters.category);
    }

    if (filters.group) {
      nodes = nodes.filter(n => n.group?.includes(filters.group!));
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      nodes = nodes.filter(n =>
        n.displayName.toLowerCase().includes(searchLower) ||
        n.description.toLowerCase().includes(searchLower) ||
        n.name.toLowerCase().includes(searchLower)
      );
    }

    const total = nodes.length;

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = Math.min(
      filters.limit || config.defaultPageLimit,
      config.maxPageLimit
    );

    nodes = nodes.slice(offset, offset + limit);

    return { nodes, total };
  }

  /**
   * Get detailed information for a specific node type
   */
  async getNodeTypeDetails(nodeTypeName: string): Promise<NodeTypeDetails | null> {
    if (!this.initialized) {
      await this.init();
    }

    // Check cache first
    const cached = this.detailsCache.get(nodeTypeName);
    if (cached) {
      return cached;
    }

    const nodeType = this.nodeTypesMap.get(nodeTypeName);
    if (!nodeType) {
      return null;
    }

    const description = this.getNodeDescription(nodeType);
    const details: NodeTypeDetails = {
      ...description,
      fullName: nodeTypeName,
    };

    this.detailsCache.set(nodeTypeName, details);
    return details;
  }

  /**
   * Validate if a node type exists and optionally check version
   */
  async validateNodeType(
    nodeTypeName: string,
    version?: number
  ): Promise<{ valid: boolean; error?: string }> {
    if (!this.initialized) {
      await this.init();
    }

    const nodeType = this.nodeTypesMap.get(nodeTypeName);
    if (!nodeType) {
      return { valid: false, error: `Node type '${nodeTypeName}' not found` };
    }

    if (version !== undefined) {
      const description = this.getNodeDescription(nodeType);
      const versions = Array.isArray(description.version)
        ? description.version
        : [description.version];

      if (!versions.includes(version)) {
        return {
          valid: false,
          error: `Version ${version} not available for ${nodeTypeName}. Available versions: ${versions.join(', ')}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get all available node categories
   */
  async getCategories(): Promise<NodeCategory[]> {
    if (!this.initialized) {
      await this.init();
    }

    const categoriesMap = new Map<string, { count: number; nodes: string[] }>();

    for (const key of this.cache.keys()) {
      const node = this.cache.get(key)!;
      const category = node.category;

      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, { count: 0, nodes: [] });
      }

      const cat = categoriesMap.get(category)!;
      cat.count++;
      cat.nodes.push(node.name);
    }

    return Array.from(categoriesMap.entries()).map(([name, data]) => ({
      name,
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
      count: data.count,
      nodeTypes: data.nodes,
    }));
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.detailsCache.clear();
  }
}
