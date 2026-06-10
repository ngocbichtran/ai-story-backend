const fs = require("fs-extra");
const path = require("path");

/**
 * Hàm ghi đè hoặc tạo mới file văn bản bản thảo chương xuống máy của tác giả
 * @param {string} rootPath - Đường dẫn gốc của truyện (D:/BaoStory/...)
 * @param {number} chapterNumber - Số thứ tự chương (Ví dụ: 12)
 * @param {string} title - Tiêu đề chương (Ví dụ: Bãi lầy cổ xưa)
 * @param {string} content - Nội dung chữ của bản thảo hoàn thiện
 * @returns {string} Đường dẫn tuyệt đối của file vừa lưu
 */
exports.saveChapterFile = async (rootPath, chapterNumber, title, content) => {
  try {
    // Đảm bảo thư mục gốc tồn tại, nếu tác giả lỡ tay xóa folder ngoài đời thật, code sẽ tự tạo lại folder mới
    await fs.ensureDir(rootPath);

    // Biến đổi tiêu đề tiếng Việt có dấu/khoảng trắng thành dạng an toàn cho hệ thống file (ví dụ: Bai_lay_co_xua)
    const safeTitle = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Loại bỏ dấu tiếng Việt
      .replace(/[^a-zA-Z0-9]/g, "_") // Thay ký tự đặc biệt và dấu cách thành dấu gạch dưới
      .replace(/_+/g, "_"); // Thu gọn các dấu gạch dưới liên tiếp

    const fileName = `Chuong_${chapterNumber}_${safeTitle}.txt`;
    const absoluteFilePath = path.join(rootPath, fileName);

    // Tiến hành ghi dữ liệu chữ (utf-8) đè lên file cũ hoặc tạo mới nếu chưa có
    await fs.writeFile(absoluteFilePath, content, "utf-8");

    return absoluteFilePath;
  } catch (error) {
    throw new Error(`Thao tác file tại thư mục cục bộ thất bại: ${error.message}`);
  }
};
