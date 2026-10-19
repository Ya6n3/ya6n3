import { handleCron } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 12:00 UTC daily. See runDaily in lib/automations.ts for why there are two.
export const GET = handleCron;
