const db = require('../config/database');

exports.getAllUsers = async (req, res) => {
    try {
        console.log('Đang lấy danh sách người dùng');
        
        const [users] = await db.query(`
            SELECT 
                kh.Ma_khach_hang,
                kh.Ten_khach_hang,
                tk.Email,
                tk.Id_user,
                COALESCE(tk.status, 'Active') AS status,
                (SELECT COUNT(*) FROM Booking b WHERE b.Ma_khach_hang = kh.Ma_khach_hang) AS so_booking,
                (SELECT COUNT(*) FROM Hoa_don h 
                 JOIN Booking b2 ON h.Ma_booking = b2.Ma_booking 
                 WHERE b2.Ma_khach_hang = kh.Ma_khach_hang) AS so_hoa_don
            FROM Khach_hang kh
            JOIN tai_khoan tk ON kh.Id_user = tk.Id_user
            ORDER BY kh.Ten_khach_hang
        `);

        console.log('Kết quả truy vấn users:', users);

        if (!users || users.length === 0) {
            console.log('Không có người dùng nào');
            return res.json({ 
                status: 'success', 
                data: { 
                    users: [] 
                } 
            });
        }

        // Format dữ liệu trả về
        const formattedUsers = users.map(user => ({
            ...user,
            so_booking: parseInt(user.so_booking),
            so_hoa_don: parseInt(user.so_hoa_don)
        }));

        console.log('Dữ liệu trả về:', formattedUsers);

        res.json({ 
            status: 'success', 
            data: { 
                users: formattedUsers 
            } 
        });
    } catch (error) {
        console.error('Lỗi getAllUsers:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Lỗi khi tải danh sách người dùng',
            error: error.message 
        });
    }
};

exports.getUserDetails = async (req, res) => {
    try {
        const ma_khach_hang = req.params.ma_khach_hang;
        console.log('Đang tìm thông tin khách hàng:', ma_khach_hang);

        // Lấy thông tin user
        const [userInfo] = await db.query(`
            SELECT * FROM Khach_hang kh
            JOIN tai_khoan tk ON kh.Id_user = tk.Id_user
            WHERE kh.Ma_khach_hang = ?
        `, [ma_khach_hang]);

        console.log('Kết quả truy vấn userInfo:', userInfo);

        if (!userInfo || userInfo.length === 0) {
            console.log('Không tìm thấy thông tin khách hàng');
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy thông tin khách hàng'
            });
        }

        // Lấy danh sách booking của người dùng kèm tên tour
        const [bookings] = await db.query(`
            SELECT 
                b.Ma_booking,
                b.Ngay_dat,
                b.Trang_thai_booking,
                b.Tong_tien,
                t.Ten_tour
            FROM Booking b
            LEFT JOIN Chi_tiet_booking ctb ON b.Ma_booking = ctb.Ma_booking
            LEFT JOIN Lich_khoi_hanh lkh ON ctb.Ma_lich = lkh.Ma_lich
            LEFT JOIN Tour_du_lich t ON lkh.Ma_tour = t.Ma_tour
            WHERE b.Ma_khach_hang = ?
            ORDER BY b.Ngay_dat DESC
        `, [ma_khach_hang]);

        console.log('Kết quả truy vấn bookings:', bookings);

        // Format ngày và dữ liệu trả về
        const formattedUserInfo = {
            ...userInfo[0],
            Ngay_sinh: userInfo[0].Ngay_sinh ? new Date(userInfo[0].Ngay_sinh).toISOString().split('T')[0] : null
        };

        const formattedBookings = bookings.map(booking => ({
            ...booking,
            Ngay_dat: new Date(booking.Ngay_dat).toISOString(),
            Tong_tien: parseFloat(booking.Tong_tien || 0),
            Ten_tour: booking.Ten_tour || null
        }));

        console.log('Dữ liệu trả về:', {
            user: formattedUserInfo,
            bookings: formattedBookings
        });

        res.json({
            status: 'success',
            data: {
                user: formattedUserInfo,
                bookings: formattedBookings
            }
        });
    } catch (error) {
        console.error('Lỗi getUserDetails:', error);
        res.status(500).json({
            status: 'error',
            message: 'Lỗi khi lấy thông tin chi tiết người dùng',
            error: error.message
        });
    }
};


exports.updateUser = async (req, res) => {
    try {
        const ma_khach_hang = req.params.ma_khach_hang;
        const { Ten_khach_hang, Email, Dia_chi, Ngay_sinh, CCCD } = req.body;

        // Kiểm tra quyền admin
        if (req.user.role !== 'Admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Không có quyền thực hiện hành động này'
            });
        }

        // Lấy thông tin khách hàng từ mã
        const [khachHang] = await db.query('SELECT * FROM Khach_hang WHERE Ma_khach_hang = ?', [ma_khach_hang]);
        
        if (khachHang.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy thông tin khách hàng'
            });
        }

        // Bắt đầu transaction
        await db.query('START TRANSACTION');

        try {
            // Cập nhật thông tin khách hàng
            await db.query(`
                UPDATE Khach_hang 
                SET Ten_khach_hang = ?, 
                    Dia_chi = ?,
                    Ngay_sinh = ?,
                    CCCD = ?
                WHERE Ma_khach_hang = ?
            `, [Ten_khach_hang, Dia_chi, Ngay_sinh, CCCD, ma_khach_hang]);

            // Cập nhật email trong bảng tài khoản nếu có thay đổi
            if (Email) {
                // Kiểm tra email mới đã tồn tại chưa
                const [existingEmail] = await db.query('SELECT * FROM tai_khoan WHERE Email = ? AND Id_user != ?', [Email, khachHang[0].Id_user]);
                
                if (existingEmail.length > 0) {
                    throw new Error('Email đã được sử dụng bởi tài khoản khác');
                }

                await db.query('UPDATE tai_khoan SET Email = ? WHERE Id_user = ?', [Email, khachHang[0].Id_user]);
            }

            // Commit transaction
            await db.query('COMMIT');

            res.json({
                status: 'success',
                message: 'Cập nhật thông tin thành công'
            });
        } catch (error) {
            // Rollback nếu có lỗi
            await db.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Lỗi updateUser:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Lỗi khi cập nhật thông tin người dùng'
        });
    }
};

