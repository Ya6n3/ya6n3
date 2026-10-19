"use client";

import { useState } from "react";
import { SERVICES, type Service } from "@/lib/intake";

// One line per service, in the website's words.
const SERVICE_COPY: Record<Service, string> = {
  Tables: "The hard-to-get table, the private room, the chef\u2019s counter on a Tuesday.",
  Travel: "Flights, cars and hotels planned around your meetings, and re-planned when they move.",
  Access: "Openings, matches, galas and the shows everyone is talking about.",
  "Bespoke sourcing": "Gifts with a reason behind them, the hard-to-find bottle, the piece in the right size.",
  Home: "Repairs, deliveries, cleaners and contractors, followed through so you are not the one waiting in.",
  Wellbeing: "Trainers, treatments and appointments booked into the gaps in your week.",
  "Family & guests": "Birthdays, visiting parents, the weekend for eight. Every detail held in one place.",
  "Something else": "Anything else that can be arranged. Tell us in a sentence.",
};

// Cards lean toward the pointer, a few degrees at most.
function tilt(e: React.PointerEvent<HTMLLabelElement>) {
  if (e.pointerType !== "mouse") return;
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  e.currentTarget.style.setProperty("--ry", `${x * 10}deg`);
  e.currentTarget.style.setProperty("--rx", `${-y * 10}deg`);
  e.currentTarget.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
  e.currentTarget.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
}
function untilt(e: React.PointerEvent<HTMLLabelElement>) {
  e.currentTarget.style.setProperty("--rx", "0deg");
  e.currentTarget.style.setProperty("--ry", "0deg");
}

type Status = "idle" | "sending" | "sent" | "error";

export function RequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<string[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const data = { ...Object.fromEntries(fd.entries()), services: fd.getAll("services") };

    setStatus("sending");
    setErrors([]);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { ok: boolean; errors?: string[] };
      if (json.ok) {
        setStatus("sent");
        form.reset();
      } else {
        setErrors(json.errors ?? ["Something went wrong."]);
        setStatus("error");
      }
    } catch {
      setErrors(["Network error. Please try again."]);
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="req confirm" role="status">
        <p className="eyebrow">Received</p>
        <h2>Thank you. Your request is with the team.</h2>
        <p>We read every request and reply personally by email with next steps.</p>
        <button className="btn btn--secondary" onClick={() => setStatus("idle")}>
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form className="req" onSubmit={onSubmit} noValidate>
      <div className="row">
        <label>
          <span>Name</span>
          <input name="name" autoComplete="name" required maxLength={120} />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
      </div>

      <label>
        <span>
          Phone <small>optional</small>
        </span>
        <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
      </label>

      <fieldset className="choices">
        <legend>
          Which service <small>optional, pick any</small>
        </legend>
        <div className="cards">
          {SERVICES.map((s, i) => (
            <label key={s} className="card" onPointerMove={tilt} onPointerLeave={untilt}>
              <input type="checkbox" name="services" value={s} />
              <span className="card-face">
                <span className="card-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="card-name">{s}</span>
                <span className="card-copy">{SERVICE_COPY[s]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        <span>What do you need?</span>
        <textarea
          name="details"
          rows={6}
          required
          minLength={10}
          maxLength={4000}
          placeholder="e.g. Dinner for four, somewhere in the West Village with a good wine list."
        />
      </label>

      <div className="row">
        <label>
          <span>
            When <small>optional</small>
          </span>
          <input name="when" maxLength={200} placeholder="e.g. Saturday, around 8pm" />
        </label>
        <label>
          <span>
            Budget <small>optional</small>
          </span>
          <input name="budget" maxLength={100} placeholder="e.g. $500 total" />
        </label>
      </div>

      {/* Honeypot — hidden from people, tempting to bots. */}
      <div className="hp" aria-hidden="true">
        <label>
          Company website
          <input name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {errors.length > 0 && (
        <ul className="errors" role="alert">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <button className="btn btn--primary" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send request"}
      </button>
      <p className="fine">
        Requests are handled privately and shared only with the people needed to arrange them.
      </p>
    </form>
  );
}
