const db = require("../config/db");
const { getMongoDb } = require("../config/mongo");
const axios = require("axios");
const saveStory = async (userId, title, description, coverImage, originalStoryId) => {
  const [result] = await db.query(
    `
        INSERT INTO stories (
            user_id,
            title,
            description,
            cover_image,
            original_story_id,
            status
        )
        VALUES (?, ?, ?, ?, ?, 'DRAFT')
        `,
    [userId, title, description || null, coverImage || null, originalStoryId || null],
  );

  return result.insertId;
};

const saveStoryGenres = async (storyId, genreIds) => {
  if (!genreIds || genreIds.length === 0) return true;
  const values = genreIds.map((genreId) => [storyId, genreId]);
  await db.query(`INSERT INTO story_genres (story_id, genre_id) VALUES ?`, [values]);
  return true;
};

const initStoryOutline = async (storyId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Chưa kết nối đến MongoDB Atlas!");
  }

  const collection = mongoDb.collection("story_outlines");

  await collection.insertOne({
    storyId: Number(storyId),
    fiveSentences: "",
    onePage: "",
    fourPages: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return true;
};

// =========================================================================
// HÀM TẠO TRUYỆN MỚI
// =========================================================================
exports.createStory = async (req, res) => {
  try {
    const { title, description, genreIds, coverImage, originalStoryId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện chức năng này.",
      });
    }

    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên truyện không được để trống.",
      });
    }

    const storyId = await saveStory(userId, title.trim(), description, coverImage, originalStoryId);

    if (genreIds && Array.isArray(genreIds) && genreIds.length > 0) {
      await saveStoryGenres(storyId, genreIds);
    }

    await initStoryOutline(storyId);

    return res.status(201).json({
      success: true,
      message: "Khởi tạo truyện mới thành công.",
      storyId: storyId,
    });
  } catch (error) {
    console.error("Lỗi hệ thống tại hàm createStory:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi khởi tạo truyện.",
    });
  }
};

/**
 * Lấy thông tin 1 truyện theo ID
 * GET /api/stories/:id
 */
const findStoryById = async (storyId) => {
  const [rows] = await db.query(
    `
        SELECT 
            s.id,
            s.user_id,
            s.title,
            s.description,
            s.cover_image,
            s.status,
            s.original_story_id,
            s.created_at,
            s.updated_at,
            GROUP_CONCAT(g.name SEPARATOR ', ') AS genres
        FROM stories s
        LEFT JOIN story_genres sg 
            ON s.id = sg.story_id
        LEFT JOIN genres g 
            ON sg.genre_id = g.id 
            AND g.deleted_at IS NULL
        WHERE s.id = ? 
            AND s.deleted_at IS NULL
        GROUP BY s.id
        `,
    [storyId],
  );

  return rows.length > 0 ? rows[0] : null;
};

const fetchChaptersByStoryId = async (storyId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) return [];

  const chapters = await mongoDb
    .collection("chapters_content")
    .find({ storyId: Number(storyId) })
    .project({ _id: 0, chapterNumber: 1, title: 1 })
    .sort({ chapterNumber: 1 })
    .toArray();

  return chapters;
};

const fetchCharactersByStoryId = async (storyId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) return [];

  const characters = await mongoDb
    .collection("characters")
    .find({ storyId: Number(storyId) })
    .project({ _id: 0, name: 1, role: 1, description: 1 })
    .toArray();

  return characters;
};

exports.getStoryDetails = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện chức năng này.",
      });
    }

    const storyData = await findStoryById(storyId);
    const [testRows] = await db.query(`SELECT id, original_story_id FROM stories WHERE id = ?`, [storyId]);

    if (!storyData) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy truyện hoặc tác phẩm đã bị xóa.",
      });
    }

    if (storyData.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập vào thông tin bộ truyện này.",
      });
    }

    const chaptersList = await fetchChaptersByStoryId(storyId);
    const charactersList = await fetchCharactersByStoryId(storyId);
    const storyDetail = {
      ...storyData,
      chapters: chaptersList,
      characters: charactersList,
    };

    return res.status(200).json({
      success: true,
      message: "Tải thông tin chi tiết Dashboard truyện thành công.",
      data: storyDetail,
    });
  } catch (error) {
    console.error("Lỗi hệ thống tại hàm getStoryDetails:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tải thông tin chi tiết tác phẩm.",
    });
  }
};

/**
 * 1. API Lấy danh sách truyện của riêng User đang đăng nhập (kèm số chương)
 * GET /api/stories/list
 */
exports.getStories = async (req, res) => {
  try {
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin tác giả. Vui lòng đăng nhập lại.",
      });
    }

    const [rows] = await db.query(
      `SELECT 
          s.id, 
          s.user_id, 
          s.title, 
          s.description, 
          s.cover_image, 
          s.status, 
          s.original_story_id,
          COUNT(c.id) AS chapter_count
       FROM stories s
       LEFT JOIN chapters_content c ON s.id = c.story_id AND c.deleted_at IS NULL
       WHERE s.user_id = ? AND s.deleted_at IS NULL
       GROUP BY s.id
       ORDER BY s.id DESC`,
      [user_id],
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Lỗi tại getStories theo tác giả:", error.message);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi lấy danh sách truyện." });
  }
};

