const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const multer = require('multer');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('./config/passport');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

require('dotenv').config();

// Kiểm tra và thiết lập JWT_SECRET nếu chưa có
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ CẢNH BÁO: Biến môi trường JWT_SECRET không được thiết lập!');
  console.warn('⚠️ Sử dụng giá trị mặc định cho JWT_SECRET. Điều này KHÔNG AN TOÀN cho môi trường sản xuất!');
  process.env.JWT_SECRET = 'your_jwt_secret_key';
} else {
  console.log('✅ JWT_SECRET đã được thiết lập:', process.env.JWT_SECRET.substring(0, 3) + '***' + process.env.JWT_SECRET.substring(process.env.JWT_SECRET.length - 3));
}

// Import database connection
const db = require('./config/database');

// ===================================================================
//  SOCKET.IO LOGIC - PHẦN ĐÃ ĐƯỢC SỬA LẠI VÀ TỐI ƯU
// ===================================================================

let adminSockets = {}; // { adminId: socket }
let onlineUsers = {}; // Đối tượng để lưu trữ socket của khách hàng: { userId1: socket1, userId2: socket2 }
let guideSockets = {}; // { guideId: socket } - Lưu socket của hướng dẫn viên

// Expose io và onlineUsers để controller có thể truy cập
app.set('io', io);
app.set('onlineUsers', onlineUsers);
app.set('adminSockets', adminSockets);
app.set('guideSockets', guideSockets);

