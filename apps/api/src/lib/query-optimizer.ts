/**
 * API Query Optimization Utilities
 *
 * Provides helpers for efficient database querying:
 * - Cursor-based and offset-based pagination
 * - Field selection (return only what the view needs)
 * - Eager loading to avoid N+1 queries
 * - Query result count caching
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { cache } from './cache';

// ─── Query Builder Interfaces ───────────────────────────────────────────────────

/** Minimal structural type for a pre-filtered Supabase query ready for ordering and paging. */
interface FilterableQuery extends PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> {
  order(column: string, options?: { ascending?: boolean }): FilterableQuery;
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
  limit(count: number): FilterableQuery;
  or(filter: string): FilterableQuery;
}

// ─── Pagination Types ───────────────────────────────────────────────────────────

/** Offset-based pagination request parameters */
export const OffsetPaginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val, 10))),
  pageSize: z
    .string()
    .optional()
    .default('25')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10)))),
});

export type OffsetPagination = z.infer<typeof OffsetPaginationSchema>;

/** Cursor-based pagination request parameters */
export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .default('25')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10)))),
  direction: z.enum(['forward', 'backward']).optional().default('forward'),
});

export type CursorPagination = z.infer<typeof CursorPaginationSchema>;

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
    nextCursor?: string | null;
    prevCursor?: string | null;
    hasMore: boolean;
  };
}

// ─── Field Selection ────────────────────────────────────────────────────────────

/**
 * Common field sets for list views vs. detail views.
 * Returning fewer columns reduces transfer size and serialization cost.
 */
export const FIELD_SETS = {
  /** Contact fields for list/table views */
  contactList: [
    'id',
    'first_name',
    'last_name',
    'email',
    'phone',
    'types',
    'lead_score',
    'assigned_agent_id',
    'updated_at',
    'tags',
  ] as const,

  /** Contact fields for detail view */
  contactDetail: '*' as const,

  /** Transaction fields for pipeline board */
  pipelineCard: [
    'id',
    'pipeline_type',
    'current_stage',
    'contact_id',
    'property_id',
    'estimated_revenue',
    'updated_at',
    'notes',
  ] as const,

  /** Transaction fields with relations for pipeline board */
  pipelineCardWithRelations: `
    id, pipeline_type, current_stage, contact_id, property_id,
    estimated_revenue, updated_at, notes,
    contact:contacts(id, first_name, last_name, phone, email, lead_score),
    property:properties(id, address_street_number, address_street_name, address_suburb, address_state)
  ` as const,

  /** Property fields for grid view */
  propertyGrid: [
    'id',
    'address_street_number',
    'address_street_name',
    'address_suburb',
    'address_state',
    'address_postcode',
    'property_type',
    'price',
    'status',
    'media',
    'updated_at',
  ] as const,

  /** Property fields for detail view */
  propertyDetail: '*' as const,

  /** Task fields for list view */
  taskList: [
    'id',
    'title',
    'status',
    'priority',
    'due_date',
    'contact_id',
    'assigned_to',
    'updated_at',
  ] as const,
} as const;

/**
 * Convert a field set array to a Supabase select string.
 */
export function toSelectString(fields: readonly string[] | string): string {
  if (typeof fields === 'string') return fields;
  return fields.join(', ');
}

// ─── Offset Pagination Helper ───────────────────────────────────────────────────

/**
 * Parameters for building an offset-paginated query.
 */
export interface OffsetPaginationParams {
  pagination: OffsetPagination;
  select?: string;
  orderBy?: string;
  ascending?: boolean;
  countCacheKey?: string;
}

/**
 * Execute an offset-paginated query against a Supabase table.
 *
 * Accepts a pre-built query builder (after applying your filters) and adds
 * ordering, range, and count. This avoids complex generic filter callback types.
 *
 * Example:
 *   const baseQuery = supabase.from('contacts').select('*').eq('is_deleted', false);
 *   return executeOffsetPagination<Contact>(baseQuery, supabase, 'contacts', params);
 */
export async function executeOffsetPagination<T extends Record<string, unknown>>(
  filteredQuery: FilterableQuery,
  supabase: SupabaseClient,
  table: string,
  params: OffsetPaginationParams,
): Promise<PaginatedResponse<T>> {
  const {
    pagination,
    orderBy = 'updated_at',
    ascending = false,
    countCacheKey,
  } = params;

  const offset = (pagination.page - 1) * pagination.pageSize;

  // Get total count (with optional caching)
  let total: number | undefined;

  if (countCacheKey) {
    const cachedCount = await cache.get<number>('contacts', `count:${countCacheKey}`);
    if (cachedCount !== null) {
      total = cachedCount;
    }
  }

  if (total === undefined) {
    // Use a separate count query against the same table
    const { count, error: countError } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });

    if (!countError && count !== null) {
      total = count;

      if (countCacheKey) {
        await cache.set('contacts', `count:${countCacheKey}`, total, { ttl: 30 });
      }
    }
  }

  // Apply ordering and range to the filtered query
  const { data, error } = await filteredQuery
    .order(orderBy, { ascending })
    .range(offset, offset + pagination.pageSize - 1);

  if (error) throw new Error(`Paginated query failed: ${error.message}`);

  const rows = (data ?? []) as T[];
  const totalPages = total !== undefined ? Math.ceil(total / pagination.pageSize) : undefined;

  return {
    data: rows,
    pagination: {
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages,
      hasMore: total !== undefined
        ? pagination.page < (totalPages ?? 0)
        : rows.length === pagination.pageSize,
    },
  };
}

