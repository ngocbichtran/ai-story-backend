const db = require("../config/db"); // Kết nối MySQL để kiểm tra story
const { getMongoDb } = require("../config/mongo"); // Kết nối MongoDB Atlas
const { ObjectId } = require("mongodb");

// HÀM REPOSITORY Cho chức năng chỉnh sửa: saveUpdatedCharacter() (Đặc tả 019_F2)
const saveUpdatedCharacter = async (characterId, updateData) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  const collection = mongoDb.collection("characters");

  let queryConditions = [{ id: characterId }];
  if (!isNaN(Number(characterId))) {
    queryConditions.push({ id: Number(characterId) });
  }
  if (ObjectId.isValid(characterId)) {
    try {
      queryConditions.push({ _id: new ObjectId(characterId) });
    } catch (e) {}
  }

  // Chuẩn bị payload cập nhật động toàn bộ các trường thuộc tính
  const updatePayload = {
    updatedAt: new Date(),
  };

  if (updateData.name !== undefined) updatePayload.name = updateData.name.trim();
  if (updateData.role !== undefined) updatePayload.role = updateData.role.trim();
  if (updateData.gender !== undefined) updatePayload.gender = updateData.gender;
  if (updateData.age !== undefined) updatePayload.age = updateData.age;
  if (updateData.occupation !== undefined) updatePayload.occupation = updateData.occupation;
  if (updateData.appearance !== undefined) updatePayload.appearance = updateData.appearance;
  if (updateData.personality !== undefined) updatePayload.personality = updateData.personality;
  if (updateData.background !== undefined) updatePayload.background = updateData.background;
  if (updateData.goal !== undefined) updatePayload.goal = updateData.goal;
  if (updateData.powerLevel !== undefined) updatePayload.powerLevel = updateData.powerLevel;
  if (updateData.status !== undefined) updatePayload.status = updateData.status;
  if (updateData.relationship !== undefined) updatePayload.relationship = updateData.relationship;

  // Thực thi câu lệnh cập nhật động trong MongoDB sử dụng toán tử $set
  const result = await collection.updateOne({ $or: queryConditions }, { $set: updatePayload });

  return result.modifiedCount;
};

// =========================================================================
// HÀM REPOSITORY NỘI BỘ: removeCharacterMongo() (Đặc tả 020_F2)
// =========================================================================
const removeCharacterMongo = async (characterId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  const collection = mongoDb.collection("characters");

  let queryConditions = [{ id: characterId }];
  if (!isNaN(Number(characterId))) {
    queryConditions.push({ id: Number(characterId) });
  }
  if (ObjectId.isValid(characterId)) {
    try {
      queryConditions.push({ _id: new ObjectId(characterId) });
    } catch (e) {}
  }

  // Thực thi cập nhật xóa mềm (Soft Delete)
  const result = await collection.updateOne(
    { $or: queryConditions },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );

  return result.modifiedCount;
};

// =========================================================================
// KHỞI TẠO NHÂN VẬT MỚI (Đặc tả 016_F1 & 016_F2)
// =========================================================================
exports.createCharacter = async (req, res) => {
  try {
    // Bước 1: Tiếp nhận storyId và thông tin nhân vật từ req.body
    const { storyId, ...characterData } = req.body;

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    // Bước 2: Kiểm tra tính hợp lệ của các trường bắt buộc (Tên nhân vật, Vai trò...)
    const { name, role } = characterData;
    if (!storyId || !name || !name.trim() || !role || !role.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng điền đầy đủ tên nhân vật, vai trò và mã truyện hợp lệ.",
      });
    }

    const cleanStoryId = Number(storyId);

    // Bước 3: Truy vấn kiểm tra bộ truyện gốc trong MySQL
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

    const collection = mongoDb.collection("characters");

    // Bước 4: Gọi tầng Repository (Lưu vào Collection characters của MongoDB - 016_F2)
    const newCharacterDoc = {
      storyId: cleanStoryId,
      name: name.trim(),
      role: role.trim(),
      gender: characterData.gender || "",
      age: characterData.age || "",
      occupation: characterData.occupation || "",
      personality: characterData.personality || "",
      appearance: characterData.appearance || "",
      background: characterData.background || "",
      goal: characterData.goal || "",
      powerLevel: characterData.powerLevel || "",
      status: characterData.status || "alive",
      relationship: characterData.relationship || [],
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await collection.insertOne(newCharacterDoc);

    // Bước 5: Trả về phản hồi JSON thông báo thành công kèm mã định danh mới
    return res.status(201).json({
      success: true, // Output của 016_F1
      message: "Khởi tạo nhân vật mới thành công",
      data: {
        id: insertResult.insertedId.toString(), // Output insertedId của 016_F2
        storyId: cleanStoryId,
        name: name.trim(),
      },
    });
  } catch (error) {
    console.error("Lỗi tại hàm createCharacter:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi khởi tạo nhân vật.",
    });
  }
};

