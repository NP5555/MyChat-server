const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'image'],
    default: 'text'
  },
  imageData: {
    data: Buffer,
    contentType: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
});

// Content is required only for text messages
messageSchema.pre('save', function(next) {
  if (this.messageType === 'text' && !this.content) {
    return next(new Error('Content is required for text messages'));
  }
  
  if (this.messageType === 'image' && !this.imageData.data) {
    return next(new Error('Image data is required for image messages'));
  }
  
  next();
});

// Index for efficient querying of chat history
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema); 