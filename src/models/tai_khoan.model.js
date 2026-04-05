const db = require('../config/database');

class TaiKhoan {
  // Lấy tất cả tài khoản
  static async getAll() {
    const [rows] = await db.query('SELECT * FROM tai_khoan');
    return rows;
  }

  // Lấy tài khoản theo ID
  static async getById(id) {
    const [rows] = await db.query('SELECT * FROM tai_khoan WHERE Id_user = ?', [id]);
    return rows[0];
  }

  // Lấy tài khoản theo email
  static async getByEmail(email) {
    const [rows] = await db.query('SELECT * FROM tai_khoan WHERE Email = ?', [email]);
    return rows[0];
  }

  // Tạo tài khoản mới
  static async create(taiKhoan) {
    const { Email, Password, Loai_tai_khoan } = taiKhoan;
    const [result] = await db.query(
      'INSERT INTO tai_khoan (Email, Password, Loai_tai_khoan) VALUES (?, ?, ?)',
      [Email, Password, Loai_tai_khoan]
    );
    return {
      Id_user: result.insertId,
      ...taiKhoan
    };
  }

  // Cập nhật tài khoản
  static async update(id, taiKhoan) {
    const { Email, Password, Loai_tai_khoan } = taiKhoan;
    await db.query(
      'UPDATE tai_khoan SET Email = ?, Password = ?, Loai_tai_khoan = ? WHERE Id_user = ?',
      [Email, Password, Loai_tai_khoan, id]
    );
    return { Id_user: id, ...taiKhoan };
  }

  // Xóa tài khoản
  static async delete(id) {
    await db.query('DELETE FROM tai_khoan WHERE Id_user = ?', [id]);
    return { Id_user: id };
  }
}

module.exports = TaiKhoan; 