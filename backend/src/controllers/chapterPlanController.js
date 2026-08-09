const db = require("../config/db"); // Kết nối MySQL để kiểm tra story
const { getMongoDb } = require("../config/mongo"); // Kết nối MongoDB Atlas
const { ObjectId } = require("mongodb");
const axios = require("axios");

// =========================================================================
// HÀM REPOSITORY Lấy chi tiết 1 kế hoạch chương: fetchChapterPlanDetailById()
// =========================================================================
const fetchChapterPlanDetailById = async (planId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  const collection = mongoDb.collection("chapter_plans");

  if (!ObjectId.isValid(planId)) {
    return null;
  }

  const result = await collection.findOne({ _id: new ObjectId(planId) });
  return result;
};

// =========================================================================
// HÀM CONTROLLER Lấy chi tiết 1 kế hoạch chương: getChapterPlanDetail()
// =========================================================================
exports.getChapterPlanDetail = async (req, res) => {
  try {
    const { planId } = req.params;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh kế hoạch chương (planId) trên URL.",
      });
    }

    const planData = await fetchChapterPlanDetailById(planId);

    if (!planData) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin chi tiết kế hoạch chương.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: planData._id.toString(),
        storyId: planData.storyId,
        chapterNumber: planData.chapterNumber,
        title: planData.title || "",
        versionName: planData.versionName || "",
        summary: planData.summary || "",
        createdAt: planData.createdAt,
        updatedAt: planData.updatedAt,
      },
    });
  } catch (error) {
    console.error("Lỗi tại hàm getChapterPlanDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy chi tiết kế hoạch chương.",
    });
  }
};

// =========================================================================
// HÀM CONTROLLER: LẤY DANH SÁCH KẾ HOẠCH CHƯƠNG THEO STORY ID
// =========================================================================
exports.getChapterPlansByStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh bộ truyện (storyId) trên URL.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("chapter_plans");

    const plansList = await collection
      .find({ storyId: Number(storyId) })
      .sort({ chapterNumber: 1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: plansList,
    });
  } catch (error) {
    console.error("Lỗi tại hàm getChapterPlansByStory:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách kế hoạch chương.",
    });
  }
};

// =========================================================================
// HÀM REPOSITORY Chỉnh sửa kế hoạch chương: saveUpdatedChapterPlan()
// =========================================================================
const saveUpdatedChapterPlan = async (chapterId, planData) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  const collection = mongoDb.collection("chapter_plans");

  if (!ObjectId.isValid(chapterId)) {
    return 0;
  }

  const updateResult = await collection.updateOne(
    { _id: new ObjectId(chapterId) },
    {
      $set: {
        ...planData,
        updatedAt: new Date(),
      },
    },
  );

  return updateResult.modifiedCount;
};

// =========================================================================
// HÀM CONTROLLER chỉnh sửa kế hoạch chương: updateChapterPlan()
// =========================================================================
exports.updateChapterPlan = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { planData } = req.body;

    if (!chapterId || !planData) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh chapterId hoặc dữ liệu planData trên yêu cầu.",
      });
    }

    if (!ObjectId.isValid(chapterId)) {
      return res.status(400).json({
        success: false,
        message: "Mã định danh kế hoạch chương không đúng định dạng ObjectId.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("chapter_plans");
    const existingPlan = await collection.findOne({ _id: new ObjectId(chapterId) });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bản ghi kế hoạch chương tương ứng trong cơ sở dữ liệu.",
      });
    }

    const modifiedCount = await saveUpdatedChapterPlan(chapterId, planData);

    return res.status(200).json({
      success: true,
      message: "Cập nhật kế hoạch chương thành công!",
      modifiedCount: modifiedCount,
    });
  } catch (error) {
    console.error("Lỗi tại hàm updateChapterPlan:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật kế hoạch chương.",
    });
  }
};

// =========================================================================
// HÀM REPOSITORY XÓA: removeChapterPlanMongo()
// =========================================================================
const removeChapterPlanMongo = async (planId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  const collection = mongoDb.collection("chapter_plans");

  if (!ObjectId.isValid(planId)) {
    return 0;
  }

  const deleteResult = await collection.deleteOne({ _id: new ObjectId(planId) });
  return deleteResult.deletedCount;
};

