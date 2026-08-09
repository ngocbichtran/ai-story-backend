// 1. ĐƯA TẤT CẢ REQUIRE LÊN ĐẦU FILE
const db = require("../config/db");
const { getMongoDb } = require("../config/mongo"); // Thư viện kết nối MongoDB Atlas đám mây
const n8nService = require("../services/n8nService");
const axios = require("axios");

// =========================================================================
// 1. KHỞI TẠO HOẶC CẬP NHẬT CHƯƠNG MỚI (UPSERT MONGODB)
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
    const planCollection = mongoDb.collection("chapter_plans");

    // Dùng updateOne với upsert: true để tự động tạo mới nếu chưa có, hoặc cập nhật nếu đã tồn tại
    const chapterFilter = {
      $or: [
        { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
        { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
      ],
    };

    const chapterUpdateResult = await collection.findOneAndUpdate(
      chapterFilter,
      {
        $setOnInsert: {
          storyId: cleanStoryId,
          chapterNumber: cleanChapterNumber,
          content: "",
          status: "DRAFT",
          wordCount: 0,
          createdAt: new Date(),
        },
        $set: {
          title: title.trim(),
          updatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const insertedOrUpdatedChapter = chapterUpdateResult.value || chapterUpdateResult;
    const chapterIdStr = insertedOrUpdatedChapter._id ? insertedOrUpdatedChapter._id.toString() : "";

    // Tự động khởi tạo hoặc cập nhật bản ghi trong `chapter_plans`
    await planCollection.updateOne(
      { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
      {
        $setOnInsert: {
          storyId: cleanStoryId,
          chapterNumber: cleanChapterNumber,
          summary: "",
          createdAt: new Date(),
        },
        $set: {
          versionName: title.trim(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return res.status(200).json({
      success: true,
      message: "Create or update chapter and plan success",
      chapterId: chapterIdStr,
      data: {
        id: chapterIdStr,
        storyId: cleanStoryId,
        chapterNumber: cleanChapterNumber,
        title: title.trim(),
      },
    });
  } catch (error) {
    console.error("Lỗi tại hàm createChapter:", error.message);
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
    console.error("Lỗi getDisplayChapter:", error.message);
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
    console.error("Lỗi tại hàm deleteChapterSoft:", error.message);
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
    console.error("Lỗi tại getChaptersByStory:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách chương.",
    });
  }
};

// =========================================================================
// 5. SỬA NỘI DUNG CHƯƠNG THỦ CÔNG (Giới hạn tối đa 10 phiên bản)
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

    // Cập nhật bản ghi hiện tại
    await exports.saveUpdatedChapterContentMongo({
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
      updateData: updateData,
      wordCount: wordCount,
    });

    // Quản lý lịch sử phiên bản (giới hạn tối đa 10 bản ghi)
    const historyCollection = mongoDb.collection("chapter_versions");

    const filterQuery = {
      $or: [
        { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
        { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
      ],
    };

    const currentCount = await historyCollection.countDocuments(filterQuery);

    if (currentCount >= 10) {
      const oldestVersion = await historyCollection.findOne(filterQuery, { sort: { createdAt: 1 } });
      if (oldestVersion) {
        await historyCollection.deleteOne({ _id: oldestVersion._id });
      }
    }

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
    console.error("Lỗi tại hàm updateChapterContent:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi cập nhật." });
  }
};

// =========================================================================
// 6. REPOSITORY CẬP NHẬT MONGODB
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
// 7. N8N / SPELL CHECK
// =========================================================================
exports.spellCheck = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.body;

    if (!storyId || !chapterNumber) {
      return res.status(400).json({
        success: false,
        message: "Thiếu storyId hoặc chapterNumber",
      });
    }

    const payload = {
      story_id: Number(storyId),
      chapter_number: Number(chapterNumber),
    };

    const result = await n8nService.triggerN8nWorkflow(process.env.N8N_EDIT_ART_URL, payload);

    return res.json({
      success: true,
      message: "Sửa chính tả thành công.",
      data: result,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Lỗi AI",
    });
  }
};

// =========================================================================
// 8. AUTO SAVE NỘI DUNG CHƯƠNG
// =========================================================================
exports.autoSaveChapterContent = async (req, res) => {
  try {
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

    const trimmedContent = content.trim();
    const wordCount = trimmedContent === "" ? 0 : trimmedContent.split(/\s+/).filter(Boolean).length;

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
    console.error("Lỗi tại hàm autoSaveChapterContent:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lưu nháp tự động.",
    });
  }
};

// =========================================================================
// 9. REPOSITORY CẬP NHẬT AUTOSAVE VÀO MONGODB
// =========================================================================
exports.saveAutosaveContentMongo = async ({ storyId, chapterNumber, content, wordCount }) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu MongoDB Atlas.");
  }

  const collection = mongoDb.collection("chapters_content");

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

    const contentCollection = mongoDb.collection("chapters_content");
    const currentChapterDoc = await contentCollection.findOne({
      $or: [
        { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
        { story_id: cleanStoryId, chapter_number: cleanChapterNumber },
      ],
    });

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

    const formattedHistory = history.map((ver, index) => ({
      id: ver._id.toString(),
      versionName: ver.versionName || `Bản lưu ${history.length - index}`,
      content: ver.content || "",
      wordCount: ver.wordCount || 0,
      createdAt: new Date(ver.createdAt).toLocaleString("vi-VN"),
      isDraft: false,
    }));

    let draftItem = [];
    if (currentChapterDoc) {
      const draftUpdatedAt = currentChapterDoc.updatedAt || currentChapterDoc.createdAt || new Date();
      draftItem = [
        {
          id: "autosave-latest-draft",
          versionName: "Bản nháp tự động gần nhất",
          content: currentChapterDoc.content || "",
          wordCount: currentChapterDoc.wordCount || 0,
          createdAt: new Date(draftUpdatedAt).toLocaleString("vi-VN"),
          isDraft: true,
        },
      ];
    }

    const finalResult = [...draftItem, ...formattedHistory];

    return res.status(200).json({
      success: true,
      data: finalResult,
    });
  } catch (error) {
    console.error("Lỗi tại hàm getChapterHistory:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi tải lịch sử phiên bản." });
  }
};

