const express = require("express");
const router = express.Router();
const storyController = require("../controllers/storyController");
const chapterController = require("../controllers/chapterController");
const authMiddleware = require("../middleware/authMiddleware"); // Kiểm tra Token tác giả

// Lấy chi tiết nội dung, bản thảo của một chương để đọc/viết (MongoDB Atlas)
// GET /api/chapters/:chapterId
router.get("/:chapterId", storyController.getDisplayChapter);

// AI sửa lỗi chính tả bản nháp chương qua n8n
// POST /api/chapters/:chapterId/spell-check
router.post(":chapterId/spell-check", authMiddleware, chapterController.spellCheck);

module.exports = router;
