const express = require('express');
const bookingController = require('../controllers/booking.controller');
const pool = require('../config/database');
const authMiddleware = require('../middlewares/auth.middleware');
const router = express.Router();

// Route debug trước tất cả các route khác - KHÔNG yêu cầu xác thực
router.get('/debug/simple', async (req, res) => {
  try {
    // Trả về dữ liệu cứng, không truy vấn DB
    res.status(200).json({
      status: 'success',
      message: 'Simple test route works',
      data: { test: 'OK' }
    });
  } catch (error) {
    console.error('Simple test route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route debug với truy vấn đơn giản
router.get('/debug/db', async (req, res) => {
  try {
    // Truy vấn đơn giản nhất
    const [result] = await pool.query('SELECT 1 as test');
    res.status(200).json({
      status: 'success',
      message: 'Database connection test successful',
      data: result
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route debug lấy tất cả booking không filter
router.get('/debug/all', async (req, res) => {
  try {
    // Truy vấn đơn giản nhất đến bảng Booking
    const [bookings] = await pool.query('SELECT * FROM Booking LIMIT 10');
    res.status(200).json({
      status: 'success',
      count: bookings.length,
      data: { bookings }
    });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware xác thực cho các routes còn lại
const { authenticateToken } = require('../middlewares/auth.middleware');
router.use(authenticateToken);

// Lấy tất cả bookings (admin)
router.get('/', bookingController.getAllBookings);

// Lấy booking của user hiện tại
router.get('/user/me', bookingController.getUserBookings);

// Lấy booking theo ID
router.get('/:id', bookingController.getBookingById);

// Tạo booking mới
router.post('/', bookingController.createBooking);

// Cập nhật trạng thái booking
router.put('/:id/status', bookingController.updateBookingStatus);

// Thêm dịch vụ vào booking
router.post('/:id/services', bookingController.addServices);

// Tạo hóa đơn cho booking
router.post('/:id/invoice', bookingController.createInvoice);

// Xử lý thanh toán
router.post('/:id/payment', authMiddleware.authenticateToken, bookingController.processPayment);

// Hủy booking
router.delete('/:id', bookingController.cancelBooking);

// Route hủy tour trực tiếp
router.post('/:id/cancel', bookingController.cancelBooking);

module.exports = router; 