// =========================================================================
// LẤY CHI TIẾT MỘT NHÂN VẬT THEO ID (Đặc tả 017_F1 & 017_F2)
// =========================================================================
exports.getCharacterDetail = async (req, res) => {
  try {
    const { characterId } = req.params;

    if (!characterId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh nhân vật (characterId) trên URL.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("characters");

    let queryConditions = [{ id: characterId }];

    if (!isNaN(Number(characterId))) {
      queryConditions.push({ id: Number(characterId) });
    }

    if (ObjectId.isValid(characterId)) {
      try {
        queryConditions.push({ _id: new ObjectId(characterId) });
      } catch (err) {}
    }

    const character = await collection.findOne({ $or: queryConditions });

    if (!character) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin chi tiết nhân vật.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: character._id.toString(),
        storyId: character.storyId,
        name: character.name || "",
        role: character.role || "",
        gender: character.gender || "",
        age: character.age || "",
        occupation: character.occupation || "",
        appearance: character.appearance || "",
        personality: character.personality || "",
        background: character.background || "",
        goal: character.goal || "",
        powerLevel: character.powerLevel || "",
        status: character.status || "alive",
        relationship: character.relationship || [],
        createdAt: character.createdAt,
        updatedAt: character.updatedAt,
      },
    });
  } catch (error) {
    console.error("Lỗi chi tiết tại hàm getCharacterDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy chi tiết nhân vật.",
    });
  }
};

// =========================================================================
// LẤY DANH SÁCH NHÂN VẬT THEO STORY ID VÀ ROLE (Đặc tả 018_F1 & 018_F2)
// =========================================================================
exports.getCharactersByStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { role } = req.query;

    if (!storyId || storyId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh tác phẩm (storyId) trên URL.",
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
        message: "Mất kết nối cơ sở dữ liệu MongoDB Atlas.",
      });
    }

    const collection = mongoDb.collection("characters");

    let query = { storyId: cleanStoryId, isDeleted: { $ne: true } };

    if (role && role !== "ALL" && role !== "Tất cả" && role.trim() !== "") {
      query.role = { $regex: new RegExp(`^${role.trim()}$`, "i") };
    }

    const charactersListRaw = await collection.find(query).sort({ createdAt: -1 }).toArray();

    const charactersList = charactersListRaw.map((char) => ({
      id: char._id.toString(),
      storyId: char.storyId,
      name: char.name || "",
      role: char.role || "",
      gender: char.gender || "",
      age: char.age || "",
      occupation: char.occupation || "",
      personality: char.personality || "",
      appearance: char.appearance || "",
      background: char.background || "",
      goal: char.goal || "",
      powerLevel: char.powerLevel || "",
      status: char.status || "alive",
      relationship: char.relationship || [],
      createdAt: char.createdAt,
      updatedAt: char.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      count: charactersList.length,
      data: charactersList,
    });
  } catch (error) {
    console.error("Lỗi tại hàm getCharactersByStory:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách nhân vật.",
    });
  }
};

// =========================================================================
// CẬP NHẬT THÔNG TIN NHÂN VẬT (Đặc tả 019_F1)
// =========================================================================
exports.updateCharacter = async (req, res) => {
  try {
    // Bước 1: Tiếp nhận characterId từ req.params và updateData từ req.body
    const { characterId } = req.params;
    const updateData = req.body;

    if (!characterId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh nhân vật (characterId) trên URL.",
      });
    }

    // Bước 2: Kiểm tra và xác thực tính hợp lệ cơ bản của dữ liệu chỉnh sửa
    if (updateData.name !== undefined && !updateData.name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tên nhân vật không được để trống.",
      });
    }

    if (updateData.role !== undefined && !updateData.role.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vai trò nhân vật không được để trống.",
      });
    }

    // Bước 3: Gọi hàm xử lý tương tác cập nhật dữ liệu (019_F2 nội bộ)
    const modifiedCount = await saveUpdatedCharacter(characterId, updateData);

    // Bước 4: Kiểm tra kết quả và trả về phản hồi JSON cho Client
    if (modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhân vật cần cập nhật hoặc dữ liệu không có sự thay đổi.",
      });
    }

    return res.status(200).json({
      success: true, // Output của 019_F1
      message: "Cập nhật thông tin nhân vật thành công!",
      modifiedCount: modifiedCount,
    });
  } catch (error) {
    console.error("Lỗi tại hàm updateCharacter:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật thông tin nhân vật.",
    });
  }
};

// =========================================================================
// HÀM CONTROLLER CHÍNH: deleteCharacter() (Đặc tả 020_F1)
// =========================================================================
exports.deleteCharacter = async (req, res) => {
  try {
    const { characterId } = req.params;

    if (!characterId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh nhân vật (characterId) trên URL.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("characters");

    let queryConditions = [{ id: characterId }];
    if (!isNaN(Number(characterId))) {
      queryConditions.push({ id: Number(characterId) });
    }
    if (ObjectId.isValid(characterId)) {
      try {
        queryConditions.push({ _id: new ObjectId(characterId) });
      } catch (e) {}
    }

    // Cú pháp query tìm kiếm (loại trừ các bản ghi đã bị xóa mềm)
    const existingCharacter = await collection.findOne({
      $or: queryConditions,
      isDeleted: { $ne: true },
    });

    if (!existingCharacter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhân vật cần xóa.",
      });
    }

    const modifiedCount = await removeCharacterMongo(characterId);

    if (modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Không thể thực hiện xóa mềm nhân vật.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Xóa nhân vật thành công!",
      modifiedCount: modifiedCount,
    });
  } catch (error) {
    console.error("Lỗi tại hàm deleteCharacter:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xóa nhân vật.",
    });
  }
};
