---
description: Add authentication, authorization, and security to API endpoints
model: claude-sonnet-4-5
---

Add comprehensive security, authentication, and authorization to the specified API route.

## Target API Route

$ARGUMENTS

## Security Layers to Implement

### 1. **Authentication** (Who are you?)

- Verify user identity via Supabase Auth
- Token validation (JWT from Authorization header)
- Handle expired/invalid tokens

### 2. **Authorization** (What can you do?)

- Supabase RLS policies for row-level data isolation
- Role-based access control (agent, admin, client)
- Check resource ownership

### 3. **Input Validation**

- Sanitize all inputs via Zod schemas
- SQL injection prevention (Supabase parameterized queries)
- XSS prevention
- Type validation with Zod

### 4. **Rate Limiting**

- Prevent abuse
- Per-user/IP limits
- Consider Fastify rate-limit plugin

### 5. **CORS** (configured in `apps/api/src/index.ts`)

- Whitelist allowed origins
- Proper headers
- Credentials handling

## RealFlow Auth Pattern (Primary)

```typescript
import type { FastifyInstance } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';

export async function protectedRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    // 1. Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // 2. RLS handles row-level authorization automatically
    const { data, error } = await supabase.from('contacts').select('*'); // Only returns rows the user has access to via RLS

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });
}
```

## Security Checklist

**Authentication**

- Use `createSupabaseClient(request)` to get user-scoped client
- Verify with `supabase.auth.getUser()` for sensitive operations
- Handle missing/invalid tokens (401)
- Check token expiration (handled by Supabase)

**Authorization**

- RLS policies on all tables (enforced by Supabase)
- Check user roles/permissions for admin operations (403)
- Verify resource ownership for update/delete
- Log authorization failures

**Input Validation**

- Validate all inputs with Zod schemas from `@realflow/shared`
- Use Supabase parameterized queries (automatic)
- Validate UUIDs for path params
- Limit payload sizes

**Rate Limiting**

- Per-user limits for expensive operations
- Per-IP limits for public endpoints
- Clear error messages (429)
- Retry-After headers

**CORS**

- Whitelist specific origins in `apps/api/src/index.ts`
- Handle preflight requests
- Secure credentials

**Error Handling**

- Don't expose stack traces
- Generic error messages for auth failures
- Log detailed errors server-side
- Consistent `{ error: string }` format

**Logging & Monitoring**

- Log authentication attempts
- Log authorization failures
- Track suspicious activity

## RLS Policy Pattern

```sql
-- Users can only see their own data
CREATE POLICY select_own ON table_name
  FOR SELECT USING (created_by = auth.uid());

-- Users can only insert their own data
CREATE POLICY insert_own ON table_name
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Users can only update their own data
CREATE POLICY update_own ON table_name
  FOR UPDATE USING (created_by = auth.uid());
```

## What to Generate

1. **Protected Route Handler** - Secured version of the API route
2. **Auth Middleware** - Reusable auth helpers using `createSupabaseClient`
3. **RLS Policies** - SQL for row-level security
4. **Zod Schemas** - Input validation in `@realflow/shared`
5. **Error Responses** - Standardized auth errors

## Common RealFlow Auth Patterns

**Pattern 1: Standard Authenticated Route**

```typescript
// Most routes — RLS handles authorization
const supabase = createSupabaseClient(request);
const { data, error } = await supabase.from('table').select('*');
```

**Pattern 2: Admin-Only Route**

```typescript
const supabase = createSupabaseClient(request);
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) return reply.status(401).send({ error: 'Unauthorized' });

// Check admin role
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
if (profile?.role !== 'admin') {
  return reply.status(403).send({ error: 'Forbidden' });
}
```

**Pattern 3: Resource Owner Check**

```typescript
const supabase = createSupabaseClient(request);
const {
  data: { user },
} = await supabase.auth.getUser();
const { data: resource } = await supabase
  .from('table')
  .select('created_by')
  .eq('id', request.params.id)
  .single();
if (resource?.created_by !== user?.id) {
  return reply.status(403).send({ error: 'Forbidden' });
}
```

Generate production-ready, secure code that follows RealFlow's Supabase + Fastify auth patterns.
