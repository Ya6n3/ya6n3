import "server-only";
import { escapeHtml } from "./mailer";
import { PRE_CONTACT_STAGES, type PipelineItem } from "./pipeline";
import { ageInDays, prettyDate } from "./time";

// Daily digest: one email each morning with what's waiting on the operator.

export interface DigestSection {
  title: string;
  hint: string;
  items: PipelineItem[];
}

export function buildSections(items: PipelineItem[], today: string): DigestSection[] {
  const pre = (i: PipelineItem) => PRE_CONTACT_STAGES.includes(i.stage) && !i.doNotContact;
  return [
    {
      title: "Approved but not sent",
      hint: "Sending failed. Open the row to see why; Kairos retries automatically.",
      items: items.filter((i) => pre(i) && i.approved),
    },
    {
      title: "Ready to approve",
      hint: "Review the Draft Reply, edit if needed, then tick Approved to send it.",
      items: items.filter((i) => pre(i) && !i.approved && i.draftReply.trim()),
    },
    {
      title: "No draft yet",
      hint: "Triage hasn't written a reply. Write one in Draft Reply, or check the intake zap.",
      items: items.filter((i) => pre(i) && !i.approved && !i.draftReply.trim()),
    },
    {
      title: "Follow-ups due",
      hint: "Contacted, no update since. Nudge the member or move the Stage.",
      items: items.filter((i) => i.stage === "Contacted" && !!i.nextFollowUp && i.nextFollowUp <= today),
    },
    {
      title: "In progress",
      hint: "Accepted or being fulfilled.",
      items: items.filter((i) => i.stage === "Accepted" || i.stage === "In Progress"),
    },
  ];
}

const line = (i: PipelineItem, at: Date) => {
  const tags = [i.category, i.urgency === "Urgent" ? "URGENT" : "", i.needsHuman ? "needs you" : ""]
    .filter(Boolean)
    .join(" · ");
  const age = ageInDays(i.createdTime, at);
  const summary = (i.recap || i.requestDetails).replace(/\s+/g, " ").slice(0, 160);
  return { name: i.name || "Untitled", tags, age: age === 0 ? "today" : `${age}d old`, summary, url: i.url };
};

export function buildDigest(items: PipelineItem[], today: string, at: Date = new Date()) {
  const sections = buildSections(items, today);
  const count = (t: string) => sections.find((s) => s.title === t)!.items.length;
  const waiting = items.filter((i) => i.stage === "Contacted" && !(i.nextFollowUp && i.nextFollowUp <= today)).length;

  const headline = [
    count("Approved but not sent") && `${count("Approved but not sent")} failed to send`,
    count("Ready to approve") && `${count("Ready to approve")} to approve`,
    count("Follow-ups due") && `${count("Follow-ups due")} follow-up${count("Follow-ups due") > 1 ? "s" : ""} due`,
  ]
    .filter(Boolean)
    .join(", ");
  const subject = `Kairos digest, ${prettyDate(today)}: ${headline || "nothing waiting on you"}`;

  const visible = sections.filter((s) => s.items.length);
  const textParts = [
    `Kairos, ${prettyDate(today)}. ${items.length} open request${items.length === 1 ? "" : "s"}; ${waiting} waiting on members.`,
    ...visible.map(
      (s) =>
        `\n${s.title.toUpperCase()} (${s.items.length})\n${s.hint}\n` +
        s.items.map((i) => line(i, at)).map((l) => `- ${l.name} [${[l.tags, l.age].filter(Boolean).join(" · ")}]\n  ${l.summary}\n  ${l.url}`).join("\n"),
    ),
  ];
  if (!visible.length) textParts.push("\nNothing needs you today.");

  const htmlSections = visible
    .map(
      (s) => `
  <h2 style="font-size:15px;margin:24px 0 4px">${escapeHtml(s.title)} (${s.items.length})</h2>
  <p style="margin:0 0 8px;color:#666;font-size:13px">${escapeHtml(s.hint)}</p>
  <ul style="padding-left:18px;margin:0">${s.items
    .map((i) => line(i, at))
    .map(
      (l) => `
    <li style="margin:0 0 10px"><a href="${escapeHtml(l.url)}" style="color:#1a1a1a;font-weight:600">${escapeHtml(l.name)}</a>
      <span style="color:#666;font-size:12px"> ${escapeHtml([l.tags, l.age].filter(Boolean).join(" · "))}</span><br>
      <span style="font-size:13px">${escapeHtml(l.summary)}</span></li>`,
    )
    .join("")}
  </ul>`,
    )
    .join("");

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:560px">
  <p style="margin:0 0 4px;font-size:13px;color:#666">${escapeHtml(prettyDate(today))}</p>
  <p style="margin:0;font-size:15px">${items.length} open request${items.length === 1 ? "" : "s"} · ${waiting} waiting on members</p>
  ${htmlSections || '<p style="margin-top:16px">Nothing needs you today.</p>'}
</div>`;

  return { subject, text: textParts.join("\n"), html, sections };
}
