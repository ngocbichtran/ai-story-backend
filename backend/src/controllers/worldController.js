const db = require("../config/db");
const { getMongoDb } = require("../config/mongo");
const { ObjectId } = require("mongodb");
// =========================================================================
// 1. KHỞI TẠO THẾ GIỚI / BỐI CẢNH MỚI (Tương thích WorldForm)
// =========================================================================
exports.createWorld = async (req, res) => {
  try {
    const { storyId, title, description, history, culture, geography, powerSystems, rules } = req.body;

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    if (!storyId || !title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập tên thế giới và mã truyện hợp lệ.",
      });
    }

    const cleanStoryId = Number(storyId);
    const [storyCheck] = await db.query("SELECT COUNT(*) as count FROM stories WHERE id = ? AND deleted_at IS NULL", [cleanStoryId]);

    if (storyCheck[0].count === 0) {
      return res.status(404).json({
        success: false,
        message: "Bộ truyện không tồn tại trên hệ thống.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("worlds");
    const newWorldDoc = {
      storyId: cleanStoryId,
      title: title.trim(),
      description: description || "",
      history: history || "",
      culture: culture || "",
      geography: Array.isArray(geography) ? geography : [],
      powerSystems: Array.isArray(powerSystems) ? powerSystems : [],
      rules: Array.isArray(rules) ? rules : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(newWorldDoc);

    return res.status(201).json({
      success: true,
      message: "Khởi tạo thế giới mới thành công",
      data: {
        id: result.insertedId.toString(),
        storyId: cleanStoryId,
        title: title.trim(),
      },
    });
  } catch (error) {
    console.error("Lỗi tại hàm createWorld:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi khởi tạo bối cảnh thế giới.",
    });
  }
};

// =========================================================================
// 2. LẤY DANH SÁCH THẾ GIỚI THEO STORY ID
// =========================================================================
exports.getWorldsByStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    if (!storyId || storyId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh tác phẩm (storyId) trên URL.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu MongoDB Atlas.",
      });
    }

    const collection = mongoDb.collection("worlds");
    const numStoryId = Number(storyId);

    const worlds = await collection
      .find({
        $or: [{ storyId: numStoryId }, { storyId: String(storyId) }],
      })
      .sort({ createdAt: -1 })
      .toArray();

    const responseData = worlds.map((w) => ({
      id: w._id.toString(),
      storyId: w.storyId,
      title: w.title || "",
      description: w.description || "",
      history: w.history || "",
      culture: w.culture || "",
      geography: w.geography || [],
      powerSystems: w.powerSystems || [],
      rules: w.rules || [],
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      count: responseData.length,
      data: responseData,
    });
  } catch (error) {
    console.error("Lỗi tại getWorldsByStory:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách thế giới.",
    });
  }
};

// =========================================================================
// 3. CẬP NHẬT THẾ GIỚI / BỐI CẢNH (Đặc tả 011_F2 & 011_F3)
// =========================================================================
exports.updateWorld = async (req, res) => {
  try {
    const { worldId } = req.params;
    const { title, description, history, culture, geography, powerSystems, rules } = req.body;

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tên thế giới không được bỏ trống.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("worlds");
    let queryId;
    try {
      queryId = new ObjectId(worldId);
    } catch (e) {
      return res.status(400).json({ success: false, message: "Mã định danh worldId không hợp lệ." });
    }

    const existingWorld = await collection.findOne({ _id: queryId });

    if (!existingWorld) {
      return res.status(404).json({
        success: false,
        message: "Bối cảnh thế giới không tồn tại",
      });
    }

    const updateFields = {
      title: title.trim(),
      description: description || "",
      history: history || "",
      culture: culture || "",
      geography: Array.isArray(geography) ? geography : [],
      powerSystems: Array.isArray(powerSystems) ? powerSystems : [],
      rules: Array.isArray(rules) ? rules : [],
      updatedAt: new Date(),
    };

    const updateResult = await collection.updateOne({ _id: queryId }, { $set: updateFields });

    return res.status(200).json({
      success: true,
      message: "Cập nhật thế giới thành công",
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error("Lỗi tại hàm updateWorld:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật bối cảnh thế giới.",
    });
  }
};

// =========================================================================
// 4. LẤY CHI TIẾT MỘT THẾ GIỚI THEO WORLD ID (Đã tối ưu an toàn)
// =========================================================================
exports.getWorldDetail = async (req, res) => {
  try {
    const { worldId } = req.params;

    if (!worldId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh worldId trên URL.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("worlds");
    let queryConditions = [{ id: worldId }];

    if (!isNaN(Number(worldId))) {
      queryConditions.push({ id: Number(worldId) });
    }

    if (ObjectId.isValid(worldId) && String(new ObjectId(worldId)) === worldId) {
      queryConditions.push({ _id: new ObjectId(worldId) });
    }

    const world = await collection.findOne({ $or: queryConditions });

    if (!world) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bối cảnh thế giới này.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: world._id.toString(),
        storyId: world.storyId,
        title: world.title || "",
        description: world.description || "",
        history: world.history || "",
        culture: world.culture || "",
        geography: world.geography || [],
        powerSystems: world.powerSystems || [],
        rules: world.rules || [],
        createdAt: world.createdAt,
        updatedAt: world.updatedAt,
      },
    });
  } catch (error) {
    console.error("Lỗi chi tiết tại hàm getWorldDetail:", error);
    return res.status(400).json({
      success: false,
      message: "Yêu cầu không hợp lệ (Bad Request).",
    });
  }
};
// =========================================================================
// 5. XÓA BỐI CẢNH THẾ GIỚI (Đặc tả 015_F1 & 015_F2)
// =========================================================================
exports.deleteWorld = async (req, res) => {
  try {
    const { worldId } = req.params;

    if (!worldId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh worldId trên URL.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("worlds");
    let queryId;
    try {
      queryId = ObjectId.isValid(worldId) ? new ObjectId(worldId) : worldId;
    } catch (e) {
      queryId = worldId;
    }

    const existingWorld = await collection.findOne({
      $or: [{ _id: queryId }, { id: worldId }, { id: Number(worldId) }],
    });

    if (!existingWorld) {
      return res.status(404).json({
        success: false,
        message: "Bối cảnh thế giới không tồn tại",
      });
    }

    const deleteResult = await collection.deleteOne({ _id: existingWorld._id });

    return res.status(200).json({
      success: true,
      message: "Xóa bối cảnh thế giới thành công",
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error("Lỗi tại hàm deleteWorld:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xóa bối cảnh thế giới.",
    });
  }
};
