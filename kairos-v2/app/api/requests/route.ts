import { NextResponse } from "next/server";
import { parseIntake } from "@/lib/intake";
import { createMembershipRequest } from "@/lib/notion";

export const runtime = "nodejs";

// Simple per-IP rate limit: 5 submissions per 10 minutes.
// In-memory, so it resets on redeploy and is per-instance. Good enough for
// launch; move to Upstash/Redis if you see abuse or run multiple instances.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, errors: ["Too many requests. Please try again shortly."] },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Invalid request."] }, { status: 400 });
  }

  // Honeypot: real people never fill the hidden "company_website" field.
  // Pretend success so bots don't learn they were caught.
  if (typeof body.company_website === "string" && body.company_website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  // Only allow test submissions when explicitly enabled (e.g. in development).
  if (process.env.ALLOW_TEST_SUBMISSIONS !== "true") body.isTest = false;

  const parsed = parseIntake(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 422 });
  }

  // Membership Requests has no Source field to mark a test row, and every new
  // row sets off the zaps, so a test submission is validated but not written.
  if (parsed.data.isTest) return NextResponse.json({ ok: true, id: "test" });

  try {
    const id = await createMembershipRequest(parsed.data);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("Intake submit failed:", err);
    return NextResponse.json(
      { ok: false, errors: ["We couldn't submit your request. Please email concierge@kairosnyc.io."] },
      { status: 502 },
    );
  }
}
