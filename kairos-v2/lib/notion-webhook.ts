import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "./store";

// Notion integration webhooks (https://developers.notion.com/reference/webhooks).
// Signature: X-Notion-Signature = "sha256=" + HMAC-SHA256(raw body, verification_token).

const TOKEN_KEY = "kairos:notion:verification-token";
const LAST_EVENT_KEY = "kairos:notion:last-event";

export function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function signatureMatches(body: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(header.trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * The secret is NOTION_WEBHOOK_SECRET if set; otherwise the verification token
 * Notion sent us during setup (stored once, never overwritten), so setup works
 * without editing environment variables.
 */
export async function webhookSecret(): Promise<string | null> {
  return process.env.NOTION_WEBHOOK_SECRET || (await getStore().get(TOKEN_KEY));
}

/** Stores the one-time verification token. Returns false if one is already stored. */
export async function rememberVerificationToken(token: string): Promise<boolean> {
  return getStore().setOnce(TOKEN_KEY, token, 60 * 60 * 24 * 3650);
}

/** Reads the stored verification token (shown on /setup so it can be pasted into Notion). */
export async function storedVerificationToken(): Promise<string | null> {
  return getStore().get(TOKEN_KEY);
}

/** Records when a signed event last arrived, so /setup can show the webhook is live. */
export async function noteEventReceived(at: Date = new Date()): Promise<void> {
  await getStore().set(LAST_EVENT_KEY, at.toISOString(), 60 * 60 * 24 * 30);
}

export async function lastEventReceived(): Promise<string | null> {
  return getStore().get(LAST_EVENT_KEY);
}

export interface NotionEvent {
  id: string;
  type: string;
  entity?: { id: string; type: string };
}

/** Page events that can change what Kairos should do with a row. */
export const HANDLED_EVENTS = new Set(["page.created", "page.properties_updated", "page.undeleted"]);
