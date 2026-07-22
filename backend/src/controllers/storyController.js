// src/controllers/storyController.js
const db = require("../config/db"); // Pool từ db.js (bản mysql2/promise)
const { getMongoDb } = require("../config/mongo");
const axios = require("axios");
// Lưu thông tin gốc truyện (MySQL)
const saveStory = async (userId, title, description, coverImage) => {
  const [result] = await db.query(
    `
    INSERT INTO stories (user_id, title, description, cover_image, status) 
    VALUES (?, ?, ?, ?, 'DRAFT')
    `,
    [userId, title, description || null, coverImage || null],
  );
  return result.insertId;
};

// Lưu thể loại truyện (Bảng trung gian MySQL)
const saveStoryGenres = async (storyId, genreIds) => {
  if (!genreIds || genreIds.length === 0) return true;

  const values = genreIds.map((genreId) => [storyId, genreId]);

  await db.query(`INSERT INTO story_genres (story_id, genre_id) VALUES ?`, [values]);
  return true;
};

// Khởi tạo khung sườn truyện (MongoDB Native Client)
const initStoryOutline = async (storyId) => {
  // 1. Lấy instance db đã kết nối từ file config của bạn
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Chưa kết nối đến MongoDB Atlas!");
  }

  // 2. Trỏ tới collection 'story_outlines'
  const collection = mongoDb.collection("story_outlines");

  // 3. Thực hiện chèn một bản ghi tài liệu mới có các trường trống đúng đặc tả
  await collection.insertOne({
    storyId: Number(storyId),
    fiveSentences: "",
    onePage: "",
    fourPages: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return true;
};

// =========================================================================
// HÀM TẠO TRUYỆN MỚI
// =========================================================================
exports.createStory = async (req, res) => {
  try {
    const { title, description, genreIds, coverImage } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện chức năng này.",
      });
    }

    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên truyện không được để trống.",
      });
    }

    // Luồng thực thi ngầm
    const storyId = await saveStory(userId, title.trim(), description, coverImage);

    if (genreIds && Array.isArray(genreIds) && genreIds.length > 0) {
      await saveStoryGenres(storyId, genreIds);
    }

    // Gọi hàm khởi tạo Mongo thuần
    await initStoryOutline(storyId);

    return res.status(201).json({
      success: true,
      message: "Khởi tạo truyện mới thành công.",
      storyId: storyId,
    });
  } catch (error) {
    console.error("Lỗi hệ thống tại hàm createStory:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi khởi tạo truyện.",
    });
  }
};

/**
 * Lấy thông tin 1 truyện theo ID
 * GET /api/stories/:id
 */
const findStoryById = async (storyId) => {
  // Thực hiện GROUP_CONCAT để gom danh sách tên thể loại thành 1 chuỗi ngăn cách bởi dấu phẩy
  const [rows] = await db.query(
    `
    SELECT 
      s.id, s.user_id, s.title, s.description, s.cover_image, s.status, s.created_at, s.updated_at,
      GROUP_CONCAT(g.name SEPARATOR ', ') AS genres
    FROM stories s
    LEFT JOIN story_genres sg ON s.id = sg.story_id
    LEFT JOIN genres g ON sg.genre_id = g.id AND g.deleted_at IS NULL
    WHERE s.id = ? AND s.deleted_at IS NULL
    GROUP BY s.id
    `,
    [storyId],
  );

  return rows.length > 0 ? rows[0] : null;
};

const fetchChaptersByStoryId = async (storyId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) return [];

  // Giả định cấu trúc bảng chapters_content lưu theo trường storyId
  // Chỉ lấy trường mã số chương (chapterNumber/chapterIndex) và tên chương (title) theo đặc tả
  const chapters = await mongoDb
    .collection("chapters_content")
    .find({ storyId: Number(storyId) })
    .project({ _id: 0, chapterNumber: 1, title: 1 })
    .sort({ chapterNumber: 1 }) // Sắp xếp theo thứ tự chương tăng dần
    .toArray();

  return chapters;
};

