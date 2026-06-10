const db = require("../config/db");
const n8nService = require("../services/n8nService");

/**
 * Bước 1 & Bước 2: Khởi tạo truyện, chọn folder và tự động lập kế hoạch cốt truyện
 * POST /api/stories/init
 */
exports.initStory = async (req, res) => {
  const { user_id, title, description, local_folder_path, genre_ids } = req.body;

  if (!user_id || !title || !local_folder_path || !genre_ids || genre_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng điền đầy đủ tên truyện, chọn folder lưu trữ và ít nhất một thể loại.",
    });
  }

  // SỬA: Gọi kết nối Pool thông qua .promise() để tránh crash lỗi "db.getConnection is not a function"
  let connection;
  try {
    connection = await db.promise().getConnection();
  } catch (dbError) {
    console.error("Lỗi kết nối cơ sở dữ liệu:", dbError);
    return res.status(500).json({ success: false, message: "Không thể kết nối đến cơ sở dữ liệu." });
  }

  await connection.beginTransaction();

  try {
    // --- BƯỚC 1: LƯU THÔNG TIN TRUYỆN & THỂ LOẠI VÀO MYSQL ---
    const [storyResult] = await connection.query(
      `INSERT INTO stories (user_id, title, description, local_folder_path, status) 
             VALUES (?, ?, ?, ?, 'DRAFT')`,
      [user_id, title, description || "", local_folder_path],
    );
    const storyId = storyResult.insertId;

    const genreQueries = genre_ids.map((genreId) => {
      return connection.query(`INSERT INTO story_genres (story_id, genre_id) VALUES (?, ?)`, [storyId, genreId]);
    });
    await Promise.all(genreQueries);

    // --- BƯỚC 2: XỬ LÝ LẬP KẾ HOẠCH CỐT TRUYỆN (STORY PLANNING) ---
    const N8N_STORY_PLANNING_WEBHOOK = process.env.N8N_STORY_PLANNING_URL;
    let finalArcs = [];

    // Kiểm tra xem đã cấu hình n8n cho đoạn này chưa
    if (N8N_STORY_PLANNING_WEBHOOK) {
      // Nếu CÓ n8n: Tiến hành bắn sang n8n thật như bình thường
      const n8nPayload = { story_id: storyId, title, description: description || "" };
      const n8nResponse = await n8nService.triggerN8nWorkflow(N8N_STORY_PLANNING_WEBHOOK, n8nPayload);
      if (n8nResponse && Array.isArray(n8nResponse.arcs)) {
        finalArcs = n8nResponse.arcs;
      }
    } else {
      // Nếu CHƯA CÓ n8n: Tự động dùng Mockup Data tại chỗ
      console.log(`[Mockup] Chưa có n8n cho cốt truyện. Tự động tạo dữ liệu giả lập cho truyện: "${title}"`);

      // Giả lập AI chạy mất 1 giây
      await new Promise((resolve) => setTimeout(resolve, 1000));

      finalArcs = [
        {
          part_number: 1,
          title: `Hồi 1: Biến Cố Tại ${title}`,
          plot_summary: `Mở đầu câu chuyện dựa trên ý tưởng: "${description || "Chưa có mô tả"}". Nhân vật chính xuất hiện, trải qua một biến cố lớn làm thay đổi hoàn toàn cuộc đời, ép buộc phải dấn thân vào hành trình mới.`,
          climax: "Trận chiến hoặc xung đột đầu tiên bùng nổ, nhân vật chính bộc lộ tiềm năng tiềm ẩn.",
        },
        {
          part_number: 2,
          title: "Hồi 2: Đường Vào Sóng Gió",
          plot_summary: "Nhân vật chính bắt đầu khám phá thế giới rộng lớn hơn, kết giao thêm đồng minh mới và đối mặt với những thử thách phức tạp mang tầm vĩ mô từ các thế lực ẩn mình.",
          climax: "Bị dồn vào chân tường, một cuộc rút chạy hoặc hy sinh lớn xảy ra, thúc đẩy nhân vật trưởng thành vượt bậc.",
        },
        {
          part_number: 3,
          title: "Hồi 3: Trật Tự Mới",
          plot_summary: "Nhân vật chính tập hợp mọi nguồn lực, thấu hiểu toàn bộ bí mật đằng sau câu chuyện và chuẩn bị cho cuộc lật đổ hoặc định hình lại vận mệnh thế giới.",
          climax: "Đại chiến cuối cùng kết thúc toàn bộ chuỗi mắt xích cốt truyện, mở ra một kỷ nguyên mới.",
        },
      ];
    }

    // Lưu mảng Hồi (Dù là từ n8n thật hay Mockup) vào bảng story_planning
    for (const arc of finalArcs) {
      await connection.query(
        `INSERT INTO story_planning (story_id, part_number, title, plot_summary, climax, is_human_approved) 
                 VALUES (?, ?, ?, ?, ?, 0)`,
        [storyId, arc.part_number, arc.title, arc.plot_summary, arc.climax],
      );
    }

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: N8N_STORY_PLANNING_WEBHOOK ? "Tạo truyện thành công bằng AI (n8n)!" : "Tạo truyện thành công (Dữ liệu cốt truyện giả lập để test UI)!",
      data: {
        story_id: storyId,
        title: title,
        local_folder_path: local_folder_path,
        ai_suggested_arcs: finalArcs,
      },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Lỗi tại storyController (initStory):", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống trong quá trình khởi tạo truyện.",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * API Chốt duyệt kế hoạch cốt truyện từ Tác giả (Nút "Tạo truyện" cuối cùng trên giao diện)
 * PUT /api/stories/planning/approve
 */
exports.approveStoryPlanning = async (req, res) => {
  const { story_id, arcs } = req.body;

  if (!story_id || !Array.isArray(arcs)) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ." });
  }

  // SỬA: Gọi kết nối Pool thông qua .promise() tương tự như trên hàm initStory
  let connection;
  try {
    connection = await db.promise().getConnection();
  } catch (dbError) {
    console.error("Lỗi kết nối cơ sở dữ liệu:", dbError);
    return res.status(500).json({ success: false, message: "Không thể kết nối đến cơ sở dữ liệu." });
  }

  await connection.beginTransaction();

  try {
    for (const arc of arcs) {
      await connection.query(
        `INSERT INTO story_planning (story_id, part_number, title, plot_summary, climax, is_human_approved) 
                 VALUES (?, ?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE 
                    title = VALUES(title), 
                    plot_summary = VALUES(plot_summary), 
                    climax = VALUES(climax), 
                    is_human_approved = 1`,
        [story_id, arc.part_number, arc.title, arc.plot_summary, arc.climax],
      );
    }

    await connection.commit();
    return res.status(200).json({ success: true, message: "Đã chốt duyệt toàn bộ kế hoạch cốt truyện chính thức." });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Lỗi tại storyController (approveStoryPlanning):", error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
};
