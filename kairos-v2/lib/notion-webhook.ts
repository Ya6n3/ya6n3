import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "./store";

// Notion integration webhooks (https://developers.notion.com/reference/webhooks).
// Signature: X-Notion-Signature = "sha256=" + HMAC-SHA256(raw body, verification_token).

// The handshake endpoint is open to the internet, so a token it receives is only
// *pending*. It becomes the signing secret (TOKEN_KEY) when the owner promotes it
// from the authenticated /setup page, after Notion has accepted it.
const PENDING_TOKEN_KEY = "kairos:notion:pending-token";
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
 * the owner promoted on /setup, so setup works without editing environment
 * variables. A token that only arrived at the open endpoint never counts.
 */
export async function webhookSecret(): Promise<string | null> {
  return process.env.NOTION_WEBHOOK_SECRET || (await getStore().get(TOKEN_KEY));
}

/**
 * Remembers the token Notion posted during the handshake, for the owner to see on
 * /setup. Anyone can reach the endpoint, so this is not trusted: the latest one
 * wins (Notion re-sends when a subscription is recreated) and it is not a secret yet.
 */
export async function rememberPendingToken(token: string): Promise<void> {
  await getStore().set(PENDING_TOKEN_KEY, token, 60 * 60 * 24);
}

/** The token waiting on /setup to be pasted into Notion and then promoted. */
export async function pendingToken(): Promise<string | null> {
  return getStore().get(PENDING_TOKEN_KEY);
}

/** Makes `token` the signing secret (owner action from /setup) and clears the pending one. */
export async function promoteToken(token: string): Promise<void> {
  const store = getStore();
  await store.set(TOKEN_KEY, token, 60 * 60 * 24 * 3650);
  await store.del(PENDING_TOKEN_KEY);
}

/** True when events can be verified: an env secret or a promoted token exists. */
export async function webhookActive(): Promise<boolean> {
  return !!(await webhookSecret());
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
