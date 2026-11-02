# NEXUS AI

NEXUS is a private AI operations workspace built on Cloudflare Workers, Workers AI, D1, Browser Run, and Cloudflare Workflows.

## Active capabilities

- **Chat:** conversational AI with persistent conversation history.
- **Multi-agent orchestration:** Strategist, Specialist, and Critic agents run in parallel; an Orchestrator synthesizes their reports and records an audit trail.
- **Durable background jobs:** Cloudflare Workflows run long-running agent tasks outside the lifetime of a single HTTP request. The UI can start a job and poll its status.
- **Browser agent:** navigate, inspect, extract, click, and fill public HTTP(S) pages using Cloudflare Browser Run / Puppeteer.
- **Human approval gate:** browser clicks and form submissions pause until the user approves them.
- **Recurring automations:** D1-backed schedules are checked every five minutes. Text-only tasks use the multi-agent crew; browser tasks use the browser runtime and approval gate.
- **Persistent memory:** explicitly saved facts can be added, listed, used as context, and deleted.
- **Skills:** declarative reusable browser skills with validation, retries for idempotent steps, and audit events.
- **MCP server:** bearer-authenticated MCP endpoint with memory, skills, schedules, run history, agent execution, planning, and durable workflow start tools.
- **Control workspace:** responsive UI for overview, chat, agent team, automations, memory, and execution history.

## Stack

- Cloudflare Workers
- Cloudflare Workers AI (GLM-4.7-Flash)
- Cloudflare D1
- Cloudflare Browser Run / Puppeteer
- Cloudflare Workflows
- GitHub Actions + Wrangler

## Local development

Run: npm install
Run: npm run db:init:local
Run: npm run check
Run: npm test
Run: npm run dev

## Deployment

The deployment workflow applies schema.sql, uploads secrets using Wrangler's versioned secret commands, and deploys the Worker.

Required GitHub Actions secrets:
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- NEXUS_PIN
- NEXUS_SESSION_SECRET (32+ characters)
- NEXUS_MCP_TOKEN (32+ characters)

The Cloudflare account must have Browser Run enabled. Review docs/BROWSER_AGENT_SETUP.md.

## Authenticated API

- POST /api/login, POST /api/logout
- POST /api/chat, POST /api/agent
- POST /api/workflows, GET /api/workflows/:id
- GET/POST /api/memory, DELETE /api/memory/:id
- GET/POST /api/skills, POST /api/skills/:id/run
- GET/POST /api/schedules, PATCH/DELETE /api/schedules/:id
- GET /api/agent/runs, GET /api/agent/runs/:id
- POST /api/agent/approve
- MCP: POST /mcp

## Honest boundaries

NEXUS now has a real multi-agent reasoning layer and durable background workflow execution, but it is not an unrestricted computer-use system. The specialist agents work from the user's task and supplied context; they do not independently have general web-search access. The cloud browser can operate public websites, but it is not the user's locally logged-in Chrome and does not inherit local cookies. Local desktop control, arbitrary shell access, email/calendar integrations, third-party MCP aggregation, and unrestricted external actions are not implemented. Payments, purchases, account changes, publishing, sending messages, and deletion are intentionally not exposed as supported browser actions.

Browser clicks and form fills require explicit user approval. Never represent an action as completed unless the runtime confirms it.
