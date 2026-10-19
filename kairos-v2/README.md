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

## Automations: research, approve-to-send, daily digest

Three jobs run on the **Agent Pipeline** rows (rows with Source = Test are skipped, as the schema says):

| What | When | Result |
|---|---|---|
| **Research** | A new client request appears (and daily for any missed) | Claude searches the web and fills **Options** (3 concrete picks with price and link) and **Research Notes** (constraints, questions to ask). It never contacts anyone. |
| **Approve to send** | You tick **Approved** on a row in New/Triaged | The **Draft Reply** is emailed to the member, Stage → **Contacted**, **Next Follow-up** = +2 days, and the exact text sent is logged on the page. Each row is sent once, ever. |
| **Daily digest** | ~8am ET | One email to `DIGEST_TO`: failed sends, drafts to approve, rows with no draft, follow-ups due, work in progress. |

How it's wired:

```
Notion (row created / Approved ticked) ──webhook──▶ /api/notion/webhook ──▶ research + send
Vercel cron 12:00 & 13:00 UTC ─────────────────────▶ /api/cron/daily-* ──▶ sweep missed rows + 8am digest
```

Vercel Hobby crons run once a day (±59 min), so instant actions come from Notion webhooks; the
daily cron is the safety net. Two crons cover 8am ET in both daylight and standard time.

Safeguards: approved + not Do Not Contact + Stage New/Triaged + an email in Contact are all required
to send; a Redis lock and Resend idempotency key prevent duplicates; research is capped at
`RESEARCH_DAILY_LIMIT` per day (default 20) and gives up on a row after 2 failures; member text
is treated as untrusted input in the research prompt and escaped in emails.

Cost: research ≈ $0.05–0.15 per request (Claude Sonnet tokens + up to 5 searches at $10/1,000);
Resend's free tier covers this volume.

### Setup

1. **Notion access**: in the integration's settings, enable *Read*, *Update* and *Insert content*,
   and add the integration to the **Agent Pipeline** database (••• → Connections).
2. **Resend**: create an account, add and verify your sending domain (DNS records), create an API key.
3. **Vercel env vars** (Settings → Environment Variables, Production): `ANTHROPIC_API_KEY`,
   `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`, `DIGEST_TO`, `CRON_SECRET`. Redeploy.
4. **Notion webhook**: integration settings → Webhooks → Create subscription →
   `https://<your-domain>/api/notion/webhook`, events `page.created` and `page.properties_updated`.
   Notion posts a verification token: it appears on the `/setup` page (or in Vercel → Logs,
   search `verification_token`); paste it into Notion's **Verify** dialog.
5. **Zapier**: in *Kairos - Xenia Intake*, delete step 7 (Gmail Create Draft) so there's one
   way to send. Steps 1–6 keep writing the Draft Reply into Notion.

**Check it**: open `https://<your-domain>/setup?key=<CRON_SECRET>`. The page tests each piece
live (Notion access to both databases, the Anthropic key, the webhook, Upstash, email) and says in
plain words what's left. It also lists requests waiting for research, with a button to research
them now instead of waiting for the webhook or the daily cron. It shows no secrets except the
Notion verification token you need to paste into Notion.

Test: submit the form with your own email, wait for the Draft Reply and Options to appear,
tick Approved, and the email should arrive within a couple of minutes.

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
