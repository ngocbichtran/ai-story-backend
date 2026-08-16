const express = require("express");
const router = express.Router();
const chapterController = require("../controllers/chapterController");
const authMiddleware = require("../middleware/authMiddleware");

// AI sửa lỗi chính tả chương qua n8n
router.post("/ai/:chapterId/spell-check", authMiddleware, chapterController.spellCheck);

// AI gợi ý nội dung chương
router.post("/ai/:chapterNumber/plot-suggestion", authMiddleware, chapterController.aiSuggestContent);

// Lấy chi tiết nội dung hiển thị của một chương
router.get("/display-chapter/:storyId/:chapterNumber", chapterController.getDisplayChapter);

// Lấy mục lục danh sách các chương của 1 bộ truyện
router.get("/:storyId/chapters", chapterController.getChaptersByStory);

// Tạo chương mới cho một bộ truyện cụ thể
router.post("/:storyId/chapters", authMiddleware, chapterController.createChapter);

// Lưu nội dung chương truyện thủ công
router.put("/edit/:storyId/:chapterNumber", authMiddleware, chapterController.updateChapterContent);

// Xóa chương truyện và tự động dồn số thứ tự
router.delete("/:storyId/chapters/:chapterNumber", authMiddleware, chapterController.deleteChapterSoft);

// Lưu nội dung chương truyện tự động
router.put("/autosave/:storyId/:chapterNumber/", authMiddleware, chapterController.autoSaveChapterContent);

// Lấy danh sách Lịch sử phiên bản
router.get("/history", authMiddleware, chapterController.getChapterHistory);

// Khôi phục phiên bản chương cũ
router.put("/restore/:storyId/:chapterNumber", authMiddleware, chapterController.restoreChapterVersion);
module.exports = router;
