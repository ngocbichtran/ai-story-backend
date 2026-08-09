// src/controllers/storyOutlineController.js

const { getMongoDb } = require("../config/mongo");
const axios = require("axios");

// =====================================================
// N8N WEBHOOK CONFIG
// =====================================================

const N8N_BASE_URL = "https://n8n.baostory.fun";

const webhookMap = {
  "5sentence": `${N8N_BASE_URL}/webhook/suggest-storyoutline_5sentences`,
  "1page": `${N8N_BASE_URL}/webhook/suggest-storyoutline_1page`,
  "4pages": `${N8N_BASE_URL}/webhook/suggest-storyoutline_4page`,
};

// =====================================================
// LẤY THÔNG TIN KHUNG SƯỜN TRUYỆN
// =====================================================

exports.getStoryOutline = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id;

    // =====================================================
    // CHECK USER
    // =====================================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập hết hạn.",
      });
    }

    // =====================================================
    // CHECK STORY ID
    // =====================================================

    if (!storyId || isNaN(Number(storyId))) {
      return res.status(400).json({
        success: false,
        message: "Mã truyện không hợp lệ.",
      });
    }

    // =====================================================
    // MONGODB
    // =====================================================

    const mongoDb = getMongoDb();

    const collection = mongoDb.collection("story_outlines");

    // =====================================================
    // TÌM OUTLINE
    // =====================================================

    let outline = await collection.findOne({
      storyId: Number(storyId),
    });

    // =====================================================
    // NẾU CHƯA CÓ → TẠO OUTLINE RỖNG
    // =====================================================

    if (!outline) {
      const newBlankOutline = {
        storyId: Number(storyId),

        fiveSentences: "",

        onePage: "",

        fourPages: "",

        createdAt: new Date(),

        updatedAt: new Date(),
      };

      await collection.insertOne(newBlankOutline);

      outline = newBlankOutline;
    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,

      message: "Tải dữ liệu khung sườn thành công.",

      data: outline,
    });
  } catch (error) {
    console.error("");
    console.error("==========================================");
    console.error("❌ LỖI GET STORY OUTLINE");
    console.error("==========================================");

    console.error(error);

    return res.status(500).json({
      success: false,

      message: "Lỗi hệ thống khi tải đề cương.",
    });
  }
};

// =====================================================
// CẬP NHẬT KHUNG SƯỜN
// =====================================================

exports.updateStoryOutline = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { fiveSentences, onePage, fourPages } = req.body;
    const userId = req.user?.id;

    // =====================================================
    // CHECK USER
    // =====================================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập.",
      });
    }

    // =====================================================
    // CHECK STORY ID (Hỗ trợ cả dạng số hoặc chuỗi)
    // =====================================================

    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã truyện (storyId).",
      });
    }

    // =====================================================
    // MONGODB
    // =====================================================

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối MongoDB Atlas.",
      });
    }

    const collection = mongoDb.collection("story_outlines");

    // =====================================================
    // CHỈ UPDATE NHỮNG FIELD ĐƯỢC GỬI LÊN
    // =====================================================

    const updateData = {
      updatedAt: new Date(),
    };

    if (fiveSentences !== undefined) {
      updateData.fiveSentences = fiveSentences;
    }

    if (onePage !== undefined) {
      updateData.onePage = onePage;
    }

    if (fourPages !== undefined) {
      updateData.fourPages = fourPages;
    }

    // Linh hoạt ép kiểu storyId sang Number nếu nó là dạng số, giữ nguyên nếu là string
    const cleanStoryId = !isNaN(Number(storyId)) ? Number(storyId) : storyId;

    // =====================================================
    // UPDATE / UPSERT
    // =====================================================

    const result = await collection.updateOne(
      {
        storyId: cleanStoryId,
      },
      {
        $set: updateData,
        $setOnInsert: {
          storyId: cleanStoryId,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    );

    console.log("✅ Đã cập nhật outline thành công vào MongoDB:", result.modifiedCount || result.upsertedCount);

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({
      success: true,
      message: "Lưu thông tin đề cương thành công.",
    });
  } catch (error) {
    console.error("");
    console.error("==========================================");
    console.error("❌ LỖI UPDATE STORY OUTLINE");
    console.error("==========================================");
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lưu đề cương.",
      error: error.message,
    });
  }
};

