# NEXUS Browser Agent — activation

The browser agent uses Cloudflare Browser Run through the Workers browser binding and `@cloudflare/puppeteer`.

## Required one-time setup

1. Use a Cloudflare account with Browser Run / Browser Rendering enabled for the account.
2. Keep the `browser.binding = "BROWSER"` declaration in `wrangler.jsonc`.
3. Install dependencies with `npm install`.
4. Apply the expanded D1 schema to the existing database:
   `npx wrangler d1 execute nexus --remote --file=./schema.sql`
5. Confirm the existing Worker secrets are set:
   - `NEXUS_PIN`
   - `NEXUS_SESSION_SECRET` (at least 32 characters)
6. Deploy from this branch only after the migration and bindings are configured:
   `npx wrangler deploy`

## What the current browser runtime can do

- Navigate to public HTTP(S) pages.
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
