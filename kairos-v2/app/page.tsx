import { RequestForm } from "./request-form";

export default function Home() {
  return (
    <>
      <header className="masthead">
        <div className="wrap">
          <a className="brand" href="https://kairosnyc.io" aria-label="Kairos, home">
            <picture>
              <source srcSet="/key-gilt.png" media="(prefers-color-scheme: dark)" />
              <img className="mark" src="/key.png" alt="" width={30} height={30} />
            </picture>
            <span className="wordmark">Kairos</span>
          </a>
          <p className="locale">Private concierge · New York</p>
        </div>
      </header>

      <main className="wrap shell">
        <section className="intro">
          <span className="eyebrow">Request a service</span>
          <h1>
            Tell us what you need. <em>We&rsquo;ll take it from here.</em>
          </h1>
          <p className="lead">
            Tables, travel, tickets, errands and the things in between. A member of the team
            reviews every request personally and replies by email.
          </p>
        </section>

        <ol className="steps" aria-label="What happens next">
          <li>
            <h2>You tell us</h2>
            <p>A few lines is enough. Add when and a budget if you have them.</p>
          </li>
          <li>
            <h2>We reply</h2>
            <p>A personal email with options and any questions.</p>
          </li>
          <li>
            <h2>You decide</h2>
            <p>Nothing is booked without your go-ahead.</p>
          </li>
        </ol>

        <RequestForm />
      </main>

      <footer className="foot">
        <div className="wrap">
          <p>
            Prefer email? <a href="mailto:concierge@kairosnyc.io">concierge@kairosnyc.io</a>
          </p>
          <p>
            <span className="greek" lang="grc">καιρός</span> the right moment
          </p>
        </div>
      </footer>
    </>
  );
}
