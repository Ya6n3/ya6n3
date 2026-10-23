import type { Metadata } from "next";
import { researchConfigured } from "@/lib/research";
import { runSetupChecks, setupKeyMatches, type CheckState } from "@/lib/setup-check";
import { researchNow, useWebhookToken } from "./actions";

export const dynamic = "force-dynamic";
// "Research them now" can take a minute or two with web search.
export const maxDuration = 300;
export const metadata: Metadata = { title: "Kairos — Setup check", robots: { index: false, follow: false } };

const MARK: Record<CheckState, string> = { ok: "Done", todo: "To do", waiting: "Almost" };

type Search = Promise<{ key?: string; done?: string; failed?: string; saved?: string }>;

export default async function Setup({ searchParams }: { searchParams: Search }) {
  const { key, done, failed, saved } = await searchParams;

  if (!setupKeyMatches(key)) {
    return (
      <main className="sheet setup">
        <p className="eyebrow">Setup check</p>
        <p>
          This page is private. Open it as <code>/setup?key=</code> followed by the <code>SETUP_KEY</code> you saved in
          Vercel (or your <code>CRON_SECRET</code> if you haven&rsquo;t made a <code>SETUP_KEY</code>). If you
          haven&rsquo;t made one yet, add <code>SETUP_KEY</code> (any long random text) under Vercel → Settings →
          Environment Variables, redeploy, then come back.
        </p>
      </main>
    );
  }

  const { checks, pendingToken, waiting } = await runSetupChecks();
  const envSecret = !!process.env.NOTION_WEBHOOK_SECRET;
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

      {saved && (
        <p className="check-result" role="status">
          Token saved. Edit any Agent Pipeline row in Notion and this page should show the webhook as live.
        </p>
      )}

      {pendingToken && (
        <form action={useWebhookToken} className="check-run">
          <input type="hidden" name="key" value={key} />
          <input type="hidden" name="token" value={pendingToken} />
          <h2>Notion sent a verification token</h2>
          <code className="check-copy">{pendingToken}</code>
          {envSecret ? (
            <p>
              <code>NOTION_WEBHOOK_SECRET</code> is set in Vercel, so it is used instead. To switch to this token, put it
              in that variable and redeploy.
            </p>
          ) : (
            <>
              <p>
                1. Paste it into Notion&rsquo;s <strong>Verify</strong> dialog. 2. Only after Notion says it is
                verified, press the button. Do not use a token that Notion did not just send you.
              </p>
              <button className="btn btn--primary" type="submit">
                Use this token
              </button>
            </>
          )}
        </form>
      )}

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
