const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
const chapterQueryController = require("../controllers/chapterQueryController");
const authMiddleware = require("../middleware/authMiddleware"); // Kiểm tra Token tác giả

// ====================================================================
// LUỒNG NGHIỆP VỤ (POST)
// ====================================================================

/* POST /api/chapters/create-outline Bước 5: Khởi tạo chương mới và lưu dàn ý ban đầu */
router.post("/create-outline", authMiddleware, chapterController.createOutline);

/* POST /api/chapters/:id/check-consistency Bước 6 & 7: Quét lỗi logic bản nháp, kiểm tra tính nhất quang */
router.post("/:id/check-consistency", authMiddleware, chapterController.checkConsistency);

/* POST /api/chapters/:id/spell-check Bước 8: Gọi AI biên tập và sửa lỗi chính tả bản nháp qua n8n */
router.post("/:id/spell-check", authMiddleware, chapterController.spellCheck);

/* POST /api/chapters/:id/generate-art Bước 9: Gọi AI trích xuất nhân vật và tự động sinh ảnh minh họa */
router.post("/:id/generate-art", authMiddleware, chapterController.generateIllustration);

/* POST /api/chapters/:id/finalize Bước 10: Đồng bộ hóa bản thảo chữ hoàn chỉnh xuống ổ cứng vật lý */
router.post("/:id/finalize", authMiddleware, chapterController.finalizeManuscript);

// ====================================================================
// --- CÁC ROUTE TRUY VẤN HIỂN THỊ (GET) ---
// ====================================================================

/* GET /api/chapters/stories -> Lấy danh sách tất cả các bộ truyện (MySQL) */
router.get("/stories", authMiddleware, chapterQueryController.getStories);

/* GET /api/chapters/story-chapters -> Lấy mục lục danh sách các chương của 1 truyện (MySQL) */
router.get("/story-chapters", chapterQueryController.getChaptersByStory);

/* GET /api/chapters/display-chapter -> Lấy chi tiết nội dung chữ (MongoDB Atlas) */
router.get("/display-chapter", chapterQueryController.getDisplayChapter);

/* POST /api/chapters/create -> Tạo chương mới */
router.post("/create", authMiddleware, chapterController.createChapter);

module.exports = router;
