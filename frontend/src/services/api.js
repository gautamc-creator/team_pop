const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = {
  startCrawl: async (url) => {
    const response = await fetch(`${API_BASE_URL}/crawl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error("Failed to start crawl");
    return response.json();
  },

  getCrawlStatus: async (url) => {
    const response = await fetch(
      `${API_BASE_URL}/crawl/status?${new URLSearchParams({ url })}`,
    );
    if (!response.ok) throw new Error("Failed to get status");
    return response.json();
  },

  getCrawlCount: async (url) => {
    const response = await fetch(
      `${API_BASE_URL}/crawl/count?${new URLSearchParams({ url })}`,
    );
    if (!response.ok) throw new Error("Failed to get count");
    return response.json();
  },

  chat: async (messages, domain) => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, domain }),
    });
    if (!response.ok) throw new Error("Chat API failed");
    return response.json();
  },

  tts: async (text) => {
    const response = await fetch(`${API_BASE_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error("TTS Failed");
    return response;
  },
};