io.on("connection", (socket) => {
  console.log("🔌 Một người dùng đã kết nối:", socket.id);

  // Lắng nghe sự kiện khi Admin online với adminId
  socket.on("adminOnline", (adminId) => {
    if (!adminId) {
      console.log('⚠️ Admin online event không có adminId');
      return;
    }
    console.log(`👑 Admin '${adminId}' đã online:`, socket.id);
    adminSockets[adminId] = socket;
    socket.adminId = adminId;
    socket.emit("updateUserList", Object.keys(onlineUsers));
    
    // Log để debug
    console.log(`📊 Tổng số admin đang online: ${Object.keys(adminSockets).length}`);
    console.log(`📊 Danh sách admin IDs: ${Object.keys(adminSockets).join(', ')}`);
    
    // Thông báo cho tất cả user rằng admin đã online
    Object.values(onlineUsers).forEach(userSocket => {
      userSocket.emit("adminOnline", adminId);
    });
  });

  // Lắng nghe sự kiện khi Khách hàng online
  socket.on("userOnline", (userId) => {
    console.log(`👤 Khách hàng '${userId}' đã online:`, socket.id);
    onlineUsers[userId] = socket; // Lưu socket của khách hàng
    socket.userId = userId; // Gán userId vào socket để dễ xử lý khi ngắt kết nối

    // Thông báo cho tất cả admin đang online
    Object.values(adminSockets).forEach((adminSock) => {
      adminSock.emit("updateUserList", Object.keys(onlineUsers));
    });
    
    // Thông báo cho user về trạng thái admin
    if (Object.keys(adminSockets).length > 0) {
      const firstAdminId = Object.keys(adminSockets)[0];
      socket.emit("adminOnline", firstAdminId);
    }
  });

  // Lắng nghe sự kiện khi Hướng dẫn viên online
  socket.on("guideOnline", async (data) => {
    const { userId, guideId } = data;
    if (!userId || !guideId) {
      console.log('⚠️ Guide online event thiếu userId hoặc guideId');
      return;
    }
    console.log(`🎯 Hướng dẫn viên '${guideId}' (${userId}) đã online:`, socket.id);
    guideSockets[guideId] = socket;
    socket.guideId = guideId;
    socket.userId = userId;
    
    console.log(`📊 Tổng số hướng dẫn viên đang online: ${Object.keys(guideSockets).length}`);
  });

  // Lắng nghe sự kiện gửi tin nhắn (dùng chung cho cả admin và khách)
  socket.on("sendMessage", (data) => {
    const { Nguoi_gui, Nguoi_nhan, Noi_dung } = data;
    console.log(`📩 Tin nhắn từ '${Nguoi_gui}' đến '${Nguoi_nhan}': ${Noi_dung}`);

    // ----- Logic chuyển tiếp tin nhắn -----

    // 1. Tin nhắn gửi tới Admin chung -> phát tới tất cả admin online (kèm thời gian)
    const nowIso = new Date().toISOString();
    const dataWithTime = { ...data, Thoi_gian: nowIso };
    if (Nguoi_nhan === "Admin") {
      Object.values(adminSockets).forEach((adminSock) => {
        adminSock.emit("receiveMessage", dataWithTime);
      });
    }
    // 2. Nếu người nhận là một khách hàng cụ thể (tin nhắn từ admin)
    else if (onlineUsers[Nguoi_nhan]) {
      const recipientSocket = onlineUsers[Nguoi_nhan];
      // Gửi tin nhắn tới khách hàng đó
      recipientSocket.emit("receiveMessage", dataWithTime);
      
      // Gửi số tin nhắn chưa đọc cho user
      recipientSocket.emit("unreadCount", 1);
    }
    // 2b. Nếu người nhận là một admin cụ thể theo Id_user
    else if (adminSockets[Nguoi_nhan]) {
      adminSockets[Nguoi_nhan].emit("receiveMessage", dataWithTime);
    }
    // 3. Trường hợp người nhận không online
    else {
      console.log(`⚠️ Người dùng '${Nguoi_nhan}' không online, tin nhắn chưa được gửi.`);
      // (Tùy chọn) Ở đây bạn có thể gửi lại thông báo lỗi cho người gửi
    }
    
    // ----- Lưu tin nhắn vào Database -----
    // Bạn có thể giữ hoặc thêm logic lưu vào DB ở đây nếu muốn.
    // Logic này sẽ không ảnh hưởng đến việc gửi tin nhắn real-time.
    // Xác định người nhận để lưu DB (FK tới Tai_khoan)
    let dbReceiverId = Nguoi_nhan;
    if (Nguoi_nhan === 'Admin') {
      const onlineAdminIds = Object.keys(adminSockets);
      dbReceiverId = onlineAdminIds[0] || 'admin01';
    }
    const sql = `INSERT INTO Tin_nhan (Id_nguoi_gui, Id_nguoi_nhan, Noi_dung, Thoi_gian, Da_doc) VALUES (?, ?, ?, NOW(), 0)`;
    db.query(sql, [Nguoi_gui, dbReceiverId, Noi_dung], (err, result) => {
        if (err) {
            console.error('❌ Lỗi khi lưu tin nhắn vào DB:', err);
            socket.emit('messageError', { message: 'Không thể lưu tin nhắn vào cơ sở dữ liệu.' });
        } else {
            console.log('✅ Tin nhắn đã được lưu vào DB');
            socket.emit('messageSent', { success: true });
        }
    });
  });

  // Gõ phím (typing indicator)
  socket.on("typing", ({ from, to, isTyping }) => {
    if (!from || !to) return;
    // nếu gửi tới Admin chung -> phát tới tất cả admin
    if (to === 'Admin') {
      Object.values(adminSockets).forEach((adminSock) => {
        adminSock.emit('typing', { from, to: 'Admin', isTyping });
      });
      return;
    }
    // gửi tới admin cụ thể
    if (adminSockets[to]) {
      adminSockets[to].emit('typing', { from, to, isTyping });
      return;
    }
    // gửi tới khách hàng
    if (onlineUsers[to]) {
      onlineUsers[to].emit('typing', { from, to, isTyping });
    }
  });

  // Đánh dấu đã xem (seen)
  socket.on("messageSeen", async ({ viewerId, partnerId }) => {
    if (!viewerId || !partnerId) return;
    try {
      // Nếu viewer là admin (đang online trong adminSockets)
      if (adminSockets[viewerId]) {
        await db.query(
          "UPDATE Tin_nhan SET Da_doc = 1 WHERE Id_nguoi_gui = ? AND Id_nguoi_nhan = ? AND Da_doc = 0",
          [partnerId, viewerId]
        );
        // báo cho khách hàng đối phương
        if (onlineUsers[partnerId]) {
          onlineUsers[partnerId].emit('messageSeen', { by: viewerId });
        }
      } else {
        // viewer là khách -> đánh dấu đã đọc tất cả tin nhắn từ các admin gửi cho viewer
        await db.query(
          "UPDATE Tin_nhan SET Da_doc = 1 WHERE Id_nguoi_nhan = ? AND Id_nguoi_gui IN (SELECT Id_user FROM Tai_khoan WHERE Loai_tai_khoan='Admin') AND Da_doc = 0",
          [viewerId]
        );
        // gửi seen tới tất cả admin online
        Object.values(adminSockets).forEach((adminSock) => {
          adminSock.emit('messageSeen', { by: viewerId });
        });
      }
    } catch (e) {
      console.error('Lỗi cập nhật đã xem:', e.message);
    }
  });

  // Xử lý khi người dùng ngắt kết nối
  socket.on("disconnect", () => {
    // 1. Nếu người ngắt kết nối là Admin
    if (socket.adminId && adminSockets[socket.adminId]) {
      console.log(`👑 Admin '${socket.adminId}' đã offline.`);
      delete adminSockets[socket.adminId];
      console.log(`📊 Còn lại ${Object.keys(adminSockets).length} admin online`);
      
      // Thông báo cho tất cả user rằng admin đã offline
      Object.values(onlineUsers).forEach(userSocket => {
        userSocket.emit("adminOffline");
      });
    }
    // 2. Nếu người ngắt kết nối là Hướng dẫn viên
    else if (socket.guideId && guideSockets[socket.guideId]) {
      console.log(`🎯 Hướng dẫn viên '${socket.guideId}' đã offline.`);
      delete guideSockets[socket.guideId];
      console.log(`📊 Còn lại ${Object.keys(guideSockets).length} hướng dẫn viên online`);
    }
    // 3. Nếu người ngắt kết nối là Khách hàng
    else if (socket.userId && onlineUsers[socket.userId]) {
      console.log(`👤 Khách hàng '${socket.userId}' đã offline.`);
      delete onlineUsers[socket.userId]; // Xóa khách hàng khỏi danh sách online

      // Cập nhật lại danh sách cho tất cả admin
      Object.values(adminSockets).forEach((adminSock) => {
        adminSock.emit("updateUserList", Object.keys(onlineUsers));
      });
    } else {
      console.log("🔌 Một kết nối vô danh đã ngắt.", socket.id);
    }
  });
});
// ===================================================================
// HẾT PHẦN SỬA ĐỔI SOCKET.IO
// ===================================================================


