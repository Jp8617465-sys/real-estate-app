# Suggestion review prototype — 7 November 2026

## Objective

Build the throwaway prototype for [Prototype the transcript suggestion review](https://github.com/Jp8617465-sys/real-estate-app/issues/55) and put it in front of James for a verdict. Owner: Claude Code session claude-code-suggestion-review-2026-11-07 (d57b2db9), using the committed prototype skill (logic shape).

## Completed

- Claimed the ticket (assignee plus owner comment).
- `prototypes/transcript-suggestion-review.html`: one self-contained file in the hybrid A look. It loads synthetic transcript 03 (broker joins) with 57 suggestions that Claude hand-wrote from James's approved key, labelled "no model". Journey: match speakers, then review (needs your decision, then a single accept for the rest), then the applied result with gaps, next actions and a comparison against the key. Four guided walkthroughs: careful review, speed run, broker matched as family, and refused moves.
- The `IntakeReview` script block is pure and liftable. It holds the suggestion contract, quote check, speaker and commitment rules, and the apply/conflict reducer, which map to the tracer bullet's three test seams.
- The set includes the key's four conflicts, the inferred items, the broker's statements, both properties and nine next actions. It also includes six deliberate mistakes (invented "nurse", "near the train" inverted, broker's $950k as the ceiling, agent-only suburbs, an agent-only train/busway prompt, an uncommitted car-loan action) and three malformed suggestions that code drops (misquoted, wrong speaker, off-list field).

## Prototype choices for James to confirm (reversible)

- A buyer-requirement field needs a quote from a speaker matched as a household member. Finance facts, pre-approval, deposit scheme and professional relationships may come from a professional.
- A next action needs a quote from someone who owes it.
- Flagged items can only be asked of the client or rejected; there is no override.
- A suggestion that would replace a value on record needs an individual decision. Two invented web-form values (budget and Rhys's work) exercise this.
- Speakers lock once any suggestion is decided. Finishing with undecided items is allowed; nothing is written for them.

## What it showed (technical, not pilot evidence)

- Careful path: 0 slipped; 17 of 17 key items as the key expects.
- Speed run: the structural rules held back four flagged items, but the single accept carried in "nurse" and "near the train". The rules catch wrong speakers, not wrong meanings.
- Broker matched as household: the $950k ceiling stops being flagged and slips in through the bulk accept. Speaker matching is load-bearing.
- 19 of 54 suggestions need an individual decision.

## Verification

- A throwaway node harness checked that the quotes pass, the three malformed suggestions drop and all four walkthroughs give the results above.
- Headless Chrome at desktop, 768 px and a true 390 px iframe: no script errors and no page overflow.
- `make check` passed; the quote checker reported 712 quotes and 0 failures. No permanent tests were added (prototype).

## Blockers and outstanding

- James's verdict on the questions in the ticket comment. The ticket stays open and claimed.
- The role-play consultation is still not arranged.
- The API key and the tech-stack proposal are unchanged from the intake handoff.

Context: unavailable (no harness counter).

## Next action

James opens `make prototype` → http://127.0.0.1:8765/transcript-suggestion-review.html (or double-clicks the file) and runs the walkthroughs. Record his verdict on the ticket. Then close it, add a Decisions-so-far line to the map and recheck [Agree the first live tracer bullet](https://github.com/Jp8617465-sys/real-estate-app/issues/52).