// ─── Cursor Pagination Helper ───────────────────────────────────────────────────

/**
 * Parameters for building a cursor-paginated query.
 */
export interface CursorPaginationParams {
  pagination: CursorPagination;
  orderBy?: string;
}

/**
 * Execute a cursor-paginated query against a pre-filtered Supabase query.
 *
 * Uses `updated_at` + `id` as a composite cursor for stable ordering.
 * The cursor format is: `{updated_at}|{id}` (base64url encoded).
 *
 * Example:
 *   const baseQuery = supabase.from('contacts').select('*').eq('is_deleted', false);
 *   return executeCursorPagination<Contact>(baseQuery, params);
 */
export async function executeCursorPagination<T extends Record<string, unknown>>(
  filteredQuery: FilterableQuery,
  params: CursorPaginationParams,
): Promise<PaginatedResponse<T>> {
  const { pagination, orderBy = 'updated_at' } = params;

  // Fetch one extra to determine hasMore
  const fetchLimit = pagination.limit + 1;
  const isForward = pagination.direction === 'forward';

  let query = filteredQuery
    .order(orderBy, { ascending: !isForward })
    .order('id', { ascending: !isForward })
    .limit(fetchLimit);

  // Apply cursor filter
  if (pagination.cursor) {
    const [cursorTimestamp, cursorId] = decodeCursor(pagination.cursor);

    if (isForward) {
      query = query.or(
        `${orderBy}.lt.${cursorTimestamp},and(${orderBy}.eq.${cursorTimestamp},id.lt.${cursorId})`,
      );
    } else {
      query = query.or(
        `${orderBy}.gt.${cursorTimestamp},and(${orderBy}.eq.${cursorTimestamp},id.gt.${cursorId})`,
      );
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Cursor paginated query failed: ${error.message}`);

  const rows = (data ?? []) as (T & { id: string; updated_at: string })[];
  const hasMore = rows.length > pagination.limit;
  const pageRows = hasMore ? rows.slice(0, pagination.limit) : rows;

  const firstRow = pageRows[0];
  const lastRow = pageRows[pageRows.length - 1];

  return {
    data: pageRows as T[],
    pagination: {
      hasMore,
      nextCursor: hasMore && lastRow
        ? encodeCursor(
            String(lastRow[orderBy as keyof typeof lastRow] ?? lastRow.updated_at),
            lastRow.id,
          )
        : null,
      prevCursor: firstRow
        ? encodeCursor(
            String(firstRow[orderBy as keyof typeof firstRow] ?? firstRow.updated_at),
            firstRow.id,
          )
        : null,
    },
  };
}

// ─── Cursor Encoding ────────────────────────────────────────────────────────────

function encodeCursor(timestamp: string, id: string): string {
  return Buffer.from(`${timestamp}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string): [string, string] {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
  const separatorIndex = decoded.lastIndexOf('|');

  if (separatorIndex === -1) {
    throw new Error('Invalid cursor format');
  }

  return [decoded.slice(0, separatorIndex), decoded.slice(separatorIndex + 1)];
}

// ─── Eager Loading Helper ───────────────────────────────────────────────────────

/**
 * Build a Supabase select string with eager-loaded relations.
 * Prevents N+1 queries by fetching related data in a single query.
 *
 * Example:
 *   eagerLoad('*', {
 *     contact: { table: 'contacts', fields: ['id', 'first_name', 'last_name'] },
 *     property: { table: 'properties', fields: ['id', 'address_suburb'] },
 *   })
 *   // Returns: "*, contact:contacts(id, first_name, last_name), property:properties(id, address_suburb)"
 */
export function eagerLoad(
  baseFields: string,
  relations: Record<
    string,
    {
      table: string;
      fields: readonly string[];
    }
  >,
): string {
  const relationSelects = Object.entries(relations)
    .map(([alias, { table, fields }]) => `${alias}:${table}(${fields.join(', ')})`)
    .join(', ');

  return `${baseFields}, ${relationSelects}`;
}

// ─── Count Caching ──────────────────────────────────────────────────────────────

/**
 * Get a cached count for a table, or fetch and cache it.
 *
 * Example:
 *   const query = supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('is_deleted', false);
 *   const total = await getCachedCount(query, 'contacts:active');
 */
export async function getCachedCount(
  countQuery: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  cacheKey: string,
  ttl = 30,
): Promise<number> {
  // Try cache first
  const cached = await cache.get<number>('contacts', `count:${cacheKey}`);
  if (cached !== null) return cached;

  // Fetch from database
  const { count, error } = await countQuery;
  if (error) throw new Error(`Count query failed: ${error.message}`);

  const result = count ?? 0;
  await cache.set('contacts', `count:${cacheKey}`, result, { ttl });
  return result;
}
