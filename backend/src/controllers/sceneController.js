const { getMongoDb } = require("../config/mongo");
const { ObjectId } = require("mongodb");

// =========================================================================
// HÀM REPOSITORY: saveNewScene() (Đặc tả 033_F2)
// =========================================================================
const saveNewScene = async (chapterId, sceneData) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  // Sử dụng Collection scenes đúng như đặc tả
  const collection = mongoDb.collection("scenes");

  // Chuẩn bị tài liệu phân cảnh mới đính kèm liên kết chapterId
  const newSceneDoc = {
    chapterId: ObjectId.isValid(chapterId) ? new ObjectId(chapterId) : chapterId,
    ...sceneData, // Trải phẳng đối tượng thông tin phân cảnh (title, summary, content, sceneOrder...)
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Thực thi câu lệnh chèn bản ghi vào Collection scenes
  const insertResult = await collection.insertOne(newSceneDoc);

  // Trả về insertedId theo đúng đặc tả
  return insertResult.insertedId;
};

// =========================================================================
// HÀM CONTROLLER / BUSINESS: createScene() (Đặc tả 033_F1)
// =========================================================================
exports.createScene = async (req, res) => {
  try {
    // Bước 1: Tiếp nhận chapterId từ req.params và sceneData từ req.body
    const { chapterId } = req.params;
    const { sceneData } = req.body;

    if (!chapterId || !sceneData) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh chương (chapterId) hoặc đối tượng thông tin phân cảnh (sceneData).",
      });
    }

    // Bước 2: Xác thực dữ liệu truyền lên (tiêu đề không trống, sceneOrder là số nguyên dương)
    const { title, sceneOrder } = sceneData;
    const cleanSceneOrder = Number(sceneOrder);

    if (!title || typeof title !== "string" || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tiêu đề phân cảnh (title) không được để trống.",
      });
    }

    if (isNaN(cleanSceneOrder) || cleanSceneOrder <= 0 || !Number.isInteger(cleanSceneOrder)) {
      return res.status(400).json({
        success: false,
        message: "Thứ tự phân cảnh (sceneOrder) phải là một số nguyên dương hợp lệ.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    // Bước 3: Kiểm tra nhanh tài liệu chương cha (hoặc kế hoạch chương) có tồn tại hay không
    // (Trong hệ thống của bạn, collection quản lý kế hoạch/chương cha là chapter_plans hoặc chapters)
    const parentCollection = mongoDb.collection("chapter_plans");

    let queryParent = {};
    if (ObjectId.isValid(chapterId)) {
      queryParent._id = new ObjectId(chapterId);
    } else {
      queryParent.chapterNumber = Number(chapterId);
    }

    const parentDoc = await parentCollection.findOne(queryParent);

    if (!parentDoc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chương cha tương ứng trên hệ thống.",
      });
    }

    // Bước 4: Gọi hàm tương tác xuống tầng Repository của MongoDB để chèn bản ghi
    const insertedId = await saveNewScene(chapterId, {
      ...sceneData,
      title: title.trim(),
      sceneOrder: cleanSceneOrder,
    });

    // Bước 5: Trả về đối tượng JSON chứa mã phân cảnh mới tạo đính kèm thông báo hoàn tất
    return res.status(201).json({
      success: true, // Output của 033_F1
      message: "Tạo phân cảnh mới thành công!",
      data: {
        insertedId: insertedId.toString(),
        chapterId: chapterId,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm createScene:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo phân cảnh mới.",
    });
  }
};
// =========================================================================
// HÀM REPOSITORY: fetchScenesByChapterId() (Đặc tả 034_F2)
// =========================================================================
const fetchScenesByChapterId = async (chapterId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  // Sử dụng Collection scenes đúng như đặc tả
  const collection = mongoDb.collection("scenes");

  // Xử lý linh hoạt chapterId dưới dạng ObjectId hoặc giá trị thông thường
  const queryChapterId = ObjectId.isValid(chapterId) ? new ObjectId(chapterId) : chapterId;

  // Thực thi câu lệnh truy vấn tìm kiếm toàn bộ tài liệu phân cảnh liên kết,
  // đồng thời sắp xếp danh sách tăng dần theo thứ tự (sceneOrder: 1)
  const scenesList = await collection.find({ chapterId: queryChapterId }).sort({ sceneOrder: 1 }).toArray();

  // Trả về mảng chứa danh sách các tài liệu phân cảnh tìm thấy từ MongoDB
  return scenesList;
};

