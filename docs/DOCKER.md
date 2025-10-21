# Docker Deployment Guide

This guide covers deploying n8n-forge-api using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Building the Image](#building-the-image)
- [Running the Container](#running-the-container)
- [Using Docker Compose](#using-docker-compose)
- [Configuration](#configuration)
- [Health Checks](#health-checks)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker 20.10 or higher
- Docker Compose 2.0 or higher (optional, for docker-compose usage)

To verify your installation:
```bash
docker --version
docker-compose --version
```

## Quick Start

The fastest way to get started with Docker Compose:

```bash
# Build and start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

The API will be available at `http://localhost:3000`.

## Building the Image

### Standard Build

```bash
docker build -t n8n-forge-api .
```

### Build with Custom Tag

```bash
docker build -t n8n-forge-api:v1.0.0 .
```

### Build Arguments

The Dockerfile uses a multi-stage build process:
- **Build Stage**: Compiles TypeScript using Node 18 Alpine with pnpm 10.18.1
- **Production Stage**: Creates minimal runtime image with only production dependencies

## Running the Container

### Basic Run

```bash
docker run -p 3000:3000 n8n-forge-api
```

### Run with Environment Variables

```bash
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e CACHE_TTL=3600000 \
  -e CORS_ORIGIN=* \
  -e LOG_LEVEL=info \
  n8n-forge-api
```

### Run in Detached Mode

```bash
docker run -d \
  --name n8n-forge-api \
  -p 3000:3000 \
  n8n-forge-api
```

### Run with Custom Port

```bash
docker run -p 8080:3000 n8n-forge-api
```

Access the API at `http://localhost:8080`.

## Using Docker Compose

### Basic Usage

```bash
# Start in detached mode
docker-compose up -d

# Start with build
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Custom Configuration

Create a `.env` file in the project root:

```env
# Server
PORT=3000
NODE_ENV=production

# API
API_VERSION=v1

# Cache (in milliseconds)
CACHE_TTL=3600000

# CORS
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info
```

Then run:
```bash
docker-compose up -d
```

### Override Port from Command Line

```bash
PORT=8080 docker-compose up -d
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3000` | Internal container port (always 3000) |
| `API_VERSION` | `v1` | API version prefix |
| `CACHE_TTL` | `3600000` | Cache time-to-live in milliseconds |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, debug) |

### Exposed Ports

- **3000**: HTTP API server

Map to different host ports as needed:
```bash
docker run -p 8080:3000 n8n-forge-api  # Access on host port 8080
```

## Health Checks

The Docker image includes built-in health checks that monitor the `/health` endpoint.

### Health Check Configuration

- **Interval**: 30 seconds
- **Timeout**: 3 seconds
- **Start Period**: 5 seconds
- **Retries**: 3

### Check Container Health

```bash
# View health status
docker inspect --format='{{.State.Health.Status}}' n8n-forge-api

# With docker-compose
docker-compose ps
```

Health status values:
- `starting`: Container is starting up
- `healthy`: Health check passing
- `unhealthy`: Health check failing

### Manual Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-10-21T09:00:00.000Z"
}
```

## Production Deployment

### Security Best Practices

1. **Run as Non-Root User**
   - The image automatically runs as user `nodejs` (UID 1001)

2. **Set Specific CORS Origins**
   ```bash
   docker run -p 3000:3000 \
     -e CORS_ORIGIN=https://your-domain.com \
     n8n-forge-api
   ```

3. **Use Production Mode**
   ```bash
   docker run -p 3000:3000 \
     -e NODE_ENV=production \
     n8n-forge-api
   ```

### Resource Limits

Limit container resources:

```bash
docker run -p 3000:3000 \
  --memory="512m" \
  --cpus="0.5" \
  n8n-forge-api
```

With docker-compose, add to `docker-compose.yml`:
```yaml
services:
  n8n-forge-api:
    # ... other config
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### Restart Policies

The docker-compose.yml includes `restart: unless-stopped` by default.

For manual docker run:
```bash
docker run -p 3000:3000 \
  --restart unless-stopped \
  n8n-forge-api
```

Restart options:
- `no`: Don't restart (default)
- `always`: Always restart
- `unless-stopped`: Restart unless manually stopped
- `on-failure`: Restart only on failure

### Reverse Proxy Setup

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

### Container Exits Immediately

Check logs:
```bash
docker logs n8n-forge-api
```

Common causes:
- Port already in use on host
- Missing required dependencies
- TypeScript compilation errors

### Port Already in Use

Change the host port:
```bash
docker run -p 8080:3000 n8n-forge-api
```

Or stop the conflicting service:
```bash
# Find what's using port 3000
lsof -i :3000

# Stop docker-compose if running
docker-compose down
```

### High Memory Usage

The n8n packages can be memory-intensive. Increase Node.js memory:

Create a custom Dockerfile:
```dockerfile
# In CMD section, add NODE_OPTIONS
CMD ["node", "--max-old-space-size=4096", "dist/index.js"]
```

Or set via environment:
```bash
docker run -p 3000:3000 \
  -e NODE_OPTIONS="--max-old-space-size=4096" \
  n8n-forge-api
```

### Build Failures

#### pnpm Install Fails

Ensure you're using the correct pnpm version:
```bash
# The Dockerfile uses pnpm@10.18.1 automatically
docker build --no-cache -t n8n-forge-api .
```

#### TypeScript Compilation Errors

Check local build first:
```bash
pnpm install
pnpm build
```

Fix any TypeScript errors before building Docker image.

### Container is Unhealthy

Check health check status:
```bash
docker inspect --format='{{json .State.Health}}' n8n-forge-api | jq
```

Verify the health endpoint manually:
```bash
docker exec n8n-forge-api curl http://localhost:3000/health
```

### View Real-Time Logs

```bash
# Docker
docker logs -f n8n-forge-api

# Docker Compose
docker-compose logs -f
```

### Exec into Running Container

```bash
# Docker
docker exec -it n8n-forge-api sh

# Docker Compose
docker-compose exec n8n-forge-api sh
```

### Reset Everything

```bash
# Stop and remove containers, networks, volumes
docker-compose down -v

# Remove image
docker rmi n8n-forge-api

# Rebuild from scratch
docker-compose up --build -d
```

## Advanced Usage

### Multi-Architecture Builds

Build for multiple platforms (e.g., ARM64 for Apple Silicon):

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t n8n-forge-api:latest \
  --push .
```

### Custom Build Context

Build from a different directory:
```bash
docker build -f /path/to/Dockerfile -t n8n-forge-api /path/to/context
```

### Volume Mounts for Development

Mount source code for live development:
```bash
docker run -p 3000:3000 \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/dist:/app/dist \
  n8n-forge-api
```

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

## Support

For issues specific to Docker deployment, check:
1. Container logs: `docker logs n8n-forge-api`
2. Health status: `docker inspect n8n-forge-api`
3. Resource usage: `docker stats n8n-forge-api`

For application issues, see the main [README.md](../README.md).
