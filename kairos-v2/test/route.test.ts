import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMembershipRequest } = vi.hoisted(() => ({
  createMembershipRequest: vi.fn(async (..._args: unknown[]) => "page-id"),
}));
vi.mock("@/lib/notion", () => ({ createMembershipRequest }));

// Fresh module (and fresh in-memory limiter) for every test.
async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/requests/route");
}

let ipCounter = 0;
function post(body: unknown, ip = `10.0.0.${++ipCounter}`) {
  return new Request("http://localhost/api/requests", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = { name: "Ada", email: "ada@example.com", details: "A table for two tonight." };

beforeEach(() => {
  createMembershipRequest.mockClear();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.KV_REST_API_URL;
  delete process.env.ALLOW_TEST_SUBMISSIONS;
});

describe("POST /api/requests", () => {
  it("writes a valid request to Notion", async () => {
    const { POST } = await loadRoute();
    const res = await POST(post(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: "page-id" });
    expect(createMembershipRequest).toHaveBeenCalledOnce();
  });

  it("returns 422 with errors for invalid input", async () => {
    const { POST } = await loadRoute();
    const res = await POST(post({ name: "" }));
    expect(res.status).toBe(422);
    expect(createMembershipRequest).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-JSON body", async () => {
    const { POST } = await loadRoute();
    expect((await POST(post("not json"))).status).toBe(400);
  });

  it("silently drops honeypot submissions", async () => {
    const { POST } = await loadRoute();
    const res = await POST(post({ ...valid, company_website: "spam.example" }));
    expect(await res.json()).toEqual({ ok: true });
    expect(createMembershipRequest).not.toHaveBeenCalled();
  });

  it("writes isTest submissions unless test mode is enabled", async () => {
    const { POST } = await loadRoute();
    await POST(post({ ...valid, isTest: true }));
    expect(createMembershipRequest).toHaveBeenCalledOnce();

    process.env.ALLOW_TEST_SUBMISSIONS = "true";
    createMembershipRequest.mockClear();
    const res = await POST(post({ ...valid, isTest: true }));
    expect(await res.json()).toEqual({ ok: true, id: "test" });
    expect(createMembershipRequest).not.toHaveBeenCalled();
  });

  it("rate-limits the 6th request from one IP within the window", async () => {
    const { POST } = await loadRoute();
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await POST(post(valid, "9.9.9.9"))).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(createMembershipRequest).toHaveBeenCalledTimes(5);
  });

  it("returns 502 with a friendly message when Notion fails", async () => {
    const { POST } = await loadRoute();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createMembershipRequest.mockRejectedValueOnce(new Error("Notion API error 500"));
    const res = await POST(post(valid));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("Notion API");
    spy.mockRestore();
  });
});
