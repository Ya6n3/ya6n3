import "server-only";
import { NextResponse } from "next/server";
import { runDaily } from "./automations";

/** Shared handler for the daily cron routes. Vercel sends "Authorization: Bearer $CRON_SECRET". */
export async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
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
