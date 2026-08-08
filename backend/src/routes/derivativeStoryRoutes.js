const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const derivativeController = require("../controllers/derivativeStoryController");

// Route 1: Tạo truyện phái sinh và kế hoạch chương
router.post("/derivative", authMiddleware, derivativeController.createDerivativeStory);

module.exports = router;
