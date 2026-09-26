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
  {
    name: "define_word",
    description: "Look up the dictionary definition of an English word.",
    input_schema: {
      type: "object",
      properties: {
        word: { type: "string", description: "The word to define" },
      },
      required: ["word"],
    },
  },
  {
    name: "get_joke",
    description: "Fetch a random joke. Use when the user asks for a joke or something funny.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "convert_units",
    description:
      "Convert a value between common units of length, weight, or temperature (e.g. miles to km, lbs to kg, F to C).",
    input_schema: {
      type: "object",
      properties: {
        value: { type: "number", description: "The number to convert" },
        from: { type: "string", description: "Unit to convert from, e.g. 'miles', 'lbs', 'F'" },
        to: { type: "string", description: "Unit to convert to, e.g. 'km', 'kg', 'C'" },
      },
      required: ["value", "from", "to"],
    },
  },
  {
    name: "capture_lead",
    description:
      "Save a potential customer's contact info and job description when they ask for a quote or want to book work. Always confirm the details back to the customer after calling this.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Customer's name" },
        phone: { type: "string", description: "Customer's phone number" },
        job_description: { type: "string", description: "What they need done, and any details like location or timeline" },
      },
      required: ["name", "phone", "job_description"],
    },
  },
];

// Business knowledge base for search_notes.
const NOTES = [
  { id: 1, text: "We serve [randolph county and places with in a 2 hour radius]." },
  { id: 2, text: "We offer free on-site estimates for jobs over a certain size; smaller jobs get a phone estimate." },
  { id: 3, text: "A typical basement dig takes 2-4 days depending on soil conditions and size." },
  { id: 4, text: "We require a call to 811 (Call Before You Dig) before starting any job to mark utility lines." },
  { id: 5, text: "We accept cash, check, and card. A deposit is required to schedule larger jobs." },
  { id: 6, text: "Emergency or urgent digging requests can be called in directly at [765-584-8509]." },
  { id: 7, text: "We are licensed and insured for residential and commercial excavation work." },
];

// Captured leads live here in memory for now (cleared on server restart).
const leads = [];

export async function executeTool(name, input) {
  switch (name) {
    case "get_weather": {
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
      try {
        const result = Function(`"use strict"; return (${input.expression})`)();
        return { result };
      } catch {
        return { error: "invalid expression" };
      }
    }

    case "define_word": {
      const r = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(input.word)}`
      );
      if (!r.ok) return { error: "word not found" };
      const data = await r.json();
      const meanings = data[0]?.meanings?.map((m) => ({
        partOfSpeech: m.partOfSpeech,
        definition: m.definitions[0]?.definition,
      }));
      return { word: input.word, meanings };
    }

    case "get_joke": {
      const r = await fetch("https://icanhazdadjoke.com/", {
        headers: { Accept: "application/json" },
      });
      const data = await r.json();
      return { joke: data.joke };
    }

    case "convert_units": {
      const { value, from, to } = input;
      const f = from.toLowerCase();
      const t = to.toLowerCase();

      if ((f === "f" || f === "fahrenheit") && (t === "c" || t === "celsius")) {
        return { result: ((value - 32) * 5) / 9 };
      }
      if ((f === "c" || f === "celsius") && (t === "f" || t === "fahrenheit")) {
        return { result: (value * 9) / 5 + 32 };
      }

      const toBase = {
        miles: 1609.34, km: 1000, m: 1, meters: 1, ft: 0.3048, feet: 0.3048, in: 0.0254, inches: 0.0254,
        lbs: 0.453592, pounds: 0.453592, kg: 1, kilograms: 1, g: 0.001, grams: 0.001, oz: 0.0283495,
      };
      if (toBase[f] && toBase[t]) {
        const baseValue = value * toBase[f];
        return { result: baseValue / toBase[t] };
      }

      return { error: `don't know how to convert ${from} to ${to}` };
    }

    case "capture_lead": {
      const lead = {
        ...input,
        capturedAt: new Date().toISOString(),
      };
      leads.push(lead);
      console.log("NEW LEAD CAPTURED:", lead);
      return { confirmed: true, ...input };
    }

    default:
      return { error: `unknown tool: ${name}` };
  }
}
