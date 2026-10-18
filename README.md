# Hi, I'm Yassine

Founder of **Kairos NYC Concierge**, a members-only concierge service for busy New York professionals. I'm a software engineer, and I build the product and the operations behind it myself.

> The real luxury is mental bandwidth. Kairos handles the logistics so members don't have to think about them.

## What I'm building

**Kairos NYC Concierge** takes care of everyday logistics for founders, finance professionals and creatives in NYC: hard-to-get reservations, scheduling, returns, travel fixes, gift sourcing and "just handle this for me" requests.

Behind the scenes, the service runs on a human-in-the-loop operating system:

- **Intake:** members send requests through a branded web form, and each one lands in a Notion pipeline.
- **Triage:** an AI step drafts the reply and sorts the request by category and urgency.
- **Approval:** an operator reviews every draft before anything reaches a member.
- **Knowledge:** vendor directories and SOPs keep what we learn in shared playbooks instead of in someone's head.

The AI drafts and organizes. A person approves and does the work, which keeps quality high.

## In this repo

| Project | What it is | Stack |
|---|---|---|
| [`kairos-v2`](./kairos-v2) | Member intake app. Each request becomes a row in the Notion Agent Pipeline, with validation, a bot trap and a rate limit built in. | Next.js 15, React 19, TypeScript, Notion API |

## How I build

- **Ship the smallest useful version first**, then automate only what keeps coming back.
- **Humans approve, AI assists.** Nothing goes out to a client without review.
- **Keep the stack lean:** Notion as the operating database, Zapier for the glue, and Claude for triage and drafting.

## Stack

**Product:** Next.js · React · TypeScript · Tailwind CSS · Node.js · PostgreSQL · Vercel
**Operations & AI:** Notion · Zapier · Claude (Anthropic API) · workflow automation

## Contact

- [LinkedIn](https://www.linkedin.com/in/yassine-daouda-696a33126)
- [GitHub](https://github.com/Ya6n3)
