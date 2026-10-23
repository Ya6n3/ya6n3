import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebhookToken } from "@/app/setup/actions";
import { noteEventReceived, pendingToken, promoteToken, rememberPendingToken, webhookSecret } from "@/lib/notion-webhook";
import { runSetupChecks, setupKeyMatches } from "@/lib/setup-check";
import { createMemoryStore, setStore } from "@/lib/store";
import { mockFetch, page, setEnv } from "./helpers";

const MEMBERSHIP_DB = "01ff09d1f0d54728a907b9ed953e393c";

beforeEach(() => {
  setEnv({ NOTION_MEMBERSHIP_DATABASE_ID: MEMBERSHIP_DB });
  setStore(createMemoryStore());
});
afterEach(() => vi.unstubAllGlobals());

/** Notion + Anthropic responses; override any of them per test. */
function routes(o: { membership?: number; pipeline?: number; anthropic?: number; rows?: unknown[] } = {}) {
  return mockFetch([
    [new RegExp(`GET .*/databases/${MEMBERSHIP_DB}$`), () => [o.membership ?? 200, { object: "database" }]],
    [/GET .*\/databases\/86d266e1/, () => [o.pipeline ?? 200, { object: "database" }]],
    [/POST .*\/databases\/86d266e1.*\/query/, () => [200, { results: o.rows ?? [], has_more: false, next_cursor: null }]],
    [/GET https:\/\/api\.anthropic\.com\/v1\/models/, () => [o.anthropic ?? 200, { data: [] }]],
  ]);
}
const byLabel = async () => {
  const r = await runSetupChecks();
  return { ...r, c: Object.fromEntries(r.checks.map((c) => [c.label, c])) };
};

describe("setupKeyMatches", () => {
  it("falls back to the exact CRON_SECRET when there is no SETUP_KEY", () => {
    expect(setupKeyMatches("cron-test")).toBe(true);
    expect(setupKeyMatches("cron-tes")).toBe(false);
    expect(setupKeyMatches(undefined)).toBe(false);
    setEnv({ CRON_SECRET: undefined });
    expect(setupKeyMatches("")).toBe(false);
  });

  it("uses SETUP_KEY on its own, so a leaked setup link is not the cron secret", () => {
    setEnv({ SETUP_KEY: "setup-test" });
    expect(setupKeyMatches("setup-test")).toBe(true);
    expect(setupKeyMatches("cron-test")).toBe(false);
  });
});

describe("useWebhookToken", () => {
  const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };

  it("promotes the token only for someone holding the setup key", async () => {
    await rememberPendingToken("secret_from_notion");

    await expect(useWebhookToken(form({ key: "wrong", token: "secret_from_notion" }))).rejects.toThrow();
    expect(await webhookSecret()).toBeNull();

    await expect(useWebhookToken(form({ key: "cron-test", token: "secret_from_notion" }))).rejects.toThrow(); // redirects back to /setup
    expect(await webhookSecret()).toBe("secret_from_notion");
    expect(await pendingToken()).toBeNull();
  });
});

describe("runSetupChecks", () => {
  it("says to connect Kairos backend when Agent Pipeline is not shared with it", async () => {
    routes({ pipeline: 404 });
    const { c, waiting } = await byLabel();
    expect(c["Membership Requests"].state).toBe("ok");
    expect(c["Agent Pipeline"]).toMatchObject({ state: "todo", detail: expect.stringContaining("Connections") });
    expect(waiting).toBeNull();
  });

  it("flags a missing or rejected Anthropic key", async () => {
    routes({ anthropic: 401 });
    expect((await byLabel()).c["Research (Claude)"]).toMatchObject({ state: "todo", detail: expect.stringContaining("rejects") });
    setEnv({ NOTION_MEMBERSHIP_DATABASE_ID: MEMBERSHIP_DB, ANTHROPIC_API_KEY: undefined });
    expect((await byLabel()).c["Research (Claude)"]).toMatchObject({ state: "todo", detail: expect.stringContaining("Add ANTHROPIC_API_KEY") });
  });

  it("walks the webhook from not created, to token received, to live", async () => {
    routes();
    expect((await byLabel()).c["Notion webhook"].state).toBe("todo");

    await rememberPendingToken("secret_verify_me");
    const received = await byLabel();
    expect(received.c["Notion webhook"]).toMatchObject({ state: "waiting", detail: expect.stringContaining("Use this token") });
    expect(received.pendingToken).toBe("secret_verify_me");

    await promoteToken("secret_verify_me");
    const saved = await byLabel();
    expect(saved.c["Notion webhook"]).toMatchObject({ state: "waiting", detail: expect.stringContaining("token is saved") });
    expect(saved.pendingToken).toBeNull();

    await noteEventReceived(new Date("2026-10-20T01:00:00Z"));
    expect((await byLabel()).c["Notion webhook"]).toMatchObject({ state: "ok", detail: expect.stringContaining("2026-10-20T01:00:00") });
  });

  it("lists the rows still waiting for research", async () => {
    routes({ rows: [page("row-1", { name: "Yasco" }), page("row-2", { name: "Done one", notes: "researched" })] });
    const { waiting } = await byLabel();
    expect(waiting?.map((i) => i.name)).toEqual(["Yasco"]);
  });
});
