const Database = require('better-sqlite3');
const path = require('path');

// Database file path - will be created if it doesn't exist
const DB_PATH = path.join(__dirname, 'expenses.db');

class ExpenseDatabase {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    try {
      // Create database connection
      this.db = new Database(DB_PATH);
      
      // Enable WAL mode for better concurrent access
      this.db.pragma('journal_mode = WAL');
      
      // Create expenses table if it doesn't exist
      this.createTables();
      
      console.log('📊 Database initialized successfully');
      console.log(`💾 Database location: ${DB_PATH}`);
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  createTables() {
    // Users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `;

    // Friends table for relationships
    const createFriendsTable = `
      CREATE TABLE IF NOT EXISTS friends (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL,
        addressee_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(requester_id, addressee_id)
      )
    `;

    // Updated expenses table with user_id
    const createExpensesTable = `
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_friends_requester ON friends(requester_id);
      CREATE INDEX IF NOT EXISTS idx_friends_addressee ON friends(addressee_id);
      CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);
      CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
      CREATE INDEX IF NOT EXISTS idx_expenses_amount ON expenses(amount);
      CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
    `;

    try {
      // Create all tables
      this.db.exec(createUsersTable);
      this.db.exec(createFriendsTable);
      this.db.exec(createExpensesTable);
      this.db.exec(createIndexes);
      console.log('✅ Database tables and indexes created');
      
    } catch (error) {
      console.error('❌ Failed to create tables:', error);
      throw error;
    }
  }

