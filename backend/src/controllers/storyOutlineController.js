// src/controllers/storyOutlineController.js
const { getMongoDb } = require("../config/mongo");

// =========================================================================
// 1. API: LẤY THÔNG TIN KHUNG SƯỜN TRUYỆN (Có cơ chế Auto-Fix 404)
// =========================================================================
exports.getStoryOutline = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Phiên đăng nhập hết hạn." });
    }

    const mongoDb = getMongoDb();
    const collection = mongoDb.collection("story_outlines");

    // 1. Truy vấn tìm kiếm
    let outline = await collection.findOne({ storyId: Number(storyId) });

    // Nếu là truyện cũ chưa có bản ghi, tự động tạo ngầm luôn!
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
      outline = newBlankOutline; // Gán lại để trả về cho Frontend tiếp tục chạy mượt mà
    }

    return res.status(200).json({
      success: true,
      message: "Tải dữ liệu khung sườn thành công.",
      data: outline,
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm getStoryOutline:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi tải đề cương." });
  }
};

// =========================================================================
// 2. API: CẬP NHẬT NỘI DUNG KHUNG SƯỜN TRUYỆN (Sử dụng Upsert tránh 404)
// =========================================================================
exports.updateStoryOutline = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { fiveSentences, onePage, fourPages } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Bạn cần đăng nhập." });
    }

    const mongoDb = getMongoDb();
    const collection = mongoDb.collection("story_outlines");

    // Nếu tìm không thấy bản thảo cũ, Mongo sẽ tự tạo dòng mới theo filter storyId mà không báo lỗi
    await collection.updateOne(
      { storyId: Number(storyId) },
      {
        $set: {
          fiveSentences: fiveSentences !== undefined ? fiveSentences : "",
          onePage: onePage !== undefined ? onePage : "",
          fourPages: fourPages !== undefined ? fourPages : "",
          updatedAt: new Date(),
        },
      },
      { upsert: true }, // Kích hoạt tính năng thông minh: Insert if not found
    );

    return res.status(200).json({
      success: true,
      message: "Lưu thông tin đề cương khung sườn tác phẩm thành công.",
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm updateStoryOutline:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi lưu đề cương." });
  }
};
