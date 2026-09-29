// server.js
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import twilio from "twilio";
import { tools, executeTool } from "./tools.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Twilio sends form-encoded data
app.use(express.static("public"));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";
const MAX_AGENT_STEPS = 8;

const sessions = new Map(); // shared by both web chat and phone calls

const SYSTEM_PROMPT = `You are the virtual receptionist for Culy Contracting, a
family-led underground utility contractor based in Winchester, Indiana,
in business since 1978.

SERVICES WE OFFER (organized by division):
- Utilities Division: water, sanitary sewer, and storm sewer underground
  utility installation; site grading; concrete work
- Protective Coatings Division: manhole rehabilitation (Mainstay epoxy
  liner) and special coatings
- Flow Control Division: line stops, bypasses, insert valves, hot taps
- Vac Truck / CCTV Division: hydro excavation, CCTV sewer line inspection
  and televising, sewer/storm line cleaning, trenchless internal pipe
  repairs, root cutting

SERVICE AREA: Primarily the Midwest -- Indiana, Ohio, Illinois, Kentucky,
and Michigan -- with an expanding Southeast presence out of Morristown,
Tennessee. Main office: Winchester, IN.

HOURS: Monday-Friday, 7:00am-5:00pm. 24-hour emergency service is
available for urgent water/sewer issues.

MAIN PHONE: (765) 584-8509

Your job:
- Answer questions about services, hours, service area, and process in a
  friendly, professional tone -- like a real front-desk person.
- Use search_notes for specific FAQ answers before guessing.
- If someone wants a quote or to book work, use capture_lead to collect
  their name, phone, job description, and the correct job_category.
  Always confirm back what you captured and tell them someone will call
  them back -- never promise firm prices or dates yourself.
- If this is a phone call and the caller describes an active emergency
  (active leak, no water, sewage backup), treat it with urgency, capture
  their info as job_category "emergency" right away, and let them know
  someone will be in touch immediately.
- Keep answers short and conversational -- especially on the phone, where
  long responses are hard to follow out loud. One or two sentences at a
  time, like a real person talking.
- If you don't know something, say so honestly and offer to take their
  info instead of guessing.`;

async function runAgentLoop(history) {
  const trace = [];
  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
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
  return { finalText: "I hit my step limit -- try narrowing the request.", trace };
}

// ---- Website chat (unchanged) ----
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

// ---- Phone calls (new) ----

// Twilio hits this the moment someone calls your number
app.post("/voice", (req, res) => {
  const callSid = req.body.CallSid;
  sessions.set(callSid, []); // fresh conversation for this call

  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    input: "speech",
    action: "/voice/gather",
    speechTimeout: "auto",
  });
  gather.say(
    "Thanks for calling Culy Contracting. How can I help you today?"
  );
  res.type("text/xml").send(twiml.toString());
});

// Twilio hits this after it has transcribed what the caller said
app.post("/voice/gather", async (req, res) => {
  const callSid = req.body.CallSid;
  const speechText = req.body.SpeechResult;
  const twiml = new twilio.twiml.VoiceResponse();

  if (!speechText) {
    const gather = twiml.gather({ input: "speech", action: "/voice/gather", speechTimeout: "auto" });
    gather.say("Sorry, I didn't catch that. Could you say that again?");
    return res.type("text/xml").send(twiml.toString());
  }

  const history = sessions.get(callSid) || [];
  history.push({ role: "user", content: speechText });

  try {
    const { finalText } = await runAgentLoop(history);
    const gather = twiml.gather({ input: "speech", action: "/voice/gather", speechTimeout: "auto" });
    gather.say(finalText);
    // If the caller stays silent after this, wrap up the call politely
    twiml.say("Thanks for calling Culy Contracting. Goodbye!");
    twiml.hangup();
  } catch (err) {
    console.error(err);
    twiml.say("Sorry, something went wrong on our end. Please call back or try again shortly.");
    twiml.hangup();
  }

  res.type("text/xml").send(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Agent website running on http://localhost:${PORT}`));
