const express = require('express');
const GuideController = require('../controllers/guide.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer configuration for certificates (PDF and images)
const certificateStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../public/images/uploads/certificates');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'certificate-' + uniqueSuffix + ext);
  }
});

const certificateFileFilter = (req, file, cb) => {
  // Cho phép PDF và các file hình ảnh
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file PDF hoặc hình ảnh (JPG, PNG, GIF, WEBP)!'), false);
  }
};

const certificateUpload = multer({
  storage: certificateStorage,
  fileFilter: certificateFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Tất cả routes đều cần authentication
router.use(authenticateToken);

/**
 * @route   GET /api/guide/profile/:id_user
 * @desc    Lấy thông tin hướng dẫn viên
 * @access  Private (Guide hoặc Admin)
 */
router.get('/profile/:id_user', GuideController.getProfile);

// Multer configuration for avatar upload
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../public/images/uploads/avatar');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'avatar-' + uniqueSuffix + ext);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
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
 * @route   PUT /api/guide/profile/:id_user
 * @desc    Cập nhật thông tin hướng dẫn viên (hỗ trợ upload ảnh đại diện)
 * @access  Private (Guide hoặc Admin)
 */
router.put('/profile/:id_user', avatarUpload.single('anh_dai_dien'), GuideController.updateProfile);

/**
 * @route   GET /api/guide/schedules/:ma_huong_dan_vien
 * @desc    Lấy danh sách lịch được phân công
 * @access  Private (Guide hoặc Admin)
 * @query   status - Filter theo trạng thái (sap_dien_ra, dang_dien_ra, da_dien_ra)
 */
router.get('/schedules/:ma_huong_dan_vien', GuideController.getSchedules);

/**
 * @route   GET /api/guide/schedule/:ma_lich/bookings
 * @desc    Lấy danh sách booking của một lịch
 * @access  Private (Guide hoặc Admin)
 */
router.get('/schedule/:ma_lich/bookings', GuideController.getScheduleBookings);

/**
 * @route   GET /api/guide/reviews/:ma_huong_dan_vien
 * @desc    Lấy đánh giá của hướng dẫn viên
 * @access  Private (Guide hoặc Admin)
 * @query   rating - Filter theo điểm (1-5)
 * @query   date_from - Từ ngày
 * @query   date_to - Đến ngày
 */
router.get('/reviews/:ma_huong_dan_vien', GuideController.getReviews);

/**
 * @route   GET /api/guide/stats/:ma_huong_dan_vien
 * @desc    Lấy thống kê của hướng dẫn viên
 * @access  Private (Guide hoặc Admin)
 */
router.get('/stats/:ma_huong_dan_vien', GuideController.getStats);

/**
 * @route   GET /api/guide/certificates/:ma_huong_dan_vien
 * @desc    Lấy danh sách chứng chỉ của hướng dẫn viên
 * @access  Private (Guide hoặc Admin)
 */
router.get('/certificates/:ma_huong_dan_vien', GuideController.getCertificates);

/**
 * @route   POST /api/guide/certificates
 * @desc    Thêm chứng chỉ mới
 * @access  Private (Guide hoặc Admin)
 */
router.post('/certificates', certificateUpload.single('file'), GuideController.addCertificate);

/**
 * @route   DELETE /api/guide/certificates/:ma_chung_chi
 * @desc    Xóa chứng chỉ
 * @access  Private (Guide hoặc Admin)
 */
router.delete('/certificates/:ma_chung_chi', GuideController.deleteCertificate);

module.exports = router;

