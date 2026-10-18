import { NextResponse } from "next/server";
import { parseIntake } from "@/lib/intake";
import { createMembershipRequest } from "@/lib/notion";
import { clientIp, getLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Per-IP limit (5 per 10 minutes), shared across instances when Upstash
  // Redis is configured. See lib/rate-limit.ts.
  if (await getLimiter().isLimited(clientIp(request.headers))) {
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
