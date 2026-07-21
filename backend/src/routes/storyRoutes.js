const express = require("express");
const router = express.Router();
const storyController = require("../controllers/storyController");
const authMiddleware = require("../middleware/authMiddleware");

// Khởi tạo tác phẩm mới
// POST /api/stories/create
router.post("/create", authMiddleware, storyController.createStory);

// Lấy danh sách truyện của riêng tác giả đang đăng nhập
// GET /api/stories/list (Phải đặt TRƯỚC các route chứa tham số động :id)
router.get("/list", authMiddleware, storyController.getStories);

// Lấy thông tin chi tiết của 1 bộ truyện (MySQL + Mongo)
// GET /api/stories/:storyId
router.get("/:storyId", authMiddleware, storyController.getStoryDetails);

// Cập nhật thông tin chi tiết tác phẩm
// PUT /api/stories/:storyId
router.put("/:storyId", authMiddleware, storyController.updateStory);

//Xóa truyện
router.delete("/:storyId", authMiddleware, storyController.deleteStory);

// Tìm kiếm và lọc truyện theo từ khóa + danh mục thể loại
// GET /api/stories/search?keyword=...&genreId=...
router.get("/search", authMiddleware, storyController.searchStories);

module.exports = router;
