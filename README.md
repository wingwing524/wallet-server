# Wallet Server

A minimal Express.js API server for testing Railway deployment.

## Features

- ✅ Express.js server
- ✅ CORS enabled for all origins
- ✅ Environment variable support
- ✅ Health check endpoint
- ✅ Test API endpoints
- ✅ Error handling
- ✅ Graceful shutdown

## Endpoints

- `GET /` - Server info and available endpoints
- `GET /health` - Health check with uptime
- `GET /api/test` - GET request test
- `POST /api/test` - POST request test

## Local Development

```bash
npm install
npm start
```

## Railway Deployment

Configured for automatic Railway deployment with `railway.toml`.

The server will run on Railway's assigned port (accessible via environment variable `PORT`).