# Architecture foundations — 7 November 2026

## Objective

Grill the product architecture with James (grill-with-docs: grilling plus domain-modeling) so the first tracer bullet and later service lines rest on agreed, hard-to-reverse foundations. Owner: Claude Code session claude-code-intake-grilling-2026-11-07, which also ran the intake work in 2026-11-07-intake-grilling.md.

## Completed

- [Decide the product architecture foundations](https://github.com/Jp8617465-sys/real-estate-app/issues/58) is resolved and closed. The map's Decisions so far has a gist line, and Not yet specified lists the next questions.
- ADRs in docs/adr:
  - 0001: Python back end and TypeScript front end, joined only by the documented API.
  - 0002: one shared PostgreSQL database with agency-scoped records.
  - 0003: current records plus an append-only change log.
  - 0004: real client data processed and stored only in Australia.
- Other decisions:
  - Grow pages and tables one slice at a time.
  - One modular back end.
  - One responsive web app.
  - A shared core plus a module per service line (buying first; property management and sales later).
  - Developer experience: one command each to set up, run and check.
- Stack approved: FastAPI, SQLAlchemy and Alembic, with Python managed by uv; React, TypeScript and Vite; local PostgreSQL via Homebrew. This is noted on [Agree the first live tracer bullet](https://github.com/Jp8617465-sys/real-estate-app/issues/52).
- The north star notes the service-line extension path and the decided stack and tenancy.

## Coordination and caveats

- Another session (real-estate-app-8c) shares this checkout and branch, working on [Decide how enquiries become contacts and buying engagements](https://github.com/Jp8617465-sys/real-estate-app/issues/57). Commit 55b3e67 accidentally included that session's glossary edits (Contact, Relationship owner, Enquiry, Engagement owner, Discovery call). That session confirmed the content is correct, and the history stays as is.
- That session owns GLOSSARY.md. Four agreed term changes are pending, to be applied once James confirms them in that session's thread:
  - Client profile replaces Buyer profile (avoid "buyer profile").
  - Engagement, with Buying engagement as its first type.
  - Service line.
  - The Agency wording.
- Stage only your own paths with git add; never use -A or -a.
- The glossary now prefers "discovery call" over "initial consultation". Older docs and the answer-key rules still say "initial consultation".

## Outstanding

- [Prototype the transcript suggestion review](https://github.com/Jp8617465-sys/real-estate-app/issues/55) is open and claimed. Commit 4a73907 added a prototype, but no verdict has been recorded yet.
- Agree the first live tracer bullet: acceptance cases, then the to-spec and to-tickets breakdown, once the prototype resolves.
- Next architecture round: logins and roles, first pages, hosting in Australia, how property-data providers plug in, and how modules are switched on per agency.
- James: a Claude API account with US$50 prepaid credits, auto-reload off, with the key configured by him. Python via uv and PostgreSQL are not yet installed.

## Next action

Recheck the live map and the ticket owners. Then resolve the prototype verdict, or take the tracer bullet's acceptance cases once it clears.

Context: James reported 32% before this round, which ended near the 40% target. No harness counter is available to the agent.
