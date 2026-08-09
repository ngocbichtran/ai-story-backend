const db = require("../config/db"); // File kết nối MySQL của bạn
const { getMongoDb } = require("../config/mongo"); // File kết nối MongoDB của bạn

// 2. Hàm hỗ trợ: Lưu mảng kế hoạch chương phái sinh vào MongoDB
const saveDerivativeChapterPlans = async (storyId, chapterPlans) => {
  if (!chapterPlans || !Array.isArray(chapterPlans) || chapterPlans.length === 0) {
    return true;
  }

  const mongoDb = getMongoDb();
  if (!mongoDb) throw new Error("Chưa kết nối đến MongoDB Atlas!");

  const collection = mongoDb.collection("chapter_plans");

  const flatPlans = Array.isArray(chapterPlans[0]) ? chapterPlans.flat(Infinity) : chapterPlans;

  const plansToInsert = flatPlans.map((plan, index) => ({
    storyId: Number(storyId),
    chapterNumber: plan.chapterNumber || index + 1,
    title: plan.title || `Chương ${index + 1}`,
    summary: plan.summary || plan.background || "",
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  if (plansToInsert.length > 0) {
    await collection.insertMany(plansToInsert);
  }

  return true;
};

// =========================================================================
// HÀM HỖ TRỢ: LƯU MẢNG NHÂN VẬT PHÁI SINH VÀO MONGODB
// =========================================================================
const saveDerivativeCharacters = async (storyId, characters, userId) => {
  if (!characters || !Array.isArray(characters) || characters.length === 0) {
    return true;
  }

  const mongoDb = getMongoDb();
  if (!mongoDb) throw new Error("Chưa kết nối đến MongoDB Atlas!");

  const collection = mongoDb.collection("characters");

  const charactersToInsert = characters.map((char) => ({
    storyId: Number(storyId),
    // 🌟 Lưu lại ID của nhân vật gốc để truy xuất ngược khi cần
    originalCharacterId: char.originalCharacterId || char.id || char._id || null,
    name: char.name || "Nhân vật mới",
    role: char.role || "Nhân vật phụ",
    appearance: char.appearance || "",
    personality: char.personality || "",
    background: char.background || "",
    goal: char.goal || "",
    ability: char.ability || "",
    development: char.development || "",
    currentLocation: char.currentLocation || "",
    relationship: char.relationship || [],
    avatar: char.avatar || "",
    tags: char.tags || [],
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  if (charactersToInsert.length > 0) {
    await collection.insertMany(charactersToInsert);
  }

  return true;
};

// =========================================================================
// TẠO TRUYỆN PHÁI SINH TRỌN GÓI (LẤY DỮ LIỆU TỪ TRUYỆN GỐC & BẢNG TRUNG GIAN)
// =========================================================================
exports.createDerivativeStory = async (req, res) => {
  try {
    const { title, originalStoryId, characters, chapterPlans, coverImage } = req.body;
    const userId = req.user?.id; // Lấy ID tác giả từ token

    if (!userId) {
      return res.status(401).json({ success: false, message: "Bạn cần đăng nhập để thực hiện chức năng này." });
    }

    if (!title || title.trim() === "") {
      return res.status(400).json({ success: false, message: "Tên truyện phái sinh không được để trống." });
    }

    if (!originalStoryId) {
      return res.status(400).json({ success: false, message: "Thiếu thông tin tác phẩm gốc (originalStoryId)." });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({ success: false, message: "Mất kết nối MongoDB." });
    }

    // 1. Lấy mô tả (description) từ truyện gốc
    const [originalStories] = await db.query(`SELECT description FROM stories WHERE id = ? LIMIT 1`, [originalStoryId]);

    let originalDescription = null;
    if (originalStories && originalStories.length > 0) {
      originalDescription = originalStories[0].description || null;
    }

    // Bước 1: Lưu thông tin truyện mới vào bảng stories (MySQL)
    const [result] = await db.query(`INSERT INTO stories (user_id, title, description, cover_image, original_story_id, status) VALUES (?, ?, ?, ?, ?, 'DRAFT')`, [userId, title.trim(), originalDescription, coverImage || null, originalStoryId]);
    const newStoryId = result.insertId;

    // 1.1: Sao chép các thể loại (genres) từ truyện gốc sang truyện phái sinh
    const [originalGenres] = await db.query(`SELECT genre_id FROM story_genres WHERE story_id = ?`, [originalStoryId]);
    if (originalGenres && originalGenres.length > 0) {
      const genreInserts = originalGenres.map((g) => [newStoryId, g.genre_id]);
      await db.query(`INSERT INTO story_genres (story_id, genre_id) VALUES ?`, [genreInserts]);
    }

    // Bước 2: Khởi tạo Outline (Khung cốt truyện) trên MongoDB từ truyện gốc
    const outlineCollection = mongoDb.collection("story_outlines");
    const originalOutline = await outlineCollection.findOne({ storyId: Number(originalStoryId) });

    await outlineCollection.insertOne({
      storyId: Number(newStoryId),
      fiveSentences: originalOutline?.fiveSentences || "",
      onePage: originalOutline?.onePage || "",
      fourPages: originalOutline?.fourPages || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 🌟 Bước 2.1: SAO CHÉP THẾ GIỚI (WORLDS) TỪ TRUYỆN GỐC SANG TRUYỆN PHÁI SINH
    const worldsCollection = mongoDb.collection("worlds");
    const originalWorld = await worldsCollection.findOne({ storyId: Number(originalStoryId) });

    if (originalWorld) {
      await worldsCollection.insertOne({
        storyId: Number(newStoryId),
        title: originalWorld.title ? `${originalWorld.title} (Phái sinh)` : title.trim(),
        description: originalWorld.description || "",
        geography: originalWorld.geography || { continents: [], regions: [] },
        history: originalWorld.history || "",
        culture: originalWorld.culture || "",
        powerSystem: originalWorld.powerSystem || { name: "", description: "" },
        rules: originalWorld.rules || [],
        createdBy: Number(userId),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Nếu truyện gốc chưa có world, khởi tạo một bản ghi thế giới rỗng mặc định
      await worldsCollection.insertOne({
        storyId: Number(newStoryId),
        title: title.trim(),
        description: "",
        geography: { continents: [], regions: [] },
        history: "",
        culture: "",
        powerSystem: { name: "", description: "" },
        rules: [],
        createdBy: Number(userId),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Bước 3: Lưu mảng Kế hoạch chương (Chapter Plans) vào MongoDB
    if (chapterPlans && Array.isArray(chapterPlans)) {
      await saveDerivativeChapterPlans(newStoryId, chapterPlans);
    }

    // Bước 4: Lưu danh sách nhiều nhân vật phái sinh vào MongoDB
    if (characters && Array.isArray(characters)) {
      await saveDerivativeCharacters(newStoryId, characters, userId);
    }

    return res.status(201).json({
      success: true,
      message: "Tạo truyện phái sinh, sao chép thông tin, thể loại, thế giới, nhân vật và kế hoạch chương thành công!",
      storyId: newStoryId,
    });
  } catch (error) {
    console.error("Lỗi tại API createDerivativeStory:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo truyện phái sinh.",
    });
  }
};
