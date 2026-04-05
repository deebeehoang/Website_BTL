// routes/payment.routes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// Đảm bảo tất cả các hàm controller tồn tại
if (!paymentController.createZaloOrder) {
  throw new Error('createZaloOrder function is not exported from payment controller');
}
if (!paymentController.zaloCallback) {
  throw new Error('zaloCallback function is not exported from payment controller');
}
if (!paymentController.checkZaloStatus) {
  throw new Error('checkZaloStatus function is not exported from payment controller');
}
if (!paymentController.confirmPayment) {
  throw new Error('confirmPayment function is not exported from payment controller');
}

// Middleware để log tất cả requests đến /zalo-callback
const logZaloCallback = (req, res, next) => {
  console.log('🔔 ZaloPay Callback Request received:');
  console.log('- Time:', new Date().toISOString());
  console.log('- Method:', req.method);
  console.log('- URL:', req.originalUrl);
  console.log('- Headers:', JSON.stringify(req.headers, null, 2));
  console.log('- Body:', JSON.stringify(req.body, null, 2));
  next();
};

// Định nghĩa các routes
// Không cần auth cho callback (ZaloPay gọi từ bên ngoài)
router.post('/zalo-callback', logZaloCallback, paymentController.zaloCallback);
// Các route khác cần authentication
router.post('/zalo-create', authenticateToken, paymentController.createZaloOrder);
router.post('/zalo-status', authenticateToken, paymentController.checkZaloStatus);
router.post('/bookings/:bookingId/payment', authenticateToken, paymentController.confirmPayment);

// Thêm routes cho frontend payment
router.post('/momo/create', authenticateToken, paymentController.createMomoPayment);
router.post('/zalopay/create', authenticateToken, paymentController.createZaloPayment);

module.exports = router;
