const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = {
  startCrawl: async (url) => {
    const response = await fetch(`${API_BASE_URL}/api/crawl`, {
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
      `${API_BASE_URL}/api/crawl/status?${new URLSearchParams({ url })}`,
    );
    if (!response.ok) throw new Error("Failed to get status");
    return response.json();
  },

  getCrawlCount: async (url) => {
    const response = await fetch(
      `${API_BASE_URL}/api/crawl/count?${new URLSearchParams({ url })}`,
    );
    if (!response.ok) throw new Error("Failed to get count");
    return response.json();
  }
};
