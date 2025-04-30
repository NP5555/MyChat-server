require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const usersRoutes = require('./routes/users');
const { socketHandler } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Root route - API status page
app.get('/', (req, res) => {
  const apiInfo = {
    status: 'online',
    timestamp: new Date().toISOString(),
    serverTime: new Date().toLocaleTimeString(),
    version: '1.0.0'
  };
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chat API Status</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          color: #333;
          line-height: 1.6;
        }
        .status-card {
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding: 2rem;
          margin: 2rem 0;
          background-color: #f9f9f9;
        }
        .status-indicator {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: #10b981;
          margin-right: 8px;
        }
        h1 {
          color: #2563eb;
          margin-bottom: 1.5rem;
        }
        .endpoints {
          margin-top: 2rem;
        }
        .endpoint {
          background-color: #e5e7eb;
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 0.5rem;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <h1>Simple Chat API</h1>
      
      <div class="status-card">
        <h2><span class="status-indicator"></span> API Status: Online</h2>
        <p>Server Time: ${apiInfo.serverTime}</p>
        <p>API Version: ${apiInfo.version}</p>
      </div>
      
      <div class="endpoints">
        <h3>Available Endpoints:</h3>
        <div class="endpoint">GET /api/users - Get users</div>
        <div class="endpoint">POST /api/auth/register - Register a new user</div>
        <div class="endpoint">POST /api/auth/login - Login a user</div>
        <div class="endpoint">GET /api/messages - Get messages</div>
      </div>
    </body>
    </html>
  `);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', usersRoutes);

// Socket.IO connection handler
socketHandler(io);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI , {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 