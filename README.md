# Cactii - Simple JWT Auth App

A minimal web application demonstrating JWT authentication with refresh tokens.

## Features

- User registration and login
- JWT access tokens (15 minute expiry)
- Refresh tokens (7 day expiry)
- Protected routes
- Simple, clean UI
- SQLite database for persistent storage
- ngrok integration for easy internet access (optional)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and set your values:
     - `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`: Generate strong random strings for JWT signing
     - `PORT`: Server port (default: 3000)
     - `NGROK_AUTHTOKEN`: (Optional) Get from [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
     - `NGROK_DOMAIN`: (Optional) Reserved domain from [ngrok domains](https://dashboard.ngrok.com/cloud-edge/domains)

3. Start the server:

```bash
npm start
```

4. Open your browser and navigate to:
   - Local: `http://localhost:3000`
   - If ngrok is configured, the ngrok URL will be displayed in the console

## Usage

### Default Users

The app comes with 2 pre-configured users for testing:

- **Username**: `admin` / **Password**: `admin123`
- **Username**: `user` / **Password**: `password123`

### Getting Started

1. **Register**: Click the "Register" tab, enter a username and password, then click Register
2. **Login**: Click the "Login" tab, enter your credentials (or use the default users above), then click Login
3. **Test Protected Route**: After logging in, click "Test Protected Route" to verify your access token
4. **Logout**: Click the "Logout" button to end your session

### Database

The app uses SQLite for data persistence. The database file (`database.sqlite`) is automatically created on first run. All users and refresh tokens are stored in the database.

## API Endpoints

- `POST /api/register` - Register a new user
- `POST /api/login` - Login and receive access + refresh tokens
- `POST /api/refresh` - Get a new access token using refresh token
- `POST /api/logout` - Logout and invalidate refresh token
- `GET /api/protected` - Protected route (requires Authorization header)

## ngrok Integration

This app uses the [ngrok JavaScript SDK](https://ngrok.com/docs/getting-started/javascript) to optionally expose your local server to the internet. When you set `NGROK_AUTHTOKEN` in your `.env` file, the app will automatically create a tunnel and display the public URL in the console.

**Benefits:**

- Test your app from any device
- Share your app with others without deploying
- No need to configure port forwarding or firewall rules

**Getting Started with ngrok:**

1. Sign up for a free account at [ngrok.com](https://ngrok.com)
2. Get your auth token from the [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Add it to your `.env` file as shown in the setup instructions above

## Security Note

⚠️ **This is a simple demo app**. For production use:

- Store secrets in environment variables ✓ (already implemented)
- Use a proper database instead of in-memory storage ✓ (SQLite implemented)
- Add rate limiting
- Use HTTPS
- Implement proper error handling
- Add input validation and sanitization
- Change default user passwords
