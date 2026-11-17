# Buy Well trial: slices 1 to 9 built — 17 November 2026

## Objective

Spec [#71](https://github.com/Jp8617465-sys/real-estate-app/issues/71): a prototype a buyers agent can use hands-on on synthetic clients, with fundamentals, a documented API and integration seams. James: "go run until all slices for this work is complete." Owner: Claude Code (session_0125Wa6L7QiJd2bhUjMnUw3o).

## Completed (all pushed; draft PRs stacked, each Refs #71)

Slice 1 clients and households (PR 73, on the intake branch PR 69) → 2 pipeline (74) → 3 brief editor (75) → 4 properties and shortlist (76) → 5 professionals (77) → 6 tasks and timeline (78) → 7 `/api/v1` contract, paging, error codes, idempotency, bearer tokens (79) → 8 four integration ports with synthetic adapters (80) → 9 trial kit: `make demo`, seed, reset, feedback, walkthrough (81). Slice 10 (access) was decided, not built: one local agency, no login, screen-share.

## Decisions (reversible, recorded on #71)

Order as proposed; single local agency without login; stage names provisional; all integrations synthetic and labelled; no provider chosen; `make demo` deletes the local demo database by design.

## Verification

`make check` passes at the top of the stack: 155 API tests (real PostgreSQL), mypy strict, client drift check, front-end build. A headless-browser tour of every slice ran clean (no console errors) after fixing four problems it found. CI job `full` runs the same check on each push.

## Not done / not verified

- Not run on James's Mac (PostgreSQL 17, Homebrew); everything ran on PostgreSQL 16 in a Linux container.
- No real integration: property data, maps, mail and calendar, identity checks are synthetic. Choosing the first real one (and its spend and permitted use) is James's; [#49](https://github.com/Jp8617465-sys/real-estate-app/issues/49) research is still open.
- Real client data stays out of scope: no Australian hosting, no logins or roles, AML/CTF evidence rules unsettled, the language-model extractor runs offshore.
- Bearer-token mode exists for API callers but the bundled app sends no token.
- Decisions James still owns: [#67](https://github.com/Jp8617465-sys/real-estate-app/issues/67) (activity logging and call capture), pipeline stage names, the operator role ([PR 70](https://github.com/Jp8617465-sys/real-estate-app/pull/70)) and extra skills and agents ([PR 72](https://github.com/Jp8617465-sys/real-estate-app/pull/72)).
- Merge order: PR 69, then 73 to 81 in order, then 70 and 72 (independent). Nothing is merged.

## Next action

James: `make demo` on the Mac and follow docs/trial/buy-well-walkthrough.md, then record feedback in the app. Then decide the first real integration, merge the stack in order, and brief Buy Well.

Context: unavailable. One bounded phase per fresh chat.
