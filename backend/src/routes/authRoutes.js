const express = require("express");
const router = express.Router();

const { getMe, googleLogin } = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

router.get("/me", authMiddleware, getMe);
router.post("/google", googleLogin);
module.exports = router;
