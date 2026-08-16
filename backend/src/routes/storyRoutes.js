const express = require("express");
const router = express.Router();
const storyController = require("../controllers/storyController");
const authMiddleware = require("../middleware/authMiddleware");

// Khởi tạo tác phẩm mới
router.post("/create", authMiddleware, storyController.createStory);

// Lấy danh sách truyện của riêng tác giả đang đăng nhập
router.get("/list", authMiddleware, storyController.getStories);

// AI ĐẢO NGƯỢC Ý TƯỞNG TỪ MÔ TẢ TRUYỆN
router.post("/:storyId/reverse-description", authMiddleware, storyController.reverseDescription);

// Lấy thông tin chi tiết của 1 bộ truyện
router.get("/:storyId", authMiddleware, storyController.getStoryDetails);

// Cập nhật thông tin chi tiết tác phẩm
router.put("/:storyId", authMiddleware, storyController.updateStory);

//Xóa truyện
router.delete("/:storyId", authMiddleware, storyController.deleteStory);

// Tìm kiếm và lọc truyện theo từ khóa + danh mục thể loại
router.get("/search", authMiddleware, storyController.searchStories);

module.exports = router;
