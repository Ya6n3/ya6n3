import { vi } from "vitest";

export const PIPELINE_DB = "86d266e1-40b7-4d43-aa97-83b874359bec";

type Props = Partial<{
  name: string;
  contact: string;
  stage: string;
  type: string;
  source: string;
  category: string;
  urgency: string;
  approved: boolean;
  dnc: boolean;
  needsHuman: boolean;
  draft: string;
  recap: string;
  details: string;
  notes: string;
  options: string;
  followUp: string;
}>;

const rt = (s = "") => (s ? [{ plain_text: s }] : []);
const sel = (s?: string) => (s ? { name: s } : null);

/** A Notion page as returned by GET /v1/pages (API 2022-06-28). */
export function page(id: string, p: Props = {}, created = "2026-10-18T15:00:00.000Z") {
  return {
    object: "page",
    id,
    url: `https://www.notion.so/${id.replace(/-/g, "")}`,
    created_time: created,
    archived: false,
    in_trash: false,
    parent: { type: "database_id", database_id: PIPELINE_DB },
    properties: {
      Name: { type: "title", title: rt(p.name ?? "Ada") },
      Contact: { type: "rich_text", rich_text: rt(p.contact ?? "ada@example.com") },
      Stage: { type: "select", select: sel(p.stage ?? "Triaged") },
      Type: { type: "select", select: sel(p.type ?? "Client Request") },
      Source: { type: "select", select: sel(p.source ?? "Form") },
      Category: { type: "select", select: sel(p.category ?? "Dining") },
      Urgency: { type: "select", select: sel(p.urgency ?? "Normal") },
      Approved: { type: "checkbox", checkbox: p.approved ?? false },
      "Do Not Contact": { type: "checkbox", checkbox: p.dnc ?? false },
      "Needs Human": { type: "checkbox", checkbox: p.needsHuman ?? false },
      "Draft Reply": { type: "rich_text", rich_text: rt(p.draft ?? "Hello Ada,\n\nThanks for reaching out.") },
      Recap: { type: "rich_text", rich_text: rt(p.recap ?? "Dinner for two, West Village, Friday 8pm") },
      "Request Details": { type: "rich_text", rich_text: rt(p.details ?? "Need: quiet dinner for two") },
      "Research Notes": { type: "rich_text", rich_text: rt(p.notes) },
      Options: { type: "rich_text", rich_text: rt(p.options) },
      "Next Follow-up": { type: "date", date: p.followUp ? { start: p.followUp } : null },
      "Follow-up Count": { type: "number", number: null },
    },
  };
}

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
}

/**
 * Replaces global fetch with a router. Each handler gets the parsed call and
 * returns [status, json]. Unmatched URLs fail the test loudly.
 */
export function mockFetch(routes: [RegExp, (c: Call) => [number, unknown]][]) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: any, init: any = {}) => {
    const url = String(input);
    const call: Call = {
      url,
      method: init.method ?? "GET",
      headers: Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), String(v)])),
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const route = routes.find(([re]) => re.test(`${call.method} ${url}`));
    if (!route) throw new Error(`Unexpected fetch: ${call.method} ${url}`);
    const [status, json] = route[1](call);
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

export const BASE_ENV = {
  NOTION_TOKEN: "secret_test",
  RESEND_API_KEY: "re_test",
  MAIL_FROM: "Kairos Concierge <concierge@example.com>",
  MAIL_REPLY_TO: "replies@example.com",
  ANTHROPIC_API_KEY: "sk-ant-test",
  DIGEST_TO: "owner@example.com",
  CRON_SECRET: "cron-test",
};

export function setEnv(extra: Record<string, string | undefined> = {}) {
  for (const k of [
    "UPSTASH_REDIS_REST_URL",
    "KV_REST_API_URL",
    "NOTION_WEBHOOK_SECRET",
    "MAIL_BCC",
    "MAIL_SUBJECT",
    "RESEARCH_DAILY_LIMIT",
  ])
    delete process.env[k];
  Object.assign(process.env, BASE_ENV);
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
