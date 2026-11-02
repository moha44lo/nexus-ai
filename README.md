# NEXUS AI

A Cloudflare Workers personal AI agent with chat, approval-gated browser automation, reusable skills, persistent memory, scheduled tasks, execution audit history, and an authenticated MCP endpoint.

## Current capabilities

- Conversational AI powered by Cloudflare Workers AI.
- Agent planning with JSON-validated browser workflows.
- Cloudflare Browser Run / Puppeteer: navigate, inspect, extract, click, and fill.
- Explicit approval before browser clicks and form submissions.
- DOM-grounded selector repair when a page changes.
- D1-backed conversations, approved memory facts, reusable skills, schedules, run history, and step audit.
- MCP endpoint at `/mcp` with memory, skills, schedules, and run tools.
- GitHub Actions checks, tests, and Wrangler dry-run deployment validation.

## Quick start

```bash
npm install
npm run db:init:local
npm run dev
```

Set these Worker secrets before deploying:
- `NEXUS_PIN`
- `NEXUS_SESSION_SECRET` (32+ characters)
- `NEXUS_MCP_TOKEN` (32+ characters)

Apply the schema to the remote D1 database and deploy:
```bash
npm run db:init:remote
npm run deploy
```

The Cloudflare account must have Browser Run enabled and the `BROWSER` binding configured. Review [Browser Agent Setup](docs/BROWSER_AGENT_SETUP.md) before deployment.

## API overview

- `POST /api/login`, `POST /api/logout`
- `POST /api/chat`, `POST /api/agent`
- `GET/POST /api/memory`, `DELETE /api/memory/:id`
- `GET/POST /api/skills`, `POST /api/skills/:id/run`
- `GET/POST /api/schedules`, `PATCH/DELETE /api/schedules/:id`
- `GET /api/agent/runs`, `GET /api/agent/runs/:id`
- `POST /api/agent/approve`
- MCP: `POST /mcp` with a bearer token (`nexus.agent.plan` includes independent review and does not execute actions)

## Important boundaries

The cloud browser is not the user's locally logged-in Chrome. Local Chrome/CDP bridging, third-party MCP aggregation, multi-agent delegation, and a full visual automation control center are not implemented yet. Browser actions that click or fill require approval. Payments, purchases, account changes, sending messages, publishing, and deletion are intentionally not exposed as supported actions.

Never commit secrets. Do not expose `NEXUS_MCP_TOKEN` in browser code.
