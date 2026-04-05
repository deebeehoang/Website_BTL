const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tour.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Middleware để ghi log chi tiết request body
const logRequestBody = (req, res, next) => {
  console.log('===== TOUR REQUEST BODY LOG =====');
  console.log('Request URL:', req.originalUrl);
  console.log('Request Method:', req.method);
  console.log('Request Body:', JSON.stringify(req.body, null, 2));
  console.log('Request has image:', req.file ? 'YES' : 'NO');
  console.log('===============================');
  next();
};

// GET all tours
router.get('/', tourController.getAllTours);

// GET all tours directly from database (admin only)
router.get('/database/all', authMiddleware.authenticateToken, authMiddleware.isAdmin, tourController.getAllToursFromDatabase);

// Thêm route để kiểm tra cấu trúc bảng
router.get('/debug/table-structure', authMiddleware.authenticateToken, authMiddleware.isAdmin, async (req, res) => {
  try {
    const pool = require('../config/database');
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Tour_du_lich'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('============================');
    console.log('TOUR_DU_LICH TABLE STRUCTURE');
    console.log(JSON.stringify(columns, null, 2));
    console.log('============================');
    
    res.status(200).json({
      status: 'success',
      data: { columns }
    });
  } catch (error) {
    console.error('Error fetching table structure:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching table structure',
      error: error.message
    });
  }
});

// Search tours
router.get('/search', tourController.searchTours);

// GET featured tours
router.get('/featured', tourController.getFeaturedTours);

// GET popular tours
router.get('/popular', tourController.getPopularTours);

// GET popular destinations
router.get('/destinations/popular', tourController.getPopularDestinations);

// Lọc tour theo điểm đến
router.get('/destination/:destinationId', tourController.getToursByDestination);

// GET tour directly from Tour_du_lich table without joining with Dia_danh
router.get('/direct/:id', tourController.getTourDirectFromTable);

// Debug route - Đặt TRƯỚC các route có tham số động
router.get('/debug/check-structure', tourController.checkDatabaseStructure);

// Tour schedules - Đặt trước route có tham số
router.get('/schedules/available', tourController.getAvailableSchedules);
router.get('/schedules/popular', tourController.getPopularSchedules);
router.get('/schedules', authMiddleware.authenticateToken, tourController.getAllSchedules);
router.post('/schedules', authMiddleware.authenticateToken, authMiddleware.isAdmin, tourController.createSchedule);
router.get('/schedules/:lichId', tourController.getScheduleById);
router.put('/schedules/:lichId', authMiddleware.authenticateToken, authMiddleware.isAdmin, tourController.updateSchedule);
router.delete('/schedules/:lichId', authMiddleware.authenticateToken, authMiddleware.isAdmin, tourController.deleteSchedule);
router.get('/schedules/:lichId/available-seats', tourController.getAvailableSeats);

// GET tour by ID - Đặt sau các route cụ thể
router.get('/:id', tourController.getTourById);

// Get upcoming schedules for a tour
router.get('/:tourId/upcoming-schedules', tourController.getUpcomingSchedules);

// Get destinations for a tour
router.get('/:tourId/destinations', tourController.getTourDestinations);

// Protected routes - Yêu cầu quyền Admin
router.post('/', authMiddleware.authenticateToken, authMiddleware.isAdmin, logRequestBody, tourController.createTour);
router.put('/:id', authMiddleware.authenticateToken, authMiddleware.isAdmin, logRequestBody, tourController.updateTour);
router.delete('/:id', authMiddleware.authenticateToken, authMiddleware.isAdmin, tourController.deleteTour);

// Tour destinations
router.post('/:tourId/destinations/:destinationId', authMiddleware.authenticateToken, authMiddleware.isAdmin, tourController.addDestinationToTour);
router.delete('/:tourId/destinations/:destinationId', authMiddleware.authenticateToken, authMiddleware.isAdmin, tourController.removeDestinationFromTour);

module.exports = router;