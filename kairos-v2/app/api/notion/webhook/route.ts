import { after, NextResponse } from "next/server";
import { processPage } from "@/lib/automations";
import {
  HANDLED_EVENTS,
  noteEventReceived,
  rememberVerificationToken,
  signatureMatches,
  webhookSecret,
  type NotionEvent,
} from "@/lib/notion-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Research with web search can take a minute or two; Hobby allows up to 300s.
export const maxDuration = 300;

export async function POST(request: Request) {
  const raw = await request.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // One-time setup handshake: Notion posts { verification_token } to the URL.
  // Copy it from the Vercel logs (or Upstash) into Notion's "Verify" dialog.
  if (typeof body.verification_token === "string" && !body.type) {
    const stored = await rememberVerificationToken(body.verification_token);
    console.log(
      `[notion-webhook] verification_token received: ${body.verification_token}` +
        (stored ? "" : " (a token was already stored; set NOTION_WEBHOOK_SECRET to use this one)"),
    );
    return NextResponse.json({ ok: true });
  }

  const secret = await webhookSecret();
  if (!secret) return NextResponse.json({ ok: false, error: "webhook not set up" }, { status: 503 });
  if (!signatureMatches(raw, request.headers.get("x-notion-signature"), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await noteEventReceived().catch(() => {});
  const event = body as unknown as NotionEvent;
  if (HANDLED_EVENTS.has(event.type) && event.entity?.type === "page" && event.entity.id) {
    // Acknowledge now; do the work after the response so Notion doesn't time out and retry.
    const pageId = event.entity.id;
    after(async () => {
      try {
        const result = await processPage(pageId);
        console.log(`[notion-webhook] ${event.type} ${pageId}`, JSON.stringify(result));
      } catch (err) {
        console.error(`[notion-webhook] failed for ${pageId}`, err);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
