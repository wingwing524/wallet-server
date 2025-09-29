// Only load dotenv in development - Railway provides variables automatically
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const DatabaseFactory = require('./database-hybrid');
const { createToken, authenticateToken, optionalAuth, authLimiter, apiLimiter } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Railway deployment
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.CLIENT_URL, /\.railway\.app$/].filter(Boolean)
    : function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow localhost and local network IPs
        const allowedOrigins = [
          /^http:\/\/localhost:\d+$/,
          /^http:\/\/127\.0\.0\.1:\d+$/,
          /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
          /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
          /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/
        ];
        
        const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));
        callback(null, isAllowed);
      },
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', apiLimiter);

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// Initialize database with retry logic
let db;
async function initializeDatabase(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔄 Database initialization attempt ${i + 1}/${retries}`);
      db = DatabaseFactory.create();
      await db.init();
      
      // Create seed data if it's the first run
      if (process.env.NODE_ENV !== 'production') {
        await db.createSeedData();
      }
      console.log('✅ Database initialized successfully');
      return true;
    } catch (error) {
      console.error(`❌ Database initialization failed (attempt ${i + 1}):`, error.message);
      if (i < retries - 1) {
        console.log(`⏳ Waiting 5 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  console.error('❌ Failed to initialize database after all retries');
  return false;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected'
  });
});

// Categories for expenses
const categories = [
  'General',
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Bills & Utilities',
  'Healthcare',
  'Education',
  'Travel',
  'Subscriptions',
  'Personal Care',
  'Others'
];

// API Routes middleware
app.use('/api/*', (req, res, next) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not available' });
  }
  next();
});

// Authentication Routes
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: uuidv4(),
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      display_name: (displayName || username).trim()
    };

    const user = await db.createUser(newUser);
    const token = createToken(user.id);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        avatar: user.avatar_url
      },
      token
    });

  } catch (error) {
    if (error.message === 'Username or email already exists') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const user = await db.getUserByLogin(identifier.toLowerCase().trim());
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await db.updateLastLogin(user.id);
    const token = createToken(user.id);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        avatar: user.avatar_url,
        lastLogin: user.last_login
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Expense Routes
app.get('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const { month, year, category, search } = req.query;
    let expenses;

    if (search) {
      expenses = await db.searchExpenses(search, req.userId);
    } else {
      expenses = await db.getAllExpenses(req.userId);
    }

    if (month && year) {
      expenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() + 1 === parseInt(month) && 
               expenseDate.getFullYear() === parseInt(year);
      });
    }

    if (category) {
      expenses = expenses.filter(expense => expense.category === category);
    }

    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

app.post('/api/expenses', authenticateToken, async (req, res) => {
  try {
    const { title, amount, category, date, description } = req.body;

    if (!amount || !date) {
      return res.status(400).json({ 
        error: 'Amount and date are required' 
      });
    }

    const newExpense = {
      id: uuidv4(),
      title: title ? title.trim() : null,
      amount: parseFloat(amount),
      category: category || 'General',
      date,
      description: description ? description.trim() : ''
    };

    const savedExpense = await db.addExpense(newExpense, req.userId);
    res.status(201).json(savedExpense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

app.put('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { title, amount, category, date, description } = req.body;

    if (!amount || !date) {
      return res.status(400).json({ 
        error: 'Amount and date are required' 
      });
    }

    const updatedExpense = {
      title: title ? title.trim() : null,
      amount: parseFloat(amount),
      category: category || 'General',
      date,
      description: description ? description.trim() : ''
    };

    const savedExpense = await db.updateExpense(req.params.id, updatedExpense, req.userId);
    res.json(savedExpense);
  } catch (error) {
    if (error.message === 'Expense not found') {
      return res.status(404).json({ error: 'Expense not found' });
    }
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

app.delete('/api/expenses/:id', authenticateToken, async (req, res) => {
  try {
    await db.deleteExpense(req.params.id, req.userId);
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    if (error.message === 'Expense not found') {
      return res.status(404).json({ error: 'Expense not found' });
    }
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Friend System Routes

// Search users
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const users = await db.searchUsers(q.trim(), req.userId);
    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Send friend request
app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await db.sendFriendRequest(req.userId, userId);
    res.status(201).json({ message: 'Friend request sent', ...result });
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('not found') || error.message.includes('yourself')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Respond to friend request
app.post('/api/friends/respond', authenticateToken, async (req, res) => {
  try {
    const { friendshipId, action } = req.body;
    
    if (!friendshipId || !action) {
      return res.status(400).json({ error: 'Friendship ID and action are required' });
    }

    const result = await db.respondToFriendRequest(friendshipId, req.userId, action);
    res.json({ message: `Friend request ${action}ed`, ...result });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error responding to friend request:', error);
    res.status(500).json({ error: 'Failed to respond to friend request' });
  }
});

// Get friends list
app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const friends = await db.getFriends(req.userId);
    res.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Get pending friend requests
app.get('/api/friends/pending', authenticateToken, async (req, res) => {
  try {
    const requests = await db.getPendingFriendRequests(req.userId);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// Get friend's stats
app.get('/api/friends/:friendId/stats', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.params;
    const stats = await db.getFriendStats(friendId, req.userId);
    res.json(stats);
  } catch (error) {
    if (error.message.includes('Not friends')) {
      return res.status(403).json({ error: error.message });
    }
    console.error('Error fetching friend stats:', error);
    res.status(500).json({ error: 'Failed to fetch friend stats' });
  }
});

// Get categories
app.get('/api/categories', (req, res) => {
  res.json(categories);
});

// Catch-all handler: send back React's index.html file in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  if (db) await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Server terminated...');
  if (db) await db.close();
  process.exit(0);
});

// Start server
async function startServer() {
  console.log('🚀 Starting expense tracker server...');
  
  // Debug Railway environment
  if (process.env.NODE_ENV === 'production') {
    console.log('🏗️  Production Environment Debug:');
    console.log('PGHOST:', process.env.PGHOST);
    console.log('PGPORT:', process.env.PGPORT);
    console.log('PGDATABASE:', process.env.PGDATABASE);
    console.log('PGUSER:', process.env.PGUSER ? '***' : 'undefined');
    console.log('PGPASSWORD:', process.env.PGPASSWORD ? '***' : 'undefined');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  }
  
  const dbInitialized = await initializeDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📱 Optimized for iPhone 15 Pro`);
    console.log(`📊 Database status: ${dbInitialized ? 'Connected' : 'Disconnected'}`);
    
    if (!dbInitialized) {
      console.log('⚠️  Server started without database. Check Railway PostgreSQL service connection.');
    }
  });
}

startServer().catch(console.error);
