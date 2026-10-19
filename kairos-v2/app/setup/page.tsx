import type { Metadata } from "next";
import { researchConfigured } from "@/lib/research";
import { runSetupChecks, setupKeyMatches, type CheckState } from "@/lib/setup-check";
import { researchNow } from "./actions";

export const dynamic = "force-dynamic";
// "Research them now" can take a minute or two with web search.
export const maxDuration = 300;
export const metadata: Metadata = { title: "Kairos — Setup check", robots: { index: false, follow: false } };

const MARK: Record<CheckState, string> = { ok: "Done", todo: "To do", waiting: "Almost" };

type Search = Promise<{ key?: string; done?: string; failed?: string }>;

export default async function Setup({ searchParams }: { searchParams: Search }) {
  const { key, done, failed } = await searchParams;

  if (!setupKeyMatches(key)) {
    return (
      <main className="sheet setup">
        <p className="eyebrow">Setup check</p>
        <p>
          This page is private. Open it as <code>/setup?key=</code> followed by the CRON_SECRET you saved in Vercel.
          If you haven&rsquo;t made one yet, add <code>CRON_SECRET</code> (any long random text) under Vercel →
          Settings → Environment Variables, redeploy, then come back.
        </p>
      </main>
    );
  }

  const { checks, waiting } = await runSetupChecks();
  const left = checks.filter((c) => c.state !== "ok").length;

  return (
    <main className="sheet setup">
      <p className="eyebrow">Setup check</p>
      <h1>{left ? `${left} thing${left === 1 ? "" : "s"} left to set up` : "Everything is set up"}</h1>

      <ul className="checks">
        {checks.map((c) => (
          <li key={c.label} className={`check check--${c.state}`}>
            <span className="check-state">{MARK[c.state]}</span>
            <div>
              <h2>{c.label}</h2>
              <p>{c.detail}</p>
              {c.copy && <code className="check-copy">{c.copy}</code>}
            </div>
          </li>
        ))}
      </ul>

      {done !== undefined && (
        <p className="check-result" role="status">
          Research finished: {done} saved to Notion{Number(failed) ? `, ${failed} failed (the row in Notion says why)` : ""}.
        </p>
      )}

      {waiting && (
        <form action={researchNow} className="check-run">
          <input type="hidden" name="key" value={key} />
          <p>
            {waiting.length
              ? `${waiting.length} request${waiting.length === 1 ? " is" : "s are"} waiting for research: ${waiting
                  .slice(0, 5)
                  .map((i) => i.name || "untitled")
                  .join(", ")}${waiting.length > 5 ? " and more" : ""}.`
              : "No requests are waiting for research."}
          </p>
          {waiting.length > 0 && (
            <button className="btn btn--primary" type="submit" disabled={!researchConfigured()}>
              Research {Math.min(waiting.length, 5)} now
            </button>
          )}
        </form>
      )}
    </main>
  );
}
