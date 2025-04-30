const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const User = require('./models/User');

// Store active users
const activeUsers = new Map();

// Function to get active users
const getActiveUsers = () => {
  return activeUsers;
};

const socketHandler = (io) => {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    
    // Add user to active users
    activeUsers.set(userId, socket.id);
    
    // Broadcast user online status
    io.emit('user_status', {
      userId,
      status: 'online'
    });

    // Handle new text message
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, content } = data;
        
        // Create and save message
        const message = new Message({
          sender: socket.user._id,
          receiver: receiverId,
          content,
          messageType: 'text'
        });
        await message.save();
        
        // Populate sender info
        await message.populate('sender', 'username');
        
        // Send to receiver if online
        const receiverSocketId = activeUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('new_message', message);
        }
        
        // Send back to sender
        socket.emit('message_sent', message);
      } catch (error) {
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    // Handle image message notification
    socket.on('image_message_sent', async (data) => {
      try {
        const { messageId, receiverId } = data;
        
        // Find the message to get its data
        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit('error', { message: 'Message not found' });
        }
        
        // Don't send the image data through socket
        // Instead send metadata for the client to fetch the image
        const messageData = {
          _id: message._id,
          sender: message.sender,
          receiver: message.receiver,
          messageType: 'image',
          createdAt: message.createdAt,
          read: message.read
        };
        
        // Send to receiver if online
        const receiverSocketId = activeUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('new_message', messageData);
        }
        
      } catch (error) {
        socket.emit('error', { message: 'Error processing image message', error: error.message });
      }
    });

    // Handle message deletion
    socket.on('message_deleted', async (data) => {
      try {
        const { messageId, receiverId } = data;

        // Notify the receiver that a message was deleted
        const receiverSocketId = activeUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message_deleted', { messageId });
        }
        
        // Send confirmation back to sender
        socket.emit('message_delete_confirmed', { messageId });
      } catch (error) {
        socket.emit('error', { message: 'Error processing message deletion', error: error.message });
      }
    });

    // Handle typing status
    socket.on('typing', (data) => {
      const receiverSocketId = activeUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user_typing', {
          userId: socket.user._id,
          username: socket.user.username
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      activeUsers.delete(userId);
      io.emit('user_status', {
        userId,
        status: 'offline'
      });
    });
  });
};

module.exports = { socketHandler, getActiveUsers }; 