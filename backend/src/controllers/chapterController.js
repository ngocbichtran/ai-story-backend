// 1. ĐƯA TẤT CẢ REQUIRE LÊN ĐẦU FILE (Tránh tuyệt đối lỗi cú pháp)
const db = require("../config/db");
const { getMongoDb } = require("../config/mongo"); // Thư viện kết nối MongoDB Atlas đám mây
const n8nService = require("../services/n8nService");

/**
 * Biên tập sửa lỗi chính tả (ĐỒNG BỘ XUỐNG MONGODB ATLAS VÀ PHẢN HỒI QUA N8N)
 * POST /api/ai/chapters/:id/spell-check
 */
exports.spellCheck = async (req, res) => {
  const chapterId = req.params.id;
  // ĐỒNG BỘ HOÀN TOÀN: Nhận bộ ba khóa tổ hợp độc lập cùng key 'content' từ Frontend
  const { story_id, chapter_number, content } = req.body;

  if (!story_id || !chapter_number || !content) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin story_id, chapter_number hoặc nội dung bản nháp." });
  }

  try {
    // 1. Kiểm tra mục lục chương gồm ID này có tồn tại hợp lệ bên MySQL không
    const [chapterRows] = await db.query(`SELECT id FROM stories WHERE id = ?`, [chapterId]);
    if (chapterRows.length === 0) {
      return res.status(444).json({ success: false, error: `Không tìm thấy chương ứng với ID mục lục: ${chapterId}` });
    }

    // 2. ĐỒNG BỘ TRỰC TIẾP DỮ LIỆU THÔ XUỐNG MONGODB ATLAS
    const mongoDb = getMongoDb();
    const chapterCollection = mongoDb.collection("chapters_content"); // Tên Collection chuẩn xác của bạn trên Atlas

    const queryCondition = { story_id: Number(story_id), chapter_number: Number(chapter_number) };
    const chapterDocument = await chapterCollection.findOne(queryCondition);

    if (!chapterDocument) {
      // Nếu chưa có tài liệu văn bản -> Tiến hành insert khởi tạo mới dữ liệu thô
      await chapterCollection.insertOne({
        ...queryCondition,
        content: content,
        created_at: new Date(),
      });
      console.log(`[MongoDB Atlas] ➕ Đã khởi tạo mới văn bản gốc cho chương ${chapter_number}`);
    } else {
      // Nếu có sẵn trên Atlas -> Đồng bộ cập nhật đè nội dung chữ mới nhất vừa gõ
      await chapterCollection.updateOne(queryCondition, {
        $set: { content: content, updated_at: new Date() },
      });
      console.log(`[MongoDB Atlas] 🔄 Đã đồng bộ cập nhật bản thảo thô cho chương ${chapter_number}`);
    }

    // 3. Tiến hành đóng gói ném dữ liệu thô sang n8n Webhook Production nhờ AI chuốt chữ
    const N8N_EDIT_ART_URL = process.env.N8N_EDIT_ART_URL;
    let polishedText = content;
    let finalStatus = "EDITING";

    if (N8N_EDIT_ART_URL) {
      const n8nPayload = {
        story_id: Number(story_id),
        chapter_number: Number(chapter_number),
        content, // Bắn đúng key 'content' đồng bộ sang n8n
      };

      const n8nResponse = await n8nService.triggerN8nWorkflow(N8N_EDIT_ART_URL, n8nPayload);

      if (n8nResponse) {
        const resData = Array.isArray(n8nResponse) ? n8nResponse[0] : n8nResponse;

        // Nhận key 'editedContent' và động thái cập nhật 'status' từ phản hồi của n8n
        polishedText = resData.editedContent || content;
        if (resData.status) {
          finalStatus = resData.status;
        }
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      polishedText = content + `\n\n*(Đã được AI rà soát lỗi chính tả Chương ${chapter_number} - Chế độ Mockup)*`;
    }

    // 4. Đồng bộ cập nhật lại trạng thái quản lý của mục lục bên phía MySQL
    await db.query(`UPDATE chapters_index SET status = ? WHERE id = ?`, [finalStatus, chapterId]);

    return res.status(200).json({
      success: true,
      message: "Biên tập sửa lỗi chính tả và đồng bộ đám mây thành công.",
      data: {
        story_id: Number(story_id),
        chapter_number: Number(chapter_number),
        status: finalStatus,
        polished_content: polishedText, // Trả văn bản đã chuốt về cho tác giả hiển thị
      },
    });
  } catch (error) {
    console.error("Lỗi tại hàm spellCheck:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

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

    // Kiểm tra đủ cả 3 tham số (storyId từ params, 2 cái còn lại từ body)
    if (!storyId || !chapterNumber || !title) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin đầu vào bắt buộc (storyId, chapter_number, title).",
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

    // 3. Kiểm tra trùng lặp dựa trên định dạng quy chuẩn { story_id, chapter_number }
    const duplicateChapter = await collection.findOne({
      story_id: cleanStoryId,
      chapter_number: cleanChapterNumber,
    });

    if (duplicateChapter !== null) {
      return res.status(400).json({
        success: false,
        message: `Số chương ${cleanChapterNumber} đã tồn tại trong bộ truyện này.`,
      });
    }

    // 4. Khởi tạo cấu trúc tài liệu lưu vào MongoDB Atlas
    const newChapter = {
      story_id: cleanStoryId,
      chapter_number: cleanChapterNumber,
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
 * 3. XÓA CHƯƠNG MỀM VÀ TỰ ĐỘNG DỒN SỐ THỨ TỰ CHƯƠNG (MongoDB Atlas)
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
      return res.status(500).json({ success: false, message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB)." });
    }
    const collection = mongoDb.collection("chapters_content");

    // BƯỚC 1: Thực hiện xóa mềm chương được chọn bằng cách cập nhật deleted_at
    // Hoặc nếu bạn muốn xóa hẳn chương đó ở Mongo và dồn số các chương sau, dùng deleteOne:
    const deleteResult = await collection.deleteOne({
      story_id: cleanStoryId,
      chapter_number: cleanChapterNumber,
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chương số ${cleanChapterNumber} để xử lý xóa.`,
      });
    }

    // BƯỚC 2: TỰ ĐỘNG DỒN SỐ CHƯƠNG PHÍA SAU (Đồng bộ thứ tự liên tục)
    // Tìm toàn bộ chương có 'chapter_number' LỚN HƠN chương vừa xóa (> cleanChapterNumber)
    // Thực hiện trừ đi 1 đơn vị bằng toán tử $inc
    await collection.updateMany(
      {
        story_id: cleanStoryId,
        chapter_number: { $gt: cleanChapterNumber }, // $gt: Greater Than (Lớn hơn)
      },
      {
        $inc: { chapter_number: -1 }, // Giảm số chương đi 1
        $set: { updatedAt: new Date() },
      },
    );

    // BƯỚC 3: (Tùy chọn) Nếu bạn có quản lý bảng mục lục bên MySQL (Ví dụ: chapters_index)
    // Bạn chạy thêm lệnh xóa mềm hoặc xóa hẳn tương ứng:
    // await db.query("DELETE FROM chapters_index WHERE story_id = ? AND chapter_number = ?", [cleanStoryId, cleanChapterNumber]);

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
