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
 * LẤY DANH SÁCH CHƯƠNG CỦA MỘT TRUYỆN (MongoDB)
 * GET /api/chapters/story-chapters?story_id=1
 */
exports.getChaptersByStory = async (req, res) => {
  try {
    const { story_id } = req.query;

    if (!story_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu story_id.",
      });
    }

    const mongoDb = getMongoDb();
    const chapterCollection = mongoDb.collection("chapters_content");

    const chapters = await chapterCollection
      .find(
        { storyId: Number(story_id) },
        {
          projection: {
            storyId: 1,
            chapterNumber: 1,
            title: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            wordCount: 1,
          },
        },
      )
      .sort({ chapterNumber: 1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: chapters.map((ch) => ({
        id: ch._id.toString(),
        storyId: ch.storyId,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        status: ch.status,
        wordCount: ch.wordCount,
        createdAt: ch.createdAt,
        updatedAt: ch.updatedAt,
      })),
    });
  } catch (error) {
    console.error("❌ Lỗi tại getChaptersByStory:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy danh sách chương." });
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
      storyId: Number(story_id),
      chapterNumber: Number(chapter_number),
    };

    console.log("[MongoDB Request Query]:", query);

    const chapter = await chapterCollection.findOne(query);
    console.log("Query:", query);
    console.log("Chapter:", chapter);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: `Chưa có dữ liệu bản thảo cho truyện ID ${story_id} chương ${chapter_number}.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        storyId: chapter.storyId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        content: chapter.content,
        displayContent: chapter.content,
        status: chapter.status,
        wordCount: chapter.wordCount,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
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
