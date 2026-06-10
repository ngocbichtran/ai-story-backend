const express = require("express");
const router = express.Router();
const storyController = require("../controllers/storyController");
const authMiddleware = require("../middleware/authMiddleware"); // Đảm bảo tác giả đã đăng nhập

// ====================================================================
// LUỒNG NGHIỆP VỤ KHỞI TẠO & LẬP KẾ HOẠCH TRUYỆN (BƯỚC 1 & BƯỚC 2)
// ====================================================================

/**
 * @route   POST /api/stories/init
 * @desc    Bước 1 & 2: Khởi tạo tác phẩm mới (lưu tên, thể loại, đường dẫn folder)
 * và tự động gọi AI (hoặc Mockup) để phân tích, lên kế hoạch các Hồi (Story Arcs)
 * @access  Private (Cần Đăng nhập)
 */
router.post("/init", authMiddleware, storyController.initStory);

/**
 * @route   PUT /api/stories/planning/approve
 * @desc    Bước 2 (Cuối): Tác giả chỉnh sửa trực tiếp các Hồi do AI gợi ý trên UI và bấm Chốt duyệt
 * (Cập nhật lại DB và chuyển trạng thái is_human_approved = 1)
 * @access  Private (Cần Đăng nhập)
 */
router.put("/planning/approve", authMiddleware, storyController.approveStoryPlanning);

module.exports = router;
/**
 * API Chốt duyệt kế hoạch cốt truyện từ Tác giả (Nút "Tạo truyện" cuối cùng trên giao diện)
 * PUT /api/stories/planning/approve
 */
exports.approveStoryPlanning = async (req, res) => {
  const { story_id, arcs } = req.body;

  if (!story_id || !Array.isArray(arcs)) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ." });
  }

  // THAY DÒNG BỊ LỖI CŨ: const connection = await db.getConnection();
  // THÀNH DÒNG MỚI DƯỚI ĐÂY:
  const connection = await db.promise().getConnection();
  await connection.beginTransaction();

  try {
    for (const arc of arcs) {
      await connection.query(
        `INSERT INTO story_planning (story_id, part_number, title, plot_summary, climax, is_human_approved) 
                 VALUES (?, ?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE 
                    title = VALUES(title), 
                    plot_summary = VALUES(plot_summary), 
                    climax = VALUES(climax), 
                    is_human_approved = 1`,
        [story_id, arc.part_number, arc.title, arc.plot_summary, arc.climax],
      );
    }

    await connection.commit();
    return res.status(200).json({ success: true, message: "Đã chốt duyệt toàn bộ kế hoạch cốt truyện chính thức." });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};
