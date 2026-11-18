# Lessons

Append-only. Dated claims; each says how to check it. Newer entries may supersede older ones; do not rewrite history.

## 2026-11-18

- **A commit that runs after the response is a race.** FastAPI 0.162 runs a yield-dependency's exit code after the response is sent; the transaction commit lived there, so a fast client's next request could miss the previous record. `make demo` failed to seed ("No such person"). Fix: `Depends(connection, scope="function")`. Check: tests/test_commit_before_response.py (it failed at rounds 3 to 93 before the fix).
- **The in-process test client cannot show timing bugs.** 155 passing tests missed it because the client waits for the whole request. Use a real server for anything about ordering or timing.
- **A browser tour finds what tests do not.** Driving every slice found a duplicate heading, a duplicate accessible label, a checkbox that lagged until the server answered, and a booking confirmation wiped by a page reload. Run one after UI work.
- **Bulk edits cause collateral damage.** Moving the API under `/api/v1` with sed also rewrote import paths and the Ollama URL. Read the diff, run the build, and keep a pattern narrow.
- **Check write access early.** In the first session every GitHub write returned 403 for days (the Claude GitHub App was not installed for the repository). Test a push before a long build; a session's connection is fixed when it starts.
- **Stacked PRs and merge order.** Merge with merge commits so history survives; after each merge retarget the next PR to main; pin each merge to the head commit whose checks you read.
- **The cloud container loses PostgreSQL when the worker restarts.** Start the cluster again before any database work, and use trust authentication for local sockets.
- **Attaching another repository loads its instructions.** Registering the ASXOS checkout pulled its CLAUDE.md into the session. Treat it as reference only; ASX investment, tax and capital rules do not apply here.
- **Port first, test second is weaker than test first.** The review reducer was ported from the prototype before its API tests existed, so those tests confirm behaviour rather than drive it. Prefer red first.
- **Red-team earned its place on first use.** The operator proposed property-data research as the highest-leverage next step. `red-team` read the repo cold and showed the only real integration James has approved is model extraction with a US$50 cap (docs/handoffs/2026-11-07-intake-grilling.md, north-star), that #49 was still claimed by the shared login, and that the proposed research scope was wider than the decision it serves. The action was withdrawn before any work. Dispatch it before a large call, with sources and live state, not conclusions.
