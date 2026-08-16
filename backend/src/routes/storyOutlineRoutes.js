const express = require("express");
const router = express.Router();
const storyOutlineController = require("../controllers/storyOutlineController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/:storyId/outline", authMiddleware, storyOutlineController.getStoryOutline);
router.put("/:storyId/outline", authMiddleware, storyOutlineController.updateStoryOutline);
router.post("/:storyId/ai-suggest-5sentences", authMiddleware, storyOutlineController.aiSuggest5Sentences);
router.post("/:storyId/ai-suggest-1page", authMiddleware, storyOutlineController.aiSuggest1Page);
router.post("/:storyId/ai-suggest-4pages", authMiddleware, storyOutlineController.aiSuggest4Pages);

module.exports = router;
