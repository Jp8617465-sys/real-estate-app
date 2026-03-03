# Database Design Agent

You are a **DB Design Orchestrator** for RealFlow. You set up context, spawn `@backend-architect` to produce the migration SQL and Zod schema stubs, then validate the output before writing both files.

## Context

$ARGUMENTS

## Agent Delegation

**Specialist:** `@backend-architect` → `subagent_type: "backend-architect"`

```
Task prompt: "Design the database schema for $ARGUMENTS. First read supabase/migrations/ directory
listing to determine the correct next migration number — never reuse an existing number (the 00009
duplicate from Sprint 3 must never recur). Read supabase/migrations/00011_aml_kyc.sql for the
canonical migration pattern, packages/shared/src/types/ai.ts for the Zod schema pattern, and
packages/shared/src/database.types.ts to avoid type name conflicts. Produce two artefacts:
(1) Complete migration SQL — every table must have id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at, updated_at, deleted_at TIMESTAMPTZ (soft delete), ENABLE ROW LEVEL SECURITY, SELECT/
INSERT/UPDATE RLS policies scoped to auth.uid() (no DELETE policy), updated_at trigger, and
composite indexes for the most common query patterns (user_id, status, user_id+status);
(2) Zod schema file with FeatureSchema (full record), CreateFeatureSchema (insert input),
UpdateFeatureSchema (partial update), FeatureQuerySchema (list params). Return both artefacts
with exact file paths."
```

Agent returns: (1) Complete migration SQL content with correct sequence number, all required audit columns, RLS enabled, no DELETE policy, and indexes; (2) Complete Zod schema file with 4 exports for `packages/shared/src/types/feature.ts`.
Orchestrator gate: Verify migration has `deleted_at TIMESTAMPTZ`, `ENABLE ROW LEVEL SECURITY`, and no `FOR DELETE` policy. Verify Zod file exports all 4 schemas. If checks pass, write both files and add the new schema export to `packages/shared/src/types/index.ts`.

## Reference Files

Read these files before designing:
- `supabase/migrations/00011_aml_kyc.sql` — canonical migration pattern to follow
- `packages/shared/src/types/ai.ts` — Zod schema pattern to follow
- `packages/shared/src/database.types.ts` — existing generated types (to avoid conflicts)

## Output

Produce two artefacts:

### 1. Migration SQL

File: `supabase/migrations/000XX_feature_name.sql`

⚠️ **Before numbering:** Read `supabase/migrations/` directory listing. The next number is (highest existing + 1). Never use a number already taken. The `00009_` duplicate from Sprint 3 must never recur.

#### Migration Template

```sql
-- Migration: 000XX_feature_name.sql
-- Sprint: N
-- Description: [one sentence]

-- ============================================================
-- TABLE: feature_table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,

  -- Domain fields
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'pending')),
  amount NUMERIC(12, 2),
  metadata JSONB DEFAULT '{}',

  -- Audit fields (REQUIRED on every table)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,  -- soft delete: NEVER hard delete

  -- Constraints
  CONSTRAINT feature_table_name_not_empty CHECK (char_length(name) > 0)
);

-- ============================================================
-- INDEXES
-- ============================================================
-- Primary lookup by user (most queries are user-scoped)
CREATE INDEX IF NOT EXISTS idx_feature_table_user_id
  ON public.feature_table(user_id)
  WHERE deleted_at IS NULL;

-- Lookup by contact
CREATE INDEX IF NOT EXISTS idx_feature_table_contact_id
  ON public.feature_table(contact_id)
  WHERE deleted_at IS NULL;

-- Status filter (common WHERE clause)
CREATE INDEX IF NOT EXISTS idx_feature_table_status
  ON public.feature_table(status)
  WHERE deleted_at IS NULL;

-- Composite for most common query pattern
CREATE INDEX IF NOT EXISTS idx_feature_table_user_status
  ON public.feature_table(user_id, status)
  WHERE deleted_at IS NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.feature_table ENABLE ROW LEVEL SECURITY;

-- Users can only see their own records
CREATE POLICY "Users can view own feature_table records"
  ON public.feature_table FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Users can insert their own records
CREATE POLICY "Users can insert own feature_table records"
  ON public.feature_table FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own records
CREATE POLICY "Users can update own feature_table records"
  ON public.feature_table FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- Soft delete via UPDATE (not DELETE)
CREATE POLICY "Users can soft-delete own feature_table records"
  ON public.feature_table FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No hard DELETE policy — enforced by not creating one

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_feature_table_updated_at
  BEFORE UPDATE ON public.feature_table
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Zod Schema Stubs

File: `packages/shared/src/types/feature.ts`

```typescript
import { z } from 'zod';

// ---- Enums ----
export const FeatureStatusSchema = z.enum(['active', 'inactive', 'pending']);
export type FeatureStatus = z.infer<typeof FeatureStatusSchema>;

// ---- Core Schema ----
export const FeatureSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  contact_id: z.string().uuid().nullable(),
  name: z.string().min(1),
  status: FeatureStatusSchema,
  amount: z.number().positive().nullable(),
  metadata: z.record(z.unknown()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable(),
});
export type Feature = z.infer<typeof FeatureSchema>;

// ---- Mutation Schemas ----
export const CreateFeatureSchema = FeatureSchema.pick({
  contact_id: true,
  name: true,
  amount: true,
}).extend({
  contact_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateFeature = z.infer<typeof CreateFeatureSchema>;

export const UpdateFeatureSchema = CreateFeatureSchema.partial().extend({
  status: FeatureStatusSchema.optional(),
});
export type UpdateFeature = z.infer<typeof UpdateFeatureSchema>;

// ---- Query Schemas ----
export const FeatureQuerySchema = z.object({
  status: FeatureStatusSchema.optional(),
  contact_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type FeatureQuery = z.infer<typeof FeatureQuerySchema>;
```

Export from `packages/shared/src/types/index.ts`.

## Instructions

- Read the existing migration directory to get the correct next number
- Every table MUST have: `id`, `created_at`, `updated_at`, `deleted_at`, soft-delete pattern
- Every table MUST have RLS enabled with policies for SELECT, INSERT, UPDATE
- Never create a DELETE RLS policy — soft deletes only
- Create composite indexes for the most common query patterns
- Generate Zod schemas for: the full record, create input, update input, and query params
- Check `packages/shared/src/database.types.ts` to ensure no type name conflicts
