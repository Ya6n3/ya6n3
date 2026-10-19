# Kairos V2 — Member Intake

A branded request form for Kairos NYC Concierge. Each submission becomes a row in the
Notion **Membership Requests** database, exactly like the Notion "Request a service" form,
so the existing Zapier zaps handle everything after that.

## How it fits

```
Member → kairosnyc.io form → /api/requests → Notion Membership Requests
                                                     ↓
                                Zapier alert zap → alert email
                                                 → copy to Agent Pipeline (Client Request, New, Form)
                                                     ↓
                                Xenia Intake → Claude triage + Draft Reply → Gmail draft
                                                     ↓
                                You review the draft and send it
```

The app does **not** call Claude itself. Drafting stays in Zapier so there is one place
that writes drafts, and you don't pay for two.

## Field mapping

Same fields as the Notion form, so the zap's mapping works unchanged.

| Form field | Membership Requests property | Notes |
|---|---|---|
| Name | Full name (title) | Name only; Xenia greets the member by it |
| Email | Email | Used as the "To" address of the draft |
| Phone | Phone | Optional |
| Which service | Help first with | Tables, Travel, Access, Bespoke sourcing, Home, Wellbeing, Family & guests, Something else |
| What do you need? | Anything we should know | Required, 10 to 4000 characters |
| When | When | Optional free text |
| Budget | Budget | Optional free text |

Stage is left to Notion's default (New). Category and urgency are set by Xenia.

## Setup (about 15 minutes)

1. **Create a Notion integration**: notion.so/profile/integrations → New integration →
   Internal. Give it *Insert content* and *Read content* only. Copy the secret.
2. **Share the database**: open Membership Requests → ••• → Connections → add the integration.
   Without this, every write fails with 404.
3. **Configure env**: `cp .env.example .env.local` and paste the secret into `NOTION_TOKEN`.
4. **Run locally**:
   ```bash
   npm install
   npm run dev     # http://localhost:3000
   ```
   To test without triggering Zapier, set `ALLOW_TEST_SUBMISSIONS=true` and send
   `"isTest": true` in the body (e.g. with curl). The request is validated but nothing is
   written to Notion. Any real submission sets off the alert email and Xenia. Keep this
   `false` in Vercel.
5. **Deploy to Vercel**: import the folder, add `NOTION_TOKEN` and
   `NOTION_MEMBERSHIP_DATABASE_ID` as environment variables, deploy, then point
   kairosnyc.io (or a subdomain such as `request.kairosnyc.io`) at it.
6. **Turn on the shared rate limit**: in Vercel, add Upstash Redis from the Marketplace
   and connect it to this project (free tier is plenty). It sets `KV_REST_API_URL` and
   `KV_REST_API_TOKEN`, which the app picks up; redeploy. Without it, the limit is
   per-instance only.

## Tests and CI

```bash
npm test              # unit tests for validation, the API route and the rate limiter
npm run check:notion  # read-only check of the live Notion schema (needs NOTION_TOKEN in .env.local)
```

GitHub Actions (`.github/workflows/kairos-v2-ci.yml`) runs typecheck, tests and
`next build` on every PR that touches `kairos-v2/`. To include the Notion schema check
in CI, add a `NOTION_TOKEN` repository secret, ideally a separate integration with
*Read content* only; without it that check is skipped.

## Built-in protections

- Server-side validation of every field and length limits.
- Honeypot field to drop simple bots silently.
- Per-IP rate limit (5 per 10 minutes), shared across instances via Upstash Redis when
  configured; falls back to in-memory and fails open if Redis is down.
- Notion token never reaches the browser (`server-only`).
- Pages are marked `noindex`.
- Notion errors are logged server-side; members see a friendly fallback with the email address.

## Known limits and next steps

- No member login yet: anyone with the link can submit. Fine for a founding-member launch;
  add auth (e.g. Clerk or magic links) before showing members their request history.
- Notion's API allows about 3 requests/second, plenty for a form, not for real-time features.
- Next build steps: operator dashboard (approve drafts in-app), then member portal.
