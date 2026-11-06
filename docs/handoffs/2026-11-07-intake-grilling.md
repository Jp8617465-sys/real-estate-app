# Intake grilling — 7 November 2026

## Objective

Ideate conversation-to-record intake and the review journey with James, then agree the first tracer bullet's scope and model route. Owner: Claude Code session claude-code-intake-grilling-2026-11-07 (grilling and domain-modeling skills read directly from .claude/skills/, because the session started outside this repo).

## Completed

- Grilling reached shared understanding, which James confirmed. All decisions are recorded on [Decide how consultation transcripts become reviewed records](https://github.com/Jp8617465-sys/real-estate-app/issues/54), now closed, with a gist on the map's Decisions so far.
- Glossary (commit 0a9c0e2): engagement from first enquiry, avoid "opportunity"; profile versus brief boundary; Professional plus a narrower Professional relationship; Next action.
- New map children: [Prototype the transcript suggestion review](https://github.com/Jp8617465-sys/real-estate-app/issues/55) (prototype) and [Draft the synthetic consultation test set](https://github.com/Jp8617465-sys/real-estate-app/issues/56) (task). The test set is done and closed: seven independently drafted transcripts, James-approved answer keys, fourteen answer-key rules (expected/RULES.md) and a quote checker, under testdata/intake-consultations (d8bdf6a).
- [Agree the first live tracer bullet](https://github.com/Jp8617465-sys/real-estate-app/issues/52): agreed scope noted in a comment. It is now blocked by the two new tickets instead of property-data research and the pilot prototype test; the reason is explained there, and the edges can be reverted.
- Map Not yet specified: AML/CTF-driven identification checks; moving to AWS in Australia before any real transcript.
- Working brief and north star no longer say the route is TBC.

## Key decisions (detail on the decision ticket)

Start with the initial consultation, from text transcripts only. Speakers are matched first. Suggestions only, each with a verbatim quote, speaker and stated/inferred mark that code verifies. The person on the call reviews; conflicts are always shown; precision beats recall. Test material is independently drafted synthetic transcripts that James checks; the pass bar is agreed. Tracer bullet: local single-user app, swappable extraction step, tests at three seams, review prototype first. Real client conversations are processed only in Australia. For now: Claude API with test material only, Opus/Sonnet/Haiku 5.5 versus local Qwen3.5-9B, US$50 cap.

## Verification

make check passed before every commit; the quote checker reports 712 quotes, 0 failures. Issue states, sub-issues, the tracer bullet's blockers and the map body were read back after editing.

## Blockers and outstanding

- James: create a Claude API account with US$50 prepaid credits, auto-reload off, and configure the key himself; agents never read or print it. Install Ollama and Qwen3.5-9B when the comparison starts.
- Role-played consultation: likely, not arranged.
- The tech stack for the tracer bullet is to be proposed for James's approval.
- This session ran from /Users/jpcino/real-estate-app (main, retired RealFlow CLAUDE.md). Start future sessions in this repository so the committed skills and AGENTS.md load.

## Next action

Claim [Prototype the transcript suggestion review](https://github.com/Jp8617465-sys/real-estate-app/issues/55), the only remaining blocker of the tracer bullet. Use the committed prototype skill. Start from one transcript and its approved answer key; hand-write suggestions labelled "no model" that include the key's conflicts and traps. Follow expected/RULES.md.

Context: James reported about 20% used; no harness counter is available to the agent.
