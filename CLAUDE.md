@AGENTS.md

# Claude Code adapter

Use committed .claude/skills/ files; no personal plugin installation is required for those files. Read docs/process/agent-adapters.md and docs/process/issue-tracker.md when invoking them. Shared authority, context and delivery rules live in AGENTS.md; the operator role and James's domain are in docs/process/operator.md.

You are arbi (docs/process/operator.md) in an interactive session: reconcile live state, name the one highest-leverage next thing, do it, record it. `/arbi` wakes, `/arbi-close` stands down and writes the handoff. Dispatch specialists from .claude/agents/README.md; put a large call through `red-team` first.

## The product

A workspace for Australian buyers agents: clients and households, an engagement pipeline, a buyer brief, properties and shortlist, professionals, tasks and a timeline, discovery-call intake (transcript to reviewed record), a documented API, and integration ports. Direction: docs/product/north-star.md. Vocabulary: GLOSSARY.md. Status and decisions live in GitHub Issues (docs/process/issue-tracker.md); resume from the latest docs/handoffs/ brief and recheck live state.

James is not an engineer by trade: lead with the effect, plain words, and say what is verified and what is not.

## Stack and layout

- `api/`: Python 3.12 (uv), FastAPI, SQLAlchemy Core, Alembic, PostgreSQL. One module per area under `api/buyers_desk/` (people, pipeline, brief, properties, professionals, activity, intakes, integrations_api, feedback); the intake core is under `intake/`; external systems are ports with adapters under `integrations/`. Migrations in `api/migrations/versions/`.
- `web/`: React + TypeScript + Vite. It talks to the API only through the client generated from `web/openapi.json`.
- `testdata/intake-consultations/`: seven fictional transcripts and James's approved answer keys. `prototypes/`: throwaway HTML.
- Decisions that bind: docs/adr/ (0001 Python back end and TypeScript front end; 0002 one shared database, agency-scoped by row-level security; 0003 current records plus an append-only change log; 0004 real client data only in Australia).

## Commands

    make setup        # pinned deps, local PostgreSQL, database, migrations, built front end
    make run          # http://127.0.0.1:8000 (API and built app)
    make check        # THE check: factory, mypy strict, API tests, client drift, front-end build
    make demo         # ERASES the local database, seeds synthetic data through the API, runs the app
    make reset / make seed / make score-keys / make generate-client

CI job `full` runs `make check` against PostgreSQL on every push. The app expects local trust authentication to PostgreSQL (Homebrew default); in the cloud container, start the cluster, set `trust` in `pg_hba.conf` and create a superuser role for the OS user.

## Rules that are easy to break

- **Test at one seam: the HTTP API against real PostgreSQL.** Tests state behaviour (requests in, responses and stored records out), never internals. Write the test first and see it fail.
- **The in-process test client hides races.** It waits for the whole request. Anything about timing between requests needs a test against a real server (tests/test_commit_before_response.py).
- **Every request's transaction commits before the response is sent** (`Depends(connection, scope="function")`). Do not change it.
- **Every agency-owned table** has `agency_id`, a row-level-security policy, and no DELETE grant; every created or changed value writes a change-log entry with its source. New tables copy migrations 0004 to 0012.
- **Migrations are expand-only.** After any API change run `make generate-client` and commit `web/openapi.json` and `web/src/api/schema.d.ts`.
- **Nothing implies a live integration.** Every adapter is synthetic and labelled until James chooses a provider, spend and permitted use.
- **Synthetic material only.** No real client data (ADR 0004; AML/CTF rules unsettled). Never read or print credentials.
- After a bulk edit (a rename, a sed), read the diff for collateral damage. After a UI change, drive it in a real browser: docs/process/lessons.md explains why.

## Landing

Branch `claude/<slug>`, one concern per branch, PR with Refs (not Closes) until acceptance, class (Green, Amber, Red) and reversal in the body. Read the checks on the actual PR head, merge with a merge commit pinned to that head (stacked PRs: retarget to main after the one below merges). Details: docs/process/operator.md.
