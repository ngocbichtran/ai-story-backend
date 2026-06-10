const express = require("express");
const router = express.Router();
const storyController = require("../controllers/storyController");
const authMiddleware = require("../middleware/authMiddleware"); // Đảm bảo tác giả đã đăng nhập

// ====================================================================
// LUỒNG NGHIỆP VỤ KHỞI TẠO & LẬP KẾ HOẠCH TRUYỆN (BƯỚC 1 & BƯỚC 2)
// ====================================================================

/**
 * @route   POST /api/stories/init
 * @desc    Bước 1: Khởi tạo tác phẩm mới (lưu tên, thể loại, đường dẫn folder)
 * @access  Private (Cần Đăng nhập)
 */
router.post("/init", authMiddleware, storyController.initStory);

/**
 * @route   POST /api/stories/approve-planning
 * @desc    Bước 2: Tạo nhanh hoặc chốt duyệt kế hoạch phân hồi (Lưu cấu trúc MySQL)
 * @access  Private (Cần Đăng nhập)
 */
router.post("/approve-planning", authMiddleware, storyController.approveStoryPlanning);
router.get("/stories/:id", storyController.getStoryById);
module.exports = router;
