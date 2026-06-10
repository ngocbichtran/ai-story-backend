// src/controllers/storyController.js
const db = require("../config/db"); // Pool từ db.js (Bản mysql2/promise thuần, KHÔNG dùng .promise())
const { getMongoDb } = require("../config/mongo"); // Kết nối MongoDB Atlas

/**
 * API Lấy danh sách truyện của riêng User đang đăng nhập
 * GET /api/chapters/stories
 */
exports.getStories = async (req, res) => {
  try {
    // 1. LẤY ID TỪ TOKEN: authMiddleware giải mã (Check cả 3 trường hợp đặt tên thông dụng)
    const user_id = req.user.id;
    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin tác giả. Vui lòng đăng nhập lại.",
      });
    }

    const [rows] = await db.query(
      `SELECT id, user_id, title, description, cover_image, status
   FROM stories
   WHERE user_id = ?
   ORDER BY id DESC`,
      [user_id],
    );

    // 3. TRẢ VỀ: Đúng cấu trúc bọc trong 'data'
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Lỗi tại getUserStories theo tác giả:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy danh sách truyện." });
  }
};

/**
 * LẤY MỤC LỤC CHƯƠNG CỦA MỘT TRUYỆN (Từ MySQL bảng chapters_index)
 * GET /api/chapters/story-chapters?story_id=1
 */
exports.getChaptersByStory = async (req, res) => {
  try {
    const { story_id } = req.query;

    if (!story_id) {
      return res.status(400).json({ success: false, message: "Thiếu story_id." });
    }

    const [rows] = await db.query(
      `SELECT id, story_id, chapter_number, title, status 
        FROM chapters_index 
        WHERE story_id = ? 
        ORDER BY chapter_number ASC`,
      [Number(story_id)],
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Lỗi getChaptersByStory:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi lấy mục lục chương." });
  }
};

/**
 * LẤY CHI TIẾT NỘI DUNG CHƯƠNG (Từ MongoDB)
 * GET /api/chapters/display-chapter?story_id=1&chapter_number=1
 */
exports.getDisplayChapter = async (req, res) => {
  try {
    const { story_id, chapter_number } = req.query;

    if (!story_id || !chapter_number) {
      return res.status(400).json({
        success: false,
        message: "Thiếu story_id hoặc chapter_number để truy vấn.",
      });
    }

    const mongoDb = getMongoDb();
    const chapterCollection = mongoDb.collection("chapters_content");

    // ÉP KIỂU CẢ 2 VỀ NUMBER ĐỂ KHỚP VỚI INT32 TRONG MONGO
    const query = {
      story_id: Number(story_id),
      chapter_number: Number(chapter_number),
    };

    console.log("[MongoDB Request Query]:", query);

    const chapter = await chapterCollection.findOne(query);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: `Chưa có dữ liệu bản thảo cho truyện ID ${story_id} chương ${chapter_number}.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        story_id: chapter.story_id,
        chapter_number: chapter.chapter_number,
        status: chapter.status || "EDITING",
        displayContent: chapter.editedContent || chapter.content || "",
        summary: chapter.summary || "",
        imagePrompt: chapter.imagePrompt || "",
      },
    });
  } catch (error) {
    console.error("====== LỖI TRUY VẤN MONGODB ======");
    console.error(error);
    return res.status(500).json({
      success: false,
      error: "Lỗi hệ thống khi lấy dữ liệu chương.",
      details: error.message,
    });
  }
};
