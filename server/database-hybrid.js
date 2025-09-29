// Hybrid database setup: SQLite for development, PostgreSQL for production
const path = require('path');

class DatabaseFactory {
  static create() {
    // Always use PostgreSQL (Railway database) regardless of environment
    console.log('🐘 Using PostgreSQL (Railway database)');
    const PostgreSQLDatabase = require('./database-postgres');
    return new PostgreSQLDatabase();
  }
}

module.exports = DatabaseFactory;