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
        purpose: planData.purpose || "",
        conflict: planData.conflict || "",
        endingHook: planData.endingHook || "",
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
// HÀM CONTROLLER GỌI N8N GỢI Ý KẾ HOẠCH CHƯƠNG KẾ TIẾP
// =========================================================================
exports.suggestChapterPlan = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.body;

    // 1. KIỂM TRA INPUT
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

    // 2. KIỂM TRA STORY TỒN TẠI TRONG MYSQL
    const [storyCheck] = await db.query("SELECT id FROM stories WHERE id = ? AND deleted_at IS NULL", [cleanStoryId]);

    if (!storyCheck || storyCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bộ truyện không tồn tại.",
      });
    }

    // 3. KẾT NỐI MONGODB
    const mongoDb = getMongoDb();

    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối MongoDB.",
      });
    }

    // 4. LẤY WORLD CỦA STORY
    const worldCollection = mongoDb.collection("worlds");

    const world = await worldCollection.findOne({
      storyId: cleanStoryId,
    });

    if (!world) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin thế giới của bộ truyện.",
        storyId: cleanStoryId,
      });
    }

    // 5. LOẠI BỎ CÁC FIELD KHÔNG CẦN THIẾT CỦA MONGODB
    const worldData = {
      storyId: world.storyId,
      title: world.title || "",
      description: world.description || "",
      history: world.history || "",
      culture: world.culture || "",
      geography: world.geography || [],
      powerSystems: world.powerSystems || [],
      rules: world.rules || [],
    };

    // 6. GỌI N8N WEBHOOK
    const n8nWebhook = "https://n8n.baostory.fun/webhook/suggest_1chapterplan_next";

    let n8nResponse;

    try {
      n8nResponse = await axios.post(
        n8nWebhook,
        {
          storyId: cleanStoryId,
          chapterNumber: cleanChapterNumber,
          world: worldData,
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
      console.error("Không kết nối được N8N:", n8nError.message);

      return res.status(502).json({
        success: false,
        message: "Backend không thể kết nối tới N8N.",
        error: n8nError.message,
      });
    }

    // 7. KIỂM TRA RESPONSE N8N
    if (n8nResponse.status < 200 || n8nResponse.status >= 300) {
      return res.status(502).json({
        success: false,
        message: `N8N trả về HTTP ${n8nResponse.status}.`,
        n8nResponse: n8nResponse.data,
      });
    }

    // 8. XỬ LÝ DỮ LIỆU N8N TRẢ VỀ
    let rawData = n8nResponse.data;

    if (typeof rawData === "string") {
      try {
        rawData = JSON.parse(rawData.trim());
      } catch (e) {}
    }

    if (rawData && typeof rawData === "object") {
      if (rawData.data) rawData = rawData.data;
      if (rawData.json) rawData = rawData.json;
    }

    if (Array.isArray(rawData)) {
      rawData = rawData[0] || null;
    }

    let chapterPlan = null;
    if (rawData && typeof rawData === "object") {
      if (rawData.chapterPlan && typeof rawData.chapterPlan === "object") {
        chapterPlan = rawData.chapterPlan;
      } else if (rawData.chapterNumber) {
        chapterPlan = rawData;
      }
    }

    if (!chapterPlan || typeof chapterPlan !== "object") {
      return res.status(502).json({
        success: false,
        message: "N8N không trả về chapterPlan hợp lệ.",
        rawReceived: n8nResponse.data,
      });
    }

    // 9. LẤY DỮ LIỆU KẾ HOẠCH CHƯƠNG
    const generatedChapterNumber = Number(chapterPlan.chapterNumber) || cleanChapterNumber;
    const generatedTitle = chapterPlan.title || `Chương ${generatedChapterNumber}`;
    const generatedPurpose = chapterPlan.purpose || "";
    const generatedConflict = chapterPlan.conflict || "";
    const generatedEndingHook = chapterPlan.endingHook || "";

    // 10. COLLECTION MONGODB
    const planCollection = mongoDb.collection("chapter_plans");
    const contentCollection = mongoDb.collection("chapters_content");

    // 11. UPSERT KẾ HOẠCH CHƯƠNG
    const planUpdateResult = await planCollection.findOneAndUpdate(
      {
        storyId: cleanStoryId,
        chapterNumber: generatedChapterNumber,
      },
      {
        $setOnInsert: {
          storyId: cleanStoryId,
          chapterNumber: generatedChapterNumber,
          createdAt: new Date(),
        },

        $set: {
          title: generatedTitle,
          purpose: generatedPurpose,
          conflict: generatedConflict,
          endingHook: generatedEndingHook,
          updatedAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    const savedPlan = planUpdateResult.value || planUpdateResult;

    // 12. KIỂM TRA CHƯƠNG ĐÃ TỒN TẠI HAY CHƯA
    let chapterId = null;
    let chapterCreated = false;

    const existingChapter = await contentCollection.findOne({
      storyId: cleanStoryId,
      chapterNumber: generatedChapterNumber,
    });

    if (existingChapter) {
      // Chương đã tồn tại
      chapterId = existingChapter._id.toString();
      chapterCreated = false;
    } else {
      // 13. TẠO CHƯƠNG RỖNG
      const newChapterDoc = {
        storyId: cleanStoryId,
        chapterNumber: generatedChapterNumber,
        title: generatedTitle,
        content: "",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertResult = await contentCollection.insertOne(newChapterDoc);

      chapterId = insertResult.insertedId.toString();

      chapterCreated = true;
    }

    // 14. RESPONSE VỀ FRONTEND
    return res.status(200).json({
      success: true,

      message: chapterCreated ? "AI đã tạo kế hoạch chương và khởi tạo chương rỗng thành công." : "AI đã cập nhật kế hoạch chương (chương nội dung đã tồn tại từ trước nên được giữ nguyên).",

      data: {
        planId: savedPlan._id ? savedPlan._id.toString() : null,
        chapterId,
        storyId: cleanStoryId,
        chapterNumber: generatedChapterNumber,
        title: generatedTitle,
        purpose: generatedPurpose,
        conflict: generatedConflict,
        endingHook: generatedEndingHook,
        content: existingChapter ? existingChapter.content : "",
        chapterCreated,
        world: worldData,
      },
    });
  } catch (error) {
    console.error("LỖI suggestChapterPlan:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo kế hoạch chương.",
      error: error.message,
    });
  }
};
// =========================================================================
// HÀM CONTROLLER GỢI Ý KẾ HOẠCH CHƯƠNG HIỆN TẠI
// =========================================================================
exports.suggestCurrentChapterPlan = async (req, res) => {
  try {
    const { storyId, chapterNumber } = req.body;

    // 1. KIỂM TRA INPUT
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

    // 2. KIỂM TRA STORY TRONG MYSQL
    const [storyCheck] = await db.query(`SELECT id FROM stories WHERE id = ? AND deleted_at IS NULL`, [cleanStoryId]);

    if (!storyCheck || storyCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bộ truyện không tồn tại trên hệ thống.",
      });
    }

    // 3. KẾT NỐI MONGODB
    const mongoDb = getMongoDb();

    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối MongoDB.",
      });
    }

    // 4. LẤY WORLD CỦA STORY
    const worldCollection = mongoDb.collection("worlds");
    const world = await worldCollection.findOne({
      storyId: cleanStoryId,
    });

    if (!world) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin thế giới của bộ truyện.",
        storyId: cleanStoryId,
      });
    }

    // 5. CHUẨN HÓA WORLD
    const worldData = {
      storyId: world.storyId,
      title: world.title || "",
      description: world.description || "",
      history: world.history || "",
      culture: world.culture || "",
      geography: world.geography || [],
      powerSystems: world.powerSystems || [],
      rules: world.rules || [],
    };

    // 6. GỌI N8N
    const n8nWebhook = "https://n8n.baostory.fun/webhook/suggest_1chapterplan_now";

    let n8nResponse;

    try {
      n8nResponse = await axios.post(
        n8nWebhook,
        {
          storyId: cleanStoryId,
          chapterNumber: cleanChapterNumber,
          world: worldData,
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
      console.error("Không kết nối được N8N:", n8nError.message);

      return res.status(502).json({
        success: false,
        message: "Backend không thể kết nối tới N8N.",
        error: n8nError.message,
      });
    }

    // 7. KIỂM TRA RESPONSE N8N
    if (n8nResponse.status < 200 || n8nResponse.status >= 300) {
      return res.status(502).json({
        success: false,
        message: `N8N trả về HTTP ${n8nResponse.status}.`,
        n8nStatus: n8nResponse.status,
        n8nResponse: n8nResponse.data,
      });
    }

    // 8. XỬ LÝ DATA N8N
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

    // 9. LẤY THÔNG TIN KẾ HOẠCH
    const generatedChapterNumber = Number(chapterPlan.chapterNumber) || cleanChapterNumber;
    const generatedTitle = chapterPlan.title || `Chương ${generatedChapterNumber}`;
    const generatedPurpose = chapterPlan.purpose || "";
    const generatedConflict = chapterPlan.conflict || "";
    const generatedEndingHook = chapterPlan.endingHook || "";

    // 10. RESPONSE VỀ FRONTEND
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
    console.error("LỖI suggestCurrentChapterPlan:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi gợi ý kế hoạch chương hiện tại.",
      error: error.message,
    });
  }
};
// =========================================================================
// HÀM CONTROLLER GỌI N8N TẠO 5 KẾ HOẠCH CHƯƠNG ĐẦU TIÊN
// =========================================================================
exports.suggestInitialChapterPlans = async (req, res) => {
  try {
    // 1. NHẬN DỮ LIỆU TỪ FRONTEND GỬI LÊN
    const { storyId, chapterNumber, characters } = req.body;

    // 2. KIỂM TRA STORY ID
    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp storyId để tạo kế hoạch chương.",
      });
    }

    const cleanStoryId = Number(storyId);

    if (!Number.isInteger(cleanStoryId) || cleanStoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "storyId phải là số nguyên dương hợp lệ.",
      });
    }

    // 3. KIỂM TRA STORY TỒN TẠI TRONG MYSQL
    const [storyCheck] = await db.query("SELECT id FROM stories WHERE id = ? AND deleted_at IS NULL", [cleanStoryId]);

    if (!storyCheck || storyCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Bộ truyện không tồn tại trên hệ thống.",
      });
    }

    // 4. KẾT NỐI MONGODB
    const mongoDb = getMongoDb();

    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu MongoDB.",
      });
    }

    // 5. LẤY WORLD CỦA STORY
    const worldCollection = mongoDb.collection("worlds");

    const world = await worldCollection.findOne({
      storyId: cleanStoryId,
    });

    if (!world) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin thế giới của bộ truyện.",
        storyId: cleanStoryId,
      });
    }

    // 6. CHUẨN HÓA WORLD
    const worldData = {
      storyId: world.storyId,
      title: world.title || "",
      description: world.description || "",
      history: world.history || "",
      culture: world.culture || "",
      geography: world.geography || [],
      powerSystems: world.powerSystems || [],
      rules: world.rules || [],
    };

    // 7. CHUẨN BỊ PAYLOAD GỬI SANG N8N (Bổ sung sourceChapters & characters)
    const n8nPayload = {
      storyId: cleanStoryId,
      chapterNumber: Array.isArray(chapterNumber) ? chapterNumber : [chapterNumber].filter(Boolean), // Mảng số chương nguồn từ Bước 1
      characters: characters || [], // Danh sách nhân vật tạm từ Bước 2
      world: worldData,
    };

    // 8. GỌI N8N
    const n8nWebhook = "https://n8n.baostory.fun/webhook/suggest_chapterplan";

    let n8nResponse;

    try {
      n8nResponse = await axios.post(n8nWebhook, n8nPayload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 120000,
        validateStatus: () => true,
      });
    } catch (n8nError) {
      console.error("Không kết nối được N8N:", n8nError.message);

      return res.status(502).json({
        success: false,
        message: "Backend không thể kết nối tới N8N.",
        error: n8nError.message,
      });
    }

    // 9. KIỂM TRA RESPONSE N8N
    if (n8nResponse.status < 200 || n8nResponse.status >= 300) {
      return res.status(502).json({
        success: false,
        message: `N8N trả về HTTP ${n8nResponse.status}.`,
        n8nResponse: n8nResponse.data,
      });
    }

    // 10. CHUẨN HÓA DỮ LIỆU TRẢ VỀ TỪ N8N
    let rawData = n8nResponse.data;

    if (typeof rawData === "string") {
      try {
        rawData = JSON.parse(rawData.trim());
      } catch (e) {}
    }

    if (rawData && typeof rawData === "object") {
      if (rawData.data !== undefined) rawData = rawData.data;
      if (rawData.json !== undefined) rawData = rawData.json;
      if (rawData.data !== undefined) rawData = rawData.data;
    }

    let plansArray = [];

    if (Array.isArray(rawData)) {
      plansArray = rawData;
    } else if (rawData && typeof rawData === "object") {
      plansArray = rawData.chapterPlans || rawData.plans || rawData.chapters || rawData.result || Object.values(rawData).find((val) => Array.isArray(val)) || [];
    }

    if (!Array.isArray(plansArray) || plansArray.length === 0) {
      return res.status(502).json({
        success: false,
        message: "N8N không trả về danh sách kế hoạch chương hợp lệ.",
        n8nResponse: n8nResponse.data,
      });
    }

    // 11. COLLECTION CHAPTER
    const planCollection = mongoDb.collection("chapter_plans");
    const contentCollection = mongoDb.collection("chapters_content");
    const processedPlans = [];

    // 12. DUYỆT TỪNG KẾ HOẠCH VÀ LƯU VÀO MONGODB
    for (const item of plansArray) {
      const chapterPlan = item?.chapterPlan || item?.json?.chapterPlan || item;
      const chapterNumberVal = Number(chapterPlan.chapterNumber || chapterPlan.chapter_number);

      if (!chapterNumberVal || isNaN(chapterNumberVal)) {
        continue;
      }

      const title = chapterPlan.title || `Chương ${chapterNumberVal}`;
      const purpose = chapterPlan.purpose || "";
      const conflict = chapterPlan.conflict || "";
      const endingHook = chapterPlan.endingHook || "";
      const summary = chapterPlan.summary || chapterPlan.background || "";

      // 12.1 UPSERT CHAPTER PLAN
      const planUpdateResult = await planCollection.findOneAndUpdate(
        {
          storyId: cleanStoryId,
          chapterNumber: chapterNumberVal,
        },
        {
          $setOnInsert: {
            storyId: cleanStoryId,
            chapterNumber: chapterNumberVal,
            createdAt: new Date(),
          },
          $set: {
            title,
            summary,
            purpose,
            conflict,
            endingHook,
            updatedAt: new Date(),
          },
        },
        {
          upsert: true,
          returnDocument: "after",
        },
      );

      const savedPlan = planUpdateResult.value || planUpdateResult;

      // 12.2 KIỂM TRA CHƯƠNG NỘI DUNG
      const existingChapter = await contentCollection.findOne({
        storyId: cleanStoryId,
        chapterNumber: chapterNumberVal,
      });

      let chapterId = null;

      if (existingChapter) {
        chapterId = existingChapter._id.toString();
      } else {
        // 12.3 TẠO CHƯƠNG RỖNG
        const newChapterDoc = {
          storyId: cleanStoryId,
          chapterNumber: chapterNumberVal,
          title: title,
          content: "",
          status: "DRAFT",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const insertResult = await contentCollection.insertOne(newChapterDoc);
        chapterId = insertResult.insertedId.toString();
      }

      // 12.4 ĐƯA VÀO KẾT QUẢ
      processedPlans.push({
        planId: savedPlan._id ? savedPlan._id.toString() : null,
        chapterId,
        storyId: cleanStoryId,
        chapterNumber: chapterNumberVal,
        title,
        summary,
        purpose,
        conflict,
        endingHook,
      });
    }

    // 13. RESPONSE VỀ FRONTEND
    return res.status(200).json({
      success: true,
      message: "AI đã tạo thành công kế hoạch chương dựa trên chương nguồn và nhân vật phái sinh!",
      data: processedPlans,
    });
  } catch (error) {
    console.error("LỖI suggestInitialChapterPlans:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo kế hoạch chương.",
      error: error.message,
    });
  }
};
