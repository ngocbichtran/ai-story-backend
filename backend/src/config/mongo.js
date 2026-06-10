const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
let client;
let db;

async function connectMongoDB() {
  if (db) return db; // Nếu đã kết nối rồi thì không kết nối lại
  try {
    client = new MongoClient(uri);
    await client.connect();
    console.log("MongoDB Atlas Connected (Native Client)");
    db = client.db("ai_story_platform"); // Tự động lấy database mặc định trong chuỗi URI
    return db;
  } catch (error) {
    console.error("Lỗi kết nối MongoDB Atlas:", error);
    process.exit(1);
  }
}

// Hàm helper để lấy nhanh instance của db ở các file khác
function getMongoDb() {
  return db;
}

module.exports = { connectMongoDB, getMongoDb };
