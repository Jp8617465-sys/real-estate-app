import type { FastifyInstance } from 'fastify';
import {
  CreateSavedViewSchema,
  UpdateSavedViewSchema,
  BulkActionSchema,
} from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

export async function savedViewRoutes(fastify: FastifyInstance) {
  // ─── List saved views ─────────────────────────────────────────────
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const query = request.query as { entityType?: string };

    let builder = supabase
      .from('saved_views')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (query.entityType) {
      builder = builder.eq('entity_type', query.entityType);
    }

    const { data: views, error } = await builder;

    if (error) return reply.status(500).send({ error: error.message });
    return { data: views };
  });

  // ─── Get view by ID ──────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: view, error } = await supabase
      .from('saved_views')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return reply.status(404).send({ error: 'View not found' });
    return { data: view };
  });

  // ─── Create saved view ───────────────────────────────────────────
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateSavedViewSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const userId = request.headers['x-user-id'] as string;
    const { data: user } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', userId)
      .single();

    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const view = parsed.data;

    // If setting as default, unset other defaults for this entity type
    if (view.isDefault) {
      await supabase
        .from('saved_views')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('entity_type', view.entityType)
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('saved_views')
      .insert({
        office_id: user.office_id,
        user_id: userId,
        entity_type: view.entityType,
        name: view.name,
        filters: view.filters,
        sorts: view.sorts,
        columns: view.columns,
        is_default: view.isDefault,
        is_shared: view.isShared,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // ─── Update saved view ───────────────────────────────────────────
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateSavedViewSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.filters !== undefined) updatePayload.filters = updates.filters;
    if (updates.sorts !== undefined) updatePayload.sorts = updates.sorts;
    if (updates.columns !== undefined) updatePayload.columns = updates.columns;
    if (updates.isDefault !== undefined) updatePayload.is_default = updates.isDefault;
    if (updates.isShared !== undefined) updatePayload.is_shared = updates.isShared;

    const { data, error } = await supabase
      .from('saved_views')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── Delete saved view ───────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('saved_views')
      .delete()
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(204).send();
  });

  // ─── Bulk actions ────────────────────────────────────────────────
  fastify.post('/bulk-action', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = BulkActionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { action, entityType, entityIds, params } = parsed.data;

    const tableMap: Record<string, string> = {
      contacts: 'contacts',
      properties: 'properties',
      pipeline: 'pipeline_entries',
      tasks: 'tasks',
      inspections: 'inspections',
    };

    const table = tableMap[entityType];
    if (!table) {
      return reply.status(400).send({ error: `Unsupported entity type: ${entityType}` });
    }

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ entityId: string; message: string }> = [];

    switch (action) {
      case 'assign_agent': {
        const agentId = params.agentId as string;
        if (!agentId) return reply.status(400).send({ error: 'agentId is required' });

        const { error } = await supabase
          .from(table)
          .update({ assigned_to: agentId, updated_at: new Date().toISOString() })
          .in('id', entityIds);

        if (error) {
          failureCount = entityIds.length;
          errors.push({ entityId: 'bulk', message: error.message });
        } else {
          successCount = entityIds.length;
        }
        break;
      }

      case 'change_stage': {
        const stage = params.stage as string;
        if (!stage) return reply.status(400).send({ error: 'stage is required' });

        const { error } = await supabase
          .from(table)
          .update({ stage, updated_at: new Date().toISOString() })
          .in('id', entityIds);

        if (error) {
          failureCount = entityIds.length;
          errors.push({ entityId: 'bulk', message: error.message });
        } else {
          successCount = entityIds.length;
        }
        break;
      }

      case 'add_tag': {
        const tag = params.tag as string;
        if (!tag) return reply.status(400).send({ error: 'tag is required' });

        // Process individually since we need to append to array
        for (const entityId of entityIds) {
          const { data: entity } = await supabase
            .from(table)
            .select('tags')
            .eq('id', entityId)
            .single();

          if (entity) {
            const currentTags = (entity.tags as string[]) ?? [];
            if (!currentTags.includes(tag)) {
              const { error } = await supabase
                .from(table)
                .update({ tags: [...currentTags, tag], updated_at: new Date().toISOString() })
                .eq('id', entityId);

              if (error) {
                failureCount++;
                errors.push({ entityId, message: error.message });
              } else {
                successCount++;
              }
            } else {
              successCount++; // Already has tag
            }
          } else {
            failureCount++;
            errors.push({ entityId, message: 'Entity not found' });
          }
        }
        break;
      }

      case 'remove_tag': {
        const tag = params.tag as string;
        if (!tag) return reply.status(400).send({ error: 'tag is required' });

        for (const entityId of entityIds) {
          const { data: entity } = await supabase
            .from(table)
            .select('tags')
            .eq('id', entityId)
            .single();

          if (entity) {
            const currentTags = (entity.tags as string[]) ?? [];
            const { error } = await supabase
              .from(table)
              .update({
                tags: currentTags.filter(t => t !== tag),
                updated_at: new Date().toISOString(),
              })
              .eq('id', entityId);

            if (error) {
              failureCount++;
              errors.push({ entityId, message: error.message });
            } else {
              successCount++;
            }
          }
        }
        break;
      }

      case 'soft_delete': {
        const { error } = await supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in('id', entityIds);

        if (error) {
          failureCount = entityIds.length;
          errors.push({ entityId: 'bulk', message: error.message });
        } else {
          successCount = entityIds.length;
        }
        break;
      }

      case 'export_csv': {
        // Fetch all entities and return as CSV-ready data
        const { data: entities, error } = await supabase
          .from(table)
          .select('*')
          .in('id', entityIds);

        if (error) return reply.status(500).send({ error: error.message });

        return {
          data: {
            action: 'export_csv',
            rows: entities,
            totalCount: entities?.length ?? 0,
          },
        };
      }

      default:
        return reply.status(400).send({ error: `Unsupported action: ${action}` });
    }

    return {
      data: {
        action,
        totalCount: entityIds.length,
        successCount,
        failureCount,
        errors,
      },
    };
  });
}
