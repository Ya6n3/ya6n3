import "server-only";
import type { IntakeRequest } from "./intake";

// Uses the Notion REST API directly (no SDK) to keep dependencies minimal.
// API version 2022-06-28 accepts a database_id parent, which works for
// single-source databases like Membership Requests.
const NOTION_VERSION = "2022-06-28";
const NOTION_URL = "https://api.notion.com/v1/pages";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

/** Notion caps each rich_text object at 2000 characters. Empty text clears the field. */
function richText(text: string) {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += 2000) {
    chunks.push({ type: "text", text: { content: text.slice(i, i + 2000) } });
  }
  return chunks;
}

/**
 * Creates one row in Membership Requests, exactly as the Notion
 * "Request a service" form does. The existing Zapier zaps then send the
 * alert email and copy the row into Agent Pipeline for Xenia to triage.
 * Returns the new page's id.
 */
export async function createMembershipRequest(req: IntakeRequest): Promise<string> {
  const body = {
    parent: { database_id: env("NOTION_MEMBERSHIP_DATABASE_ID") },
    properties: {
      // Name only: the zap copies this into Agent Pipeline's Name, and
      // Xenia's reply greets the member by it.
      "Full name": { title: richText(req.name) },
      Email: { email: req.email },
      Phone: { phone_number: req.phone ?? null },
      "Help first with": { multi_select: req.services.map((name) => ({ name })) },
      "Anything we should know": { rich_text: richText(req.details) },
      When: { rich_text: richText(req.when ?? "") },
      Budget: { rich_text: richText(req.budget ?? "") },
    },
  };

  const res = await fetch(NOTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("NOTION_TOKEN")}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    // Log the detail server-side only; never return it to the browser.
    const text = await res.text();
    console.error("Notion create failed", res.status, text.slice(0, 500));
    throw new Error(`Notion API error ${res.status}`);
  }

  const page = (await res.json()) as { id: string };
  return page.id;
}
