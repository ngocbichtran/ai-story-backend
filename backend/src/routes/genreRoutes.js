const express = require("express");
const router = express.Router();
const genreController = require("../controllers/genreController");
const authMiddleware = require("../middleware/authMiddleware");

// 1. Tạo thể loại mới (Cần đăng nhập)
router.post("/", authMiddleware, genreController.createGenre);

// 2. Lấy danh sách thể loại (Không cần đăng nhập)
router.get("/", genreController.getGenres);

// 3. Xóa mềm thể loại (Cần đăng nhập)
router.delete("/:genreId", authMiddleware, genreController.softDeleteStory);

module.exports = router;
