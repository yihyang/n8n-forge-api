import type { INodeTypeDescription, INodeProperties } from 'n8n-workflow';

/**
 * Simplified node metadata for API responses
 */
export interface NodeTypeMetadata {
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: number | number[];
  defaultVersion?: number;
  icon?: string | { light: string; dark: string };
  group?: string[];
  inputs?: string[];
  outputs?: string[];
  credentials?: Array<{
    name: string;
    required?: boolean;
  }>;
  properties?: INodeProperties[];
  webhooks?: boolean;
}

/**
 * Full node type details (complete INodeTypeDescription)
 */
export interface NodeTypeDetails extends INodeTypeDescription {
  fullName: string;
}

/**
 * Node category information
 */
export interface NodeCategory {
  name: string;
  displayName: string;
  count: number;
  nodeTypes: string[];
}

/**
 * Pagination info for API responses
 */
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: PaginationInfo;
}

/**
 * Node type list response
 */
export interface NodeTypeListResponse {
  data: NodeTypeMetadata[];
  pagination: PaginationInfo;
}

/**
 * Validation request
 */
export interface ValidationRequest {
  workflow?: {
    nodes: Array<{
      type: string;
      typeVersion?: number;
      parameters?: Record<string, any>;
    }>;
  };
  node?: {
    type: string;
    typeVersion?: number;
    parameters?: Record<string, any>;
  };
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  nodeType?: string;
  nodeName?: string;
}

/**
 * Validation response
 */
export interface ValidationResponse {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Query filters for node types
 */
export interface NodeTypeFilters {
  category?: string;
  search?: string;
  group?: string;
  limit?: number;
  offset?: number;
}

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}
