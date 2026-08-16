const express = require("express");
const router = express.Router();
const characterController = require("../controllers/characterController");
const authMiddleware = require("../middleware/authMiddleware");

// Khởi tạo nhân vật mới cho truyện
router.post("/", authMiddleware, characterController.createCharacter);

// Lấy chi tiết một nhân vật theo characterId
router.get("/:characterId", authMiddleware, characterController.getCharacterDetail);

// GỌI N8N BIẾN ĐỔI NHÂN VẬT
router.post("/:characterId/transform", authMiddleware, characterController.triggerTransformation);

// Lấy danh sách nhân vật theo storyId
router.get("/:storyId/list", authMiddleware, characterController.getCharactersByStory);

// Cập nhật thông tin nhân vật theo characterId
router.put("/:characterId", authMiddleware, characterController.updateCharacter);

// Xóa mềm nhân vật theo characterId
router.delete("/:characterId", authMiddleware, characterController.deleteCharacter);
module.exports = router;
