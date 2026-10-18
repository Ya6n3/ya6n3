import { RequestForm } from "./request-form";

export default function Home() {
  return (
    <main className="shell">
      <header className="masthead">
        <p className="mark">KAIROS</p>
        <p className="locale">Private Concierge · New York</p>
      </header>

      <section className="intro">
        <h1>
          Tell us what you need.
          <br />
          <em>We&rsquo;ll take it from here.</em>
        </h1>
        <p>
          Tables, travel, tickets, errands and the things in between. A member of the team
          reviews every request personally and replies by email.
        </p>
      </section>

      <RequestForm />

      <footer className="foot">
        <p>
          Prefer email? <a href="mailto:concierge@kairosnyc.io">concierge@kairosnyc.io</a>
        </p>
      </footer>
    </main>
  );
}