  // Migrate existing expenses to have a default user
  migrateExistingData() {
    try {
      // Check if expenses table has user_id column
      const tableInfo = this.db.prepare("PRAGMA table_info(expenses)").all();
      const hasUserIdColumn = tableInfo.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('🔄 Adding user_id column to existing expenses table...');
        
        // Add user_id column to existing expenses table
        this.db.exec('ALTER TABLE expenses ADD COLUMN user_id TEXT');
        this.db.exec('ALTER TABLE expenses ADD COLUMN description TEXT');
        
        // Create default user for existing expenses
        const bcrypt = require('bcryptjs');
        const defaultUserId = 'default-user-' + Date.now();
        const createDefaultUser = this.db.prepare(`
          INSERT OR IGNORE INTO users (id, username, email, password_hash, display_name)
          VALUES (?, ?, ?, ?, ?)
        `);
        
        createDefaultUser.run(
          defaultUserId,
          'demo_user',
          'demo@example.com',
          bcrypt.hashSync('demo123', 10),
          'Demo User'
        );

        // Update all existing expenses to belong to default user
        const updateExpenses = this.db.prepare('UPDATE expenses SET user_id = ? WHERE user_id IS NULL');
        const result = updateExpenses.run(defaultUserId);
        
        console.log(`🔄 Migrated ${result.changes} existing expenses to default user`);
        
        // Add the foreign key constraint by recreating the table
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
        `);
      } else {
        // Check for orphan expenses
        const orphanExpenses = this.db.prepare('SELECT COUNT(*) as count FROM expenses WHERE user_id IS NULL').get();
        
        if (orphanExpenses.count > 0) {
          // Create a default user for existing expenses
          const bcrypt = require('bcryptjs');
          const defaultUserId = 'default-user-' + Date.now();
          const createDefaultUser = this.db.prepare(`
            INSERT OR IGNORE INTO users (id, username, email, password_hash, display_name)
            VALUES (?, ?, ?, ?, ?)
          `);
          
          createDefaultUser.run(
            defaultUserId,
            'demo_user',
            'demo@example.com',
            bcrypt.hashSync('demo123', 10),
            'Demo User'
          );

          // Update orphan expenses
          const updateExpenses = this.db.prepare('UPDATE expenses SET user_id = ? WHERE user_id IS NULL');
          const result = updateExpenses.run(defaultUserId);
          
          console.log(`🔄 Migrated ${result.changes} existing expenses to default user`);
        }
      }
    } catch (error) {
      console.error('⚠️ Migration warning:', error.message);
    }
  }

  // User authentication methods
  
  // Create new user
  createUser(userData) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (id, username, email, password_hash, display_name, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        userData.id,
        userData.username,
        userData.email,
        userData.password_hash,
        userData.display_name,
        userData.avatar_url || null
      );
      
      return this.getUserById(userData.id);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Username or email already exists');
      }
      console.error('❌ Failed to create user:', error);
      throw error;
    }
  }

  // Get user by ID
  getUserById(userId) {
    try {
      const stmt = this.db.prepare('SELECT id, username, email, display_name, avatar_url, created_at, last_login FROM users WHERE id = ?');
      return stmt.get(userId);
    } catch (error) {
      console.error('❌ Failed to get user by ID:', error);
      throw error;
    }
  }

  // Get user by username or email
  getUserByLogin(identifier) {
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
      return stmt.get(identifier, identifier);
    } catch (error) {
      console.error('❌ Failed to get user by login:', error);
      throw error;
    }
  }

  // Update user last login
  updateLastLogin(userId) {
    try {
      const stmt = this.db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(userId);
    } catch (error) {
      console.error('❌ Failed to update last login:', error);
    }
  }

  // Get all expenses for a user
  getAllExpenses(userId = null) {
    try {
      if (userId) {
        const stmt = this.db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC');
        return stmt.all(userId);
      } else {
        const stmt = this.db.prepare('SELECT * FROM expenses ORDER BY date DESC, created_at DESC');
        return stmt.all();
      }
    } catch (error) {
      console.error('❌ Failed to get expenses:', error);
      throw error;
    }
  }

  // Add new expense
  addExpense(expense, userId) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO expenses (id, user_id, title, category, amount, date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        expense.id,
        userId,
        expense.title || null,
        expense.category,
        expense.amount,
        expense.date,
        expense.description || null
      );
      
      return { ...expense, user_id: userId, created_at: new Date().toISOString() };
    } catch (error) {
      console.error('❌ Failed to add expense:', error);
      throw error;
    }
  }

  // Update expense
  updateExpense(id, expense, userId) {
    try {
      const stmt = this.db.prepare(`
        UPDATE expenses 
        SET title = ?, category = ?, amount = ?, date = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `);
      
      const result = stmt.run(
        expense.title || null,
        expense.category,
        expense.amount,
        expense.date,
        expense.description || null,
        id,
        userId
      );
      
      if (result.changes === 0) {
        throw new Error('Expense not found');
      }
      
      return { ...expense, id, user_id: userId, updated_at: new Date().toISOString() };
    } catch (error) {
      console.error('❌ Failed to update expense:', error);
      throw error;
    }
  }

  // Delete expense
  deleteExpense(id, userId) {
    try {
      const stmt = this.db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?');
      const result = stmt.run(id, userId);
      
      if (result.changes === 0) {
        throw new Error('Expense not found');
      }
      
      return { deleted: true };
    } catch (error) {
      console.error('❌ Failed to delete expense:', error);
      throw error;
    }
  }

  // Get monthly summary
  getMonthlyData() {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          DATE(date, 'start of month') as month,
          COUNT(*) as count,
          ROUND(SUM(amount), 2) as total,
          ROUND(AVG(amount), 2) as average
        FROM expenses 
        GROUP BY DATE(date, 'start of month')
        ORDER BY month DESC
        LIMIT 12
      `);
      
      return stmt.all();
    } catch (error) {
      console.error('❌ Failed to get monthly data:', error);
      throw error;
    }
  }

