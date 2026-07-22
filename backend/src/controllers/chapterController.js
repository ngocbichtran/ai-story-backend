// 1. ĐƯA TẤT CẢ REQUIRE LÊN ĐẦU FILE (Tránh tuyệt đối lỗi cú pháp)
const db = require("../config/db");
const { getMongoDb } = require("../config/mongo"); // Thư viện kết nối MongoDB Atlas đám mây
const n8nService = require("../services/n8nService");

// =========================================================================
// 1. KHỞI TẠO CHƯƠNG MỚI
// =========================================================================
exports.createChapter = async (req, res) => {
  try {
    const { storyId } = req.params;

    const chapterNumber = req.body.chapterNumber || req.body.chapter_number;
    const { title } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    if (!storyId || !chapterNumber || !title) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin đầu vào bắt buộc (storyId, chapterNumber, title).",
      });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    const [storyCheck] = await db.query("SELECT COUNT(*) as count FROM stories WHERE id = ? AND deleted_at IS NULL", [cleanStoryId]);

    if (storyCheck[0].count === 0) {
      return res.status(404).json({
        success: false,
        message: "Bộ truyện không tồn tại trên hệ thống hoặc đã bị xóa.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }
    const collection = mongoDb.collection("chapters_content");

    const duplicateChapter = await collection.findOne({
      $or: [
        { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
        { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
      ],
    });

    if (duplicateChapter !== null) {
      return res.status(400).json({
        success: false,
        message: `Số chương ${cleanChapterNumber} đã tồn tại trong bộ truyện này.`,
      });
    }

    const newChapter = {
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
      title: title.trim(),
      content: "",
      status: "DRAFT",
      wordCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(newChapter);

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

// =========================================================================
// 2. LẤY CHI TIẾT NỘI DUNG CHƯƠNG (Từ MongoDB)
// =========================================================================
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

    let chapter = await chapterCollection.findOne({
      $or: [
        { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
        { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
        { storyId: String(storyId), chapterNumber: String(chapterNumber) },
      ],
    });

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
        wordCount: chapter.wordCount || 0,
        status: chapter.status || "DRAFT",
        createdAt: chapter.createdAt || chapter.created_at,
        updatedAt: chapter.updatedAt || chapter.updated_at,
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

// =========================================================================
// 3. XÓA CHƯƠNG MỀM VÀ TỰ ĐỘNG DỒN SỐ THỨ TỰ CHƯƠNG
// =========================================================================
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

    const deleteResult = await collection.deleteOne({
      $or: [
        { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
        { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
      ],
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chương số ${cleanChapterNumber} để xử lý xóa.`,
      });
    }

    await collection.updateMany(
      {
        $or: [{ storyId: cleanStoryId }, { story_id: cleanStoryId }],
        $or: [{ chapterNumber: { $gt: cleanChapterNumber } }, { chapter_number: { $gt: cleanChapterNumber } }],
      },
      {
        $inc: { chapterNumber: -1, chapter_number: -1 },
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

// =========================================================================
// 4. LẤY DANH SÁCH CHƯƠNG CỦA MỘT TRUYỆN
// =========================================================================
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

    const queryCondition = {
      $or: [{ storyId: numStoryId }, { storyId: String(storyId) }, { story_id: numStoryId }, { story_id: String(storyId) }],
    };

    const chapters = await chapterCollection.find(queryCondition).sort({ chapterNumber: 1, chapter_number: 1 }).toArray();

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

// =========================================================================
// 5. SỬA NỘI DUNG CHƯƠNG THỦ CÔNG (ĐẶC TẢ 025_F1)(Thêm logic giới hạn tối đa 10 phiên bản)
// =========================================================================
exports.updateChapterContent = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.params;
    const { title, content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Phiên đăng nhập đã hết hạn." });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    const mongoDb = getMongoDb();
    if (!mongoDb) return res.status(500).json({ success: false, message: "Mất kết nối MongoDB Atlas." });

    const collection = mongoDb.collection("chapters_content");

    const existingChapter = await collection.findOne({
      $or: [
        { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
        { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
      ],
    });

    if (!existingChapter) {
      return res.status(404).json({ success: false, message: `Không tìm thấy chương số ${cleanChapterNumber}.` });
    }

    const targetContent = content !== undefined ? content : existingChapter.content || "";
    const trimmedContent = targetContent.trim();
    const wordCount = trimmedContent === "" ? 0 : trimmedContent.split(/\s+/).filter(Boolean).length;

    const updateData = {
      ...(title !== undefined && { title: title.trim() }),
      ...(content !== undefined && { content: content }),
    };

    // 1. Cập nhật bản ghi hiện tại
    await exports.saveUpdatedChapterContentMongo({
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
      updateData: updateData,
      wordCount: wordCount,
    });

    // 🌟 2. QUẢN LÝ LỊCH SỬ PHIÊN BẢN (GIỚI HẠN TỐI ĐA 10 BẢN GHI)
    const historyCollection = mongoDb.collection("chapter_versions");

    // Đếm số lượng phiên bản hiện có của chương này
    const filterQuery = {
      $or: [
        { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
        { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
      ],
    };

    const currentCount = await historyCollection.countDocuments(filterQuery);

    // Nếu đã đủ 10 bản ghi trở lên ➔ Xóa bản ghi CŨ NHẤT trước khi thêm mới
    if (currentCount >= 10) {
      const oldestVersion = await historyCollection.findOne(filterQuery, { sort: { createdAt: 1 } });
      if (oldestVersion) {
        await historyCollection.deleteOne({ _id: oldestVersion._id });
      }
    }

    // Chèn phiên bản mới nhất vào Database
    await historyCollection.insertOne({
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
      title: updateData.title || existingChapter.title,
      content: targetContent,
      wordCount: wordCount,
      versionName: `Lưu thủ công (${new Date().toLocaleTimeString("vi-VN")})`,
      createdAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật nội dung chương và lưu mốc lịch sử thành công.",
      data: {
        storyId: cleanStoryId,
        chapterNumber: cleanChapterNumber,
        wordCount: wordCount,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm updateChapterContent:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật." });
  }
};
// =========================================================================
// 11. KHÔI PHỤC PHIÊN BẢN CŨ (Tùy chọn bổ sung nếu muốn có endpoint riêng)
// =========================================================================
exports.restoreChapterVersion = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Phiên đăng nhập đã hết hạn." });
    }

    if (content === undefined) {
      return res.status(400).json({ success: false, message: "Thiếu nội dung cần khôi phục." });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    // Tính toán lại số từ của bản khôi phục
    const trimmedContent = content.trim();
    const wordCount = trimmedContent === "" ? 0 : trimmedContent.split(/\s+/).filter(Boolean).length;

    // Cập nhật đè nội dung khôi phục lên bảng chính chapters_content
    const modifiedCount = await exports.saveAutosaveContentMongo({
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
      content: content,
      wordCount: wordCount,
    });

    if (modifiedCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy chương để khôi phục." });
    }

    return res.status(200).json({
      success: true,
      message: "Khôi phục phiên bản thành công.",
      data: {
        storyId: cleanStoryId,
        chapterNumber: cleanChapterNumber,
        wordCount: wordCount,
        content: content,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm restoreChapterVersion:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi khôi phục phiên bản." });
  }
};
// =========================================================================
// 6. REPOSITORY CẬP NHẬT MONGODB (ĐẶC TẢ 025_F2)
// =========================================================================
exports.saveUpdatedChapterContentMongo = async ({ storyId, chapterNumber, updateData, wordCount }) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu MongoDB Atlas.");
  }

  const collection = mongoDb.collection("chapters_content");

  const setFields = {
    ...updateData,
    wordCount: wordCount,
    updatedAt: new Date(),
  };

  // 🌟 ĐÃ FIX: Cập nhật dựa trên điều kiện linh hoạt chuẩn camelCase
  const result = await collection.updateOne(
    {
      $or: [
        { storyId: Number(storyId), chapterNumber: Number(chapterNumber) },
        { story_id: Number(storyId), chapter_number: Number(chapterNumber) },
      ],
    },
    {
      $set: setFields,
    },
  );

  return result.modifiedCount || result.matchedCount;
};
// =========================================================================
// 8. AUTO SAVE NỘI DUNG CHƯƠNG (Controller - Đặc tả 026_F1)
// =========================================================================
exports.autoSaveChapterContent = async (req, res) => {
  try {
    // Bước 1: Trích xuất parameters từ URL và body request
    const { storyId, chapterNumber } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã hết hạn.",
      });
    }

    if (content === undefined || content === null) {
      return res.status(400).json({
        success: false,
        message: "Thiếu nội dung văn bản (content) để lưu nháp.",
      });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    // Bước 2: Tính toán lại số lượng từ dựa trên đoạn nội dung văn bản vừa nhận
    const trimmedContent = content.trim();
    const wordCount = trimmedContent === "" ? 0 : trimmedContent.split(/\s+/).filter(Boolean).length;

    // Bước 3: Gọi hàm tương tác xuống tầng Repository (saveAutosaveContentMongo)
    const modifiedCount = await exports.saveAutosaveContentMongo({
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
      content: content,
      wordCount: wordCount,
    });

    if (modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy chương số ${cleanChapterNumber} để lưu nháp.`,
      });
    }

    // Bước 4: Trả về đối tượng JSON kèm mốc thời gian (timestamp) lưu nháp cho Client
    const savedAt = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return res.status(200).json({
      success: true,
      message: "Lưu nháp tự động thành công.",
      data: {
        storyId: cleanStoryId,
        chapterNumber: cleanChapterNumber,
        wordCount: wordCount,
        updatedAt: new Date(),
        savedAtText: `Đã lưu nháp lúc ${savedAt}`,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm autoSaveChapterContent:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lưu nháp tự động.",
    });
  }
};

// =========================================================================
// 9. REPOSITORY CẬP NHẬT AUTOSAVE VÀO MONGODB (Repository - Đặc tả 026_F2)
// =========================================================================
exports.saveAutosaveContentMongo = async ({ storyId, chapterNumber, content, wordCount }) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu MongoDB Atlas.");
  }

  const collection = mongoDb.collection("chapters_content");

  // Cập nhật nhanh nội dung nháp văn bản, wordCount và mốc thời gian dựa theo storyId và chapterNumber
  const result = await collection.updateOne(
    {
      $or: [
        { storyId: Number(storyId), chapterNumber: Number(chapterNumber) },
        { story_id: Number(storyId), chapter_number: Number(chapterNumber) },
      ],
    },
    {
      $set: {
        content: content,
        wordCount: wordCount,
        updatedAt: new Date(),
      },
    },
  );

  return result.modifiedCount || result.matchedCount;
};

// =========================================================================
// 10. TẢI DANH SÁCH LỊCH SỬ PHIÊN BẢN (SNAPSHOT) CỦA CHƯƠNG
// =========================================================================
exports.getChapterHistory = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.query;

    if (!storyId || !chapterNumber) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tham số storyId hoặc chapterNumber.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({ success: false, message: "Mất kết nối CSDL MongoDB Atlas." });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    // 1. LẤY BẢN NHÁP HIỆN TẠI TỪ BẢNG CHÍNH (chapters_content)
    const contentCollection = mongoDb.collection("chapters_content");
    const currentChapterDoc = await contentCollection.findOne({
      $or: [
        { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
        { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
      ],
    });

    // 2. LẤY DANH SÁCH CÁC SNAPSHOT LƯU THỦ CÔNG (chapter_versions)
    const historyCollection = mongoDb.collection("chapter_versions");
    const history = await historyCollection
      .find({
        $or: [
          { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
          { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
        ],
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Format danh sách các bản lưu thủ công
    const formattedHistory = history.map((ver, index) => ({
      id: ver._id.toString(),
      versionName: ver.versionName || `Bản lưu ${history.length - index}`,
      content: ver.content || "",
      wordCount: ver.wordCount || 0,
      createdAt: new Date(ver.createdAt).toLocaleString("vi-VN"),
      isDraft: false, // Đánh dấu đây là bản snapshot thủ công
    }));

    // 3. TẠO PHẦN TỬ "BẢN NHÁP TỰ ĐỘNG GẦN NHẤT" ĐỨNG ĐẦU MẢNG
    let draftItem = [];
    if (currentChapterDoc) {
      const draftUpdatedAt = currentChapterDoc.updatedAt || currentChapterDoc.createdAt || new Date();
      draftItem = [
        {
          id: "autosave-latest-draft", // ID định danh riêng cho bản nháp
          versionName: "Bản nháp tự động gần nhất",
          content: currentChapterDoc.content || "",
          wordCount: currentChapterDoc.wordCount || 0,
          createdAt: new Date(draftUpdatedAt).toLocaleString("vi-VN"),
          isDraft: true, // Đánh dấu đây là bản nháp ngầm
        },
      ];
    }

    // Ghép bản nháp lên đầu tiên, theo sau là tối đa các bản snapshot lịch sử
    const finalResult = [...draftItem, ...formattedHistory];

    return res.status(200).json({
      success: true,
      data: finalResult,
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm getChapterHistory:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi tải lịch sử phiên bản." });
  }
};
// =========================================================================
// 7. N8N / SPELL CHECK
// =========================================================================
exports.spellCheck = async (req, res) => {
  const chapterId = req.params.id;

  const storyId = req.body.storyId || req.body.story_id;
  const chapterNumber = req.body.chapterNumber || req.body.chapter_number;
  const { content } = req.body;

  if (!storyId || !chapterNumber || !content) {
    return res.status(400).json({ success: false, message: "Thiếu thông tin storyId, chapterNumber hoặc nội dung bản nháp." });
  }

  try {
    const [chapterRows] = await db.query(`SELECT id FROM stories WHERE id = ?`, [chapterId]);
    if (chapterRows.length === 0) {
      return res.status(404).json({ success: false, error: `Không tìm thấy chương ứng với ID mục lục: ${chapterId}` });
    }

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
