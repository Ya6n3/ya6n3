import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore, setStore } from "@/lib/store";
import { setEnv } from "./helpers";

const { processPage, runDaily, pending } = vi.hoisted(() => ({
  processPage: vi.fn(async (..._a: unknown[]) => ({ send: { status: "skipped", reason: "not-approved" } })),
  runDaily: vi.fn(async (..._a: unknown[]) => ({ open: 0, sends: [], research: [], digest: "not-due" })),
  pending: [] as Promise<unknown>[],
}));
vi.mock("@/lib/automations", () => ({ processPage, runDaily }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => Promise<unknown>) => pending.push(fn()),
}));

import { sign } from "@/lib/notion-webhook";

async function webhook() {
  vi.resetModules();
  return (await import("@/app/api/notion/webhook/route")).POST;
}
const post = (body: unknown, sig?: string) =>
  new Request("http://localhost/api/notion/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...(sig ? { "x-notion-signature": sig } : {}) },
    body: JSON.stringify(body),
  });

const EVENT = { id: "evt", type: "page.properties_updated", entity: { id: "page-1", type: "page" }, data: {} };

beforeEach(() => {
  setEnv();
  setStore(createMemoryStore());
  processPage.mockClear();
  runDaily.mockClear();
  pending.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/notion/webhook", () => {
  it("completes the verification handshake and then accepts events signed with that token", async () => {
    const POST = await webhook();
    expect((await POST(post({ verification_token: "secret_abc" }))).status).toBe(200);

    const signed = post(EVENT, sign(JSON.stringify(EVENT), "secret_abc"));
    expect((await POST(signed)).status).toBe(200);
    await Promise.all(pending);
    expect(processPage).toHaveBeenCalledWith("page-1");
    // The route was imported after a module reset, so read its copy of the store.
    const { lastEventReceived } = await import("@/lib/notion-webhook");
    expect(await lastEventReceived()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not let a second handshake replace the stored token", async () => {
    const POST = await webhook();
    await POST(post({ verification_token: "secret_real" }));
    await POST(post({ verification_token: "secret_attacker" }));
    expect((await POST(post(EVENT, sign(JSON.stringify(EVENT), "secret_attacker")))).status).toBe(401);
  });

  it("rejects unsigned or badly signed events", async () => {
    setEnv({ NOTION_WEBHOOK_SECRET: "secret_env" });
    const POST = await webhook();
    expect((await POST(post(EVENT))).status).toBe(401);
    expect((await POST(post(EVENT, sign(JSON.stringify(EVENT), "wrong")))).status).toBe(401);
    expect(processPage).not.toHaveBeenCalled();
  });

  it("returns 503 before setup so Notion retries later", async () => {
    const POST = await webhook();
    expect((await POST(post(EVENT, "sha256=00"))).status).toBe(503);
  });

  it("ignores event types it doesn't handle", async () => {
    setEnv({ NOTION_WEBHOOK_SECRET: "s" });
    const POST = await webhook();
    const ev = { ...EVENT, type: "comment.created" };
    expect((await POST(post(ev, sign(JSON.stringify(ev), "s")))).status).toBe(200);
    expect(processPage).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/daily-*", () => {
  const get = (auth?: string, q = "") =>
    new Request(`http://localhost/api/cron/daily-12utc${q}`, { headers: auth ? { authorization: auth } : {} });

  it("requires Vercel's cron secret", async () => {
    const { GET } = await import("@/app/api/cron/daily-12utc/route");
    expect((await GET(get())).status).toBe(401);
    expect((await GET(get("Bearer nope"))).status).toBe(401);
    expect((await GET(get("Bearer cron-test"))).status).toBe(200);
    expect(runDaily).toHaveBeenCalledTimes(1);
  });

  it("refuses to run if CRON_SECRET is missing", async () => {
    setEnv({ CRON_SECRET: undefined });
    const { GET } = await import("@/app/api/cron/daily-13utc/route");
    expect((await GET(get("Bearer undefined"))).status).toBe(503);
  });

  it("can force today's digest for a manual test", async () => {
    const { GET } = await import("@/app/api/cron/daily-12utc/route");
    await GET(get("Bearer cron-test", "?digest=now"));
    expect(runDaily.mock.calls[0][1]).toEqual({ forceDigest: true });
  });
});
