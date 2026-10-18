// Option values copied from the Notion "Membership Requests" schema (Oct 2026),
// the same list the "Request a service" Notion form uses.
// If you rename an option in Notion, update it here too, or writes will fail.

export const SERVICES = [
  "Tables",
  "Travel",
  "Access",
  "Bespoke sourcing",
  "Home",
  "Wellbeing",
  "Family & guests",
  "Something else",
] as const;

export type Service = (typeof SERVICES)[number];

export interface IntakeRequest {
  name: string;
  email: string;
  phone?: string;
  services: Service[];
  details: string;
  when?: string;
  budget?: string;
  /** Validate only; nothing is written to Notion. */
  isTest?: boolean;
}

const MAX = { name: 120, email: 254, phone: 40, details: 4000, when: 200, budget: 100 };
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
  const when = str(b.when);
  const budget = str(b.budget);
  // Accept one service as a string or several as an array.
  const rawServices = Array.isArray(b.services) ? b.services : b.services ? [b.services] : [];
  const services = [...new Set(rawServices.map(str))] as Service[];

  if (!name) errors.push("Name is required.");
  if (name.length > MAX.name) errors.push("Name is too long.");
  if (!EMAIL_RE.test(email) || email.length > MAX.email)
    errors.push("A valid email is required.");
  if (phone.length > MAX.phone) errors.push("Phone is too long.");
  if (services.some((s) => !SERVICES.includes(s))) errors.push("Choose a service from the list.");
  if (details.length < 10) errors.push("Tell us a bit more about the request.");
  if (details.length > MAX.details) errors.push("Request details are too long.");
  if (when.length > MAX.when) errors.push("When is too long.");
  if (budget.length > MAX.budget) errors.push("Budget is too long.");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name,
      email,
      phone: phone || undefined,
      services,
      details,
      when: when || undefined,
      budget: budget || undefined,
      isTest: b.isTest === true,
    },
  };
}
