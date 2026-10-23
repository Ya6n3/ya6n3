import "server-only";
import { sendApprovedReply, type SendResult } from "./approvals";
import { buildDigest } from "./digest";
import { mailConfigured, sendEmail } from "./mailer";
import { getPage } from "./notion-api";
import { isPipelinePage, listOpenItems, toItem, type PipelineItem } from "./pipeline";
import { researchBlocker, researchItem, type ResearchResult } from "./research";
import { getStore } from "./store";
import { nyNow } from "./time";

/** Handles one changed Notion page: send it if approved, research it if new. */
export async function processPage(pageId: string): Promise<{ send?: SendResult; research?: ResearchResult; ignored?: string }> {
  const page = await getPage(pageId);
  if (!isPipelinePage(page)) return { ignored: "not-a-pipeline-row" };
  const item = toItem(page);
  const send = await sendApprovedReply(item);
  const research = await researchItem(item);
  return { send, research };
}

/** Researches up to 5 waiting rows in parallel, staying inside the 300s function limit. */
export async function researchBacklog(items: PipelineItem[], at: Date = new Date()) {
  const backlog = items.filter((i) => !researchBlocker(i)).slice(0, 5);
  return (await Promise.all(backlog.map((i) => researchItem(i, at).then((r) => ({ id: i.id, ...r })))))
    .filter((r) => r.status !== "skipped");
}

const DIGEST_HOUR = 8; // 8am New York

/**
 * Daily job (Vercel Hobby crons run once a day, ±59 min). Two crons, 12:00 and
 * 13:00 UTC, cover 8am ET in both EDT and EST; whichever lands in the 8am hour
 * sends the digest. Both also sweep up anything a webhook missed.
 */
export async function runDaily(at: Date = new Date(), opts: { forceDigest?: boolean } = {}) {
  const items = await listOpenItems();

  const sends = [];
  for (const item of items) {
    const r = await sendApprovedReply(item, at);
    if (r.status !== "skipped") sends.push({ id: item.id, ...r });
  }

  const research = await researchBacklog(items, at);

  const ny = nyNow(at);
  let digest: string = "not-due";
  const to = process.env.DIGEST_TO;
  if (!to || !mailConfigured()) digest = "not-configured";
  else if (opts.forceDigest || ny.hour === DIGEST_HOUR) {
    const fresh = await listOpenItems(); // reflect the sends above
    const store = getStore();
    const digestKey = `kairos:digest:${ny.date}`;
    if (opts.forceDigest || (await store.setOnce(digestKey, at.toISOString(), 60 * 60 * 48))) {
      const d = buildDigest(fresh, ny.date, at);
      try {
        await sendEmail({ to, subject: d.subject, text: d.text, html: d.html, idempotencyKey: opts.forceDigest ? undefined : `kairos-digest-${ny.date}` });
      } catch (err) {
        // Free the slot: a failed send must not read as "already sent today" on the next run.
        if (!opts.forceDigest) await store.del(digestKey);
        throw err;
      }
      digest = "sent";
    } else digest = "already-sent-today";
  }

  return { open: items.length, sends, research, digest };
}
