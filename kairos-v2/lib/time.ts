// New York local-time helpers. Vercel crons run in UTC; the business runs on ET.
const TZ = "America/New_York";

/** { date: "YYYY-MM-DD", hour: 0-23 } in New York for the given instant. */
export function nyNow(at: Date = new Date()): { date: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** Adds whole days to a YYYY-MM-DD date string. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Mon, Oct 19" for a YYYY-MM-DD date. */
export function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Whole days between an ISO instant and now (never negative). */
export function ageInDays(iso: string, at: Date = new Date()): number {
  const ms = at.getTime() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86_400_000)) : 0;
}
