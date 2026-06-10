// 1. ĐƯA TẤT CẢ REQUIRE LÊN ĐẦU FILE (Tránh tuyệt đối lỗi cú pháp)
const db = require("../config/db");
const { getMongoDb } = require("../config/mongo"); // Thư viện kết nối MongoDB Atlas đám mây
const n8nService = require("../services/n8nService");
const fileService = require("../services/fileService"); // Thư viện xử lý file vật lý

/**
 * BƯỚC 5: Lên dàn ý cuốn chiếu cho một chương mới
 * POST /api/chapters/create-outline
 */
exports.createOutline = async (req, res) => {
  const { story_id, chapter_number, title, outline_objectives, outline_conflicts, outline_results } = req.body;

  if (!story_id || !chapter_number || !title) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin ID truyện, số chương hoặc tiêu đề." });
  }

  try {
    const [result] = await db.promise().query(
      `INSERT INTO chapters_index (story_id, chapter_number, title, outline_objectives, outline_conflicts, outline_results, status, is_outline_approved) 
       VALUES (?, ?, ?, ?, ?, ?, 'OUTLINE', 1)`,
      [Number(story_id), Number(chapter_number), title, outline_objectives || "", outline_conflicts || "", outline_results || ""],
    );

    return res.status(201).json({
      success: true,
      message: "Đã khởi tạo chương và chốt dàn ý thành công.",
      chapter_id: result.insertId,
    });
  } catch (error) {
    console.error("Lỗi createOutline:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, message: "Số chương này đã tồn tại trong truyện." });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * BƯỚC 7: Kiểm tra tính nhất quán (Canon & Consistency Check)
 * POST /api/chapters/:id/check-consistency
 */
exports.checkConsistency = async (req, res) => {
  const chapterId = req.params.id;
  const { content, story_id } = req.body; // ĐỒNG BỘ KEY: Sử dụng 'content' thay cho 'draft_content'

  if (!content) {
    return res.status(400).json({ success: false, message: "Nội dung bản nháp trống, không thể kiểm tra." });
  }

  try {
    const [chapterRows] = await db.promise().query(`SELECT chapter_number FROM chapters_index WHERE id = ?`, [chapterId]);

    if (chapterRows.length === 0) {
      return res.status(444).json({ success: false, error: `Không tìm thấy chương ứng với ID: ${chapterId}` });
    }
    const chapter_number = chapterRows[0].chapter_number;

    const [characters] = await db.promise().query(`SELECT name FROM story_characters WHERE story_id = ?`, [Number(story_id)]);
    const [worldEntities] = await db.promise().query(`SELECT entity_name FROM world_building WHERE story_id = ?`, [Number(story_id)]);

    const validCharacters = characters.map((c) => c.name);
    const validEntities = worldEntities.map((w) => w.entity_name);

    const N8N_CANON_CHECK_URL = process.env.N8N_CANON_CHECK_URL;
    let highlightTags = [];

    if (N8N_CANON_CHECK_URL) {
      const n8nPayload = {
        story_id: Number(story_id),
        chapter_number: Number(chapter_number),
        content,
        valid_characters: validCharacters,
        valid_entities: validEntities,
      };
      const n8nResponse = await n8nService.triggerN8nWorkflow(N8N_CANON_CHECK_URL, n8nPayload);
      if (n8nResponse && Array.isArray(n8nResponse.suspicious_words)) {
        highlightTags = n8nResponse.suspicious_words;
      }
    } else {
      console.log(`[Mockup AI] Đang quét lỗi logic bản nháp Chương ${chapter_number}...`);
      await new Promise((resolve) => setTimeout(resolve, 1200));

      if (content.includes("Thành địa Lạc Long") || content.includes("Bí kíp Ma Giáo")) {
        highlightTags = ["Thành địa Lạc Long", "Bí kíp Ma Giáo"];
      }
    }

    await db.promise().query(`UPDATE chapters_index SET status = 'CANON_CHECKED' WHERE id = ?`, [chapterId]);

    return res.status(200).json({
      success: true,
      message: "Đã quét xong tính nhất quán.",
      conflict_detected: highlightTags.length > 0,
      highlight_tags: highlightTags,
    });
  } catch (error) {
    console.error("Lỗi checkConsistency:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * BƯỚC 8: Biên tập sửa lỗi chính tả (ĐỒNG BỘ XUỐNG MONGODB ATLAS VÀ PHẢN HỒI QUA N8N)
 * POST /api/chapters/:id/spell-check
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
    const [chapterRows] = await db.promise().query(`SELECT id FROM chapters_index WHERE id = ?`, [chapterId]);
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
    await db.promise().query(`UPDATE chapters_index SET status = ? WHERE id = ?`, [finalStatus, chapterId]);

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
 * BƯỚC 9: Phân tích bối cảnh & Tự động tạo ảnh minh họa (TÁCH RIÊNG)
 * POST /api/chapters/:id/generate-art
 */
exports.generateIllustration = async (req, res) => {
  const chapterId = req.params.id;
  const { story_id, chapter_number } = req.body;

  if (!story_id || !chapter_number) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin story_id hoặc chapter_number để định vị tạo ảnh." });
  }

  try {
    // Lấy thông tin nhân vật thuộc truyện để phân tích ngoại hình phục vụ gen ảnh mẫu
    const [characters] = await db.promise().query(`SELECT name, appearance_features FROM story_characters WHERE story_id = ?`, [Number(story_id)]);

    const N8N_GEN_ART_URL = process.env.N8N_GEN_ART_URL || process.env.N8N_EDIT_ART_URL;
    let generatedImageUrl = null;
    let promptUsed = "";

    if (N8N_GEN_ART_URL) {
      const n8nPayload = {
        story_id: Number(story_id),
        chapter_number: Number(chapter_number),
        characters_metadata: characters,
      };

      const n8nResponse = await n8nService.triggerN8nWorkflow(N8N_GEN_ART_URL, n8nPayload);

      if (n8nResponse) {
        const resData = Array.isArray(n8nResponse) ? n8nResponse[0] : n8nResponse;
        generatedImageUrl = resData.image_url || null;
        promptUsed = resData.prompt_used || "";
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      generatedImageUrl = "https://baostory.vn/covers/mock_illustration.jpg";
      promptUsed = "An anime style digital painting of character based on story context...";
    }

    if (generatedImageUrl) {
      await db.promise().query(`INSERT INTO chapter_illustrations (chapter_id, image_url, prompt_used) VALUES (?, ?, ?)`, [chapterId, generatedImageUrl, promptUsed]);
    }

    return res.status(200).json({
      success: true,
      message: "Tạo ảnh minh họa chương hoàn tất.",
      data: {
        story_id: Number(story_id),
        chapter_number: Number(chapter_number),
        image_url: generatedImageUrl,
        prompt_used: promptUsed,
      },
    });
  } catch (error) {
    console.error("Lỗi tại hàm generateIllustration:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * BƯỚC 10: Bản thảo hoàn chỉnh - Lưu đè hoặc ghi mới xuống Folder vật lý của tác giả
 * POST /api/chapters/:id/finalize
 */
exports.finalizeManuscript = async (req, res) => {
  const chapterId = req.params.id;
  const { final_content, story_id } = req.body;

  if (!final_content || !story_id) {
    return res.status(400).json({ success: false, message: "Nội dung bản thảo cuối cùng và ID truyện không được để trống." });
  }

  try {
    const [chapterRows] = await db.promise().query(`SELECT chapter_number, title FROM chapters_index WHERE id = ?`, [chapterId]);

    if (chapterRows.length === 0) {
      return res.status(444).json({ success: false, error: `Không tìm thấy chương ứng với ID: ${chapterId}` });
    }
    const { chapter_number, title } = chapterRows[0];

    const [stories] = await db.promise().query(`SELECT local_folder_path FROM stories WHERE id = ?`, [Number(story_id)]);
    if (stories.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin cấu hình thư mục của truyện này." });
    }

    const rootFolderPath = stories[0].local_folder_path;

    // Ghi file vật lý xuống máy tính tác giả
    const savedFilePath = await fileService.saveChapterFile(rootFolderPath, chapter_number, title, final_content);

    await db.promise().query(`UPDATE chapters_index SET status = 'FINAL' WHERE id = ?`, [chapterId]);

    return res.status(200).json({
      success: true,
      message: "Bản thảo chương đã được lưu và đồng bộ xuống thư mục máy tính của bạn thành công!",
      data: {
        saved_at_path: savedFilePath,
      },
    });
  } catch (error) {
    console.error("Lỗi finalizeManuscript:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi ghi file vật lý hoặc cập nhật trạng thái hệ thống.",
      error: error.message,
    });
  }
};
// Tao chuong truyen
exports.createChapter = async (req, res) => {
  try {
    const { story_id, title } = req.body;

    if (!story_id || !title) {
      return res.status(400).json({
        success: false,
        message: "Thiếu story_id hoặc title",
      });
    }

    const [rows] = await db.query(
      `
      SELECT MAX(chapter_number) AS maxChapter
      FROM chapters_index
      WHERE story_id = ?
      `,
      [story_id],
    );

    const nextChapterNumber = (rows[0]?.maxChapter || 0) + 1;

    const [result] = await db.query(
      `
      INSERT INTO chapters_index
      (
        story_id,
        chapter_number,
        title,
        status,
        is_outline_approved
      )
      VALUES (?, ?, ?, 'OUTLINE', 0)
      `,
      [story_id, nextChapterNumber, title],
    );

    return res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        story_id,
        chapter_number: nextChapterNumber,
        title,
        status: "OUTLINE",
      },
    });
  } catch (error) {
    console.error("createChapter:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
