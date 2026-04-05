const pool = require('../config/database');

/**
 * Tour Model
 */
class Tour {
  /**
   * Get all tours
   * @returns {Array} - List of all tours
   */
  static async getAll() {
    const [rows] = await pool.query('SELECT * FROM tour_du_lich');
    return rows;
  }

  /**
   * Get a tour by ID
   * @param {string} id - Tour ID
   * @returns {Object|null} - Tour data or null if not found
   */
  static async getById(id) {
    console.log(`==== GETTING TOUR WITH ID: ${id} ====`);
    const [rows] = await pool.query(
      'SELECT * FROM tour_du_lich WHERE Ma_tour = ?',
      [id]
    );
    
    if (rows[0]) {
      console.log('Tour data from database:', JSON.stringify(rows[0], null, 2));
      console.log('Mo_ta field exists:', rows[0].hasOwnProperty('Mo_ta'));
      console.log('Mo_ta value:', rows[0].Mo_ta);
    } else {
      console.log('No tour found with this ID');
    }
    
    return rows[0] || null;
  }

  /**
   * Create a new tour
   * @param {Object} tourData - Tour data
   * @returns {Object} - Newly created tour
   */
  static async create(tourData) {
    try {
      console.log('==== TOUR MODEL CREATE ====');
      console.log('Tour data received in model:', JSON.stringify(tourData, null, 2));
      
      const { ma_tour, ten_tour, thoi_gian, tinh_trang, loai_tour, gia_nguoi_lon, gia_tre_em, hinh_anh, mo_ta, Mo_ta, latitude, longitude, map_address } = tourData;
      
      // Sử dụng mo_ta hoặc Mo_ta (để tương thích với cả hai trường hợp)
      let description = mo_ta || Mo_ta || null;
      
      // Giới hạn độ dài mô tả trong 255 ký tự cho kiểu NVARCHAR(255)
      if (description && description.length > 255) {
        console.log('Mô tả vượt quá 255 ký tự, sẽ cắt ngắn');
        description = description.substring(0, 255);
      }
      
      console.log('Extracted image path:', hinh_anh);
      console.log('Extracted description:', description ? (description.length > 50 ? description.substring(0, 50) + '...' : description) : 'NULL');
      console.log('Description length:', description ? description.length : 0);
      console.log('Map data:', { latitude, longitude, map_address });
      
      // Kiểm tra xem các cột map có tồn tại không
      const [columns] = await pool.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'tour_du_lich' 
           AND COLUMN_NAME IN ('latitude', 'longitude', 'map_address')`
      );
      
      const hasMapColumns = columns.length > 0;
      const hasLatitude = columns.some(col => col.COLUMN_NAME === 'latitude');
      const hasLongitude = columns.some(col => col.COLUMN_NAME === 'longitude');
      const hasMapAddress = columns.some(col => col.COLUMN_NAME === 'map_address');
      
      // Thực hiện INSERT bao gồm cả Mo_ta và map data (nếu có)
      let insertSQL = 'INSERT INTO tour_du_lich (Ma_tour, Ten_tour, Thoi_gian, Tinh_trang, Loai_tour, Gia_nguoi_lon, Gia_tre_em, Hinh_anh, Mo_ta';
      let insertParams = [ma_tour, ten_tour, thoi_gian, tinh_trang, loai_tour || 'trong_nuoc', gia_nguoi_lon, gia_tre_em, hinh_anh, description];
      
      if (hasMapColumns) {
        if (hasLatitude) {
          insertSQL += ', latitude';
          insertParams.push(latitude || null);
        }
        if (hasLongitude) {
          insertSQL += ', longitude';
          insertParams.push(longitude || null);
        }
        if (hasMapAddress) {
          insertSQL += ', map_address';
          insertParams.push(map_address || null);
        }
      }
      
      insertSQL += ') VALUES (' + insertParams.map(() => '?').join(', ') + ')';
      
      console.log('INSERT query (with Mo_ta):', insertSQL);
      console.log('INSERT parameters:', JSON.stringify(insertParams, null, 2));
      
      // Thực hiện INSERT
      const [insertResult] = await pool.query(insertSQL, insertParams);
      console.log('Database INSERT result:', insertResult);
      
      // Kiểm tra dữ liệu sau khi lưu
      console.log('==== CHECKING SAVED TOUR DATA ====');
      const createdTour = await this.getById(ma_tour);
      console.log('Created tour Mo_ta field:', createdTour.Mo_ta);
      console.log('==========================');
      
      return createdTour;
    } catch (error) {
      console.error('ERROR in Tour.create:', error);
      throw error;
    }
  }

  /**
   * Update a tour
   * @param {string} id - Tour ID
   * @param {Object} tourData - Updated tour data
   * @returns {Object} - Updated tour
   */
  static async update(id, tourData) {
    try {
      console.log('==== TOUR MODEL UPDATE ====');
      console.log('Tour ID:', id);
      console.log('Tour data received in model:', JSON.stringify(tourData, null, 2));
      
      const { ten_tour, thoi_gian, tinh_trang, loai_tour, gia_nguoi_lon, gia_tre_em, hinh_anh, mo_ta, Mo_ta, latitude, longitude, map_address } = tourData;
      
      // Sử dụng mo_ta hoặc Mo_ta (để tương thích với cả hai trường hợp)
      let description = mo_ta || Mo_ta || null;
      
      // Giới hạn độ dài mô tả trong 255 ký tự cho kiểu NVARCHAR(255)
      if (description && description.length > 255) {
        console.log('Mô tả vượt quá 255 ký tự, sẽ cắt ngắn');
        description = description.substring(0, 255);
      }
      
      console.log('Extracted image path:', hinh_anh);
      console.log('Extracted description:', description ? (description.length > 50 ? description.substring(0, 50) + '...' : description) : 'NULL');
      console.log('Description length:', description ? description.length : 0);
      console.log('Map data:', { latitude, longitude, map_address });
      
      // Kiểm tra xem các cột map có tồn tại không
      const [columns] = await pool.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'tour_du_lich' 
           AND COLUMN_NAME IN ('latitude', 'longitude', 'map_address')`
      );
      
      const hasMapColumns = columns.length > 0;
      const hasLatitude = columns.some(col => col.COLUMN_NAME === 'latitude');
      const hasLongitude = columns.some(col => col.COLUMN_NAME === 'longitude');
      const hasMapAddress = columns.some(col => col.COLUMN_NAME === 'map_address');
      
      // Thực hiện UPDATE tất cả các trường bao gồm Mo_ta và map data (nếu có)
      let updateSQL = 'UPDATE tour_du_lich SET Ten_tour = ?, Thoi_gian = ?, Tinh_trang = ?, Loai_tour = ?, Gia_nguoi_lon = ?, Gia_tre_em = ?, Hinh_anh = ?, Mo_ta = ?';
      let updateParams = [ten_tour, thoi_gian, tinh_trang, loai_tour, gia_nguoi_lon, gia_tre_em, hinh_anh, description];
      
      if (hasMapColumns) {
        if (hasLatitude) {
          updateSQL += ', latitude = ?';
          updateParams.push(latitude || null);
        }
        if (hasLongitude) {
          updateSQL += ', longitude = ?';
          updateParams.push(longitude || null);
        }
        if (hasMapAddress) {
          updateSQL += ', map_address = ?';
          updateParams.push(map_address || null);
        }
      }
      
      updateSQL += ' WHERE Ma_tour = ?';
      updateParams.push(id);
      
      console.log('UPDATE query (with Mo_ta):', updateSQL);
      console.log('UPDATE parameters:', JSON.stringify(updateParams, null, 2));
      
      // Thực hiện UPDATE
      const [updateResult] = await pool.query(updateSQL, updateParams);
      console.log('Database UPDATE result:', updateResult);
      
      // Kiểm tra dữ liệu sau khi cập nhật
      console.log('==== CHECKING UPDATED TOUR DATA ====');
      const updatedTour = await this.getById(id);
      console.log('Updated tour Mo_ta field:', updatedTour.Mo_ta);
      console.log('==========================');
      
      return updatedTour;
    } catch (error) {
      console.error('ERROR in Tour.update:', error);
      throw error;
    }
  }

  /**
   * Delete a tour
   * @param {string} id - Tour ID
   * @returns {boolean} - Success status
   */
  static async delete(id) {
    const [result] = await pool.query(
      'DELETE FROM tour_du_lich WHERE Ma_tour = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Get tour schedules by tour ID
   * @param {string} tourId - Tour ID
   * @returns {Array} - List of tour schedules
   */
  static async getTourSchedules(tourId) {
    const [rows] = await pool.query(
      'SELECT * FROM lich_khoi_hanh WHERE Ma_tour = ?',
      [tourId]
    );
    
    return rows;
  }

  /**
   * Get tour destinations
   * @param {string} tourId - Tour ID
   * @returns {Array} - List of destinations for the tour
   */
  static async getTourDestinations(tourId) {
    const [rows] = await pool.query(
      `SELECT d.*, ct.Thu_tu
       FROM dia_danh d
       JOIN chi_tiet_tour_dia_danh ct ON d.Ma_dia_danh = ct.Ma_dia_danh
       WHERE ct.Ma_tour = ?
       ORDER BY ct.Thu_tu`,
      [tourId]
    );
    
    return rows;
  }

  /**
   * Add a destination to a tour
   * @param {string} tourId - Tour ID
   * @param {string} destinationId - Destination ID
   * @param {number} order - Order in the tour
   * @returns {boolean} - Success status
   */
  static async addDestination(tourId, destinationId, order) {
    const [result] = await pool.query(
      'INSERT INTO chi_tiet_tour_dia_danh (Ma_tour, Ma_dia_danh, Thu_tu) VALUES (?, ?, ?)',
      [tourId, destinationId, order]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Remove a destination from a tour
   * @param {string} tourId - Tour ID
   * @param {string} destinationId - Destination ID
   * @returns {boolean} - Success status
   */
  static async removeDestination(tourId, destinationId) {
    const [result] = await pool.query(
      'DELETE FROM chi_tiet_tour_dia_danh WHERE Ma_tour = ? AND Ma_dia_danh = ?',
      [tourId, destinationId]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Search tours by name
   * @param {string} keyword - Search keyword
   * @returns {Array} - Search results
   */
  static async searchByName(keyword) {
    const [rows] = await pool.query(
      'SELECT * FROM tour_du_lich WHERE Ten_tour LIKE ?',
      [`%${keyword}%`]
    );
    
    return rows;
  }

  /**
   * Create a new tour schedule
   * @param {Object} scheduleData - Schedule data
   * @returns {Object} - Newly created schedule
   */
  static async createSchedule(scheduleData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const { ma_lich, ma_tour, ngay_bat_dau, ngay_ket_thuc, so_cho, ma_huong_dan_vien } = scheduleData;
      
      // Validation: So_cho > 0
      if (!so_cho || so_cho <= 0) {
        throw new Error('Số chỗ phải lớn hơn 0');
      }
      
      // Validation: Ngay_bat_dau < Ngay_ket_thuc
      const startDate = new Date(ngay_bat_dau);
      const endDate = new Date(ngay_ket_thuc);
      if (startDate >= endDate) {
        throw new Error('Ngày khởi hành phải nhỏ hơn ngày kết thúc');
      }
      
      // Validation: Ngay_bat_dau >= ngày hiện tại
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startDate < today) {
        throw new Error('Ngày khởi hành không được ở quá khứ');
      }
      
      // Validation: Kiểm tra trùng thời gian với lịch khởi hành khác cùng Ma_tour
      const [overlappingSchedules] = await connection.query(
        `SELECT Ma_lich, Ngay_bat_dau, Ngay_ket_thuc
         FROM lich_khoi_hanh 
         WHERE Ma_tour = ? 
           AND (
             (Ngay_bat_dau <= ? AND Ngay_ket_thuc >= ?)
             OR (Ngay_bat_dau <= ? AND Ngay_ket_thuc >= ?)
             OR (Ngay_bat_dau >= ? AND Ngay_ket_thuc <= ?)
           )`,
        [ma_tour, ngay_bat_dau, ngay_bat_dau, ngay_ket_thuc, ngay_ket_thuc, ngay_bat_dau, ngay_ket_thuc]
      );
      
      if (overlappingSchedules.length > 0) {
        const conflict = overlappingSchedules[0];
        const conflictStart = new Date(conflict.Ngay_bat_dau).toLocaleDateString('vi-VN');
        const conflictEnd = new Date(conflict.Ngay_ket_thuc).toLocaleDateString('vi-VN');
        throw new Error(`Đã có lịch khởi hành trùng thời gian cho tour này! Lịch trùng: ${conflict.Ma_lich} (từ ${conflictStart} đến ${conflictEnd})`);
      }
      
      // Validation: Kiểm tra trùng lịch cho HDV nếu có
      if (ma_huong_dan_vien && ma_huong_dan_vien !== null && ma_huong_dan_vien !== '') {
        const Guide = require('./guide.model');
        const isAvailable = await Guide.isAvailable(
          ma_huong_dan_vien,
          ngay_bat_dau,
          ngay_ket_thuc
        );
        
        if (!isAvailable) {
          // Lấy thông tin lịch trùng
          const [conflictingSchedules] = await connection.query(
            `SELECT Ma_lich, Ngay_bat_dau, Ngay_ket_thuc
             FROM Lich_khoi_hanh
             WHERE Ma_huong_dan_vien = ?
               AND (
                 (Ngay_bat_dau >= ? AND Ngay_bat_dau <= ?)
                 OR (Ngay_ket_thuc >= ? AND Ngay_ket_thuc <= ?)
                 OR (Ngay_bat_dau <= ? AND Ngay_ket_thuc >= ?)
               )
             LIMIT 1`,
            [ma_huong_dan_vien, ngay_bat_dau, ngay_ket_thuc, ngay_bat_dau, ngay_ket_thuc, ngay_bat_dau, ngay_ket_thuc]
          );
          
          let errorMessage = 'Hướng dẫn viên đã có lịch trùng thời gian';
          if (conflictingSchedules.length > 0) {
            const conflict = conflictingSchedules[0];
            errorMessage += ` (Lịch: ${conflict.Ma_lich}, từ ${conflict.Ngay_bat_dau} đến ${conflict.Ngay_ket_thuc})`;
          }
          
          throw new Error(errorMessage);
        }
      }
      
      // Xác định So_cho_con_lai và Trang_thai
      let so_cho_con_lai = so_cho;
      let trang_thai = 'Còn chỗ';
      
      // Kiểm tra xem cột So_cho_con_lai có tồn tại không
      const [soChoConLaiColumn] = await connection.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'lich_khoi_hanh' 
           AND COLUMN_NAME = 'So_cho_con_lai'`
      );
      const hasSoChoConLai = soChoConLaiColumn.length > 0;
      
      // Kiểm tra xem cột Trang_thai có tồn tại không
      const [trangThaiColumn] = await connection.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'lich_khoi_hanh' 
           AND COLUMN_NAME = 'Trang_thai'`
      );
      const hasTrangThai = trangThaiColumn.length > 0;
      
      // Tính toán Trang_thai dựa vào ngày tháng
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      
      if (startDate.getTime() === currentDate.getTime()) {
        trang_thai = 'Đang diễn ra';
      } else if (startDate > currentDate) {
        trang_thai = so_cho_con_lai > 0 ? 'Còn chỗ' : 'Hết chỗ';
      } else {
        trang_thai = 'Đã diễn ra';
      }
      
      // Insert vào database (bao gồm Ma_huong_dan_vien nếu có)
      if (hasSoChoConLai && hasTrangThai) {
        if (ma_huong_dan_vien) {
          await connection.query(
            'INSERT INTO lich_khoi_hanh (Ma_lich, Ma_tour, Ngay_bat_dau, Ngay_ket_thuc, So_cho, So_cho_con_lai, Trang_thai, Ma_huong_dan_vien) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ma_lich, ma_tour, ngay_bat_dau, ngay_ket_thuc, so_cho, so_cho_con_lai, trang_thai, ma_huong_dan_vien]
          );
        } else {
          await connection.query(
            'INSERT INTO lich_khoi_hanh (Ma_lich, Ma_tour, Ngay_bat_dau, Ngay_ket_thuc, So_cho, So_cho_con_lai, Trang_thai) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [ma_lich, ma_tour, ngay_bat_dau, ngay_ket_thuc, so_cho, so_cho_con_lai, trang_thai]
          );
        }
      } else if (hasSoChoConLai) {
        if (ma_huong_dan_vien) {
          await connection.query(
            'INSERT INTO lich_khoi_hanh (Ma_lich, Ma_tour, Ngay_bat_dau, Ngay_ket_thuc, So_cho, So_cho_con_lai, Ma_huong_dan_vien) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [ma_lich, ma_tour, ngay_bat_dau, ngay_ket_thuc, so_cho, so_cho_con_lai, ma_huong_dan_vien]
          );
        } else {
          await connection.query(
            'INSERT INTO lich_khoi_hanh (Ma_lich, Ma_tour, Ngay_bat_dau, Ngay_ket_thuc, So_cho, So_cho_con_lai) VALUES (?, ?, ?, ?, ?, ?)',
            [ma_lich, ma_tour, ngay_bat_dau, ngay_ket_thuc, so_cho, so_cho_con_lai]
          );
        }
      } else if (hasTrangThai) {
        if (ma_huong_dan_vien) {
          await connection.query(
            'INSERT INTO lich_khoi_hanh (Ma_lich, Ma_tour, Ngay_bat_dau, Ngay_ket_thuc, So_cho, Trang_thai, Ma_huong_dan_vien) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [ma_lich, ma_tour, ngay_bat_dau, ngay_ket_thuc, so_cho, trang_thai, ma_huong_dan_vien]
          );
        } else {
          await connection.query(
            'INSERT INTO lich_khoi_hanh (Ma_lich, Ma_tour, Ngay_bat_dau, Ngay_ket_thuc, So_cho, Trang_thai) VALUES (?, ?, ?, ?, ?, ?)',
            [ma_lich, ma_tour, ngay_bat_dau, ngay_ket_thuc, so_cho, trang_thai]
          );
        }
      } else {
        if (ma_huong_dan_vien) {
          await connection.query(
            'INSERT INTO lich_khoi_hanh (Ma_lich, Ma_tour, Ngay_bat_dau, Ngay_ket_thuc, So_cho, Ma_huong_dan_vien) VALUES (?, ?, ?, ?, ?, ?)',
            [ma_lich, ma_tour, ngay_bat_dau, ngay_ket_thuc, so_cho, ma_huong_dan_vien]
          );
        } else {
          await connection.query(
            'INSERT INTO lich_khoi_hanh (Ma_lich, Ma_tour, Ngay_bat_dau, Ngay_ket_thuc, So_cho) VALUES (?, ?, ?, ?, ?)',
            [ma_lich, ma_tour, ngay_bat_dau, ngay_ket_thuc, so_cho]
          );
        }
      }
      
      await connection.commit();
      
      const [rows] = await pool.query(
        'SELECT * FROM lich_khoi_hanh WHERE Ma_lich = ?',
        [ma_lich]
      );
      
      return rows[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get schedule by ID
   * @param {string} lichId - Schedule ID
   * @returns {Object} - Schedule details
   */
  static async getScheduleById(lichId) {
    // Kiểm tra xem cột expires_at có tồn tại không
    const [expiresAtColumn] = await pool.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Booking' 
         AND COLUMN_NAME = 'expires_at'`
    );
    const hasExpiresAt = expiresAtColumn.length > 0;
    
    // Xây dựng điều kiện WHERE cho booking
    let bookingCondition;
    if (hasExpiresAt) {
      bookingCondition = `
        (b.Trang_thai_booking = 'Đã thanh toán'
        OR (
          b.Trang_thai_booking = 'Chờ thanh toán'
          AND (b.expires_at IS NULL OR b.expires_at > NOW())
        ))
      `;
    } else {
      bookingCondition = `
        (b.Trang_thai_booking = 'Đã thanh toán'
        OR (
          b.Trang_thai_booking = 'Chờ thanh toán'
          AND b.Ngay_dat > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        ))
      `;
    }
    
    // Lấy thông tin lịch và tính số chỗ đã đặt, bao gồm thông tin HDV và đánh giá
    const [rows] = await pool.query(
      `SELECT 
         l.Ma_lich,
         l.Ma_tour,
         l.Ngay_bat_dau,
         l.Ngay_ket_thuc,
         l.So_cho,
         l.Ma_huong_dan_vien,
         h.Ten_huong_dan_vien,
         h.Ma_huong_dan_vien AS guide_id,
         h.Anh_dai_dien AS guide_avatar,
         -- Số chỗ đã đặt (tính cả booking "Đã thanh toán" và "Chờ thanh toán" chưa hết hạn)
         COALESCE(SUM(
           CASE 
             WHEN ${bookingCondition} 
             THEN (b.So_nguoi_lon + b.So_tre_em)
             ELSE 0
           END
         ), 0) AS bookedSeats,
         -- Số chỗ còn lại tính trực tiếp từ So_cho
         (l.So_cho - COALESCE(SUM(
           CASE 
             WHEN ${bookingCondition} 
             THEN (b.So_nguoi_lon + b.So_tre_em)
             ELSE 0
           END
         ), 0)) AS availableSeats,
         -- Đánh giá trung bình của HDV (lấy từ bảng danh_gia, qua booking và schedule)
         COALESCE((
           SELECT AVG(d.Diem_huong_dan_vien)
           FROM danh_gia d
           LEFT JOIN Booking b2 ON d.Ma_booking = b2.Ma_booking
           LEFT JOIN Chi_tiet_booking ctb2 ON b2.Ma_booking = ctb2.Ma_booking
           LEFT JOIN Lich_khoi_hanh l2 ON ctb2.Ma_lich = l2.Ma_lich
           WHERE (d.Ma_huong_dan_vien = l.Ma_huong_dan_vien OR l2.Ma_huong_dan_vien = l.Ma_huong_dan_vien)
             AND d.Diem_huong_dan_vien IS NOT NULL
             AND d.Diem_huong_dan_vien > 0
         ), 0) AS guide_avg_rating,
         -- Số lượng đánh giá của HDV (lấy từ bảng danh_gia)
         COALESCE((
           SELECT COUNT(DISTINCT d.Id_review)
           FROM danh_gia d
           LEFT JOIN Booking b2 ON d.Ma_booking = b2.Ma_booking
           LEFT JOIN Chi_tiet_booking ctb2 ON b2.Ma_booking = ctb2.Ma_booking
           LEFT JOIN Lich_khoi_hanh l2 ON ctb2.Ma_lich = l2.Ma_lich
           WHERE (d.Ma_huong_dan_vien = l.Ma_huong_dan_vien OR l2.Ma_huong_dan_vien = l.Ma_huong_dan_vien)
             AND d.Diem_huong_dan_vien IS NOT NULL
             AND d.Diem_huong_dan_vien > 0
         ), 0) AS guide_rating_count
       FROM Lich_khoi_hanh l
       LEFT JOIN Chi_tiet_booking cb ON cb.Ma_lich = l.Ma_lich
       LEFT JOIN Booking b ON b.Ma_booking = cb.Ma_booking
       LEFT JOIN huong_dan_vien h ON l.Ma_huong_dan_vien = h.Ma_huong_dan_vien
       WHERE l.Ma_lich = ?
       GROUP BY l.Ma_lich, l.Ma_tour, l.Ngay_bat_dau, l.Ngay_ket_thuc, l.So_cho, 
                l.Ma_huong_dan_vien, h.Ten_huong_dan_vien, h.Ma_huong_dan_vien`,
      [lichId]
    );
    
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Update a schedule (dates, seats) with booked seats check
   * @param {string} lichId - Schedule ID
   * @param {Object} scheduleData - { ngay_bat_dau, ngay_ket_thuc, so_cho }
   * @returns {Object} - Updated schedule
   */
  static async updateSchedule(lichId, scheduleData) {
    const { ngay_bat_dau, ngay_ket_thuc, so_cho, ma_huong_dan_vien } = scheduleData;
    
    // Get current schedule to check dates
    const currentSchedule = await this.getScheduleById(lichId);
    if (!currentSchedule) {
      throw new Error('Lịch khởi hành không tồn tại');
    }
    
    // Use provided dates or current dates
    const finalNgayBatDau = ngay_bat_dau || currentSchedule.Ngay_bat_dau;
    const finalNgayKetThuc = ngay_ket_thuc || currentSchedule.Ngay_ket_thuc;
    
    // Calculate total booked seats
    const [bookingRows] = await pool.query(
      `SELECT SUM(b.So_nguoi_lon + b.So_tre_em) AS bookedSeats
       FROM booking b
       JOIN chi_tiet_booking cb ON b.Ma_booking = cb.Ma_booking
       WHERE cb.Ma_lich = ? AND b.Trang_thai_booking = 'Đã thanh toán'`,
      [lichId]
    );
    const bookedSeats = bookingRows[0].bookedSeats || 0;
    if (so_cho !== undefined && bookedSeats > so_cho) {
      throw new Error('Số chỗ mới nhỏ hơn số chỗ đã đặt');
    }
    
    // Kiểm tra trùng lịch nếu có cập nhật HDV hoặc ngày
    if (ma_huong_dan_vien !== undefined && ma_huong_dan_vien !== null && ma_huong_dan_vien !== '') {
      // Import Guide model để kiểm tra availability
      const Guide = require('./guide.model');
      const isAvailable = await Guide.isAvailable(
        ma_huong_dan_vien,
        finalNgayBatDau,
        finalNgayKetThuc,
        lichId // Exclude schedule hiện tại
      );
      
      if (!isAvailable) {
        // Lấy thông tin lịch trùng
        const [conflictingSchedules] = await pool.query(
          `SELECT Ma_lich, Ngay_bat_dau, Ngay_ket_thuc
           FROM Lich_khoi_hanh
           WHERE Ma_huong_dan_vien = ?
             AND Ma_lich != ?
             AND (
               (Ngay_bat_dau >= ? AND Ngay_bat_dau <= ?)
               OR (Ngay_ket_thuc >= ? AND Ngay_ket_thuc <= ?)
               OR (Ngay_bat_dau <= ? AND Ngay_ket_thuc >= ?)
             )
           LIMIT 1`,
          [ma_huong_dan_vien, lichId, finalNgayBatDau, finalNgayKetThuc, finalNgayBatDau, finalNgayKetThuc, finalNgayBatDau, finalNgayKetThuc]
        );
        
        let errorMessage = 'Hướng dẫn viên đã có lịch trùng thời gian';
        if (conflictingSchedules.length > 0) {
          const conflict = conflictingSchedules[0];
          errorMessage += ` (Lịch: ${conflict.Ma_lich}, từ ${conflict.Ngay_bat_dau} đến ${conflict.Ngay_ket_thuc})`;
        }
        
        throw new Error(errorMessage);
      }
    }
    
    // Build update query dynamically based on provided fields
    const updateFields = [];
    const updateValues = [];
    
    if (ngay_bat_dau !== undefined) {
      updateFields.push('Ngay_bat_dau = ?');
      updateValues.push(ngay_bat_dau);
    }
    if (ngay_ket_thuc !== undefined) {
      updateFields.push('Ngay_ket_thuc = ?');
      updateValues.push(ngay_ket_thuc);
    }
    if (so_cho !== undefined) {
      updateFields.push('So_cho = ?');
      updateValues.push(so_cho);
    }
    if (ma_huong_dan_vien !== undefined) {
      updateFields.push('Ma_huong_dan_vien = ?');
      updateValues.push(ma_huong_dan_vien || null); // null để gỡ HDV
    }
    
    if (updateFields.length === 0) {
      return await this.getScheduleById(lichId);
    }
    
    updateValues.push(lichId);
    
    await pool.query(
      `UPDATE lich_khoi_hanh SET ${updateFields.join(', ')} WHERE Ma_lich = ?`,
      updateValues
    );
    return await this.getScheduleById(lichId);
  }

  /**
   * Get all schedules with tour status and booked seats (exclude cancelled tours)
   * @returns {Array} - List of schedules
   */
  static async getAllSchedules() {
    // Kiểm tra xem có cột expires_at không
    const [expiresAtColumn] = await pool.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Booking' 
         AND COLUMN_NAME = 'expires_at'`
    );
    const hasExpiresAt = expiresAtColumn.length > 0;
    
    // Điều kiện tính booking
    let bookingCondition;
    if (hasExpiresAt) {
      bookingCondition = `(
        b.Trang_thai_booking = 'Đã thanh toán'
        OR (
          b.Trang_thai_booking = 'Chờ thanh toán'
          AND (b.expires_at IS NULL OR b.expires_at > NOW())
        )
      )`;
    } else {
      bookingCondition = `(
        b.Trang_thai_booking = 'Đã thanh toán'
        OR (
          b.Trang_thai_booking = 'Chờ thanh toán'
          AND b.Ngay_dat > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        )
      )`;
    }
    
    const [rows] = await pool.query(
      `SELECT l.*, 
              t.Ten_tour,
              t.Tinh_trang AS tourTinhTrang,
              h.Ten_huong_dan_vien,
              COALESCE((SELECT SUM(b.So_nguoi_lon + b.So_tre_em)
                        FROM Booking b
                        JOIN Chi_tiet_booking cb ON b.Ma_booking = cb.Ma_booking
                        WHERE cb.Ma_lich = l.Ma_lich 
                          AND ${bookingCondition}
                          AND b.Trang_thai_booking NOT IN ('Da_huy', 'Hủy', 'Het_han')), 0) AS bookedSeats,
              CASE 
                WHEN CURDATE() > l.Ngay_ket_thuc THEN 'Đã diễn ra'
                WHEN CURDATE() >= l.Ngay_bat_dau AND CURDATE() <= l.Ngay_ket_thuc THEN 'Đang diễn ra'
                WHEN l.So_cho - COALESCE((SELECT SUM(b.So_nguoi_lon + b.So_tre_em)
                                          FROM Booking b
                                          JOIN Chi_tiet_booking cb ON b.Ma_booking = cb.Ma_booking
                                          WHERE cb.Ma_lich = l.Ma_lich 
                                            AND ${bookingCondition}
                                            AND b.Trang_thai_booking NOT IN ('Da_huy', 'Hủy', 'Het_han')), 0) > 0 
                THEN 'Còn chỗ'
                ELSE 'Hết chỗ'
              END AS tourStatus
       FROM Lich_khoi_hanh l
       JOIN Tour_du_lich t ON l.Ma_tour = t.Ma_tour
       LEFT JOIN huong_dan_vien h ON l.Ma_huong_dan_vien = h.Ma_huong_dan_vien
       WHERE t.Tinh_trang != 'Hủy'
       ORDER BY l.Ngay_bat_dau DESC`
    );
    return rows;
  }

  /**
   * Delete a schedule
   * @param {string} lichId - Schedule ID
   * @returns {boolean} - Success status
   */
  static async deleteSchedule(lichId) {
    // Check if there are any bookings for this schedule
    const [bookingRows] = await pool.query(
      `SELECT COUNT(*) AS bookingCount
       FROM chi_tiet_booking cb
       JOIN booking b ON cb.Ma_booking = b.Ma_booking
       WHERE cb.Ma_lich = ? AND b.Trang_thai_booking != 'Đã hủy'`,
      [lichId]
    );
    
    if (bookingRows[0].bookingCount > 0) {
      throw new Error('Không thể xóa lịch khởi hành có booking');
    }
    
    const [result] = await pool.query(
      'DELETE FROM lich_khoi_hanh WHERE Ma_lich = ?',
      [lichId]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Get available seats for a schedule
   * @param {string} lichId - Schedule ID
   * @returns {number} - Number of available seats
   */
  static async getAvailableSeats(lichId) {
    // Get total seats
    const [scheduleRows] = await pool.query(
      'SELECT So_cho FROM Lich_khoi_hanh WHERE Ma_lich = ?',
      [lichId]
    );
    
    if (scheduleRows.length === 0) {
      throw new Error('Lịch khởi hành không tồn tại');
    }
    
    const totalSeats = scheduleRows[0].So_cho;
    
    // Kiểm tra xem cột expires_at có tồn tại không
    const [expiresAtColumn] = await pool.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Booking' 
         AND COLUMN_NAME = 'expires_at'`
    );
    const hasExpiresAt = expiresAtColumn.length > 0;
    
    // Get booked seats - tính cả booking "Đã thanh toán" và "Chờ thanh toán" chưa hết hạn
    let bookingQuery;
    if (hasExpiresAt) {
      bookingQuery = `
        SELECT SUM(b.So_nguoi_lon + b.So_tre_em) AS bookedSeats
        FROM Booking b
        JOIN Chi_tiet_booking cb ON b.Ma_booking = cb.Ma_booking
        WHERE cb.Ma_lich = ? 
          AND (
            b.Trang_thai_booking = 'Đã thanh toán'
            OR (
              b.Trang_thai_booking = 'Chờ thanh toán'
              AND (b.expires_at IS NULL OR b.expires_at > NOW())
            )
          )
      `;
    } else {
      bookingQuery = `
        SELECT SUM(b.So_nguoi_lon + b.So_tre_em) AS bookedSeats
        FROM Booking b
        JOIN Chi_tiet_booking cb ON b.Ma_booking = cb.Ma_booking
        WHERE cb.Ma_lich = ? 
          AND (
            b.Trang_thai_booking = 'Đã thanh toán'
            OR (
              b.Trang_thai_booking = 'Chờ thanh toán'
              AND b.Ngay_dat > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
            )
          )
      `;
    }
    
    const [bookingRows] = await pool.query(bookingQuery, [lichId]);
    
    const bookedSeats = bookingRows[0]?.bookedSeats || 0;
    
    return Math.max(0, totalSeats - bookedSeats);
  }

  /**
   * Check if a schedule has enough available seats
   * @param {string} lichId - Schedule ID
   * @param {number} requiredSeats - Number of seats needed
   * @returns {boolean} - True if enough seats available
   */
  static async hasEnoughSeats(lichId, requiredSeats) {
    const availableSeats = await this.getAvailableSeats(lichId);
    return availableSeats >= requiredSeats;
  }

  /**
   * Get upcoming schedules for a tour
   * @param {string} tourId - Tour ID
   * @returns {Array} - List of upcoming schedules
   */
  static async getUpcomingSchedules(tourId) {
    // Bỏ điều kiện lọc theo ngày hiện tại để hiển thị tất cả lịch trình
    // const today = new Date().toISOString().split('T')[0];
    
    // Kiểm tra xem cột expires_at có tồn tại không
    const [expiresAtColumn] = await pool.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Booking' 
         AND COLUMN_NAME = 'expires_at'`
    );
    const hasExpiresAt = expiresAtColumn.length > 0;
    
    // Xây dựng điều kiện WHERE cho booking
    let bookingCondition;
    if (hasExpiresAt) {
      bookingCondition = `
        (b.Trang_thai_booking = 'Đã thanh toán'
        OR (
          b.Trang_thai_booking = 'Chờ thanh toán'
          AND (b.expires_at IS NULL OR b.expires_at > NOW())
        ))
      `;
    } else {
      bookingCondition = `
        (b.Trang_thai_booking = 'Đã thanh toán'
        OR (
          b.Trang_thai_booking = 'Chờ thanh toán'
          AND b.Ngay_dat > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        ))
      `;
    }
    
    // Kiểm tra xem cột Trang_thai có tồn tại không
    const [trangThaiColumn] = await pool.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Lich_khoi_hanh' 
         AND COLUMN_NAME = 'Trang_thai'`
    );
    const hasTrangThai = trangThaiColumn.length > 0;
    
    // Sử dụng LEFT JOIN và GROUP BY thay vì subquery để tính số chỗ đã đặt
    // Tính số chỗ đã đặt bằng cách JOIN và SUM
    // GROUP BY tất cả các cột không phải aggregate từ Lich_khoi_hanh
    // Ẩn các lịch có Trang_thai = 'Đã diễn ra'
    let whereCondition = 'l.Ma_tour = ?';
    if (hasTrangThai) {
      whereCondition += " AND (l.Trang_thai IS NULL OR l.Trang_thai != 'Đã diễn ra')";
    } else {
      // Nếu không có Trang_thai, ẩn các lịch đã kết thúc
      whereCondition += ' AND l.Ngay_ket_thuc >= CURDATE()';
    }
    
    const query = `
      SELECT 
         l.Ma_lich,
         l.Ma_tour,
         l.Ngay_bat_dau,
         l.Ngay_ket_thuc,
         l.So_cho,
         ${hasTrangThai ? 'l.Trang_thai,' : ''}
         -- Số chỗ đã đặt (tính cả booking "Đã thanh toán" và "Chờ thanh toán" chưa hết hạn)
         COALESCE(SUM(
           CASE 
             WHEN ${bookingCondition} 
             THEN (b.So_nguoi_lon + b.So_tre_em)
             ELSE 0
           END
         ), 0) AS bookedSeats,
         -- Số chỗ còn lại tính trực tiếp từ So_cho
         (l.So_cho - COALESCE(SUM(
           CASE 
             WHEN ${bookingCondition} 
             THEN (b.So_nguoi_lon + b.So_tre_em)
             ELSE 0
           END
         ), 0)) AS availableSeats
       FROM Lich_khoi_hanh l
       LEFT JOIN Chi_tiet_booking cb ON cb.Ma_lich = l.Ma_lich
       LEFT JOIN Booking b ON b.Ma_booking = cb.Ma_booking
       WHERE ${whereCondition}
       GROUP BY l.Ma_lich, l.Ma_tour, l.Ngay_bat_dau, l.Ngay_ket_thuc, l.So_cho${hasTrangThai ? ', l.Trang_thai' : ''}
       ORDER BY l.Ngay_bat_dau ASC
    `;
    
    console.log(`🔍 [getUpcomingSchedules] Query for tour ${tourId}`);
    console.log(`🔍 [getUpcomingSchedules] Has expires_at: ${hasExpiresAt}`);
    
    const [rows] = await pool.query(query, [tourId]);
    
    // Log kết quả để debug
    if (rows.length > 0) {
      console.log(`📊 [getUpcomingSchedules] Found ${rows.length} schedules for tour ${tourId}`);
      rows.forEach(schedule => {
        console.log(`  - Schedule ${schedule.Ma_lich}: So_cho=${schedule.So_cho}, bookedSeats=${schedule.bookedSeats}, availableSeats=${schedule.availableSeats}`);
      });
    } else {
      console.log(`⚠️ [getUpcomingSchedules] No schedules found for tour ${tourId}`);
    }
    
    return rows;
  }

  /**
   * Get most popular schedules (most bookings)
   * @param {number} limit - Number of schedules to return
   * @returns {Array} - List of popular schedules
   */
  static async getPopularSchedules(limit = 5) {
    console.log('getPopularSchedules model called with limit:', limit);
    
    try {
      const [rows] = await pool.query(
        `SELECT l.*, t.Ten_tour, t.Hinh_anh,
                t.Gia_nguoi_lon, t.Gia_tre_em,
                IFNULL(COUNT(cb.Ma_booking), 0) AS bookingCount
         FROM lich_khoi_hanh l
         JOIN tour_du_lich t ON l.Ma_tour = t.Ma_tour
         LEFT JOIN chi_tiet_booking cb ON l.Ma_lich = cb.Ma_lich
         LEFT JOIN booking b ON cb.Ma_booking = b.Ma_booking AND b.Trang_thai_booking = 'Đã thanh toán'
         WHERE t.Tinh_trang = 'Còn chỗ'
         GROUP BY l.Ma_lich, t.Ten_tour, t.Hinh_anh, t.Gia_nguoi_lon, t.Gia_tre_em
         ORDER BY bookingCount DESC, l.Ngay_bat_dau ASC
         LIMIT ?`,
        [limit]
      );
      
      console.log(`Found ${rows.length} popular schedules`);
      
      // Xử lý trường hợp không có dữ liệu
      if (rows.length === 0) {
        console.log('No schedules found, trying alternate query');
        // Nếu không có lịch đặt, trả về các lịch sắp tới gần nhất
        const [alternateRows] = await pool.query(
          `SELECT l.*, t.Ten_tour, t.Hinh_anh, 
                  t.Gia_nguoi_lon, t.Gia_tre_em,
                  0 AS bookingCount
           FROM lich_khoi_hanh l
           JOIN tour_du_lich t ON l.Ma_tour = t.Ma_tour
           WHERE t.Tinh_trang = 'Còn chỗ'
           ORDER BY l.Ngay_bat_dau ASC
           LIMIT ?`,
          [limit]
        );
        console.log(`Found ${alternateRows.length} schedules with alternate query`);
        return alternateRows;
      }
      
      return rows;
    } catch (error) {
      console.error('Error in getPopularSchedules model:', error);
      return []; // Trả về mảng rỗng nếu có lỗi
    }
  }

  /**
   * Get featured tours
   * @param {number} limit - Number of tours to return
   * @returns {Array} - Array of featured tour objects
   */
  static async getFeatured(limit = 6) {
    const [rows] = await pool.query(
      'SELECT * FROM tour_du_lich WHERE Tinh_trang = "Còn chỗ" ORDER BY RAND() LIMIT ?',
      [limit]
    );
    return rows;
  }

  /**
   * Search tours
   * @param {Object} filters - Search filters
   * @returns {Array} - Array of matching tour objects
   */
  static async search(filters) {
    let query = 'SELECT * FROM tour_du_lich WHERE 1=1';
    const params = [];

    if (filters.loai_tour) {
      query += ' AND Loai_tour = ?';
      params.push(filters.loai_tour);
    }

    if (filters.tinh_trang) {
      query += ' AND Tinh_trang = ?';
      params.push(filters.tinh_trang);
    }

    if (filters.min_price) {
      query += ' AND Gia_nguoi_lon >= ?';
      params.push(filters.min_price);
    }

    if (filters.max_price) {
      query += ' AND Gia_nguoi_lon <= ?';
      params.push(filters.max_price);
    }

    const [rows] = await pool.query(query, params);
    return rows;
  }
// số chỗ còn lại cập nhậ t theo booking
  /**
   * Update available seats in a schedule
   * @param {string} lichId - Schedule ID
   * @param {number} bookedSeats - Number of seats booked
   * @returns {boolean} - Success status
   */
  static async updateAvailableSeats(lichId, bookedSeats) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Lấy số chỗ hiện tại
        const [currentSchedule] = await pool.query(
          'SELECT So_cho FROM lich_khoi_hanh WHERE Ma_lich = ?',
          [lichId]
        );

        if (!currentSchedule.length) {
          throw new Error('Không tìm thấy lịch khởi hành');
        }

        const currentSeats = currentSchedule[0].So_cho;
        const newSeats = currentSeats - bookedSeats;

        if (newSeats < 0) {
          throw new Error('Số chỗ còn lại không đủ');
        }

        // Cập nhật số chỗ mới với timeout ngắn
        const [result] = await pool.query({
          sql: 'UPDATE lich_khoi_hanh SET So_cho = ? WHERE Ma_lich = ?',
          values: [newSeats, lichId],
          timeout: 5000 // 5 giây timeout
        });

        return result.affectedRows > 0;
      } catch (error) {
        retryCount++;
        console.error(`Error updating available seats (attempt ${retryCount}):`, error);
        
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        // Chờ một chút trước khi retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  /**
   * Check database table structure
   * @returns {Object} - Table information
   */
  static async checkTableStructure() {
    try {
      console.log('==== CHECKING TABLE STRUCTURE ====');
      
      // Kiểm tra cấu trúc bảng
      const [columns] = await pool.query('DESCRIBE tour_du_lich');
      console.log('Table structure:');
      console.table(columns);
      
      // Kiểm tra tour mới nhất
      const [latestTour] = await pool.query('SELECT * FROM tour_du_lich ORDER BY Ma_tour DESC LIMIT 1');
      if (latestTour.length > 0) {
        console.log('Latest tour data:', JSON.stringify(latestTour[0], null, 2));
        
        // Kiểm tra riêng trường Mo_ta
        const [moTaCheck] = await pool.query('SELECT Mo_ta FROM tour_du_lich WHERE Ma_tour = ?', [latestTour[0].Ma_tour]);
        console.log('Direct Mo_ta query result:', JSON.stringify(moTaCheck[0], null, 2));
      } else {
        console.log('No tours found in database');
      }
      
      console.log('================================');
      return { columns, latestTour: latestTour[0] };
    } catch (error) {
      console.error('Error checking table structure:', error);
      throw error;
    }
  }
}

module.exports = Tour;