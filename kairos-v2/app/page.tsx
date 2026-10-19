import { Armillary } from "./armillary";
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
        <section className="hero">
          <div className="hero-text">
            <p className="eyebrow rise" style={{ "--d": "0ms" } as React.CSSProperties}>
              Request a service
            </p>
            <h1>
              <span className="rise" style={{ "--d": "80ms" } as React.CSSProperties}>
                Tell us what you need.
              </span>
              <em className="rise" style={{ "--d": "220ms" } as React.CSSProperties}>
                We&rsquo;ll take it from here.
              </em>
            </h1>
            <p className="lead rise" style={{ "--d": "380ms" } as React.CSSProperties}>
              Tables, travel, tickets, errands and the things in between. A member of the team
              reviews every request personally and replies by email.
            </p>
            <a className="btn btn--primary hero-cta rise" href="#request" style={{ "--d": "520ms" } as React.CSSProperties}>
              Begin a request
            </a>
          </div>
          <div className="hero-art rise" style={{ "--d": "300ms" } as React.CSSProperties}>
            <Armillary />
          </div>
        </section>

        <section className="time" aria-labelledby="time-h">
          <h2 id="time-h" className="eyebrow">Two kinds of time</h2>
          <div className="time-grid">
            <div>
              <p className="greek" lang="grc">χρόνος</p>
              <p className="pron">chronos</p>
              <p>The hours that pass: the calls, the holds, the follow-ups, the waiting in.</p>
            </div>
            <div>
              <p className="greek" lang="grc">καιρός</p>
              <p className="pron">kairos</p>
              <p>The moment that matters. We look after the first so you can keep the second.</p>
            </div>
          </div>
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

        <div className="sheet" id="request">
          <RequestForm />
        </div>
      </main>

      <footer className="foot">
        <p className="foot-mark">Kairos</p>
        <p>
          Prefer email? <a href="mailto:concierge@kairosnyc.io">concierge@kairosnyc.io</a>
        </p>
        <p className="greek-line">
          <span lang="grc">καιρός</span> · the right moment
        </p>
      </footer>
    </>
  );
}
