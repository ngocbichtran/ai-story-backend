const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
const authMiddleware = require("../middleware/authMiddleware"); // Kiểm tra Token tác giả

// ====================================================================
// LUỒNG NGHIỆP VỤ CUỐN CHIẾU TỪNG CHƯƠNG (BƯỚC 5 ĐẾN BƯỚC 10)
// ====================================================================

/**
 * @route   POST /api/chapters/create-outline
 * @desc    Bước 5: Khởi tạo chương mới và lưu dàn ý ban đầu
 * @access  Private
 */
router.post("/create-outline", authMiddleware, chapterController.createOutline);

/**
 * @route   POST /api/chapters/:id/check-consistency
 * @desc    Bước 6 & 7: Quét lỗi logic bản nháp, kiểm tra tính nhất quán
 * @access  Private
 */
router.post("/:id/check-consistency", authMiddleware, chapterController.checkConsistency);

/**
 * @route   POST /api/chapters/:id/spell-check
 * @desc    Bước 8: Gọi AI biên tập và sửa lỗi chính tả bản nháp qua n8n
 * @access  Private
 */
router.post("/:id/spell-check", authMiddleware, chapterController.spellCheck);

/**
 * @route   POST /api/chapters/:id/generate-art
 * @desc    Bước 9: Gọi AI trích xuất nhân vật và tự động sinh ảnh minh họa
 * @access  Private
 */
router.post("/:id/generate-art", authMiddleware, chapterController.generateIllustration);

/**
 * @route   POST /api/chapters/:id/finalize
 * @desc    Bước 10: Đồng bộ hóa bản thảo chữ hoàn chỉnh xuống ổ cứng vật lý
 * @access  Private
 */
router.post("/:id/finalize", authMiddleware, chapterController.finalizeManuscript);

module.exports = router;