// Block/Unblock user thay vì xóa
exports.blockUser = async (req, res) => {
    try {
        const ma_khach_hang = req.params.ma_khach_hang;
        const { action } = req.body; // 'block' hoặc 'unblock'

        // Kiểm tra quyền admin
        if (req.user.role !== 'Admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Không có quyền thực hiện hành động này'
            });
        }

        if (!action || (action !== 'block' && action !== 'unblock')) {
            return res.status(400).json({
                status: 'error',
                message: 'Action phải là "block" hoặc "unblock"'
            });
        }

        // Lấy thông tin khách hàng
        const [khachHang] = await db.query('SELECT * FROM Khach_hang WHERE Ma_khach_hang = ?', [ma_khach_hang]);
        
        if (khachHang.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy thông tin khách hàng'
            });
        }

        const userId = khachHang[0].Id_user;
        const newStatus = action === 'block' ? 'Blocked' : 'Active';

        // Cập nhật status
        await db.query('UPDATE Tai_khoan SET status = ? WHERE Id_user = ?', [newStatus, userId]);

        // Lấy thông tin tài khoản để gửi thông báo
        const [account] = await db.query('SELECT * FROM Tai_khoan WHERE Id_user = ?', [userId]);
        
        // Gửi thông báo realtime qua Socket.io nếu user đang online
        const io = req.app.get('io');
        if (io) {
            // Lấy onlineUsers từ app (được set trong app.js)
            const onlineUsers = req.app.get('onlineUsers') || {};
            const userSocket = onlineUsers[userId];
            
            console.log(`🔍 [BLOCK USER] User ID: ${userId}, Online: ${!!userSocket}, Action: ${action}`);
            
            if (userSocket && action === 'block') {
                // Gửi thông báo block đến user
                console.log(`📢 [BLOCK USER] Gửi thông báo block đến user ${userId}`);
                userSocket.emit('accountBlocked', {
                    message: 'Tài khoản của bạn đã bị cấm bởi quản trị viên.',
                    reason: 'Tài khoản đã bị khóa do vi phạm quy định',
                    timestamp: new Date().toISOString()
                });
            } else if (userSocket && action === 'unblock') {
                // Gửi thông báo unblock
                console.log(`📢 [BLOCK USER] Gửi thông báo unblock đến user ${userId}`);
                userSocket.emit('accountUnblocked', {
                    message: 'Tài khoản của bạn đã được mở khóa.',
                    timestamp: new Date().toISOString()
                });
            } else if (action === 'block') {
                console.log(`⚠️ [BLOCK USER] User ${userId} không online, không thể gửi thông báo realtime`);
            }
        } else {
            console.warn('⚠️ [BLOCK USER] Socket.io không khả dụng');
        }

        res.json({
            status: 'success',
            message: action === 'block' ? 'Đã chặn người dùng thành công' : 'Đã gỡ chặn người dùng thành công',
            data: {
                userId: userId,
                status: newStatus
            }
        });
    } catch (error) {
        console.error('Lỗi blockUser:', error);
        res.status(500).json({
            status: 'error',
            message: 'Lỗi khi cập nhật trạng thái người dùng',
            error: error.message
        });
    }
};

// Giữ lại deleteUser để tương thích ngược (có thể xóa sau)
exports.deleteUser = async (req, res) => {
    try {
        const ma_khach_hang = req.params.ma_khach_hang;

        // Kiểm tra quyền admin
        if (req.user.role !== 'Admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Không có quyền thực hiện hành động này'
            });
        }

        // Lấy thông tin khách hàng
        const [khachHang] = await db.query('SELECT * FROM Khach_hang WHERE Ma_khach_hang = ?', [ma_khach_hang]);
        
        if (khachHang.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy thông tin khách hàng'
            });
        }

        // Kiểm tra xem người dùng có booking nào không
        const [bookings] = await db.query('SELECT COUNT(*) as count FROM Booking WHERE Ma_khach_hang = ?', [ma_khach_hang]);
        
        if (bookings[0].count > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Không thể xóa người dùng này vì đã có booking. Vui lòng sử dụng chức năng chặn thay thế.'
            });
        }

        // Bắt đầu transaction
        await db.query('START TRANSACTION');

        try {
            // Xóa thông tin khách hàng
            await db.query('DELETE FROM Khach_hang WHERE Ma_khach_hang = ?', [ma_khach_hang]);
            
            // Xóa tài khoản
            await db.query('DELETE FROM tai_khoan WHERE Id_user = ?', [khachHang[0].Id_user]);

            // Commit transaction
            await db.query('COMMIT');

            res.json({
                status: 'success',
                message: 'Xóa người dùng thành công'
            });
        } catch (error) {
            // Rollback nếu có lỗi
            await db.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Lỗi deleteUser:', error);
        res.status(500).json({
            status: 'error',
            message: 'Lỗi khi xóa người dùng',
            error: error.message
        });
    }
};
