export default async function handler(request, response) {
  const query = String(request.query?.q || "").trim();

  if (!query) {
    return response.status(400).json({ error: "Missing search query." });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return response.status(503).json({
      error: "YouTube search is not configured.",
      fallback: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    });
  }

  try {
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "1",
      q: query,
      key: apiKey,
      safeSearch: "moderate",
    });

    const youtubeResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
    );

    if (!youtubeResponse.ok) {
      throw new Error("YouTube search failed.");
    }

    const data = await youtubeResponse.json();
    const videoId = data.items?.[0]?.id?.videoId;

    if (!videoId) {
      return response.status(404).json({ error: "No matching video found." });
    }

    return response.status(200).json({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}&autoplay=1`,
    });
  } catch {
    return response.status(500).json({ error: "Unable to search YouTube right now." });
  }
}
