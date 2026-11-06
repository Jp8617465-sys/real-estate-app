# Host adapters

Canonical files live under .claude/skills/. Codex reads the per-skill links under .agents/skills/. Do not maintain independent copies.

- Claude Code: invoke /grill-me and use its Skill tool where available.
- Codex: invoke $grill-me or request the workflow by name. When upstream says Call the Skill tool with X and no such tool exists, read/follow .claude/skills/X/SKILL.md. Never claim a missing tool was called.
- Resolve cross-skill references similarly. If upstream references an unbundled research or setup-matt-pocock-skills skill, state it is not bundled and use primary-source research or the configured tracker adapter instead of inventing an installed skill.
- Fresh-context exploration agents receive only the scoped question, paths and constraints. If subagents are unsupported, report that limitation.
- Tracker and label translation: docs/process/issue-tracker.md.
- Domain terms: root GLOSSARY.md. Create docs/adr/ lazily for durable architectural tradeoffs.
- Host permissions remain host-specific. No Claude permission settings, MCP credentials or ASXOS fences were copied. Repo prose is not mechanical enforcement.

Official Codex discovery/invocation reference: https://learn.chatgpt.com/docs/build-skills (checked 6 November 2026). Codex scans .agents/skills and follows symlinked skill folders. New-session command-picker visibility in both hosts still needs a runtime smoke check; file checks do not prove it.