// =========================================================================
// HÀM CONTROLLER / BUSINESS: getScenesByChapter() (Đặc tả 034_F1)
// =========================================================================
exports.getScenesByChapter = async (req, res) => {
  try {
    // Bước 1: Tiếp nhận tham số mã định danh chương chapterId từ request parameters (req.params)
    const { chapterId } = req.params;

    if (!chapterId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh chương (chapterId) trên đường dẫn.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    // Bước 2: Truy vấn kiểm tra nhanh xem chương truyện/kế hoạch chương cha có tồn tại hay không
    const parentCollection = mongoDb.collection("chapter_plans");

    let queryParent = {};
    if (ObjectId.isValid(chapterId)) {
      queryParent._id = new ObjectId(chapterId);
    } else {
      queryParent.chapterNumber = Number(chapterId);
    }

    const parentDoc = await parentCollection.findOne(queryParent);

    if (!parentDoc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chương truyện tương ứng trên hệ thống.",
      });
    }

    // Bước 3: Gọi hàm tương tác xuống tầng Repository của MongoDB để lấy mảng dữ liệu phân cảnh
    const scenesList = await fetchScenesByChapterId(chapterId);

    // Bước 4: Đóng gói mảng dữ liệu nhận được thành cấu trúc JSON hoàn chỉnh trả về cho Client
    return res.status(200).json({
      success: true,
      data: scenesList, // Mảng chứa danh sách các phân cảnh đã được sắp xếp theo đúng thứ tự
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm getScenesByChapter:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy danh sách phân cảnh theo chương.",
    });
  }
};
// =========================================================================
// HÀM REPOSITORY CẬP NHẬT: saveUpdatedSceneMongo() (Đặc tả 035_F2)
// =========================================================================
const saveUpdatedSceneMongo = async (sceneId, updateData) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  // Sử dụng Collection scenes đúng như đặc tả
  const collection = mongoDb.collection("scenes");

  // Kiểm tra tính hợp lệ của sceneId trước khi khởi tạo ObjectId
  if (!ObjectId.isValid(sceneId)) {
    return 0;
  }

  // Thực thi câu lệnh cập nhật động các trường thông tin dựa theo _id bằng toán tử $set
  const updateResult = await collection.updateOne(
    { _id: new ObjectId(sceneId) },
    {
      $set: {
        ...updateData, // Cập nhật các trường thuộc tính chỉnh sửa mới
        updatedAt: new Date(), // Tự động cập nhật thời gian chỉnh sửa gần nhất
      },
    },
  );

  // Trả về số lượng bản ghi đã được chỉnh sửa và cập nhật thành công (modifiedCount)
  return updateResult.modifiedCount;
};

// =========================================================================
// HÀM CONTROLLER / BUSINESS: updateScene() (Đặc tả 035_F1)
// =========================================================================
exports.updateScene = async (req, res) => {
  try {
    // Bước 1: Tiếp nhận sceneId từ req.params và updateData từ req.body
    const { sceneId } = req.params;
    const { updateData } = req.body;

    if (!sceneId || !updateData) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh phân cảnh (sceneId) hoặc dữ liệu chỉnh sửa (updateData).",
      });
    }

    // Bước 2: Xác thực định dạng ObjectId của sceneId
    if (!ObjectId.isValid(sceneId)) {
      return res.status(400).json({
        success: false,
        message: "Mã định danh phân cảnh không đúng định dạng ObjectId hợp lệ.",
      });
    }

    // Xác thực cơ bản thuộc tính nếu có truyền lên
    if (updateData.title !== undefined && (typeof updateData.title !== "string" || updateData.title.trim() === "")) {
      return res.status(400).json({
        success: false,
        message: "Tiêu đề phân cảnh không được để trống.",
      });
    }

    if (updateData.sceneOrder !== undefined) {
      const cleanOrder = Number(updateData.sceneOrder);
      if (isNaN(cleanOrder) || cleanOrder <= 0 || !Number.isInteger(cleanOrder)) {
        return res.status(400).json({
          success: false,
          message: "Thứ tự phân cảnh (sceneOrder) phải là một số nguyên dương hợp lệ.",
        });
      }
      updateData.sceneOrder = cleanOrder;
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("scenes");

    // Bước 3: Kiểm tra nhanh xem bản ghi phân cảnh có tồn tại trong CSDL hay không
    const existingScene = await collection.findOne({ _id: new ObjectId(sceneId) });

    if (!existingScene) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin phân cảnh cần chỉnh sửa trong cơ sở dữ liệu.",
      });
    }

    // Bước 4: Gọi hàm tương tác xuống tầng Repository của MongoDB để cập nhật động dữ liệu
    const modifiedCount = await saveUpdatedSceneMongo(sceneId, updateData);

    // Bước 5: Nhận phản hồi và trả về đối tượng JSON thông báo hoàn tất cho Client
    return res.status(200).json({
      success: true, // Output của 035_F1
      message: "Cập nhật phân cảnh thành công!",
      modifiedCount: modifiedCount,
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm updateScene:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi cập nhật phân cảnh.",
    });
  }
};
// =========================================================================
// HÀM REPOSITORY: fetchSceneDetailById() (Đặc tả 036_F2)
// =========================================================================
const fetchSceneDetailById = async (sceneId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  // Sử dụng Collection scenes đúng như đặc tả
  const collection = mongoDb.collection("scenes");

  // Kiểm tra tính hợp lệ của sceneId trước khi khởi tạo ObjectId
  if (!ObjectId.isValid(sceneId)) {
    return null;
  }

  // Thực thi câu lệnh truy vấn tìm kiếm một tài liệu phân cảnh duy nhất dựa theo _id
  const result = await collection.findOne({ _id: new ObjectId(sceneId) });

  // Trả về đối tượng tài liệu chi tiết tìm thấy (hoặc null nếu không có)
  return result;
};

