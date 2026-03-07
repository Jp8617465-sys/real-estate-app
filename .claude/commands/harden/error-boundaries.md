# Error Boundaries Audit

You are an **Error Boundaries Orchestrator** for RealFlow. You set up context, spawn `@refactoring-expert` to audit error handling completeness and generate missing code, then apply the gate decision.

## Agent Delegation

**Specialist:** `@refactoring-expert` → `subagent_type: "refactoring-expert"`

```
Task prompt: "Audit error handling completeness for $ARGUMENTS across all layers. Check: (1) every
new Fastify route in apps/api/src/routes/ has a try/catch wrapping the full handler body with
ZodError → 400, not-found → 404, and catch-all → request.log.error + 500; (2) every new engine
method in packages/business-logic/src/ rethrows Supabase errors with context message and returns
null for PGRST116 (not found); (3) every new directory in apps/web/src/app/ and apps/portal/src/app/
with a page.tsx has a corresponding error.tsx; (4) every new useMutation hook in
apps/web/src/hooks/ and apps/portal/src/hooks/ has an onError handler; (5) every new mobile screen
in apps/mobile/app/ handles isError state visibly; (6) every new call to DomainClient,
AnthropicClient, TwilioClient, or MetaSocialClient has timeout handling and graceful degradation.
For every CRITICAL and HIGH gap, generate the complete fix code — not just a description. Return
ERR-NNN findings with severity (CRITICAL/HIGH/MEDIUM/LOW), file:line, and generated fix code."
```

Agent returns: Numbered ERR-NNN findings + complete generated fix code for CRITICAL/HIGH gaps.
Orchestrator gate: Apply the generated fixes directly. CRITICAL (no try/catch on route) → **STOP** deploy. MEDIUM/LOW → apply fixes, continue.

## Context

$ARGUMENTS

## Audit Areas

### 1. Fastify Route Error Handling

For every new route handler in `apps/api/src/routes/`:

**Pattern required:**
```typescript
// ✅ Correct pattern
fastify.get('/feature/:id', async (request, reply) => {
  try {
    const { id } = paramsSchema.parse(request.params);
    const result = await engine.getById(id);
    if (!result) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error.issues,
      });
    }
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});
```

Check for:
- [ ] `try/catch` wrapping the entire handler body
- [ ] `ZodError` caught and returned as 400
- [ ] Not-found handled as 404 (not 500)
- [ ] `request.log.error(error)` called before 500 response
- [ ] No raw error messages returned to client (stack traces, DB error strings)

### 2. Business Logic Engine Error Propagation

For every new engine method in `packages/business-logic/src/`:

- [ ] Supabase errors are caught and rethrown with context: `throw new Error(\`Failed to create feature: \${error.message}\`)`
- [ ] `PGRST116` (not found) returns `null` — not thrown
- [ ] Zod parse errors propagate upward (caught by route handler)
- [ ] No silent failures (errors swallowed without logging)

### 3. Next.js Error Boundaries (Web + Portal)

For every new directory in `apps/web/src/app/` and `apps/portal/src/app/`:

```bash
# Check for missing error.tsx files
find apps/web/src/app -type d | while read dir; do
  if ls "$dir"/*.tsx &>/dev/null && [ ! -f "$dir/error.tsx" ]; then
    echo "Missing error.tsx: $dir"
  fi
done
```

Every route segment that has a `page.tsx` should have an `error.tsx`. Template:
```tsx
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-500 mb-4">{error.message}</p>
      <button onClick={reset} className="bg-indigo-600 text-white px-4 py-2 rounded-lg">
        Try again
      </button>
    </div>
  );
}
```

### 4. React Query Error Handling

For new data hooks in `apps/web/src/hooks/` and `apps/portal/src/hooks/`:

```bash
grep -n "useMutation\|useQuery" apps/web/src/ apps/portal/src/ --include="*.ts" --include="*.tsx" -r
```

For each `useMutation`:
- [ ] `onError` handler defined (shows toast/alert to user)
- [ ] Or a global error boundary catches the error

For each `useQuery`:
- [ ] `isError` state handled in the component that calls it
- [ ] Error message displayed to user (not silent failure)

### 5. Mobile Error Handling

For new screens in `apps/mobile/app/`:

- [ ] `isError` from React Query displayed to user (not just `isLoading` handled)
- [ ] Network errors handled gracefully (offline-friendly message, not crash)
- [ ] Mutation errors shown via Alert or Toast — not silent
- [ ] `try/catch` around `router.push()` calls that could fail

Pattern:
```typescript
// ✅ Correct mobile error handling
const { isLoading, isError, error, data } = useFeatureList();

if (isError) {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-red-600">{error?.message ?? 'Failed to load'}</Text>
      <TouchableOpacity onPress={() => void refetch()}>
        <Text>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 6. External API Timeouts

For any new calls to external APIs (Domain, Anthropic, Twilio, Meta):

```bash
grep -n "DomainClient\|AnthropicClient\|TwilioClient\|MetaSocialClient" \
  apps/api/src/ packages/ --include="*.ts" -r
```

Each call should have:
- [ ] A timeout configured (or confirm the client has a default timeout)
- [ ] Graceful degradation if the external API fails (don't crash the whole request)
- [ ] Error logged but not exposed to the client in raw form

## Severity Scale

| Level | Criteria |
|-------|---------|
| 🚨 CRITICAL | Route with no try/catch (crashes process), stack trace exposed to client |
| ⚠️ HIGH | Missing try/catch on DB calls, unhandled promise rejection |
| 🔶 MEDIUM | Missing error.tsx page, missing onError in mutation |
| 💡 LOW | Verbose error message, missing retry button in UI |

## Output Format

```
## Error Boundary Audit — [timestamp]

### ERR-001 ⚠️ HIGH — Missing try/catch in route handler
File: apps/api/src/routes/feature.ts:34
Issue: POST /api/v1/feature has no try/catch — DB errors cause unhandled rejection
Fix: [generated code]

### ERR-002 🔶 MEDIUM — Missing error.tsx
Path: apps/web/src/app/feature/
Issue: No error.tsx — unhandled errors show Next.js default error page
Fix: [generated error.tsx code]

### Summary: N CRITICAL, N HIGH, N MEDIUM, N LOW

### Gate Decision
PASS ✅ / BLOCKED 🚫 (N CRITICAL)
```

## Instructions

- Generate the missing code for every CRITICAL and HIGH finding — not just descriptions
- Check ALL new files (routes, engines, pages, hooks, screens) — not just the ones mentioned in `$ARGUMENTS`
- CRITICAL findings block the DEPLOY phase
- For missing `error.tsx` pages, generate the complete file content ready to copy
