// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { Pool } = require('pg');

// Common pool configuration for stability
const poolConfig = {
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 20,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};

let pool;

try {
  // Railway connection using DATABASE_URL (preferred)
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      ...poolConfig
    });
  }
  // Railway connection using individual environment variables
  else if (process.env.PGHOST && process.env.PGPORT && process.env.PGDATABASE) {
    const isRailwayHost = process.env.PGHOST.includes('.proxy.rlwy.net') || process.env.PGHOST.includes('railway.app');
    
    pool = new Pool({
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: isRailwayHost ? { rejectUnauthorized: false } : false,
      ...poolConfig
    });
  }
  // Local development fallback
  else {
    console.log('⚠️  Using local development database');
    pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'expense_tracker',
      user: 'postgres',
      password: 'password',
      ...poolConfig
    });
  }

  console.log('✅ Database pool configured');
} catch (error) {
  console.error('❌ Database pool configuration failed:', error);
  throw error;
}

// Handle pool errors gracefully
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
});

module.exports = pool;