const fetchCharactersByStoryId = async (storyId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) return [];

  // Giả định cấu trúc bảng characters lưu theo trường storyId
  const characters = await mongoDb
    .collection("characters")
    .find({ storyId: Number(storyId) })
    .project({ _id: 0, name: 1, role: 1, description: 1 }) // Lấy các trường thông tin nhân vật hiển thị lên dashboard
    .toArray();

  return characters;
};

exports.getStoryDetails = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id; // Lấy từ authMiddleware xác thực token

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện chức năng này.",
      });
    }

    // 1. Kiểm tra truyện tồn tại & Lấy thông tin gốc (MySQL)
    const storyData = await findStoryById(storyId);

    // Nếu không tồn tại hoặc đã bị xóa mềm (deleted_at IS NOT NULL đã được check trong repo)
    if (!storyData) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy truyện hoặc tác phẩm đã bị xóa.",
      });
    }

    // Kiểm tra quyền: Đảm bảo tác giả chỉ xem được dashboard truyện của chính mình
    if (storyData.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập vào thông tin bộ truyện này.",
      });
    }

    // 2. Lấy danh sách chương để hiển thị thanh sidebar bên trái (MongoDB)
    const chaptersList = await fetchChaptersByStoryId(storyId);

    // 3. Lấy danh sách nhân vật thuộc truyện (MongoDB)
    const charactersList = await fetchCharactersByStoryId(storyId);

    // 4. Đóng gói dữ liệu (Aggregation) thành một Object JSON duy nhất đúng đặc tả trả về Client
    const storyDetail = {
      ...storyData, // Thông tin cơ bản truyện (MySQL)
      chapters: chaptersList, // Mảng danh sách chương (MongoDB)
      characters: charactersList, // Mảng danh sách nhân vật (MongoDB)
    };

    return res.status(200).json({
      success: true,
      message: "Tải thông tin chi tiết Dashboard truyện thành công.",
      data: storyDetail,
    });
  } catch (error) {
    console.error("❌ Lỗi hệ thống tại hàm getStoryDetails:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tải thông tin chi tiết tác phẩm.",
    });
  }
};

/**
 * 1. API Lấy danh sách truyện của riêng User đang đăng nhập
 * GET /api/stories/list
 */
exports.getStories = async (req, res) => {
  try {
    // Lấy ID từ token (authMiddleware đã giải mã và gán vào req.user)
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin tác giả. Vui lòng đăng nhập lại.",
      });
    }

    const [rows] = await db.query(
      `SELECT id, user_id, title, description, cover_image, status
       FROM stories
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY id DESC`,
      [user_id],
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Lỗi tại getStories theo tác giả:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy danh sách truyện." });
  }
};

const saveUpdatedStory = async (connection, storyId, title, description, coverImage) => {
  const [result] = await connection.query(
    `
    UPDATE stories 
    SET title = ?, description = ?, cover_image = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ? AND deleted_at IS NULL
    `,
    [title, description, coverImage || null, storyId],
  );
  return result.affectedRows;
};

