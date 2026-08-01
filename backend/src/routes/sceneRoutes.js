const express = require("express");
const router = express.Router();
const sceneController = require("../controllers/sceneController");
const authMiddleware = require("../middleware/authMiddleware"); // Middleware xác thực token
// Tạo phân cảnh mới thuộc về một chương (Đặc tả 033_F1)
router.post("/:chapterId", authMiddleware, sceneController.createScene);

// Lấy danh sách phân cảnh theo chapterId (Đặc tả 034_F1)
router.get("/:chapterId", authMiddleware, sceneController.getScenesByChapter);

// Cập nhật thông tin phân cảnh theo sceneId (Đặc tả 035_F1)
router.put("/:sceneId", authMiddleware, sceneController.updateScene);

// Lấy chi tiết phân cảnh theo sceneId (Đặc tả 036_F1)
router.get("/:sceneId", authMiddleware, sceneController.getSceneDetail);

// Xóa phân cảnh theo sceneId (Đặc tả 037_F1)
router.delete("/:sceneId", authMiddleware, sceneController.deleteScene);
module.exports = router;
