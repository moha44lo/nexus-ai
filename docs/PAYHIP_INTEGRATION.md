# Payhip webhook integration

This NEXUS endpoint receives Payhip webhook events and stores a minimal sales/refund/subscription event record in D1.

## Required Cloudflare Worker secret

Set the Worker secret named `PAYHIP_API_KEY` to the API key shown in Payhip → Account settings → Developer. Do not commit the key or paste it into chat.

## Payhip settings

After this branch is merged and deployed, set the Payhip Webhook Endpoint to:

`https://nexus-ai.moha-safdari6.workers.dev/api/payhip/webhook`

Enable the event types you want to receive (recommended: paid and refunded; subscription events only if you sell subscriptions), then save settings.

## Endpoints

- `POST /api/payhip/webhook` — public receiver; verifies Payhip's documented SHA-256 API-key signature, accepts supported events, and stores a deduplicated event in D1.
- `GET /api/payhip/events` — NEXUS-session-protected list of the latest 100 events.

The stored event data is limited to transaction/event ID, event type, buyer email, amount in minor currency units, currency, product names, event timestamp, and receive timestamp. Payhip documents prices in cents/pence and its webhook signature as SHA-256 of the API key.

## Important limitation

Payhip's current public REST API supports coupons and license-key resources only. It does not expose product creation or file upload endpoints. Product publishing therefore remains a Payhip dashboard action.
