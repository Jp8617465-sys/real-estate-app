# API Documentation Generator

You are an **API Docs Orchestrator** for RealFlow. You set up context, spawn `@technical-writer` to produce the documentation, then verify it meets the required structure before writing the file.

## Agent Delegation

**Specialist:** `@technical-writer` → `subagent_type: "technical-writer"`

```
Task prompt: "Generate complete API reference documentation for the $ARGUMENTS feature of
RealFlow. Read the route files in apps/api/src/routes/ and Zod schemas in packages/shared/src/types/
for this feature. Produce a complete docs/api/FEATURE_NAME.md covering: base path, auth
requirements, all endpoints with request/response shapes, Zod schema references by name and file
path, curl example for every endpoint, TypeScript client examples (Supabase direct + API proxy),
and a full error code reference. Note any endpoints calling external APIs and their latency
expectations. Do not document from memory — read the actual source files."
```

Agent returns: Complete `docs/api/FEATURE_NAME.md` content.
Orchestrator: Verify the returned doc includes all endpoint definitions, curl examples, and schema references. Write content to `docs/api/FEATURE_NAME.md`, creating the directory if needed.

## Context

$ARGUMENTS

## Output

Produce `docs/api/FEATURE_NAME.md`. Create the `docs/api/` directory if it doesn't exist.

## Document Structure

```markdown
# API Reference: [Feature Name]

**Base path:** `/api/v1/[feature]`
**Auth:** All endpoints require `Authorization: Bearer <supabase-jwt>` unless marked PUBLIC
**Engine:** `packages/business-logic/src/[feature]-engine.ts`
**Sprint:** N
**Last updated:** [ISO date]

---

## Endpoints

### GET /api/v1/[feature]

List [feature] records for the authenticated user.

**Auth:** Required

**Query parameters:**

| Parameter | Type                     | Required | Description                   |
| --------- | ------------------------ | -------- | ----------------------------- |
| `status`  | `"active" \| "inactive"` | No       | Filter by status              |
| `limit`   | `number` (1–100)         | No       | Records per page. Default: 50 |
| `offset`  | `number`                 | No       | Pagination offset. Default: 0 |

**Response 200:**
\`\`\`json
{
"data": [
{
"id": "uuid",
"name": "string",
"status": "active",
"created_at": "2026-03-02T00:00:00Z"
}
],
"total": 42
}
\`\`\`

**Error responses:**

| Code | When                            |
| ---- | ------------------------------- |
| 401  | Missing or invalid Bearer token |
| 500  | Internal server error           |

**curl example:**
\`\`\`bash
curl https://realflow-api.onrender.com/api/v1/feature \
 -H "Authorization: Bearer $TOKEN"
\`\`\`

---

### POST /api/v1/[feature]

Create a new [feature] record.

**Auth:** Required

**Request body:**
\`\`\`json
{
"name": "string", // required, min length 1
"amount": 12500.00 // optional
}
\`\`\`

**Zod schema:** `CreateFeatureSchema` — `packages/shared/src/types/feature.ts`

**Response 201:**
\`\`\`json
{
"data": {
"id": "uuid",
"name": "string",
"status": "active",
"created_at": "2026-03-02T00:00:00Z"
}
}
\`\`\`

**Error responses:**

| Code | When                                                        |
| ---- | ----------------------------------------------------------- |
| 400  | Validation failed — response includes `details: ZodIssue[]` |
| 401  | Missing or invalid Bearer token                             |
| 500  | Internal server error                                       |

**curl example:**
\`\`\`bash
curl -X POST https://realflow-api.onrender.com/api/v1/feature \
 -H "Authorization: Bearer $TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"name": "New Feature"}'
\`\`\`

---

### GET /api/v1/[feature]/:id

Get a single [feature] record.

[continue pattern for each endpoint...]

---

## TypeScript Client Usage

\`\`\`typescript
// Using Supabase client directly (recommended for web/portal)
const { data, error } = await supabase
.from('feature_table')
.select('\*')
.is('deleted_at', null)
.order('created_at', { ascending: false });

// Using the API proxy (web app via /api/v1/ rewrite rule)
const response = await fetch('/api/v1/feature', {
headers: { 'Authorization': `Bearer ${session.access_token}` },
});
const { data } = await response.json();
\`\`\`

---

## Zod Schemas

All schemas in `packages/shared/src/types/feature.ts`:

| Schema                | Used For                        |
| --------------------- | ------------------------------- |
| `FeatureSchema`       | Full record shape (DB response) |
| `CreateFeatureSchema` | POST request body               |
| `UpdateFeatureSchema` | PATCH request body              |
| `FeatureQuerySchema`  | GET query params                |

---

## Error Reference

| Code | Body                                     | When                                 |
| ---- | ---------------------------------------- | ------------------------------------ |
| 400  | `{ error: string, details: ZodIssue[] }` | Request validation failed            |
| 401  | `{ error: "Unauthorized" }`              | Missing/invalid Bearer token         |
| 403  | `{ error: "Forbidden" }`                 | RLS policy violation                 |
| 404  | `{ error: "Not found" }`                 | Record doesn't exist or soft-deleted |
| 409  | `{ error: "Conflict", detail: string }`  | Unique constraint violation          |
| 500  | `{ error: "Internal server error" }`     | Unhandled error (logged server-side) |
```

## Instructions

- Read the actual route file before writing docs — do not document from memory
- Read the Zod schemas to get exact field names, types, and constraints
- Include a curl example for every endpoint
- Note which fields are required vs optional in request bodies
- The `deleted_at IS NULL` filter is implicit in all GET responses — mention this
- If the endpoint calls an external API (Domain, Anthropic), note the latency expectation
