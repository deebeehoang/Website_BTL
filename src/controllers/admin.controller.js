const User = require('../models/user.model');
const Booking = require('../models/booking.model');
const Tour = require('../models/tour.model');
const Destination = require('../models/destination.model');
const Service = require('../models/service.model');
const db = require('../config/database');

/**
 * Admin Controller
 */
class AdminController {
  /**
   * Get admin dashboard statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getDashboardStats(req, res) {
    try {
      const db = req.app.locals.db;
      console.log('Bắt đầu lấy thống kê dashboard');

      // Lấy thống kê từ bảng Booking (theo logic đã sửa trong booking.model.js)
      console.log('Đang lấy thống kê doanh thu từ Booking...');
      const [revenueStats] = await db.query(`
        SELECT 
          COUNT(CASE 
            WHEN (b.Trang_thai_booking = 'Đã thanh toán' OR b.Trang_thai = 'Đã thanh toán')
            AND b.Trang_thai_booking NOT IN ('Het_han', 'Da_huy', 'Hủy', 'Đã hủy')
            AND (b.Trang_thai IS NULL OR b.Trang_thai NOT IN ('Het_han', 'Da_huy', 'Hủy', 'Đã hủy'))
            THEN 1 
          END) as total_orders,
          COALESCE(SUM(CASE 
            WHEN (b.Trang_thai_booking = 'Đã thanh toán' OR b.Trang_thai = 'Đã thanh toán')
            AND b.Trang_thai_booking NOT IN ('Het_han', 'Da_huy', 'Hủy', 'Đã hủy')
            AND (b.Trang_thai IS NULL OR b.Trang_thai NOT IN ('Het_han', 'Da_huy', 'Hủy', 'Đã hủy'))
            THEN b.Tong_tien 
            ELSE 0 
          END), 0) as total_revenue,
          COUNT(CASE 
            WHEN (b.Trang_thai_booking = 'Chờ thanh toán' OR b.Trang_thai = 'Chờ thanh toán')
            AND (b.Trang_thai_booking IS NULL OR b.Trang_thai_booking = 'Chờ thanh toán')
            AND (b.Trang_thai IS NULL OR b.Trang_thai = 'Chờ thanh toán')
            AND b.Trang_thai_booking NOT IN ('Đã thanh toán', 'Het_han', 'Da_huy', 'Hủy', 'Đã hủy', 'pending')
            AND (b.Trang_thai IS NULL OR b.Trang_thai NOT IN ('Đã thanh toán', 'Het_han', 'Da_huy', 'Hủy', 'Đã hủy', 'pending'))
            THEN 1 
          END) as pending_orders,
          COUNT(CASE 
            WHEN (b.Trang_thai_booking = 'Đã thanh toán' OR b.Trang_thai = 'Đã thanh toán')
            AND b.Trang_thai_booking NOT IN ('Het_han', 'Da_huy', 'Hủy', 'Đã hủy')
            AND (b.Trang_thai IS NULL OR b.Trang_thai NOT IN ('Het_han', 'Da_huy', 'Hủy', 'Đã hủy'))
            THEN 1 
          END) as completed_orders
        FROM Booking b
        WHERE b.Ngay_dat >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
      `);
      console.log('Kết quả thống kê doanh thu:', revenueStats[0]);

      // Lấy thống kê tour theo tình trạng
      console.log('Đang lấy thống kê tour...');
      const [tourStats] = await db.query(`
        SELECT 
          COUNT(*) as total_tours,
          SUM(CASE WHEN Tinh_trang = 'Còn chỗ' THEN 1 ELSE 0 END) as available_tours,
          SUM(CASE WHEN Tinh_trang = 'Hết chỗ' THEN 1 ELSE 0 END) as full_tours,
          SUM(CASE WHEN Tinh_trang = 'Sắp mở' THEN 1 ELSE 0 END) as upcoming_tours
        FROM Tour_du_lich
      `);
      console.log('Kết quả thống kê tour:', tourStats[0]);

      // Lấy khách hàng đặt nhiều nhất (từ Booking đã thanh toán)
      console.log('Đang lấy thông tin khách hàng VIP...');
      const [topCustomers] = await db.query(`
        SELECT 
          kh.Ten_khach_hang,
          COUNT(*) as total_bookings,
          COALESCE(SUM(b.Tong_tien), 0) as total_spent
        FROM Booking b
        JOIN Khach_hang kh ON b.Ma_khach_hang = kh.Ma_khach_hang
        WHERE (b.Trang_thai_booking = 'Đã thanh toán' OR b.Trang_thai = 'Đã thanh toán')
        AND b.Trang_thai_booking NOT IN ('Het_han', 'Da_huy', 'Hủy', 'Đã hủy')
        AND (b.Trang_thai IS NULL OR b.Trang_thai NOT IN ('Het_han', 'Da_huy', 'Hủy', 'Đã hủy'))
        GROUP BY kh.Ma_khach_hang, kh.Ten_khach_hang
        ORDER BY total_bookings DESC
        LIMIT 1
      `);
      console.log('Kết quả thông tin khách hàng VIP:', topCustomers[0] || 'Không có');

      // Lấy tour hot nhất (từ Booking đã thanh toán)
      console.log('Đang lấy thông tin tour hot...');
      const [topTours] = await db.query(`
        SELECT 
          t.Ten_tour,
          COUNT(*) as total_bookings,
          t.Tinh_trang as tour_status
        FROM Booking b
        JOIN Chi_tiet_booking ctb ON b.Ma_booking = ctb.Ma_booking
        JOIN Lich_khoi_hanh lkh ON ctb.Ma_lich = lkh.Ma_lich
        JOIN Tour_du_lich t ON lkh.Ma_tour = t.Ma_tour
        WHERE (b.Trang_thai_booking = 'Đã thanh toán' OR b.Trang_thai = 'Đã thanh toán')
        AND b.Trang_thai_booking NOT IN ('Het_han', 'Da_huy', 'Hủy', 'Đã hủy')
        AND (b.Trang_thai IS NULL OR b.Trang_thai NOT IN ('Het_han', 'Da_huy', 'Hủy', 'Đã hủy'))
        GROUP BY t.Ma_tour, t.Ten_tour, t.Tinh_trang
        ORDER BY total_bookings DESC
        LIMIT 1
      `);
      console.log('Kết quả thông tin tour hot:', topTours[0] || 'Không có');

      const responseData = {
        tourStats: {
          total: tourStats[0]?.total_tours || 0,
          available: tourStats[0]?.available_tours || 0,
          full: tourStats[0]?.full_tours || 0,
          upcoming: tourStats[0]?.upcoming_tours || 0
        },
        monthlyBookings: revenueStats[0]?.total_orders || 0,
        totalRevenue: revenueStats[0]?.total_revenue || 0,
        pendingOrders: revenueStats[0]?.pending_orders || 0,
        completedOrders: revenueStats[0]?.completed_orders || 0,
        topCustomer: topCustomers[0] || null,
        topTour: topTours[0] || null
      };

      console.log('Dữ liệu trả về:', responseData);

      res.json({
        status: 'success',
        data: responseData
      });
    } catch (error) {
      console.error('Chi tiết lỗi khi lấy thống kê dashboard:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể lấy dữ liệu thống kê',
        error: error.message
      });
    }
  }
  
  /**
   * Get all customers (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllCustomers(req, res) {
    try {
      // Ensure user is an admin
      if (req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to perform this action'
        });
      }
      
      const [customers] = await pool.execute(
        `SELECT k.*, t.Email, t.Loai_tai_khoan
         FROM Khach_hang k
         JOIN Tai_khoan t ON k.Id_user = t.Id_user`
      );
      
      res.status(200).json({
        status: 'success',
        results: customers.length,
        data: { customers }
      });
    } catch (error) {
      console.error('Get all customers error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error getting customers',
        error: error.message
      });
    }
  }
  
  /**
   * Get a specific customer by ID (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCustomerById(req, res) {
    try {
      // Ensure user is an admin
      if (req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to perform this action'
        });
      }
      
      const customerId = req.params.id;
      
      const [customers] = await pool.execute(
        `SELECT k.*, t.Email, t.Loai_tai_khoan
         FROM Khach_hang k
         JOIN Tai_khoan t ON k.Id_user = t.Id_user
         WHERE k.Ma_khach_hang = ?`,
        [customerId]
      );
      
      if (customers.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Customer not found'
        });
      }
      
      // Get customer's bookings
      const bookings = await Booking.getByCustomerId(customerId);
      
      res.status(200).json({
        status: 'success',
        data: {
          customer: customers[0],
          bookings
        }
      });
    } catch (error) {
      console.error(`Get customer ${req.params.id} error:`, error);
      res.status(500).json({
        status: 'error',
        message: 'Error getting customer details',
        error: error.message
      });
    }
  }
  
  /**
   * Generate sales report (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateSalesReport(req, res) {
    try {
      // Ensure user is an admin
      if (req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to perform this action'
        });
      }
      
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'Start date and end date are required'
        });
      }
      
      // Get bookings within date range
      const [bookings] = await pool.execute(
        `SELECT b.*, k.Ten_khach_hang, t.Ten_tour
         FROM Booking b
         JOIN Khach_hang k ON b.Ma_khach_hang = k.Ma_khach_hang
         JOIN Chi_tiet_booking cb ON b.Ma_booking = cb.Ma_booking
         JOIN Lich_khoi_hanh l ON cb.Ma_lich = l.Ma_lich
         JOIN Tour_du_lich t ON l.Ma_tour = t.Ma_tour
         WHERE b.Ngay_dat BETWEEN ? AND ?
         ORDER BY b.Ngay_dat DESC`,
        [startDate, endDate]
      );
      
      // Calculate total revenue
      const totalRevenue = bookings.reduce((sum, booking) => sum + parseFloat(booking.Tong_tien), 0);
      
      // Count by status
      const statusCounts = bookings.reduce((acc, booking) => {
        const status = booking.Trang_thai;
        if (!acc[status]) {
          acc[status] = 0;
        }
        acc[status]++;
        return acc;
      }, {});
      
      // Group by tour
      const tourRevenue = bookings.reduce((acc, booking) => {
        const tourName = booking.Ten_tour;
        if (!acc[tourName]) {
          acc[tourName] = 0;
        }
        acc[tourName] += parseFloat(booking.Tong_tien);
        return acc;
      }, {});
      
      res.status(200).json({
        status: 'success',
        data: {
          report: {
            startDate,
            endDate,
            totalBookings: bookings.length,
            totalRevenue,
            statusCounts,
            tourRevenue,
            bookings
          }
        }
      });
    } catch (error) {
      console.error('Generate sales report error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error generating sales report',
        error: error.message
      });
    }
  }

  // Lấy doanh thu theo tháng
  static async getMonthlyRevenue(req, res) {
    try {
      const year = parseInt(req.params.year) || new Date().getFullYear();
      const db = req.app.locals.db;

      const query = `
        SELECT 
          MONTH(Ngay_lap) as month,
          SUM(Tong_tien) as revenue
        FROM Hoa_don
        WHERE YEAR(Ngay_lap) = ? 
          AND Trang_thai_hoa_don = 'Đã thanh toán'
        GROUP BY MONTH(Ngay_lap)
        ORDER BY month
      `;

      const [results] = await db.query(query, [year]);

      // Tạo mảng 12 tháng với doanh thu mặc định là 0
      const monthlyRevenue = Array(12).fill(0);

      // Cập nhật doanh thu cho các tháng có dữ liệu
      results.forEach(row => {
        monthlyRevenue[row.month - 1] = parseFloat(row.revenue);
      });

      res.json({
        status: 'success',
        data: monthlyRevenue
      });
    } catch (error) {
      console.error('Lỗi khi lấy doanh thu theo tháng:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể lấy dữ liệu doanh thu theo tháng'
      });
    }
  }

  // Lấy doanh thu theo năm
  static async getYearlyRevenue(req, res) {
    try {
      const db = req.app.locals.db;

      const query = `
        SELECT 
          YEAR(Ngay_lap) as year,
          SUM(Tong_tien) as revenue
        FROM Hoa_don
        WHERE Trang_thai_hoa_don = 'Đã thanh toán'
        GROUP BY YEAR(Ngay_lap)
        ORDER BY year DESC
        LIMIT 5
      `;

      const [results] = await db.query(query);

      // Chuyển đổi kết quả thành object với key là năm
      const yearlyRevenue = {};
      results.forEach(row => {
        yearlyRevenue[row.year] = parseFloat(row.revenue);
      });

      res.json({
        status: 'success',
        data: yearlyRevenue
      });
    } catch (error) {
      console.error('Lỗi khi lấy doanh thu theo năm:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể lấy dữ liệu doanh thu theo năm'
      });
    }
  }

  /**
   * Get all địa danh
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllDiaDanh(req, res) {
    try {
      const db = req.app.locals.db;
      const [diadanh] = await db.query('SELECT * FROM Dia_danh');
      
      res.json({
        status: 'success',
        data: diadanh
      });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách địa danh:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể lấy danh sách địa danh',
        error: error.message
      });
    }
  }

  /**
   * Create new địa danh
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createDiaDanh(req, res) {
    try {
      const db = req.app.locals.db;
      const { ten_dia_danh, mo_ta, hinh_anh, tinh_thanh } = req.body;

      const [result] = await db.query(
        'INSERT INTO Dia_danh (Ten_dia_danh, Mo_ta, Hinh_anh, Tinh_thanh) VALUES (?, ?, ?, ?)',
        [ten_dia_danh, mo_ta, hinh_anh, tinh_thanh]
      );

      res.status(201).json({
        status: 'success',
        message: 'Đã thêm địa danh mới',
        data: {
          id: result.insertId,
          ten_dia_danh,
          mo_ta,
          hinh_anh,
          tinh_thanh
        }
      });
    } catch (error) {
      console.error('Lỗi khi thêm địa danh:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể thêm địa danh',
        error: error.message
      });
    }
  }

  /**
   * Update địa danh
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateDiaDanh(req, res) {
    try {
      const db = req.app.locals.db;
      const { id } = req.params;
      const { ten_dia_danh, mo_ta, hinh_anh, tinh_thanh } = req.body;

      const [result] = await db.query(
        'UPDATE Dia_danh SET Ten_dia_danh = ?, Mo_ta = ?, Hinh_anh = ?, Tinh_thanh = ? WHERE Ma_dia_danh = ?',
        [ten_dia_danh, mo_ta, hinh_anh, tinh_thanh, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy địa danh'
        });
      }

      res.json({
        status: 'success',
        message: 'Đã cập nhật địa danh',
        data: {
          id,
          ten_dia_danh,
          mo_ta,
          hinh_anh,
          tinh_thanh
        }
      });
    } catch (error) {
      console.error('Lỗi khi cập nhật địa danh:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể cập nhật địa danh',
        error: error.message
      });
    }
  }

  /**
   * Delete địa danh
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteDiaDanh(req, res) {
    try {
      const db = req.app.locals.db;
      const { id } = req.params;

      const [result] = await db.query('DELETE FROM Dia_danh WHERE Ma_dia_danh = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy địa danh'
        });
      }

      res.json({
        status: 'success',
        message: 'Đã xóa địa danh'
      });
    } catch (error) {
      console.error('Lỗi khi xóa địa danh:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể xóa địa danh',
        error: error.message
      });
    }
  }

  /**
   * Get all lịch khởi hành
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllLichKhoiHanh(req, res) {
    try {
      const db = req.app.locals.db;
      const [lichkhoihanh] = await db.query(`
        SELECT lkh.*, t.Ten_tour 
        FROM Lich_khoi_hanh lkh
        JOIN Tour_du_lich t ON lkh.Ma_tour = t.Ma_tour
      `);
      
      res.json({
        status: 'success',
        data: lichkhoihanh
      });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách lịch khởi hành:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể lấy danh sách lịch khởi hành',
        error: error.message
      });
    }
  }

  /**
   * Create new lịch khởi hành
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createLichKhoiHanh(req, res) {
    try {
      const db = req.app.locals.db;
      const { ma_tour, ngay_khoi_hanh, so_cho, ghi_chu } = req.body;

      const [result] = await db.query(
        'INSERT INTO Lich_khoi_hanh (Ma_tour, Ngay_khoi_hanh, So_cho, Ghi_chu) VALUES (?, ?, ?, ?)',
        [ma_tour, ngay_khoi_hanh, so_cho, ghi_chu]
      );

      res.status(201).json({
        status: 'success',
        message: 'Đã thêm lịch khởi hành mới',
        data: {
          id: result.insertId,
          ma_tour,
          ngay_khoi_hanh,
          so_cho,
          ghi_chu
        }
      });
    } catch (error) {
      console.error('Lỗi khi thêm lịch khởi hành:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể thêm lịch khởi hành',
        error: error.message
      });
    }
  }

  /**
   * Update lịch khởi hành
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateLichKhoiHanh(req, res) {
    try {
      const db = req.app.locals.db;
      const { id } = req.params;
      const { ma_tour, ngay_khoi_hanh, so_cho, ghi_chu } = req.body;

      const [result] = await db.query(
        'UPDATE Lich_khoi_hanh SET Ma_tour = ?, Ngay_khoi_hanh = ?, So_cho = ?, Ghi_chu = ? WHERE Ma_lich = ?',
        [ma_tour, ngay_khoi_hanh, so_cho, ghi_chu, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy lịch khởi hành'
        });
      }

      res.json({
        status: 'success',
        message: 'Đã cập nhật lịch khởi hành',
        data: {
          id,
          ma_tour,
          ngay_khoi_hanh,
          so_cho,
          ghi_chu
        }
      });
    } catch (error) {
      console.error('Lỗi khi cập nhật lịch khởi hành:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể cập nhật lịch khởi hành',
        error: error.message
      });
    }
  }

  /**
   * Delete lịch khởi hành
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteLichKhoiHanh(req, res) {
    try {
      const db = req.app.locals.db;
      const { id } = req.params;

      const [result] = await db.query('DELETE FROM Lich_khoi_hanh WHERE Ma_lich = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy lịch khởi hành'
        });
      }

      res.json({
        status: 'success',
        message: 'Đã xóa lịch khởi hành'
      });
    } catch (error) {
      console.error('Lỗi khi xóa lịch khởi hành:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể xóa lịch khởi hành',
        error: error.message
      });
    }
  }

  /**
   * Lấy danh sách booking chờ xác nhận thanh toán
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPendingPayments(req, res) {
    try {
      const db = req.app.locals.db;
      
      console.log('🔍 Lấy danh sách booking chờ xác nhận thanh toán...');

      const [bookings] = await db.query(`
        SELECT 
          b.Ma_booking,
          b.Ngay_dat,
          b.So_nguoi_lon,
          b.So_tre_em,
          b.Tong_tien,
          b.Trang_thai_booking,
          b.Trang_thai,
          b.Phuong_thuc_thanh_toan,
          b.Ngay_thanh_toan,
          kh.Ten_khach_hang,
          tk.Email,
          t.Ten_tour,
          lkh.Ngay_bat_dau,
          lkh.Ngay_ket_thuc,
          lkh.So_cho
        FROM Booking b
        JOIN Khach_hang kh ON b.Ma_khach_hang = kh.Ma_khach_hang
        JOIN Tai_khoan tk ON kh.Id_user = tk.Id_user
        JOIN Chi_tiet_booking ctb ON b.Ma_booking = ctb.Ma_booking
        JOIN Lich_khoi_hanh lkh ON ctb.Ma_lich = lkh.Ma_lich
        JOIN Tour_du_lich t ON lkh.Ma_tour = t.Ma_tour
        WHERE (b.Trang_thai_booking = 'Chờ thanh toán' OR b.Trang_thai = 'Chờ thanh toán')
           OR (b.Trang_thai_booking = 'Chờ xác nhận' OR b.Trang_thai = 'Chờ xác nhận' OR b.Trang_thai_booking = 'Cho_xac_nhan')
           OR (b.Trang_thai_booking = 'Đã thanh toán' OR b.Trang_thai = 'Đã thanh toán')
           OR (b.Trang_thai_booking = 'Het_han' OR b.Trang_thai = 'Het_han')
        ORDER BY b.Ngay_dat DESC
      `);

      console.log(`✅ Tìm thấy ${bookings.length} booking chờ xác nhận thanh toán`);

      res.status(200).json({
        status: 'success',
        results: bookings.length,
        data: { bookings }
      });
    } catch (error) {
      console.error('❌ Lỗi khi lấy danh sách booking chờ thanh toán:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể lấy danh sách booking chờ thanh toán',
        error: error.message
      });
    }
  }

  /**
   * Xác nhận thanh toán cho booking
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async confirmPayment(req, res) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const { bookingId } = req.params;
      const { phuong_thuc_thanh_toan = 'Admin xác nhận', ghi_chu } = req.body;

      console.log('💰 Bắt đầu xác nhận thanh toán cho booking:', bookingId);

      // 1. Kiểm tra booking có tồn tại và đang chờ thanh toán
      const [bookings] = await connection.query(`
        SELECT 
          b.*,
          kh.Ten_khach_hang,
          t.Ten_tour,
          lkh.Ngay_bat_dau,
          lkh.Ngay_ket_thuc,
          lkh.So_cho
        FROM Booking b
        JOIN Khach_hang kh ON b.Ma_khach_hang = kh.Ma_khach_hang
        JOIN Chi_tiet_booking ctb ON b.Ma_booking = ctb.Ma_booking
        JOIN Lich_khoi_hanh lkh ON ctb.Ma_lich = lkh.Ma_lich
        JOIN Tour_du_lich t ON lkh.Ma_tour = t.Ma_tour
        WHERE b.Ma_booking = ? 
          AND (b.Trang_thai_booking = 'Chờ thanh toán' OR b.Trang_thai = 'Chờ thanh toán')
      `, [bookingId]);

      if (bookings.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy booking hoặc booking đã được xử lý'
        });
      }

      const booking = bookings[0];
      console.log('📋 Thông tin booking:', booking);

      // 2. Cập nhật trạng thái booking
      await connection.query(`
        UPDATE Booking 
        SET 
          Trang_thai_booking = 'Đã thanh toán',
          Trang_thai = 'Đã thanh toán',
          Phuong_thuc_thanh_toan = ?,
          Ngay_thanh_toan = NOW()
        WHERE Ma_booking = ?
      `, [phuong_thuc_thanh_toan, bookingId]);

      console.log('✅ Đã cập nhật trạng thái booking');

      // 3. Tạo hóa đơn
      const maHoaDon = `HD${Date.now().toString().slice(-8)}`;
      await connection.query(`
        INSERT INTO Hoa_don (Ma_hoa_don, Ma_booking, Ngay_lap, Tong_tien, Trang_thai_hoa_don)
        VALUES (?, ?, NOW(), ?, 'Đã thanh toán')
      `, [maHoaDon, bookingId, booking.Tong_tien]);

      console.log('📄 Đã tạo hóa đơn:', maHoaDon);

      // 4. Tạo vé cho từng người
      const soNguoiLon = parseInt(booking.So_nguoi_lon);
      const soTreEm = parseInt(booking.So_tre_em);
      const tongNguoi = soNguoiLon + soTreEm;

      // Lấy giá vé từ tour
      const [tourInfo] = await connection.query(`
        SELECT Gia_nguoi_lon, Gia_tre_em 
        FROM Tour_du_lich t
        JOIN Lich_khoi_hanh lkh ON t.Ma_tour = lkh.Ma_tour
        JOIN Chi_tiet_booking ctb ON lkh.Ma_lich = ctb.Ma_lich
        WHERE ctb.Ma_booking = ?
      `, [bookingId]);

      const giaNguoiLon = parseFloat(tourInfo[0].Gia_nguoi_lon);
      const giaTreEm = parseFloat(tourInfo[0].Gia_tre_em);

      // Tạo vé cho người lớn
      for (let i = 1; i <= soNguoiLon; i++) {
        const soVe = `VE${Date.now()}${i}`;
        await connection.query(`
          INSERT INTO Ve (So_ve, Ma_booking, Ma_lich, Gia_ve, Trang_thai_ve)
          SELECT ?, ?, ctb.Ma_lich, ?, 'Chua_su_dung'
          FROM Chi_tiet_booking ctb
          WHERE ctb.Ma_booking = ?
        `, [soVe, bookingId, giaNguoiLon, bookingId]);
      }

      // Tạo vé cho trẻ em
      for (let i = 1; i <= soTreEm; i++) {
        const soVe = `VE${Date.now()}${soNguoiLon + i}`;
        await connection.query(`
          INSERT INTO Ve (So_ve, Ma_booking, Ma_lich, Gia_ve, Trang_thai_ve)
          SELECT ?, ?, ctb.Ma_lich, ?, 'Chua_su_dung'
          FROM Chi_tiet_booking ctb
          WHERE ctb.Ma_booking = ?
        `, [soVe, bookingId, giaTreEm, bookingId]);
      }

      console.log(`🎫 Đã tạo ${tongNguoi} vé (${soNguoiLon} người lớn + ${soTreEm} trẻ em)`);

      // 5. Tạo bản ghi checkout
      const checkoutId = `CO${Date.now().toString().slice(-8)}`;
      await connection.query(`
        INSERT INTO Checkout (ID_checkout, Ma_booking, Phuong_thuc_thanh_toan, Ngay_tra, So_tien, Trang_thai)
        VALUES (?, ?, ?, NOW(), ?, 'Thành công')
      `, [checkoutId, bookingId, phuong_thuc_thanh_toan, booking.Tong_tien]);

      console.log('💳 Đã tạo bản ghi checkout:', checkoutId);

      await connection.commit();

      // 6. Lấy thông tin chi tiết sau khi xác nhận
      const [updatedBooking] = await connection.query(`
        SELECT 
          b.*,
          kh.Ten_khach_hang,
          t.Ten_tour,
          lkh.Ngay_bat_dau,
          lkh.Ngay_ket_thuc,
          hd.Ma_hoa_don,
          hd.Ngay_lap as Ngay_lap_hoa_don
        FROM Booking b
        JOIN Khach_hang kh ON b.Ma_khach_hang = kh.Ma_khach_hang
        JOIN Chi_tiet_booking ctb ON b.Ma_booking = ctb.Ma_booking
        JOIN Lich_khoi_hanh lkh ON ctb.Ma_lich = lkh.Ma_lich
        JOIN Tour_du_lich t ON lkh.Ma_tour = t.Ma_tour
        JOIN Hoa_don hd ON b.Ma_booking = hd.Ma_booking
        WHERE b.Ma_booking = ?
      `, [bookingId]);

      // 7. Lấy danh sách vé đã tạo
      const [veList] = await connection.query(`
        SELECT So_ve, Gia_ve, Trang_thai_ve
        FROM Ve
        WHERE Ma_booking = ?
        ORDER BY So_ve
      `, [bookingId]);

      console.log('🎉 Xác nhận thanh toán thành công!');

      res.status(200).json({
        status: 'success',
        message: 'Xác nhận thanh toán thành công',
        data: {
          booking: updatedBooking[0],
          hoaDon: {
            maHoaDon,
            ngayLap: new Date().toISOString(),
            tongTien: booking.Tong_tien,
            trangThai: 'Đã thanh toán'
          },
          ve: {
            tongSoVe: veList.length,
            danhSachVe: veList
          },
          checkout: {
            checkoutId,
            phuongThucThanhToan: phuong_thuc_thanh_toan,
            ngayTra: new Date().toISOString(),
            trangThai: 'Thành công'
          }
        }
      });

    } catch (error) {
      await connection.rollback();
      console.error('❌ Lỗi khi xác nhận thanh toán:', error);
      res.status(500).json({
        status: 'error',
        message: 'Có lỗi xảy ra khi xác nhận thanh toán',
        error: error.message
      });
    } finally {
      connection.release();
    }
  }

  /**
   * Lấy chi tiết booking để xác nhận thanh toán
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getBookingForPaymentConfirmation(req, res) {
    try {
      const db = req.app.locals.db;
      const { bookingId } = req.params;

      console.log('🔍 Lấy chi tiết booking để xác nhận thanh toán:', bookingId);

      const [bookings] = await db.query(`
        SELECT 
          b.*,
          kh.Ten_khach_hang,
          tk.Email,
          kh.Dia_chi,
          kh.Cccd,
          t.Ten_tour,
          t.Gia_nguoi_lon,
          t.Gia_tre_em,
          lkh.Ngay_bat_dau,
          lkh.Ngay_ket_thuc,
          lkh.So_cho,
          km.Ten_km as Ten_khuyen_mai,
          km.Gia_tri as Gia_tri_khuyen_mai
        FROM Booking b
        JOIN Khach_hang kh ON b.Ma_khach_hang = kh.Ma_khach_hang
        JOIN Tai_khoan tk ON kh.Id_user = tk.Id_user
        JOIN Chi_tiet_booking ctb ON b.Ma_booking = ctb.Ma_booking
        JOIN Lich_khoi_hanh lkh ON ctb.Ma_lich = lkh.Ma_lich
        JOIN Tour_du_lich t ON lkh.Ma_tour = t.Ma_tour
        LEFT JOIN Khuyen_mai km ON b.Ma_khuyen_mai = km.Ma_km
        WHERE b.Ma_booking = ?
      `, [bookingId]);

      if (bookings.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy booking'
        });
      }

      const booking = bookings[0];

      // Lấy danh sách dịch vụ đã đặt
      const [services] = await db.query(`
        SELECT 
          dv.Ten_dich_vu,
          dv.Gia,
          ctdv.So_luong,
          ctdv.Thanh_tien
        FROM Chi_tiet_dich_vu ctdv
        JOIN Dich_vu dv ON ctdv.Ma_dich_vu = dv.Ma_dich_vu
        WHERE ctdv.Ma_booking = ?
      `, [bookingId]);

      // Tính toán chi tiết giá
      const giaNguoiLon = parseFloat(booking.Gia_nguoi_lon);
      const giaTreEm = parseFloat(booking.Gia_tre_em);
      const soNguoiLon = parseInt(booking.So_nguoi_lon);
      const soTreEm = parseInt(booking.So_tre_em);

      const tongTienNguoiLon = giaNguoiLon * soNguoiLon;
      const tongTienTreEm = giaTreEm * soTreEm;
      const tongTienTour = tongTienNguoiLon + tongTienTreEm;

      const tongTienDichVu = services.reduce((sum, service) => sum + parseFloat(service.Thanh_tien), 0);
      const tongTienTruocKhuyenMai = tongTienTour + tongTienDichVu;

      let giamGia = 0;
      if (booking.Ma_khuyen_mai && booking.Gia_tri_khuyen_mai) {
        giamGia = tongTienTruocKhuyenMai * (parseFloat(booking.Gia_tri_khuyen_mai) / 100);
      }

      const tongTienSauKhuyenMai = tongTienTruocKhuyenMai - giamGia;

      res.status(200).json({
        status: 'success',
        data: {
          booking: {
            ...booking,
            chiTietGia: {
              giaNguoiLon,
              giaTreEm,
              soNguoiLon,
              soTreEm,
              tongTienNguoiLon,
              tongTienTreEm,
              tongTienTour,
              tongTienDichVu,
              tongTienTruocKhuyenMai,
              giamGia,
              tongTienSauKhuyenMai
            },
            services
          }
        }
      });

    } catch (error) {
      console.error('❌ Lỗi khi lấy chi tiết booking:', error);
      res.status(500).json({
        status: 'error',
        message: 'Không thể lấy chi tiết booking',
        error: error.message
      });
    }
  }
}

module.exports = AdminController;