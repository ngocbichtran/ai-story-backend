const express = require("express");
const router = express.Router();
const storyOutlineController = require("../controllers/storyOutlineController");
const authMiddleware = require("../middleware/authMiddleware"); // 1. Bổ sung require authMiddleware

// Tuyến đường xử lý cốt truyện (Đính kèm authMiddleware để xác thực token)
router.get("/:storyId/outline", authMiddleware, storyOutlineController.getStoryOutline);
router.put("/:storyId/outline", authMiddleware, storyOutlineController.updateStoryOutline);

// 2. Bắt buộc phải export router ở cuối file
module.exports = router;
