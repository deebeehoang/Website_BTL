const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { v4: uuidv4 } = require("uuid");

// ============================================
// 🟩 LẤY DANH SÁCH KHÁCH ĐÃ NHẮN TIN (ADMIN)
// ============================================
router.get("/users/list", async (req, res) => {
  const adminId = req.query.adminId || null;
  const unreadToClause = adminId
    ? `tn4.Id_nguoi_nhan = ?`
    : `tn4.Id_nguoi_nhan IN (SELECT tk2.Id_user FROM Tai_khoan tk2 WHERE tk2.Loai_tai_khoan = 'Admin')`;

  const sql = `
    SELECT 
      t.partner_id AS Id_user,
      kh.Ten_khach_hang,
      tk.Email,
      tk.anh_dai_dien,
      (
        SELECT tn2.Noi_dung 
        FROM Tin_nhan tn2 
        WHERE (tn2.Id_nguoi_gui = t.partner_id OR tn2.Id_nguoi_nhan = t.partner_id)
        ORDER BY tn2.Thoi_gian DESC 
        LIMIT 1
      ) AS last_message,
      (
        SELECT tn3.Thoi_gian 
        FROM Tin_nhan tn3 
        WHERE (tn3.Id_nguoi_gui = t.partner_id OR tn3.Id_nguoi_nhan = t.partner_id)
        ORDER BY tn3.Thoi_gian DESC 
        LIMIT 1
      ) AS last_message_time,
      (
        SELECT COUNT(*) 
        FROM Tin_nhan tn4 
        WHERE tn4.Id_nguoi_gui = t.partner_id 
          AND ${unreadToClause}
          AND tn4.Da_doc = 0
      ) AS unread_count
    FROM (
      SELECT DISTINCT 
        CASE 
          WHEN tn.Id_nguoi_gui IN (SELECT tk1.Id_user FROM Tai_khoan tk1 WHERE tk1.Loai_tai_khoan = 'Admin') THEN tn.Id_nguoi_nhan
          ELSE tn.Id_nguoi_gui
        END AS partner_id
      FROM Tin_nhan tn
    ) t
    JOIN Tai_khoan tk ON tk.Id_user = t.partner_id
    LEFT JOIN Khach_hang kh ON kh.Id_user = t.partner_id
    ORDER BY last_message_time DESC;
  `;

  try {
    const params = adminId ? [adminId] : [];
    const [results] = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    console.error("❌ Lỗi truy vấn danh sách người dùng:", err);
    return res.status(500).json({ 
      error: "Không thể tải danh sách người dùng.",
      details: err.message 
    });
  }
});

// ============================================
// 🟩 LẤY LỊCH SỬ TIN NHẮN CỦA USER
// ============================================
router.get("/history/:userId", async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({ error: "Thiếu userId." });
  }

  let sql = "";
  let params = [];

  if (userId === "admin01" || userId.toLowerCase().includes("admin")) {
    // Admin xem tất cả tin nhắn
    sql = `
      SELECT tn.*, 
        COALESCE(kh.Ten_khach_hang, tn.Id_nguoi_gui) AS Ten_nguoi_gui,
        COALESCE(kh2.Ten_khach_hang, tn.Id_nguoi_nhan) AS Ten_nguoi_nhan
      FROM Tin_nhan tn
      LEFT JOIN Khach_hang kh ON kh.Id_user = tn.Id_nguoi_gui
      LEFT JOIN Khach_hang kh2 ON kh2.Id_user = tn.Id_nguoi_nhan
      ORDER BY tn.Thoi_gian ASC
    `;
  } else {
    // Khách → chỉ xem giữa mình và admin (admin01)
    sql = `
      SELECT tn.*, 
        COALESCE(kh.Ten_khach_hang, tn.Id_nguoi_gui) AS Ten_nguoi_gui,
        COALESCE(kh2.Ten_khach_hang, tn.Id_nguoi_nhan) AS Ten_nguoi_nhan
      FROM Tin_nhan tn
      LEFT JOIN Khach_hang kh ON kh.Id_user = tn.Id_nguoi_gui
      LEFT JOIN Khach_hang kh2 ON kh2.Id_user = tn.Id_nguoi_nhan
      WHERE (Id_nguoi_gui = ? AND Id_nguoi_nhan = 'admin01')
         OR (Id_nguoi_nhan = ? AND Id_nguoi_gui = 'admin01')
      ORDER BY tn.Thoi_gian ASC
    `;
    params = [userId, userId];
  }

  try {
    const [results] = await db.query(sql, params);
    res.json(results);
  } catch (err) {
    console.error("❌ Lỗi truy vấn tin nhắn:", err);
    return res.status(500).json({ 
      error: "Lỗi máy chủ khi truy vấn tin nhắn.",
      details: err.message 
    });
  }
});

