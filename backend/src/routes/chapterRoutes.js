const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
const authMiddleware = require("../middleware/authMiddleware"); // Kiểm tra Token tác giả

// =========================================================================
// 1. NHÓM ROUTE CỤ THỂ / AI (Đưa lên đầu để tránh bị nuốt tham số)
// =========================================================================

// AI sửa lỗi chính tả chương qua n8n
// POST /api/chapters/ai/:chapterId/spell-check
router.post("/ai/:chapterId/spell-check", authMiddleware, chapterController.spellCheck);

// Lấy chi tiết nội dung của một chương (MongoDB Atlas)
// GET /api/chapters/display-chapter/:storyId/:chapterNumber
router.get("/display-chapter/:storyId/:chapterNumber", chapterController.getDisplayChapter);

// =========================================================================
// 2. NHÓM ROUTE THEO STORY ID (Đưa xuống dưới)
// =========================================================================

// Lấy mục lục danh sách các chương của 1 bộ truyện (MongoDB)
// GET /api/chapters/:storyId/chapters
router.get("/:storyId/chapters", chapterController.getChaptersByStory);

// Tạo chương mới cho một bộ truyện cụ thể
// POST /api/chapters/:storyId/chapters
router.post("/:storyId/chapters", authMiddleware, chapterController.createChapter);

// Xóa chương truyện và tự dồn số thứ tự
// DELETE /api/chapters/:storyId/chapters/:chapterNumber
router.delete("/:storyId/chapters/:chapterNumber", authMiddleware, chapterController.deleteChapterSoft);

module.exports = router;
