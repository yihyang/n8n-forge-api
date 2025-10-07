# n8n-forge-api

> REST API service for n8n node type metadata and workflow validation

A standalone API that exposes programmatic access to n8n's node type metadata, enabling external services to discover available nodes, validate workflows, and ensure compatibility before workflow creation.

## 📋 Features

- **Node Discovery** - List all available n8n node types with metadata
- **Detailed Schemas** - Get complete parameter schemas for any node
- **Workflow Validation** - Validate workflow JSON against actual node schemas
- **Category Browsing** - Explore nodes by category (triggers, actions, etc.)
- **Version Checking** - Verify node type versions exist
- **Fast Caching** - In-memory cache with TTL for optimal performance

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18.x or higher
- **pnpm** v10.18.1 (specified in package.json)

### Installation

```bash
# Install dependencies
pnpm install

# Create environment file (optional)
cp .env.example .env
```

### Running the Server

```bash
# Development mode with hot reload
pnpm dev

# Production build
pnpm build
pnpm start
```

The API will be available at `http://localhost:3000` (or your configured PORT).

## 📡 API Endpoints

### Root Endpoint

**GET /** - API information and available endpoints

```bash
curl http://localhost:3000/
```

### Health Check

**GET /health** - Service health status

```bash
curl http://localhost:3000/health
```

### List Node Types

**GET /api/v1/node-types** - Get all available node types

Query Parameters:
- `category` (optional) - Filter by category (trigger, action, transform)
- `search` (optional) - Search by name or description
- `group` (optional) - Filter by group
- `limit` (optional) - Results per page (default: 20, max: 100)
- `offset` (optional) - Pagination offset

```bash
# Get all nodes
curl http://localhost:3000/api/v1/node-types

# Search for webhook nodes
curl http://localhost:3000/api/v1/node-types?search=webhook

# Get trigger nodes
curl http://localhost:3000/api/v1/node-types?category=trigger

# Pagination
curl http://localhost:3000/api/v1/node-types?limit=10&offset=20
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "name": "n8n-nodes-base.webhook",
      "displayName": "Webhook",
      "description": "Starts the workflow when a webhook is called",
      "category": "trigger",
      "version": [1, 1.1, 2, 2.1],
      "defaultVersion": 2.1,
      "icon": "webhook.svg",
      "webhooks": true
    }
  ],
  "pagination": {
    "total": 450,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Get Node Categories

**GET /api/v1/node-types/categories** - List all node categories

```bash
curl http://localhost:3000/api/v1/node-types/categories
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "name": "trigger",
      "displayName": "Trigger",
      "count": 45,
      "nodeTypes": ["n8n-nodes-base.webhook", "..."]
    },
    {
      "name": "action",
      "displayName": "Action",
      "count": 380,
      "nodeTypes": ["n8n-nodes-base.httpRequest", "..."]
    }
  ]
}
```

### Get Node Details

**GET /api/v1/node-types/:nodeType** - Get complete schema for a specific node

```bash
# Note: Use dot notation in the node type name
curl http://localhost:3000/api/v1/node-types/n8n-nodes-base.webhook
```

Response:
```json
{
  "success": true,
  "data": {
    "fullName": "n8n-nodes-base.webhook",
    "displayName": "Webhook",
    "name": "webhook",
    "description": "Starts the workflow when a webhook is called",
    "version": [1, 1.1, 2, 2.1],
    "properties": [
      {
        "displayName": "HTTP Method",
        "name": "httpMethod",
        "type": "options",
        "options": [...],
        "default": "GET"
      }
    ],
    "credentials": [],
    "webhooks": [...]
  }
}
```

### Validate Workflow

**POST /api/v1/node-types/validate** - Validate workflow or node configuration

Request Body:
```json
{
  "workflow": {
    "nodes": [
      {
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "parameters": {
          "httpMethod": "POST",
          "path": "webhook"
        }
      },
      {
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4,
        "parameters": {
          "method": "GET",
          "url": "https://api.example.com/data"
        }
      }
    ]
  }
}
```

Or validate a single node:
```json
{
  "node": {
    "type": "n8n-nodes-base.webhook",
    "typeVersion": 2,
    "parameters": {
      "httpMethod": "POST"
    }
  }
}
```

```bash
curl -X POST http://localhost:3000/api/v1/node-types/validate \
  -H "Content-Type: application/json" \
  -d '{"node": {"type": "n8n-nodes-base.webhook", "typeVersion": 2}}'
```

Response:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": []
  }
}
```

With errors:
```json
{
  "success": true,
  "data": {
    "valid": false,
    "errors": [
      {
        "field": "type",
        "message": "Node type 'n8n-nodes-base.invalid' not found",
        "severity": "error",
        "nodeType": "n8n-nodes-base.invalid"
      }
    ],
    "warnings": []
  }
}
```

## 🔧 Configuration

Create a `.env` file to customize configuration:

```env
# Server
PORT=3000
NODE_ENV=development

# API
API_VERSION=v1

# Cache (in milliseconds)
CACHE_TTL=3600000

# CORS
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info
```

## 🔗 Integration with carro-gpt

Add validation to your n8n builder workflow generation:

```python
# In builder/helpers/n8n_agent.py

import requests

FORGE_API_URL = "http://localhost:3000/api/v1/node-types"

def validate_workflow_with_forge_api(workflow_json):
    """Validate workflow using n8n-forge-api"""
    response = requests.post(
        f"{FORGE_API_URL}/validate",
        json={"workflow": workflow_json}
    )

    if response.status_code == 200:
        result = response.json()
        if not result['data']['valid']:
            return result['data']['errors']

    return []

# Use in generate_n8n_workflow()
workflow_json, error = generate_n8n_workflow(steps, examples)

if workflow_json:
    # Validate with forge API
    validation_errors = validate_workflow_with_forge_api(workflow_json)

    if validation_errors:
        logger.warning(f"Validation errors: {validation_errors}")
        # Feed back to LLM for correction
```

## 📁 Project Structure

```
n8n-forge-api/
├── src/
│   ├── index.ts                    # Express server entry point
│   ├── config/
│   │   └── index.ts                # Configuration
│   ├── controllers/
│   │   └── nodeTypesController.ts  # API endpoints
│   ├── services/
│   │   └── nodeMetadataService.ts  # Node loading & caching
│   ├── middleware/
│   │   ├── errorHandler.ts         # Error handling
│   │   └── logger.ts               # Request logging
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   └── utils/
│       ├── cache.ts                # In-memory cache
│       └── validator.ts            # Workflow validation
├── dist/                           # Compiled JavaScript
├── tests/                          # Unit tests
├── .env.example                    # Environment template
├── tsconfig.json                   # TypeScript config
└── package.json
```

## 🧪 Development

```bash
# Run in development mode with auto-reload
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start

# Lint code
pnpm lint
```

## 🐛 Troubleshooting

### Port already in use
Change the PORT in `.env` file or set environment variable:
```bash
PORT=3001 pnpm dev
```

### Node types not loading
Ensure `n8n` package is properly installed:
```bash
pnpm install --force
```

### Memory issues
Adjust Node.js memory if handling many nodes:
```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm start
```

## 📚 Resources

- [n8n Documentation](https://docs.n8n.io/)
- [n8n GitHub](https://github.com/n8n-io/n8n)
- [Express.js Documentation](https://expressjs.com/)

## 📝 License

ISC
