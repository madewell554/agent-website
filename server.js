// server.js
// A minimal but REAL autonomous-agent backend.
// The agent can reason, call tools, observe results, and loop until done.

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { tools, executeTool } from "./tools.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";
const MAX_AGENT_STEPS = 8; // hard cap so the agent can't loop forever

const sessions = new Map();

app.post("/api/chat", async (req, res) => {
  const { sessionId = "default", message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  const history = sessions.get(sessionId);

  history.push({ role: "user", content: message });

  try {
    const { finalText, trace } = await runAgentLoop(history);
    res.json({ reply: finalText, trace });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "agent failed", detail: err.message });
  }
});

async function runAgentLoop(history) {
  const trace = [];

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `You are the virtual receptionist for Culy Contracting, a
family-led underground utility contractor based in Winchester, Indiana,
in business since 1978.

SERVICES WE OFFER (organized by division):
- Utilities Division: water, sanitary sewer, and storm sewer underground
  utility installation; site grading; concrete work
- Protective Coatings Division: manhole rehabilitation (Mainstay epoxy
  liner) and special coatings
- Flow Control Division: line stops, bypasses, insert valves, hot taps
- Vac Truck / CCTV Division: hydro excavation, CCTV sewer line inspection
  and televising, sewer/storm line cleaning (jet-vac truck), trenchless
  internal pipe repairs, root cutting for sewer and storm lines
- Also: manhole and sewer vacuum testing, low pressure air testing,
  lift station installation and custom fabrication, concrete coring
  (3 to 16 inches), injection grout sealing for pressure leaks

SERVICE AREA: Primarily the Midwest -- Indiana, Ohio, Illinois, Kentucky,
and Michigan -- with an expanding Southeast presence (manhole
rehabilitation and flow control) out of Morristown, Tennessee.
Locations: main office in Winchester, IN, plus shops in Saratoga IN,
Richmond IN, Indianapolis IN, and Morristown TN.

HOURS: Monday-Friday, 7:00am-5:00pm. Culy also offers 24-hour emergency
service for urgent water and sewer issues -- if someone describes an
active emergency (active leak, no water service, sewage backup), tell
them to call the office line directly right away rather than only
relying on this chat.

MAIN PHONE: (765) 584-8509

Your job:
- Answer questions about services, hours, service area, and general
  process in a friendly, professional tone -- like a real front-desk
  person, not a generic chatbot.
- Use the search_notes tool for specific FAQ answers before guessing.
- If someone wants a quote or wants to book work, use the capture_lead
  tool to collect their name, phone number, and a short description of
  the job. Always confirm back to them what you captured, and tell them
  someone from the office will call them back -- you cannot give firm
  prices or promise specific dates yourself.
- Culy primarily serves municipalities, utilities, developers, and
  commercial/industrial clients rather than small residential jobs --
  if a residential caller's request sounds outside that scope, still be
  helpful and offer to pass it along rather than turning them away outright.
- If you don't know something (exact pricing, availability on a specific
  date, technical engineering questions), say so honestly and offer to
  take their info instead of guessing.
- Keep answers short and conversational, the way a real receptionist
  would talk on the phone -- not long paragraphs.`,
      tools,
      messages: history,
    });

    history.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length === 0) {
      const finalText = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return { finalText, trace };
    }

    const toolResults = [];
    for (const block of toolUseBlocks) {
      trace.push({ tool: block.name, input: block.input });
      const result = await executeTool(block.name, block.input);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    history.push({ role: "user", content: toolResults });
  }

  return {
    finalText: "I hit my step limit before finishing -- try narrowing the request.",
    trace,
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Agent website running on http://localhost:${PORT}`));
