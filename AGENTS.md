# Agent instructions

## Sources of truth

- Product direction: docs/product/north-star.md.
- Business vocabulary: GLOSSARY.md.
- Decisions, dependencies, owners and work status: GitHub Issues through docs/process/issue-tracker.md.
- Delivery: docs/process/build-loop.md.
- Host and skill translation: docs/process/agent-adapters.md.
- Resume: latest relevant docs/handoffs/ brief, then recheck live Issue/PR state.

The previous RealFlow idea and stack are retired. Do not restore its backlog, deployment configuration, schema or features by default.

## Authority

James approves intent, acceptance examples, testing seams and delivery breakdown. The named delivery owner (Claude Code or Codex) then handles routine technical choices, implementation, checks, PRs, merge and release within that scope. Verify the actual PR head before merge and the published outcome before completion. A branch-specific request overrides general merge authority: this bootstrap stays on codex/rebuild-foundation for review.

Approval is required for changes to agents' own authority, unapproved spending/external commitments, destructive production data actions and material departures from approved intent. No paid services or production infrastructure are provisioned by this bootstrap. Do not infer provider API access from a normal product subscription. Instructions are not mechanical enforcement; platform permissions and credentials still apply.

Investigate facts yourself. Use fresh-context research agents when the invoked skill requires them; otherwise delegate only when explicitly requested or required by applicable instructions. Record reversible decisions and proceed without repeated confirmation. Never read or print credentials to establish availability.

## Skills

Twelve Matt Pocock skills are pinned byte-for-byte under .claude/skills/. Relative per-skill links under .agents/skills/ expose the same files to Codex. Preserve VENDORED.json and the licence. Never edit a vendored file; put adaptations in docs/process/. Run python3 scripts/upstream_skills.py verify after import/update.

Read invoked skills. If upstream says to call the Skill tool and the host lacks it, read and follow the named SKILL.md directly. /grill-me delegates to grilling. /wayfinder maps decisions; /prototype tests a named question with throwaway code; /to-tickets creates approved complete tracer-bullet slices. Do not turn a decision ticket into a product build silently.

## Context and phase boundaries

Target roughly 40% of the active model's effective context window using reliable app/harness loaded-context and capacity information, including instructions and tool results. Do not substitute billed tokens or invent usage/capacity/monitoring. If unavailable, record context: unavailable; use one bounded verified phase per fresh chat as the conservative fallback.

Plan large epics in the existing Issue/Project as bounded phases: outcome, scope, dependencies, acceptance criteria and verification command. Finish active work and necessary verification before rollover. Update the owning Issue with evidence, decisions, blockers and next phase. Write a handoff of about 500 words maximum under docs/handoffs/, without transcripts, repeated logs or secrets. Use a supported authorized fresh-chat action containing only that handoff and standing instructions, or tell James to open a fresh chat. Compaction does not replace rollover. Never claim a window opened without verification.

## Checks

Run make check for this foundation. Product slices add meaningful behavioural checks at agreed seams. Do not add tests to throwaway prototypes or tests that merely duplicate implementation. Pin dependencies and Actions through reviewable changes. Do not enable scheduled credential-bearing builders until eligibility, permissions and halt controls are designed and verified.