// ============================================
// 🟩 LẤY CUỘC TRÒ CHUYỆN GIỮA 2 USER
// ============================================
router.get("/conversation/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;

  if (!user1 || !user2) {
    return res.status(400).json({ error: "Thiếu thông tin người dùng." });
  }

  const sql = `
    SELECT tn.*, 
      COALESCE(kh.Ten_khach_hang, tn.Id_nguoi_gui) AS Ten_nguoi_gui,
      COALESCE(kh2.Ten_khach_hang, tn.Id_nguoi_nhan) AS Ten_nguoi_nhan
    FROM Tin_nhan tn
    LEFT JOIN Khach_hang kh ON kh.Id_user = tn.Id_nguoi_gui
    LEFT JOIN Khach_hang kh2 ON kh2.Id_user = tn.Id_nguoi_nhan
    WHERE (Id_nguoi_gui = ? AND Id_nguoi_nhan = ?) 
       OR (Id_nguoi_gui = ? AND Id_nguoi_nhan = ?)
    ORDER BY tn.Thoi_gian ASC
  `;

  try {
    const [results] = await db.query(sql, [user1, user2, user2, user1]);
    res.json(results);
  } catch (err) {
    console.error("❌ Lỗi truy vấn cuộc trò chuyện:", err);
    return res.status(500).json({ 
      error: "Không thể tải cuộc trò chuyện.",
      details: err.message 
    });
  }
});

// ============================================
// 🟩 GỬI TIN NHẮN (VIA API - BACKUP)
// ============================================
router.post("/send", async (req, res) => {
  const { Nguoi_gui, Nguoi_nhan, Noi_dung } = req.body;

  if (!Nguoi_gui || !Nguoi_nhan || !Noi_dung) {
    return res.status(400).json({ 
      error: "Thiếu dữ liệu gửi tin nhắn.",
      required: ["Nguoi_gui", "Nguoi_nhan", "Noi_dung"]
    });
  }

  const sql = `
    INSERT INTO Tin_nhan (Id_nguoi_gui, Id_nguoi_nhan, Noi_dung, Thoi_gian, Da_doc)
    VALUES (?, ?, ?, NOW(), 0)
  `;

  try {
    const [result] = await db.query(sql, [Nguoi_gui, Nguoi_nhan, Noi_dung]);
    res.json({ success: true, message: "Tin nhắn đã được gửi" });
  } catch (err) {
    console.error("❌ Lỗi khi lưu tin nhắn:", err);
    return res.status(500).json({ 
      error: "Không thể lưu tin nhắn.",
      details: err.message 
    });
  }
});

// ============================================
// 🟩 ĐÁNH DẤU TIN NHẮN ĐÃ ĐỌC
// ============================================
router.post("/mark-read/:adminId/:customerId", async (req, res) => {
  const { adminId, customerId } = req.params;

  if (!adminId || !customerId) {
    return res.status(400).json({ error: "Thiếu thông tin người dùng." });
  }

  const sql = `
    UPDATE Tin_nhan 
    SET Da_doc = 1 
    WHERE Id_nguoi_gui = ? 
    AND (Id_nguoi_nhan = ? OR Id_nguoi_nhan = 'admin01')
    AND Da_doc = 0
  `;

  try {
    const [result] = await db.query(sql, [customerId, adminId]);
    res.json({ success: true, updated: result.affectedRows, message: "Đã đánh dấu tin nhắn là đã đọc" });
  } catch (err) {
    console.error("❌ Lỗi đánh dấu đã đọc:", err);
    return res.status(500).json({ 
      error: "Không thể đánh dấu đã đọc.",
      details: err.message 
    });
  }
});

// ============================================
// 🟩 ĐẾM SỐ TIN NHẮN CHƯA ĐỌC
// ============================================
router.get("/unread/:userId", async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({ error: "Thiếu userId." });
  }

  const sql = `
    SELECT COUNT(*) as unread_count
    FROM Tin_nhan
    WHERE Id_nguoi_nhan = ? 
    AND Da_doc = 0
  `;

  try {
    const [results] = await db.query(sql, [userId]);
    res.json({ unread_count: results[0]?.unread_count ?? 0 });
  } catch (err) {
    console.error("❌ Lỗi đếm tin nhắn chưa đọc:", err);
    return res.status(500).json({ 
      error: "Không thể đếm tin nhắn chưa đọc.",
      details: err.message 
    });
  }
});

