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

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập hết hạn.",
      });
    }

    if (!storyId || isNaN(Number(storyId))) {
      return res.status(400).json({
        success: false,
        message: "Mã truyện không hợp lệ.",
      });
    }

    const mongoDb = getMongoDb();
    const collection = mongoDb.collection("story_outlines");

    let outline = await collection.findOne({
      storyId: Number(storyId),
    });

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

    return res.status(200).json({
      success: true,

      message: "Tải dữ liệu khung sườn thành công.",

      data: outline,
    });
  } catch (error) {
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

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập.",
      });
    }

    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã truyện (storyId).",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối MongoDB Atlas.",
      });
    }

    const collection = mongoDb.collection("story_outlines");
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

    const cleanStoryId = !isNaN(Number(storyId)) ? Number(storyId) : storyId;
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

    return res.status(200).json({
      success: true,
      message: "Lưu thông tin đề cương thành công.",
    });
  } catch (error) {
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
function extractAIContent(rawData) {
  if (rawData === null || rawData === undefined) {
    return "";
  }

  if (typeof rawData === "string") {
    return rawData.trim();
  }

  if (Array.isArray(rawData)) {
    if (rawData.length === 0) return "";

    return rawData
      .map((item) => extractAIContent(item))
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  if (typeof rawData === "object") {
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

// 1. GỢI Ý TÓM TẮT 5 CÂU
exports.aiSuggest5Sentences = async (req, res) => {
  return handleAISuggestion(req, res, "5sentence");
};

// 2. GỢI Ý CHI TIẾT 1 TRANG
exports.aiSuggest1Page = async (req, res) => {
  return handleAISuggestion(req, res, "1page");
};

// 3. GỢI Ý OUTLINE 4 TRANG
exports.aiSuggest4Pages = async (req, res) => {
  return handleAISuggestion(req, res, "4pages");
};

// =====================================================
// HÀM XỬ LÝ CHUNG
// =====================================================
const handleAISuggestion = async (req, res, plotType) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập hết hạn.",
      });
    }

    if (!storyId || isNaN(Number(storyId))) {
      return res.status(400).json({
        success: false,
        message: "Mã truyện không hợp lệ.",
      });
    }

    const n8nWebhookUrl = webhookMap[plotType];

    if (!n8nWebhookUrl) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy webhook N8N.",
      });
    }

    const mongoDb = getMongoDb();
    const collection = mongoDb.collection("story_outlines");

    const outlineDocument = await collection.findOne({
      storyId: Number(storyId),
    });

    const outline = {
      fiveSentences: outlineDocument?.fiveSentences || "",
      onePage: outlineDocument?.onePage || "",
      fourPages: outlineDocument?.fourPages || "",
    };

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
      console.error("KHÔNG KẾT NỐI ĐƯỢC N8N:", n8nError.message);

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

    if (aiResponse.status < 200 || aiResponse.status >= 300) {
      return res.status(502).json({
        success: false,
        message: `N8N trả về HTTP ${aiResponse.status}.`,
        n8nStatus: aiResponse.status,
        n8nResponse: aiResponse.data,
      });
    }

    const content = extractAIContent(aiResponse.data);

    if (!content) {
      return res.status(502).json({
        success: false,
        message: "N8N không trả về nội dung AI.",
        n8nResponse: aiResponse.data,
      });
    }

    const result = {
      fiveSentences: plotType === "5sentence" ? content : "",
      onePage: plotType === "1page" ? content : "",
      fourPages: plotType === "4pages" ? content : "",
    };

    return res.status(200).json({
      success: true,
      message: "AI đã tạo gợi ý khung sườn thành công.",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xử lý AI.",
      error: error.message,
    });
  }
};
