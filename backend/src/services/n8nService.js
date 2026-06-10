const axios = require("axios");

const n8nService = {
  /**
   * Gọi n8n workflow thực tế, nếu lỗi hoặc không có URL sẽ tự động chạy Mockup tương ứng
   * @param {string} url - Webhook URL của n8n
   * @param {object} payload - Dữ liệu gửi đi ({ draft_content, characters_metadata })
   */
  triggerN8nWorkflow: async (url, payload) => {
    // 1. Kiểm tra nếu có URL thì tiến hành gọi thật bằng Axios
    if (url) {
      try {
        console.log(`[n8n Service] 🚀 Đang gửi request thật sang n8n URL: ${url}`);
        const response = await axios.post(url, payload);
        return response.data; // Trả về dữ liệu thực tế từ n8n
      } catch (error) {
        console.error("❌ Lỗi khi kết nối hệ thống n8n thật:", error.message);
        console.log("⚠️ Tự động chuyển hướng sang luồng dữ liệu giả lập (Mockup)...");
      }
    }

    // 2. FALLBACK MOCKUP: Chạy khi n8n lỗi hoặc URL bị trống
    // Giả lập độ trễ của AI rà soát mất 1.5 giây
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Lấy nội dung bản nháp ra để xử lý mockup (tránh bị lỗi undefined)
    const draftText = payload?.draft_content || "Nội dung trống";
    console.log(`[Mockup n8n AI] Đang xử lý biên tập cho bản nháp dài: ${draftText.substring(0, 30)}...`);

    // Trả về đúng cấu trúc mà hàm editAndGenerateArt ở Controller đang đợi
    return {
      success: true,
      provider: "Mockup_n8n_AI_Engine",
      polished_text: draftText + "\n\n*(Đã được AI rà soát và tối ưu lỗi chính tả - Chế độ Mockup)*",
      image_url: "https://baostory.vn/covers/mock_illustration.jpg",
      prompt_used: "An anime style digital painting of characters based on story context...",
    };
  },
};

module.exports = n8nService;
