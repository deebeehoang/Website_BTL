const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Helper function to ensure Tour_KhuyenMai table exists
async function ensureTourKhuyenMaiTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS Tour_KhuyenMai (
    Ma_tour VARCHAR(50) NOT NULL,
    Ma_km VARCHAR(50) NOT NULL,
    PRIMARY KEY (Ma_tour, Ma_km),
    FOREIGN KEY (Ma_tour) REFERENCES Tour_du_lich(Ma_tour),
    FOREIGN KEY (Ma_km) REFERENCES khuyen_mai(Ma_km)
  )`);
}

// ===== ADMIN CRUD OPERATIONS =====

// Get all promotions (admin)
router.get('/admin/all', async (req, res) => {
  try {
    await ensureTourKhuyenMaiTable();
    
    const [rows] = await pool.query(`
      SELECT km.*, 
             COUNT(tk.Ma_tour) as so_tour_ap_dung,
             GROUP_CONCAT(tk.Ma_tour) as danh_sach_tour
      FROM khuyen_mai km
      LEFT JOIN Tour_KhuyenMai tk ON km.Ma_km = tk.Ma_km
      GROUP BY km.Ma_km
      ORDER BY km.Ngay_bat_dau DESC
    `);
    res.json({ success: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get promotion statistics (admin)
router.get('/admin/stats', async (req, res) => {
  try {
    await ensureTourKhuyenMaiTable();
    
    const [usageStats] = await pool.query(`
      SELECT 
        km.Ma_km,
        km.Ten_km,
        km.Gia_tri,
        COUNT(b.Ma_booking) as so_luot_su_dung,
        COALESCE(SUM(b.Tong_tien), 0) as tong_doanh_thu,
        COALESCE(SUM(b.Tong_tien * km.Gia_tri / 100), 0) as tong_giam_gia
      FROM khuyen_mai km
      LEFT JOIN Booking b ON b.Ma_khuyen_mai = km.Ma_km
      GROUP BY km.Ma_km
    `);
    
    const [totalStats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT km.Ma_km) as tong_so_km,
        COUNT(DISTINCT b.Ma_booking) as tong_so_booking,
        COALESCE(SUM(b.Tong_tien), 0) as tong_doanh_thu,
        COALESCE(SUM(b.Tong_tien * km.Gia_tri / 100), 0) as tong_giam_gia
      FROM khuyen_mai km
      LEFT JOIN Booking b ON b.Ma_khuyen_mai = km.Ma_km
    `);
    
    res.json({ 
      success: true, 
      data: {
        usageStats,
        totalStats: totalStats[0]
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Create or update a global site-wide percent discount
router.post('/global', async (req, res) => {
  try {
    const { Ma_km, Ten_km, Mo_ta, Gia_tri, Ngay_bat_dau, Ngay_ket_thuc } = req.body;
    if (!Gia_tri) return res.status(400).json({ error: 'Thiếu Gia_tri (%)' });
    const code = Ma_km || 'GLOBAL_PERCENT';
    
    // Try update first, then insert if not exists
    const [upd] = await pool.query(
      `UPDATE khuyen_mai SET Ten_km=?, Mo_ta=?, Gia_tri=?, Ngay_bat_dau=?, Ngay_ket_thuc=? WHERE Ma_km=?`,
      [Ten_km || 'Giảm giá toàn site', Mo_ta || 'Giảm theo % toàn site', Gia_tri, Ngay_bat_dau || null, Ngay_ket_thuc || null, code]
    );
    
    if (upd.affectedRows === 0) {
      await pool.query(
        `INSERT INTO khuyen_mai (Ma_km, Ten_km, Mo_ta, Gia_tri, Ngay_bat_dau, Ngay_ket_thuc)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [code, Ten_km || 'Giảm giá toàn site', Mo_ta || 'Giảm theo % toàn site', Gia_tri, Ngay_bat_dau || null, Ngay_ket_thuc || null]
      );
    }
    
    res.json({ success: true, message: 'Cập nhật giảm giá toàn site thành công' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Create/update a coupon (percent) by code
router.post('/coupon', async (req, res) => {
  try {
    const { Ma_km, Ten_km, Mo_ta, Gia_tri, Ngay_bat_dau, Ngay_ket_thuc } = req.body;
    if (!Ma_km || !Gia_tri) return res.status(400).json({ error: 'Thiếu Ma_km hoặc Gia_tri' });
    
    // Try update first, then insert if not exists
    const [upd] = await pool.query(
      `UPDATE khuyen_mai SET Ten_km=?, Mo_ta=?, Gia_tri=?, Ngay_bat_dau=?, Ngay_ket_thuc=? WHERE Ma_km=?`,
      [Ten_km || Ma_km, Mo_ta || 'Coupon giảm theo %', Gia_tri, Ngay_bat_dau || null, Ngay_ket_thuc || null, Ma_km]
    );
    
    if (upd.affectedRows === 0) {
      await pool.query(
        `INSERT INTO khuyen_mai (Ma_km, Ten_km, Mo_ta, Gia_tri, Ngay_bat_dau, Ngay_ket_thuc) VALUES (?, ?, ?, ?, ?, ?)`,
        [Ma_km, Ten_km || Ma_km, Mo_ta || 'Coupon giảm theo %', Gia_tri, Ngay_bat_dau || null, Ngay_ket_thuc || null]
      );
    }
    
    res.json({ success: true, message: 'Cập nhật coupon thành công' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Update promotion
router.put('/:ma_km', async (req, res) => {
  try {
    const { ma_km } = req.params;
    const { Ten_km, Mo_ta, Gia_tri, Ngay_bat_dau, Ngay_ket_thuc } = req.body;
    
    const [result] = await pool.query(
      `UPDATE khuyen_mai SET Ten_km=?, Mo_ta=?, Gia_tri=?, Ngay_bat_dau=?, Ngay_ket_thuc=? WHERE Ma_km=?`,
      [Ten_km, Mo_ta, Gia_tri, Ngay_bat_dau, Ngay_ket_thuc, ma_km]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy khuyến mãi' });
    }
    
    res.json({ success: true, message: 'Cập nhật khuyến mãi thành công' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Delete/Hide promotion
router.delete('/:ma_km', async (req, res) => {
  try {
    const { ma_km } = req.params;
    
    // Check if promotion is being used in bookings
    const [bookings] = await pool.query(
      `SELECT COUNT(*) as count FROM Booking WHERE Ma_khuyen_mai = ?`,
      [ma_km]
    );
    
    if (bookings[0].count > 0) {
      return res.status(400).json({ 
        error: 'Không thể xóa khuyến mãi đã được sử dụng trong đơn hàng. Vui lòng ẩn thay vì xóa.' 
      });
    }
    
    // Remove from tour mappings first
    await ensureTourKhuyenMaiTable();
    await pool.query(`DELETE FROM Tour_KhuyenMai WHERE Ma_km = ?`, [ma_km]);
    
    // Delete the promotion
    const [result] = await pool.query(`DELETE FROM khuyen_mai WHERE Ma_km = ?`, [ma_km]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy khuyến mãi' });
    }
    
    res.json({ success: true, message: 'Xóa khuyến mãi thành công' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Hide promotion (set end date to past)
router.put('/:ma_km/hide', async (req, res) => {
  try {
    const { ma_km } = req.params;
    
    const [result] = await pool.query(
      `UPDATE khuyen_mai SET Ngay_ket_thuc = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE Ma_km = ?`,
      [ma_km]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Không tìm thấy khuyến mãi' });
    }
    
    res.json({ success: true, message: 'Ẩn khuyến mãi thành công' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Attach a coupon to a tour (store mapping table if not exists)
router.post('/attach-to-tour', async (req, res) => {
  try {
    const { Ma_tour, Ma_km } = req.body;
    if (!Ma_tour || !Ma_km) return res.status(400).json({ error: 'Thiếu Ma_tour hoặc Ma_km' });
    
    // Kiểm tra tour có tồn tại không
    const [tourExists] = await pool.query('SELECT Ma_tour FROM Tour_du_lich WHERE Ma_tour = ?', [Ma_tour]);
    if (tourExists.length === 0) {
      return res.status(404).json({ error: `Tour ${Ma_tour} không tồn tại` });
    }
    
    // Kiểm tra coupon có tồn tại không
    const [couponExists] = await pool.query('SELECT Ma_km FROM khuyen_mai WHERE Ma_km = ?', [Ma_km]);
    if (couponExists.length === 0) {
      return res.status(404).json({ error: `Coupon ${Ma_km} không tồn tại` });
    }
    
    await ensureTourKhuyenMaiTable();
    
    await pool.query(`REPLACE INTO Tour_KhuyenMai (Ma_tour, Ma_km) VALUES (?, ?)`, [Ma_tour, Ma_km]);
    res.json({ success: true, message: 'Gắn coupon vào tour thành công' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Remove coupon from tour
router.delete('/detach-from-tour', async (req, res) => {
  try {
    const { Ma_tour, Ma_km } = req.body;
    if (!Ma_tour || !Ma_km) return res.status(400).json({ error: 'Thiếu Ma_tour hoặc Ma_km' });
    
    await ensureTourKhuyenMaiTable();
    
    const [result] = await pool.query(
      `DELETE FROM Tour_KhuyenMai WHERE Ma_tour = ? AND Ma_km = ?`,
      [Ma_tour, Ma_km]
    );
    
    res.json({ success: true, message: 'Gỡ coupon khỏi tour thành công' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ===== CUSTOMER OPERATIONS =====

// Get all active promotions for customers
router.get('/customer/active', async (req, res) => {
  try {
    await ensureTourKhuyenMaiTable();
    
    const [rows] = await pool.query(`
      SELECT km.*, 
             GROUP_CONCAT(t.Ten_tour) as danh_sach_tour,
             CASE 
               WHEN km.Ma_km = 'GLOBAL_PERCENT' THEN 'Toàn site'
               ELSE 'Tour cụ thể'
             END as loai_ap_dung
      FROM khuyen_mai km
      LEFT JOIN Tour_KhuyenMai tk ON km.Ma_km = tk.Ma_km
      LEFT JOIN Tour_du_lich t ON tk.Ma_tour = t.Ma_tour
      WHERE (km.Ngay_bat_dau IS NULL OR km.Ngay_bat_dau <= NOW())
        AND (km.Ngay_ket_thuc IS NULL OR km.Ngay_ket_thuc >= NOW())
      GROUP BY km.Ma_km
      ORDER BY km.Gia_tri DESC
    `);
    
    res.json({ success: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Validate coupon code
router.get('/validate/:ma_km', async (req, res) => {
  try {
    const { ma_km } = req.params;
    
    const [rows] = await pool.query(`
      SELECT km.*, 
             CASE 
               WHEN km.Ma_km = 'GLOBAL_PERCENT' THEN 'Toàn site'
               ELSE 'Tour cụ thể'
             END as loai_ap_dung
      FROM khuyen_mai km
      WHERE km.Ma_km = ?
        AND (km.Ngay_bat_dau IS NULL OR km.Ngay_bat_dau <= NOW())
        AND (km.Ngay_ket_thuc IS NULL OR km.Ngay_ket_thuc >= NOW())
    `, [ma_km]);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mã khuyến mãi không hợp lệ hoặc đã hết hạn' 
      });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get applicable discount for a tour (global + coupon)
router.get('/applicable/:ma_tour', async (req, res) => {
  try {
    const { ma_tour } = req.params;
    
    await ensureTourKhuyenMaiTable();
    
    // Get global discount
    const [globalRows] = await pool.query(`
      SELECT * FROM khuyen_mai 
      WHERE Ma_km = 'GLOBAL_PERCENT'
        AND (Ngay_bat_dau IS NULL OR Ngay_bat_dau <= NOW())
        AND (Ngay_ket_thuc IS NULL OR Ngay_ket_thuc >= NOW())
    `);
    
    // Get tour-specific coupon
    const [tourKm] = await pool.query(`
      SELECT km.* FROM Tour_KhuyenMai tk 
      JOIN khuyen_mai km ON tk.Ma_km = km.Ma_km 
      WHERE tk.Ma_tour = ?
        AND (km.Ngay_bat_dau IS NULL OR km.Ngay_bat_dau <= NOW())
        AND (km.Ngay_ket_thuc IS NULL OR km.Ngay_ket_thuc >= NOW())
    `, [ma_tour]);
    
    res.json({ 
      success: true, 
      data: {
        global: globalRows[0] || null, 
        coupon: tourKm[0] || null 
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

