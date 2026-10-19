import "server-only";

// Sends email through Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).

export interface Email {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  bcc?: string;
  /** Resend keeps idempotency keys for 24h, so a retry never sends twice. */
  idempotencyKey?: string;
}

export const mailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;

export async function sendEmail(email: Email): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) throw new Error("Email is not configured (RESEND_API_KEY / MAIL_FROM)");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (email.idempotencyKey) headers["Idempotency-Key"] = email.idempotencyKey.slice(0, 256);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html ?? textToHtml(email.text),
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      ...(email.bcc ? { bcc: email.bcc } : {}),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend error", res.status, body.slice(0, 500));
    throw new Error(`Resend error ${res.status}`);
  }
  return ((await res.json()) as { id: string }).id;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Plain text → minimal, safe HTML that keeps line breaks. */
export function textToHtml(text: string): string {
  const body = escapeHtml(text).replace(/\r?\n/g, "<br>");
  return `<div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#1a1a1a">${body}</div>`;
}
