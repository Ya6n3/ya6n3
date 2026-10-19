import { describe, expect, it } from "vitest";
import { parseIntake } from "@/lib/intake";

const valid = {
  name: "  Ada Lovelace ",
  email: "Ada@Example.com",
  details: "Dinner for four on Friday, somewhere quiet.",
};

describe("parseIntake", () => {
  it("accepts a minimal valid request and normalises it", () => {
    const r = parseIntake(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      services: [],
      phone: undefined,
      when: undefined,
      budget: undefined,
      isTest: false,
    });
  });

  it("accepts one service as a string and dedupes arrays", () => {
    const one = parseIntake({ ...valid, services: "Travel" });
    const many = parseIntake({ ...valid, services: ["Tables", "Tables", "Home"] });
    expect(one.ok && one.data.services).toEqual(["Travel"]);
    expect(many.ok && many.data.services).toEqual(["Tables", "Home"]);
  });

  it("rejects services that are not in the Notion option list", () => {
    const r = parseIntake({ ...valid, services: ["Yachts"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Choose a service from the list.");
  });

  it.each([
    [{ name: "" }, "Name is required."],
    [{ name: "x".repeat(121) }, "Name is too long."],
    [{ email: "not-an-email" }, "A valid email is required."],
    [{ phone: "1".repeat(41) }, "Phone is too long."],
    [{ details: "short" }, "Tell us a bit more about the request."],
    [{ details: "x".repeat(4001) }, "Request details are too long."],
    [{ when: "x".repeat(201) }, "When is too long."],
    [{ budget: "x".repeat(101) }, "Budget is too long."],
  ])("rejects %o", (override, message) => {
    const r = parseIntake({ ...valid, ...override });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain(message);
  });

  it("ignores non-string values instead of crashing", () => {
    const r = parseIntake({ name: 42, email: {}, details: null });
    expect(r.ok).toBe(false);
    expect(parseIntake(null).ok).toBe(false);
  });

  it("only treats isTest as true when it is the boolean true", () => {
    const a = parseIntake({ ...valid, isTest: "true" });
    const b = parseIntake({ ...valid, isTest: true });
    expect(a.ok && a.data.isTest).toBe(false);
    expect(b.ok && b.data.isTest).toBe(true);
  });
});
