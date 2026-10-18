import "server-only";
import type { IntakeRequest } from "./pipeline";

// Uses the Notion REST API directly (no SDK) to keep dependencies minimal.
// API version 2022-06-28 accepts a database_id parent, which works for
// single-source databases like the Agent Pipeline.
const NOTION_VERSION = "2022-06-28";
const NOTION_URL = "https://api.notion.com/v1/pages";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

/** Notion caps each rich_text object at 2000 characters. */
function richText(text: string) {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += 2000) {
    chunks.push({ type: "text", text: { content: text.slice(i, i + 2000) } });
  }
  return chunks.length ? chunks : [{ type: "text" as const, text: { content: "" } }];
}

/** Creates one row in the Agent Pipeline. Returns the new page's id. */
export async function createPipelineRow(req: IntakeRequest): Promise<string> {
  const details = [req.details, req.phone ? `\nPhone: ${req.phone}` : ""].join("");

  const body = {
    parent: { database_id: env("NOTION_PIPELINE_DATABASE_ID") },
    properties: {
      Name: { title: richText(`${req.category} — ${req.name}`) },
      Type: { select: { name: "Client Request" } },
      Stage: { select: { name: "New" } },
      Source: { select: { name: req.isTest ? "Test" : "Form" } },
      Category: { select: { name: req.category } },
      Urgency: { select: { name: req.urgency } },
      // Contact holds the email so the Zapier Gmail step can use it as "To".
      Contact: { rich_text: richText(req.email) },
      "Request Details": { rich_text: richText(details) },
      // Urgent requests get flagged for a human straight away.
      "Needs Human": { checkbox: req.urgency === "Urgent" },
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
