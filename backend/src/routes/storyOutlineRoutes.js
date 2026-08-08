const express = require("express");
const router = express.Router();
const storyOutlineController = require("../controllers/storyOutlineController");
const authMiddleware = require("../middleware/authMiddleware"); // 1. Bổ sung require authMiddleware

// Tuyến đường xử lý cốt truyện (Đính kèm authMiddleware để xác thực token)
router.get("/:storyId/outline", authMiddleware, storyOutlineController.getStoryOutline);
router.put("/:storyId/outline", authMiddleware, storyOutlineController.updateStoryOutline);
// Tách thành 3 API riêng biệt
router.post("/:storyId/ai-suggest-5sentences", authMiddleware, storyOutlineController.aiSuggest5Sentences);
router.post("/:storyId/ai-suggest-1page", authMiddleware, storyOutlineController.aiSuggest1Page);
router.post("/:storyId/ai-suggest-4pages", authMiddleware, storyOutlineController.aiSuggest4Pages);
// 2. Bắt buộc phải export router ở cuối file
module.exports = router;
