# Buyers-agent workspace — rebuild

A fresh product for Australian buyers agents and small agencies. Working name only; RealFlow is retired on this branch. Connect buyer profiles, buying engagements, property intelligence and mapping, professional relationships, intake, service delivery and aftercare. Prove one useful workflow with one real agency at a time.

Start with AGENTS.md, docs/product/north-star.md and GLOSSARY.md. Follow the live decision map linked from docs/process/issue-tracker.md, and the latest relevant brief in docs/handoffs/.

Claude Code: /grill-me, /wayfinder, /prototype, /to-spec, /to-tickets.
Codex: $grill-me, $wayfinder, $prototype, $to-spec, $to-tickets, or ask for the workflow by name. See docs/process/agent-adapters.md.

## Working product brief

The [working brief](docs/product/working-brief.md) captures the current direction, James's feedback, prototypes and open questions for the next ideation session. The work remains active; the hybrid is a starting point for further design.

Run `make prototype` to serve the latest hybrid at <http://127.0.0.1:8765/buyers-desk-hybrid.html>. It supports own-data manual intake and property workflows; automatic NLP/ML extraction remains TBC.

## Running the app

The first tracer bullet is a local app: a Python back end and a React front end ([ADR 0001](docs/adr/0001-python-backend-typescript-frontend.md)). Synthetic or role-play material only.

    make setup   # once: pinned dependencies, local PostgreSQL 17, database, migrations
    make run     # http://127.0.0.1:8000, the API and the built front end

Needs macOS with Homebrew, `uv`, `postgresql@17` and Node 20 (`brew install uv postgresql@17 node@20`). After changing the API, run `make generate-client`.

## Verification

    make check

Runs the factory wiring checks, back-end type checks and API tests against a local PostgreSQL test database, the generated-client drift check and the front-end build. The CI workflow runs `make check-factory` only until it can provision PostgreSQL, uv and Node through reviewed, pinned actions.

## Recovery

Archive tag: archive/realflow-pre-rebuild-2026-11-06.
Original main: 09303565dfed8cf3b667e91a8ec2273f603c2848.
See docs/process/recovery.md for the verified full-history bundle and recovery steps.