// =========================================================================
// 11. KHÔI PHỤC PHIÊN BẢN CŨ
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

    const trimmedContent = content.trim();
    const wordCount = trimmedContent === "" ? 0 : trimmedContent.split(/\s+/).filter(Boolean).length;

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
    console.error("Lỗi tại hàm restoreChapterVersion:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi khôi phục phiên bản." });
  }
};

// =====================================================
// 12. AI GỢI Ý NỘI DUNG CHƯƠNG (Nối n8n - Có kiểm tra chương trước & kế hoạch từ chương 2)
// =====================================================
exports.aiSuggestPlot = async (req, res) => {
  try {
    const { chapterNumber } = req.params;
    const { storyId, prompt, currentContent } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Phiên đăng nhập hết hạn." });
    }

    if (!storyId || !chapterNumber) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin storyId hoặc chapterNumber.",
      });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({ success: false, message: "Mất kết nối MongoDB Atlas." });
    }

    // 🟢 KIỂM TRA ĐIỀU KIỆN TỪ CHƯƠNG 2 TRỞ LÊN
    if (cleanChapterNumber > 1) {
      const planCollection = mongoDb.collection("chapter_plans");
      const contentCollection = mongoDb.collection("chapters_content");

      const previousChapterNumber = cleanChapterNumber - 1;

      // 1. Kiểm tra xem đã có kế hoạch cho chương hiện tại hoặc chương trước chưa
      const currentPlan = await planCollection.findOne({
        storyId: cleanStoryId,
        chapterNumber: cleanChapterNumber,
      });

      const previousPlan = await planCollection.findOne({
        storyId: cleanStoryId,
        chapterNumber: previousChapterNumber,
      });

      if (!currentPlan && !previousPlan) {
        return res.status(400).json({
          success: false,
          message: `Vui lòng bổ sung kế hoạch cho chương ${cleanChapterNumber} trước khi sử dụng tính năng gợi ý từ AI!`,
        });
      }

      // 2. Kiểm tra nội dung chương liền kề trước đó (chương N-1) có bị trống không
      const previousChapter = await contentCollection.findOne({
        storyId: cleanStoryId,
        chapterNumber: previousChapterNumber,
      });

      if (!previousChapter || !previousChapter.content || previousChapter.content.trim() === "") {
        return res.status(400).json({
          success: false,
          message: `Chương ${previousChapterNumber} trước đó đang trống nội dung. Vui lòng viết hoặc hoàn thiện chương trước trước khi gợi ý nội dung cho chương này!`,
        });
      }
    }

    const N8N_PLOT_URL = "https://n8n.baostory.fun/webhook/suggest_chaptercontent";

    const payload = {
      storyId: cleanStoryId,
      chapterNumber: cleanChapterNumber,
      prompt: prompt || "",
      currentContent: currentContent || "",
      userId: Number(userId),
    };

    console.log("🔥 PAYLOAD GỬI N8N:", JSON.stringify(payload, null, 2));
    console.log("🔥 N8N URL:", N8N_PLOT_URL);

    const response = await axios.post(N8N_PLOT_URL, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 120000,
      validateStatus: () => true,
    });

    console.log("🔥 N8N RESPONSE:", response.status, response.data);
    const aiContent = response.data.content || response.data.suggestion || response.data.data || response.data || "";

    return res.status(200).json({
      success: true,
      message: "AI đã tạo gợi ý thành công.",
      data: { content: aiContent },
    });
  } catch (error) {
    console.error("❌ Lỗi AI Plot Suggestion:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi gọi AI." });
  }
};
