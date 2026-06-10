// src/controllers/storyController.js
const db = require("../config/db"); // Pool từ db.js (bản mysql2/promise)

/**
 * BƯỚC 1: Khởi tạo bộ truyện thuần túy
 * Lưu thông tin gốc trực tiếp vào MySQL (Bảng stories & story_genres)
 * POST /api/stories/init
 */
exports.initStory = async (req, res) => {
  // Lấy ID động từ authMiddleware đã giải mã token sẵn
  const user_id = req.user.id;

  const { title, description, local_folder_path, genre_ids } = req.body;

  // Kiểm tra dữ liệu đầu vào bắt buộc từ body
  if (!title || !local_folder_path || !genre_ids || genre_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng điền đầy đủ tên truyện, chọn folder lưu trữ và ít nhất một thể loại.",
    });
  }

  try {
    // 1. Lưu thông tin bộ truyện vào bảng 'stories' (status mặc định là DRAFT)
    const [storyResult] = await db.query(
      `INSERT INTO stories (user_id, title, description, local_folder_path, status) 
       VALUES (?, ?, ?, ?, 'DRAFT')`,
      [user_id, title, description || "", local_folder_path],
    );
    const storyId = storyResult.insertId;

    // 2. 🔥 VÁ LỖI: Lưu các thể loại truyện vào bảng trung gian 'story_genres'
    const genreQueries = genre_ids.map((genreId) => {
      return db.query(`INSERT INTO story_genres (story_id, genre_id) VALUES (?, ?)`, [storyId, genreId]);
    });
    await Promise.all(genreQueries);

    // Trả về dữ liệu thành công cho Frontend
    return res.status(201).json({
      success: true,
      message: "Khởi tạo thông tin tác phẩm mới thành công!",
      data: {
        story_id: storyId,
        title: title,
        local_folder_path: local_folder_path,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi tại storyController (initStory):", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống trong quá trình khởi tạo truyện lên Database.",
      error: error.message,
    });
  }
};

/**
 * BƯỚC 2: Lưu kế hoạch phân hồi (Story Planning)
 * Lưu cấu trúc hồi bằng cách sử dụng kết nối đơn (Connection) và kiểm soát lỗi vòng lặp
 * POST /api/stories/approve-planning
 */
exports.approveStoryPlanning = async (req, res) => {
  const { story_id, arcs } = req.body;

  if (!story_id || !Array.isArray(arcs)) {
    return res.status(400).json({ success: false, message: "Dữ liệu cấu trúc hồi không hợp lệ." });
  }

  // Lấy một kết nối duy nhất từ pool để chạy chuỗi truy vấn lặp an toàn
  const connection = await db.getConnection();

  try {
    // Bắt đầu chu kỳ cô lập transaction
    await connection.beginTransaction();

    // Lưu hoặc cập nhật hàng loạt trạng thái phân hồi vào bảng 'story_planning'
    for (const arc of arcs) {
      await connection.query(
        `INSERT INTO story_planning (story_id, part_number, title, plot_summary, climax, is_human_approved) 
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE 
            title = VALUES(title), 
            plot_summary = VALUES(plot_summary), 
            climax = VALUES(climax), 
            is_human_approved = 1`,
        [story_id, arc.part_number, arc.title, arc.plot_summary, arc.climax],
      );
    }

    // Xác nhận lưu dữ liệu nếu không dính lỗi
    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Đã thiết lập cấu trúc phân hồi tác phẩm vào MySQL thành công.",
    });
  } catch (error) {
    // Thu hồi toàn bộ lệnh INSERT dở dang nếu bất kỳ hồi nào dính lỗi
    await connection.rollback();
    console.error("❌ Lỗi tại storyController (approveStoryPlanning):", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi thiết lập cấu trúc cốt truyện.",
      error: error.message,
    });
  } finally {
    // Giải phóng kết nối trả về cho Pool
    connection.release();
  }
};
/**
 * Lấy thông tin 1 truyện theo ID
 * GET /api/stories/:id
 */
exports.getStoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
            SELECT *
            FROM stories
            WHERE id = ?
            `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy truyện",
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("❌ Lỗi getStoryById:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
