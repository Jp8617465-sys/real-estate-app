---
description: Create a new Fastify API route with validation, error handling, and TypeScript
model: claude-sonnet-4-5
---

Create a new Fastify API route following RealFlow's best practices.

## Requirements

API Endpoint: $ARGUMENTS

## Implementation Guidelines

### 1. **Fastify Route Handler** (RealFlow pattern)
Create route in `apps/api/src/routes/` and register in `apps/api/src/index.ts`

### 2. **Validation**
- Use Zod for runtime type validation (schemas in `packages/shared/src/types/`)
- Validate input early (before DB/API calls)
- Return clear validation error messages

### 3. **Error Handling**
- Global error handling with try/catch
- Consistent error response format
- Appropriate HTTP status codes
- Never expose sensitive error details

### 4. **TypeScript**
- Strict typing for requests/responses
- Shared type definitions in `@realflow/shared`
- No `any` types

### 5. **Security**
- Use `createSupabaseClient(request)` middleware for auth
- RLS policies handle data isolation
- Input sanitization via Zod
- Rate limiting considerations

### 6. **Response Format**
```typescript
// Success
{ data: T }

// Error
{ error: string }
```

## Code Structure

Create a complete API route following this pattern:

```typescript
import type { FastifyInstance } from 'fastify';
import { CreateSchemaName, UpdateSchemaName } from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

export async function featureRoutes(fastify: FastifyInstance) {
  // List
  fastify.get<{ Querystring: { /* filters */ } }>(
    '/',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      // query with RLS
      const { data, error } = await supabase
        .from('table')
        .select('*');
      if (error) return reply.status(500).send({ error: error.message });
      return { data };
    },
  );

  // Get single
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('id', request.params.id)
      .single();
    if (error) return reply.status(404).send({ error: 'Not found' });
    return { data };
  });

  // Create
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateSchemaName.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    // insert with snake_case column mapping
    const { data, error } = await supabase
      .from('table')
      .insert({ /* mapped fields */ })
      .select()
      .single();
    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Update
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = UpdateSchemaName.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { data, error } = await supabase
      .from('table')
      .update({ ...mapped, updated_at: new Date().toISOString() })
      .eq('id', request.params.id)
      .select()
      .single();
    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // Soft delete
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { data, error } = await supabase
      .from('table')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', request.params.id)
      .select()
      .single();
    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });
}
```

## Registration

Register in `apps/api/src/index.ts`:
```typescript
import { featureRoutes } from './routes/feature';
await fastify.register(featureRoutes, { prefix: '/api/v1/feature' });
```

## Best Practices to Follow

-  Zod validation before expensive operations
-  Proper HTTP status codes (200, 201, 400, 401, 404, 500)
-  Consistent error response format
-  TypeScript strict mode
-  Minimal logic in routes (extract to `@realflow/business-logic` engines)
-  Supabase RLS for data isolation
-  Soft deletes — never hard delete
-  snake_case for DB columns, camelCase for TypeScript
- L No sensitive data in responses
- L No database queries without Zod validation
- L No inline business logic (extract to engines)

Generate production-ready code that follows the existing RealFlow patterns.
