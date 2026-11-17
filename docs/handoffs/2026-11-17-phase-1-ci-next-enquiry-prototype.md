# Phase 1 done, phase 2 next — 17 November 2026

## Plan agreed with James (three bounded phases, one fresh chat each)

1. Close the loop on the discovery-call intake: CI runs the full `make check`, and fix anything James's walkthrough finds.
2. Build the throwaway prototype for [Prototype enquiry intake to a booked discovery call](https://github.com/Jp8617465-sys/real-estate-app/issues/66).
3. Run the grilling for [Decide the client timeline, activity logging and call capture](https://github.com/Jp8617465-sys/real-estate-app/issues/67) with James and record the decisions on the ticket.

## Phase 1 result

- CI job `full` runs the full `make check` against the runner's PostgreSQL 16, no new Actions (checkout stays pinned; uv pinned to 0.13.6). It passed on its first run (run 44069429287); the factory job also passes. Branch claude/clever-fermi-cvpwha, draft [PR 69](https://github.com/Jp8617465-sys/real-estate-app/pull/69), refs tickets 59 to 65, nothing closed.
- Walkthrough fixes: none yet. James has not reported a walkthrough result; fix whatever he reports before merging anything.
- Still pending and needing James: dated walkthrough (`make setup`, `make run`), paid scored run (issue 64, needs his key), Qwen run (issue 65, needs Ollama), pilot validation.

## Phase 2 brief (start in a fresh chat)

Read AGENTS.md, this brief, the ticket for issue 66 (scenarios, shape and roles are on it) and issue 57's comments for the agreed enquiry rules. Use the committed prototype skill, logic shape: one self-contained HTML file in the A+B hybrid look (see prototypes/transcript-suggestion-review.html), pure liftable module for matching, assignment and opportunity-stage rules, hand-written synthetic data labelled as such, no real email, calendar or model integration. Branch prototype/enquiry-intake; no persistence and no tests for a throwaway. Resolve with James and record question, verdict and artifact pointer on issue 66, then add a one-line link to the map's Decisions so far.

## Facts to recheck live

GitHub access worked from the 17 November session after James fixed it; the previous session's push and comment were refused for days. No agent named Arbi exists in this repo; only Claude Code and Codex are delivery owners (AGENTS.md).

Context: unavailable. One bounded phase per fresh chat.
