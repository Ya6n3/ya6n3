import { Armillary } from "./armillary";
import { RequestForm } from "./request-form";

// Two sections and nothing else: I introduces the house, II is the request.
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
        <section className="panel intro" aria-labelledby="intro-h">
          <div className="hero">
            <div className="hero-text">
              <p className="eyebrow rise" style={{ "--d": "0ms" } as React.CSSProperties}>
                <span className="sec">I</span> The concierge
              </p>
              <h1 id="intro-h">
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
          </div>
        </section>

        <section className="panel request" id="request" aria-labelledby="request-h">
          <div className="request-grid">
            <aside className="request-aside">
              <p className="eyebrow">
                <span className="sec">II</span> Your request
              </p>
              <h2 id="request-h">A few lines is enough.</h2>
              <p>We reply by email with options, and nothing is booked without your go-ahead.</p>
              <p className="aside-mail">
                Prefer email? <a href="mailto:concierge@kairosnyc.io">concierge@kairosnyc.io</a>
              </p>
            </aside>
            <RequestForm />
          </div>
        </section>
      </main>

      <footer className="foot">
        <p className="foot-mark">Kairos</p>
        <p className="greek-line">
          <span lang="grc">καιρός</span> · the right moment
        </p>
      </footer>
    </>
  );
}
