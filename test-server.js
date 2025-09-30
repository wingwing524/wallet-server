// Minimal Express server for Railway testing
const express = require('express');
const app = express();

// Use Railway's PORT or default to 3000
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting minimal test server...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', PORT);
console.log('Railway URL:', process.env.RAILWAY_STATIC_URL);

// Basic middleware
app.use(express.json());

// CORS headers for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('📋 Root endpoint hit');
  res.json({
    message: 'Hello World! Railway Test Server is running! 🚀',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT,
    railway: !!process.env.RAILWAY_STATIC_URL
  });
});

// Health check
app.get('/health', (req, res) => {
  console.log('🏥 Health check endpoint hit');
  res.json({ 
    status: 'OK',
    message: 'Test server is healthy',
    timestamp: new Date().toISOString()
  });
});

// Test API endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 Test API endpoint hit');
  res.json({
    message: 'API is working!',
    data: { test: true, value: 42 }
  });
});

// Catch all other routes
app.get('*', (req, res) => {
  console.log('🔍 Unknown route:', req.path);
  res.json({
    message: 'Route not found',
    path: req.path,
    availableRoutes: ['/', '/health', '/api/test']
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server running successfully!`);
  console.log(`🌐 Host: 0.0.0.0:${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log(`📡 Railway: https://wallet-server-production-e8ef.up.railway.app`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

console.log('🎯 Test server setup complete');