// ============================================
// 🟩 XÓA TIN NHẮN (ADMIN)
// ============================================
router.delete("/message/:messageId", async (req, res) => {
  const messageId = req.params.messageId;

  if (!messageId) {
    return res.status(400).json({ error: "Thiếu ID tin nhắn." });
  }

  const sql = `DELETE FROM Tin_nhan WHERE Id_tin = ?`;

  try {
    const [result] = await db.query(sql, [messageId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy tin nhắn." });
    }
    res.json({ success: true, message: "Đã xóa tin nhắn" });
  } catch (err) {
    console.error("❌ Lỗi xóa tin nhắn:", err);
    return res.status(500).json({ 
      error: "Không thể xóa tin nhắn.",
      details: err.message 
    });
  }
});

// ============================================
// 🟩 XÓA TOÀN BỘ CUỘC TRÒ CHUYỆN (ADMIN)
// ============================================
router.delete("/conversation/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;

  if (!user1 || !user2) {
    return res.status(400).json({ error: "Thiếu thông tin người dùng." });
  }

  const sql = `
    DELETE FROM Tin_nhan 
    WHERE (Id_nguoi_gui = ? AND Id_nguoi_nhan = ?) 
       OR (Id_nguoi_gui = ? AND Id_nguoi_nhan = ?)
  `;

  try {
    const [result] = await db.query(sql, [user1, user2, user2, user1]);
    res.json({ success: true, deleted: result.affectedRows, message: "Đã xóa cuộc trò chuyện" });
  } catch (err) {
    console.error("❌ Lỗi xóa cuộc trò chuyện:", err);
    return res.status(500).json({ 
      error: "Không thể xóa cuộc trò chuyện.",
      details: err.message 
    });
  }
});

// ============================================
// 🟩 THỐNG KÊ CHAT (ADMIN)
// ============================================
router.get("/stats", async (req, res) => {
  const sql = `
    SELECT 
      COUNT(DISTINCT CASE WHEN Id_nguoi_gui <> 'admin01' THEN Id_nguoi_gui END) as total_customers,
      COUNT(*) as total_messages,
      COUNT(CASE WHEN Da_doc = 0 AND Id_nguoi_nhan = 'admin01' THEN 1 END) as unread_messages,
      COUNT(CASE WHEN DATE(Thoi_gian) = CURDATE() THEN 1 END) as today_messages,
      COUNT(CASE WHEN DATE(Thoi_gian) = CURDATE() - INTERVAL 1 DAY THEN 1 END) as yesterday_messages
    FROM Tin_nhan
  `;

  try {
    const [results] = await db.query(sql);
    res.json(results[0] || {});
  } catch (err) {
    console.error("❌ Lỗi lấy thống kê:", err);
    return res.status(500).json({ 
      error: "Không thể lấy thống kê.",
      details: err.message 
    });
  }
});

// ============================================
// 🟩 TÌM KIẾM TIN NHẮN
// ============================================
router.get("/search", (req, res) => {
  const { keyword, userId } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: "Thiếu từ khóa tìm kiếm." });
  }

  let sql = `
    SELECT tn.*, 
      COALESCE(kh.Ten_khach_hang, tn.Id_nguoi_gui) AS Ten_nguoi_gui,
      COALESCE(kh2.Ten_khach_hang, tn.Id_nguoi_nhan) AS Ten_nguoi_nhan
    FROM Tin_nhan tn
    LEFT JOIN Khach_hang kh ON kh.Id_user = tn.Id_nguoi_gui
    LEFT JOIN Khach_hang kh2 ON kh2.Id_user = tn.Id_nguoi_nhan
    WHERE Noi_dung LIKE ?
  `;
  
  let params = [`%${keyword}%`];

  // Nếu có userId, chỉ tìm trong cuộc trò chuyện của user đó
  if (userId) {
    sql += ` AND (Id_nguoi_gui = ? OR Id_nguoi_nhan = ?)`;
    params.push(userId, userId);
  }

  sql += ` ORDER BY Thoi_gian DESC LIMIT 50`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("❌ Lỗi tìm kiếm:", err);
      return res.status(500).json({ 
        error: "Không thể tìm kiếm.",
        details: err.message 
      });
    }

    res.json(results);
  });
});

module.exports = router;