//Chỉnh sửa truyện
exports.updateStory = async (req, res) => {
  // Lấy một kết nối riêng biệt từ Pool để quản lý chuỗi lệnh Transaction an toàn
  const connection = await db.getConnection();

  try {
    const { storyId } = req.params;
    const { title, description, coverImage, genreIds } = req.body;
    const userId = req.user?.id; // Lấy từ authMiddleware xác thực tác giả

    // 1. Kiểm tra xác thực người dùng
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện chức năng này.",
      });
    }

    // 2. Kiểm tra dữ liệu đầu vào bắt buộc
    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên truyện không được để trống.",
      });
    }

    // 3. KIỂM TRA TRUYỆN TỒN TẠI VÀ QUYỀN SỞ HỮU
    const [storyRows] = await connection.query(`SELECT id, user_id FROM stories WHERE id = ? AND deleted_at IS NULL`, [storyId]);

    if (storyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tác phẩm hoặc truyện đã bị xóa khỏi hệ thống.",
      });
    }

    if (storyRows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa tác phẩm này.",
      });
    }

    // KÍCH HOẠT TRANSACTION
    await connection.beginTransaction();

    // 4. CẬP NHẬT THÔNG TIN GỐC (Gọi hàm repository nội bộ)
    const affectedRows = await saveUpdatedStory(connection, storyId, title.trim(), description, coverImage);

    // 5. CẬP NHẬT THỂ LOẠI (BẢNG TRUNG GIAN)
    // Bước A: Xóa toàn bộ liên kết thể loại cũ của bộ truyện này
    await connection.query(`DELETE FROM story_genres WHERE story_id = ?`, [storyId]);

    // Bước B: Chèn lại các cặp liên kết mới nếu mảng genreIds hợp lệ
    if (genreIds && Array.isArray(genreIds) && genreIds.length > 0) {
      const values = genreIds.map((genreId) => [storyId, genreId]);
      await connection.query(`INSERT INTO story_genres (story_id, genre_id) VALUES ?`, [values]);
    }

    // XÁC NHẬN HOÀN THÀNH GHI DỮ LIỆU VÀO DATABASE
    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin tác phẩm thành công.",
    });
  } catch (error) {
    // NẾU CÓ BẤT KỲ LỖI NÀO XẢY RA, HOÀN TÁC TOÀN BỘ LẬP TỨC
    await connection.rollback();

    console.error("❌ Lỗi hệ thống tại hàm updateStory:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật tác phẩm.",
    });
  } finally {
    // Giải phóng kết nối trả về lại cho Pool quản lý
    connection.release();
  }
};

/**
 * API XÓA MỀM TÁC PHẨM (Soft Delete)
 * DELETE /api/stories/:storyId
 */
