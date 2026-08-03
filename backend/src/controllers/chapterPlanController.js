const db = require("../config/db"); // Kết nối MySQL để kiểm tra story
const { getMongoDb } = require("../config/mongo"); // Kết nối MongoDB Atlas
const { ObjectId } = require("mongodb");

// =========================================================================
// HÀM REPOSITORY Tạo Kế hoạch: saveNewChapterPlanMongo()
// =========================================================================
const saveNewChapterPlanMongo = async (cleanStoryId, cleanChapterNumber, planData) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  const collection = mongoDb.collection("chapter_plans");

  // Chuẩn bị tài liệu chèn mới
  const newChapterPlanDoc = {
    storyId: cleanStoryId,
    chapterNumber: cleanChapterNumber,
    ...planData, // Trải phẳng đối tượng chi tiết kế hoạch của chương
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Thực thi câu lệnh chèn bản ghi vào MongoDB
  const insertResult = await collection.insertOne(newChapterPlanDoc);

  // Trả về tài liệu vừa chèn hoặc insertedId để Controller dễ xử lý trả về cho Frontend
  return {
    _id: insertResult.insertedId,
    ...newChapterPlanDoc,
  };
};

// =========================================================================
// HÀM CONTROLLER Tạo Kế Hoạch: createChapterPlan()
// =========================================================================
exports.createChapterPlan = async (req, res) => {
  try {
    const { storyId, chapterNumber, planData } = req.body;

    if (!storyId || !chapterNumber || !planData) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin storyId, chapterNumber và planData.",
      });
    }

    const cleanStoryId = Number(storyId);
    const cleanChapterNumber = Number(chapterNumber);

    if (isNaN(cleanChapterNumber) || cleanChapterNumber <= 0 || !Number.isInteger(cleanChapterNumber)) {
      return res.status(400).json({
        success: false,
        message: "Số thứ tự chương (chapterNumber) phải là một số nguyên dương lớn hơn 0.",
      });
    }

    // Truy vấn kiểm tra bộ truyện gốc có tồn tại trong MySQL hay không
    const [storyCheck] = await db.query("SELECT COUNT(*) as count FROM stories WHERE id = ? AND deleted_at IS NULL", [cleanStoryId]);

    if (storyCheck[0].count === 0) {
      return res.status(404).json({
        success: false,
        message: "Bộ truyện không tồn tại trên hệ thống.",
      });
    }

    // Gọi hàm tương tác xuống tầng Repository MongoDB
    const createdPlan = await saveNewChapterPlanMongo(cleanStoryId, cleanChapterNumber, planData);

    // Trả về kết quả kèm object data chứa _id để Frontend cập nhật State mượt mà
    return res.status(201).json({
      success: true,
      message: "Tạo kế hoạch chương mới thành công!",
      data: {
        _id: createdPlan._id.toString(),
        storyId: createdPlan.storyId,
        chapterNumber: createdPlan.chapterNumber,
        versionName: createdPlan.versionName || createdPlan.title || "",
        summary: createdPlan.summary || "",
      },
    });
  } catch (error) {
    console.error("Lỗi tại hàm createChapterPlan:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo kế hoạch chương.",
    });
  }
};

// =========================================================================
// HÀM REPOSITORY Lấy chi tiết 1 kế hoạch chương: fetchChapterPlanDetailById()
// =========================================================================
const fetchChapterPlanDetailById = async (planId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  const collection = mongoDb.collection("chapter_plans");

  if (!ObjectId.isValid(planId)) {
    return null;
  }

  const result = await collection.findOne({ _id: new ObjectId(planId) });
  return result;
};

// =========================================================================
// HÀM CONTROLLER Lấy chi tiết 1 kế hoạch chương: getChapterPlanDetail()
// =========================================================================
exports.getChapterPlanDetail = async (req, res) => {
  try {
    const { planId } = req.params;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh kế hoạch chương (planId) trên URL.",
      });
    }

    const planData = await fetchChapterPlanDetailById(planId);

    if (!planData) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin chi tiết kế hoạch chương.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: planData._id.toString(),
        storyId: planData.storyId,
        chapterNumber: planData.chapterNumber,
        title: planData.title || "",
        versionName: planData.versionName || "",
        summary: planData.summary || "",
        createdAt: planData.createdAt,
        updatedAt: planData.updatedAt,
      },
    });
  } catch (error) {
    console.error("Lỗi tại hàm getChapterPlanDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy chi tiết kế hoạch chương.",
    });
  }
};

// =========================================================================
// HÀM CONTROLLER: LẤY DANH SÁCH KẾ HOẠCH CHƯƠNG THEO STORY ID
// =========================================================================
exports.getChapterPlansByStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    if (!storyId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh bộ truyện (storyId) trên URL.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("chapter_plans");

    const plansList = await collection
      .find({ storyId: Number(storyId) })
      .sort({ chapterNumber: 1 })
      .toArray();

    return res.status(200).json({
      success: true,
      data: plansList,
    });
  } catch (error) {
    console.error("Lỗi tại hàm getChapterPlansByStory:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách kế hoạch chương.",
    });
  }
};

