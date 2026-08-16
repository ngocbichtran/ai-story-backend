const axios = require("axios");

const n8nService = {
  triggerN8nWorkflow: async (url, payload) => {
    if (url) {
      try {
        const response = await axios.post(url, payload);
        return response.data;
      } catch (error) {}
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const draftText = payload?.draft_content || "Nội dung trống";
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
