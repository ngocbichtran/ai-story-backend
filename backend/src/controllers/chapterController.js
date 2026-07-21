// 1. ĐƯA TẤT CẢ REQUIRE LÊN ĐẦU FILE (Tránh tuyệt đối lỗi cú pháp)
const db = require("../config/db");
const { getMongoDb } = require("../config/mongo"); // Thư viện kết nối MongoDB Atlas đám mây
const n8nService = require("../services/n8nService");

// Các hàm liên quan đến chương
/**
 * KHỞI TẠO CHƯƠNG MỚI (ĐỒNG BỘ THEO ROUTE RESTFUL PARAMS)
 * POST /api/stories/:storyId/chapters
 */
exports.createChapter = async (req, res) => {
  try {
    const { storyId } = req.params;

    // Các tham số còn lại vẫn lấy từ body do Frontend gửi lên
    const chapterNumber = req.body.chapterNumber || req.body.chapter_number;
    const { title } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    // Kiểm tra đủ cả 3 tham số
    if (!storyId || !chapterNumber || !title) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin đầu vào bắt buộc (storyId, chapterNumber, title).",
      });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    // 2. Kiểm tra truyện tồn tại (MySQL)
    const [storyCheck] = await db.query("SELECT COUNT(*) as count FROM stories WHERE id = ? AND deleted_at IS NULL", [cleanStoryId]);

    if (storyCheck[0].count === 0) {
      return res.status(404).json({
        success: false,
        message: "Bộ truyện không tồn tại trên hệ thống hoặc đã bị xóa.",
      });
    }

    // Kết nối đến Collection MongoDB
    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }
    const collection = mongoDb.collection("chapters_content");

    // 3. Kiểm tra trùng lặp dựa trên định dạng camelCase { storyId, chapterNumber }
    const duplicateChapter = await collection.findOne({
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
    });

    if (duplicateChapter !== null) {
      return res.status(400).json({
        success: false,
        message: `Số chương ${cleanChapterNumber} đã tồn tại trong bộ truyện này.`,
      });
    }

    // 4. Khởi tạo cấu trúc tài liệu lưu vào MongoDB Atlas (Thống nhất camelCase)
    const newChapter = {
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
      title: title.trim(),
      content: "",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(newChapter);

    // 5. Output phản hồi và trả dữ liệu cấu trúc chuẩn cho Frontend
    return res.status(201).json({
      success: true,
      message: "Create chapter success",
      chapterId: result.insertedId.toString(),
      data: {
        id: result.insertedId.toString(),
        storyId: cleanStoryId,
        chapterNumber: cleanChapterNumber,
        title: title.trim(),
      },
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm createChapter:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi khởi tạo chương truyện mới.",
    });
  }
};

/**
 * LẤY CHI TIẾT NỘI DUNG CHƯƠNG (Từ MongoDB)
 * URL Params: /:storyId/chapters/:chapterNumber
 */
exports.getDisplayChapter = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.params;

    if (!storyId || !chapterNumber) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin storyId hoặc chapterNumber.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const chapterCollection = mongoDb.collection("chapters_content");

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    // BẬC BẢO VỆ 1: Tìm bằng kiểu Number (Chuẩn dữ liệu mới)
    let chapter = await chapterCollection.findOne({
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
    });

    // BẬC BẢO VỆ 2: Fallback tìm trường hợp dữ liệu cũ còn sót lại field snake_case
    if (!chapter) {
      chapter = await chapterCollection.findOne({
        $or: [
          { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
          { storyId: String(storyId), chapterNumber: String(chapterNumber) },
        ],
      });
    }

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy nội dung cho Chương ${chapterNumber} (Story ID: ${storyId}).`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: chapter._id.toString(),
        storyId: chapter.storyId || chapter.story_id,
        chapterNumber: chapter.chapterNumber || chapter.chapter_number,
        title: chapter.title || `Chương ${chapter.chapterNumber || chapter.chapter_number}`,
        content: chapter.content || "",
        displayContent: chapter.content || "",
        status: chapter.status || "DRAFT",
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi getDisplayChapter:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy dữ liệu chương.",
    });
  }
};

/**
 * XÓA CHƯƠNG MỀM VÀ TỰ ĐỘNG DỒN SỐ THỨ TỰ CHƯƠNG (MongoDB Atlas)
 * DELETE /api/stories/:storyId/chapters/:chapterNumber
 */
exports.deleteChapterSoft = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }
    const collection = mongoDb.collection("chapters_content");

    // BƯỚC 1: Thực hiện xóa chương được chọn
    const deleteResult = await collection.deleteOne({
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chương số ${cleanChapterNumber} để xử lý xóa.`,
      });
    }

    // BƯỚC 2: TỰ ĐỘNG DỒN SỐ CHƯƠNG PHÍA SAU (Dùng camelCase: chapterNumber)
    await collection.updateMany(
      {
        storyId: cleanStoryId,
        chapterNumber: { $gt: cleanChapterNumber },
      },
      {
        $inc: { chapterNumber: -1 },
        $set: { updatedAt: new Date() },
      },
    );

    return res.status(200).json({
      success: true,
      message: `Đã xóa chương ${cleanChapterNumber} và tự động dồn số thứ tự các chương sau thành công.`,
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm deleteChapterSoft:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi thực hiện xóa chương.",
    });
  }
};

/**
 * LẤY DANH SÁCH CHƯƠNG CỦA MỘT TRUYỆN (MongoDB)
 * GET /api/chapters/:storyId/chapters
 */
