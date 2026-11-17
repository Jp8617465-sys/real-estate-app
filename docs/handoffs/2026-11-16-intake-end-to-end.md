# Discovery-call intake end to end — 16 November 2026

## Objective

James asked the software factory to build a working end-to-end prototype. Owner: a Claude Code cloud session (session_0125Wa6L7QiJd2bhUjMnUw3o) on branch claude/clever-fermi-cvpwha, merged from slice/consultation-intake. It continues the walking skeleton from [Create a buying opportunity that survives a restart](https://github.com/Jp8617465-sys/real-estate-app/issues/60) through issues 61, 62, 63 and 64 of the approved tracer-bullet spec ([Spec](https://github.com/Jp8617465-sys/real-estate-app/issues/59)). Synthetic material only.

## What works (run `make setup`, `make run`, open http://127.0.0.1:8000)

Create an opportunity → upload a .vtt/.srt/.txt/.md transcript or paste notes → match speakers (what each match unlocks; warning on professional-sounding speakers) → review (decision items first; flagged items only Ask or Reject; earlier value, disagreement and replace-on-record handling; accept the rest; edit; undo; speakers lock) → finish → applied brief, not-covered list, next actions with owners and due dates → engagement record with each value's source and history. Everything survives a restart.

Extraction is behind one port. The scripted adapter replays the prototype's 57 suggestions for transcript 03 and the approved answer keys for the other six. The Claude adapter (`BUYERS_DESK_EXTRACTOR=claude`, `BUYERS_DESK_CLAUDE_MODEL`) is written and tested only against a stand-in client.

## Verification

`make check` passes: factory checks, mypy strict, 68 API tests at the one agreed seam (real PostgreSQL), generated-client drift check, front-end build. `make score-keys` replays the seven answer keys through the scorer: passes the bar (95/95 key items, 206/206 others). Deliberate faults fail it (tests). A headless-browser run drove the whole journey, including the notes paths, with no console errors.

## Decisions (reversible)

- Review decisions are saved as made; nothing reaches the record until Finish. Undo exists only before Finish.
- Notes sources treat the agent's lines as carrying household facts (they report what the clients said).
- Accepted values live in one `record_values` table by section, with value history; people and professionals are created at Finish. A professional speaker is linked to the engagement; a professional only mentioned in a suggestion is recorded as a value, not a linked person (gap).
- The scorer is deterministic: an embellished value on an otherwise correct item (an invented job title) is not detected. James's reading of the report is still the check.
- The professional-sounding warning is a keyword heuristic; it fires on some buyers who discuss loans a lot (soft warning only).
- The reducer was ported from the prototype before its API tests were written, so the 63/62 tests confirm behaviour rather than drive it.

## Not done / blocked

- **GitHub writes are refused for this session (403 on push and on issue comments).** The commit is local only; no issue or PR was updated. Fix: reconnect GitHub at claude.ai/connect-github and install the Claude GitHub App on the repository, then push the branch and update issues 60 to 64.
- Paid scored run (issue 64): needs James's Claude API account and key; this session did not read or use any key. Run `cd api && uv run python -m buyers_desk.scored_run --model claude-sonnet-5-5` (asks first; ledger refuses past US$50). Model price table is from the 3 November 2026 list.
- Local Qwen comparison (issue 65): the Ollama adapter and `scored_run --ollama qwen3.5:9b` are built and tested against a stand-in server only. James still has to install Ollama, pull the model and run it on his Mac. Select it in the app with `BUYERS_DESK_EXTRACTOR=ollama`.
- Real-pilot validation and James's dated walkthrough of issues 61 to 64 remain.
- Built on PostgreSQL 16 in a Linux container with local trust auth; the spec says 17 on James's Mac.
- CI now also runs the full `make check` against the runner's PostgreSQL 16 (job `full`, passed on 17 November 2026). It adds no new Actions; uv is pinned to 0.13.6.

Context: unavailable (no harness counter). Next: James runs and accepts the walkthrough; fix GitHub access, push, update the tickets; start [Compare a local Qwen extractor](https://github.com/Jp8617465-sys/real-estate-app/issues/65) or the paid run.
