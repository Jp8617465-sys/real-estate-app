# Client Brief Transformer Usage Guide

## Overview

The Client Brief transformer (`client-brief-transformer.ts`) solves the critical schema mismatch between the nested Zod schema (`ClientBrief`) and the flat PostgreSQL database schema (`client_briefs` table).

## The Problem

**Zod Schema (Nested):**
```typescript
{
  budget: {
    min: 500000,
    max: 750000,
    absoluteMax: 800000,
    stampDutyBudgeted: true
  },
  finance: {
    preApproved: true,
    preApprovalAmount: 750000,
    // ... 7 more fields
  },
  requirements: {
    bedrooms: { min: 3, ideal: 4 },
    bathrooms: { min: 2, ideal: 2 },
    // ... nested location, preferences, etc.
  }
}
```

**Database Schema (Flat + JSONB):**
```typescript
{
  budget_min: 500000,
  budget_max: 750000,
  budget_absolute_max: 800000,
  stamp_duty_budgeted: true,
  pre_approved: true,
  pre_approval_amount: 750000,
  bedrooms_min: 3,
  bedrooms_ideal: 4,
  bathrooms_min: 2,
  bathrooms_ideal: 2,
  suburbs: [...], // JSONB
  max_commute: {...}, // JSONB
  investor_criteria: {...} // JSONB
}
```

## API Usage

### Writing to Database (Insert/Update)

```typescript
import { toDbSchema } from '@realflow/business-logic';
import type { ClientBrief } from '@realflow/shared';

// Transform nested Zod schema to flat database schema
const clientBrief: ClientBrief = { /* ... */ };
const dbRow = toDbSchema(clientBrief);

// Now insert to database
const { data, error } = await supabase
  .from('client_briefs')
  .insert(dbRow)
  .select()
  .single();
```

### Reading from Database (Select)

```typescript
import { fromDbSchema } from '@realflow/business-logic';
import type { ClientBriefDbRow } from '@realflow/business-logic';

// Read from database
const { data, error } = await supabase
  .from('client_briefs')
  .select('*')
  .eq('id', briefId)
  .single();

// Transform flat database schema to nested Zod schema
const clientBrief = fromDbSchema(data as ClientBriefDbRow);

// Now clientBrief has proper nested structure
console.log(clientBrief.budget.min); // 500000
console.log(clientBrief.finance.preApproved); // true
console.log(clientBrief.requirements.bedrooms.ideal); // 4
```

## Frontend Hook Usage

### React Query Hook (Web/Mobile)

```typescript
import { useQuery } from '@tanstack/react-query';
import { fromDbSchema } from '@realflow/business-logic';
import type { ClientBriefDbRow } from '@realflow/business-logic';
import { supabase } from '../lib/supabase';

export function useClientBrief(briefId: string) {
  return useQuery({
    queryKey: ['client-brief', briefId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_briefs')
        .select('*')
        .eq('id', briefId)
        .eq('is_deleted', false)
        .single();

      if (error) throw error;

      // Transform to nested schema
      return fromDbSchema(data as ClientBriefDbRow);
    },
    enabled: !!briefId,
  });
}
```

### Mutation Hook (Web/Mobile)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toDbSchema, fromDbSchema } from '@realflow/business-logic';
import type { ClientBrief, CreateClientBrief } from '@realflow/shared';
import { supabase } from '../lib/supabase';

export function useCreateClientBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (brief: CreateClientBrief) => {
      // Transform to database schema
      const dbRow = toDbSchema({
        id: crypto.randomUUID(),
        ...brief,
        briefVersion: 1,
        clientSignedOff: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as ClientBrief);

      const { data, error } = await supabase
        .from('client_briefs')
        .insert(dbRow)
        .select()
        .single();

      if (error) throw error;

      // Transform back to nested schema
      return fromDbSchema(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-briefs'] });
    },
  });
}
```

## Fastify API Route Usage

### Example: List Briefs

```typescript
import { fromDbSchema } from '@realflow/business-logic';
import type { ClientBriefDbRow } from '@realflow/business-logic';

