const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
const authMiddleware = require("../middleware/authMiddleware"); // Middleware kiểm tra Token tác giả

// =========================================================================
// 1. NHÓM ROUTE CỤ THỂ / AI (Ưu tiên đưa lên đầu)
// =========================================================================

// AI sửa lỗi chính tả chương qua n8n
router.post("/ai/:chapterId/spell-check", authMiddleware, chapterController.spellCheck);

// Lấy chi tiết nội dung hiển thị của một chương (MongoDB Atlas)
router.get("/display-chapter/:storyId/:chapterNumber", chapterController.getDisplayChapter);

// =========================================================================
// 2. NHÓM ROUTE QUẢN LÝ CHƯƠNG THEO STORY ID
// =========================================================================

// Lấy mục lục danh sách các chương của 1 bộ truyện
router.get("/:storyId/chapters", chapterController.getChaptersByStory);

// Tạo chương mới cho một bộ truyện cụ thể
router.post("/:storyId/chapters", authMiddleware, chapterController.createChapter);

// Lưu nội dung chương truyện thủ công (Đặc tả 025_F1 / 025_F2)
router.put("/edit/:storyId/:chapterNumber", authMiddleware, chapterController.updateChapterContent);

// Xóa chương truyện và tự động dồn số thứ tự
router.delete("/:storyId/chapters/:chapterNumber", authMiddleware, chapterController.deleteChapterSoft);

// Lưu nội dung chương truyện tự động (Autosave - Đặc tả 026_F1)
router.put("/autosave/:storyId/:chapterNumber/", authMiddleware, chapterController.autoSaveChapterContent);

// Lấy danh sách Lịch sử phiên bản
router.get("/history", authMiddleware, chapterController.getChapterHistory);

// Khôi phục phiên bản chương cũ
router.put("/restore/:storyId/:chapterNumber", authMiddleware, chapterController.restoreChapterVersion);
module.exports = router;
