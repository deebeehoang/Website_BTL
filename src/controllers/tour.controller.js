const Tour = require('../models/tour.model');
const Destination = require('../models/destination.model');
const db = require('../config/database');
const pool = require('../config/database');
const path = require('path');
const fs = require('fs');

/**
 * Tour Controller
 */
class TourController {
  /**
   * Get all tours
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
static async getAllTours(req, res) {
  try {
    console.log('🔍 getAllTours called with query:', req.query);
    const { search, tourType, limit, page } = req.query;

    // Kiểm tra các cột có tồn tại trong bảng Tour_du_lich không
    const [columns] = await pool.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Tour_du_lich'`
    );
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    const hasDiemDanhGia = columnNames.includes('Diem_danh_gia_trung_binh');
    const hasSoLuongDanhGia = columnNames.includes('So_luong_danh_gia');
    
    // Xây dựng phần SELECT cho các cột đánh giá
    const ratingFields = [];
    if (hasDiemDanhGia) {
      ratingFields.push('COALESCE(t.Diem_danh_gia_trung_binh, 0) as Diem_danh_gia_trung_binh');
    } else {
      ratingFields.push('0 as Diem_danh_gia_trung_binh');
    }
    if (hasSoLuongDanhGia) {
      ratingFields.push('COALESCE(t.So_luong_danh_gia, 0) as So_luong_danh_gia');
    } else {
      ratingFields.push('0 as So_luong_danh_gia');
    }

    let sql = `
      SELECT t.*, d.Mo_ta,
             ${ratingFields.join(',\n             ')}
      FROM Tour_du_lich t
      LEFT JOIN Chi_tiet_tour_dia_danh ctd ON t.Ma_tour = ctd.Ma_tour AND ctd.Thu_tu = 1
      LEFT JOIN Dia_danh d ON ctd.Ma_dia_danh = d.Ma_dia_danh
    `;
    let conditions = [];
    let params = [];

    if (search) {
      conditions.push(`t.Ten_tour COLLATE utf8mb4_general_ci LIKE ?`);
      params.push(`%${search}%`);
    }

    if (tourType) {
      conditions.push(`t.Loai_tour = ?`);
      params.push(tourType);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Pagination: mặc định 12 tour mỗi page
    const perPage = limit ? parseInt(limit) : 12;
    const currentPage = page ? parseInt(page) : 1;
    const offset = (currentPage - 1) * perPage;
    
    // Thêm LIMIT và OFFSET cho pagination
    if (!isNaN(perPage) && perPage > 0) {
      sql += ` LIMIT ${perPage} OFFSET ${offset}`;
      console.log(`📄 Pagination: page=${currentPage}, perPage=${perPage}, offset=${offset}`);
    }

    // Đếm tổng số tour (trước khi pagination) để tính tổng số page
    let countSql = sql.replace(/SELECT[\s\S]*?FROM/i, 'SELECT COUNT(*) as total FROM');
    // Loại bỏ ORDER BY, LIMIT, OFFSET khỏi count query nếu có
    countSql = countSql.replace(/ORDER BY[\s\S]*$/i, '');
    countSql = countSql.replace(/LIMIT[\s\S]*$/i, '');
    const [countResult] = await pool.query(countSql, params);
    const totalTours = countResult[0]?.total || 0;
    
    const [rows] = await pool.query(sql, params);
    const tours = rows.map(t => ({
      ...t,
      Mo_ta: t.Mo_ta || 'Đang cập nhật mô tả...'
    }));

    const filteredTours = tours.filter(tour => tour.Tinh_trang !== 'Hết chỗ');
    
    // Tính tổng số page (dựa trên tổng số tour trước khi filter "Hết chỗ")
    const totalPages = Math.ceil(totalTours / perPage);

    res.status(200).json({
      status: 'success',
      results: filteredTours.length,
      pagination: {
        currentPage: currentPage,
        perPage: perPage,
        total: totalTours,
        totalPages: totalPages,
        hasMore: currentPage < totalPages
      },
      data: { tours: filteredTours }
    });
  } catch (error) {
    console.error('❌ Error in getAllTours:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi khi lấy danh sách tour',
      error: error.message
    });
  }
}

  
  /**
   * Get a specific tour by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTourById(req, res) {
    try {
      // Truy vấn trực tiếp thay vì sử dụng phương thức getTourWithDescription
      const [rows] = await pool.query(
        `SELECT t.*, d.Mo_ta 
         FROM tour_du_lich t
         LEFT JOIN chi_tiet_tour_dia_danh ctd ON t.Ma_tour = ctd.Ma_tour AND ctd.Thu_tu = 1
         LEFT JOIN dia_danh d ON ctd.Ma_dia_danh = d.Ma_dia_danh
         WHERE t.Ma_tour = ?`,
        [req.params.id]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy tour'
        });
      }
      
      // Nếu không có mô tả, sử dụng text mặc định
      const tour = rows[0];
      if (!tour.Mo_ta) {
        tour.Mo_ta = "Đang cập nhật mô tả...";
      }
      
      res.json({
        status: 'success',
        data: { tour }
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy thông tin tour'
      });
    }
  }
  
  /**
   * Helper method to get tour with description from first destination
   * @param {string} tourId - Tour ID
   * @returns {Object|null} - Tour data with description or null if not found
   */
  static async getTourWithDescription(tourId) {
    const [rows] = await pool.query(
      `SELECT t.*, d.Mo_ta 
       FROM tour_du_lich t
       LEFT JOIN chi_tiet_tour_dia_danh ctd ON t.Ma_tour = ctd.Ma_tour AND ctd.Thu_tu = 1
       LEFT JOIN dia_danh d ON ctd.Ma_dia_danh = d.Ma_dia_danh
       WHERE t.Ma_tour = ?`,
      [tourId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    // If no description found, use default text
    if (!rows[0].Mo_ta) {
      rows[0].Mo_ta = "Đang cập nhật mô tả...";
    }
    
    return rows[0];
  }
  
  /**
   * Create a new tour
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createTour(req, res) {
    try {
      // Log toàn bộ request body cho debug
      console.log('==== CREATE TOUR ====');
      console.log('req.body:', req.body);
      console.log('req.file:', req.file);
      console.log('====================');

      // Ensure user is an admin
      if (req.user && (req.user.role !== 'Admin' && req.user.loai_tai_khoan !== 'Admin')) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to perform this action'
        });
      }

      const { 
        ma_tour, 
        ten_tour, 
        thoi_gian, 
        tinh_trang, 
        loai_tour, 
        gia_nguoi_lon, 
        gia_tre_em,
        hinh_anh: imageFromBody,   // Lấy hinh_anh từ req.body
        Hinh_anh: imageFromBodyUppercase, // Lấy Hinh_anh (chữ hoa) từ req.body
        mo_ta,                      // Lấy mô tả từ req.body
        Mo_ta,                      // Lấy mô tả viết hoa từ req.body 
        description,                // Lấy mô tả từ trường description (phòng hờ)
        latitude,                   // Tọa độ vĩ độ từ Mapbox
        longitude,                  // Tọa độ kinh độ từ Mapbox
        map_address                 // Địa chỉ từ Mapbox
      } = req.body;

      // Log chi tiết dữ liệu mô tả
      console.log('==== MÔ TẢ TOUR ====');
      console.log('mo_ta từ request:', mo_ta);
      console.log('Mo_ta từ request:', Mo_ta); 
      console.log('description từ request:', description);
      console.log('====================');

      // Log cho việc debug
      console.log('createTour received:', {
        ma_tour, ten_tour, thoi_gian, tinh_trang, loai_tour,
        gia_nguoi_lon, gia_tre_em, 
        hinh_anh: imageFromBody,
        Hinh_anh: imageFromBodyUppercase
      });

      // Validate required fields
      if (!ma_tour || !ten_tour || !thoi_gian || !tinh_trang || !gia_nguoi_lon || !gia_tre_em) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields'
        });
      }

      // Validate price values
      if (isNaN(gia_nguoi_lon) || isNaN(gia_tre_em) || gia_nguoi_lon < 0 || gia_tre_em < 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid price values'
        });
      }

      // Xử lý đường dẫn hình ảnh - ưu tiên theo thứ tự: req.file > hinh_anh > Hinh_anh
      let hinh_anh = null;
      if (req.file) {
        // Handle image upload
        hinh_anh = `/uploads/tours/${req.file.filename}`;
        console.log('Image from file upload:', hinh_anh);
      } else if (imageFromBody) {
        // Sử dụng hinh_anh từ req.body nếu có
        hinh_anh = imageFromBody;
        console.log('Image from request body (lowercase):', hinh_anh);
      } else if (imageFromBodyUppercase) {
        // Sử dụng Hinh_anh từ req.body nếu không có hinh_anh
        hinh_anh = imageFromBodyUppercase;
        console.log('Image from request body (uppercase):', hinh_anh);
      }

      // Kiểm tra hình ảnh cuối cùng
      console.log('Final image path to save:', hinh_anh);

      // Xử lý trường mô tả, ưu tiên mo_ta > Mo_ta > description
      const moTaValue = mo_ta || Mo_ta || description || null;
      console.log('Mô tả sẽ được lưu:', moTaValue);
      console.log('Độ dài mô tả:', moTaValue ? moTaValue.length : 0);

      const tourData = {
        ma_tour,
        ten_tour,
        thoi_gian,
        tinh_trang,
        loai_tour,
        gia_nguoi_lon,
        gia_tre_em,
        hinh_anh,
        mo_ta: moTaValue,     // Thêm trường mo_ta với cả 3 biến thể
        Mo_ta: moTaValue,     
        description: moTaValue,
        latitude: latitude ? parseFloat(latitude) : null,      // Mapbox latitude
        longitude: longitude ? parseFloat(longitude) : null,    // Mapbox longitude
        map_address: map_address || null                        // Mapbox address
      };

      console.log('Tour data to be saved in DB:', JSON.stringify(tourData, null, 2));
      const newTour = await Tour.create(tourData);
      console.log('Tour created with data:', JSON.stringify(newTour, null, 2));
      console.log('Mo_ta field after creation:', newTour.Mo_ta);

      res.status(201).json({
        status: 'success',
        data: { tour: newTour }
      });
    } catch (error) {
      console.error('Create tour error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error creating tour',
        error: error.message
      });
    }
  }
  
  /**
   * Update a tour
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateTour(req, res) {
    try {
      // Ensure user is an admin
      if (req.user && (req.user.role !== 'Admin' && req.user.loai_tai_khoan !== 'Admin')) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to perform this action'
        });
      }

      const { id } = req.params;
      const { 
        ten_tour, 
        thoi_gian, 
        tinh_trang, 
        loai_tour, 
        gia_nguoi_lon, 
        gia_tre_em,
        hinh_anh: imageFromBody,  // Lấy hinh_anh từ req.body
        mo_ta,                     // Lấy mô tả từ req.body
        Mo_ta,                     // Lấy mô tả viết hoa từ req.body
        description,               // Lấy mô tả từ trường description (phòng hờ)
        latitude,                  // Tọa độ vĩ độ từ Mapbox
        longitude,                 // Tọa độ kinh độ từ Mapbox
        map_address                // Địa chỉ từ Mapbox
      } = req.body;

      // Log chi tiết body request để debug
      console.log('==== UPDATE TOUR REQUEST BODY ====');
      console.log('Update tour request for ID:', id);
      console.log('mo_ta from request:', mo_ta);
      console.log('Mo_ta from request:', Mo_ta);
      console.log('description from request:', description);
      console.log('Full request body:', req.body);
      console.log('===================================');

      // Validate required fields
      if (!ten_tour || !thoi_gian || !tinh_trang || !gia_nguoi_lon || !gia_tre_em) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields'
        });
      }

      // Validate price values
      if (isNaN(gia_nguoi_lon) || isNaN(gia_tre_em) || gia_nguoi_lon < 0 || gia_tre_em < 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid price values'
        });
      }

      // Get existing tour
      const existingTour = await Tour.getById(id);
      if (!existingTour) {
        return res.status(404).json({
          status: 'error',
          message: 'Tour not found'
        });
      }

      let hinh_anh = existingTour.Hinh_anh;
      if (req.file) {
        // Handle image upload
        hinh_anh = `/uploads/tours/${req.file.filename}`;

        // Delete old image if exists
        if (existingTour.Hinh_anh) {
          const oldImagePath = path.join(__dirname, '..', 'public', existingTour.Hinh_anh);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      } else if (imageFromBody) {
        // Sử dụng hinh_anh từ req.body nếu có
        hinh_anh = imageFromBody;
      }

      // Xử lý trường mô tả, ưu tiên mo_ta > Mo_ta > description
      const moTaValue = mo_ta || Mo_ta || description || null;
      console.log('Mô tả sẽ được cập nhật:', moTaValue);

      const tourData = {
        ten_tour,
        thoi_gian,
        tinh_trang,
        loai_tour,
        gia_nguoi_lon,
        gia_tre_em,
        hinh_anh,
        mo_ta: moTaValue,        // Thêm trường mo_ta với cả 3 biến thể
        Mo_ta: moTaValue,
        description: moTaValue,
        latitude: latitude ? parseFloat(latitude) : null,      // Mapbox latitude
        longitude: longitude ? parseFloat(longitude) : null,    // Mapbox longitude
        map_address: map_address || null                        // Mapbox address
      };

      console.log('Tour data being sent to model for update:', JSON.stringify(tourData, null, 2));
      const updatedTour = await Tour.update(id, tourData);

      // Kiểm tra kết quả cập nhật
      console.log('Tour after update:', JSON.stringify(updatedTour, null, 2));
      console.log('Mo_ta field after update:', updatedTour.Mo_ta);

      res.status(200).json({
        status: 'success',
        data: { tour: updatedTour }
      });
    } catch (error) {
      console.error('Update tour error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error updating tour',
        error: error.message
      });
    }
  }
  
  /**
   * Delete a tour
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteTour(req, res) {
    try {
      // Ensure user is an admin
      if (req.user && (req.user.role !== 'Admin' && req.user.loai_tai_khoan !== 'Admin')) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to perform this action'
        });
      }

      const { id } = req.params;

      // Get existing tour
      const existingTour = await Tour.getById(id);
      if (!existingTour) {
        return res.status(404).json({
          status: 'error',
          message: 'Tour not found'
        });
      }

      // Delete tour image if exists
      if (existingTour.Hinh_anh) {
        const imagePath = path.join(__dirname, '..', 'public', existingTour.Hinh_anh);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      // Delete tour
      await Tour.delete(id);

      res.status(200).json({
        status: 'success',
        message: 'Tour deleted successfully'
      });
    } catch (error) {
      console.error('Delete tour error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error deleting tour',
        error: error.message
      });
    }
  }
  
  /**
   * Search tours by name
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchTours(req, res) {
    try {
      const { 
        search, 
        minPrice, 
        maxPrice, 
        destination, 
        type, 
        sort 
      } = req.query;
      
      // Xây dựng điều kiện tìm kiếm
      let conditions = [];
      let params = [];
      
      // Tìm kiếm theo tên tour
      if (search) {
        conditions.push('Ten_tour LIKE ?');
        params.push(`%${search}%`);
      }
      
      // Lọc theo giá
      if (minPrice) {
        conditions.push('Gia_nguoi_lon >= ?');
        params.push(minPrice);
      }
      if (maxPrice) {
        conditions.push('Gia_nguoi_lon <= ?');
        params.push(maxPrice);
      }
      
      // Lọc theo điểm đến
      if (destination) {
        conditions.push('Diem_den = ?');
        params.push(destination);
      }
      
      // Lọc theo loại tour
      if (type) {
        conditions.push('Loai_tour = ?');
        params.push(type);
      }
      
      // Xây dựng câu query
      let query = 'SELECT * FROM tour_du_lich';
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      // Sắp xếp
      if (sort) {
        switch (sort) {
          case 'price_asc':
            query += ' ORDER BY Gia_nguoi_lon ASC';
            break;
          case 'price_desc':
            query += ' ORDER BY Gia_nguoi_lon DESC';
            break;
          case 'duration_asc':
            query += ' ORDER BY So_ngay ASC';
            break;
          case 'duration_desc':
            query += ' ORDER BY So_ngay DESC';
            break;
          default:
            query += ' ORDER BY Ma_tour DESC';
        }
      } else {
        query += ' ORDER BY Ma_tour DESC';
      }
      
      // Thực thi query
      const [tours] = await db.query(query, params);
      
      res.status(200).json({
        status: 'success',
        results: tours.length,
        data: { tours }
      });
    } catch (error) {
      console.error('Search tours error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error searching tours',
        error: error.message
      });
    }
  }
  
  /**
   * Create a new tour schedule
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createSchedule(req, res) {
    try {
      // Ensure user is an admin
      if (req.user && (req.user.role !== 'Admin' && req.user.loai_tai_khoan !== 'Admin')) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to perform this action'
        });
      }
      
      const scheduleData = req.body;
      
      // Validate required fields
      if (!scheduleData.ma_lich || !scheduleData.ma_tour || !scheduleData.ngay_bat_dau || 
          !scheduleData.ngay_ket_thuc || !scheduleData.so_cho) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields'
        });
      }

      // Validate dates
      const startDate = new Date(scheduleData.ngay_bat_dau);
      const endDate = new Date(scheduleData.ngay_ket_thuc);
      if (startDate >= endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'Ngày khởi hành phải nhỏ hơn ngày kết thúc'
        });
      }
      
      // Validate: Ngay_bat_dau >= ngày hiện tại
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startDate < today) {
        return res.status(400).json({
          status: 'error',
          message: 'Ngày khởi hành không được ở quá khứ'
        });
      }
      
      // Validate: So_cho > 0
      if (!scheduleData.so_cho || scheduleData.so_cho <= 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Số chỗ phải lớn hơn 0'
        });
      }
      
      // Check if schedule ID already exists
      const existingSchedule = await Tour.getScheduleById(scheduleData.ma_lich);
      if (existingSchedule) {
        return res.status(400).json({
          status: 'error',
          message: 'Mã lịch khởi hành đã tồn tại'
        });
      }
      
      // Check if tour exists
      const existingTour = await Tour.getById(scheduleData.ma_tour);
      if (!existingTour) {
        return res.status(404).json({
          status: 'error',
          message: 'Tour không tồn tại'
        });
      }
      
      // Create the schedule
      const newSchedule = await Tour.createSchedule(scheduleData);
      
      res.status(201).json({
        status: 'success',
        data: { schedule: newSchedule }
      });
    } catch (error) {
      console.error('Create schedule error:', error);
      
      // Kiểm tra các lỗi validation cụ thể
      let statusCode = 500;
      let errorMessage = 'Lỗi khi tạo lịch khởi hành';
      
      if (error.message.includes('trùng thời gian')) {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error.message.includes('Số chỗ')) {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error.message.includes('Ngày khởi hành')) {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error.message.includes('Hướng dẫn viên')) {
        statusCode = 400;
        errorMessage = error.message;
      } else {
        errorMessage = error.message || 'Lỗi khi tạo lịch khởi hành';
      }
      
      res.status(statusCode).json({
        status: 'error',
        message: errorMessage,
        error: error.message
      });
    }
  }
  
  /**
   * Add a destination to a tour
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async addDestinationToTour(req, res) {
    try {
      // Ensure user is an admin
      if (req.user && (req.user.role !== 'Admin' && req.user.loai_tai_khoan !== 'Admin')) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to perform this action'
        });
      }
      
      const { tourId, destinationId } = req.params;
      const { order } = req.body;
      
      if (!order) {
        return res.status(400).json({
          status: 'error',
          message: 'Order is required'
        });
      }
      
      // Check if tour exists
      const existingTour = await Tour.getById(tourId);
      if (!existingTour) {
        return res.status(404).json({
          status: 'error',
          message: 'Tour not found'
        });
      }
      
      // Check if destination exists
      const existingDestination = await Destination.getById(destinationId);
      if (!existingDestination) {
        return res.status(404).json({
          status: 'error',
          message: 'Destination not found'
        });
      }
      
      // Add destination to tour
      await Tour.addDestination(tourId, destinationId, order);
      
      // Get updated destinations for this tour
      const destinations = await Tour.getTourDestinations(tourId);
      
      res.status(200).json({
        status: 'success',
        data: { destinations }
      });
    } catch (error) {
      console.error('Add destination to tour error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error adding destination to tour',
        error: error.message
      });
    }
  }
  
  /**
   * Remove a destination from a tour
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async removeDestinationFromTour(req, res) {
    try {
      // Ensure user is an admin
      if (req.user && (req.user.role !== 'Admin' && req.user.loai_tai_khoan !== 'Admin')) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to perform this action'
        });
      }
      
      const { tourId, destinationId } = req.params;
      
      // Remove destination from tour
      await Tour.removeDestination(tourId, destinationId);
      
      res.status(204).send();
    } catch (error) {
      console.error('Remove destination from tour error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error removing destination from tour',
        error: error.message
      });
    }
  }

  /**
   * Get featured tours
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getFeaturedTours(req, res) {
    try {
      console.log('getFeaturedTours controller called');
      const limit = req.query.limit ? parseInt(req.query.limit) : 6;
      
      const tours = await Tour.getFeatured(limit);
      console.log(`Found ${tours.length} featured tours`);
      
      res.status(200).json({
        status: 'success',
        results: tours.length,
        data: { tours }
      });
    } catch (error) {
      console.error('Get featured tours error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error getting featured tours',
        error: error.message
      });
    }
  }
  
  /**
   * Get popular destinations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPopularDestinations(req, res) {
    try {
      console.log('getPopularDestinations controller called');
      const limit = req.query.limit ? parseInt(req.query.limit) : 5;
      
      // Sử dụng model Destination để lấy điểm đến phổ biến
      const destinations = await Destination.getPopularDestinations(limit);
      
      console.log(`Found ${destinations.length} popular destinations`);
      
      res.status(200).json({
        status: 'success',
        results: destinations.length,
        data: {
          destinations
        }
      });
    } catch (error) {
      console.error('Get popular destinations error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy danh sách điểm đến phổ biến',
        error: error.message
      });
    }
  }

  /**
   * Get all tours directly from database
   * This endpoint is used for admin tour management
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAllToursFromDatabase(req, res) {
    try {
      console.log('getAllToursFromDatabase controller called');
      
      // Kiểm tra nếu người dùng là admin
      if (req.user && req.user.role !== 'Admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Bạn không có quyền truy cập dữ liệu này'
        });
      }
      
      // Truy vấn trực tiếp đến database
      const [rows] = await pool.query('SELECT * FROM tour_du_lich');
      
      console.log(`Đã tìm thấy ${rows.length} tour từ database`);
      
      res.status(200).json({
        status: 'success',
        results: rows.length,
        data: { tours: rows }
      });
    } catch (error) {
      console.error('Error in getAllToursFromDatabase:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy danh sách tour từ database',
        error: error.message
      });
    }
  }

  /**
   * Get all schedules (exclude cancelled tours)
   */
  static async getAllSchedules(req, res) {
    try {
      const schedules = await Tour.getAllSchedules();
      res.status(200).json({
        status: 'success',
        results: schedules.length,
        data: { schedules }
      });
    } catch (error) {
      console.error('Get schedules error:', error);
      res.status(500).json({ status: 'error', message: 'Error getting schedules', error: error.message });
    }
  }

  /**
   * Get a specific schedule by ID
   */
  static async getScheduleById(req, res) {
    try {
      const schedule = await Tour.getScheduleById(req.params.lichId);
      if (!schedule) {
        return res.status(404).json({ status: 'error', message: 'Schedule not found' });
      }
      
      // Debug: log thông tin HDV và rating
      console.log('📅 Schedule data:', {
        Ma_lich: schedule.Ma_lich,
        Ma_huong_dan_vien: schedule.Ma_huong_dan_vien,
        Ten_huong_dan_vien: schedule.Ten_huong_dan_vien,
        guide_avg_rating: schedule.guide_avg_rating,
        guide_rating_count: schedule.guide_rating_count,
        guide_avatar: schedule.guide_avatar
      });
      
      res.status(200).json({ status: 'success', data: { schedule } });
    } catch (error) {
      console.error('Get schedule error:', error);
      res.status(500).json({ status: 'error', message: 'Error getting schedule', error: error.message });
    }
  }

  /**
   * Update a schedule (dates, seats) with booked seats check
   */
  static async updateSchedule(req, res) {
    try {
      const { ngay_bat_dau, ngay_ket_thuc, so_cho, ma_huong_dan_vien } = req.body;
      if (!ngay_bat_dau || !ngay_ket_thuc || so_cho == null) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
      }
      const existing = await Tour.getScheduleById(req.params.lichId);
      if (!existing) {
        return res.status(404).json({ status: 'error', message: 'Schedule not found' });
      }
      // Optional: ensure tour not cancelled
      const tour = await Tour.getById(existing.Ma_tour);
      if (tour && tour.Tinh_trang === 'Hủy') {
        return res.status(400).json({ status: 'error', message: 'Cannot update schedule of cancelled tour' });
      }
      const updateData = { ngay_bat_dau, ngay_ket_thuc, so_cho };
      // Nếu có ma_huong_dan_vien (có thể là null để gỡ HDV), thêm vào updateData
      if (ma_huong_dan_vien !== undefined) {
        updateData.ma_huong_dan_vien = ma_huong_dan_vien || null;
      }
      const updated = await Tour.updateSchedule(req.params.lichId, updateData);
      res.status(200).json({ status: 'success', data: { schedule: updated } });
    } catch (error) {
      console.error('Update schedule error:', error);
      
      // Kiểm tra các lỗi validation cụ thể
      let statusCode = 500;
      let errorMessage = 'Lỗi khi cập nhật lịch khởi hành';
      
      if (error.message.includes('Số chỗ mới nhỏ hơn')) {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error.message.includes('trùng thời gian')) {
        statusCode = 400;
        errorMessage = error.message;
      } else if (error.message.includes('Hướng dẫn viên')) {
        statusCode = 400;
        errorMessage = error.message;
      } else {
        errorMessage = error.message || 'Lỗi khi cập nhật lịch khởi hành';
      }
      
      res.status(statusCode).json({ 
        status: 'error', 
        message: errorMessage,
        error: error.message 
      });
    }
  }

  /**
   * Delete a tour schedule
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteSchedule(req, res) {
    try {
      // Ensure user is an admin
      if (req.user && (req.user.role !== 'Admin' && req.user.loai_tai_khoan !== 'Admin')) {
        return res.status(403).json({
          status: 'error',
          message: 'Không có quyền thực hiện thao tác này'
        });
      }
      
      const { lichId } = req.params;
      
      // Check if schedule exists
      const schedule = await Tour.getScheduleById(lichId);
      if (!schedule) {
        return res.status(404).json({
          status: 'error',
          message: 'Lịch khởi hành không tồn tại'
        });
      }
      
      // Delete the schedule
      try {
        await Tour.deleteSchedule(lichId);
        
        res.status(200).json({
          status: 'success',
          message: 'Xóa lịch khởi hành thành công'
        });
      } catch (error) {
        if (error.message.includes('Không thể xóa lịch khởi hành có booking')) {
          return res.status(400).json({
            status: 'error',
            message: error.message
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Delete schedule error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi xóa lịch khởi hành',
        error: error.message
      });
    }
  }

  /**
   * Get available seats for a schedule
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAvailableSeats(req, res) {
    try {
      const { lichId } = req.params;
      
      // Check if schedule exists
      const schedule = await Tour.getScheduleById(lichId);
      if (!schedule) {
        return res.status(404).json({
          status: 'error',
          message: 'Lịch khởi hành không tồn tại'
        });
      }
      
      const availableSeats = await Tour.getAvailableSeats(lichId);
      
      res.status(200).json({
        status: 'success',
        data: { availableSeats }
      });
    } catch (error) {
      console.error('Get available seats error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy số chỗ trống',
        error: error.message
      });
    }
  }

  /**
   * Get upcoming schedules for a tour
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUpcomingSchedules(req, res) {
    try {
      const { tourId } = req.params;
      
      // Check if tour exists
      const tour = await Tour.getById(tourId);
      if (!tour) {
        return res.status(404).json({
          status: 'error',
          message: 'Tour không tồn tại'
        });
      }
      
      const schedules = await Tour.getUpcomingSchedules(tourId);
      
      res.status(200).json({
        status: 'success',
        results: schedules.length,
        data: { schedules }
      });
    } catch (error) {
      console.error('Get upcoming schedules error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy danh sách lịch khởi hành sắp tới',
        error: error.message
      });
    }
  }

  /**
   * Get popular schedules
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPopularSchedules(req, res) {
    try {
      console.log('getPopularSchedules controller called');
      const limit = req.query.limit ? parseInt(req.query.limit) : 5;
      console.log('Limit parameter:', limit);
      
      const schedules = await Tour.getPopularSchedules(limit);
      console.log('Popular schedules from database:', schedules);
      
      // Kiểm tra nếu không có lịch trình
      if (!schedules || schedules.length === 0) {
        console.log('Không tìm thấy lịch trình phổ biến');
        return res.status(200).json({
          status: 'success',
          results: 0,
          data: { schedules: [] }
        });
      }
      
      res.status(200).json({
        status: 'success',
        results: schedules.length,
        data: { schedules }
      });
    } catch (error) {
      console.error('Get popular schedules error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy danh sách lịch khởi hành phổ biến',
        error: error.message
      });
    }
  }

  /**
   * Get popular tours
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPopularTours(req, res) {
    try {
      console.log('getPopularTours controller called');
      const limit = req.query.limit ? parseInt(req.query.limit) : 6;
      
      // Lấy tour và mô tả từ địa danh đầu tiên
      const [tours] = await pool.query(
        `SELECT t.*, d.Mo_ta 
         FROM tour_du_lich t
         LEFT JOIN chi_tiet_tour_dia_danh ctd ON t.Ma_tour = ctd.Ma_tour AND ctd.Thu_tu = 1
         LEFT JOIN dia_danh d ON ctd.Ma_dia_danh = d.Ma_dia_danh
         WHERE t.Tinh_trang = "Còn chỗ" 
         ORDER BY t.Gia_nguoi_lon 
         LIMIT ?`,
        [limit]
      );
      
      console.log(`Found ${tours.length} popular tours`);
      
      // Xử lý trường hợp không có tours
      if (!tours || tours.length === 0) {
        console.log('No popular tours found, returning empty array');
        return res.status(200).json({
          status: 'success',
          results: 0,
          data: { tours: [] }
        });
      }
      
      // Thêm mô tả mặc định nếu không có
      const processedTours = tours.map(tour => {
        if (!tour.Mo_ta) {
          tour.Mo_ta = "Đang cập nhật mô tả...";
        }
        return tour;
      });
      
      res.status(200).json({
        status: 'success',
        results: processedTours.length,
        data: { tours: processedTours }
      });
    } catch (error) {
      console.error('Get popular tours error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy danh sách tour phổ biến',
        error: error.message
      });
    }
  }

  /**
   * Get destinations for a tour
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTourDestinations(req, res) {
    try {
      const { tourId } = req.params;
      
      // Check if tour exists
      const tour = await Tour.getById(tourId);
      if (!tour) {
        return res.status(404).json({
          status: 'error',
          message: 'Tour không tồn tại'
        });
      }
      
      const destinations = await Tour.getTourDestinations(tourId);
      
      res.status(200).json({
        status: 'success',
        results: destinations.length,
        data: { destinations }
      });
    } catch (error) {
      console.error('Get tour destinations error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy danh sách điểm đến của tour',
        error: error.message
      });
    }
  }

  /**
   * Get all schedules with their tour info
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAvailableSchedules(req, res) {
    try {
      const pool = require('../config/database');
      
      // Kiểm tra xem cột Trang_thai có tồn tại không
      const [trangThaiColumn] = await pool.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'Lich_khoi_hanh' 
           AND COLUMN_NAME = 'Trang_thai'`
      );
      const hasTrangThai = trangThaiColumn.length > 0;
      
      // Query danh sách lịch khởi hành
      // Ẩn các lịch có Trang_thai = 'Đã diễn ra' (chỉ hiển thị cho admin)
      let query;
      if (hasTrangThai) {
        // Nếu là admin, hiển thị tất cả (có thể thêm logic kiểm tra role sau)
        // Nếu không phải admin, ẩn lịch đã diễn ra
        const isAdmin = req.user && (req.user.role === 'Admin' || req.user.loai_tai_khoan === 'Admin');
        if (isAdmin) {
          query = `
            SELECT l.*, t.Ten_tour, t.Tinh_trang as TrangThaiTour
            FROM Lich_khoi_hanh l
            LEFT JOIN tour_du_lich t ON l.Ma_tour = t.Ma_tour
            WHERE (t.Tinh_trang != 'Đã hủy' OR t.Tinh_trang IS NULL)
            ORDER BY l.Ngay_bat_dau ASC
          `;
        } else {
          query = `
            SELECT l.*, t.Ten_tour, t.Tinh_trang as TrangThaiTour
            FROM Lich_khoi_hanh l
            LEFT JOIN tour_du_lich t ON l.Ma_tour = t.Ma_tour
            WHERE (t.Tinh_trang != 'Đã hủy' OR t.Tinh_trang IS NULL)
              AND (l.Trang_thai IS NULL OR l.Trang_thai != 'Đã diễn ra')
            ORDER BY l.Ngay_bat_dau ASC
          `;
        }
      } else {
        query = `
          SELECT l.*, t.Ten_tour, t.Tinh_trang as TrangThaiTour
          FROM Lich_khoi_hanh l
          LEFT JOIN tour_du_lich t ON l.Ma_tour = t.Ma_tour
          WHERE (t.Tinh_trang != 'Đã hủy' OR t.Tinh_trang IS NULL)
            AND (l.Ngay_ket_thuc >= CURDATE())
          ORDER BY l.Ngay_bat_dau ASC
        `;
      }
      
      const [rows] = await pool.query(query);

      // Thêm thông tin về trạng thái hiện tại của lịch
      const schedules = rows.map(row => ({
        ...row,
        trang_thai: row.TrangThaiTour === 'Đã hủy' ? 'Không khả dụng' : 'Khả dụng',
        thong_tin: row.Ten_tour ? `Đang được sử dụng bởi tour: ${row.Ten_tour}` : 'Chưa được sử dụng'
      }));

      res.status(200).json({
        status: 'success',
        results: schedules.length,
        data: schedules
      });
    } catch (error) {
      console.error('Error getting schedules:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy danh sách lịch khởi hành',
        error: error.message
      });
    }
  }

  /**
   * Check database structure (for debugging)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async checkDatabaseStructure(req, res) {
    try {
      console.log('checkDatabaseStructure API called');
      const result = await Tour.checkTableStructure();
      
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      console.error('Error checking database structure:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error checking database structure',
        error: error.message
      });
    }
  }

  /**
   * Get a specific tour directly from tour_du_lich table without joining with dia_danh
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTourDirectFromTable(req, res) {
    try {
      console.log('🔍 getTourDirectFromTable called for ID:', req.params.id);
      
      // Truy vấn trực tiếp từ bảng tour_du_lich không join với bảng dia_danh
      const [rows] = await pool.query(
        `SELECT * FROM tour_du_lich WHERE Ma_tour = ?`,
        [req.params.id]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Không tìm thấy tour'
        });
      }
      
      const tour = rows[0];
      console.log('Dữ liệu tour trực tiếp từ bảng tour_du_lich:', tour);
      console.log('Mô tả tour từ bảng tour_du_lich:', tour.Mo_ta);
      
      res.json({
        status: 'success',
        data: { tour }
      });
    } catch (error) {
      console.error('Error in getTourDirectFromTable:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lỗi khi lấy thông tin tour trực tiếp từ bảng'
      });
    }
  }

  /**
   * Get tours by destination ID
   */
  static async getToursByDestination(req, res) {
      try {
          const { destinationId } = req.params;
          // Lấy danh sách tour nối với chi_tiet_tour_dia_danh
          const [rows] = await pool.query(
              `SELECT t.* FROM tour_du_lich t
               JOIN chi_tiet_tour_dia_danh ctd ON t.Ma_tour = ctd.Ma_tour
               WHERE ctd.Ma_dia_danh = ?`,
              [destinationId]
          );
          res.status(200).json({
              status: 'success',
              data: rows
          });
      } catch (error) {
          console.error('getToursByDestination error:', error);
          res.status(500).json({ status: 'error', message: 'Lỗi khi lấy danh sách tour theo điểm đến', error: error.message });
    }
  }
}

module.exports = TourController;