/**
 * LẤY DANH SÁCH CHƯƠNG CỦA MỘT TRUYỆN (MongoDB)
 * GET /api/chapters/:storyId/chapters
 */
exports.getChaptersByStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    if (!storyId || storyId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh tác phẩm (storyId) hợp lệ trên URL.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu MongoDB Atlas.",
      });
    }

    const chapterCollection = mongoDb.collection("chapters_content");
    const numStoryId = Number(storyId);

    // 🔍 TRUY VẤN LINH HOẠT: Khắc phục triệt để lỗi ép kiểu & tương thích dữ liệu cũ
    const queryCondition = {
      $or: [
        { storyId: numStoryId }, // camelCase dạng Number (Chuẩn mới)
        { storyId: String(storyId) }, // camelCase dạng String
        { story_id: numStoryId }, // snake_case dạng Number (Dữ liệu cũ)
        { story_id: String(storyId) }, // snake_case dạng String
      ],
    };

    const chapters = await chapterCollection
      .find(queryCondition)
      .sort({ chapterNumber: 1, chapter_number: 1 }) // Sắp xếp tăng dần
      .toArray();

    // 🔄 MAP DỮ LIỆU CHUẨN VỀ CAMELCASE CHO FRONTEND
    const responseData = chapters.map((ch) => ({
      id: ch._id.toString(),
      storyId: ch.storyId ?? ch.story_id,
      chapterNumber: ch.chapterNumber ?? ch.chapter_number ?? 0,
      title: ch.title || "",
      status: ch.status || "DRAFT",
      wordCount: ch.wordCount || 0,
      createdAt: ch.createdAt || ch.created_at,
      updatedAt: ch.updatedAt || ch.updated_at,
    }));

    return res.status(200).json({
      success: true,
      count: responseData.length,
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Lỗi tại getChaptersByStory:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách chương.",
    });
  }
};

// N8N
/**
 * Biên tập sửa lỗi chính tả (ĐỒNG BỘ XUỐNG MONGODB ATLAS VÀ PHẢN HỒI QUA N8N)
 * POST /api/ai/chapters/:id/spell-check
 */
exports.spellCheck = async (req, res) => {
  const chapterId = req.params.id;

  // Hỗ trợ cả camelCase (ưu tiên) và snake_case gửi từ client lên
  const storyId = req.body.storyId || req.body.story_id;
  const chapterNumber = req.body.chapterNumber || req.body.chapter_number;
  const { content } = req.body;

  if (!storyId || !chapterNumber || !content) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin storyId, chapterNumber hoặc nội dung bản nháp." });
  }

  try {
    // 1. Kiểm tra mục lục chương gồm ID này có tồn tại hợp lệ bên MySQL không
    const [chapterRows] = await db.query(`SELECT id FROM stories WHERE id = ?`, [chapterId]);
    if (chapterRows.length === 0) {
      return res.status(404).json({ success: false, error: `Không tìm thấy chương ứng với ID mục lục: ${chapterId}` });
    }

    // 2. ĐỒNG BỘ TRỰC TIẾP DỮ LIỆU THÔ XUỐNG MONGODB ATLAS (Dùng camelCase)
    const mongoDb = getMongoDb();
    const chapterCollection = mongoDb.collection("chapters_content");

    const queryCondition = { storyId: Number(storyId), chapterNumber: Number(chapterNumber) };
    const chapterDocument = await chapterCollection.findOne(queryCondition);

    if (!chapterDocument) {
      await chapterCollection.insertOne({
        ...queryCondition,
        content: content,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`[MongoDB Atlas] ➕ Đã khởi tạo mới văn bản gốc cho chương ${chapterNumber}`);
    } else {
      await chapterCollection.updateOne(queryCondition, {
        $set: { content: content, updatedAt: new Date() },
      });
      console.log(`[MongoDB Atlas] 🔄 Đã đồng bộ cập nhật bản thảo thô cho chương ${chapterNumber}`);
    }

    // 3. Tiến hành đóng gói ném dữ liệu thô sang n8n Webhook Production
    const N8N_EDIT_ART_URL = process.env.N8N_EDIT_ART_URL;
    let polishedText = content;
    let finalStatus = "EDITING";

    if (N8N_EDIT_ART_URL) {
      const n8nPayload = {
        storyId: Number(storyId),
        chapterNumber: Number(chapterNumber),
        content,
      };

      const n8nResponse = await n8nService.triggerN8nWorkflow(N8N_EDIT_ART_URL, n8nPayload);

      if (n8nResponse) {
        const resData = Array.isArray(n8nResponse) ? n8nResponse[0] : n8nResponse;
        polishedText = resData.editedContent || content;
        if (resData.status) {
          finalStatus = resData.status;
        }
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      polishedText = content + `\n\n*(Đã được AI rà soát lỗi chính tả Chương ${chapterNumber} - Chế độ Mockup)*`;
    }

    // 4. Cập nhật lại trạng thái quản lý của mục lục bên phía MySQL
    await db.query(`UPDATE chapters_index SET status = ? WHERE id = ?`, [finalStatus, chapterId]);

    return res.status(200).json({
      success: true,
      message: "Biên tập sửa lỗi chính tả và đồng bộ đám mây thành công.",
      data: {
        storyId: Number(storyId),
        chapterNumber: Number(chapterNumber),
        status: finalStatus,
        polishedContent: polishedText,
      },
    });
  } catch (error) {
    console.error("Lỗi tại hàm spellCheck:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
