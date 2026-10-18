# Kairos V2 — Member Intake

A branded request form for Kairos NYC Concierge. Each submission becomes a row in the
Notion **Agent Pipeline**, where your existing Zapier Intake Zap picks it up.

## How it fits

```
Member → kairosnyc.io form → /api/requests → Notion Agent Pipeline
                                              (Type = Client Request, Stage = New, Source = Form)
                                                     ↓
                                     Zapier Intake Zap → Claude draft → Draft Reply
                                                     ↓
                                     You review in "Awaiting approval" → tick Approved
```

The app does **not** call Claude itself. Drafting stays in Zapier so there is one place
that writes drafts, and you don't pay for two.

## Field mapping

| Form field | Notion property | Notes |
|---|---|---|
| Category + Name | Name (title) | e.g. "Dining — Jane Doe" |
| — | Type | Always `Client Request` |
| — | Stage | Always `New` |
| — | Source | `Form` (or `Test` when enabled) |
| Category | Category | Dining, Events, Travel, Errands, Business Services, Other |
| How soon? | Urgency | Today → Urgent, This week → Normal, No rush → Low |
| Email | Contact | Used as the "To" address by the Gmail step |
| Request + Phone | Request Details | Phone appended on its own line |
| — | Needs Human | Ticked automatically for Urgent |

## Setup (about 15 minutes)

1. **Create a Notion integration**: notion.so/profile/integrations → New integration →
   Internal. Give it *Insert content* and *Read content* only. Copy the secret.
2. **Share the database**: open Agent Pipeline → ••• → Connections → add the integration.
   Without this, every write fails with 404.
3. **Configure env**: `cp .env.example .env.local` and paste the secret into `NOTION_TOKEN`.
4. **Run locally**:
   ```bash
   npm install
   npm run dev     # http://localhost:3000
   ```
   To test without triggering Zapier, set `ALLOW_TEST_SUBMISSIONS=true` and send
   `"isTest": true` in the body (e.g. with curl), so the row is marked `Source = Test`.
5. **Deploy to Vercel**: import the folder, add `NOTION_TOKEN` and
   `NOTION_PIPELINE_DATABASE_ID` as environment variables, deploy, then point
   kairosnyc.io (or a subdomain such as `request.kairosnyc.io`) at it.

## Built-in protections

- Server-side validation of every field and length limits.
- Honeypot field to drop simple bots silently.
- Per-IP rate limit (5 per 10 minutes, in memory).
- Notion token never reaches the browser (`server-only`).
- Pages are marked `noindex`.
- Notion errors are logged server-side; members see a friendly fallback with the email address.

## Known limits and next steps

- The rate limit is per server instance and resets on deploy. Add Upstash Redis if spam appears.
- No member login yet: anyone with the link can submit. Fine for a founding-member launch;
  add auth (e.g. Clerk or magic links) before showing members their request history.
- Notion's API allows about 3 requests/second, plenty for a form, not for real-time features.
- Next build steps: operator dashboard (approve drafts in-app), then member portal.
