// Option values copied from the Notion "Agent Pipeline" schema (Oct 2026).
// If you rename an option in Notion, update it here too, or writes will fail.

export const CATEGORIES = [
  "Dining",
  "Events",
  "Travel",
  "Errands",
  "Business Services",
  "Other",
] as const;

export const URGENCIES = ["Urgent", "Normal", "Low"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Urgency = (typeof URGENCIES)[number];

export interface IntakeRequest {
  name: string;
  email: string;
  phone?: string;
  category: Category;
  urgency: Urgency;
  details: string;
  /** Mark the row Source = Test so Zapier skips it. */
  isTest?: boolean;
}

const MAX = { name: 120, email: 254, phone: 40, details: 4000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates untrusted form input. Returns a clean request or a list of errors. */
export function parseIntake(
  raw: unknown,
): { ok: true; data: IntakeRequest } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const b = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const name = str(b.name);
  const email = str(b.email).toLowerCase();
  const phone = str(b.phone);
  const details = str(b.details);
  const category = str(b.category) as Category;
  const urgency = (str(b.urgency) || "Normal") as Urgency;

  if (!name) errors.push("Name is required.");
  if (name.length > MAX.name) errors.push("Name is too long.");
  if (!EMAIL_RE.test(email) || email.length > MAX.email)
    errors.push("A valid email is required.");
  if (phone.length > MAX.phone) errors.push("Phone is too long.");
  if (!CATEGORIES.includes(category)) errors.push("Choose a category.");
  if (!URGENCIES.includes(urgency)) errors.push("Choose an urgency.");
  if (details.length < 10) errors.push("Tell us a bit more about the request.");
  if (details.length > MAX.details) errors.push("Request details are too long.");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: { name, email, phone: phone || undefined, category, urgency, details, isTest: b.isTest === true },
  };
}