// ==============================================
// MULTER CONFIGURATION
// ==============================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Multer parse body sau khi xử lý file, nên cần đọc từ req.body
    // Nhưng trong destination function, req.body có thể chưa được parse
    // Nên ta sẽ đọc từ query string hoặc header nếu có
    let type = req.body?.type || req.query?.type || 'tours';
    
    // Debug: log toàn bộ req để xem
    console.log('Upload type from body:', req.body?.type);
    console.log('Upload type from query:', req.query?.type);
    console.log('Final upload type:', type);
    
    let folderName;
    if (type === 'avatar') {
      folderName = 'avatar';
    } else if (type === 'destination' || type === 'destinations') {
      folderName = 'destination';
    } else {
      folderName = 'tours';
    }
    
    console.log('Folder name for upload:', folderName);
    
    const dir = path.join(__dirname, '../public/images/uploads', folderName);
    console.log('Upload directory:', dir);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file hình ảnh!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// ==============================================
// DATABASE CONNECTION CHECK
// ==============================================
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('✅ Kết nối database thành công!');
    
    try {
      await connection.query('SELECT 1 FROM Tour_du_lich LIMIT 1');
    } catch (error) {
      console.error('❌ Lỗi khi kiểm tra bảng Tour_du_lich:', error.message);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ Lỗi kết nối database:', error.message);
    console.error('Vui lòng kiểm tra lại cấu hình database trong file .env');
  }
})();

// Quick debug: log tin_nhan table columns to align schema
(async () => {
  try {
    const [rows] = await db.query("SHOW COLUMNS FROM tin_nhan");
    console.log('📋 Columns in tin_nhan:', rows.map(r => `${r.Field}:${r.Type}`).join(', '));
  } catch (e) {
    console.warn('ℹ️ Không thể lấy cấu trúc bảng tin_nhan:', e.message);
  }
})();

// ==============================================
// MIDDLEWARE
// ==============================================
app.use(cors({
    origin: true,
    credentials: true
}));
// Body parser - but skip for multipart/form-data (let multer handle it)
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    // Skip body parsing for multipart/form-data, let multer handle it
    return next();
  }
  // Use body parser for other content types
  bodyParser.json()(req, res, next);
});

// JSON and URL-encoded body parsers (skip for multipart)
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  express.json()(req, res, next);
});

app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  express.urlencoded({ extended: true })(req, res, next);
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_session_secret_key_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Gắn db, io và adminSockets vào app.locals
app.locals.db = db;
app.locals.io = io;
// Tạo getter function để luôn lấy adminSockets mới nhất
Object.defineProperty(app.locals, 'adminSockets', {
  get: function() {
    return adminSockets;
  },
  enumerable: true,
  configurable: true
});

