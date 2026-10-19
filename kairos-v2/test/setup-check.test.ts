import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noteEventReceived, rememberVerificationToken } from "@/lib/notion-webhook";
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
  it("only opens with the exact CRON_SECRET", () => {
    expect(setupKeyMatches("cron-test")).toBe(true);
    expect(setupKeyMatches("cron-tes")).toBe(false);
    expect(setupKeyMatches(undefined)).toBe(false);
    setEnv({ CRON_SECRET: undefined });
    expect(setupKeyMatches("")).toBe(false);
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

    await rememberVerificationToken("secret_verify_me");
    expect((await byLabel()).c["Notion webhook"]).toMatchObject({ state: "waiting", copy: "secret_verify_me" });

    await noteEventReceived(new Date("2026-10-20T01:00:00Z"));
    expect((await byLabel()).c["Notion webhook"]).toMatchObject({ state: "ok", detail: expect.stringContaining("2026-10-20T01:00:00") });
  });

  it("lists the rows still waiting for research", async () => {
    routes({ rows: [page("row-1", { name: "Yasco" }), page("row-2", { name: "Done one", notes: "researched" })] });
    const { waiting } = await byLabel();
    expect(waiting?.map((i) => i.name)).toEqual(["Yasco"]);
  });
});
