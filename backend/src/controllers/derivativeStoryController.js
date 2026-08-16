const db = require("../config/db"); // File kết nối MySQL của bạn
const { getMongoDb } = require("../config/mongo"); // File kết nối MongoDB của bạn

// =========================================================================
// HÀM HỖ TRỢ: LƯU KẾ HOẠCH CHƯƠNG VÀ TỰ ĐỘNG TẠO CHƯƠNG RỖNG TƯƠNG ỨNG
// =========================================================================
const saveDerivativeChapterPlans = async (storyId, chapterPlans) => {
  if (!chapterPlans || !Array.isArray(chapterPlans) || chapterPlans.length === 0) {
    return true;
  }

  const mongoDb = getMongoDb();
  if (!mongoDb) throw new Error("Chưa kết nối đến MongoDB Atlas!");

  const planCollection = mongoDb.collection("chapter_plans");
  const contentCollection = mongoDb.collection("chapters_content");

  const flatPlans = Array.isArray(chapterPlans[0]) ? chapterPlans.flat(Infinity) : chapterPlans;

  for (let index = 0; index < flatPlans.length; index++) {
    const plan = flatPlans[index];
    const chapterNumber = Number(plan.chapterNumber || index + 1);
    const title = plan.title || `Chương ${chapterNumber}`;
    const summary = plan.summary || plan.background || "";

    await planCollection.findOneAndUpdate(
      {
        storyId: Number(storyId),
        chapterNumber: chapterNumber,
      },
      {
        $setOnInsert: {
          storyId: Number(storyId),
          chapterNumber: chapterNumber,
          createdAt: new Date(),
        },
        $set: {
          title,
          summary,
          purpose: plan.purpose || "",
          conflict: plan.conflict || "",
          endingHook: plan.endingHook || "",
          updatedAt: new Date(),
        },
      },
      {
        upsert: true,
      },
    );

    const existingChapter = await contentCollection.findOne({
      storyId: Number(storyId),
      chapterNumber: chapterNumber,
    });

    if (!existingChapter) {
      await contentCollection.insertOne({
        storyId: Number(storyId),
        chapterNumber: chapterNumber,
        title: title,
        content: "",
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
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
    isDeleted: false,
    deletedAt: null,
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
// TẠO TRUYỆN PHÁI SINH
// =========================================================================
exports.createDerivativeStory = async (req, res) => {
  try {
    // 1. Nhận thêm sourceChapterNumbers từ req.body do frontend gửi lên
    const { title, originalStoryId, characters, chapterPlans, coverImage, sourceChapterNumbers } = req.body;
    const userId = req.user?.id;
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

    const [originalStories] = await db.query(`SELECT description FROM stories WHERE id = ? LIMIT 1`, [originalStoryId]);

    let originalDescription = null;
    if (originalStories && originalStories.length > 0) {
      originalDescription = originalStories[0].description || null;
    }

    // 2. Chuyển mảng sourceChapterNumbers thành chuỗi JSON để lưu vào MySQL
    const sourceChaptersJson = sourceChapterNumbers && Array.isArray(sourceChapterNumbers) ? JSON.stringify(sourceChapterNumbers) : null;

    // 3. Thực hiện INSERT vào MySQL bao gồm cả cột source_chapter_numbers
    const [result] = await db.query(`INSERT INTO stories (user_id, title, description, cover_image, original_story_id, source_chapter_numbers, status) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT')`, [userId, title.trim(), originalDescription, coverImage || null, originalStoryId, sourceChaptersJson]);
    const newStoryId = result.insertId;

    const [originalGenres] = await db.query(`SELECT genre_id FROM story_genres WHERE story_id = ?`, [originalStoryId]);
    if (originalGenres && originalGenres.length > 0) {
      const genreInserts = originalGenres.map((g) => [newStoryId, g.genre_id]);
      await db.query(`INSERT INTO story_genres (story_id, genre_id) VALUES ?`, [genreInserts]);
    }

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

    if (chapterPlans && Array.isArray(chapterPlans)) {
      await saveDerivativeChapterPlans(newStoryId, chapterPlans);
    }

    if (characters && Array.isArray(characters)) {
      await saveDerivativeCharacters(newStoryId, characters, userId);
    }

    return res.status(201).json({
      success: true,
      message: "Tạo truyện phái sinh, lưu chương nguồn, sao chép thông tin, thể loại, thế giới, nhân vật và kế hoạch chương thành công!",
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
