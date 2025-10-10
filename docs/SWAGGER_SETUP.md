# Swagger Documentation Setup

## Overview

This document describes the Swagger/OpenAPI documentation that has been added to the n8n Forge API.

## Access

The interactive Swagger UI documentation is available at:

```
http://localhost:3000/api/v1/docs
```

## Features

### Interactive API Explorer
- **Browse all endpoints** - Complete list of all available API endpoints organized by tags
- **Try it out** - Test API endpoints directly from the browser
- **Request/Response schemas** - Detailed schema documentation with examples
- **Parameter documentation** - Clear descriptions of all query parameters, path parameters, and request bodies

### Documentation Coverage

The following endpoints are fully documented:

1. **Health Endpoints**
   - `GET /` - API information
   - `GET /health` - Health check

2. **Node Types Endpoints**
   - `GET /api/v1/node-types` - List all node types with filtering and pagination
   - `GET /api/v1/node-types/categories` - Get all node categories
   - `GET /api/v1/node-types/{nodeType}` - Get detailed node type information

3. **Validation Endpoints**
   - `POST /api/v1/node-types/validate` - Validate workflow or node configuration

## Technical Implementation

### Dependencies Added

```json
{
  "dependencies": {
    "swagger-ui-express": "^5.0.1",
    "swagger-jsdoc": "^6.2.8"
  },
  "devDependencies": {
    "@types/swagger-ui-express": "^4.1.8",
    "@types/swagger-jsdoc": "^6.0.4"
  }
}
```

### Files Modified/Created

1. **`src/config/swagger.ts`** (NEW)
   - Swagger configuration file
   - OpenAPI 3.0.0 specification
   - Schema definitions for all request/response types
   - API metadata and server configuration

2. **`src/index.ts`** (MODIFIED)
   - Added Swagger UI middleware
   - Mounted documentation at `/api/v1/docs`
   - Added JSDoc comments for root and health endpoints
   - Updated startup console output to include docs URL

3. **`src/controllers/nodeTypesController.ts`** (MODIFIED)
   - Added comprehensive JSDoc/OpenAPI comments for all endpoints
   - Included examples for request/response bodies
   - Documented all query parameters and path parameters

4. **`README.md`** (MODIFIED)
   - Added section about interactive API documentation
   - Included link to Swagger UI in Quick Start section

## Schema Definitions

The Swagger configuration includes comprehensive schema definitions for:

- `NodeTypeMetadata` - Simplified node metadata
- `NodeCategory` - Category information
- `ValidationRequest` - Validation request body
- `ValidationError` - Validation error details
- `ValidationResponse` - Validation result
- `PaginationInfo` - Pagination metadata
- `SuccessResponse` - Generic success response wrapper
- `ErrorResponse` - Generic error response wrapper
- `HealthResponse` - Health check response

## Usage Examples

### Accessing the Documentation

1. Start the server:
   ```bash
   pnpm dev
   # or
   pnpm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/api/v1/docs
   ```

3. Explore the available endpoints and try them out!

### Testing an Endpoint

1. In Swagger UI, click on an endpoint (e.g., `GET /api/v1/node-types`)
2. Click the "Try it out" button
3. Enter any required parameters
4. Click "Execute"
5. View the response directly in the browser

## Customization

The Swagger UI can be customized by modifying the `src/index.ts` file:

```typescript
apiRouter.get('/docs', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'n8n Forge API Documentation',
  // Add more customization options here
}));
```

## Maintenance

When adding new endpoints or modifying existing ones:

1. Add JSDoc comments with `@openapi` tag above the route handler
2. Follow the OpenAPI 3.0.0 specification format
3. Include examples for request/response bodies
4. Document all parameters with descriptions and types
5. Rebuild the project to regenerate the documentation:
   ```bash
   pnpm build
   ```

## Benefits

- **Developer-friendly** - Easy to understand API structure
- **Self-documenting** - API documentation stays in sync with code
- **Testing tool** - No need for separate API testing tools
- **Client generation** - Can be used to generate client libraries
- **Standards-compliant** - Follows OpenAPI 3.0.0 specification

