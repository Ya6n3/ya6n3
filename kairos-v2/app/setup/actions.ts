"use server";

import { redirect } from "next/navigation";
import { researchBacklog } from "@/lib/automations";
import { listOpenItems } from "@/lib/pipeline";
import { setupKeyMatches } from "@/lib/setup-check";

/** "Research them now" on /setup: runs the same research the webhook and cron run. */
export async function researchNow(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  if (!setupKeyMatches(key)) redirect("/setup");
  const results = await researchBacklog(await listOpenItems());
  const done = results.filter((r) => r.status === "done").length;
  const failed = results.length - done;
  redirect(`/setup?key=${encodeURIComponent(key)}&done=${done}&failed=${failed}`);
}
