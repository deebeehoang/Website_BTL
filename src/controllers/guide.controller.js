const Guide = require('../models/guide.model');
const db = require('../config/database');

/**
 * Guide Controller - Xử lý các request liên quan đến Hướng dẫn viên
 */
class GuideController {
  /**
   * Lấy thông tin hướng dẫn viên theo Id_user
   * GET /api/guide/profile/:id_user
   * Nếu chưa có profile, trả về thông báo để user tạo mới
   */
  static async getProfile(req, res) {
    try {
      const { id_user } = req.params;
      
      // Kiểm tra quyền truy cập
      if (req.user.role !== 'Huong_dan_vien' && req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền truy cập'
        });
      }
      
      // Nếu là guide, chỉ được xem profile của chính mình
      if (req.user.role === 'Huong_dan_vien' && req.user.id !== id_user) {
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền xem thông tin này'
        });
      }
      
      const guide = await Guide.findByUserId(id_user);
      
      // Nếu chưa có profile, trả về thông báo để user biết cần tạo mới
      if (!guide) {
        // Kiểm tra xem tài khoản có tồn tại không
        const db = require('../config/database');
        const [users] = await db.query(
          'SELECT * FROM tai_khoan WHERE Id_user = ? AND Loai_tai_khoan = ?',
          [id_user, 'Huong_dan_vien']
        );
        
        if (users.length === 0) {
          return res.status(404).json({
            status: 'error',
            message: 'Tài khoản không tồn tại hoặc không phải hướng dẫn viên'
          });
        }
        
        // Trả về thông báo rằng chưa có profile, cần tạo mới
        return res.status(200).json({
          status: 'success',
          message: 'Chưa có hồ sơ. Vui lòng điền thông tin để tạo hồ sơ.',
          data: { 
            guide: null,
            needsSetup: true,
            user: {
              id_user: id_user,
              email: users[0].Email
            }
          }
        });
      }
      
      res.json({
        status: 'success',
        data: { 
          guide,
          needsSetup: false
        }
      });
    } catch (error) {
      console.error('Error getting guide profile:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy thông tin hướng dẫn viên',
        error: error.message
      });
    }
  }

  /**
   * Cập nhật thông tin hướng dẫn viên
   * PUT /api/guide/profile/:id_user
   * Nếu chưa có profile, sẽ tự động tạo mới
   */
  static async updateProfile(req, res) {
    try {
      const { id_user } = req.params;
      
      // Kiểm tra quyền
      if (req.user.role !== 'Huong_dan_vien' && req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền truy cập'
        });
      }
      
      // Nếu là guide, chỉ được cập nhật profile của chính mình
      if (req.user.role === 'Huong_dan_vien' && req.user.id !== id_user) {
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền cập nhật thông tin này'
        });
      }
      
      let guide = await Guide.findByUserId(id_user);
      
      // Nếu chưa có profile, tạo mới
      if (!guide) {
        console.log(`📝 Tạo profile mới cho hướng dẫn viên: ${id_user}`);
        
        // Kiểm tra tài khoản có tồn tại không
        const db = require('../config/database');
        const [users] = await db.query(
          'SELECT * FROM tai_khoan WHERE Id_user = ? AND Loai_tai_khoan = ?',
          [id_user, 'Huong_dan_vien']
        );
        
        if (users.length === 0) {
          return res.status(404).json({
            status: 'error',
            message: 'Tài khoản không tồn tại hoặc không phải hướng dẫn viên'
          });
        }
        
        // Tạo mã hướng dẫn viên
        const ma_huong_dan_vien = `HDV${Date.now()}`;
        
        // Lấy thông tin từ request body và file upload
        const {
          ten_huong_dan_vien,
          ngay_sinh,
          gioi_tinh,
          dia_chi,
          so_dien_thoai,
          cccd,
          ngon_ngu,
          kinh_nghiem
        } = req.body;
        
        // Lấy đường dẫn ảnh đại diện từ file upload hoặc từ body
        let anh_dai_dien = null;
        if (req.file) {
          anh_dai_dien = `/images/uploads/avatar/${req.file.filename}`;
        } else if (req.body.anh_dai_dien) {
          anh_dai_dien = req.body.anh_dai_dien;
        }
        
        // Validate thông tin bắt buộc
        if (!ten_huong_dan_vien || !ngay_sinh || !gioi_tinh || !so_dien_thoai || !cccd) {
          return res.status(400).json({
            status: 'error',
            message: 'Thiếu thông tin bắt buộc: Tên, Ngày sinh, Giới tính, SĐT, CCCD'
          });
        }
        
        // Tạo profile mới
        guide = await Guide.create({
          ma_huong_dan_vien,
          id_user,
          ten_huong_dan_vien,
          ngay_sinh,
          gioi_tinh,
          dia_chi: dia_chi || null,
          so_dien_thoai,
          cccd,
          ngon_ngu: ngon_ngu || null,
          kinh_nghiem: kinh_nghiem || null,
          chung_chi: null, // Chứng chỉ sẽ được quản lý riêng
          anh_dai_dien: anh_dai_dien || null,
          trang_thai: 'Hoat_dong'
        });
        
        console.log(`✅ Đã tạo profile mới: ${ma_huong_dan_vien}`);
        
        return res.json({
          status: 'success',
          message: 'Tạo hồ sơ thành công',
          data: { guide }
        });
      }
      
      // Nếu đã có profile, cập nhật thông tin
      // Xử lý upload ảnh đại diện nếu có
      const updateData = { ...req.body };
      if (req.file) {
        updateData.anh_dai_dien = `/images/uploads/avatar/${req.file.filename}`;
      }
      
      const updatedGuide = await Guide.update(guide.Ma_huong_dan_vien, updateData);
      
      res.json({
        status: 'success',
        message: 'Cập nhật thông tin thành công',
        data: { guide: updatedGuide }
      });
    } catch (error) {
      console.error('Error updating guide profile:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi cập nhật thông tin',
        error: error.message
      });
    }
  }

  /**
   * Lấy danh sách lịch được phân công
   * GET /api/guide/schedules/:ma_huong_dan_vien
   */
  static async getSchedules(req, res) {
    try {
      const { ma_huong_dan_vien } = req.params;
      const { status } = req.query;
      
      console.log('🔍 getSchedules called:', {
        ma_huong_dan_vien,
        status,
        userRole: req.user?.role,
        userId: req.user?.id
      });
      
      // Kiểm tra quyền
      if (!req.user || (req.user.role !== 'Huong_dan_vien' && req.user.role !== 'Admin')) {
        console.log('❌ Không có quyền truy cập:', req.user);
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền truy cập'
        });
      }
      
      // Nếu là guide, chỉ được xem lịch của chính mình
      if (req.user.role === 'Huong_dan_vien') {
        const guide = await Guide.findByUserId(req.user.id);
        console.log('🔍 Guide info:', {
          found: !!guide,
          guideId: guide?.Ma_huong_dan_vien,
          requestedId: ma_huong_dan_vien
        });
        if (!guide || guide.Ma_huong_dan_vien !== ma_huong_dan_vien) {
          return res.status(403).json({
            status: 'error',
            message: 'Không có quyền xem lịch này'
          });
        }
      }
      
      const schedules = await Guide.getSchedules(ma_huong_dan_vien, { status });
      
      res.json({
        status: 'success',
        results: schedules.length,
        data: { schedules }
      });
    } catch (error) {
      console.error('Error getting guide schedules:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy danh sách lịch',
        error: error.message
      });
    }
  }

  /**
   * Lấy danh sách booking của một lịch
   * GET /api/guide/schedule/:ma_lich/bookings
   */
  static async getScheduleBookings(req, res) {
    try {
      const { ma_lich } = req.params;
      
      console.log('🔍 getScheduleBookings called:', {
        ma_lich,
        userRole: req.user?.role,
        userId: req.user?.id
      });
      
      // Kiểm tra quyền
      if (!req.user || (req.user.role !== 'Huong_dan_vien' && req.user.role !== 'Admin')) {
        console.log('❌ Không có quyền truy cập:', req.user);
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền truy cập'
        });
      }
      
      // Kiểm tra lịch có thuộc về guide không
      if (req.user.role === 'Huong_dan_vien') {
        // Sử dụng pool thay vì db để đảm bảo query đúng
        const pool = require('../config/database');
        const [scheduleRows] = await pool.query(
          'SELECT Ma_huong_dan_vien FROM Lich_khoi_hanh WHERE Ma_lich = ?',
          [ma_lich]
        );
        
        if (scheduleRows.length === 0) {
          return res.status(404).json({
            status: 'error',
            message: 'Không tìm thấy lịch'
          });
        }
        
        const guide = await Guide.findByUserId(req.user.id);
        if (!guide || guide.Ma_huong_dan_vien !== scheduleRows[0].Ma_huong_dan_vien) {
          console.log('❌ Guide không có quyền xem booking:', {
            guideId: guide?.Ma_huong_dan_vien,
            scheduleGuideId: scheduleRows[0].Ma_huong_dan_vien,
            userId: req.user.id
          });
          return res.status(403).json({
            status: 'error',
            message: 'Không có quyền xem booking của lịch này'
          });
        }
      }
      
      const bookings = await Guide.getScheduleBookings(ma_lich);
      
      res.json({
        status: 'success',
        results: bookings.length,
        data: { bookings }
      });
    } catch (error) {
      console.error('Error getting schedule bookings:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy danh sách booking',
        error: error.message
      });
    }
  }

  /**
   * Lấy đánh giá của hướng dẫn viên
   * GET /api/guide/reviews/:ma_huong_dan_vien
   */
  static async getReviews(req, res) {
    try {
      const { ma_huong_dan_vien } = req.params;
      const { rating, date_from, date_to } = req.query;
      
      // Kiểm tra quyền
      if (req.user.role !== 'Huong_dan_vien' && req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền truy cập'
        });
      }
      
      // Nếu là guide, chỉ được xem đánh giá của chính mình
      if (req.user.role === 'Huong_dan_vien') {
        const guide = await Guide.findByUserId(req.user.id);
        if (!guide || guide.Ma_huong_dan_vien !== ma_huong_dan_vien) {
          return res.status(403).json({
            status: 'error',
            message: 'Không có quyền xem đánh giá này'
          });
        }
      }
      
      const ratings = await Guide.getRatings(ma_huong_dan_vien, {
        rating,
        date_from,
        date_to
      });
      
      res.json({
        status: 'success',
        results: ratings.length,
        data: { ratings }
      });
    } catch (error) {
      console.error('Error getting guide reviews:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy đánh giá',
        error: error.message
      });
    }
  }

  /**
   * Lấy thống kê của hướng dẫn viên
   * GET /api/guide/stats/:ma_huong_dan_vien
   */
  static async getStats(req, res) {
    try {
      const { ma_huong_dan_vien } = req.params;
      
      console.log('🔍 getStats called:', {
        ma_huong_dan_vien,
        userRole: req.user?.role,
        userId: req.user?.id
      });
      
      // Kiểm tra quyền
      if (!req.user || (req.user.role !== 'Huong_dan_vien' && req.user.role !== 'Admin')) {
        console.log('❌ Không có quyền truy cập:', req.user);
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền truy cập'
        });
      }
      
      // Nếu là guide, chỉ được xem thống kê của chính mình
      if (req.user.role === 'Huong_dan_vien') {
        const guide = await Guide.findByUserId(req.user.id);
        console.log('🔍 Guide info for stats:', {
          found: !!guide,
          guideId: guide?.Ma_huong_dan_vien,
          requestedId: ma_huong_dan_vien
        });
        if (!guide || guide.Ma_huong_dan_vien !== ma_huong_dan_vien) {
          return res.status(403).json({
            status: 'error',
            message: 'Không có quyền xem thống kê này'
          });
        }
      }
      
      const stats = await Guide.getStats(ma_huong_dan_vien);
      
      res.json({
        status: 'success',
        data: { stats }
      });
    } catch (error) {
      console.error('Error getting guide stats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy thống kê',
        error: error.message
      });
    }
  }

  /**
   * Lấy danh sách chứng chỉ của hướng dẫn viên
   * GET /api/guide/certificates/:ma_huong_dan_vien
   */
  static async getCertificates(req, res) {
    try {
      const { ma_huong_dan_vien } = req.params;
      
      // Kiểm tra quyền
      if (req.user.role !== 'Huong_dan_vien' && req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền truy cập'
        });
      }
      
      // Nếu là guide, chỉ được xem chứng chỉ của chính mình
      if (req.user.role === 'Huong_dan_vien') {
        const guide = await Guide.findByUserId(req.user.id);
        if (!guide || guide.Ma_huong_dan_vien !== ma_huong_dan_vien) {
          return res.status(403).json({
            status: 'error',
            message: 'Không có quyền xem chứng chỉ này'
          });
        }
      }
      
      const certificates = await Guide.getCertificates(ma_huong_dan_vien);
      
      res.json({
        status: 'success',
        results: certificates.length,
        data: { certificates }
      });
    } catch (error) {
      console.error('Error getting certificates:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy danh sách chứng chỉ',
        error: error.message
      });
    }
  }

  /**
   * Thêm chứng chỉ mới
   * POST /api/guide/certificates
   */
  static async addCertificate(req, res) {
    try {
      const { ma_huong_dan_vien, ten_chung_chi, loai_chung_chi, noi_cap, ngay_cap, ngay_het_han } = req.body;
      
      // Kiểm tra quyền
      if (req.user.role !== 'Huong_dan_vien' && req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền truy cập'
        });
      }
      
      // Nếu là guide, chỉ được thêm chứng chỉ cho chính mình
      if (req.user.role === 'Huong_dan_vien') {
        const guide = await Guide.findByUserId(req.user.id);
        if (!guide || guide.Ma_huong_dan_vien !== ma_huong_dan_vien) {
          return res.status(403).json({
            status: 'error',
            message: 'Không có quyền thêm chứng chỉ này'
          });
        }
      }
      
      // Validation: Ngày cấp phải nhỏ hơn Ngày hết hạn
      if (ngay_cap && ngay_het_han) {
        const issueDate = new Date(ngay_cap);
        const expiryDate = new Date(ngay_het_han);
        
        if (issueDate >= expiryDate) {
          return res.status(400).json({
            status: 'error',
            message: 'Ngày cấp phải nhỏ hơn Ngày hết hạn. Vui lòng kiểm tra lại!'
          });
        }
      }
      
      // Lấy file path từ upload
      const file_chung_chi = req.file ? `/images/uploads/certificates/${req.file.filename}` : null;
      
      const certificate = await Guide.addCertificate({
        ma_huong_dan_vien,
        ten_chung_chi,
        loai_chung_chi,
        noi_cap,
        ngay_cap,
        ngay_het_han,
        file_chung_chi
      });
      
      res.status(201).json({
        status: 'success',
        message: 'Thêm chứng chỉ thành công',
        data: { certificate }
      });
    } catch (error) {
      console.error('Error adding certificate:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi thêm chứng chỉ',
        error: error.message
      });
    }
  }

  /**
   * Xóa chứng chỉ
   * DELETE /api/guide/certificates/:ma_chung_chi
   */
  static async deleteCertificate(req, res) {
    try {
      const { ma_chung_chi } = req.params;
      
      // Kiểm tra quyền
      if (req.user.role !== 'Huong_dan_vien' && req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền truy cập'
        });
      }
      
      // Kiểm tra chứng chỉ có thuộc về guide không
      const db = require('../config/database');
      const [certificates] = await db.query(
        'SELECT * FROM chung_chi_huong_dan_vien WHERE Ma_chung_chi = ?',
        [ma_chung_chi]
      );
      
      if (certificates.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy chứng chỉ'
        });
      }
      
      if (req.user.role === 'Huong_dan_vien') {
        const guide = await Guide.findByUserId(req.user.id);
        if (!guide || guide.Ma_huong_dan_vien !== certificates[0].Ma_huong_dan_vien) {
          return res.status(403).json({
            status: 'error',
            message: 'Không có quyền xóa chứng chỉ này'
          });
        }
      }
      
      const success = await Guide.deleteCertificate(ma_chung_chi);
      
      if (!success) {
        return res.status(500).json({
          status: 'error',
          message: 'Không thể xóa chứng chỉ'
        });
      }
      
      res.json({
        status: 'success',
        message: 'Xóa chứng chỉ thành công'
      });
    } catch (error) {
      console.error('Error deleting certificate:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi xóa chứng chỉ',
        error: error.message
      });
    }
  }
}

module.exports = GuideController;

