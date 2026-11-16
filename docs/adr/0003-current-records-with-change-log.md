---
status: accepted
---

# Current records plus an append-only change log, not event sourcing

Agreed with James on 7 November 2026. Tables hold current values, and every change is also written to an append-only change log recording who made it, when, the old and new value, and its source: a transcript quote, an agent's own entry or a provider record. This gives each value the provenance and history the review rules require (a suggestion never silently replaces an accepted value; superseded values remain visible) without the cost of rebuilding state from events. Nothing agency-owned is hard-deleted.

**Considered options:** full event sourcing, rejected as more machinery than the audit and provenance needs justify.
