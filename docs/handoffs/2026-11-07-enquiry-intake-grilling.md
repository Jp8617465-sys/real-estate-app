# Enquiry intake grilling — 7 November 2026

## Objective

Agree how an enquiry becomes a client and a buying opportunity, up to a booked discovery call, so it can be prototyped. Owner: Claude Code session claude-code-suggestion-review-2026-11-07 (d57b2db9), using the grilling and domain-modeling skills. The session started in /Users/jpcino/real-estate-app and worked in this repository.

## Completed

- Four grilling rounds with James; he confirmed shared understanding. The decisions are on [Decide how enquiries become contacts and buying engagements](https://github.com/Jp8617465-sys/real-estate-app/issues/57), now closed: three round comments plus a resolution; where they differ, rounds 3–4 win. The map has a "Decisions so far" line and a "Not yet specified" note for delivery pipelines for each service line.
- Glossary commits 0375d1b and 2d4137f:
  - A person-first model: Person, Client (one person, the lasting record), Household (dated membership plus homes), Relationship (typed links, replacing professional relationship).
  - Opportunity is an engagement before agreement, with an opportunity pipeline; intake and sales pipeline are avoided.
  - Task covers staff work.
  - Enquiry, Relationship owner, Engagement owner and Discovery call are added.
  - The buying-service stages are James's: Brief, Research, Shortlist, Inspections, Outcomes.
- Opened [Prototype enquiry intake to a booked discovery call](https://github.com/Jp8617465-sys/real-estate-app/issues/66) as a prototype child of the map. It is unclaimed and lists its scenarios.
- Granola research (public docs, 7 November): speakers are labelled by display name, not email; attendee emails come from the calendar; the API needs a Business or Enterprise plan; data is stored only in the US. Recorded on #57.

## Key decisions

- Matching:
  - Strong match: the same email or mobile.
  - Possible match: name only.
  - Never merged silently; the owner confirms, accepts new details one at a time and picks the household.
- Routing rules, in order:
  1. Existing relationship owner.
  2. Referrer's preferred agent.
  3. Agent covering the area (skipping anyone marked away).
  4. Round-robin.
  5. Principal as fallback.
- Unknown senders go to a triage task. The first-response target alerts the fallback person when overdue.
- Acknowledgement email, response target, close reasons and assignment rules are agency settings.
- Google Workspace first. Granola is not used for real calls without Australian hosting.

## Coordination

The architecture session (a7) shares this folder. It owns [Decide the product architecture foundations](https://github.com/Jp8617465-sys/real-estate-app/issues/58), ADRs 0001–0004, the tracer-bullet spec and its build in the ../repository-slice worktree on slice/consultation-intake. It also took over getting James's verdict on [Prototype the transcript suggestion review](https://github.com/Jp8617465-sys/real-estate-app/issues/55). Each session stages only its own paths; GLOSSARY.md is edited by this session's line of work.

## Verification

make check passed before each glossary commit. The issue states, the sub-issue link and the map body were read back after editing.

## Outstanding

- Real roles and permissions (see #58).
- Delivery pipelines, the client timeline, activity logging and call capture are ticketed as [Decide the client timeline, activity logging and call capture](https://github.com/Jp8617465-sys/real-estate-app/issues/67), blocked by #66.
- Pilot evidence: no real agency walkthrough yet.

Context: unavailable (no harness counter); the conversation was long, so this rolls over.

## Next action

In a fresh chat, in this repository: read AGENTS.md, GLOSSARY.md, this handoff and #57's resolution. Recheck live state, then claim #66 and use the prototype skill. Write the hand-written synthetic enquiries and records, keep the rules in a pure module, and hand the prototype to James.
