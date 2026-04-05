const pool = require('../config/database');

class Ticket {
  /**
   * Get all tickets
   */
  static async getAll() {
    const [rows] = await pool.query('SELECT * FROM Ve');
    return rows;
  }

  /**
   * Get ticket by ID (So_ve)
   */
  static async getById(id) {
    const [rows] = await pool.query(
      'SELECT * FROM Ve WHERE So_ve = ?',
      [id]
    );
    return rows.length ? rows[0] : null;
  }

  /**
   * Delete ticket by ID
   */
  static async delete(id) {
    const [result] = await pool.query(
      'DELETE FROM Ve WHERE So_ve = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Get tickets by booking ID
   * @param {string} bookingId - Booking ID
   * @returns {Array} - List of tickets for booking
   */
  static async getByBookingId(bookingId) {
    const [rows] = await pool.query(
      'SELECT * FROM Ve WHERE Ma_booking = ?',
      [bookingId]
    );
    return rows;
  }

  /**
   * Update ticket price and status
   * @param {string} id - Ticket ID (So_ve)
   * @param {Object} ticketData - { gia_ve, trang_thai_ve }
   * @returns {Object} - Updated ticket
   */
  static async update(id, ticketData) {
    const { gia_ve, trang_thai_ve } = ticketData;
    
    // Tạo query động dựa trên các trường được cung cấp
    let fields = [];
    let values = [];
    
    if (gia_ve !== undefined) {
      fields.push('Gia_ve = ?');
      values.push(gia_ve);
    }
    
    if (trang_thai_ve !== undefined) {
      fields.push('Trang_thai_ve = ?');
      values.push(trang_thai_ve);
    }
    
    if (fields.length === 0) {
      return await this.getById(id); // Không có trường nào cần cập nhật
    }
    
    // Thêm ID vé vào cuối mảng values
    values.push(id);
    
    await pool.query(
      `UPDATE Ve SET ${fields.join(', ')} WHERE So_ve = ?`,
      values
    );
    
    return await this.getById(id);
  }
  
  /**
   * Update ticket status
   * @param {string} id - Ticket ID (So_ve)
   * @param {string} status - New status ('Chua_su_dung', 'Da_su_dung', 'Da_huy')
   * @returns {Object} - Updated ticket
   */
  static async updateStatus(id, status) {
    if (!['Chua_su_dung', 'Da_su_dung', 'Da_huy'].includes(status)) {
      throw new Error('Invalid ticket status');
    }
    
    await pool.query(
      'UPDATE Ve SET Trang_thai_ve = ? WHERE So_ve = ?',
      [status, id]
    );
    
    return await this.getById(id);
  }

  /**
   * Tự động cập nhật trạng thái vé dựa trên ngày kết thúc của lịch khởi hành
   * Cập nhật vé từ "Chua_su_dung" thành "Da_su_dung" nếu ngày kết thúc đã qua
   * @returns {Object} - { updated: number, tickets: Array } - Số lượng vé đã cập nhật và danh sách vé
   */
  static async autoUpdateExpiredTickets() {
    try {
      console.log('🎫 [TICKET UPDATE] Bắt đầu kiểm tra vé đã hết hạn...');
      
      // Lấy ngày hiện tại để debug (dùng backticks cho current_date vì là từ khóa dự trữ)
      const [currentDate] = await pool.query('SELECT CURDATE() as `current_date`, NOW() as current_datetime');
      console.log('📅 [TICKET UPDATE] Ngày hiện tại:', currentDate[0]['current_date'], 'Thời gian:', currentDate[0].current_datetime);
      
      // Lấy tất cả vé có trạng thái "Chua_su_dung" và lịch khởi hành đã kết thúc
      // Sử dụng <= để bao gồm cả ngày hôm nay nếu đã qua
      const [tickets] = await pool.query(
        `SELECT 
          v.So_ve,
          v.Ma_booking,
          v.Ma_lich,
          v.Trang_thai_ve,
          l.Ngay_ket_thuc,
          DATE(l.Ngay_ket_thuc) as Ngay_ket_thuc_date,
          CURDATE() as Ngay_hien_tai
        FROM Ve v
        JOIN Lich_khoi_hanh l ON v.Ma_lich = l.Ma_lich
        WHERE v.Trang_thai_ve = 'Chua_su_dung'
          AND DATE(l.Ngay_ket_thuc) <= CURDATE()`
      );

      console.log(`🔍 [TICKET UPDATE] Tìm thấy ${tickets.length} vé cần cập nhật`);
      
      if (tickets.length > 0) {
        console.log('📋 [TICKET UPDATE] Danh sách vé cần cập nhật:');
        tickets.forEach(t => {
          console.log(`  - Vé ${t.So_ve} (Lịch: ${t.Ma_lich}, Ngày kết thúc: ${t.Ngay_ket_thuc})`);
        });
      }

      if (tickets.length === 0) {
        console.log('✅ [TICKET UPDATE] Không có vé nào cần cập nhật');
        return { updated: 0, tickets: [] };
      }

      // Cập nhật trạng thái tất cả vé đã hết hạn
      const ticketIds = tickets.map(t => t.So_ve);
      const placeholders = ticketIds.map(() => '?').join(',');
      
      const [result] = await pool.query(
        `UPDATE Ve 
         SET Trang_thai_ve = 'Da_su_dung' 
         WHERE So_ve IN (${placeholders}) 
           AND Trang_thai_ve = 'Chua_su_dung'`,
        ticketIds
      );

      console.log(`✅ [TICKET UPDATE] Đã tự động cập nhật ${result.affectedRows} vé từ "Chưa sử dụng" thành "Đã sử dụng"`);

      return {
        updated: result.affectedRows,
        tickets: tickets.map(t => ({
          So_ve: t.So_ve,
          Ma_booking: t.Ma_booking,
          Ma_lich: t.Ma_lich,
          Ngay_ket_thuc: t.Ngay_ket_thuc
        }))
      };
    } catch (error) {
      console.error('❌ [TICKET UPDATE] Lỗi khi tự động cập nhật trạng thái vé:', error);
      throw error;
    }
  }
}

module.exports = Ticket;