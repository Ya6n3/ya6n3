"use client";

import { useState } from "react";
import { CATEGORIES, URGENCIES } from "@/lib/pipeline";

type Status = "idle" | "sending" | "sent" | "error";

export function RequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<string[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

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
        <p>You&rsquo;ll hear from us by email. Urgent requests are prioritised.</p>
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

      <div className="row">
        <label>
          <span>
            Phone <small>optional</small>
          </span>
          <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
        </label>
        <label>
          <span>Category</span>
          <select name="category" required defaultValue="">
            <option value="" disabled>
              Choose one
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="urgency">
        <legend>How soon?</legend>
        {URGENCIES.map((u) => (
          <label key={u} className="pill">
            <input type="radio" name="urgency" value={u} defaultChecked={u === "Normal"} />
            <span>{u === "Urgent" ? "Today" : u === "Normal" ? "This week" : "No rush"}</span>
          </label>
        ))}
      </fieldset>

      <label>
        <span>Your request</span>
        <textarea
          name="details"
          rows={6}
          required
          minLength={10}
          maxLength={4000}
          placeholder="e.g. Dinner for four on Saturday around 8pm, West Village, somewhere with a good wine list."
        />
      </label>

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
