const express = require("express");
const router = express.Router();
const storyOutlineController = require("../controllers/storyOutlineController");
// Tuyến đường xử lý cốt truyện (Đính kèm authMiddleware để xác thực token)
router.get("/:storyId/outline", authMiddleware, storyOutlineController.getStoryOutline);
router.put("/:storyId/outline", authMiddleware, storyOutlineController.updateStoryOutline);
