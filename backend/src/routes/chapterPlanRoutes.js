const express = require("express");
const router = express.Router();
const chapterPlanController = require("../controllers/chapterPlanController");
const authMiddleware = require("../middleware/authMiddleware"); // Middleware xác thực token

router.post("/suggest-current", authMiddleware, chapterPlanController.suggestCurrentChapterPlan);
// Route gọi n8n để lấy gợi ý kế hoạch chương
router.post("/suggest", authMiddleware, chapterPlanController.suggestChapterPlan);
// 2. Lấy danh sách toàn bộ kế hoạch chương theo storyId (URL chuẩn: /api/chapterPlan/stories/:storyId)
router.get("/stories/:storyId", authMiddleware, chapterPlanController.getChapterPlansByStory);

// 3. Lấy chi tiết một kế hoạch chương theo planId (URL chuẩn: /api/chapterPlan/:planId)
router.get("/:planId", authMiddleware, chapterPlanController.getChapterPlanDetail);

// Cập nhật kế hoạch chương theo ID (Đặc tả 029_F1)
router.put("/:chapterId", authMiddleware, chapterPlanController.updateChapterPlan);

// Xóa kế hoạch chương theo planId (Đặc tả 031_F1)
router.delete("/:planId", authMiddleware, chapterPlanController.deleteChapterPlan);
module.exports = router;
