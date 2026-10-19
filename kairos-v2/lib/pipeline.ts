import "server-only";
import { prop, queryDatabase, sameId, type NotionPage } from "./notion-api";

// The Notion "Agent Pipeline" database (Kairos AI Agents — Operating Spec).
const DEFAULT_PIPELINE_DB = "86d266e140b74d43aa9783b874359bec";
export const pipelineDatabaseId = () => process.env.NOTION_PIPELINE_DATABASE_ID || DEFAULT_PIPELINE_DB;

export const OPEN_STAGES = ["New", "Triaged", "Contacted", "Accepted", "In Progress"] as const;
/** Stages where a first reply has not gone out yet. */
export const PRE_CONTACT_STAGES = ["New", "Triaged"];

export interface PipelineItem {
  id: string;
  url: string;
  createdTime: string;
  name: string;
  contact: string;
  stage: string;
  type: string;
  source: string;
  category: string;
  urgency: string;
  approved: boolean;
  doNotContact: boolean;
  needsHuman: boolean;
  draftReply: string;
  recap: string;
  requestDetails: string;
  researchNotes: string;
  options: string;
  nextFollowUp: string;
  followUpCount: number;
}

export function isPipelinePage(page: NotionPage): boolean {
  return sameId(page.parent?.database_id, pipelineDatabaseId()) && !page.archived && !page.in_trash;
}

export function toItem(page: NotionPage): PipelineItem {
  const p = page.properties;
  return {
    id: page.id,
    url: page.url,
    createdTime: page.created_time,
    name: prop.text(p["Name"]),
    contact: prop.text(p["Contact"]),
    stage: prop.select(p["Stage"]),
    type: prop.select(p["Type"]),
    source: prop.select(p["Source"]),
    category: prop.select(p["Category"]),
    urgency: prop.select(p["Urgency"]),
    approved: prop.checkbox(p["Approved"]),
    doNotContact: prop.checkbox(p["Do Not Contact"]),
    needsHuman: prop.checkbox(p["Needs Human"]),
    draftReply: prop.text(p["Draft Reply"]),
    recap: prop.text(p["Recap"]),
    requestDetails: prop.text(p["Request Details"]),
    researchNotes: prop.text(p["Research Notes"]),
    options: prop.text(p["Options"]),
    nextFollowUp: prop.date(p["Next Follow-up"]).slice(0, 10),
    followUpCount: prop.number(p["Follow-up Count"]),
  };
}

/** First email address found in the Contact field (it may also hold a phone or name). */
export function contactEmail(item: Pick<PipelineItem, "contact">): string | null {
  const m = item.contact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

/** The schema says: "Test rows are skipped by automations." */
export const isTest = (item: Pick<PipelineItem, "source">) => item.source === "Test";

/** All rows that are still open, excluding test rows. */
export async function listOpenItems(): Promise<PipelineItem[]> {
  const pages = await queryDatabase(pipelineDatabaseId(), {
    or: OPEN_STAGES.map((s) => ({ property: "Stage", select: { equals: s } })),
  });
  return pages.map(toItem).filter((i) => !isTest(i));
}
