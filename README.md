# Agent Website — Starter

A minimal website with a *real* autonomous agent behind it: it reasons, chooses
tools, executes them, observes results, and loops until it has a final answer.

## What makes this "autonomous" rather than just a chatbot

A normal chatbot does one round-trip: prompt in, text out. This does a **loop**
(see `runAgentLoop` in `server.js`):

1. Send the conversation + a list of tools to Claude
2. Claude either answers directly, or asks to call one or more tools
3. Your backend actually runs those tools (`tools.js`)
4. The results go back to Claude as "what happened"
5. Repeat until Claude has enough info to give a final answer (or hits the step cap)

That loop — plan → act → observe → repeat — is the core of what people mean by
"agent." Everything else (the chat UI, the server) is just plumbing to expose
it on the web.

## Setup

```bash
npm install
cp .env.example .env   # then add your Anthropic API key
npm start
```

Open http://localhost:3000

## Files

- `server.js` — Express server + the agent loop itself
- `tools.js` — the tools the agent is allowed to use (weather lookup, note
  search, calculator). **This is what you'd extend** to add real capabilities:
  database queries, sending emails, scraping pages, calling other APIs, etc.
- `public/index.html` — bare-bones chat UI, shows which tools the agent used
  for each response (a simple window into its "thinking")

## How to extend this into something real

1. **Add tools that matter for your use case** — in `tools.js`, add an entry
   to the `tools` array (name, description, JSON schema for its input) and a
   matching case in `executeTool`. The description is what the model uses to
   decide *when* to call it, so be specific.
2. **Give it memory** — swap the in-memory `sessions` Map for a real database
   (Postgres, Redis) so conversations/tasks persist across requests and
   restarts.
3. **Add guardrails** — some actions (sending an email, charging a card,
   deleting data) shouldn't run fully autonomously. Add a "requires
   confirmation" flag to sensitive tools and pause the loop to ask the user
   before executing them.
4. **Let it run in the background** — right now the loop runs inside a single
   HTTP request. For longer-running autonomous tasks, move `runAgentLoop` into
   a background job (queue + worker) and stream progress to the frontend over
   WebSockets/SSE instead of waiting for one response.
5. **Observability** — log every tool call and its result somewhere durable.
   Once agents take actions, you need an audit trail of what it did and why.

## Security notes (don't skip these before deploying)

- The `calculate` tool uses `Function(...)` as a placeholder — replace with a
  real math parser (e.g. `mathjs`) before shipping; never `eval` raw user
  input in production.
- Any tool that touches real systems (databases, payments, emails) needs
  strict input validation and, likely, human-in-the-loop approval for
  destructive or irreversible actions.
- Rate-limit `/api/chat` — an agent loop can rack up API calls quickly if
  abused.
