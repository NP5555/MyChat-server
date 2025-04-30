const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

// Multer configuration for memory storage
const storage = multer.memoryStorage();

// File filter for images
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Set up the multer middleware with limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Process the uploaded image
const processImage = async (req, res, next) => {
  if (!req.file) return next();

  try {
    console.log(`Processing image: ${req.file.originalname}, size: ${req.file.size}, type: ${req.file.mimetype}`);
    
    // Validate that we have image data
    if (!req.file.buffer || req.file.buffer.length === 0) {
      throw new Error('Empty image buffer received');
    }
    
    // More thorough image validation
    let metadata;
    try {
      metadata = await sharp(req.file.buffer).metadata();
      console.log(`Image metadata: ${JSON.stringify(metadata)}`);
      
      // Validate important metadata properties
      if (!metadata.width || !metadata.height || !metadata.format) {
        throw new Error('Invalid image metadata: missing dimensions or format');
      }
    } catch (metadataError) {
      console.error('Invalid image format:', metadataError);
      throw new Error(`Invalid image format: ${metadataError.message}`);
    }

    // Use higher quality and ensure proper format conversion
    let processedImageBuffer;
    try {
      // Convert to JPEG for consistency
      processedImageBuffer = await sharp(req.file.buffer)
        .resize({
          width: 1200,          // Higher resolution
          height: 1200,
          fit: sharp.fit.inside,
          withoutEnlargement: true
        })
        .jpeg({ quality: 90 })  // Higher quality
        .toBuffer();
      
      // Validate the processed buffer
      if (!processedImageBuffer || processedImageBuffer.length === 0) {
        throw new Error('Image processing resulted in empty data');
      }
    } catch (processingError) {
      console.error('Image processing error:', processingError);
      throw new Error(`Image processing failed: ${processingError.message}`);
    }

    // Replace the original buffer with the processed one
    req.file.buffer = processedImageBuffer;
    req.file.mimetype = 'image/jpeg';
    
    console.log(`Image processed successfully: new size: ${processedImageBuffer.length} bytes`);
    next();
  } catch (error) {
    console.error('Image processing failed:', error);
    next(new Error(`Image processing failed: ${error.message}`));
  }
};

module.exports = { 
  single: (fieldName) => [upload.single(fieldName), processImage],
  array: (fieldName, maxCount) => [upload.array(fieldName, maxCount), processImage]
}; 