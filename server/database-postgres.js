const pool = require('./config/database');
const { v4: uuidv4 } = require('uuid');

class ExpenseDatabase {
  constructor() {
    this.pool = pool;
  }

  async init() {
    try {
      await this.createTables();
      console.log('📊 PostgreSQL Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      // Don't throw the error if it's just a table that already exists
      if (error.code === '23505' && error.detail && error.detail.includes('already exists')) {
        console.log('⚠️ Tables already exist, continuing...');
        return;
      }
      throw error;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Users table
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          avatar_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP
        )
      `;

      // Friends table for relationships
      const createFriendsTable = `
        CREATE TABLE IF NOT EXISTS friends (
          id VARCHAR(255) PRIMARY KEY,
          requester_id VARCHAR(255) NOT NULL,
          addressee_id VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(requester_id, addressee_id)
        )
      `;

      // Expenses table
      const createExpensesTable = `
        CREATE TABLE IF NOT EXISTS expenses (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          title VARCHAR(255),
          category VARCHAR(100) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          date DATE NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `;

      // Create indexes
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

      // Execute all table creations (IF NOT EXISTS handles duplicates)
      await client.query(createUsersTable);
      await client.query(createFriendsTable);
      await client.query(createExpensesTable);
      await client.query(createIndexes);

      await client.query('COMMIT');
      console.log('✅ PostgreSQL tables and indexes created/verified');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to create tables:', error);
      
      // If it's just duplicate key errors for existing tables, that's okay
      if (error.code === '23505' || error.code === '42P07') {
        console.log('⚠️ Tables may already exist, continuing...');
        return;
      }
      throw error;
    } finally {
      client.release();
    }
  }

  // User authentication methods
  async createUser(userData) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO users (id, username, email, password_hash, display_name, avatar_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, email, display_name, avatar_url, created_at
      `;
      
      const values = [
        userData.id,
        userData.username,
        userData.email,
        userData.password_hash,
        userData.display_name,
        userData.avatar_url || null
      ];
      
      const result = await client.query(query, values);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL unique violation
        throw new Error('Username or email already exists');
      }
      console.error('❌ Failed to create user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserById(userId) {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT id, username, email, display_name, avatar_url, created_at, last_login FROM users WHERE id = $1';
      const result = await client.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Failed to get user by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserByLogin(identifier) {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM users WHERE username = $1 OR email = $1';
      const result = await client.query(query, [identifier]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Failed to get user by login:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateLastLogin(userId) {
    const client = await this.pool.connect();
    
    try {
      const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
      await client.query(query, [userId]);
    } catch (error) {
      console.error('❌ Failed to update last login:', error);
    } finally {
      client.release();
    }
  }

  // Expense methods
  async getAllExpenses(userId = null) {
    const client = await this.pool.connect();
    
    try {
      let query, values;
      
      if (userId) {
        query = 'SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC, created_at DESC';
        values = [userId];
      } else {
        query = 'SELECT * FROM expenses ORDER BY date DESC, created_at DESC';
        values = [];
      }
      
      const result = await client.query(query, values);
      
      // Convert amount from string to number for proper calculation
      const expenses = result.rows.map(expense => ({
        ...expense,
        amount: parseFloat(expense.amount) || 0
      }));
      
      return expenses;
    } catch (error) {
      console.error('❌ Failed to get expenses:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async addExpense(expense, userId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO expenses (id, user_id, title, category, amount, date, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const values = [
        expense.id,
        userId,
        expense.title || null,
        expense.category,
        expense.amount,
        expense.date,
        expense.description || null
      ];
      
      const result = await client.query(query, values);
      const newExpense = result.rows[0];
      
      // Convert amount from string to number for consistency
      if (newExpense) {
        newExpense.amount = parseFloat(newExpense.amount) || 0;
      }
      
      return newExpense;
    } catch (error) {
      console.error('❌ Failed to add expense:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateExpense(id, expense, userId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE expenses 
        SET title = $1, category = $2, amount = $3, date = $4, description = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6 AND user_id = $7
        RETURNING *
      `;
      
      const values = [
        expense.title || null,
        expense.category,
        expense.amount,
        expense.date,
        expense.description || null,
        id,
        userId
      ];
      
      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Expense not found');
      }
      
      const updatedExpense = result.rows[0];
      
      // Convert amount from string to number for consistency
      if (updatedExpense) {
        updatedExpense.amount = parseFloat(updatedExpense.amount) || 0;
      }
      
      return updatedExpense;
    } catch (error) {
      console.error('❌ Failed to update expense:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteExpense(id, userId) {
    const client = await this.pool.connect();
    
    try {
      const query = 'DELETE FROM expenses WHERE id = $1 AND user_id = $2';
      const result = await client.query(query, [id, userId]);
      
      if (result.rowCount === 0) {
        throw new Error('Expense not found');
      }
      
      return { deleted: true };
    } catch (error) {
      console.error('❌ Failed to delete expense:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getMonthlyData() {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          DATE_TRUNC('month', date) as month,
          COUNT(*) as count,
          ROUND(SUM(amount)::numeric, 2) as total,
          ROUND(AVG(amount)::numeric, 2) as average
        FROM expenses 
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY month DESC
        LIMIT 12
      `;
      
      const result = await client.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to get monthly data:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getCategoryBreakdown(startDate, endDate) {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT 
          category,
          COUNT(*) as count,
          ROUND(SUM(amount)::numeric, 2) as total,
          ROUND(AVG(amount)::numeric, 2) as average
        FROM expenses
      `;
      
      const values = [];
      if (startDate && endDate) {
        query += ' WHERE date BETWEEN $1 AND $2';
        values.push(startDate, endDate);
      }
      
      query += ' GROUP BY category ORDER BY total DESC';
      
      const result = await client.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to get category breakdown:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async searchExpenses(searchTerm, userId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT * FROM expenses 
        WHERE user_id = $1 AND (title ILIKE $2 OR category ILIKE $2)
        ORDER BY date DESC, created_at DESC
      `;
      
      const searchPattern = `%${searchTerm}%`;
      const result = await client.query(query, [userId, searchPattern]);
      
      // Convert amount from string to number for proper calculation
      const expenses = result.rows.map(expense => ({
        ...expense,
        amount: parseFloat(expense.amount) || 0
      }));
      
      return expenses;
    } catch (error) {
      console.error('❌ Failed to search expenses:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Friend system methods
  async sendFriendRequest(requesterId, addresseeId) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if users exist
      const requester = await this.getUserById(requesterId);
      const addressee = await this.getUserById(addresseeId);
      
      if (!requester || !addressee) {
        throw new Error('User not found');
      }

      if (requesterId === addresseeId) {
        throw new Error('Cannot send friend request to yourself');
      }

      // Check if friendship already exists
      const existingQuery = `
        SELECT * FROM friends 
        WHERE (requester_id = $1 AND addressee_id = $2) 
           OR (requester_id = $2 AND addressee_id = $1)
      `;
      const existingResult = await client.query(existingQuery, [requesterId, addresseeId]);

      if (existingResult.rows.length > 0) {
        throw new Error('Friend request already exists');
      }

      const friendId = uuidv4();
      const insertQuery = `
        INSERT INTO friends (id, requester_id, addressee_id, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id, status
      `;
      
      const result = await client.query(insertQuery, [friendId, requesterId, addresseeId]);
      await client.query('COMMIT');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to send friend request:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async respondToFriendRequest(friendshipId, userId, action) {
    const client = await this.pool.connect();
    
    try {
      if (!['accept', 'reject'].includes(action)) {
        throw new Error('Invalid action');
      }

      const findQuery = 'SELECT * FROM friends WHERE id = $1 AND addressee_id = $2';
      const findResult = await client.query(findQuery, [friendshipId, userId]);
      
      if (findResult.rows.length === 0) {
        throw new Error('Friend request not found');
      }

      const newStatus = action === 'accept' ? 'accepted' : 'rejected';
      const updateQuery = 'UPDATE friends SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING status';
      
      const result = await client.query(updateQuery, [newStatus, friendshipId]);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Failed to respond to friend request:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getFriends(userId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
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
            WHEN f.requester_id = $1 THEN u.id = f.addressee_id
            ELSE u.id = f.requester_id
          END
        )
        WHERE (f.requester_id = $1 OR f.addressee_id = $1) 
          AND f.status = 'accepted'
        ORDER BY f.created_at DESC
      `;
      
      const result = await client.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to get friends:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getPendingFriendRequests(userId) {
    const client = await this.pool.connect();
    
    try {
      const query = `
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
        WHERE f.addressee_id = $1 AND f.status = 'pending'
        ORDER BY f.created_at DESC
      `;
      
      const result = await client.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to get pending requests:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async searchUsers(searchTerm, currentUserId, limit = 10) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT id, username, display_name, avatar_url
        FROM users 
        WHERE (username ILIKE $1 OR display_name ILIKE $1) 
          AND id != $2
        LIMIT $3
      `;
      
      const searchPattern = `%${searchTerm}%`;
      const result = await client.query(query, [searchPattern, currentUserId, limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to search users:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getFriendStats(friendId, currentUserId) {
    const client = await this.pool.connect();
    
    try {
      // First, verify they are friends
      const friendshipQuery = `
        SELECT id FROM friends 
        WHERE ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
          AND status = 'accepted'
      `;
      
      const friendshipResult = await client.query(friendshipQuery, [currentUserId, friendId]);
      
      if (friendshipResult.rows.length === 0) {
        throw new Error('Not friends with this user');
      }

      // Get friend's total stats
      const totalStatsQuery = `
        SELECT 
          COUNT(*) as totalExpenses,
          COALESCE(ROUND(SUM(amount)::numeric, 2), 0) as totalAmount,
          COALESCE(ROUND(AVG(amount)::numeric, 2), 0) as averageAmount
        FROM expenses
        WHERE user_id = $1
      `;
      
      const totalStatsResult = await client.query(totalStatsQuery, [friendId]);
      const totalStats = totalStatsResult.rows[0];

      // Get monthly data for the last 6 months
      const monthlyDataQuery = `
        SELECT 
          TO_CHAR(date, 'YYYY-MM') as month,
          COUNT(*) as count,
          COALESCE(ROUND(SUM(amount)::numeric, 2), 0) as total
        FROM expenses
        WHERE user_id = $1 
          AND date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY month DESC
      `;
      
      const monthlyDataResult = await client.query(monthlyDataQuery, [friendId]);

      // Get category breakdown
      const categoryQuery = `
        SELECT 
          category,
          COUNT(*) as count,
          COALESCE(ROUND(SUM(amount)::numeric, 2), 0) as total
        FROM expenses
        WHERE user_id = $1
        GROUP BY category
        ORDER BY total DESC
      `;
      
      const categoryResult = await client.query(categoryQuery, [friendId]);

      return {
        totalExpenses: parseInt(totalStats.totalexpenses) || 0,
        totalAmount: parseFloat(totalStats.totalamount) || 0,
        averageAmount: parseFloat(totalStats.averageamount) || 0,
        monthlyData: monthlyDataResult.rows.map(row => ({
          month: row.month,
          count: parseInt(row.count) || 0,
          total: parseFloat(row.total) || 0
        })),
        categoryBreakdown: categoryResult.rows.map(row => ({
          category: row.category,
          count: parseInt(row.count) || 0,
          total: parseFloat(row.total) || 0
        }))
      };
    } catch (error) {
      console.error('❌ Failed to get friend stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getStats() {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          COUNT(*) as totalExpenses,
          COALESCE(ROUND(SUM(amount)::numeric, 2), 0) as totalAmount,
          COALESCE(ROUND(AVG(amount)::numeric, 2), 0) as averageAmount
        FROM expenses
      `;
      
      const result = await client.query(query);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async createSeedData() {
    const client = await this.pool.connect();
    
    try {
      const existingUsersQuery = 'SELECT COUNT(*) as count FROM users';
      const existingUsersResult = await client.query(existingUsersQuery);
      
      if (parseInt(existingUsersResult.rows[0].count) > 0) {
        console.log('📝 Seed data skipped - users already exist');
        return;
      }

      const bcrypt = require('bcryptjs');

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

      for (const user of seedUsers) {
        await this.createUser(user);
      }

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

      for (const expense of seedExpenses) {
        await this.addExpense(expense, seedUsers[0].id);
      }

      console.log(`🌱 Created ${seedUsers.length} seed users and ${seedExpenses.length} seed expenses`);
    } catch (error) {
      console.error('❌ Failed to create seed data:', error);
    } finally {
      client.release();
    }
  }

  // Close database connection
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔒 Database connection pool closed');
    }
  }
}

module.exports = ExpenseDatabase;