// ==============================================
// IMPORT ROUTES
// ==============================================
const authRoutes = require('./routes/auth.routes');
const tourRoutes = require('./routes/tour.routes');
const destinationRoutes = require('./routes/destination.routes');
const serviceRoutes = require('./routes/service.routes');
const bookingRoutes = require('./routes/booking.routes');
const ticketRoutes = require('./routes/ticket.routes');
const adminRoutes = require('./routes/admin.routes');
const customerRoutes = require('./routes/customer.routes');
const cancelRequestRoutes = require('./routes/cancel-request.routes');
const paymentRoutes = require('./routes/payment.routes');
const userRoutes = require('./routes/user.route');
const chatRoutes = require('./routes/chat');
const promotionRoutes = require('./routes/promotion.routes');
const ratingRoutes = require('./routes/rating.routes');
const momoRoutes = require('./routes/momo.routes');
const guideRoutes = require('./routes/guide.routes');
const adminGuideRoutes = require('./routes/admin-guide.routes');
const tourItineraryRoutes = require('./routes/tourItinerary.routes');
const mapRoutes = require('./routes/map.routes');

// ==============================================
// UPLOAD ROUTE
// ==============================================
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Không có file được upload'
      });
    }

    const type = req.body.type || 'tours';
    let folderName;
    if (type === 'avatar') {
      folderName = 'avatar';
    } else if (type === 'destination' || type === 'destinations') {
      folderName = 'destination';
    } else {
      folderName = 'tours';
    }
    // Trả về đường dẫn đúng với static files (thêm /images vào đầu)
    const imageUrl = `/images/uploads/${folderName}/${req.file.filename}`;

    console.log('File uploaded successfully:', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      imageUrl: imageUrl,
      type: type
    });

    res.json({
      status: 'success',
      message: 'File uploaded successfully',
      imageUrl: imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi khi upload file',
      error: error.message
    });
  }
});

// ==============================================
// GOOGLE OAUTH CALLBACK ROUTE (phải đặt trước API routes)
// ==============================================
// Route này xử lý callback trực tiếp từ Google OAuth
// Google redirect về /auth/google/callback theo cấu hình GOOGLE_CALLBACK_URL
app.get('/auth/google/callback', 
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

            // Chuyển hướng với token trong URL
            const redirectUrl = `/auth.html?token=${token}&id=${user.Id_user}&email=${encodeURIComponent(user.Email || '')}&role=${user.Loai_tai_khoan}`;
            res.redirect(redirectUrl);
        } catch (error) {
            console.error('❌ Lỗi trong Google callback:', error);
            res.redirect('/auth.html?error=server_error');
        }
    }
);

// ==============================================
// API ROUTES
// ==============================================
app.use('/api/auth', authRoutes);
app.use('/api/tours', tourRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/cancel-requests', cancelRequestRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/payment/momo', momoRoutes);
// Public route for MoMo redirect (without /api prefix)
app.use('/payment/momo', momoRoutes);
app.use('/api/ai', require('./routes/ai.routes'));
app.use('/api/guide', guideRoutes);
app.use('/api/admin', adminGuideRoutes);
app.use('/api', tourItineraryRoutes);
app.use('/api/map', mapRoutes);

// ==============================================
// CONTENT-TYPE MIDDLEWARE
// ==============================================
app.use((req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;
  const originalSendFile = res.sendFile;

  res.send = function(body) {
    if (typeof body === 'string' && body.trim().startsWith('<!DOCTYPE html')) {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    }
    return originalSend.call(this, body);
  };

  res.json = function(body) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson.call(this, body);
  };

  res.sendFile = function(filePath, options, callback) {
    if (path.extname(filePath) === '.html') {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    }
    return originalSendFile.call(this, filePath, options, callback);
  };

  next();
});

// ==============================================
// STATIC FILES
// ==============================================
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    }
  }
}));

app.use('/images', express.static(path.join(__dirname, '../public/images')));

// (Các phần còn lại của file được giữ nguyên)
// ...

// ==============================================
// CRON JOBS - BOOKING CLEANUP
// ==============================================
const CronService = require('./services/cron.service');
CronService.start();

// ==============================================
// START SERVER
// ==============================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 Socket.io is ready for connections`);
});

module.exports = { app, server, io };