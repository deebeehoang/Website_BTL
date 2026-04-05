const express = require('express');
const DestinationController = require('../controllers/destination.controller');
const { authenticateToken, isAdmin } = require('../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up file storage for destination images
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = path.join(__dirname, '../../public/images/uploads/destination');
    // Đảm bảo thư mục tồn tại
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    cb(null, `destination-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// File filter to only allow image files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({ storage, fileFilter });

const router = express.Router();

// Public routes
router.get('/', DestinationController.getAllDestinations);
router.get('/search', DestinationController.searchDestinations);

// Tours-destinations management routes for admin
router.get('/tours/available', authenticateToken, isAdmin, DestinationController.getAvailableTours);
router.get('/tours/:tourId/destinations', authenticateToken, isAdmin, DestinationController.getTourDestinations);
router.post('/tours/:tourId/destinations/:destinationId', authenticateToken, isAdmin, DestinationController.addDestinationToTour);
router.put('/tours/:tourId/destinations/:destinationId', authenticateToken, isAdmin, DestinationController.updateDestinationOrder);
router.delete('/tours/:tourId/destinations/:destinationId', authenticateToken, isAdmin, DestinationController.removeDestinationFromTour);

// Get destination by ID - must be after other specific routes
router.get('/:id', DestinationController.getDestinationById);

// Admin only routes
router.post('/', authenticateToken, isAdmin, upload.single('hinh_anh'), DestinationController.createDestination);
router.put('/:id', authenticateToken, isAdmin, upload.single('hinh_anh'), DestinationController.updateDestination);
router.delete('/:id', authenticateToken, isAdmin, DestinationController.deleteDestination);

module.exports = router;