# NEXUS Browser Agent — activation

The browser agent uses Cloudflare Browser Run through the Workers browser binding and `@cloudflare/puppeteer`.

## Required one-time setup

1. Use a Cloudflare account with Browser Run / Browser Rendering enabled for the account.
2. Create a strong MCP bearer token (at least 32 characters) and set it as the Worker secret `NEXUS_MCP_TOKEN`.
3. Set the Worker secrets `NEXUS_PIN` and `NEXUS_SESSION_SECRET` (at least 32 characters).
4. Keep the `browser.binding = "BROWSER"` declaration in `wrangler.jsonc`.
5. Install dependencies with `npm install`.
6. Apply the expanded D1 schema to the existing database:
   `npx wrangler d1 execute nexus --remote --file=./schema.sql`
7. Deploy from this branch only after the migration and bindings are configured:
   `npx wrangler deploy`

## What the current browser runtime can do

- Search the public web using DuckDuckGo HTML results, then navigate to public HTTP(S) pages.
- Inspect page text, links, buttons and form controls.
- Extract text from a CSS selector.
- Click a CSS selector or fill a form field after an explicit in-chat approval.
- Record run status and per-step audit events in D1.
- Read explicitly saved semantic memory facts and inject them into planning.

## Safety and current limits

- Private/local network destinations and non-HTTP(S) protocols are rejected.
- Clicks and form fills pause for a user approval. Declining cancels the run.
- Payments, purchases, deletion, publishing, sending messages, and account changes are not exposed as supported browser actions.
- Browser Run is a cloud headless browser, not the user's logged-in local Chrome. It does not inherit local cookies or sessions. Authenticated workflows and a local Chrome bridge are separate work.
- A fresh browser session is created per execution. Long-lived sessions, visual live view, and recovery across browser restarts are not implemented yet.
- Schedules, external MCP transports, chat channels, autonomous skill compilation/evaluation, and multi-agent delegation remain subsequent modules; database foundations exist for memory, run history, skills, and schedules, but those features must not be represented as active until their runtimes are implemented.
- Cloudflare account quotas and pricing apply. Check the current Browser Run limits before enabling recurring jobs.

## API additions

- `GET /api/memory` — list semantic facts.
- `POST /api/memory` with `{"fact":"...","category":"preference"}` — explicitly save a fact.
- `DELETE /api/memory/:id` — delete a fact.
- `GET /api/agent/runs` — recent execution history.
- `POST /api/agent/approve` — approve or reject a pending browser plan.

The existing authenticated API session is required for these endpoints.


## MCP server

NEXUS exposes a stateless MCP endpoint at `/mcp` using protocol version `2025-03-26`.
Authenticate with `Authorization: Bearer <NEXUS_MCP_TOKEN>`. Configure the token as a Cloudflare Worker secret; never place it in frontend code or commit it.

Available MCP tools:
- `nexus.memory.list` and `nexus.memory.save`
- `nexus.skills.list`
- `nexus.schedules.list` and `nexus.schedules.create`
- `nexus.runs.list`

Example local configuration (replace the URL and token locally; do not commit credentials):
```json
{
  "mcpServers": {
    "nexus": {
      "url": "https://YOUR-WORKER-DOMAIN/mcp",
      "headers": { "Authorization": "Bearer YOUR_NEXUS_MCP_TOKEN" }
    }
  }
}
```

MCP is stateless and currently exposes these tools only. It does not yet expose a local Chrome session, arbitrary shell access, email, calendar, or third-party MCP server aggregation.


## Multi-agent safety review

Every browser plan is checked by a separate reviewer model before execution. The reviewer rejects unsupported or high-impact actions. Runtime validation independently limits the plan to the registered browser tools, caps the number of steps, validates destinations, and requires explicit user approval for clicks and form entry.

The cloud browser also validates HTTP(S) destinations for page requests, including redirects and subresources, to block localhost and private-network targets. This is defense in depth, not a substitute for reviewing sensitive actions.
