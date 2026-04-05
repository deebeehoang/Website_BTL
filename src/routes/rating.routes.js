const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const RatingController = require('../controllers/rating.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Multer configuration for rating images
const ratingStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../public/images/uploads/ratings');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'rating-' + uniqueSuffix + ext);
  }
});

const ratingUpload = multer({
  storage: ratingStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file hình ảnh!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * Rating Routes
 */

// Get all ratings (admin only)
router.get('/all', 
  authMiddleware.authenticateToken,
  roleMiddleware.checkRole(['Admin']),
  RatingController.getAllRatings
);

// Public route for testing ratings
router.get('/all-public', RatingController.getAllRatings);

// Get rating statistics (admin only)
router.get('/stats', 
  authMiddleware.authenticateToken,
  roleMiddleware.checkRole(['Admin']),
  RatingController.getRatingStats
);

// Check if user can rate a booking
router.get('/can-rate/:bookingId', authMiddleware.authenticateToken, RatingController.canRateBooking);

// Get ratings by tour ID (public)
router.get('/tour/:tourId', RatingController.getRatingsByTour);

// Get user's ratings
router.get('/my-ratings', 
  authMiddleware.authenticateToken,
  RatingController.getUserRatings
);

// Get rating by ID
router.get('/:id', RatingController.getRatingById);

// Create a new rating
router.post('/', 
  authMiddleware.authenticateToken,
  RatingController.createRating
);

// Update a rating (with image upload support)
router.put('/:id', 
  authMiddleware.authenticateToken,
  (req, res, next) => {
    // Log request info for debugging
    console.log('Rating update request:', {
      method: req.method,
      url: req.url,
      contentType: req.headers['content-type'],
      hasBody: !!req.body
    });
    next();
  },
  ratingUpload.array('images', 5), // Allow up to 5 images
  (req, res, next) => {
    // Log after multer processing
    console.log('After multer:', {
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      hasFiles: !!req.files,
      filesCount: req.files ? req.files.length : 0
    });
    next();
  },
  RatingController.updateRating
);

// Delete a rating
router.delete('/:id', 
  authMiddleware.authenticateToken,
  RatingController.deleteRating
);

// Delete all ratings for a tour (admin only)
router.delete('/tour/:tourId', 
  authMiddleware.authenticateToken,
  roleMiddleware.checkRole(['Admin']),
  RatingController.deleteRatingsByTour
);

module.exports = router;
