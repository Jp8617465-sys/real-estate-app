# Arbi tuned; ready to build in a new session — 18 November 2026

## Objective

Optimise the operator (arbi) and the software factory for this product, then hand over for a fresh build session (James: "then we will build in a new session").

## Completed

- Everything from the Buy Well trial spec (slices 1 to 9), the operator role, the extra skills and agents and a commit-timing fix are merged to main; CI is green. Nothing is open on GitHub apart from this docs PR.
- Real `CLAUDE.md` (stack, commands, the one test seam, rules that are easy to break, landing), `docs/process/lessons.md` (this session's findings), and `build-loop.md` aligned with the operator role.
- `/arbi` run once for real. Live state: no open PRs; frontier is #66 (unassigned throwaway prototype) and #67 (needs James); #49 is still assigned to the shared login.

## Decision record

DECISION: What to do next, after `/arbi`.
TAKING: Nothing autonomous on #49 or #66 this wake; hand the choice to the next session with James.
REVERSAL: None needed; no work was started.
`red-team` CHALLENGED my proposed action (#49 provider research): the only integration James approved is Claude extraction (US$50 cap, first tracer bullet); #49 is claimed and I had not read its comments or recorded the claim's release; the research scope was wider than the decision it serves; #66 was dismissed for the property that makes it claimable. The challenge stands; the action was withdrawn.

## First thing for the next session

Ask James which comes first (his answer is the ONE THING):
1. His `make demo` walkthrough on the Mac, then fix what he finds (the acceptance for #71 and #59 to #65).
2. The paid scored run for issue 64 (needs his API key; asks before spending; US$50 cap) — the first live integration he approved.
3. #66, the throwaway enquiry-intake prototype (the next phase of the 17 November plan; unassigned).
4. #49 property-data research, only after he releases or confirms the stale claim, pinned to one provider (Cotality is the candidate): access, redistribution and caching terms, whether it supplies observation dates.

## Not done / needs James

- `.claude/settings.json` with permissions and a secrets-guard hook (his to merge); a `main` ruleset requiring the `full` check (needed before any auto-merge); halt controls (needed before any scheduled builder).
- The decisions on #67 and the pipeline stage names.

## Verification

`make check` and CI `full` green on main at the last merge; this PR is docs only (`make check-factory`).

Context: unavailable. One bounded phase per fresh chat.
