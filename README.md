# Expense Tracker API

A robust Express.js API server for expense tracking with PostgreSQL backend.

## Features

- ✅ Express.js server with rate limiting
- ✅ CORS enabled for frontend platforms
- ✅ Environment variable support
- ✅ Health check endpoint
- ✅ User authentication system (ready for DB)
- ✅ Expense CRUD operations (ready for DB)
- ✅ Category management
- ✅ Error handling & logging
- ✅ Graceful shutdown
- ✅ Railway deployment ready

## API Endpoints

### General
- `GET /` - Server info and available endpoints
- `GET /health` - Health check with uptime
- `GET /api/categories` - Get expense categories

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Expenses
- `GET /api/expenses` - Get user expenses
- `POST /api/expenses` - Create new expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

## Local Development

```bash
npm install
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)
- `JWT_SECRET` - Secret for JWT tokens
- `DATABASE_URL` - PostgreSQL connection string

## Railway Deployment

Configured for automatic Railway deployment with `railway.toml`.

1. Connect your PostgreSQL database on Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on git push

## Next Steps

- [ ] Connect PostgreSQL database
- [ ] Implement JWT authentication
- [ ] Add user registration/login logic
- [ ] Implement expense CRUD operations
- [ ] Add data validation
- [ ] Add unit tests