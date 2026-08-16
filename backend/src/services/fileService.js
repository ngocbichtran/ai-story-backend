const fs = require("fs-extra");
const path = require("path");

exports.saveChapterFile = async (rootPath, chapterNumber, title, content) => {
  try {
    await fs.ensureDir(rootPath);
    const safeTitle = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_");

    const fileName = `Chuong_${chapterNumber}_${safeTitle}.txt`;
    const absoluteFilePath = path.join(rootPath, fileName);
    await fs.writeFile(absoluteFilePath, content, "utf-8");

    return absoluteFilePath;
  } catch (error) {
    throw new Error(`Thao tác file tại thư mục cục bộ thất bại: ${error.message}`);
  }
};
