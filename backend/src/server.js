require("dotenv").config();

const express = require("express");
const cors = require("cors");

// 1. IMPORT TOÀN BỘ ROUTES HỆ THỐNG
const authRoutes = require("./routes/authRoutes");
const storyRoutes = require("./routes/storyRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const genreRoutes = require("./routes/genreRoutes");
const storyOutlineRoutes = require("./routes/storyOutlineRoutes");
const worldRoutes = require("./routes/worldRoutes");
// CHUẨN: Import hàm kết nối MongoDB Atlas lên đầu file
const { connectMongoDB } = require("./config/mongo");

const app = express();

// 2. KẾT NỐI DATABASE (MySQL)
require("./config/db");

// 3. CẤU HÌNH MIDDLEWARES (CORS & JSON PARSER)
app.use(
  cors({
    origin: ["http://localhost:5173", "https://baostory.fun", "https://www.baostory.fun", "https://app.baostory.fun", "https://n8n.baostory.fun"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json());

// 4. ĐỊNH TUYẾN API HỆ THỐNG
app.get("/", (req, res) => {
  res.send("BaoStory Backend Running");
});

app.use("/api/auth", authRoutes); // Xác thực, đăng nhập tài khoản
app.use("/api/stories", storyRoutes); // Quản lý truyện
app.use("/api/chapters", chapterRoutes); // Quản lý chương
app.use("/api/genres", genreRoutes); // Thể loại
app.use("/api/storyOutline", storyOutlineRoutes); // Cốt truyện
app.use("/api/world", worldRoutes); // Thế giới
// 5. KHỞI CHẠY SERVER CHUẨN (Gộp duy nhất một luồng lắng nghe)
const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    // KÍCH HOẠT: Gọi kết nối MongoDB Atlas song song cùng MySQL
    await connectMongoDB();
  } catch (error) {
    console.error("Không thể khởi động kết nối MongoDB Atlas:", error.message);
  }
});
