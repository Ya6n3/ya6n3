import { describe, expect, it } from "vitest";
import { clientIp, createMemoryLimiter } from "@/lib/rate-limit";

describe("createMemoryLimiter", () => {
  it("allows up to the limit, then blocks, then recovers after the window", async () => {
    let t = 0;
    const limiter = createMemoryLimiter(2, 1000, () => t);
    expect(await limiter.isLimited("a")).toBe(false);
    expect(await limiter.isLimited("a")).toBe(false);
    expect(await limiter.isLimited("a")).toBe(true);
    expect(await limiter.isLimited("b")).toBe(false); // keys are independent
    t = 1500;
    expect(await limiter.isLimited("a")).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe(
      "1.1.1.1",
    );
    expect(clientIp(new Headers({ "x-forwarded-for": " 3.3.3.3, 4.4.4.4" }))).toBe("3.3.3.3");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