// =====================================================
// HÀM CHUYỂN OUTPUT N8N → STRING
// =====================================================
//
// N8N của bạn hiện tại trả:
//
// [
//   {
//     "outline": [
//       "Câu 1",
//       "Câu 2",
//       "Câu 3",
//       "Câu 4",
//       "Câu 5"
//     ]
//   }
// ]
//
// Hàm này xử lý:
// 1. string
// 2. object
// 3. array
// 4. { outline: [] }
// 5. [{ outline: [] }]
// 6. { content: "..." }
// 7. { output: "..." }
// 8. { text: "..." }
// =====================================================

// =====================================================
// HÀM CHUYỂN OUTPUT N8N → STRING
// =====================================================
function extractAIContent(rawData) {
  if (rawData === null || rawData === undefined) {
    return "";
  }

  // 1. Nếu rawData là string trực tiếp
  if (typeof rawData === "string") {
    return rawData.trim();
  }

  // 2. Nếu rawData là mảng (Array)
  if (Array.isArray(rawData)) {
    if (rawData.length === 0) return "";

    // Đệ quy xử lý từng phần tử trong mảng và nối lại bằng khoảng trống/xuống dòng
    return rawData
      .map((item) => extractAIContent(item))
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  // 3. Nếu rawData là object (Dạng { outline: [...] } hoặc tương tự)
  if (typeof rawData === "object") {
    // Các key ưu tiên kiểm tra từ n8n
    const possibleKeys = ["outline", "outline1", "content", "output", "text", "fiveSentences", "onePage", "fourPages"];

    for (const key of possibleKeys) {
      if (rawData[key] !== undefined && rawData[key] !== null) {
        const extracted = extractAIContent(rawData[key]);
        if (extracted) return extracted;
      }
    }
  }

  return "";
}

// =====================================================
// AI GỢI Ý KHUNG SƯỜN
//
// FRONTEND
//      ↓
// BACKEND LOCAL :4000
//      ↓
// N8N
//      ↓
// AI
//      ↓
// N8N
//      ↓
// BACKEND
//      ↓
// FRONTEND
// =====================================================
// =====================================================
// 1. GỢI Ý TÓM TẮT 5 CÂU
// =====================================================
exports.aiSuggest5Sentences = async (req, res) => {
  return handleAISuggestion(req, res, "5sentence");
};

// =====================================================
// 2. GỢI Ý CHI TIẾT 1 TRANG
// =====================================================
exports.aiSuggest1Page = async (req, res) => {
  return handleAISuggestion(req, res, "1page");
};

// =====================================================
// 3. GỢI Ý OUTLINE 4 TRANG
// =====================================================
exports.aiSuggest4Pages = async (req, res) => {
  return handleAISuggestion(req, res, "4pages");
};

// =====================================================
// HÀM XỬ LÝ CHUNG (COMMON HELPER ĐỂ TRÁNH LẶP CODE)
// =====================================================
const handleAISuggestion = async (req, res, plotType) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id;

    console.log("");
    console.log("==========================================");
    console.log(`🤖 AI STORY OUTLINE (${plotType.toUpperCase()})`);
    console.log("==========================================");
    console.log("Story ID:", storyId);
    console.log("User ID:", userId);

    // =====================================================
    // CHECK USER
    // =====================================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập hết hạn.",
      });
    }

    // =====================================================
    // CHECK STORY ID
    // =====================================================

    if (!storyId || isNaN(Number(storyId))) {
      return res.status(400).json({
        success: false,
        message: "Mã truyện không hợp lệ.",
      });
    }

    // =====================================================
    // LẤY WEBHOOK
    // =====================================================

    const n8nWebhookUrl = webhookMap[plotType];

    if (!n8nWebhookUrl) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy webhook N8N.",
      });
    }

    // =====================================================
    // LẤY OUTLINE TỪ MONGODB
    // =====================================================

    const mongoDb = getMongoDb();
    const collection = mongoDb.collection("story_outlines");

    const outlineDocument = await collection.findOne({
      storyId: Number(storyId),
    });

    // =====================================================
    // NẾU CHƯA CÓ OUTLINE
    // =====================================================

    const outline = {
      fiveSentences: outlineDocument?.fiveSentences || "",
      onePage: outlineDocument?.onePage || "",
      fourPages: outlineDocument?.fourPages || "",
    };

    // =====================================================
    // KIỂM TRA DỮ LIỆU ĐẦU VÀO
    // =====================================================

    console.log("📚 OUTLINE LẤY TỪ MONGODB:");
    console.log(JSON.stringify(outline, null, 2));

    // =====================================================
    // CURRENT CONTENT
    // =====================================================

    let currentContent = "";

    if (plotType === "5sentence") {
      currentContent = outline.fiveSentences;
    }

    if (plotType === "1page") {
      currentContent = outline.onePage;
    }

    if (plotType === "4pages") {
      currentContent = outline.fourPages;
    }

    // =====================================================
    // PAYLOAD GỬI N8N
    // =====================================================

    const payload = {
      storyId: Number(storyId),
      userId: Number(userId),
      plotType,

      originalOutline: {
        fiveSentences: outline.fiveSentences,
        onePage: outline.onePage,
        fourPages: outline.fourPages,
      },

      currentContent,
    };

    console.log("📤 PAYLOAD GỬI N8N:");
    console.log(JSON.stringify(payload, null, 2));

    console.log("🌐 N8N WEBHOOK:", n8nWebhookUrl);

    // =====================================================
    // GỌI N8N
    // =====================================================

    let aiResponse;

    try {
      aiResponse = await axios.post(n8nWebhookUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        timeout: 120000,

        validateStatus: () => true,
      });
    } catch (n8nError) {
      console.error("❌ KHÔNG KẾT NỐI ĐƯỢC N8N:", n8nError.message);

      return res.status(502).json({
        success: false,
        message: "Backend không thể kết nối tới N8N.",

        error: {
          code: n8nError.code,
          message: n8nError.message,
          webhook: n8nWebhookUrl,
        },
      });
    }

    // =====================================================
    // CHECK STATUS N8N
    // =====================================================

    console.log("📥 N8N STATUS:", aiResponse.status);

    console.log("📥 N8N RESPONSE:", JSON.stringify(aiResponse.data, null, 2));

    if (aiResponse.status < 200 || aiResponse.status >= 300) {
      return res.status(502).json({
        success: false,
        message: `N8N trả về HTTP ${aiResponse.status}.`,
        n8nStatus: aiResponse.status,
        n8nResponse: aiResponse.data,
      });
    }

    // =====================================================
    // EXTRACT AI CONTENT
    // =====================================================

    const content = extractAIContent(aiResponse.data);

    if (!content) {
      return res.status(502).json({
        success: false,
        message: "N8N không trả về nội dung AI.",
        n8nResponse: aiResponse.data,
      });
    }

    // =====================================================
    // KẾT QUẢ
    // =====================================================

    const result = {
      fiveSentences: plotType === "5sentence" ? content : "",

      onePage: plotType === "1page" ? content : "",

      fourPages: plotType === "4pages" ? content : "",
    };

    // =====================================================
    // RESPONSE FRONTEND
    // =====================================================

    return res.status(200).json({
      success: true,

      message: "AI đã tạo gợi ý khung sườn thành công.",

      data: result,
    });
  } catch (error) {
    console.error("❌ LỖI AI STORY OUTLINE CONTROLLER:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xử lý AI.",
      error: error.message,
    });
  }
};
