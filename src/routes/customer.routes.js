const express = require('express');
const router = express.Router();
const { authenticateToken, isCustomer } = require('../middlewares/auth.middleware');
const db = require('../config/database');

// Lấy thông tin khách hàng hiện tại
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.Id_user || req.user.userId;
        console.log('🔍 Đang tìm thông tin khách hàng cho user:', userId);
        
        if (!userId) {
            return res.status(400).json({
                status: 'error',
                message: 'Không tìm thấy thông tin người dùng trong token'
            });
        }
        
        // Lấy thông tin tài khoản trước
        const [accounts] = await db.query(
            'SELECT Id_user, Email, Loai_tai_khoan, ten_hien_thi, anh_dai_dien FROM Tai_khoan WHERE Id_user = ?',
            [userId]
        );

        if (!accounts || accounts.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy tài khoản'
            });
        }

        const account = accounts[0];
        
        // Lấy thông tin khách hàng (có thể không tồn tại)
        const [customers] = await db.query(
            'SELECT * FROM Khach_hang WHERE Id_user = ?',
            [userId]
        );

        console.log('📊 Kết quả truy vấn customer:', customers);

        if (!customers || customers.length === 0) {
            console.log('⚠️ Không tìm thấy thông tin khách hàng, trả về thông tin tài khoản');
            return res.status(404).json({
                status: 'error',
                message: 'Không tìm thấy thông tin khách hàng. Vui lòng cập nhật thông tin cá nhân.',
                data: {
                    account: {
                        id_user: account.Id_user,
                        email: account.Email,
                        loai_tai_khoan: account.Loai_tai_khoan
                    }
                }
            });
        }

        const customer = customers[0];
        console.log('✅ Tìm thấy thông tin khách hàng:', customer);
        
        res.status(200).json({
            status: 'success',
            data: {
                customer: customer,
                account: {
                    id_user: account.Id_user,
                    email: account.Email,
                    loai_tai_khoan: account.Loai_tai_khoan,
                    ten_hien_thi: account.ten_hien_thi || null,
                    anh_dai_dien: account.anh_dai_dien || null
                }
            }
        });
    } catch (error) {
        console.error('❌ Lỗi khi lấy thông tin khách hàng:', error);
        res.status(500).json({
            status: 'error',
            message: 'Lỗi khi lấy thông tin khách hàng',
            error: error.message
        });
    }
});

// Cập nhật thông tin khách hàng (cho phép cả user thường và customer)
router.put('/me', authenticateToken, async (req, res) => {
    try {
        console.log('📝 Đang cập nhật thông tin khách hàng cho user:', req.user.id);
        console.log('📦 Dữ liệu nhận được:', req.body);

        const userId = req.user.id || req.user.Id_user || req.user.userId;
        if (!userId) {
            return res.status(400).json({
                status: 'error',
                message: 'Không tìm thấy thông tin người dùng trong token'
            });
        }

        // Lấy thông tin từ request body
        const {
            ten_khach_hang,
            ngay_sinh,
            gioi_tinh,
            cccd,
            dia_chi
        } = req.body;

        // Kiểm tra dữ liệu bắt buộc theo cấu trúc bảng
        const missingFields = [];
        if (!ten_khach_hang) missingFields.push('ten_khach_hang');
        if (!ngay_sinh) missingFields.push('ngay_sinh');
        if (!gioi_tinh) missingFields.push('gioi_tinh');
        if (!dia_chi) missingFields.push('dia_chi');
        if (!cccd) missingFields.push('cccd');

        if (missingFields.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Thiếu thông tin bắt buộc: ${missingFields.join(', ')}`,
                missingFields
            });
        }

        // Kiểm tra xem khách hàng đã tồn tại chưa
        const [existingCustomer] = await db.query(
            'SELECT Ma_khach_hang FROM Khach_hang WHERE Id_user = ?',
            [userId]
        );

        console.log('🔍 Kết quả kiểm tra khách hàng:', existingCustomer);

        if (!existingCustomer || existingCustomer.length === 0) {
            // Tạo mã khách hàng mới nếu chưa tồn tại
            // Đảm bảo mã khách hàng có định dạng phù hợp: KH + số ngẫu nhiên
            const ma_khach_hang = 'KH' + Date.now().toString().slice(-6);
            console.log('➕ Tạo khách hàng mới với mã:', ma_khach_hang);
            
            try {
                await db.query(
                    `INSERT INTO Khach_hang 
                    (Ma_khach_hang, Id_user, Ten_khach_hang, Ngay_sinh, Gioi_tinh, Cccd, Dia_chi)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [ma_khach_hang, userId, ten_khach_hang, ngay_sinh, gioi_tinh, cccd, dia_chi]
                );
                console.log('✅ Đã tạo khách hàng mới thành công');
                
                // Trả về thông tin khách hàng mới
                return res.status(201).json({
                    status: 'success',
                    message: 'Đã tạo thông tin khách hàng mới',
                    data: {
                        customer: {
                            Ma_khach_hang: ma_khach_hang,
                            Id_user: userId,
                            Ten_khach_hang: ten_khach_hang,
                            Ngay_sinh: ngay_sinh,
                            Gioi_tinh: gioi_tinh,
                            Cccd: cccd,
                            Dia_chi: dia_chi
                        }
                    }
                });
            } catch (insertError) {
                console.error('❌ Lỗi khi tạo khách hàng mới:', insertError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Lỗi khi tạo khách hàng mới',
                    error: insertError.message
                });
            }
        } else {
            // Cập nhật thông tin khách hàng
            const ma_khach_hang = existingCustomer[0].Ma_khach_hang;
            console.log('🔄 Cập nhật thông tin khách hàng:', ma_khach_hang);
            
            try {
                await db.query(
                    `UPDATE Khach_hang 
                    SET Ten_khach_hang = ?, Ngay_sinh = ?, Gioi_tinh = ?, 
                        Cccd = ?, Dia_chi = ?
                    WHERE Id_user = ?`,
                    [ten_khach_hang, ngay_sinh, gioi_tinh, cccd, dia_chi, userId]
                );
                
                console.log('✅ Đã cập nhật thông tin thành công');
                
                // Trả về thông tin khách hàng đã cập nhật
                return res.status(200).json({
                    status: 'success',
                    message: 'Cập nhật thông tin thành công',
                    data: {
                        customer: {
                            Ma_khach_hang: ma_khach_hang,
                            Id_user: userId,
                            Ten_khach_hang: ten_khach_hang,
                            Ngay_sinh: ngay_sinh,
                            Gioi_tinh: gioi_tinh,
                            Cccd: cccd,
                            Dia_chi: dia_chi
                        }
                    }
                });
            } catch (updateError) {
                console.error('❌ Lỗi khi cập nhật thông tin khách hàng:', updateError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Lỗi khi cập nhật thông tin khách hàng',
                    error: updateError.message
                });
            }
        }
    } catch (error) {
        console.error('❌ Lỗi khi cập nhật thông tin khách hàng:', error);
        res.status(500).json({
            status: 'error',
            message: 'Lỗi khi cập nhật thông tin khách hàng',
            error: error.message
        });
    }
});

module.exports = router; 