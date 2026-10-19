import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendApprovedReply, sendBlocker } from "@/lib/approvals";
import { contactEmail, toItem } from "@/lib/pipeline";
import { createMemoryStore, setStore } from "@/lib/store";
import { mockFetch, page, setEnv } from "./helpers";

const ID = "aaaaaaaa-1111-2222-3333-444444444444";
const AT = new Date("2026-10-19T16:30:00Z"); // Mon 12:30pm ET

beforeEach(() => {
  setEnv();
  setStore(createMemoryStore());
});
afterEach(() => vi.unstubAllGlobals());

describe("sendBlocker", () => {
  const item = (p: Parameters<typeof page>[1]) => toItem(page(ID, { approved: true, ...p }) as any);

  it("allows an approved, triaged row with a draft and an email", () => {
    expect(sendBlocker(item({}))).toBeNull();
  });

  it.each([
    [{ approved: false }, "not-approved"],
    [{ dnc: true }, "do-not-contact"],
    [{ source: "Test" }, "test-row"],
    [{ stage: "Contacted" }, "already-past-first-reply"],
    [{ stage: "Done" }, "already-past-first-reply"],
    [{ draft: "   " }, "empty-draft"],
    [{ contact: "646-555-0100" }, "no-email-in-contact"],
  ])("blocks %o", (p, reason) => {
    expect(sendBlocker(item(p))).toBe(reason);
  });

  it("finds the email inside a mixed Contact field", () => {
    expect(contactEmail({ contact: "Ada L. — Ada@Example.com, 646-555-0100" })).toBe("ada@example.com");
  });
});

describe("sendApprovedReply", () => {
  function routes(resendStatus = 200) {
    return mockFetch([
      [/^POST https:\/\/api\.resend\.com\/emails$/, () => (resendStatus === 200 ? [200, { id: "email_123" }] : [resendStatus, { message: "boom" }])],
      [/^PATCH https:\/\/api\.notion\.com\/v1\/pages\//, () => [200, {}]],
      [/^PATCH https:\/\/api\.notion\.com\/v1\/blocks\/.+\/children$/, () => [200, {}]],
    ]);
  }

  it("emails the draft, moves Stage to Contacted and logs the exact text", async () => {
    const calls = routes();
    const item = toItem(page(ID, { approved: true }) as any);
    expect(await sendApprovedReply(item, AT)).toEqual({ status: "sent", emailId: "email_123" });

    const email = calls.find((c) => c.url.includes("resend"))!;
    expect(email.body).toMatchObject({
      from: "Kairos Concierge <concierge@example.com>",
      to: ["ada@example.com"],
      subject: "Your Kairos request",
      text: "Hello Ada,\n\nThanks for reaching out.",
      reply_to: "replies@example.com",
    });
    expect(email.body.html).toContain("Hello Ada,<br><br>Thanks");
    expect(email.headers["idempotency-key"]).toBe(`kairos-reply-${ID}`);

    const update = calls.find((c) => c.method === "PATCH" && c.url.endsWith(`/pages/${ID}`))!;
    expect(update.body.properties).toEqual({
      Stage: { select: { name: "Contacted" } },
      "Last Agent Action": { date: { start: AT.toISOString() } },
      "Next Follow-up": { date: { start: "2026-10-21" } },
    });
    const log = calls.find((c) => c.url.endsWith("/children"))!;
    expect(JSON.stringify(log.body)).toContain("Exact text sent");
  });

  it("never sends the same row twice", async () => {
    const calls = routes();
    const item = toItem(page(ID, { approved: true }) as any);
    await sendApprovedReply(item, AT);
    expect(await sendApprovedReply(item, AT)).toEqual({ status: "skipped", reason: "already-sent-or-in-progress" });
    expect(calls.filter((c) => c.url.includes("resend"))).toHaveLength(1);
  });

  it("does nothing for an unapproved row", async () => {
    const calls = routes();
    expect(await sendApprovedReply(toItem(page(ID) as any), AT)).toEqual({ status: "skipped", reason: "not-approved" });
    expect(calls).toHaveLength(0);
  });

  it("skips quietly when email isn't configured yet", async () => {
    setEnv({ RESEND_API_KEY: undefined });
    const calls = routes();
    const r = await sendApprovedReply(toItem(page(ID, { approved: true }) as any), AT);
    expect(r).toEqual({ status: "skipped", reason: "email-not-configured" });
    expect(calls).toHaveLength(0);
  });

  it("on a send failure, leaves Stage alone, notes it on the page and allows a retry", async () => {
    const calls = routes(500);
    const item = toItem(page(ID, { approved: true }) as any);
    expect(await sendApprovedReply(item, AT)).toMatchObject({ status: "failed" });
    expect(calls.some((c) => c.url.endsWith(`/pages/${ID}`))).toBe(false);
    expect(JSON.stringify(calls.find((c) => c.url.endsWith("/children"))!.body)).toContain("could not send");

    routes(200);
    expect(await sendApprovedReply(item, AT)).toMatchObject({ status: "sent" });
  });
});
