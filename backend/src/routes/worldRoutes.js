const express = require("express");
const router = express.Router();
const worldController = require("../controllers/worldController");
const authMiddleware = require("../middleware/authMiddleware"); // Middleware xác thực token tác giả

// =========================================================================
// ĐỊNH TUYẾN API CHO THẾ GIỚI / BỐI CẢNH (WORLDS)
// =========================================================================
// Lấy chi tiết một thế giới theo worldId
router.get("/detail/:worldId", authMiddleware, worldController.getWorldDetail);

// Lấy danh sách thế giới theo storyId
router.get("/list/:storyId", authMiddleware, worldController.getWorldsByStory);

// Tạo bối cảnh thế giới mới cho truyện
router.post("/", authMiddleware, worldController.createWorld);

// Cập nhật bối cảnh thế giới theo worldId
router.put("/:worldId", authMiddleware, worldController.updateWorld);

// Xóa vĩnh viễn bối cảnh thế giới theo worldId
router.delete("/:worldId", authMiddleware, worldController.deleteWorld);
module.exports = router;
