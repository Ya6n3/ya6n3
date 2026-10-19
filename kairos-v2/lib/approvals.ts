import "server-only";
import { mailConfigured, sendEmail } from "./mailer";
import { appendParagraphs, updatePage } from "./notion-api";
import { contactEmail, isTest, PRE_CONTACT_STAGES, type PipelineItem } from "./pipeline";
import { getStore } from "./store";
import { addDays, nyNow } from "./time";

/** Days after the first reply before the row shows as a follow-up in the digest. */
const FOLLOW_UP_DAYS = 2;

export type SendResult =
  | { status: "sent"; emailId: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/** Why a row should not be sent, or null if it is ready to go. Pure, for tests. */
export function sendBlocker(item: PipelineItem): string | null {
  if (!item.approved) return "not-approved";
  if (item.doNotContact) return "do-not-contact";
  if (isTest(item)) return "test-row";
  if (!PRE_CONTACT_STAGES.includes(item.stage)) return "already-past-first-reply";
  if (!item.draftReply.trim()) return "empty-draft";
  if (!contactEmail(item)) return "no-email-in-contact";
  return null;
}

/**
 * Approve-in-Notion: once a row is ticked Approved, email the Draft Reply to the
 * member, move Stage to Contacted, set Next Follow-up, and log what was sent on
 * the page. Safe to call any number of times for the same row.
 */
export async function sendApprovedReply(item: PipelineItem, at: Date = new Date()): Promise<SendResult> {
  const blocker = sendBlocker(item);
  if (blocker) return { status: "skipped", reason: blocker };
  if (!mailConfigured()) return { status: "skipped", reason: "email-not-configured" };

  // One send per row, ever: guards against duplicate webhooks and the daily sweep.
  const store = getStore();
  const lockKey = `kairos:sent:${item.id}`;
  if (!(await store.setOnce(lockKey, at.toISOString(), 60 * 60 * 24 * 90))) {
    return { status: "skipped", reason: "already-sent-or-in-progress" };
  }

  const to = contactEmail(item)!;
  let emailId: string;
  try {
    emailId = await sendEmail({
      to,
      subject: process.env.MAIL_SUBJECT || "Your Kairos request",
      text: item.draftReply,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      bcc: process.env.MAIL_BCC || undefined,
      idempotencyKey: `kairos-reply-${item.id}`,
    });
  } catch (err) {
    await store.del(lockKey); // allow a retry on the next change or the daily sweep
    const reason = err instanceof Error ? err.message : String(err);
    await appendParagraphs(item.id, [`⚠️ Kairos could not send the reply (${at.toISOString()}): ${reason}. It will retry automatically.`]).catch(() => {});
    return { status: "failed", reason };
  }

  // The email is out. Record it; if Notion fails here the lock still prevents a resend.
  const today = nyNow(at).date;
  try {
    await updatePage(item.id, {
      Stage: { select: { name: "Contacted" } },
      "Last Agent Action": { date: { start: at.toISOString() } },
      "Next Follow-up": { date: { start: addDays(today, FOLLOW_UP_DAYS) } },
    });
    await appendParagraphs(item.id, [
      `✉️ Sent by Kairos on ${at.toISOString()} to ${to} (email id ${emailId}). Exact text sent:`,
      ...item.draftReply.split(/\n{2,}/),
    ]);
  } catch (err) {
    console.error("Reply sent but Notion update failed for", item.id, err);
  }
  return { status: "sent", emailId };
}
