import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDaily } from "@/lib/automations";
import { buildDigest, buildSections } from "@/lib/digest";
import { toItem } from "@/lib/pipeline";
import { createMemoryStore, setStore } from "@/lib/store";
import { addDays, nyNow } from "@/lib/time";
import { mockFetch, page, setEnv } from "./helpers";

beforeEach(() => {
  setEnv();
  setStore(createMemoryStore());
});
afterEach(() => vi.unstubAllGlobals());

const mk = (id: string, p: Parameters<typeof page>[1]) => toItem(page(`${id}aaaaaaa-1111-2222-3333-444444444444`, p) as any);

describe("nyNow", () => {
  it("handles daylight saving: 12:30 UTC is 8:30 in October, 7:30 in January", () => {
    expect(nyNow(new Date("2026-10-19T12:30:00Z"))).toEqual({ date: "2026-10-19", hour: 8 });
    expect(nyNow(new Date("2027-01-15T12:30:00Z"))).toEqual({ date: "2027-01-15", hour: 7 });
    expect(nyNow(new Date("2027-01-15T13:30:00Z"))).toEqual({ date: "2027-01-15", hour: 8 });
    expect(nyNow(new Date("2026-10-20T02:00:00Z"))).toEqual({ date: "2026-10-19", hour: 22 });
  });
  it("adds days across month ends", () => expect(addDays("2026-10-31", 2)).toBe("2026-11-02"));
});

describe("digest", () => {
  const items = [
    mk("1", { name: "Ready", stage: "Triaged" }),
    mk("2", { name: "Failed send", stage: "Triaged", approved: true }),
    mk("3", { name: "No draft", stage: "New", draft: "" }),
    mk("4", { name: "Due", stage: "Contacted", followUp: "2026-10-19" }),
    mk("5", { name: "Waiting", stage: "Contacted", followUp: "2026-10-22" }),
    mk("6", { name: "Doing", stage: "In Progress" }),
    mk("7", { name: "Blocked", stage: "Triaged", dnc: true }),
  ];

  it("puts each row in the right section", () => {
    const s = Object.fromEntries(buildSections(items, "2026-10-19").map((x) => [x.title, x.items.map((i) => i.name)]));
    expect(s).toEqual({
      "Approved but not sent": ["Failed send"],
      "Ready to approve": ["Ready"],
      "No draft yet": ["No draft"],
      "Follow-ups due": ["Due"],
      "In progress": ["Doing"],
    });
  });

  it("summarises in the subject and escapes member text", () => {
    const d = buildDigest([...items, mk("8", { name: "<script>x</script>", stage: "Triaged" })], "2026-10-19");
    expect(d.subject).toBe("Kairos digest, Mon, Oct 19: 1 failed to send, 2 to approve, 1 follow-up due");
    expect(d.html).not.toContain("<script>");
    expect(d.html).toContain("&lt;script&gt;");
    expect(d.text).toContain("1 waiting on members");
  });

  it("says so when nothing is waiting", () => {
    const d = buildDigest([], "2026-10-19");
    expect(d.subject).toBe("Kairos digest, Mon, Oct 19: nothing waiting on you");
    expect(d.html).toContain("Nothing needs you today");
  });
});

describe("runDaily", () => {
  function routes(rows: unknown[]) {
    return mockFetch([
      [/^POST https:\/\/api\.notion\.com\/v1\/databases\/.+\/query$/, () => [200, { results: rows, has_more: false, next_cursor: null }]],
      [/^POST https:\/\/api\.resend\.com\/emails$/, () => [200, { id: "email_digest" }]],
      [/^PATCH https:\/\/api\.notion\.com\//, () => [200, {}]],
      [/^POST https:\/\/api\.anthropic\.com\//, () => [200, { stop_reason: "end_turn", content: [{ type: "text", text: "OPTIONS:\n1. X\n\nNOTES:\n- Y" }] }]],
    ]);
  }
  const digests = (calls: ReturnType<typeof routes>) =>
    calls.filter((c) => c.url.includes("resend") && c.body.to[0] === "owner@example.com");

  it("sends the digest once, in the 8am ET hour, from whichever cron lands there", async () => {
    const calls = routes([page("11111111-1111-2222-3333-444444444444", { notes: "done" })]);
    expect((await runDaily(new Date("2026-10-19T12:20:00Z"))).digest).toBe("sent"); // 8:20 EDT
    expect((await runDaily(new Date("2026-10-19T13:20:00Z"))).digest).toBe("not-due"); // 9:20 EDT
    expect(digests(calls)).toHaveLength(1);
    expect(digests(calls)[0].headers["idempotency-key"]).toBe("kairos-digest-2026-10-19");

    expect((await runDaily(new Date("2027-01-15T12:20:00Z"))).digest).toBe("not-due"); // 7:20 EST
    expect((await runDaily(new Date("2027-01-15T13:20:00Z"))).digest).toBe("sent"); // 8:20 EST
  });

  it("does not double-send if the same cron fires twice", async () => {
    const calls = routes([]);
    await runDaily(new Date("2026-10-19T12:05:00Z"));
    expect((await runDaily(new Date("2026-10-19T12:50:00Z"))).digest).toBe("already-sent-today");
    expect(digests(calls)).toHaveLength(1);
  });

  it("frees the digest slot when the send fails, so the next run can try again", async () => {
    let resendStatus = 500;
    const calls = mockFetch([
      [/^POST https:\/\/api\.notion\.com\/v1\/databases\/.+\/query$/, () => [200, { results: [], has_more: false, next_cursor: null }]],
      [/^POST https:\/\/api\.resend\.com\/emails$/, () => [resendStatus, { id: "email_digest" }]],
    ]);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runDaily(new Date("2026-10-19T12:05:00Z"))).rejects.toThrow("Resend error 500");
    resendStatus = 200;
    // Not "already-sent-today": nothing went out the first time.
    expect((await runDaily(new Date("2026-10-19T12:50:00Z"))).digest).toBe("sent");
    expect(calls.filter((c) => c.url.includes("resend"))).toHaveLength(2);
  });

  it("sweeps up approved rows a webhook missed, and researches the backlog", async () => {
    const calls = routes([
      page("22222222-1111-2222-3333-444444444444", { approved: true }),
      page("33333333-1111-2222-3333-444444444444", { stage: "Contacted", notes: "" }),
    ]);
    const r = await runDaily(new Date("2026-10-19T18:00:00Z"));
    expect(r.sends).toEqual([{ id: "22222222-1111-2222-3333-444444444444", status: "sent", emailId: "email_digest" }]);
    expect(r.research.map((x) => x.status)).toEqual(["done", "done"]);
    expect(r.digest).toBe("not-due");
    expect(calls.filter((c) => c.url.includes("anthropic"))).toHaveLength(2);
  });

  it("only queries open stages and skips test rows", async () => {
    const calls = routes([page("44444444-1111-2222-3333-444444444444", { source: "Test", approved: true })]);
    const r = await runDaily(new Date("2026-10-19T18:00:00Z"));
    expect(r.open).toBe(0);
    const q = calls.find((c) => c.url.endsWith("/query"))!;
    expect(q.body.filter.or.map((f: any) => f.select.equals)).toEqual(["New", "Triaged", "Contacted", "Accepted", "In Progress"]);
  });
});