  // Get category breakdown
  getCategoryBreakdown(startDate, endDate) {
    try {
      let query = `
        SELECT 
          category,
          COUNT(*) as count,
          ROUND(SUM(amount), 2) as total,
          ROUND(AVG(amount), 2) as average
        FROM expenses
      `;
      
      const params = [];
      if (startDate && endDate) {
        query += ' WHERE date BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }
      
      query += ' GROUP BY category ORDER BY total DESC';
      
      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      console.error('❌ Failed to get category breakdown:', error);
      throw error;
    }
  }

  // Search expenses for a user
  searchExpenses(searchTerm, userId) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM expenses 
        WHERE user_id = ? AND (title LIKE ? OR category LIKE ?)
        ORDER BY date DESC, created_at DESC
      `);
      
      const searchPattern = `%${searchTerm}%`;
      return stmt.all(userId, searchPattern, searchPattern);
    } catch (error) {
      console.error('❌ Failed to search expenses:', error);
      throw error;
    }
  }

  // Friend system methods
  
  // Send friend request
  sendFriendRequest(requesterId, addresseeId) {
    try {
      // Check if users exist
      const requester = this.getUserById(requesterId);
      const addressee = this.getUserById(addresseeId);
      
      if (!requester || !addressee) {
        throw new Error('User not found');
      }

      if (requesterId === addresseeId) {
        throw new Error('Cannot send friend request to yourself');
      }

      // Check if friendship already exists
      const existing = this.db.prepare(`
        SELECT * FROM friends 
        WHERE (requester_id = ? AND addressee_id = ?) 
           OR (requester_id = ? AND addressee_id = ?)
      `).get(requesterId, addresseeId, addresseeId, requesterId);

      if (existing) {
        throw new Error('Friend request already exists');
      }

      const friendId = require('uuid').v4();
      const stmt = this.db.prepare(`
        INSERT INTO friends (id, requester_id, addressee_id, status)
        VALUES (?, ?, ?, 'pending')
      `);
      
      stmt.run(friendId, requesterId, addresseeId);
      return { id: friendId, status: 'pending' };
    } catch (error) {
      console.error('❌ Failed to send friend request:', error);
      throw error;
    }
  }

  // Accept/reject friend request
  respondToFriendRequest(friendshipId, userId, action) {
    try {
      if (!['accept', 'reject'].includes(action)) {
        throw new Error('Invalid action');
      }

      const friendship = this.db.prepare('SELECT * FROM friends WHERE id = ? AND addressee_id = ?').get(friendshipId, userId);
      
      if (!friendship) {
        throw new Error('Friend request not found');
      }

      const newStatus = action === 'accept' ? 'accepted' : 'rejected';
      const stmt = this.db.prepare('UPDATE friends SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      
      stmt.run(newStatus, friendshipId);
      return { status: newStatus };
    } catch (error) {
      console.error('❌ Failed to respond to friend request:', error);
      throw error;
    }
  }

  // Get user's friends
  getFriends(userId) {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          f.id as friendship_id,
          f.status,
          f.created_at as friendship_created,
          u.id,
          u.username,
          u.display_name,
          u.avatar_url
        FROM friends f
        JOIN users u ON (
          CASE 
            WHEN f.requester_id = ? THEN u.id = f.addressee_id
            ELSE u.id = f.requester_id
          END
        )
        WHERE (f.requester_id = ? OR f.addressee_id = ?) 
          AND f.status = 'accepted'
        ORDER BY f.created_at DESC
      `);
      