exports.deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id; // Lấy từ authMiddleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện hành động này.",
      });
    }

    // 1. Kiểm tra truyện tồn tại và xác thực quyền sở hữu của chính tác giả đó
    const [storyRows] = await db.query(`SELECT id, user_id FROM stories WHERE id = ? AND deleted_at IS NULL`, [storyId]);

    if (storyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tác phẩm không tồn tại hoặc đã bị xóa trước đó.",
      });
    }

    if (storyRows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa tác phẩm này.",
      });
    }

    // 2. Thực thi lệnh xóa mềm trong MySQL
    await db.query(`UPDATE stories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [storyId]);

    return res.status(200).json({
      success: true,
      message: "Đã xóa tác phẩm thành công vào kho lưu trữ.",
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm deleteStory:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi thực hiện xóa tác phẩm.",
    });
  }
};

//Tìm kiếm
exports.searchStories = async (req, res) => {
  try {
    const userId = req.user?.id; // Giải mã từ authMiddleware để đảm bảo tác giả chỉ tìm truyện của họ

    // Tiếp nhận từ khóa từ textbox và genreId từ bộ lọc giao diện gửi lên qua Query String
    const { keyword, genreId } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    // Thực hiện chuẩn hóa chuỗi (Cắt bỏ các khoảng trắng thừa ở hai đầu)
    const cleanKeyword = keyword ? keyword.trim() : "";

    // Gọi xuống hàm quy hoạch Database để xử lý truy vấn động
    const storiesList = await queryStories(userId, cleanKeyword, genreId);

    // Trả kết quả bọc trong mảng 'data' đúng đặc tả cấu trúc Frontend của bạn
    return res.status(200).json({
      success: true,
      results: storiesList, // Thỏa mãn Output đặc tả 'results: Array'
      data: storiesList, // Đồng bộ với cấu trúc Axios Front-end đang dùng
    });
  } catch (error) {
    console.error("❌ Lỗi nghiệp vụ tại hàm searchStories:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi thực hiện tìm kiếm tác phẩm.",
    });
  }
};

// ======================================================================
// AI ĐẢO NGƯỢC Ý TƯỞNG TỪ MÔ TẢ TRUYỆN (POST /api/stories/:storyId/reverse-description)
// ======================================================================
exports.reverseDescriptionController = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id; // Lấy ID tác giả từ authMiddleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    if (!storyId || isNaN(Number(storyId))) {
      return res.status(400).json({
        success: false,
        message: "Mã tác phẩm không hợp lệ.",
      });
    }

    // 1. Kiểm tra sự tồn tại của tác phẩm trong MySQL Database
    const [rows] = await db.query("SELECT id, title, description FROM stories WHERE id = ? AND user_id = ? AND deleted_at IS NULL", [storyId, userId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tác phẩm trong hệ thống hoặc bạn không có quyền truy cập.",
      });
    }

    const story = rows[0];

    // 2. Chuẩn hóa chuỗi mô tả (Ưu tiên lấy mô tả mới từ req.body gửi lên, nếu không có thì dùng từ DB)
    const rawDescription = req.body?.description || story.description || "";
    const cleanDescription = rawDescription.trim();

    if (!cleanDescription) {
      return res.status(400).json({
        success: false,
        message: "Tác phẩm chưa có nội dung mô tả để thực hiện đảo ngược.",
      });
    }

    // 3. Gọi sang Webhook n8n / Service AI để xử lý đảo ngược ý tưởng
    let reverseDescription = "";
    try {
      const n8nWebhookUrl = process.env.N8N_REVERSE_WEBHOOK_URL || "https://n8n.baostory.fun/webhook/reverse-description";

      const aiResponse = await axios.post(
        n8nWebhookUrl,
        {
          storyId: Number(storyId),
          userId: Number(userId),
          title: story.title,
          description: cleanDescription,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000, // Timeout 30 giây chờ AI phản hồi
        },
      );

      // Trích xuất kết quả linh hoạt từ n8n (hỗ trợ cả dạng root và dạng bọc trong object data)
      reverseDescription = aiResponse.data?.reverseDescription || aiResponse.data?.data?.reverseDescription || "";
    } catch (aiError) {
      console.error("❌ Lỗi khi kết nối tới Webhook n8n AI:", aiError.message);
      return res.status(502).json({
        success: false,
        message: "Dịch vụ AI hiện không phản hồi. Vui lòng thử lại sau.",
      });
    }

    if (!reverseDescription) {
      return res.status(502).json({
        success: false,
        message: "Dịch vụ AI không thể xử lý nội dung này.",
      });
    }

    // 4. (Tùy chọn) Lưu vết nhật ký AI reverse vào MongoDB nếu cần
    try {
      const mongoDb = getMongoDb();
      if (mongoDb) {
        await mongoDb.collection("story_ai_logs").insertOne({
          story_id: Number(storyId),
          user_id: Number(userId),
          original_description: cleanDescription,
          reverse_description: reverseDescription,
          created_at: new Date(),
        });
      }
    } catch (mongoErr) {
      console.warn("⚠️ Không thể lưu log AI vào MongoDB:", mongoErr.message);
    }

    // 5. Trả kết quả bọc trong 'data' đúng đặc tả cấu trúc Frontend của bạn
    const resultData = {
      storyId: Number(storyId),
      reverseDescription: reverseDescription,
      updatedAt: new Date().toISOString(),
    };

    return res.status(200).json({
      success: true,
      message: "Đảo ngược ý tưởng thành công.",
      data: resultData, // Thỏa mãn đồng bộ với Axios Front-end đang dùng (res.data.data)
    });
  } catch (error) {
    console.error("❌ Lỗi nghiệp vụ tại hàm reverseDescriptionController:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi thực hiện đảo ngược ý tưởng tác phẩm.",
    });
  }
};
