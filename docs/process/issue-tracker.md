# Issue tracker

GitHub Issues on Jp8617465-sys/real-estate-app own decisions, dependencies and delivery status. Do not copy ASXOS repository names, bot identities or labels.

Live map: [Find the first useful buyers-agent workflow](https://github.com/Jp8617465-sys/real-estate-app/issues/47). Reuse this map.

## Wayfinding operations

Map label: wayfinder:map. Each child carries exactly one of wayfinder:research, wayfinder:prototype, wayfinder:grilling, wayfinder:task. These Issues never receive implementation triage labels.

Create native sub-issues of the map. Use native dependencies/blocked_by relations; create all Issues before wiring links. The frontier contains open, unassigned children with no open blockers. Claim through assignee before work; record stable session/owner because hosts may share one GitHub login. Shared-login assignment means occupied, not automatically yours.

Follow the Issue's type skill. Human-discussion/prototype tickets resolve with James/pilot agent, never by inventing their answer. On resolution, comment with decision/evidence/artifact branch, close, and add a one-line named link to the map's Decisions so far. Keep detailed answers on the child, not copied into the map.

Use named links rather than bare Issue numbers in prose. Do not create parallel local status trackers.

## Implementation operations

Apply ready-for-agent only after approved scope, acceptance criteria, dependencies and delivery ownership. A label is not a mechanical eligibility gate. Templates in .github/ISSUE_TEMPLATE capture the delivery contract. Use Refs #N in implementation PR descriptions so merge does not prematurely close an unpublished/unverified slice.
