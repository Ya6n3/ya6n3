"use server";

import { redirect } from "next/navigation";
import { researchBacklog } from "@/lib/automations";
import { promoteToken } from "@/lib/notion-webhook";
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

/**
 * "Use this token" on /setup: makes the token the owner pasted into Notion the
 * webhook signing secret. The token comes from this authenticated form, never
 * from the open webhook endpoint, so nobody else can choose it.
 */
export async function useWebhookToken(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  if (!setupKeyMatches(key)) redirect("/setup");
  const token = String(formData.get("token") ?? "");
  if (token) await promoteToken(token);
  redirect(`/setup?key=${encodeURIComponent(key)}&saved=1`);
}