// =========================================================================
// HÀM CONTROLLER XÓA: deleteChapterPlan()
// =========================================================================
exports.deleteChapterPlan = async (req, res) => {
  try {
    const { planId } = req.params;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh kế hoạch chương (planId) trên đường dẫn.",
      });
    }

    if (!ObjectId.isValid(planId)) {
      return res.status(400).json({
        success: false,
        message: "Mã định danh kế hoạch chương không đúng định dạng ObjectId.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("chapter_plans");
    const existingPlan = await collection.findOne({ _id: new ObjectId(planId) });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy kế hoạch chương cần xóa trong cơ sở dữ liệu.",
      });
    }

    const deletedCount = await removeChapterPlanMongo(planId);

    return res.status(200).json({
      success: true,
      message: "Xóa kế hoạch chương thành công!",
      deletedCount: deletedCount,
    });
  } catch (error) {
    console.error("Lỗi tại hàm deleteChapterPlan:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xóa kế hoạch chương.",
    });
  }
};

// =========================================================================
// HÀM CONTROLLER GỌI N8N GỢI Ý KẾ HOẠCH CHƯƠNG KẾ TIẾP + TẠO CHƯƠNG RỖNG
// =========================================================================
exports.suggestChapterPlan = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.body;

    if (!storyId || !chapterNumber) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ storyId và chapterNumber để gợi ý kế hoạch.",
      });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    if (!Number.isInteger(cleanStoryId) || cleanStoryId <= 0 || !Number.isInteger(cleanChapterNumber) || cleanChapterNumber <= 0) {
      return res.status(400).json({
        success: false,
        message: "storyId và chapterNumber phải là số nguyên dương.",
      });
    }

    // Kiểm tra story tồn tại trong MySQL (Vẫn giữ kiểm tra này để đảm bảo tính toàn vẹn)
    const [storyCheck] = await db.query("SELECT id FROM stories WHERE id = ? AND deleted_at IS NULL", [cleanStoryId]);
    if (!storyCheck || storyCheck.length === 0) {
      return res.status(404).json({ success: false, message: "Bộ truyện không tồn tại." });
    }

    // Gọi N8N
    const n8nWebhook = "https://n8n.baostory.fun/webhook/suggest_1chapterplan_next";
    let n8nResponse;
    try {
      n8nResponse = await axios.post(
        n8nWebhook,
        { storyId: cleanStoryId, chapterNumber: cleanChapterNumber },
        {
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          timeout: 120000,
          validateStatus: () => true,
        },
      );
    } catch (n8nError) {
      console.error("❌ Không kết nối được N8N:", n8nError.message);
      return res.status(502).json({ success: false, message: "Backend không thể kết nối tới N8N.", error: n8nError.message });
    }

    if (n8nResponse.status < 200 || n8nResponse.status >= 300) {
      return res.status(502).json({ success: false, message: `N8N trả về HTTP ${n8nResponse.status}.`, n8nResponse: n8nResponse.data });
    }

    // Xử lý dữ liệu trả về từ N8N
    let rawData = n8nResponse.data;
    if (rawData?.data) rawData = rawData.data;
    if (Array.isArray(rawData)) rawData = rawData[0];
    let chapterPlan = rawData?.chapterPlan || (rawData?.chapterNumber ? rawData : null);

    if (!chapterPlan || typeof chapterPlan !== "object") {
      return res.status(502).json({ success: false, message: "N8N không trả về chapterPlan hợp lệ." });
    }

    const generatedChapterNumber = Number(chapterPlan.chapterNumber) || cleanChapterNumber;
    const generatedTitle = chapterPlan.title || `Chương ${generatedChapterNumber}`;

    const mongoDb = getMongoDb();
    if (!mongoDb) return res.status(500).json({ success: false, message: "Mất kết nối MongoDB." });

    const planCollection = mongoDb.collection("chapter_plans");
    const contentCollection = mongoDb.collection("chapters_content");

    // 1. UPSERT Kế hoạch chương (MongoDB)
    await planCollection.updateOne(
      { storyId: cleanStoryId, chapterNumber: generatedChapterNumber },
      {
        $set: {
          title: generatedTitle,
          purpose: chapterPlan.purpose || "",
          conflict: chapterPlan.conflict || "",
          endingHook: chapterPlan.endingHook || "",
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );

    // 2. UPSERT Chương rỗng (MongoDB - Thay thế hoàn toàn cho MySQL chapters_content)
    const chapterUpdateResult = await contentCollection.findOneAndUpdate(
      { storyId: cleanStoryId, chapterNumber: generatedChapterNumber },
      {
        $setOnInsert: {
          storyId: cleanStoryId,
          chapterNumber: generatedChapterNumber,
          content: "",
          status: "DRAFT",
          createdAt: new Date(),
        },
        $set: {
          title: generatedTitle,
          updatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const savedChapter = chapterUpdateResult.value || chapterUpdateResult;

    return res.status(200).json({
      success: true,
      message: "AI đã tạo kế hoạch chương và khởi tạo chương thành công.",
      data: {
        planId: null, // Có thể lấy từ planCollection nếu cần
        chapterId: savedChapter._id ? savedChapter._id.toString() : null,
        storyId: cleanStoryId,
        chapterNumber: generatedChapterNumber,
        title: generatedTitle,
        content: "",
      },
    });
  } catch (error) {
    console.error("❌ LỖI suggestChapterPlan:", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi tạo kế hoạch chương.", error: error.message });
  }
};

// =========================================================================
// HÀM CONTROLLER GỢI Ý KẾ HOẠCH CHƯƠNG HIỆN TẠI (CHỈ GỢI Ý, KHÔNG TẠO CHƯƠNG)
// =========================================================================
exports.suggestCurrentChapterPlan = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.body;

    if (!storyId || !chapterNumber) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ storyId và chapterNumber.",
      });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    if (!Number.isInteger(cleanStoryId) || cleanStoryId <= 0 || !Number.isInteger(cleanChapterNumber) || cleanChapterNumber <= 0) {
      return res.status(400).json({
        success: false,
        message: "storyId và chapterNumber phải là số nguyên dương.",
      });
    }

    const [storyCheck] = await db.query(`SELECT id FROM stories WHERE id = ? AND deleted_at IS NULL`, [cleanStoryId]);

    if (!storyCheck || storyCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bộ truyện không tồn tại trên hệ thống.",
      });
    }

    const n8nWebhook = "https://n8n.baostory.fun/webhook/suggest_1chapterplan_now";
    let n8nResponse;

    try {
      n8nResponse = await axios.post(
        n8nWebhook,
        {
          storyId: cleanStoryId,
          chapterNumber: cleanChapterNumber,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 120000,
          validateStatus: () => true,
        },
      );
    } catch (n8nError) {
      console.error("❌ Không kết nối được N8N:", n8nError.message);
      return res.status(502).json({
        success: false,
        message: "Backend không thể kết nối tới N8N.",
        error: n8nError.message,
      });
    }

    if (n8nResponse.status < 200 || n8nResponse.status >= 300) {
      return res.status(502).json({
        success: false,
        message: `N8N trả về HTTP ${n8nResponse.status}.`,
        n8nStatus: n8nResponse.status,
        n8nResponse: n8nResponse.data,
      });
    }

    let rawData = n8nResponse.data;
    if (rawData && typeof rawData === "object" && !Array.isArray(rawData) && rawData.data !== undefined) {
      rawData = rawData.data;
    }
    if (Array.isArray(rawData)) {
      rawData = rawData[0];
    }

    let chapterPlan = rawData?.chapterPlan;
    if (!chapterPlan && rawData && typeof rawData === "object" && rawData.chapterNumber) {
      chapterPlan = rawData;
    }

    if (!chapterPlan || typeof chapterPlan !== "object") {
      return res.status(502).json({
        success: false,
        message: "N8N không trả về chapterPlan hợp lệ.",
        n8nResponse: n8nResponse.data,
      });
    }

    const generatedChapterNumber = Number(chapterPlan.chapterNumber) || cleanChapterNumber;
    const generatedTitle = chapterPlan.title || `Chương ${generatedChapterNumber}`;
    const generatedPurpose = chapterPlan.purpose || "";
    const generatedConflict = chapterPlan.conflict || "";
    const generatedEndingHook = chapterPlan.endingHook || "";

    return res.status(200).json({
      success: true,
      message: "AI đã gợi ý kế hoạch chương hiện tại thành công.",
      data: {
        storyId: cleanStoryId,
        chapterNumber: generatedChapterNumber,
        title: generatedTitle,
        purpose: generatedPurpose,
        conflict: generatedConflict,
        endingHook: generatedEndingHook,
      },
    });
  } catch (error) {
    console.error("❌ LỖI suggestCurrentChapterPlan:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi gợi ý kế hoạch chương hiện tại.",
      error: error.message,
    });
  }
};
