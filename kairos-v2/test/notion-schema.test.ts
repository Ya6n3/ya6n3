// Checks the live Notion "Membership Requests" schema against what the app writes.
// Runs only when NOTION_TOKEN is set (locally via `npm run check:notion`, or in CI
// when the NOTION_TOKEN repository secret exists). Read-only: it never writes.
import { describe, expect, it } from "vitest";
import { SERVICES } from "@/lib/intake";

const token = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_MEMBERSHIP_DATABASE_ID ?? "01ff09d1f0d54728a907b9ed953e393c";

// Property name → Notion type, matching the payload in lib/notion.ts.
const EXPECTED: Record<string, string> = {
  "Full name": "title",
  Email: "email",
  Phone: "phone_number",
  "Help first with": "multi_select",
  "Anything we should know": "rich_text",
  When: "rich_text",
  Budget: "rich_text",
};

type Prop = { type: string; multi_select?: { options: { name: string }[] } };

describe.skipIf(!token)("Notion Membership Requests schema", () => {
  it("has every property the app writes, with matching types and service options", async () => {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
    });
    expect(res.status, "Is the database shared with the integration?").toBe(200);
    const { properties } = (await res.json()) as { properties: Record<string, Prop> };

    for (const [name, type] of Object.entries(EXPECTED)) {
      expect(properties[name]?.type, `property "${name}"`).toBe(type);
    }
    const options = properties["Help first with"].multi_select!.options.map((o) => o.name);
    const missing = SERVICES.filter((s) => !options.includes(s));
    expect(missing, "services in lib/intake.ts missing from Notion").toEqual([]);
  });
});
