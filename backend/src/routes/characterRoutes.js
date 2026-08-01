const express = require("express");
const router = express.Router();
const characterController = require("../controllers/characterController");
const authMiddleware = require("../middleware/authMiddleware");

// Khởi tạo nhân vật mới cho truyện
router.post("/", authMiddleware, characterController.createCharacter);

// Lấy chi tiết một nhân vật theo characterId
router.get("/:characterId", authMiddleware, characterController.getCharacterDetail);

// Lấy danh sách nhân vật theo storyId (Hỗ trợ lọc theo query ?role=...)
router.get("/:storyId/list", authMiddleware, characterController.getCharactersByStory);

// Cập nhật thông tin nhân vật theo characterId (Đặc tả 019_F1)
router.put("/:characterId", authMiddleware, characterController.updateCharacter);

// Xóa mềm nhân vật theo characterId (Đặc tả 020_F1)
router.delete("/:characterId", authMiddleware, characterController.deleteCharacter);
module.exports = router;
