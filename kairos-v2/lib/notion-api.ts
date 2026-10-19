import "server-only";

// Thin Notion REST client (no SDK, to keep dependencies minimal).
// API version 2022-06-28 addresses single-source databases by database_id.
export const NOTION_VERSION = "2022-06-28";
const BASE = "https://api.notion.com/v1";

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

/** Notion caps each rich_text object at 2000 characters. Empty text clears the field. */
export function richText(text: string) {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  for (let i = 0; i < text.length && chunks.length < 100; i += 2000) {
    chunks.push({ type: "text", text: { content: text.slice(i, i + 2000) } });
  }
  return chunks;
}

export async function notion<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${env("NOTION_TOKEN")}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Notion API error", init.method ?? "GET", path, res.status, text.slice(0, 500));
    throw new Error(`Notion API error ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Notion IDs appear with and without dashes; compare them normalised. */
export const sameId = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.replace(/-/g, "").toLowerCase() === b.replace(/-/g, "").toLowerCase();

// ---------- page + property shapes (only what we read) ----------

type RichText = { plain_text?: string; text?: { content?: string } }[];

export interface NotionProperty {
  type: string;
  title?: RichText;
  rich_text?: RichText;
  select?: { name: string } | null;
  status?: { name: string } | null;
  checkbox?: boolean;
  date?: { start: string; end?: string | null } | null;
  number?: number | null;
  created_time?: string;
}

export interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  archived?: boolean;
  in_trash?: boolean;
  parent: { type: string; database_id?: string; data_source_id?: string };
  properties: Record<string, NotionProperty>;
}

const plain = (rt?: RichText) => (rt ?? []).map((t) => t.plain_text ?? t.text?.content ?? "").join("");

export const prop = {
  text: (p?: NotionProperty) => (p ? plain(p.title ?? p.rich_text) : "").trim(),
  select: (p?: NotionProperty) => p?.select?.name ?? p?.status?.name ?? "",
  checkbox: (p?: NotionProperty) => p?.checkbox === true,
  date: (p?: NotionProperty) => p?.date?.start ?? "",
  number: (p?: NotionProperty) => p?.number ?? 0,
};

export async function getPage(id: string): Promise<NotionPage> {
  return notion<NotionPage>(`/pages/${id}`);
}

export async function updatePage(id: string, properties: Record<string, unknown>): Promise<void> {
  await notion(`/pages/${id}`, { method: "PATCH", body: { properties } });
}

/** Appends plain paragraphs to the bottom of a page (used as an audit log). */
export async function appendParagraphs(id: string, paragraphs: string[]): Promise<void> {
  const children = paragraphs
    .filter((p) => p.trim())
    .slice(0, 90)
    .map((p) => ({ object: "block", type: "paragraph", paragraph: { rich_text: richText(p) } }));
  if (children.length) await notion(`/blocks/${id}/children`, { method: "PATCH", body: { children } });
}

/** Returns every row matching `filter`, following pagination (capped for safety). */
export async function queryDatabase(databaseId: string, filter?: unknown, max = 500): Promise<NotionPage[]> {
  const rows: NotionPage[] = [];
  let cursor: string | undefined;
  do {
    const page = await notion<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }>(
      `/databases/${databaseId}/query`,
      { method: "POST", body: { page_size: 100, start_cursor: cursor, filter } },
    );
    rows.push(...page.results);
    cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined;
  } while (cursor && rows.length < max);
  return rows;
}
