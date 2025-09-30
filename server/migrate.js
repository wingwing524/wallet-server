#!/usr/bin/env node

/**
 * Database Migration and Setup Script
 * 
 * This script ensures the database is properly set up for production
 * Automatically runs database initialization and basic health checks
 */

const ExpenseDatabase = require('./database');
const path = require('path');

async function runMigration() {
  console.log('🔄 Starting database migration...');
  
  try {
    // Initialize database
    const db = new ExpenseDatabase();
    
    // Get current stats
    const stats = db.getStats();
    console.log(`📊 Database Stats:`);
    console.log(`   - Total Expenses: ${stats.totalExpenses}`);
    console.log(`   - Total Amount: $${stats.totalAmount}`);
    console.log(`   - Average Amount: $${stats.averageAmount}`);
    
    // Create seed data only in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('🌱 Creating seed data for development...');
      db.createSeedData();
    }
    
    // Test database operations
    console.log('🧪 Testing database operations...');
    
    // Test read operation
    const expenses = db.getAllExpenses();
    console.log(`   ✅ Read test: Found ${expenses.length} expenses`);
    
    // Test category breakdown
    const breakdown = db.getCategoryBreakdown();
    console.log(`   ✅ Category breakdown: ${breakdown.length} categories`);
    
    // Test monthly data
    const monthlyData = db.getMonthlyData();
    console.log(`   ✅ Monthly data: ${monthlyData.length} months`);
    
    db.close();
    console.log('✅ Database migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  runMigration().then(() => {
    console.log('🎉 Migration script completed!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };
