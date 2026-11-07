# Ticket 60 walking skeleton — 7 November 2026

## Objective

Build [Create a buying opportunity that survives a restart](https://github.com/Jp8617465-sys/real-estate-app/issues/60) with the tdd skill, in ../repository-slice on slice/consultation-intake. Owner: Claude Code session real-estate-app-a7 (71102e).

## Completed

- Fast-forwarded the branch to prototype/engagement-property-review (8cb7e6f). #60 was rechecked live: open, ready-for-agent, no blockers, no PR.
- Installed uv 0.13.6 and PostgreSQL 17.11 via Homebrew; started the `postgresql@17` brew service (local trust auth, no credentials).
- Back end `api/` (FastAPI, SQLAlchemy Core, Alembic, Python 3.12). Front end `web/` (React, TypeScript, Vite) using only a client generated from the OpenAPI document.
- Seven API tests at the one agreed seam (HTTP API against real PostgreSQL): create/list/open, optional budget, restart, refusal without email or mobile, change log "entered by hand", agency isolation, no-agency refusal. Three of these (optional budget, restart, refusal) passed on first run because slice 1 already built the behaviour; the others were red first.
- `make setup`, `make run`, `make check` work. `make setup` was run from a state with no virtualenv, node_modules or dist. `make run` was restarted and the record read back.

## Decisions (reversible)

- An engagement points to the household it was opened for (`engagements.household_id`); new opportunities start at stage `enquiry`.
- Budget is whole AUD dollars on the buyer brief. Dated household membership is deferred.
- Row-level security is enforced for the restricted role `buyers_desk_app`; the app sets `app.agency_id` per request. The role has no DELETE grant and only SELECT/INSERT on `change_log`. Checked directly with psql.
- Change-log "who" is the placeholder "Local agent" until logins exist.
- TypeScript is pinned to 5.9.3 because openapi-typescript needs the TS 5 compiler API.
- CI runs `make check-factory` only; the full check needs PostgreSQL, uv and Node through reviewed, pinned actions.

## Outstanding

- Not committed or pushed; staged only. No PR yet (base branch to decide; use Refs #60, not Closes).
- Acceptance: on 7 November 2026 James ran `make run` and said it "seems to work well" and does not let you progress without the required details (his words, in chat; so the form ran in a browser). He did not ask to close #60; it stays open until he says so.
- pytest prints a deprecation warning suggesting `httpx2`. Unverified package, so not installed.

## Verification

`make check` passes (factory checks, mypy strict, 7 API tests, client drift check, front-end build). The drift check was shown to fail on a changed API shape.

Context: unavailable (no harness counter). One bounded phase.

## Next action

Fresh chat: read AGENTS.md and this handoff, recheck #60 and #61. Commit and push the slice if James agrees, demo it, then start [Upload a discovery-call transcript and match speakers](https://github.com/Jp8617465-sys/real-estate-app/issues/61).