// =========================================================================
// HÀM CONTROLLER / BUSINESS: getSceneDetail() (Đặc tả 036_F1)
// =========================================================================
exports.getSceneDetail = async (req, res) => {
  try {
    // Bước 1: Tiếp nhận tham số mã định danh phân cảnh sceneId từ request parameters (req.params)
    const { sceneId } = req.params;

    if (!sceneId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh phân cảnh (sceneId) trên đường dẫn.",
      });
    }

    if (!ObjectId.isValid(sceneId)) {
      return res.status(400).json({
        success: false,
        message: "Mã định danh phân cảnh không đúng định dạng ObjectId hợp lệ.",
      });
    }

    // Bước 2: Gọi hàm tương tác xuống tầng Repository của MongoDB để lấy thông tin chi tiết
    const sceneData = await fetchSceneDetailById(sceneId);

    // Bước 3: Kiểm tra kết quả; nếu bằng null hoặc không tìm thấy, trả về mã lỗi 404
    if (!sceneData) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin chi tiết phân cảnh tương ứng.",
      });
    }

    // Bước 4: Đóng gói và trả về đối tượng JSON chứa đầy đủ cấu trúc dữ liệu cho Frontend
    return res.status(200).json({
      success: true,
      data: {
        _id: sceneData._id.toString(),
        chapterId: sceneData.chapterId ? sceneData.chapterId.toString() : null,
        storyId: sceneData.storyId || null,
        title: sceneData.title || "",
        summary: sceneData.summary || "",
        content: sceneData.content || "",
        sceneOrder: sceneData.sceneOrder || 1,
        createdAt: sceneData.createdAt,
        updatedAt: sceneData.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm getSceneDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi lấy chi tiết phân cảnh.",
    });
  }
};
// =========================================================================
// HÀM REPOSITORY XÓA: removeSceneMongo() (Đặc tả 037_F2)
// =========================================================================
const removeSceneMongo = async (sceneId) => {
  const mongoDb = getMongoDb();
  if (!mongoDb) {
    throw new Error("Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).");
  }

  // Sử dụng Collection scenes đúng như đặc tả
  const collection = mongoDb.collection("scenes");

  // Kiểm tra tính hợp lệ của sceneId trước khi khởi tạo ObjectId
  if (!ObjectId.isValid(sceneId)) {
    return 0;
  }

  // Thực thi câu lệnh xóa vĩnh viễn tài liệu phân cảnh dựa theo _id
  const deleteResult = await collection.deleteOne({ _id: new ObjectId(sceneId) });

  // Trả về số lượng bản ghi tài liệu phân cảnh đã được xóa thành công (deletedCount)
  return deleteResult.deletedCount;
};

// =========================================================================
// HÀM CONTROLLER / BUSINESS: deleteScene() (Đặc tả 037_F1)
// =========================================================================
exports.deleteScene = async (req, res) => {
  try {
    // Bước 1: Tiếp nhận tham số mã định danh phân cảnh sceneId từ request parameters (req.params)
    const { sceneId } = req.params;

    if (!sceneId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã định danh phân cảnh (sceneId) trên đường dẫn.",
      });
    }

    if (!ObjectId.isValid(sceneId)) {
      return res.status(400).json({
        success: false,
        message: "Mã định danh phân cảnh không đúng định dạng ObjectId hợp lệ.",
      });
    }

    const mongoDb = getMongoDb();
    if (!mongoDb) {
      return res.status(500).json({
        success: false,
        message: "Mất kết nối cơ sở dữ liệu hệ thống (MongoDB).",
      });
    }

    const collection = mongoDb.collection("scenes");

    // Bước 2: Gọi câu lệnh truy vấn kiểm tra nhanh dưới tầng Repository xem tài liệu có tồn tại hay không
    const existingScene = await collection.findOne({ _id: new ObjectId(sceneId) });

    if (!existingScene) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phân cảnh cần xóa trong cơ sở dữ liệu.",
      });
    }

    // Bước 3: Tiến hành gọi hàm tương tác xuống tầng Repository của MongoDB để thực hiện xóa bản ghi
    const deletedCount = await removeSceneMongo(sceneId);

    // Bước 4: Nhận phản hồi xóa thành công và trả về đối tượng JSON thông báo hoàn tất cho Client
    return res.status(200).json({
      success: true, // Output của 037_F1 (Trạng thái xóa phân cảnh thành công)
      message: "Xóa phân cảnh thành công!",
      deletedCount: deletedCount,
    });
  } catch (error) {
    console.error("❌ Lỗi tại hàm deleteScene:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xóa phân cảnh.",
    });
  }
};
