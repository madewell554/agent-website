// tools.js
// Define what the agent is ALLOWED to do, and the real code that runs
// when it decides to do it. This is the part you customize most.

export const tools = [
  {
    name: "get_weather",
    description: "Get the current weather for a city. Use when the user asks about weather.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. 'Austin'" },
      },
      required: ["city"],
    },
  },
  {
    name: "search_notes",
    description:
      "Search the site's internal notes/knowledge base for relevant info. Use for anything about this website's own content.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for" },
      },
      required: ["query"],
    },
  },
  {
    name: "calculate",
    description: "Evaluate a basic math expression. Use for any arithmetic.",
    input_schema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "e.g. '(42 * 7) / 3'" },
      },
      required: ["expression"],
    },
  },
];

// Fake in-memory "knowledge base" so search_notes has something real to return.
const NOTES = [
  { id: 1, text: "The office is open Monday to Friday, 9am to 5pm." },
  { id: 2, text: "Refunds are processed within 5 business days." },
  { id: 3, text: "Our support email is support@example.com." },
];

export async function executeTool(name, input) {
  switch (name) {
    case "get_weather": {
      // Replace with a real weather API call (e.g. Open-Meteo, no key required)
      const r = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          input.city
        )}&count=1`
      );
      const geo = await r.json();
      if (!geo.results?.length) return { error: "city not found" };
      const { latitude, longitude, name: cityName } = geo.results[0];

      const wr = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );
      const weather = await wr.json();
      return { city: cityName, ...weather.current_weather };
    }

    case "search_notes": {
      const q = input.query.toLowerCase();
      const matches = NOTES.filter((n) => n.text.toLowerCase().includes(q));
      return { matches: matches.length ? matches : "no matches found" };
    }

    case "calculate": {
      // NOTE: naive eval for demo purposes only.
      // In production, use a proper math parser (e.g. mathjs) — never raw eval on user input.
      try {
        // eslint-disable-next-line no-eval
        const result = Function(`"use strict"; return (${input.expression})`)();
        return { result };
      } catch {
        return { error: "invalid expression" };
      }
    }

    default:
      return { error: `unknown tool: ${name}` };
  }
}
