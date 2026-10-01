function extractSources(response) {
  const seen = new Set();
  const sources = [];

  for (const item of response.output || []) {
    if (item.type !== "message") continue;

    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        const url = annotation.url || annotation.url_citation?.url;
        const title = annotation.title || annotation.url_citation?.title || url;
        if (url && !seen.has(url)) {
          seen.add(url);
          sources.push({ title, url });
        }
      }
    }
  }

  return sources.slice(0, 6);
}

function fallbackReply(mode, context) {
  if (mode === "music") {
    return {
      message: `You asked for “${context?.title || "that song"}”. I can confirm playback now, but AI recommendations need the server-side OpenAI key configured. Do you still want me to play the requested song?`,
      followUp: "Say “yes” to play it, or name another song.",
      sources: [],
    };
  }

  if (mode === "travel") {
    const destination = context?.destination || "your destination";
    return {
      message: `I can start a trip plan for ${destination}. Tell me your trip length, budget, who you are traveling with, and what you enjoy most, and I’ll keep refining it. Live AI planning and blog research need the server-side OpenAI key configured.`,
      followUp: "How many days are you planning, and what matters most to you?",
      sources: [],
    };
  }

  return {
    message: "I can keep the conversation going, but the AI response service is not configured yet.",
    followUp: "You can still use the built-in commands while AI is unavailable.",
    sources: [],
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed." });
  }

  const { message, mode = "general", context = {}, history = [] } = request.body || {};

  if (!message || typeof message !== "string") {
    return response.status(400).json({ error: "Message is required." });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return response.status(200).json(fallbackReply(mode, context));
  }

  const system = `
You are the conversational intelligence inside a voice-first personal operations assistant.
Be concise enough to read aloud naturally, but genuinely useful.

General behavior:
- Continue the conversation using the supplied recent history.
- Ask at most one or two useful follow-up questions at a time.
- Never claim an external action happened unless the app explicitly performed it.
- Before actions such as opening media, booking, purchasing, sending, or scheduling, confirm the user's intended choice.
- Give concrete next steps instead of merely acknowledging requests.

For music:
- Identify the requested song/artist when possible.
- Suggest 3 similar songs based on genre, era, mood, or artist adjacency.
- Briefly explain the connection.
- End by asking whether the user wants the originally requested song or one of the alternatives.
- Do not quote lyrics.

For travel:
- Build a practical day-by-day outline from the known destination, dates, duration, budget, interests, and party type.
- If key preferences are missing, make a lightweight provisional plan and ask for the highest-value missing detail.
- Use web search to surface current useful travel guides or blogs.
- Mention 2-4 useful sources naturally.
- Do not pretend flight/hotel availability or prices are confirmed unless sourced by current search results.
- End with a useful refinement question.

For general questions:
- Answer the question directly, then offer one relevant next action when helpful.
`.trim();

  const recentHistory = history
    .slice(-10)
    .map((entry) => ({
      role: entry.role === "assistant" ? "assistant" : "user",
      content: String(entry.text || entry.content || ""),
    }))
    .filter((entry) => entry.content);

  const input = [
    {
      role: "system",
      content: system,
    },
    ...recentHistory,
    {
      role: "user",
      content: `Mode: ${mode}\nStructured context: ${JSON.stringify(context)}\nUser message: ${message}`,
    },
  ];

  try {
    const body = {
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input,
      store: false,
    };

    if (mode === "travel" || mode === "general") {
      body.tools = [{ type: "web_search" }];
      body.include = ["web_search_call.action.sources"];
    }

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!apiResponse.ok) {
      const detail = await apiResponse.text();
      console.error("OpenAI response error", apiResponse.status, detail);
      return response.status(200).json(fallbackReply(mode, context));
    }

    const data = await apiResponse.json();
    const text = data.output_text || "I’m ready. What would you like to do next?";

    return response.status(200).json({
      message: text,
      followUp: "",
      sources: extractSources(data),
    });
  } catch (error) {
    console.error("Assistant endpoint error", error);
    return response.status(200).json(fallbackReply(mode, context));
  }
}
