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

// In-memory conversation store, keyed by a simple session id.
// Swap this for Redis/Postgres for real persistence.
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
    res.json({ reply: finalText, trace }); // trace = which tools it used, for the UI to show its "thinking"
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "agent failed", detail: err.message });
  }
});

/**
 * The core agent loop:
 * 1. Ask the model what to do next (it can either answer, or call a tool)
 * 2. If it calls a tool, execute it and feed the result back
 * 3. Repeat until the model gives a final answer or we hit the step cap
 */
async function runAgentLoop(history) {
  const trace = [];

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `You are an autonomous web agent. You can use tools to accomplish
the user's goal. Think step by step. Only stop calling tools once you have
enough information to give a complete, correct final answer.`,
      tools,
      messages: history,
    });

    // Save the model's turn (may include text + tool_use blocks)
    history.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length === 0) {
      // No tool calls -> model gave its final answer
      const finalText = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return { finalText, trace };
    }

    // Execute every requested tool call, return results to the model
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
    finalText: "I hit my step limit before finishing — try narrowing the request.",
    trace,
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Agent website running on http://localhost:${PORT}`));
