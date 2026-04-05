const pool = require('../config/database');

/**
 * Tour Itinerary Model
 */
class TourItinerary {
  /**
   * Lấy danh sách lịch trình theo Ma_tour
   * @param {string} maTour - Mã tour
   * @returns {Array} - Danh sách lịch trình
   */
  static async getByTourId(maTour) {
    try {
      const [rows] = await pool.query(
        `SELECT * FROM tour_itinerary 
         WHERE Ma_tour = ? AND (Ma_lich IS NULL OR Ma_lich = '')
         ORDER BY Ngay_thu ASC`,
        [maTour]
      );
      return rows;
    } catch (error) {
      console.error('Error getting itinerary by tour ID:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách lịch trình theo Ma_lich (lịch khởi hành)
   * @param {string} maLich - Mã lịch khởi hành
   * @returns {Array} - Danh sách lịch trình
   */
  static async getByScheduleId(maLich) {
    try {
      // Kiểm tra xem cột Ma_lich có tồn tại không
      const [columns] = await pool.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'tour_itinerary' 
           AND COLUMN_NAME = 'Ma_lich'`
      );
      
      if (columns.length === 0) {
        // Cột chưa tồn tại, trả về mảng rỗng
        console.warn('Cột Ma_lich chưa tồn tại trong bảng tour_itinerary. Vui lòng chạy migration SQL.');
        return [];
      }
      
      const [rows] = await pool.query(
        `SELECT * FROM tour_itinerary 
         WHERE Ma_lich = ? 
         ORDER BY Ngay_thu ASC`,
        [maLich]
      );
      return rows;
    } catch (error) {
      console.error('Error getting itinerary by schedule ID:', error);
      // Nếu lỗi do cột không tồn tại, trả về mảng rỗng thay vì throw error
      if (error.code === 'ER_BAD_FIELD_ERROR' && error.sqlMessage && error.sqlMessage.includes('Ma_lich')) {
        console.warn('Cột Ma_lich chưa tồn tại. Vui lòng chạy migration SQL: src/database/add_ma_lich_to_itinerary.sql');
        return [];
      }
      throw error;
    }
  }

  /**
   * Lấy một ngày cụ thể theo Ma_itinerary
   * @param {number} maItinerary - Mã itinerary
   * @returns {Object|null} - Thông tin ngày hoặc null
   */
  static async getById(maItinerary) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM tour_itinerary WHERE Ma_itinerary = ?',
        [maItinerary]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error getting itinerary by ID:', error);
      throw error;
    }
  }

  /**
   * Tạo một ngày mới trong lịch trình
   * @param {string} maTour - Mã tour
   * @param {Object} itineraryData - Dữ liệu lịch trình
   * @returns {Object} - Thông tin ngày vừa tạo
   */
  static async create(maTour, itineraryData) {
    try {
      const { Ngay_thu, Tieu_de, Mo_ta, Thoi_gian_hoat_dong, Dia_diem, Ma_lich } = itineraryData;

      // Validate
      if (!Ngay_thu || !Tieu_de) {
        throw new Error('Ngay_thu và Tieu_de là bắt buộc');
      }

      // Kiểm tra xem cột Ma_lich có tồn tại không
      const [columns] = await pool.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'tour_itinerary' 
           AND COLUMN_NAME = 'Ma_lich'`
      );
      const hasMaLichColumn = columns.length > 0;

      // Kiểm tra xem ngày đã tồn tại chưa (theo tour hoặc lịch khởi hành)
      let existingQuery, existingParams;
      if (hasMaLichColumn && Ma_lich) {
        existingQuery = 'SELECT Ma_itinerary FROM tour_itinerary WHERE Ma_tour = ? AND Ma_lich = ? AND Ngay_thu = ?';
        existingParams = [maTour, Ma_lich, Ngay_thu];
      } else {
        existingQuery = 'SELECT Ma_itinerary FROM tour_itinerary WHERE Ma_tour = ? AND (Ma_lich IS NULL OR Ma_lich = \'\') AND Ngay_thu = ?';
        existingParams = [maTour, Ngay_thu];
      }

      const [existing] = await pool.query(existingQuery, existingParams);

      if (existing.length > 0) {
        throw new Error(`Ngày ${Ngay_thu} đã tồn tại cho ${Ma_lich ? 'lịch khởi hành này' : 'tour này'}`);
      }

      // Tạo INSERT query dựa trên việc cột Ma_lich có tồn tại hay không
      let insertQuery, insertParams;
      if (hasMaLichColumn) {
        insertQuery = `INSERT INTO tour_itinerary 
         (Ma_tour, Ma_lich, Ngay_thu, Tieu_de, Mo_ta, Thoi_gian_hoat_dong, Dia_diem) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`;
        insertParams = [maTour, Ma_lich || null, Ngay_thu, Tieu_de, Mo_ta || null, Thoi_gian_hoat_dong || null, Dia_diem || null];
      } else {
        // Fallback: không có cột Ma_lich, chỉ insert các cột cơ bản
        insertQuery = `INSERT INTO tour_itinerary 
         (Ma_tour, Ngay_thu, Tieu_de, Mo_ta, Thoi_gian_hoat_dong, Dia_diem) 
         VALUES (?, ?, ?, ?, ?, ?)`;
        insertParams = [maTour, Ngay_thu, Tieu_de, Mo_ta || null, Thoi_gian_hoat_dong || null, Dia_diem || null];
      }

      const [result] = await pool.query(insertQuery, insertParams);

      const newItinerary = await TourItinerary.getById(result.insertId);
      return newItinerary;
    } catch (error) {
      console.error('Error creating itinerary:', error);
      throw error;
    }
  }

  /**
   * Cập nhật thông tin một ngày
   * @param {number} maItinerary - Mã itinerary
   * @param {Object} itineraryData - Dữ liệu cập nhật
   * @returns {Object} - Thông tin ngày sau khi cập nhật
   */
  static async update(maItinerary, itineraryData) {
    try {
      const { Tieu_de, Mo_ta, Ngay_thu, Thoi_gian_hoat_dong, Dia_diem } = itineraryData;

      // Kiểm tra xem itinerary có tồn tại không
      const existing = await TourItinerary.getById(maItinerary);
      if (!existing) {
        throw new Error('Không tìm thấy lịch trình');
      }

      // Nếu thay đổi Ngay_thu, kiểm tra xung đột
      if (Ngay_thu && Ngay_thu !== existing.Ngay_thu) {
        // Kiểm tra xem cột Ma_lich có tồn tại không
        const [columns] = await pool.query(
          `SELECT COLUMN_NAME 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'tour_itinerary' 
             AND COLUMN_NAME = 'Ma_lich'`
        );
        const hasMaLichColumn = columns.length > 0;
        
        let conflictQuery, conflictParams;
        if (hasMaLichColumn && existing.Ma_lich) {
          // Kiểm tra xung đột trong cùng lịch khởi hành
          conflictQuery = 'SELECT Ma_itinerary FROM tour_itinerary WHERE Ma_tour = ? AND Ma_lich = ? AND Ngay_thu = ? AND Ma_itinerary != ?';
          conflictParams = [existing.Ma_tour, existing.Ma_lich, Ngay_thu, maItinerary];
        } else {
          // Kiểm tra xung đột trong cùng tour (không có Ma_lich hoặc Ma_lich là NULL)
          conflictQuery = 'SELECT Ma_itinerary FROM tour_itinerary WHERE Ma_tour = ? AND (Ma_lich IS NULL OR Ma_lich = \'\') AND Ngay_thu = ? AND Ma_itinerary != ?';
          conflictParams = [existing.Ma_tour, Ngay_thu, maItinerary];
        }
        
        const [conflict] = await pool.query(conflictQuery, conflictParams);

        if (conflict.length > 0) {
          throw new Error(`Ngày ${Ngay_thu} đã tồn tại cho ${existing.Ma_lich ? 'lịch khởi hành này' : 'tour này'}`);
        }
      }

      const updateFields = [];
      const updateValues = [];

      if (Tieu_de !== undefined) {
        updateFields.push('Tieu_de = ?');
        updateValues.push(Tieu_de);
      }
      if (Mo_ta !== undefined) {
        updateFields.push('Mo_ta = ?');
        updateValues.push(Mo_ta);
      }
      if (Ngay_thu !== undefined) {
        updateFields.push('Ngay_thu = ?');
        updateValues.push(Ngay_thu);
      }
      if (Thoi_gian_hoat_dong !== undefined) {
        updateFields.push('Thoi_gian_hoat_dong = ?');
        updateValues.push(Thoi_gian_hoat_dong);
      }
      if (Dia_diem !== undefined) {
        updateFields.push('Dia_diem = ?');
        updateValues.push(Dia_diem);
      }

      if (updateFields.length === 0) {
        throw new Error('Không có dữ liệu để cập nhật');
      }

      updateValues.push(maItinerary);

      console.log('📝 [ITINERARY MODEL] Updating itinerary:', maItinerary);
      console.log('📝 [ITINERARY MODEL] Update fields:', updateFields);
      console.log('📝 [ITINERARY MODEL] Update values:', updateValues);
      
      const [result] = await pool.query(
        `UPDATE tour_itinerary 
         SET ${updateFields.join(', ')} 
         WHERE Ma_itinerary = ?`,
        updateValues
      );
      
      console.log('📝 [ITINERARY MODEL] Update result:', result);
      console.log('📝 [ITINERARY MODEL] Affected rows:', result.affectedRows);
      console.log('📝 [ITINERARY MODEL] Changed rows:', result.changedRows);

      const updated = await TourItinerary.getById(maItinerary);
      console.log('📝 [ITINERARY MODEL] Updated data:', updated);
      return updated;
    } catch (error) {
      console.error('Error updating itinerary:', error);
      throw error;
    }
  }

  /**
   * Xóa một ngày
   * @param {number} maItinerary - Mã itinerary
   * @returns {boolean} - Thành công hay không
   */
  static async delete(maItinerary) {
    try {
      const [result] = await pool.query(
        'DELETE FROM tour_itinerary WHERE Ma_itinerary = ?',
        [maItinerary]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting itinerary:', error);
      throw error;
    }
  }

  /**
   * Tự động tạo các ngày mặc định dựa trên số ngày tour
   * @param {string} maTour - Mã tour
   * @param {number} numberOfDays - Số ngày tour
   * @returns {Array} - Danh sách các ngày đã tạo
   */
  static async autoGenerateByTourDays(maTour, numberOfDays) {
    try {
      // Kiểm tra xem tour có tồn tại không
      const [tourRows] = await pool.query(
        'SELECT Ma_tour, Ten_tour, Thoi_gian FROM Tour_du_lich WHERE Ma_tour = ?',
        [maTour]
      );

      if (tourRows.length === 0) {
        throw new Error('Không tìm thấy tour');
      }

      const tour = tourRows[0];
      const days = numberOfDays || tour.Thoi_gian || 1;

      // Xóa các ngày cũ nếu có
      await pool.query('DELETE FROM tour_itinerary WHERE Ma_tour = ?', [maTour]);

      const createdDays = [];

      // Tạo các ngày mặc định
      for (let i = 1; i <= days; i++) {
        const [result] = await pool.query(
          `INSERT INTO tour_itinerary 
           (Ma_tour, Ngay_thu, Tieu_de, Mo_ta) 
           VALUES (?, ?, ?, ?)`,
          [
            maTour,
            i,
            `Ngày ${i}: ${tour.Ten_tour || 'Hoạt động'}`,
            `Mô tả chi tiết cho ngày ${i} của tour ${tour.Ten_tour || maTour}. Vui lòng cập nhật thông tin chi tiết.`
          ]
        );

        const newDay = await TourItinerary.getById(result.insertId);
        createdDays.push(newDay);
      }

      return createdDays;
    } catch (error) {
      console.error('Error auto-generating itinerary:', error);
      throw error;
    }
  }

  /**
   * Xóa tất cả lịch trình của một tour
   * @param {string} maTour - Mã tour
   * @returns {boolean} - Thành công hay không
   */
  static async deleteByTourId(maTour) {
    try {
      const [result] = await pool.query(
        'DELETE FROM tour_itinerary WHERE Ma_tour = ?',
        [maTour]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting itinerary by tour ID:', error);
      throw error;
    }
  }

  /**
   * Cập nhật thứ tự các ngày (reorder)
   * @param {Array} itineraryIds - Mảng các Ma_itinerary theo thứ tự mới
   * @returns {boolean} - Thành công hay không
   */
  static async reorder(itineraryIds) {
    try {
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        for (let i = 0; i < itineraryIds.length; i++) {
          await connection.query(
            'UPDATE tour_itinerary SET Ngay_thu = ? WHERE Ma_itinerary = ?',
            [i + 1, itineraryIds[i]]
          );
        }

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error reordering itinerary:', error);
      throw error;
    }
  }
}

module.exports = TourItinerary;

