// Checks the live Notion "Membership Requests" and "Agent Pipeline" schemas against what the app reads and writes.
// Runs only when NOTION_TOKEN is set (locally via `npm run check:notion`, or in CI
// when the NOTION_TOKEN repository secret exists). Read-only: it never writes.
import { describe, expect, it } from "vitest";
import { SERVICES } from "@/lib/intake";

const token = process.env.NOTION_TOKEN === "secret_test" ? undefined : process.env.NOTION_TOKEN;
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

// Agent Pipeline properties used by lib/pipeline.ts, approvals.ts, research.ts and digest.ts.
const pipelineId = process.env.NOTION_PIPELINE_DATABASE_ID ?? "86d266e140b74d43aa9783b874359bec";
const PIPELINE: Record<string, string> = {
  Name: "title",
  Contact: "rich_text",
  Stage: "select",
  Type: "select",
  Source: "select",
  Category: "select",
  Urgency: "select",
  Approved: "checkbox",
  "Do Not Contact": "checkbox",
  "Needs Human": "checkbox",
  "Draft Reply": "rich_text",
  Recap: "rich_text",
  "Request Details": "rich_text",
  "Research Notes": "rich_text",
  Options: "rich_text",
  "Next Follow-up": "date",
  "Last Agent Action": "date",
  "Follow-up Count": "number",
};

describe.skipIf(!token)("Notion Agent Pipeline schema", () => {
  it("has every property the automations use, and the Stage options they move between", async () => {
    const res = await fetch(`https://api.notion.com/v1/databases/${pipelineId}`, {
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
    });
    expect(res.status, "Is the Agent Pipeline shared with the integration?").toBe(200);
    const { properties } = (await res.json()) as {
      properties: Record<string, { type: string; select?: { options: { name: string }[] } }>;
    };
    for (const [name, type] of Object.entries(PIPELINE)) {
      expect(properties[name]?.type, `property "${name}"`).toBe(type);
    }
    const stages = properties.Stage.select!.options.map((o) => o.name);
    for (const s of ["New", "Triaged", "Contacted", "Accepted", "In Progress", "Done", "Closed Lost"]) {
      expect(stages, `Stage option "${s}"`).toContain(s);
    }
  });
});
