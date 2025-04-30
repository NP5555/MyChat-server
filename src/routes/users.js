const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { getActiveUsers } = require('../socket');

const router = express.Router();

// Get all users
router.get('/', auth, async (req, res) => {
  console.log('GET /api/users endpoint hit, user:', req.user.username);
  
  try {
    const users = await User.find({}, '-password');
    const activeUsers = getActiveUsers();
    
    console.log('Active users:', Array.from(activeUsers.keys()));
    
    // Map users and add online status
    const usersWithStatus = users.map(user => {
      const userId = user._id.toString();
      const isOnline = activeUsers.has(userId);
      
      console.log(`User ${userId} (${user.username}) online status: ${isOnline}`);
      
      return {
        _id: userId,
        username: user.username,
        email: user.email,
        online: isOnline
      };
    });
    
    console.log('Sending users with status:', usersWithStatus);
    res.json({ users: usersWithStatus });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

module.exports = router; 