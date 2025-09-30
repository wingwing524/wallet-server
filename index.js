require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

console.log('🚀 Starting minimal wallet server...');
console.log('🔧 Environment:', process.env.NODE_ENV);
console.log('🌐 Port:', PORT);

// CORS middleware - Allow all origins for testing
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// JSON middleware
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Wallet Server API 💰',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoints: [
      'GET / - This endpoint',
      'GET /health - Health check',
      'GET /api/test - API test endpoint',
      'POST /api/test - POST test endpoint'
    ]
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// Test API endpoints
app.get('/api/test', (req, res) => {
  res.json({
    message: 'GET API test successful! ✅',
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
    headers: {
      'user-agent': req.get('user-agent'),
      'origin': req.get('origin')
    }
  });
});

app.post('/api/test', (req, res) => {
  res.json({
    message: 'POST API test successful! 📨',
    method: req.method,
    path: req.path,
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: ['/', '/health', '/api/test']
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('❌ Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Host: 0.0.0.0:${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log(`✨ Ready for testing!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Server terminated...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});