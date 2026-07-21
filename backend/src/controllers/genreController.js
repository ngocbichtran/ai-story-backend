const db = require("../config/db");

// Kiểm tra tên thể loại đã tồn tại chưa (Chỉ kiểm tra các thể loại chưa bị xóa)
exports.checkGenreNameExists = async (name) => {
  const [rows] = await db.query("SELECT id FROM genres WHERE name = ? AND deleted_at IS NULL LIMIT 1", [name]);
  return rows.length > 0;
};

// Lưu thể loại mới xuống Database
exports.saveNewGenre = async (name, description, userId) => {
  const [result] = await db.query(
    `
    INSERT INTO genres(name, description, user_id)
    VALUES (?, ?, ?)
    `,
    [name, description, userId],
  );
  return result.insertId;
};

// Tạo thể loại mới
exports.createGenre = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để thực hiện chức năng này.",
      });
    }

    // Kiểm tra dữ liệu đầu vào
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên thể loại không được để trống.",
      });
    }

    const trimmedName = name.trim();

    // Kiểm tra trùng tên
    const exists = await this.checkGenreNameExists(trimmedName);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Thể loại đã tồn tại.",
      });
    }

    // Lưu xuống database kèm theo userId
    const insertId = await this.saveNewGenre(trimmedName, description || "", userId);

    return res.status(201).json({
      success: true,
      message: "Tạo thể loại thành công.",
      data: {
        id: insertId,
        name: trimmedName,
        description: description || "",
        user_id: userId,
      },
    });
  } catch (error) {
    console.error("Lỗi createGenre:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};

// Lấy danh sách tất cả thể loại (Chỉ lấy những cái chưa bị xóa mềm)
exports.getGenres = async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT id, name, description
      FROM genres
      WHERE deleted_at IS NULL
      ORDER BY name ASC
    `);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách thể loại thành công.",
      data: results,
    });
  } catch (error) {
    console.error("Lỗi getGenres:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};

// XÓA MỀM THỂ LOẠI (Cập nhật cột deleted_at)
exports.softDeleteStory = async (req, res) => {
  const userId = req.user?.id;
  const { genreId } = req.params;

  try {
    // Thực hiện cập nhật mốc thời gian xóa mềm
    await db.query(
      `
      UPDATE genres 
      SET deleted_at = NOW() 
      WHERE id = ?
      `,
      [genreId],
    );

    return res.status(200).json({
      success: true,
      message: "Đã chuyển thể loại vào thùng rác thành công.",
    });
  } catch (error) {
    console.error("Lỗi deleteGenre (Soft Delete):", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xóa thể loại.",
    });
  }
};
