const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const config = require('../config/app.config');

/**
 * Middleware xác thực token
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Lấy token từ header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    console.log('🔑 Đang xác thực token');
    
    if (!token) {
      console.log('❌ Không tìm thấy token');
      return res.status(401).json({
        status: 'error',
        message: 'Không tìm thấy token xác thực'
      });
    }
    
    // Kiểm tra JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key';
    
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️ CẢNH BÁO: JWT_SECRET không được thiết lập, sử dụng khóa mặc định');
    }
    
      try {
        // Xác minh token
        console.log('🔍 Đang xác minh token với JWT_SECRET');
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded;
      
      console.log(`✅ Token hợp lệ - User ID: ${decoded.id}, Role: ${decoded.role}`);
      
      // Lấy thông tin người dùng từ database để xác nhận tài khoản vẫn tồn tại
      console.log(`🔍 Kiểm tra thông tin người dùng trong database: ${decoded.id}`);
      
      let user = null;
      try {
        // Thử query với tên bảng chữ hoa trước
        const [usersUpper] = await db.query(
          'SELECT * FROM Tai_khoan WHERE Id_user = ?',
          [decoded.id]
        );
        
        if (usersUpper.length > 0) {
          user = usersUpper[0];
        } else {
          // Thử query với tên bảng chữ thường
          const [usersLower] = await db.query(
            'SELECT * FROM tai_khoan WHERE Id_user = ?',
            [decoded.id]
          );
          
          if (usersLower.length > 0) {
            user = usersLower[0];
          }
        }
      } catch (dbError) {
        console.warn(`⚠️ Lỗi khi query database, sẽ kiểm tra mock data:`, dbError.message);
      }
      
      // Nếu không tìm thấy trong database, kiểm tra mock data
      if (!user) {
        console.log(`⚠️ Không tìm thấy người dùng ${decoded.id} trong database, kiểm tra mock data`);
        user = await User.findById(decoded.id);
        
        if (!user) {
          console.log(`❌ Không tìm thấy người dùng ${decoded.id} trong database và mock data`);
          return res.status(401).json({
            status: 'error',
            message: 'Tài khoản không tồn tại'
          });
        } else {
          console.log(`✅ Tìm thấy người dùng ${decoded.id} trong mock data`);
        }
      } else {
        console.log(`✅ Tìm thấy người dùng ${decoded.id} trong database`);
      }
      
      // Kiểm tra status của tài khoản
      if (user && (user.status === 'Blocked' || user.status === 'blocked')) {
        console.log(`🚫 Tài khoản ${decoded.id} đã bị chặn`);
        return res.status(403).json({
          status: 'error',
          message: 'Tài khoản của bạn đã bị cấm. Vui lòng liên hệ quản trị viên.',
          code: 'ACCOUNT_BLOCKED'
        });
      }
      
      // Thêm thông tin khách hàng nếu là tài khoản khách
      if (decoded.role === 'Khach_hang') {
        try {
          console.log(`🔍 Tìm thông tin khách hàng cho user: ${decoded.id}`);
          const [customers] = await db.query(
            'SELECT * FROM Khach_hang WHERE Id_user = ?',
            [decoded.id]
          );
          
          if (customers.length > 0) {
            req.user.customerId = customers[0].Ma_khach_hang;
            console.log(`✅ Tìm thấy mã khách hàng: ${req.user.customerId}`);
          } else {
            console.log(`⚠️ Không tìm thấy thông tin khách hàng cho user: ${decoded.id}`);
          }
        } catch (error) {
          console.error(`❌ Lỗi khi tìm thông tin khách hàng:`, error);
        }
      }
      
      // Token hợp lệ, tiếp tục xử lý request
      next();
    } catch (error) {
      console.error('❌ Token không hợp lệ:', error);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token đã hết hạn, vui lòng đăng nhập lại'
        });
      }
      
      return res.status(403).json({
        status: 'error',
        message: 'Token không hợp lệ'
      });
    }
  } catch (error) {
    console.error('❌ Lỗi xác thực:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi xác thực',
      error: error.message
    });
  }
};

/**
 * Middleware kiểm tra quyền admin
 */
const isAdmin = (req, res, next) => {
  console.log('🔒 Kiểm tra quyền Admin');
  
  if (req.user && req.user.role === 'Admin') {
    console.log('✅ Xác thực quyền Admin thành công');
    next();
  } else {
    console.log('❌ Không có quyền Admin');
    return res.status(403).json({
      status: 'error',
      message: 'Không có quyền truy cập'
    });
  }
};

/**
 * Middleware kiểm tra quyền khách hàng
 */
const isCustomer = (req, res, next) => {
  console.log('🔒 Kiểm tra quyền Khách hàng');
  
  if (req.user && req.user.role === 'Khach_hang') {
    console.log('✅ Xác thực quyền Khách hàng thành công');
    next();
  } else {
    console.log('❌ Không có quyền Khách hàng');
    return res.status(403).json({
      status: 'error',
      message: 'Không có quyền truy cập'
    });
  }
};

/**
 * Middleware kiểm tra quyền hướng dẫn viên
 */
const isGuide = (req, res, next) => {
  console.log('🔒 Kiểm tra quyền Hướng dẫn viên');
  
  if (req.user && req.user.role === 'Huong_dan_vien') {
    console.log('✅ Xác thực quyền Hướng dẫn viên thành công');
    next();
  } else {
    console.log('❌ Không có quyền Hướng dẫn viên');
    return res.status(403).json({
      status: 'error',
      message: 'Không có quyền truy cập'
    });
  }
};

/**
 * Helper function để xác định redirect URL sau khi login
 * @param {string} role - Role của user
 * @returns {string} - Redirect URL
 */
const getRedirectUrl = (role) => {
  switch (role) {
    case 'Admin':
      return '/admin.html';
    case 'Huong_dan_vien':
      return '/guide.html';
    case 'Khach_hang':
    default:
      return '/index.html';
  }
};

module.exports = {
  authenticateToken,
  isAdmin,
  isCustomer,
  isGuide,
  getRedirectUrl
};
