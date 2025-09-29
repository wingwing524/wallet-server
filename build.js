#!/usr/bin/env node

console.log('🚀 Starting build process...');

const { execSync } = require('child_process');
const path = require('path');

try {
  const clientDir = path.join(__dirname, 'client');
  
  // Check if client node_modules exists, if not install
  const fs = require('fs');
  const clientNodeModules = path.join(clientDir, 'node_modules');
  
  if (!fs.existsSync(clientNodeModules)) {
    console.log('📦 Installing client dependencies...');
    execSync('npm ci --only=production', { cwd: clientDir, stdio: 'inherit' });
  } else {
    console.log('📦 Client dependencies already installed');
  }
  
  console.log('🏗️ Building React application...');
  execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });
  
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
