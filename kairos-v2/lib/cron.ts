import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDaily } from "./automations";

/** Constant-time comparison, so response timing cannot be used to guess the secret. */
function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Shared handler for the daily cron routes. Vercel sends "Authorization: Bearer $CRON_SECRET". */
export async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET not set" }, { status: 503 });
  if (!sameSecret(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const forceDigest = new URL(request.url).searchParams.get("digest") === "now";
  try {
    const result = await runDaily(new Date(), { forceDigest });
    console.log("[cron] daily", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] daily failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
