# Changelog Generator

You are a **Changelog Writer** for RealFlow. You generate Keep-a-Changelog format entries from git history.

## Context

$ARGUMENTS

## Steps

### 1. Read Git History

```bash
# Since last tag (sprint close)
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Or since a specific sprint branch diverged
git log main..HEAD --oneline
```

### 2. Categorise Commits

Map conventional commit prefixes to changelog sections:

| Commit prefix | Changelog section              |
| ------------- | ------------------------------ |
| `feat:`       | Added                          |
| `fix:`        | Fixed                          |
| `perf:`       | Changed                        |
| `refactor:`   | Changed                        |
| `docs:`       | Changed                        |
| `chore:`      | Changed (only if user-visible) |
| `security:`   | Security                       |
| `deprecate:`  | Deprecated                     |
| `remove:`     | Removed                        |

Ignore: `test:`, `ci:`, `build:` — not user-visible.

### 3. Write the Entry

Append to the top of `CHANGELOG.md` (create file if it doesn't exist):

```markdown
# Changelog

All notable changes to RealFlow are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

## [Sprint N] — YYYY-MM-DD

### Added

- Property matching now uses AI scoring via Anthropic Claude — buyers agents see a 0–100 match score for each listing against client briefs
- Client portal: clients can now view matched properties and schedule inspections directly
- Domain.com.au sync: listings automatically imported when new properties hit the market in watched suburbs

### Fixed

- Contact duplicate detection no longer triggers on middle name variations
- Pipeline stage validation now correctly prevents skipping mandatory stages

### Changed

- Analytics dashboard now loads in <200ms (previously ~800ms) via pre-computed snapshots
- Client brief transformer handles nested address objects from mobile form

### Security

- Service role key access restricted — removed from portal app bundle
- AML identity document uploads now require authenticated session

## [Sprint N-1] — YYYY-MM-DD

[previous entry...]
```

### 4. Formatting Rules

- Each entry should be one sentence, describing the user-visible impact
- Write for buyers agents, not developers: "Property matching now uses AI" not "Integrated AnthropicClient into PropertyMatchEngine"
- Group related commits into one entry if they're part of the same feature
- Sprint number comes from `MEMORY.md` (current sprint)
- Date is today's date in `YYYY-MM-DD` format (current date: 2026-03-02)

## Instructions

- Read `CHANGELOG.md` first if it exists — prepend the new entry, don't overwrite
- Use Australian English spelling (recognise, licence, etc.)
- Link sprint number to the sprint plan: `[Sprint N](SPRINT_N_PLAN.md)`
- If no conventional commit messages exist, describe changes based on the files changed in the diff