// =========================================================================
// HÀM REPOSITORY Chỉnh sửa kế hoạch chương: saveUpdatedChapterPlan() (Đặc tả 029_F2)
// =========================================================================
const saveUpdatedChapterPlan = async (chapterId, planData) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  // Sử dụng Collection chapter_plans (hoặc chapters_content tùy thiết kế của bạn)
  const collection = mongoDb.collection("chapter_plans");

  // Kiểm tra tính hợp lệ của chapterId (hoặc planId) trước khi khởi tạo ObjectId
  if (!ObjectId.isValid(chapterId)) {
    return 0;
  }

  // Thực thi câu lệnh cập nhật động các trường thuộc tính bằng toán tử $set
  const updateResult = await collection.updateOne(
    { _id: new ObjectId(chapterId) },
    {
      $set: {
        ...planData, // Cập nhật các trường thông tin planData truyền lên
        updatedAt: new Date(), // Tự động cập nhật thời gian chỉnh sửa mới nhất
      },
    },
  );

  // Trả về số lượng bản ghi đã được chỉnh sửa và cập nhật thành công (modifiedCount)
  return updateResult.modifiedCount;
};

// =========================================================================
// HÀM CONTROLLER chỉnh sửa kế hoạch chương: updateChapterPlan() (Đặc tả 029_F1)
// =========================================================================
exports.updateChapterPlan = async (req, res) => {
  try {
    // Bước 1: Tiếp nhận chapterId từ req.params và planData từ req.body
    const { chapterId } = req.params;
    const { planData } = req.body;

    if (!chapterId || !planData) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh chapterId hoặc dữ liệu planData trên yêu cầu.",
      });
    }

    // Bước 2: Kiểm tra và xác thực định dạng dữ liệu cơ bản
    if (!ObjectId.isValid(chapterId)) {
      return res.status(400).json({
        success: false,
        message: "Mã định danh kế hoạch chương không đúng định dạng ObjectId.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("chapter_plans");

    // Bước 3: Kiểm tra nhanh dưới tầng Repository xem bản ghi có tồn tại hay không
    const existingPlan = await collection.findOne({ _id: new ObjectId(chapterId) });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bản ghi kế hoạch chương tương ứng trong cơ sở dữ liệu.",
      });
    }

    // Bước 4: Gọi hàm xử lý tương tác xuống tầng Repository của MongoDB để lưu trữ
    const modifiedCount = await saveUpdatedChapterPlan(chapterId, planData);

    // Bước 5: Nhận phản hồi và trả về đối tượng JSON thông báo hoàn tất cho Client
    return res.status(200).json({
      success: true, // Output của 029_F1
      message: "Cập nhật kế hoạch chương thành công!",
      modifiedCount: modifiedCount,
    });
  } catch (error) {
    console.error("Lỗi tại hàm updateChapterPlan:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật kế hoạch chương.",
    });
  }
};

// =========================================================================
// HÀM REPOSITORY XÓA: removeChapterPlanMongo() (Đặc tả 031_F2)
// =========================================================================
const removeChapterPlanMongo = async (planId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  // Sử dụng Collection chapter_plans đúng như đặc tả
  const collection = mongoDb.collection("chapter_plans");

  // Kiểm tra tính hợp lệ của planId trước khi khởi tạo ObjectId
  if (!ObjectId.isValid(planId)) {
    return 0;
  }

  // Thực thi câu lệnh xóa vĩnh viễn tài liệu dựa theo _id
  const deleteResult = await collection.deleteOne({ _id: new ObjectId(planId) });

  // Trả về số lượng bản ghi đã được xóa thành công (deletedCount)
  return deleteResult.deletedCount;
};

// =========================================================================
// HÀM CONTROLLER / BUSINESS: deleteChapterPlan() (Đặc tả 031_F1)
// =========================================================================
exports.deleteChapterPlan = async (req, res) => {
  try {
    // Bước 1: Tiếp nhận tham số planId từ request parameters (req.params)
    const { planId } = req.params;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh kế hoạch chương (planId) trên đường dẫn.",
      });
    }

    if (!ObjectId.isValid(planId)) {
      return res.status(400).json({
        success: false,
        message: "Mã định danh kế hoạch chương không đúng định dạng ObjectId.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("chapter_plans");

    // Bước 2: Kiểm tra nhanh xem tài liệu kế hoạch có tồn tại hay không
    const existingPlan = await collection.findOne({ _id: new ObjectId(planId) });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy kế hoạch chương cần xóa trong cơ sở dữ liệu.",
      });
    }

    // Bước 3: Gọi hàm tương tác xuống tầng Repository của MongoDB để xóa bản ghi
    const deletedCount = await removeChapterPlanMongo(planId);

    // Bước 4: Nhận phản hồi xóa thành công và trả về đối tượng JSON cho Client
    return res.status(200).json({
      success: true, // Output của 031_F1
      message: "Xóa kế hoạch chương thành công!",
      deletedCount: deletedCount,
    });
  } catch (error) {
    console.error("Lỗi tại hàm deleteChapterPlan:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xóa kế hoạch chương.",
    });
  }
};
