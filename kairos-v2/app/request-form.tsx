"use client";

import { useState } from "react";
import { SERVICES } from "@/lib/intake";

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
      <div className="card confirm" role="status">
        <p className="eyebrow">Received</p>
        <h2>Thank you. Your request is with the team.</h2>
        <p>We read every request and reply personally by email with next steps.</p>
        <button className="ghost" onClick={() => setStatus("idle")}>
          Send another request
        </button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
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
          Which service <small>optional</small>
        </legend>
        {SERVICES.map((s) => (
          <label key={s} className="pill">
            <input type="checkbox" name="services" value={s} />
            <span>{s}</span>
          </label>
        ))}
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

      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send request"}
      </button>
      <p className="fine">Nothing is booked without your go-ahead.</p>
    </form>
  );
}