fastify.get('/', async (request, reply) => {
  const supabase = createSupabaseClient(request);

  const { data, error } = await supabase
    .from('client_briefs')
    .select('*')
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false });

  if (error) return reply.status(500).send({ error: error.message });

  // Transform each row to nested schema
  const briefs = (data as ClientBriefDbRow[]).map(fromDbSchema);

  return { data: briefs };
});
```

### Example: Create Brief

```typescript
import { toDbSchema } from '@realflow/business-logic';
import { CreateClientBriefSchema } from '@realflow/shared';

fastify.post('/', async (request, reply) => {
  const supabase = createSupabaseClient(request);
  const parsed = CreateClientBriefSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  // Transform to database schema
  const dbRow = toDbSchema({
    id: crypto.randomUUID(),
    ...parsed.data,
    briefVersion: 1,
    clientSignedOff: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const { data, error } = await supabase
    .from('client_briefs')
    .insert(dbRow)
    .select()
    .single();

  if (error) return reply.status(500).send({ error: error.message });

  // Transform back to nested schema
  return reply.status(201).send({ data: fromDbSchema(data) });
});
```

### Example: Update Brief

```typescript
import { toDbSchema, fromDbSchema } from '@realflow/business-logic';
import { UpdateClientBriefSchema } from '@realflow/shared';

fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
  const supabase = createSupabaseClient(request);
  const { id } = request.params;
  const parsed = UpdateClientBriefSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  // Fetch current brief
  const { data: current, error: fetchError } = await supabase
    .from('client_briefs')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (fetchError || !current) {
    return reply.status(404).send({ error: 'Client brief not found' });
  }

  // Reconstruct current brief
  const currentBrief = fromDbSchema(current);

  // Merge updates
  const updatedBrief = {
    ...currentBrief,
    ...parsed.data,
    briefVersion: currentBrief.briefVersion + 1,
    updatedAt: new Date().toISOString(),
  };

  // Transform to database schema
  const dbRow = toDbSchema(updatedBrief);

  const { data, error } = await supabase
    .from('client_briefs')
    .update(dbRow)
    .eq('id', id)
    .select()
    .single();

  if (error) return reply.status(500).send({ error: error.message });

  return { data: fromDbSchema(data) };
});
```

## Key Points

### Field Mapping

- **Flat columns**: Directly mapped with snake_case (e.g., `budget_min`, `bedrooms_ideal`)
- **JSONB columns**: Preserved as-is (e.g., `suburbs`, `max_commute`, `investor_criteria`)
- **Arrays**: PostgreSQL arrays (e.g., `property_types[]`, `must_haves[]`)

### Optional Nested Objects

The transformer intelligently handles optional nested objects:

- **`landSize`**: Only reconstructed if `land_size_min` or `land_size_max` is non-null
- **`buildingAge`**: Only reconstructed if `building_age_min` or `building_age_max` is non-null
- **`solicitor`**: Only reconstructed if ANY solicitor field is non-null

### Data Integrity

The transformer maintains bidirectional transformation integrity:

```typescript
const original: ClientBrief = { /* ... */ };
const dbRow = toDbSchema(original);
const reconstructed = fromDbSchema(dbRow);

// reconstructed === original (structurally equivalent)
```

## Testing

Run the comprehensive test suite:

```bash
cd packages/business-logic
npm test -- client-brief-transformer.test.ts
```

Tests cover:
- Complete field mapping (60+ fields)
- Optional field handling
- Nested object reconstruction
- JSONB preservation
- Bidirectional transformation integrity
- Edge cases (partial nested objects)

## Files to Update

When integrating the transformer, update these files:

### API
- `apps/api/src/routes/client-briefs.ts` (6 read operations, 2 write operations)

### Web App
- `apps/web/src/hooks/use-client-briefs.ts`

### Mobile App
- `apps/mobile/src/hooks/use-client-briefs.ts`

### Portal App
- `apps/portal/src/hooks/use-brief.ts`
- `apps/portal/src/hooks/use-portal-dashboard.ts`

## Migration Checklist

- [ ] Update API routes to use `toDbSchema` for writes
- [ ] Update API routes to use `fromDbSchema` for reads
- [ ] Update frontend hooks to use `fromDbSchema` for queries
- [ ] Update frontend hooks to use `toDbSchema` for mutations
- [ ] Run all tests to verify transformations
- [ ] Test end-to-end create/read/update flows
- [ ] Verify JSONB fields (suburbs, max_commute, investor_criteria) work correctly
