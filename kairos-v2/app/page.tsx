import { RequestForm } from "./request-form";

export default function Home() {
  return (
    <>
      <p className="topline">Private concierge · New York City</p>

      <header className="masthead">
        <a className="brand" href="https://kairosnyc.io" aria-label="Kairos, home">
          <span className="mark" aria-hidden="true" />
          <span className="wordmark">Kairos</span>
        </a>
      </header>

      <main>
        <section className="intro">
          <p className="eyebrow">Request a service</p>
          <h1>
            Tell us what you need.
            <em>We&rsquo;ll take it from here.</em>
          </h1>
          <p className="lead">
            Tables, travel, tickets, errands and the things in between. A member of the team
            reviews every request personally and replies by email.
          </p>
        </section>

        <ol className="steps" aria-label="What happens next">
          <li>
            <span className="num">01</span>
            <h2>You tell us</h2>
            <p>A few lines is enough.</p>
          </li>
          <li>
            <span className="num">02</span>
            <h2>We reply</h2>
            <p>A personal email with options.</p>
          </li>
          <li>
            <span className="num">03</span>
            <h2>You decide</h2>
            <p>Nothing is booked without your go-ahead.</p>
          </li>
        </ol>

        <div className="sheet">
          <RequestForm />
        </div>
      </main>

      <footer className="foot">
        <p className="foot-mark">Kairos</p>
        <p>
          Prefer email? <a href="mailto:concierge@kairosnyc.io">concierge@kairosnyc.io</a>
        </p>
        <p className="greek">
          <span lang="grc">καιρός</span> · the right moment
        </p>
      </footer>
    </>
  );
}