      return stmt.all(userId, userId, userId);
    } catch (error) {
      console.error('❌ Failed to get friends:', error);
      throw error;
    }
  }

  // Get pending friend requests
  getPendingFriendRequests(userId) {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          f.id as friendship_id,
          f.status,
          f.created_at,
          u.id,
          u.username,
          u.display_name,
          u.avatar_url
        FROM friends f
        JOIN users u ON u.id = f.requester_id
        WHERE f.addressee_id = ? AND f.status = 'pending'
        ORDER BY f.created_at DESC
      `);
      
      return stmt.all(userId);
    } catch (error) {
      console.error('❌ Failed to get pending requests:', error);
      throw error;
    }
  }

  // Search users (for adding friends)
  searchUsers(searchTerm, currentUserId, limit = 10) {
    try {
      const stmt = this.db.prepare(`
        SELECT id, username, display_name, avatar_url
        FROM users 
        WHERE (username LIKE ? OR display_name LIKE ?) 
          AND id != ?
        LIMIT ?
      `);
      
      const searchPattern = `%${searchTerm}%`;
      return stmt.all(searchPattern, searchPattern, currentUserId, limit);
    } catch (error) {
      console.error('❌ Failed to search users:', error);
      throw error;
    }
  }

  // Get friend's spending summary for comparison
  getFriendStats(friendId, currentUserId) {
    try {
      // First verify they are friends
      const friendship = this.db.prepare(`
        SELECT * FROM friends 
        WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
          AND status = 'accepted'
      `).get(currentUserId, friendId, friendId, currentUserId);

      if (!friendship) {
        throw new Error('Not friends with this user');
      }

      // Get friend's stats
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count, ROUND(SUM(amount), 2) as total FROM expenses WHERE user_id = ?');
      const monthlyStmt = this.db.prepare(`
        SELECT 
          DATE(date, 'start of month') as month,
          COUNT(*) as count,
          ROUND(SUM(amount), 2) as total
        FROM expenses 
        WHERE user_id = ? AND date >= date('now', '-12 months')
        GROUP BY DATE(date, 'start of month')
        ORDER BY month DESC
      `);
      
      const categoryStmt = this.db.prepare(`
        SELECT 
          category,
          COUNT(*) as count,
          ROUND(SUM(amount), 2) as total
        FROM expenses 
        WHERE user_id = ? AND date >= date('now', '-1 month')
        GROUP BY category 
        ORDER BY total DESC 
        LIMIT 5
      `);

      const totals = totalStmt.get(friendId);
      const monthly = monthlyStmt.all(friendId);
      const categories = categoryStmt.all(friendId);

      return {
        totalExpenses: totals.count || 0,
        totalAmount: totals.total || 0,
        monthlyData: monthly,
        topCategories: categories
      };
    } catch (error) {
      console.error('❌ Failed to get friend stats:', error);
      throw error;
    }
  }

  // Get database statistics
  getStats() {
    try {
      const totalExpensesStmt = this.db.prepare('SELECT COUNT(*) as count FROM expenses');
      const totalAmountStmt = this.db.prepare('SELECT ROUND(SUM(amount), 2) as total FROM expenses');
      const avgAmountStmt = this.db.prepare('SELECT ROUND(AVG(amount), 2) as average FROM expenses');
      
      return {
        totalExpenses: totalExpensesStmt.get().count,
        totalAmount: totalAmountStmt.get().total || 0,
        averageAmount: avgAmountStmt.get().average || 0
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      throw error;
    }
  }

  // Create seed data (optional)
  createSeedData() {
    try {
      const existingUsers = this.db.prepare('SELECT COUNT(*) as count FROM users').get();
      if (existingUsers.count > 0) {
        console.log('📝 Seed data skipped - users already exist');
        return;
      }

      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');

      // Create demo users
      const seedUsers = [
        {
          id: uuidv4(),
          username: 'demo_user',
          email: 'demo@example.com',
          password_hash: bcrypt.hashSync('demo123', 10),
          display_name: 'Demo User'
        },
        {
          id: uuidv4(),
          username: 'friend_user',
          email: 'friend@example.com',
          password_hash: bcrypt.hashSync('friend123', 10),
          display_name: 'Friend User'
        }
      ];

      seedUsers.forEach(user => {
        this.createUser(user);
      });

      // Create some expenses for the demo user
      const seedExpenses = [
        {
          id: uuidv4(),
          title: 'Morning Coffee',
          category: 'Food & Dining',
          amount: 4.50,
          date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString().split('T')[0],
          description: 'Daily coffee run'
        },
        {
          id: uuidv4(),
          title: 'Gas Station',
          category: 'Transportation',
          amount: 45.00,
          date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString().split('T')[0],
          description: 'Weekly gas fill-up'
        },
        {
          id: uuidv4(),
          title: 'Grocery Store',
          category: 'Groceries',
          amount: 67.89,
          date: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString().split('T')[0],
          description: 'Weekly groceries'
        }
      ];

      seedExpenses.forEach(expense => {
        this.addExpense(expense, seedUsers[0].id);
      });

      // Create friendship between demo users
      this.sendFriendRequest(seedUsers[0].id, seedUsers[1].id);
      const friendship = this.db.prepare('SELECT id FROM friends WHERE requester_id = ? AND addressee_id = ?').get(seedUsers[0].id, seedUsers[1].id);
      if (friendship) {
        this.respondToFriendRequest(friendship.id, seedUsers[1].id, 'accept');
      }

      console.log(`🌱 Created ${seedUsers.length} seed users and ${seedExpenses.length} seed expenses`);
    } catch (error) {
      console.error('❌ Failed to create seed data:', error);
    }
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      console.log('🔒 Database connection closed');
    }
  }
}

module.exports = ExpenseDatabase;
