const Booking = require('../models/booking.model');
const Tour = require('../models/tour.model');
const db = require('../config/database');
const pool = require('../config/database');
const Promotion = require('../models/promotion.model');
const Service = require('../models/service.model');

/**
 * Booking Controller
 */
class BookingController {
  /**
   * Get all bookings (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllBookings(req, res) {
    try {
      // Ensure user is an admin
      if (req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to perform this action'
        });
      }
      
      // Lấy query parameters
      const filters = {
        status: req.query.status || 'all',
        query: req.query.query || null
      };
      
      console.log(`🔍 [getAllBookings] Filters:`, filters);
      
      const bookings = await Booking.getAll(filters);
      
      console.log(`📊 [getAllBookings] Returning ${bookings.length} bookings`);
      
      res.status(200).json({
        status: 'success',
        results: bookings.length,
        data: { bookings }
      });
    } catch (error) {
      console.error('❌ [getAllBookings] Error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error getting bookings',
        error: error.message
      });
    }
  }

  
  /**
   * Get a specific booking by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getBookingById(req, res) {
    try {
      const bookingId = req.params.id;
      
      // Get booking details
      const bookingDetails = await Booking.getBookingDetails(bookingId);
      
      if (!bookingDetails || !bookingDetails.booking) {
        return res.status(404).json({
          status: 'error',
          message: 'Booking not found'
        });
      }
      
      // Ensure user is authorized (admin or the booking owner)
      if (req.user.role !== 'Admin' && req.user.id !== bookingDetails.booking.Id_user) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to access this booking'
        });
      }
      
      res.status(200).json({
        status: 'success',
        data: bookingDetails
      });
    } catch (error) {
      console.error(`Get booking ${req.params.id} error:`, error);
      res.status(500).json({
        status: 'error',
        message: 'Error getting booking',
        error: error.message
      });
    }
  }
  
  /**
   * Get bookings for current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserBookings(req, res) {
    try {
      // Get customer ID from user details
      // Assuming we have customer ID in request after authentication middleware
      const customerId = req.user.customerId;
      
      if (!customerId) {
        return res.status(400).json({
          status: 'error',
          message: 'Customer ID not found'
        });
      }
      
      const bookings = await Booking.getByCustomerId(customerId);
      
      res.status(200).json({
        status: 'success',
        results: bookings.length,
        data: { bookings }
      });
    } catch (error) {
      console.error('Get user bookings error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error getting user bookings',
        error: error.message
      });
    }
  }
  
  /**
   * Create a new booking
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createBooking(req, res) {
    const connection = await pool.getConnection();
    try {
      // Set transaction timeout
      await connection.query('SET SESSION innodb_lock_wait_timeout = 30');
      await connection.query('SET SESSION wait_timeout = 60');
      await connection.query('SET SESSION interactive_timeout = 60');
      
      await connection.beginTransaction();

      console.log('⭐️ ===== BEGIN BOOKING CREATION =====');
      console.log('⭐️ Headers:', JSON.stringify(req.headers));
      console.log('⭐️ Token user details:', JSON.stringify(req.user));
      console.log('⭐️ Raw body:', JSON.stringify(req.body));

      // Lấy data từ request
      console.log('📌 Thông tin đặt tour từ client:');
      const {
        ma_tour,
        ma_lich_khoi_hanh,
        so_nguoi_lon,
        so_tre_em,
        ma_khuyen_mai,
        dich_vu,
        ma_khach_hang // Thêm field ma_khach_hang từ client
      } = req.body;
      
      // In ra toàn bộ thông tin cụ thể
      console.log('- ma_tour:', ma_tour);
      console.log('- ma_lich_khoi_hanh:', ma_lich_khoi_hanh);
      console.log('- so_nguoi_lon:', so_nguoi_lon);
      console.log('- so_tre_em:', so_tre_em);
      console.log('- ma_khuyen_mai:', ma_khuyen_mai);
      console.log('- dich_vu:', dich_vu);
      console.log('- ma_khach_hang từ client:', ma_khach_hang);

      // Validate required fields
      const missingFields = [];
      if (!ma_tour) missingFields.push('ma_tour');
      if (!ma_lich_khoi_hanh) missingFields.push('ma_lich_khoi_hanh');
      if (!so_nguoi_lon) missingFields.push('so_nguoi_lon');

      if (missingFields.length > 0) {
        console.log('❌ Thiếu thông tin: ' + missingFields.join(', '));
        return res.status(400).json({
          status: 'error',
          message: `Thiếu thông tin bắt buộc: ${missingFields.join(', ')}`,
          missingFields
        });
      }

      // Lấy userId từ token
      console.log('🔐 Lấy thông tin người dùng từ token:');
      const userId = req.user.id || req.user.Id_user || req.user.userId;
      console.log('- userId từ token:', userId);
      
      // QUAN TRỌNG: Kiểm tra mã khách hàng theo thứ tự ưu tiên
      console.log('🔍 Xác định mã khách hàng:');
      let customerId = null;
      
      // 1. Ưu tiên ma_khach_hang từ client nếu có
      if (ma_khach_hang) {
        console.log('✅ Sử dụng mã khách hàng từ client:', ma_khach_hang);
        customerId = ma_khach_hang;
      } 
      // 2. Lấy customerId từ token
      else if (req.user.customerId || req.user.Ma_khach_hang) {
        customerId = req.user.customerId || req.user.Ma_khach_hang;
        console.log('✅ Sử dụng mã khách hàng từ token:', customerId);
      }
      
      // 3. Query database để tìm mã khách hàng theo userId
      if (!customerId && userId) {
        try {
          console.log('🔍 Tìm kiếm mã khách hàng trong database cho user:', userId);
          
          const [customerResult] = await connection.query(
            'SELECT * FROM Khach_hang WHERE Id_user = ?',
            [userId]
          );
          
          console.log('- Kết quả truy vấn khách hàng:', JSON.stringify(customerResult));
          
          if (customerResult && customerResult.length > 0) {
            customerId = customerResult[0].Ma_khach_hang;
            console.log('✅ Tìm thấy mã khách hàng trong database:', customerId);
          } else {
            console.log('❌ Không tìm thấy mã khách hàng trong database');
          }
        } catch (error) {
          console.error('❌ Lỗi khi tìm thông tin khách hàng:', error);
        }
      }
      
      // 4. Kiểm tra lần cuối và báo lỗi nếu không tìm thấy
      if (!customerId) {
        console.error('❌ Không xác định được mã khách hàng sau tất cả các phương pháp');
        return res.status(400).json({
          status: 'error',
          message: 'Không tìm thấy thông tin khách hàng. Vui lòng cập nhật thông tin cá nhân trước khi đặt tour.',
          details: {
            userId: userId,
            tokenInfo: req.user,
            customerIdFromParam: ma_khach_hang
          }
        });
      }

      console.log('✅ Đã xác định được mã khách hàng:', customerId);

      // ⚠️ NGHIỆP VỤ: Kiểm tra xem user đã có booking "Chờ thanh toán" cho cùng Ma_lich_khoi_hanh chưa
      console.log('🔍 Kiểm tra booking đang chờ thanh toán cho cùng lịch khởi hành...');
      const existingPendingBooking = await Booking.getPendingBookingBySchedule(
        userId, 
        ma_lich_khoi_hanh, 
        connection
      );
      
      if (existingPendingBooking) {
        await connection.rollback();
        console.log('❌ User đã có booking "Chờ thanh toán" cho lịch khởi hành này:', existingPendingBooking.Ma_booking);
        return res.status(400).json({
          status: 'error',
          message: 'Bạn đã có một đơn đặt tour đang chờ thanh toán cho lịch khởi hành này. Vui lòng thanh toán đơn đặt hiện tại trước khi đặt tour mới.',
          existingBooking: {
            ma_booking: existingPendingBooking.Ma_booking,
            ngay_dat: existingPendingBooking.Ngay_dat,
            trang_thai: existingPendingBooking.Trang_thai_booking || existingPendingBooking.Trang_thai
          }
        });
      }
      console.log('✅ Không có booking đang chờ thanh toán cho lịch khởi hành này');

      // Check if schedule exists and lock it for update to prevent race conditions
      const totalSeats = parseInt(so_nguoi_lon) + parseInt(so_tre_em || 0);
      
      console.log('🔒 Locking schedule for update...');
      const [scheduleRows] = await connection.query({
        sql: 'SELECT * FROM Lich_khoi_hanh WHERE Ma_lich = ? FOR UPDATE',
        values: [ma_lich_khoi_hanh],
        timeout: 10000
      });
      
      if (!scheduleRows || scheduleRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy lịch khởi hành'
        });
      }
      
      const schedule = scheduleRows[0];
      console.log('📊 Schedule info:', schedule);
      
      // Kiểm tra Trang_thai: chỉ cho phép đặt tour khi Trang_thai = 'Còn chỗ'
      // Kiểm tra xem cột Trang_thai có tồn tại không
      const [trangThaiColumn] = await connection.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'Lich_khoi_hanh' 
           AND COLUMN_NAME = 'Trang_thai'`
      );
      const hasTrangThai = trangThaiColumn.length > 0;
      
      if (hasTrangThai && schedule.Trang_thai && schedule.Trang_thai !== 'Còn chỗ') {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: `Không thể đặt tour. Trạng thái lịch khởi hành: ${schedule.Trang_thai}`,
          trang_thai: schedule.Trang_thai
        });
      }
      
      // Tính toán số chỗ còn lại trực tiếp từ So_cho (không sử dụng So_cho_con_lai)
      // Tính số chỗ đã đặt: 
      // - Booking "Đã thanh toán" (chắc chắn sẽ đi)
      // - Booking "Chờ thanh toán" chưa hết hạn (đang giữ chỗ tạm)
      // - Không tính booking đã hủy hoặc hết hạn
      
      // Kiểm tra xem cột expires_at có tồn tại không
      const [expiresAtColumn] = await connection.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'Booking' 
           AND COLUMN_NAME = 'expires_at'`
      );
      const hasExpiresAt = expiresAtColumn.length > 0;
      
      let bookingQuery;
      if (hasExpiresAt) {
        // Nếu có expires_at: tính booking "Đã thanh toán" + "Chờ thanh toán" chưa hết hạn
        bookingQuery = `
          SELECT SUM(b.So_nguoi_lon + b.So_tre_em) as total_booked
          FROM Chi_tiet_booking cdb
          JOIN Booking b ON cdb.Ma_booking = b.Ma_booking
          WHERE cdb.Ma_lich = ? 
            AND (
              b.Trang_thai_booking = 'Đã thanh toán'
              OR (
                b.Trang_thai_booking = 'Chờ thanh toán'
                AND (b.expires_at IS NULL OR b.expires_at > NOW())
              )
            )
        `;
      } else {
        // Nếu không có expires_at: tính booking "Đã thanh toán" + "Chờ thanh toán" trong 10 phút gần nhất
        bookingQuery = `
          SELECT SUM(b.So_nguoi_lon + b.So_tre_em) as total_booked
          FROM Chi_tiet_booking cdb
          JOIN Booking b ON cdb.Ma_booking = b.Ma_booking
          WHERE cdb.Ma_lich = ? 
            AND (
              b.Trang_thai_booking = 'Đã thanh toán'
              OR (
                b.Trang_thai_booking = 'Chờ thanh toán'
                AND b.Ngay_dat > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
              )
            )
        `;
      }
      
      const [bookingRows] = await connection.query({
        sql: bookingQuery,
        values: [ma_lich_khoi_hanh],
        timeout: 10000
      });
      
      const totalBooked = bookingRows[0]?.total_booked || 0;
      const availableSeats = schedule.So_cho - totalBooked;
      console.log(`📊 Tính toán số chỗ: Tổng ${schedule.So_cho}, Đã đặt ${totalBooked}, Còn lại ${availableSeats}`);
      
      console.log(`📊 Số chỗ tổng: ${schedule.So_cho}, Còn lại: ${availableSeats}, Cần: ${totalSeats}`);
      
      // Kiểm tra số chỗ còn lại
      if (availableSeats < totalSeats) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: `Số chỗ còn lại không đủ. Cần ${totalSeats} chỗ nhưng chỉ còn ${availableSeats} chỗ`
        });
      }

      // Calculate total price
      const tour = await Tour.getById(ma_tour);
      if (!tour) {
        await connection.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy thông tin tour'
        });
      }

      let totalPrice = (parseFloat(tour.Gia_nguoi_lon) * parseInt(so_nguoi_lon)) + 
                      (parseFloat(tour.Gia_tre_em) * parseInt(so_tre_em || 0));

      // Apply promotion if exists
      let discountAmount = 0;
      if (ma_khuyen_mai) {
        const promotion = await Promotion.getByCode(ma_khuyen_mai);
        if (promotion && new Date(promotion.Ngay_ket_thuc) > new Date()) {
          discountAmount = totalPrice * (promotion.Gia_tri / 100);
          totalPrice -= discountAmount;
        }
      }

      // Add service prices
      if (dich_vu && Array.isArray(dich_vu)) {
        for (const service of dich_vu) {
          const serviceInfo = await Service.getById(service.ma_dich_vu);
          if (serviceInfo) {
            totalPrice += parseFloat(serviceInfo.Gia) * parseInt(service.so_luong || 1);
          }
        }
      }

      // Generate booking ID
      const bookingId = `B${Date.now()}`;

      // Tạo thời gian hết hạn (10 phút sau) - chỉ dùng nếu cột expires_at tồn tại
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      // Create booking object with all required fields
      const booking = {
        Ma_booking: bookingId,
        Ngay_dat: new Date(),
        So_nguoi_lon: parseInt(so_nguoi_lon),
        So_tre_em: parseInt(so_tre_em || 0),
        Ma_khuyen_mai: ma_khuyen_mai || null,
        Trang_thai_booking: 'Chờ thanh toán', // Trạng thái "Chờ thanh toán"
        Tong_tien: totalPrice,
        Ma_khach_hang: customerId,
        Id_user: userId
      };

      // Chỉ thêm expires_at nếu cột tồn tại
      if (hasExpiresAt) {
        booking.expires_at = expiresAt;
      }

      console.log('💼 Tạo booking với dữ liệu:', booking);
      if (hasExpiresAt) {
        console.log(`⏰ Thời gian hết hạn: ${expiresAt.toISOString()}`);
      }

      // Kiểm tra tên bảng thực tế trong database
      let bookingTableName = 'Booking';
      try {
        const [tables] = await connection.query(
          `SELECT TABLE_NAME 
           FROM INFORMATION_SCHEMA.TABLES 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND (TABLE_NAME = 'Booking' OR TABLE_NAME = 'booking')`
        );
        if (tables.length > 0) {
          bookingTableName = tables[0].TABLE_NAME;
          console.log(`📋 Using booking table name: ${bookingTableName}`);
        }
      } catch (error) {
        console.warn('⚠️ Không thể kiểm tra tên bảng, sử dụng mặc định: Booking');
      }

      // Tạo booking trực tiếp bằng query với timeout
      // Chỉ thêm expires_at vào query nếu cột tồn tại
      let query, values;
      if (hasExpiresAt) {
        query = `
          INSERT INTO ${bookingTableName} (
            Ma_booking,
            Ngay_dat,
            So_nguoi_lon,
            So_tre_em,
            Ma_khuyen_mai,
            Trang_thai_booking,
            Tong_tien,
            Ma_khach_hang,
            Id_user,
            expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        values = [
          booking.Ma_booking,
          booking.Ngay_dat,
          booking.So_nguoi_lon,
          booking.So_tre_em,
          booking.Ma_khuyen_mai,
          booking.Trang_thai_booking,
          booking.Tong_tien,
          booking.Ma_khach_hang,
          booking.Id_user,
          booking.expires_at
        ];
      } else {
        query = `
          INSERT INTO ${bookingTableName} (
            Ma_booking,
            Ngay_dat,
            So_nguoi_lon,
            So_tre_em,
            Ma_khuyen_mai,
            Trang_thai_booking,
            Tong_tien,
            Ma_khach_hang,
            Id_user
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        values = [
          booking.Ma_booking,
          booking.Ngay_dat,
          booking.So_nguoi_lon,
          booking.So_tre_em,
          booking.Ma_khuyen_mai,
          booking.Trang_thai_booking,
          booking.Tong_tien,
          booking.Ma_khach_hang,
          booking.Id_user
        ];
      }

      console.log('🔍 Query:', query);
      console.log('📊 Values:', values);

      // Execute with timeout
      console.log('💾 Executing INSERT query for Booking...');
      const insertResult = await connection.query({
        sql: query,
        values: values,
        timeout: 30000 // 30 seconds timeout
      });
      console.log('✅ INSERT Booking result:', insertResult);
      console.log('✅ INSERT Booking affectedRows:', insertResult[0]?.affectedRows);
      console.log('✅ INSERT Booking insertId:', insertResult[0]?.insertId);

      // Verify booking was inserted - sử dụng tên bảng đã xác định
      const [verifyBooking] = await connection.query(
        `SELECT * FROM ${bookingTableName} WHERE Ma_booking = ?`,
        [bookingId]
      );
      
      if (verifyBooking.length === 0) {
        console.error('❌ CRITICAL: Booking was not found after INSERT');
        console.error('❌ Booking ID:', bookingId);
        console.error('❌ Query used:', query);
        console.error('❌ Values used:', values);
        throw new Error(`Booking ${bookingId} was not inserted into database`);
      }
      console.log('✅ Verified booking exists in database:', verifyBooking[0].Ma_booking);

      // Tạo Chi_tiet_booking để liên kết booking với lịch khởi hành
      console.log('🔗 Tạo Chi_tiet_booking...');
      const chiTietResult = await connection.query({
        sql: 'INSERT INTO Chi_tiet_booking (Ma_booking, Ma_lich) VALUES (?, ?)',
        values: [bookingId, ma_lich_khoi_hanh],
        timeout: 15000 // 15 seconds timeout
      });
      console.log('✅ INSERT Chi_tiet_booking result:', chiTietResult);
      console.log('✅ Đã tạo Chi_tiet_booking:', { Ma_booking: bookingId, Ma_lich: ma_lich_khoi_hanh });

      // Verify Chi_tiet_booking was inserted
      const [verifyChiTiet] = await connection.query(
        'SELECT * FROM Chi_tiet_booking WHERE Ma_booking = ? AND Ma_lich = ?',
        [bookingId, ma_lich_khoi_hanh]
      );
      if (verifyChiTiet.length === 0) {
        throw new Error(`Chi_tiet_booking for ${bookingId} was not inserted into database`);
      }
      console.log('✅ Verified Chi_tiet_booking exists in database');

      // Cập nhật So_cho_con_lai trong database nếu cột tồn tại
      try {
        console.log('🔄 Bắt đầu cập nhật So_cho_con_lai trong database...');
        // Kiểm tra xem cột So_cho_con_lai có tồn tại không
        const [soChoConLaiColumn] = await connection.query(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'Lich_khoi_hanh' 
             AND COLUMN_NAME = 'So_cho_con_lai'`
        );
        
        console.log(`📊 Kiểm tra cột So_cho_con_lai: ${soChoConLaiColumn.length > 0 ? 'TỒN TẠI' : 'KHÔNG TỒN TẠI'}`);
        
        if (soChoConLaiColumn.length > 0) {
          console.log('✅ Cột So_cho_con_lai tồn tại, bắt đầu tính toán lại...');
          // Tính lại số chỗ còn lại sau khi đặt tour
          const bookingCondition = hasExpiresAt ? 
            `(b.Trang_thai_booking = 'Đã thanh toán' OR (b.Trang_thai_booking = 'Chờ thanh toán' AND (b.expires_at IS NULL OR b.expires_at > NOW())))` :
            `(b.Trang_thai_booking = 'Đã thanh toán' OR (b.Trang_thai_booking = 'Chờ thanh toán' AND b.Ngay_dat > DATE_SUB(NOW(), INTERVAL 10 MINUTE)))`;
          
          const calculateQuery = `
            SELECT 
               l.So_cho,
               COALESCE(SUM(
                 CASE 
                   WHEN ${bookingCondition}
                   THEN (b.So_nguoi_lon + b.So_tre_em)
                   ELSE 0
                 END
               ), 0) AS bookedSeats
             FROM Lich_khoi_hanh l
             LEFT JOIN Chi_tiet_booking cb ON cb.Ma_lich = l.Ma_lich
             LEFT JOIN Booking b ON b.Ma_booking = cb.Ma_booking
             WHERE l.Ma_lich = ?
             GROUP BY l.Ma_lich, l.So_cho
          `;
          
          console.log('🔍 Query tính toán bookedSeats:', calculateQuery);
          console.log('🔍 Ma_lich:', ma_lich_khoi_hanh);
          
          const [updatedScheduleRows] = await connection.query(calculateQuery, [ma_lich_khoi_hanh]);
          
          console.log('📊 Kết quả tính toán bookedSeats:', JSON.stringify(updatedScheduleRows));
          
          if (updatedScheduleRows.length > 0) {
            const updatedSchedule = updatedScheduleRows[0];
            const newAvailableSeats = Math.max(0, updatedSchedule.So_cho - updatedSchedule.bookedSeats);
            
            console.log(`📊 So_cho: ${updatedSchedule.So_cho}, bookedSeats: ${updatedSchedule.bookedSeats}, newAvailableSeats: ${newAvailableSeats}`);
            
            // Kiểm tra xem cột Trang_thai có tồn tại không
            const [trangThaiColumn] = await connection.query(
              `SELECT COLUMN_NAME 
               FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
                 AND TABLE_NAME = 'Lich_khoi_hanh' 
                 AND COLUMN_NAME = 'Trang_thai'`
            );
            const hasTrangThai = trangThaiColumn.length > 0;
            
            // Cập nhật So_cho_con_lai và Trang_thai
            let updateQuery;
            let updateResult;
            if (hasTrangThai) {
              // Nếu So_cho_con_lai = 0 → cập nhật Trang_thai = 'Hết chỗ'
              // Nếu So_cho_con_lai > 0 và Trang_thai = 'Hết chỗ' → cập nhật thành 'Còn chỗ'
              // Nhưng chỉ cập nhật nếu lịch chưa diễn ra (CURDATE() < Ngay_bat_dau)
              updateQuery = `
                UPDATE Lich_khoi_hanh 
                SET So_cho_con_lai = ?,
                    Trang_thai = CASE
                      WHEN CURDATE() < Ngay_bat_dau THEN
                        CASE WHEN ? = 0 THEN 'Hết chỗ' 
                             WHEN ? > 0 AND Trang_thai = 'Hết chỗ' THEN 'Còn chỗ'
                             ELSE Trang_thai
                        END
                      WHEN CURDATE() = Ngay_bat_dau THEN 'Đang diễn ra'
                      WHEN CURDATE() > Ngay_ket_thuc THEN 'Đã diễn ra'
                      ELSE Trang_thai
                    END
                WHERE Ma_lich = ?
              `;
              console.log('🔍 Query UPDATE với Trang_thai:', updateQuery);
              console.log('🔍 Values:', [newAvailableSeats, newAvailableSeats, newAvailableSeats, ma_lich_khoi_hanh]);
              
              [updateResult] = await connection.query(updateQuery, [newAvailableSeats, newAvailableSeats, newAvailableSeats, ma_lich_khoi_hanh]);
            } else {
              updateQuery = `UPDATE Lich_khoi_hanh SET So_cho_con_lai = ? WHERE Ma_lich = ?`;
              console.log('🔍 Query UPDATE:', updateQuery);
              console.log('🔍 Values:', [newAvailableSeats, ma_lich_khoi_hanh]);
              
              [updateResult] = await connection.query(updateQuery, [newAvailableSeats, ma_lich_khoi_hanh]);
            }
            
            console.log('📊 UPDATE result affectedRows:', updateResult.affectedRows);
            console.log('📊 UPDATE result changedRows:', updateResult.changedRows);
            console.log(`✅ Đã cập nhật So_cho_con_lai trong database: ${newAvailableSeats} cho lịch ${ma_lich_khoi_hanh}`);
            
            // Verify update
            const [verifyUpdate] = await connection.query(
              'SELECT So_cho_con_lai FROM Lich_khoi_hanh WHERE Ma_lich = ?',
              [ma_lich_khoi_hanh]
            );
            
            if (verifyUpdate.length > 0) {
              console.log(`✅ Verified: So_cho_con_lai trong database = ${verifyUpdate[0].So_cho_con_lai}`);
              if (verifyUpdate[0].So_cho_con_lai !== newAvailableSeats) {
                console.error(`❌ LỖI: So_cho_con_lai trong database (${verifyUpdate[0].So_cho_con_lai}) khác với giá trị mong đợi (${newAvailableSeats})`);
              }
            } else {
              console.error('❌ Không thể verify update So_cho_con_lai');
            }
          } else {
            console.error('❌ Không tìm thấy lịch khởi hành để cập nhật So_cho_con_lai');
          }
        } else {
          console.log('⚠️ Cột So_cho_con_lai không tồn tại, bỏ qua cập nhật');
        }
      } catch (error) {
        console.error('❌ Lỗi khi cập nhật So_cho_con_lai:', error);
        // Không throw error để không làm gián đoạn quá trình tạo booking
        // Chỉ log lỗi để debug
      }
      console.log(`✅ Đã đặt ${totalSeats} chỗ. Số chỗ còn lại sẽ được tính toán tự động: ${availableSeats - totalSeats}/${schedule.So_cho}`);

      // Add service details if any
      if (dich_vu && Array.isArray(dich_vu)) {
        for (const service of dich_vu) {
          await Booking.addServiceDetail(bookingId, service.ma_dich_vu, parseInt(service.so_luong || 1), connection);
        }
      }

      console.log('✅ Đã tạo booking và chi tiết thành công');

      // Commit transaction
      console.log('💾 Committing transaction...');
      await connection.commit();
      console.log('✅ Transaction committed successfully');

      // Verify booking still exists after commit - sử dụng tên bảng đã xác định
      const [verifyAfterCommit] = await connection.query(
        `SELECT * FROM ${bookingTableName} WHERE Ma_booking = ?`,
        [bookingId]
      );
      
      if (verifyAfterCommit.length === 0) {
        console.error('❌ CRITICAL: Booking was lost after commit!');
        console.error('❌ Booking ID:', bookingId);
        throw new Error(`Booking ${bookingId} disappeared after commit`);
      }
      console.log('✅ Verified booking still exists after commit:', verifyAfterCommit[0].Ma_booking);

      // Emit realtime notification to all admins
      const io = req.app.locals.io;
      if (io) {
        try {
          // Lấy thông tin tour và lịch khởi hành để gửi thông báo
          const [bookingDetails] = await connection.query(
            `SELECT 
              b.Ma_booking,
              b.Ngay_dat,
              b.So_nguoi_lon,
              b.So_tre_em,
              b.Tong_tien,
              b.Trang_thai_booking,
              kh.Ten_khach_hang,
              t.Ten_tour,
              lkh.Ngay_bat_dau,
              lkh.Ngay_ket_thuc
            FROM Booking b
            JOIN Khach_hang kh ON b.Ma_khach_hang = kh.Ma_khach_hang
            JOIN Chi_tiet_booking ctb ON b.Ma_booking = ctb.Ma_booking
            JOIN Lich_khoi_hanh lkh ON ctb.Ma_lich = lkh.Ma_lich
            JOIN Tour_du_lich t ON lkh.Ma_tour = t.Ma_tour
            WHERE b.Ma_booking = ?`,
            [bookingId]
          );

          if (bookingDetails.length > 0) {
            const bookingInfo = bookingDetails[0];
            const notificationData = {
              bookingId: bookingInfo.Ma_booking,
              customerName: bookingInfo.Ten_khach_hang,
              tourName: bookingInfo.Ten_tour,
              ngayDat: bookingInfo.Ngay_dat,
              soNguoiLon: bookingInfo.So_nguoi_lon,
              soTreEm: bookingInfo.So_tre_em,
              tongTien: bookingInfo.Tong_tien,
              trangThai: bookingInfo.Trang_thai_booking,
              ngayKhoiHanh: bookingInfo.Ngay_bat_dau,
              ngayKetThuc: bookingInfo.Ngay_ket_thuc,
              timestamp: new Date().toISOString()
            };

            // Emit to all admin sockets (sử dụng namespace hoặc room cho admin)
            // Lấy danh sách admin sockets từ app.locals nếu có
            const adminSockets = req.app.locals.adminSockets || {};
            const adminSocketIds = Object.keys(adminSockets);
            
            console.log(`🔍 [NOTIFICATION] Kiểm tra admin sockets: ${adminSocketIds.length} admin đang online`);
            console.log(`🔍 [NOTIFICATION] Admin IDs:`, adminSocketIds);
            
            if (adminSocketIds.length > 0) {
              let successCount = 0;
              let failCount = 0;
              
              // Gửi đến từng admin socket
              adminSocketIds.forEach(adminId => {
                const adminSocket = adminSockets[adminId];
                if (adminSocket && adminSocket.connected) {
                  try {
                    adminSocket.emit('new_booking', notificationData);
                    successCount++;
                    console.log(`✅ [NOTIFICATION] Đã gửi đến admin ${adminId} (socket ${adminSocket.id})`);
                  } catch (error) {
                    failCount++;
                    console.error(`❌ [NOTIFICATION] Lỗi khi gửi đến admin ${adminId}:`, error);
                  }
                } else {
                  failCount++;
                  console.warn(`⚠️ [NOTIFICATION] Admin ${adminId} socket không connected hoặc không tồn tại`);
                }
              });
              
              console.log(`📢 [NOTIFICATION] Đã gửi thông báo booking mới: ${successCount} thành công, ${failCount} thất bại`);
            } else {
              // Fallback: gửi broadcast nếu không có admin sockets được lưu
              console.warn('⚠️ [NOTIFICATION] Không có admin nào online, gửi broadcast');
              io.emit('new_booking', notificationData);
              console.log('📢 [NOTIFICATION] Đã gửi thông báo booking mới (broadcast):', notificationData);
            }
          }
          
          // Emit socket event cho hướng dẫn viên nếu có
          try {
            const guideSockets = req.app.get('guideSockets') || {};
            
            // Lấy Ma_huong_dan_vien từ lịch khởi hành
            const [scheduleInfo] = await connection.query(
              'SELECT Ma_huong_dan_vien FROM lich_khoi_hanh WHERE Ma_lich = ?',
              [ma_lich_khoi_hanh]
            );
            
            if (scheduleInfo.length > 0 && scheduleInfo[0].Ma_huong_dan_vien) {
              const guideId = scheduleInfo[0].Ma_huong_dan_vien;
              const guideSocket = guideSockets[guideId];
              
              if (guideSocket && guideSocket.connected) {
                guideSocket.emit('new_booking', {
                  ...notificationData,
                  ma_lich: ma_lich_khoi_hanh,
                  ma_huong_dan_vien: guideId
                });
                console.log(`✅ [NOTIFICATION] Đã gửi thông báo booking mới đến hướng dẫn viên ${guideId}`);
              }
            }
          } catch (error) {
            console.error('❌ Lỗi khi gửi thông báo booking cho guide:', error);
          }
        } catch (error) {
          console.error('❌ Lỗi khi gửi thông báo booking:', error);
          // Không throw error để không làm gián đoạn response
        }
      }

      const responseData = {
        status: 'success',
        message: 'Đặt tour thành công. Vui lòng thanh toán trong vòng 10 phút.',
        data: {
          bookingId,
          booking: {
            ...booking,
            customer_info: {
              ma_khach_hang: customerId,
              id_user: userId
            },
          },
          expires_in: 600, // 10 phút (600 giây)
          available_seats: availableSeats - totalSeats
        }
      };

      // Chỉ thêm expires_at vào response nếu cột tồn tại
      if (hasExpiresAt) {
        responseData.data.booking.expires_at = expiresAt;
      }

      res.status(201).json(responseData);

    } catch (error) {
      await connection.rollback();
      console.error('Error creating booking:', error);
      res.status(500).json({
        status: 'error',
        message: 'Có lỗi xảy ra khi đặt tour',
        error: error.message
      });
    } finally {
      connection.release();
    }
  }
  
  /**
   * Update booking status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateBookingStatus(req, res) {
    try {
      const bookingId = req.params.id;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({
          status: 'error',
          message: 'Status is required'
        });
      }
      
      // Get booking details
      const bookingDetails = await Booking.getBookingDetails(bookingId);
      
      if (!bookingDetails || !bookingDetails.booking) {
        return res.status(404).json({
          status: 'error',
          message: 'Booking not found'
        });
      }
      
      // Ensure user is authorized (admin or the booking owner)
      if (req.user.role !== 'Admin' && req.user.id !== bookingDetails.booking.Id_user) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to update this booking'
        });
      }
      
      // Update booking status
      await Booking.updateStatus(bookingId, status);
      
      res.status(200).json({
        status: 'success',
        message: 'Booking status updated successfully'
      });
    } catch (error) {
      console.error(`Update booking status ${req.params.id} error:`, error);
      res.status(500).json({
        status: 'error',
        message: 'Error updating booking status',
        error: error.message
      });
    }
  }
  
  /**
   * Add services to booking
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addServices(req, res) {
    try {
      const bookingId = req.params.id;
      const { services } = req.body;
      
      if (!services || !Array.isArray(services) || services.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Services array is required'
        });
      }
      
      // Get booking details
      const bookingDetails = await Booking.getBookingDetails(bookingId);
      
      if (!bookingDetails || !bookingDetails.booking) {
        return res.status(404).json({
          status: 'error',
          message: 'Booking not found'
        });
      }
      
      // Ensure user is authorized (admin or the booking owner)
      if (req.user.role !== 'Admin' && req.user.id !== bookingDetails.booking.Id_user) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to update this booking'
        });
      }
      
      // Add services to booking
      await Booking.addServices(bookingId, services);
      
      // Get updated booking details
      const updatedBookingDetails = await Booking.getBookingDetails(bookingId);
      
      res.status(200).json({
        status: 'success',
        data: updatedBookingDetails
      });
    } catch (error) {
      console.error(`Add services to booking ${req.params.id} error:`, error);
      res.status(500).json({
        status: 'error',
        message: 'Error adding services to booking',
        error: error.message
      });
    }
  }
  
  /**
   * Create invoice for booking
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createInvoice(req, res) {
    try {
      const bookingId = req.params.id;
      
      // Get booking details
      const bookingDetails = await Booking.getBookingDetails(bookingId);
      
      if (!bookingDetails || !bookingDetails.booking) {
        return res.status(404).json({
          status: 'error',
          message: 'Booking not found'
        });
      }
      
      // Ensure user is authorized (admin or the booking owner)
      if (req.user.role !== 'Admin' && req.user.id !== bookingDetails.booking.Id_user) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to create invoice for this booking'
        });
      }
      
      // Generate invoice ID
      const invoiceId = 'HD' + Date.now().toString().slice(-6);
      
      // Create invoice object
      const invoiceData = {
        ma_hoa_don: invoiceId,
        ma_booking: bookingId,
        ngay_lap: new Date(),
        tong_tien: bookingDetails.booking.Tong_tien,
        trang_thai_hoa_don: 'Chưa thanh toán'
      };
      
      // Create invoice
      const newInvoice = await Booking.createInvoice(invoiceData);
      
      res.status(201).json({
        status: 'success',
        data: { invoice: newInvoice }
      });
    } catch (error) {
      console.error(`Create invoice for booking ${req.params.id} error:`, error);
      res.status(500).json({
        status: 'error',
        message: 'Error creating invoice',
        error: error.message
      });
    }
  }
  
  /**
   * Process payment for a booking
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processPayment(req, res) {
    try {
      const bookingId = req.params.id; // Sửa từ bookingId thành id
      const { 
        payment_method,
        amount,
        app_trans_id,
        status,
        hinh_thuc_thanh_toan = payment_method
      } = req.body;

      console.log('Payment request received:', {
        bookingId,
        payment_method,
        app_trans_id,
        status,
        body: req.body
      });

      // Get booking details
      const booking = await Booking.getById(bookingId);
      if (!booking) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy đặt tour'
        });
      }

      // Check if booking is already paid
      if (booking.Trang_thai_booking === 'Đã thanh toán') {
        return res.status(400).json({
          status: 'error',
          message: 'Đặt tour này đã được thanh toán'
        });
      }

      // Nếu là thanh toán ZaloPay với thông tin redirect
      if (payment_method === 'zalopay' && app_trans_id) {
        console.log('ZaloPay redirect payment processing:', { app_trans_id, status });

        // Kiểm tra trạng thái từ ZaloPay (nếu có)
        if (status && status !== '1') {
          return res.status(400).json({
            status: 'error',
            message: 'Giao dịch ZaloPay không thành công hoặc đã hủy'
          });
        }

        // Nếu cần xác thực thêm, bạn có thể gọi API kiểm tra trạng thái giao dịch ZaloPay ở đây
      }

      // Generate invoice ID
      const invoiceId = 'HD' + Date.now().toString().slice(-8);

      // Create invoice data
      const invoiceData = {
        ma_hoa_don: invoiceId,
        ngay_thanh_toan: new Date(),
        hinh_thuc_thanh_toan: hinh_thuc_thanh_toan,
        ma_giao_dich: app_trans_id || null // Lưu mã giao dịch ZaloPay nếu có
      };

      // Cập nhật trạng thái booking
      await Booking.updateStatus(bookingId, 'Đã thanh toán');

      // Create invoice
      const invoice = await Booking.createInvoice(bookingId, invoiceData);

      res.status(200).json({
        status: 'success',
        data: { 
          invoice: invoice,
          message: 'Thanh toán thành công'
        }
      });
    } catch (error) {
      console.error('Process payment error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi xử lý thanh toán',
        error: error.message
      });
    }
  }

  /**
   * Cancel a booking
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async cancelBooking(req, res) {
    try {
      const bookingId = req.params.id;
      const { reason } = req.body;
      
      console.log(`Xử lý yêu cầu hủy booking ${bookingId}`);
      console.log('User info from token:', JSON.stringify(req.user));
      
      // Check if booking exists
      const booking = await Booking.getById(bookingId);
      if (!booking) {
        console.log(`Không tìm thấy booking với ID ${bookingId}`);
        return res.status(404).json({
          status: 'error',
          message: 'Đặt tour không tồn tại'
        });
      }
      
      console.log('Booking info:', JSON.stringify(booking));
      console.log(`So sánh: booking.Id_user=${booking.Id_user}, req.user.id=${req.user.id}`);
      
      // Check if booking belongs to the user (unless admin)
      if (req.user.role !== 'Admin' && req.user.id !== booking.Id_user) {
        console.log('Quyền truy cập bị từ chối. Chi tiết:');
        console.log(`- req.user.role: ${req.user.role}`);
        console.log(`- booking.Id_user: ${booking.Id_user}`);
        console.log(`- req.user.id: ${req.user.id}`);
        console.log(`- Type of booking.Id_user: ${typeof booking.Id_user}`);
        console.log(`- Type of req.user.id: ${typeof req.user.id}`);
        
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền hủy đặt tour này'
        });
      }
      
      // Check if booking can be cancelled
      if (booking.Trang_thai_booking === 'Da_huy') {
        return res.status(400).json({
          status: 'error',
          message: 'Tour này đã được hủy trước đó'
        });
      }
      
      // Lưu lý do hủy tour vào log
      console.log(`Booking ${bookingId} bị hủy với lý do: ${reason || 'Không có lý do'}`);
      
      // Update booking status to cancelled
      const updatedBooking = await Booking.updateStatus(bookingId, 'Da_huy');
      
      console.log('Đã hủy tour thành công:', JSON.stringify(updatedBooking));
      
      res.status(200).json({
        status: 'success',
        data: { 
          booking: updatedBooking,
          message: 'Hủy đặt tour thành công'
        }
      });
    } catch (error) {
      console.error('Cancel booking error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi hủy đặt tour',
        error: error.message
      });
    }
  }
}

module.exports = BookingController;