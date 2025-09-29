// Only load dotenv in development - Railway provides variables automatically
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { Pool } = require('pg');

// Debug: Log available environment variables
console.log('🔍 Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('PGHOST:', process.env.PGHOST);
console.log('PGPORT:', process.env.PGPORT);
console.log('PGDATABASE:', process.env.PGDATABASE);

let pool;

try {
  // Check if we have DATABASE_URL first (Railway preferred method)
  if (process.env.DATABASE_URL) {
    console.log('✅ Using DATABASE_URL connection');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Railway always needs SSL
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 20,
      // Handle connection resets
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });
  }
  // For Railway, use individual variables if DATABASE_URL is not available
  else if (process.env.PGHOST && process.env.PGPORT && process.env.PGDATABASE) {
    console.log('✅ Using individual PG environment variables (Railway)');
    pool = new Pool({
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: isRailway ? { rejectUnauthorized: false } : false, // SSL for Railway
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 20,
      // Handle connection resets
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });
  } 
  // Last resort: use default local connection for development
  else {
    console.log('⚠️  No database environment variables found, using defaults');
    pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'expense_tracker',
      user: 'postgres',
      password: 'password'
    });
  }
} catch (error) {
  console.error('❌ Error creating database pool:', error);
  throw error;
}

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection test failed:', err.message);
  } else {
    console.log('✅ Database connection test successful');
    console.log(`📍 Connected to: ${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}`);
    release();
  }
});

module.exports = pool;