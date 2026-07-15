const express = require("express");
const router = express.Router();
const storyController = require("../controllers/storyController");
const chapterController = require("../controllers/chapterController");
const storyOutlineController = require("../controllers/storyOutlineController");
const authMiddleware = require("../middleware/authMiddleware");

// PHÂN HỆ: QUẢN LÝ TRUYỆN
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
// QUẢN LÝ CHƯƠNG

// Lấy mục lục danh sách các chương của 1 bộ truyện (MongoDB)
// GET /api/stories/:storyId/chapters
router.get("/:storyId/chapters", storyController.getChaptersByStory);

// Tạo chương mới cho một bộ truyện cụ thể
// POST /api/stories/:storyId/chapters
router.post("/:storyId/chapters", authMiddleware, chapterController.createChapter);

// Tuyến đường xóa chương truyện và tự sắp xếp lại danh mục
// DELETE /api/stories/:storyId/chapters/:chapterNumber
router.delete("/:storyId/chapters/:chapterNumber", authMiddleware, chapterController.deleteChapterSoft);

// Tuyến đường xử lý cốt truyện (Đính kèm authMiddleware để xác thực token)
router.get("/:storyId/outline", authMiddleware, storyOutlineController.getStoryOutline);
router.put("/:storyId/outline", authMiddleware, storyOutlineController.updateStoryOutline);
module.exports = router;
