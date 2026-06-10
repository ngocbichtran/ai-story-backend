// src/config/db.js
const mysql = require("mysql2/promise"); // Chuyển sang dùng /promise để xài async/await

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 24803,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
  waitForConnections: true,
  connectionLimit: 10, // Giới hạn kết nối tối đa lên Cloud Aiven
  queueLimit: 0,
});

// Hàm kiểm tra kết nối ngay khi khởi động ứng dụng
(async () => {
  try {
    // Thử lấy 1 kết nối từ pool để test
    const connection = await pool.getConnection();
    console.log("🚀 [Database]: Kết nối đến Cloud Aiven MySQL thành công!");

    // Giải phóng kết nối trả lại cho pool sau khi test xong
    connection.release();
  } catch (error) {
    console.error("❌ [Database]: Kết nối đến Cloud Aiven MySQL thất bại!");
    console.error(`Lỗi chi tiết: ${error.message}`);
  }
})();

// Xuất pool ra để các file khác sử dụng (ví dụ: await pool.query(...))
module.exports = pool;
