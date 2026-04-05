const express = require('express');
const AuthController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const User = require('../models/user.model');
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Public routes
router.post('/register', async (req, res) => {
    try {
        const {
            id_user,
            email,
            password,
            loai_tai_khoan = 'Khach_hang' // Mặc định là khách hàng
        } = req.body;

        // Validate thông tin tài khoản cơ bản
        if (!id_user || !email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Thiếu thông tin tài khoản bắt buộc: ID, email, password'
            });
        }

        // Kiểm tra tên tài khoản đã tồn tại chưa
        const [existingUser] = await db.query(
            'SELECT * FROM Tai_khoan WHERE Id_user = ?', 
            [id_user]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Tên tài khoản đã tồn tại'
            });
        }

        // Kiểm tra email đã tồn tại chưa
        const [existingEmail] = await db.query(
            'SELECT * FROM Tai_khoan WHERE Email = ?', 
            [email]
        );

        if (existingEmail.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Email đã tồn tại'
            });
        }

        // Xác định loại tài khoản và kiểm tra hợp lệ
        const account_type = loai_tai_khoan === 'Admin' ? 'Admin' : 'Khach_hang';

        try {
            // 1. Hash mật khẩu
            const hashedPassword = await bcrypt.hash(password, 10);

            // 2. Thêm vào bảng Tai_khoan
            const [result] = await db.query(
                'INSERT INTO Tai_khoan (Id_user, Password, Email, Loai_tai_khoan) VALUES (?, ?, ?, ?)',
                [id_user, hashedPassword, email, account_type]
            );
            
            res.status(201).json({
                status: 'success',
                message: 'Đăng ký tài khoản thành công'
            });
        } catch (error) {
            throw error;
        }
    } catch (error) {
        console.error('Error during registration:', error);
        
        // Xử lý lỗi chi tiết hơn
        let errorMessage = 'Lỗi khi đăng ký tài khoản';
        
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage.includes('PRIMARY')) {
                errorMessage = 'Mã khách hàng đã tồn tại';
            } else if (error.sqlMessage.includes('Email')) {
                errorMessage = 'Email đã tồn tại';
            } else if (error.sqlMessage.includes('Id_user')) {
                errorMessage = 'Tên tài khoản đã tồn tại';
            }
        }
        
        res.status(500).json({
            status: 'error',
            message: errorMessage,
            details: error.message
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { id_user, password } = req.body;
        
        console.log(`🔑 Request đăng nhập cho user: ${id_user}`);

        // Lấy thông tin tài khoản
        console.log(`🔍 Tìm kiếm tài khoản với ID: ${id_user}`);
        
        // Sử dụng User model để hỗ trợ mock data khi không có database
        const user = await User.findById(id_user);
        
        if (!user) {
            console.log(`❌ Không tìm thấy tài khoản: ${id_user}`);
            return res.status(401).json({
                status: 'error',
                message: 'Tài khoản không tồn tại'
            });
        }

        console.log(`✅ Tìm thấy tài khoản: ${id_user}, đang kiểm tra mật khẩu`);

        // Kiểm tra mật khẩu
        const isValidPassword = await User.verifyPassword(password, user.Password);

        if (!isValidPassword) {
            console.log(`❌ Mật khẩu không đúng cho tài khoản: ${id_user}`);
            return res.status(401).json({
                status: 'error',
                message: 'Mật khẩu không chính xác'
            });
        }
        
        console.log(`✅ Xác thực mật khẩu thành công cho tài khoản: ${id_user}`);

        // Kiểm tra status của tài khoản
        const userStatus = user.status || user.Status || 'Active';
        if (userStatus === 'Blocked' || userStatus === 'blocked') {
            console.log(`🚫 Tài khoản ${id_user} đã bị chặn`);
            return res.status(403).json({
                status: 'error',
                message: 'Tài khoản của bạn đã bị cấm. Vui lòng liên hệ quản trị viên.',
                code: 'ACCOUNT_BLOCKED'
            });
        }

        // Kiểm tra JWT_SECRET
        const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key';
        
        if (!process.env.JWT_SECRET) {
            console.warn('⚠️ CẢNH BÁO: JWT_SECRET không được thiết lập, sử dụng khóa mặc định');
        }

        // Tạo JWT token
        console.log(`🔒 Tạo JWT token cho người dùng: ${id_user}`);
        const token = require('jsonwebtoken').sign(
            { id: user.Id_user, role: user.Loai_tai_khoan },
            jwtSecret,
            { expiresIn: '24h' }
        );
        
        console.log(`✅ Đăng nhập thành công cho tài khoản: ${id_user}`);

        res.json({
            status: 'success',
            data: {
                user: {
                    id: user.Id_user,
                    email: user.Email,
                    role: user.Loai_tai_khoan,
                    ten_hien_thi: user.ten_hien_thi || null,
                    anh_dai_dien: user.anh_dai_dien || null
                },
                token
            }
        });

    } catch (error) {
        console.error('❌ Lỗi khi đăng nhập:', error);
        console.error('Chi tiết lỗi:', error.stack);
        res.status(500).json({
            status: 'error',
            message: 'Lỗi khi đăng nhập',
            details: error.message
        });
    }
});

// Protected routes
router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/profile/avatar', authenticateToken, AuthController.updateAvatar);
router.post('/update-password', authenticateToken, AuthController.updatePassword);

// Thêm endpoint xác thực token
router.get('/verify', authenticateToken, (req, res) => {
    // Nếu middleware authenticateToken thành công, nghĩa là token hợp lệ
    res.status(200).json({
        status: 'success',
        message: 'Token hợp lệ',
        data: {
            id: req.user.id,
            role: req.user.role,
            loai_tai_khoan: req.user.loai_tai_khoan
        }
    });
});

// Google OAuth Routes
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/google/callback', 
    passport.authenticate('google', { session: false, failureRedirect: '/auth.html?error=google_auth_failed' }),
    async (req, res) => {
        try {
            const user = req.user;
            
            if (!user) {
                return res.redirect('/auth.html?error=user_not_found');
            }

            // Tạo JWT token
            const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_key';
            const token = jwt.sign(
                { id: user.Id_user, role: user.Loai_tai_khoan },
                jwtSecret,
                { expiresIn: '24h' }
            );

            // Chuyển hướng với token trong URL (hoặc có thể dùng cookie)
            // Tốt hơn là chuyển hướng đến một trang trung gian để xử lý token
            const redirectUrl = `/auth.html?token=${token}&id=${user.Id_user}&email=${encodeURIComponent(user.Email || '')}&role=${user.Loai_tai_khoan}`;
            res.redirect(redirectUrl);
        } catch (error) {
            console.error('❌ Lỗi trong Google callback:', error);
            res.redirect('/auth.html?error=server_error');
        }
    }
);

module.exports = router;