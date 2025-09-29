# Monthly Expense Tracker

A full-stack mobile-friendly expense tracking application built with React and Node.js, now using PostgreSQL for persistent data storage.

## 🚀 Deployment to Railway

### Prerequisites
1. Railway account
2. PostgreSQL database service on Railway

### Environment Variables

**Railway automatically provides the PostgreSQL environment variables when you add the PostgreSQL service.**

You only need to manually set these in Railway:

```bash
# Application Environment
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret-key
```

**Note:** `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE` are automatically provided by Railway's PostgreSQL service.

### Deployment Steps

1. **Connect your repository to Railway**
   - Go to [Railway](https://railway.app)
   - Create a new project
   - Connect your GitHub repository

2. **Add PostgreSQL Database**
   - Click "New Service" → "Database" → "PostgreSQL"
   - Railway will automatically create the database and provide connection variables

3. **Configure Build Command**
   Railway should automatically detect your build script, but ensure it's:
   ```bash
   cd client && npm install && npm run build
   ```

4. **Deploy**
   - Railway will automatically deploy when you push to your connected branch
   - The database tables will be created automatically on first run

### Database Migration

Your app will automatically:
- Create necessary tables on startup
- Handle existing data gracefully
- Migrate from SQLite data if needed

## 🔧 Local Development

1. **Install dependencies**
   ```bash
   npm install
   cd client && npm install
   ```

2. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```bash
   NODE_ENV=development
   DATABASE_URL=your-database-url
   JWT_SECRET=your-jwt-secret
   ```

3. **Run the application**
   ```bash
   npm run dev
   ```

## 📱 Features

- User authentication and registration
- Add, edit, delete expenses
- Monthly expense summaries
- Category-based expense tracking
- Friends system for expense comparison
- Mobile-optimized interface
- **Persistent data storage with PostgreSQL**

## 🔧 Tech Stack

- **Frontend**: React, React Router, Chart.js
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (upgraded from SQLite)
- **Authentication**: JWT tokens
- **Deployment**: Railway

## 🎯 Key Benefits of PostgreSQL Migration

- ✅ **Persistent data** - No more data loss on redeploys
- ✅ **Better performance** for concurrent users
- ✅ **Scalability** for production use
- ✅ **ACID compliance** for data integrity
- ✅ **Cloud-ready** architecture

## 📞 Support

Your data will now persist across deployments! No more worries about losing expense data when updating your application.