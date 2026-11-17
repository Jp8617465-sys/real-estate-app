# Tracer bullet breakdown — 7 November 2026

## Objective

Resolve the suggestion-review prototype, then turn the first live tracer bullet into an approved spec and tickets, ready to build. Owner: Claude Code session real-estate-app-a7 (71102e). The skills were followed from their SKILL.md files, because this session started outside the repository.

## Completed

- [Prototype the transcript suggestion review](https://github.com/Jp8617465-sys/real-estate-app/issues/55): ownership passed from d57b2db9 with that session's agreement. James's verdict is recorded and the ticket is closed.
  - The six review rules hold.
  - The single accept keeps each quote beside its value, with a reject on each row.
  - Speaker matching shows what each match unlocks and warns on speakers who sound like professionals.
  - Review time is measured in the tracer bullet.
- [Agree the first live tracer bullet](https://github.com/Jp8617465-sys/real-estate-app/issues/52): claimed. Acceptance cases are agreed. The single test seam is now the back-end API against local PostgreSQL, which covers the earlier three seams.
- [Spec: discovery-call transcript intake (first tracer bullet)](https://github.com/Jp8617465-sys/real-estate-app/issues/59) is published as a sub-issue of #52. It uses the person-first glossary at 2d4137f.
- Six ready-for-agent tickets are sub-issues of the spec, with native blockers. James approved the granularity.
  - [Create a buying opportunity that survives a restart](https://github.com/Jp8617465-sys/real-estate-app/issues/60) — first.
  - [Upload a discovery-call transcript and match speakers](https://github.com/Jp8617465-sys/real-estate-app/issues/61), after 60.
  - [Review and apply the straightforward suggestions](https://github.com/Jp8617465-sys/real-estate-app/issues/62), after 61.
  - [Decide flagged, conflicting and replacing suggestions](https://github.com/Jp8617465-sys/real-estate-app/issues/63), after 62.
  - [Score the test set with the Claude extractor](https://github.com/Jp8617465-sys/real-estate-app/issues/64), after 61.
  - [Compare a local Qwen extractor and choose the model](https://github.com/Jp8617465-sys/real-estate-app/issues/65), after 64.
- The map's Decisions so far and its next ready work are updated.
- The north star and working brief are aligned with the new glossary (ae1d18a), and a terminology note is on #58.

## Coordination

- Session real-estate-app-8c owns GLOSSARY.md and [Decide how enquiries become contacts and buying engagements](https://github.com/Jp8617465-sys/real-estate-app/issues/57). It shares the repository folder on prototype/engagement-property-review.
- Build only in the worktree ../repository-slice on slice/consultation-intake. Never check out branches in the shared folder.
- Stage explicit paths only.

## Prerequisites

- Python 3.12 is installed via Homebrew. uv and PostgreSQL 17 are missing; the delivery owner installs both via Homebrew as part of ticket 60 (free, local).
- James sets up the Claude API account (US$50 prepaid, auto-reload off) and configures the key before any paid run in ticket 64. Agents never read or print it.
- Ollama and Qwen3.5-9B are installed before ticket 65.

## Verification

- `make check` passed before commit.
- Read back: the issue states, the sub-issues of #59 and their blockers, and the map's next ready work.

Context: unavailable (no harness counter). The session rolled over at a phase boundary before the build.

## Next action

Start a fresh Claude Code session in ../repository-slice, so the committed skills load as slash commands. Then:
1. Fast-forward the branch to prototype/engagement-property-review.
2. Recheck the live state of #60.
3. Build ticket 60 with the tdd skill.