const saveUpdatedStory = async (connection, storyId, title, description, coverImage) => {
  const [result] = await connection.query(
    `
    UPDATE stories 
    SET title = ?, description = ?, cover_image = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ? AND deleted_at IS NULL
    `,
    [title, description, coverImage || null, storyId],
  );
  return result.affectedRows;
};

//Chỉnh sửa truyện
exports.updateStory = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { storyId } = req.params;
    const { title, description, coverImage, genreIds } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện chức năng này.",
      });
    }

    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên truyện không được để trống.",
      });
    }

    const [storyRows] = await connection.query(`SELECT id, user_id FROM stories WHERE id = ? AND deleted_at IS NULL`, [storyId]);

    if (storyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tác phẩm hoặc truyện đã bị xóa khỏi hệ thống.",
      });
    }

    if (storyRows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa tác phẩm này.",
      });
    }

    await connection.beginTransaction();
    const affectedRows = await saveUpdatedStory(connection, storyId, title.trim(), description, coverImage);
    await connection.query(`DELETE FROM story_genres WHERE story_id = ?`, [storyId]);

    if (genreIds && Array.isArray(genreIds) && genreIds.length > 0) {
      const values = genreIds.map((genreId) => [storyId, genreId]);
      await connection.query(`INSERT INTO story_genres (story_id, genre_id) VALUES ?`, [values]);
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin tác phẩm thành công.",
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật tác phẩm.",
    });
  } finally {
    connection.release();
  }
};

/**
 * API XÓA MỀM TÁC PHẨM (Soft Delete)
 * DELETE /api/stories/:storyId
 */
exports.deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện hành động này.",
      });
    }

    const [storyRows] = await db.query(`SELECT id, user_id FROM stories WHERE id = ? AND deleted_at IS NULL`, [storyId]);

    if (storyRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tác phẩm không tồn tại hoặc đã bị xóa trước đó.",
      });
    }

    if (storyRows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa tác phẩm này.",
      });
    }

    await db.query(`UPDATE stories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [storyId]);

    return res.status(200).json({
      success: true,
      message: "Đã xóa tác phẩm thành công vào kho lưu trữ.",
    });
  } catch (error) {
    console.error("Lỗi tại hàm deleteStory:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi thực hiện xóa tác phẩm.",
    });
  }
};

//Tìm kiếm
exports.searchStories = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { keyword, genreId } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    const cleanKeyword = keyword ? keyword.trim() : "";
    const storiesList = await queryStories(userId, cleanKeyword, genreId);

    return res.status(200).json({
      success: true,
      results: storiesList,
      data: storiesList,
    });
  } catch (error) {
    console.error("Lỗi nghiệp vụ tại hàm searchStories:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi thực hiện tìm kiếm tác phẩm.",
    });
  }
};

// ======================================================================
// AI ĐẢO NGƯỢC Ý TƯỞNG TỪ MÔ TẢ TRUYỆN
// ======================================================================
exports.reverseDescription = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
      });
    }

    if (!storyId || isNaN(Number(storyId))) {
      return res.status(400).json({
        success: false,
        message: "Mã tác phẩm không hợp lệ.",
      });
    }

    const [rows] = await db.query("SELECT id, title, description FROM stories WHERE id = ? AND user_id = ? AND deleted_at IS NULL", [storyId, userId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tác phẩm trong hệ thống hoặc bạn không có quyền truy cập.",
      });
    }

    const story = rows[0];
    const rawDescription = req.body?.description || story.description || "";
    const cleanDescription = rawDescription.trim();

    if (!cleanDescription) {
      return res.status(400).json({
        success: false,
        message: "Tác phẩm chưa có nội dung mô tả để thực hiện đảo ngược.",
      });
    }

    let reverseDescription = "";
    try {
      const n8nWebhookUrl = process.env.N8N_REVERSE_WEBHOOK_URL || "https://n8n.baostory.fun/webhook/reverse-description";

      const aiResponse = await axios.post(
        n8nWebhookUrl,
        {
          storyId: Number(storyId),
          userId: Number(userId),
          title: story.title,
          description: cleanDescription,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        },
      );

      reverseDescription = aiResponse.data?.reverseDescription || aiResponse.data?.data?.reverseDescription || "";
    } catch (aiError) {
      console.error("Lỗi khi kết nối tới Webhook n8n AI:", aiError.message);
      return res.status(502).json({
        success: false,
        message: "Dịch vụ AI hiện không phản hồi. Vui lòng thử lại sau.",
      });
    }

    if (!reverseDescription) {
      return res.status(502).json({
        success: false,
        message: "Dịch vụ AI không thể xử lý nội dung này.",
      });
    }

    try {
      const mongoDb = getMongoDb();
      if (mongoDb) {
        await mongoDb.collection("story_ai_logs").insertOne({
          story_id: Number(storyId),
          user_id: Number(userId),
          original_description: cleanDescription,
          reverse_description: reverseDescription,
          created_at: new Date(),
        });
      }
    } catch (mongoErr) {
      console.warn("Không thể lưu log AI vào MongoDB:", mongoErr.message);
    }

    const resultData = {
      storyId: Number(storyId),
      reverseDescription: reverseDescription,
      updatedAt: new Date().toISOString(),
    };

    return res.status(200).json({
      success: true,
      message: "Đảo ngược ý tưởng thành công.",
      data: resultData,
    });
  } catch (error) {
    console.error("Lỗi nghiệp vụ tại hàm reverseDescriptionController:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi thực hiện đảo ngược ý tưởng tác phẩm.",
    });
  }
};
