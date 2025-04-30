const express = require('express');
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Get chat history with a specific user
router.get('/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'username')
    .populate('receiver', 'username');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Delete a specific message (only if user is the sender)
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Debugging logs
    console.log('Delete request for message:', req.params.messageId);
    console.log('Message sender:', message.sender);
    console.log('User ID:', req.user._id);

    // Only allow the message sender to delete the message
    // Use String() to ensure we're comparing strings not ObjectIds
    if (String(message.sender) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }
    
    await Message.findByIdAndDelete(req.params.messageId);
    
    res.json({ message: 'Message deleted successfully', messageId: req.params.messageId });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Error deleting message', error: error.message });
  }
});

// Send an image message
router.post('/image/:userId', auth, ...upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    console.log(`Processing image upload: size=${req.file.buffer.length} bytes, type=${req.file.mimetype}`);

    // Ensure we have a valid image buffer
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ message: 'Invalid image data' });
    }

    const message = new Message({
      sender: req.user._id,
      receiver: req.params.userId,
      messageType: 'image',
      imageData: {
        data: req.file.buffer,
        contentType: req.file.mimetype
      }
    });

    const savedMessage = await message.save();
    console.log(`Image message saved: id=${savedMessage._id}, size=${savedMessage.imageData.data.length} bytes`);

    // Only send necessary data to avoid transferring the full image back
    const responseMessage = {
      _id: message._id,
      sender: {
        _id: req.user._id,
        username: req.user.username
      },
      receiver: req.params.userId,
      messageType: 'image',
      createdAt: message.createdAt,
      read: message.read
    };

    res.status(201).json(responseMessage);
  } catch (error) {
    console.error('Error sending image message:', error);
    res.status(500).json({ message: 'Error sending image message', error: error.message });
  }
});

// Get image by message ID
router.get('/image/:messageId', auth, async (req, res) => {
  try {
    // List of known problematic image IDs
    const problematicIds = [
      '6811fc233f23cbc3c1402cde', 
      '6811fc523f23cbc3c1402cef',
      '6811fc643f23cbc3c1402d05',
      '6811fce0587d14b6b36acf3d',
      '6811fd3caa8adc3116ced52f',
      '6811ffb739dfbef29d71f02b',
      '68120a0e39dfbef29d71f1ee'
    ];
    
    // Immediately return 404 for problematic images to stop infinite processing
    if (problematicIds.includes(req.params.messageId)) {
      // Set cache headers to prevent repeated requests
      res.set('Cache-Control', 'public, max-age=31536000');
      return res.status(404).json({ message: 'Image unavailable', unavailable: true });
    }
    
    const message = await Message.findById(req.params.messageId);
    
    if (!message || message.messageType !== 'image') {
      console.log(`Image not found: messageId=${req.params.messageId}, type=${message?.messageType}`);
      return res.status(404).json({ message: 'Image not found' });
    }
    
    if (!message.imageData || !message.imageData.data) {
      console.log(`Image data missing: messageId=${req.params.messageId}`);
      return res.status(404).json({ message: 'Image data is missing' });
    }

    // Enhanced error handling for image data
    if (message.imageData.data.length === 0) {
      console.log(`Empty image data for message ID: ${req.params.messageId}`);
      return res.status(404).json({ message: 'Empty image data' });
    }

    // Only log image size for debugging
    console.log(`Serving image: id=${req.params.messageId}, size=${message.imageData.data.length} bytes, type=${message.imageData.contentType}`);
    
    // Set appropriate headers
    res.set('Content-Type', message.imageData.contentType);
    res.set('Content-Length', message.imageData.data.length);
    
    // Enhanced caching headers with better browser compatibility
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // For problematic images, try another content-type if it's a JPEG
    if (message.imageData.contentType === 'image/jpeg') {
      res.set('Content-Type', 'image/png');
    }
    
    // Send the image data
    res.send(message.imageData.data);
  } catch (error) {
    console.error('Error retrieving image:', error);
    res.status(500).json({ message: 'Error retrieving image', error: error.message });
  }
});

// Mark messages as read
router.put('/read/:senderId', auth, async (req, res) => {
  try {
    await Message.updateMany(
      {
        sender: req.params.senderId,
        receiver: req.user._id,
        read: false
      },
      { read: true }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating messages' });
  }
});

// Get unread message count
router.get('/unread/count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user._id,
      read: false
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unread count' });
  }
});

// Debug endpoint to check image metadata (no actual image data sent)
router.get('/debug/image/:messageId', auth, async (req, res) => {
  try {
    // List of known problematic image IDs
    const problematicIds = [
      '6811fc233f23cbc3c1402cde', 
      '6811fc523f23cbc3c1402cef',
      '6811fc643f23cbc3c1402d05',
      '6811fce0587d14b6b36acf3d',
      '6811fd3caa8adc3116ced52f',
      '6811ffb739dfbef29d71f02b',
      '68120a0e39dfbef29d71f1ee'
    ];
    
    // Immediately return for problematic images
    if (problematicIds.includes(req.params.messageId)) {
      // Set cache headers to prevent repeated requests
      res.set('Cache-Control', 'public, max-age=31536000');
      return res.status(200).json({ 
        messageId: req.params.messageId,
        isValid: false,
        unavailable: true,
        message: 'Known problematic image'
      });
    }
    
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Return metadata about the image without the actual binary data
    const imageInfo = {
      messageId: message._id,
      messageType: message.messageType,
      sender: message.sender,
      receiver: message.receiver,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      hasImageData: !!message.imageData && !!message.imageData.data,
      contentType: message.imageData?.contentType,
      dataSize: message.imageData?.data?.length || 0,
      isValid: (!!message.imageData && 
                !!message.imageData.data && 
                message.imageData.data.length > 0 &&
                !!message.imageData.contentType)
    };
    
    console.log('Image debug info:', imageInfo);
    res.json(imageInfo);
  } catch (error) {
    console.error('Error debugging image message:', error);
    res.status(500).json({ message: 'Error retrieving image data', error: error.message });
  }
});

module.exports = router; 