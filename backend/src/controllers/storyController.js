// src/controllers/storyController.js
const db = require("../config/db"); // Pool từ db.js (bản mysql2/promise)
const { getMongoDb } = require("../config/mongo");

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

/**
 * 2. LẤY DANH SÁCH CHƯƠNG CỦA MỘT TRUYỆN (MongoDB)
 * Đồng bộ Restful URL: GET /api/stories/:storyId/chapters
 */
exports.getChaptersByStory = async (req, res) => {
  try {
    // 1. Lấy storyId từ URL Params theo đúng cấu trúc tuyến đường Restful
    const storyId = req.params.storyId;

    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh tác phẩm (storyId) trên URL.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({ success: false, message: "Mất kết nối dữ liệu MongoDB Atlas." });
    }

    const chapterCollection = mongoDb.collection("chapters_content");

    // 2. Truy vấn dữ liệu chương từ MongoDB Atlas
    // 🌟 SỬA TẠI ĐÂY: Chuyển đổi query điều kiện và projection sang dạng snake_case (story_id, chapter_number) để khớp database Atlas
    const chapters = await chapterCollection
      .find(
        { story_id: Number(storyId) },
        {
          projection: {
            story_id: 1,
            chapter_number: 1,
            title: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            wordCount: 1,
          },
        },
      )
      .sort({ chapter_number: 1 }) // Sắp xếp tăng dần theo chuẩn trường database
      .toArray();

    // 3. Map dữ liệu phản hồi về phía React Frontend
    // 🌟 ĐỒNG BỘ: Chuyển đổi key từ snake_case của database sang camelCase (chapterNumber, storyId) cho Frontend đọc
    const responseData = chapters.map((ch) => ({
      id: ch._id.toString(),
      storyId: ch.story_id,
      chapterNumber: ch.chapter_number, // Khớp chính xác với chapter.chapterNumber trong file LeftSidebar.jsx
      title: ch.title || "",
      status: ch.status || "DRAFT",
      wordCount: ch.wordCount || 0,
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Lỗi tại getChaptersByStory:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy danh sách chương." });
  }
};

/**
 * 3. LẤY CHI TIẾT NỘI DUNG CHƯƠNG (Từ MongoDB)
 * Đã sửa: Chuyển hoàn toàn sang đọc từ URL Params (/:storyId/chapters/:chapterNumber)
 */
exports.getDisplayChapter = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.params;

    if (!storyId || !chapterNumber) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin định danh tác phẩm hoặc số chương.",
      });
    }

    const mongoDb = getMongoDb();
    const chapterCollection = mongoDb.collection("chapters_content");

    // Ép kiểu bắt buộc để khớp với kiểu dữ liệu số nguyên trong cơ sở dữ liệu Mongo
    const query = {
      storyId: Number(storyId),
      chapterNumber: Number(chapterNumber),
    };

    const chapter = await chapterCollection.findOne(query);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: `Chưa có dữ liệu bản thảo cho tác phẩm này (Chương ${chapterNumber}).`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: chapter._id.toString(),
        storyId: chapter.storyId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title || `Chương ${chapter.chapterNumber}`,
        content: chapter.content || "",
        displayContent: chapter.content || "",
        status: chapter.status || "DRAFT",
        wordCount: chapter.wordCount || 0,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi hệ thống khi tìm chương (MongoDB):", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy dữ liệu chương.",
    });
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
