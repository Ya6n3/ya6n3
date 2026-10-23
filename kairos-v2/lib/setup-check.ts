import "server-only";
import { timingSafeEqual } from "node:crypto";
import { mailConfigured } from "./mailer";
import { notion, NotionError } from "./notion-api";
import { lastEventReceived, pendingToken, webhookActive } from "./notion-webhook";
import { listOpenItems, pipelineDatabaseId, type PipelineItem } from "./pipeline";
import { researchBlocker } from "./research";
import { getStore } from "./store";

// Powers /setup: a private page that says, in plain words, which part of the
// automations is not set up yet. It never shows secrets except the pending Notion
// verification token, which the owner has to paste into Notion anyway.

/**
 * The key that unlocks /setup: SETUP_KEY, or CRON_SECRET if SETUP_KEY is not set.
 * Prefer a separate SETUP_KEY: the key travels in the URL, so keeping it apart
 * from CRON_SECRET means a leaked setup link cannot call the cron routes.
 */
const setupKey = () => process.env.SETUP_KEY || process.env.CRON_SECRET;

/** True when `given` is the setup key. The setup page is locked without it. */
export function setupKeyMatches(given: string | null | undefined): boolean {
  const secret = setupKey();
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type CheckState = "ok" | "todo" | "waiting";

export interface Check {
  label: string;
  state: CheckState;
  detail: string;
  /** Shown to the owner on the page, e.g. the token to paste into Notion. */
  copy?: string;
}

async function databaseCheck(label: string, id: string | undefined, connectHint: string): Promise<Check> {
  if (!process.env.NOTION_TOKEN) return { label, state: "todo", detail: "Add NOTION_TOKEN (the Kairos backend secret) in Vercel." };
  if (!id) return { label, state: "todo", detail: "The database ID is missing in Vercel." };
  try {
    await notion(`/databases/${id}`);
    return { label, state: "ok", detail: "Kairos backend can read it." };
  } catch (err) {
    const status = err instanceof NotionError ? err.status : 0;
    if (status === 404) return { label, state: "todo", detail: connectHint };
    if (status === 401) return { label, state: "todo", detail: "NOTION_TOKEN in Vercel is invalid or was revoked." };
    return { label, state: "todo", detail: `Notion answered ${status || "with an error"}; try again in a minute.` };
  }
}

async function anthropicCheck(): Promise<Check> {
  const label = "Research (Claude)";
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { label, state: "todo", detail: "Add ANTHROPIC_API_KEY in Vercel (console.anthropic.com → API keys), then redeploy." };
  const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { label, state: "waiting", detail: "Couldn't reach Anthropic; try again in a minute." };
  if (res.status === 401 || res.status === 403) return { label, state: "todo", detail: "ANTHROPIC_API_KEY is set but Anthropic rejects it. Create a new key and replace it." };
  if (!res.ok) return { label, state: "waiting", detail: `Anthropic answered ${res.status}; try again in a minute.` };
  return { label, state: "ok", detail: "The API key works." };
}

async function webhookCheck(shared: boolean, pending: string | null): Promise<Check> {
  const label = "Notion webhook";
  const last = await lastEventReceived();
  if (last) return { label, state: "ok", detail: `Last event from Notion: ${last}.` };
  if (process.env.NOTION_WEBHOOK_SECRET)
    return { label, state: "waiting", detail: "The secret is set, but no event has arrived yet. Edit any Agent Pipeline row to test." };
  if (await webhookActive())
    return { label, state: "waiting", detail: "The token is saved, but no event has arrived yet. Edit any Agent Pipeline row to test." };
  if (pending)
    return {
      label,
      state: "waiting",
      detail: "Notion sent its token (shown below). Paste it into Notion's Verify dialog, and once Notion says it is verified, press “Use this token”.",
    };
  return {
    label,
    state: "todo",
    detail:
      (shared ? "" : "Connect Upstash Redis first (see below), or the token Notion sends can be lost. ") +
      "In Notion: notion.so/profile/integrations → Kairos backend → Webhooks → Create subscription, with this site's /api/notion/webhook address and the events page.created and page.properties_updated. Then reload this page.",
  };
}

export interface SetupReport {
  checks: Check[];
  /** The token Notion last posted to the webhook, waiting to be pasted into Notion and promoted. */
  pendingToken: string | null;
  /** Agent Pipeline rows that are waiting for research, when the pipeline is readable. */
  waiting: PipelineItem[] | null;
}

export async function runSetupChecks(): Promise<SetupReport> {
  const shared = getStore().shared;
  const [intake, pipeline, research] = await Promise.all([
    databaseCheck(
      "Membership Requests",
      process.env.NOTION_MEMBERSHIP_DATABASE_ID,
      "Kairos backend can't see it. In Notion open Membership Requests → ••• → Connections → add Kairos backend.",
    ),
    databaseCheck(
      "Agent Pipeline",
      pipelineDatabaseId(),
      "Kairos backend can't see it. In Notion open Agent Pipeline → ••• → Connections → add Kairos backend. Also turn on Read, Update and Insert content for it at notion.so/profile/integrations.",
    ),
    anthropicCheck(),
  ]);
  const pending = await pendingToken();
  const webhook = await webhookCheck(shared, pending);

  const checks: Check[] = [
    intake,
    pipeline,
    research,
    webhook,
    {
      label: "Shared memory (Upstash Redis)",
      state: shared ? "ok" : "todo",
      detail: shared
        ? "Connected."
        : "In Vercel → Storage → add Upstash Redis (free) and connect it to this project, then redeploy.",
    },
    {
      label: "Daily safety net (cron)",
      state: process.env.CRON_SECRET ? "ok" : "todo",
      detail: process.env.CRON_SECRET
        ? "CRON_SECRET is set, so the 12:00 and 13:00 UTC runs pick up anything the webhook missed."
        : "Add CRON_SECRET (any long random text) in Vercel, then redeploy. Without it the daily runs are refused.",
    },
    {
      label: "Sending email (Resend)",
      state: mailConfigured() && process.env.MAIL_REPLY_TO ? "ok" : "todo",
      detail:
        mailConfigured() && process.env.MAIL_REPLY_TO
          ? "Approved replies will be sent."
          : "Needs a verified domain in Resend, then RESEND_API_KEY, MAIL_FROM and MAIL_REPLY_TO in Vercel. Until then, ticking Approved sends nothing.",
    },
    {
      label: "Daily digest",
      state: mailConfigured() && process.env.DIGEST_TO ? "ok" : "todo",
      detail: mailConfigured() && process.env.DIGEST_TO ? `Goes to ${process.env.DIGEST_TO} around 8am New York time.` : "Needs email set up, plus DIGEST_TO in Vercel.",
    },
  ];

  let waiting: PipelineItem[] | null = null;
  if (pipeline.state === "ok") {
    waiting = (await listOpenItems().catch(() => null))?.filter((i) => !researchBlocker(i)) ?? null;
  }
  return { checks, pendingToken: pending, waiting };
}
