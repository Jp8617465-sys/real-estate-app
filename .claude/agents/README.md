# Specialist agents

Advisory, read-only unless noted. The operator (arbi) is the main loop and does the fan-out, implements and lands the work; none of these lists the Agent tool. Adapted from the ASXOS roster at asxos 6fd1fd0 with its ASX investment, tax and portfolio agents left out.

| Agent | Dispatch before or when |
|---|---|
| system-architect | a new module, a cross-module dependency, an integration port, any structural change |
| backend-architect | an API route, schema or migration, auth pattern, or write path |
| security-engineer | anything touching secrets, external input, dependencies, integrations, or personal or identity data (must be used) |
| frontend-architect | a substantial UI change or interface review |
| technical-writer | docs, runbooks, API docs, ADRs or handoffs change (writes docs only) |
| deep-research-agent | provider, API, regulatory or library questions that need cited research |
| red-team | a large call, or when the last ONE THING did not land |

Fresh-context rule from AGENTS.md: give an agent the scoped question, the paths and the constraints, not your conclusion, and treat what it returns as findings to check.
