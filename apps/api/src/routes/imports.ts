import type { FastifyInstance } from 'fastify';
import {
  CreateImportJobSchema,
  UpdateFieldMappingsSchema,
  UpdateOnboardingSchema,
} from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';
import { ImportEngine } from '../services/import-engine';

export async function importRoutes(fastify: FastifyInstance) {
  // ─── List import jobs ─────────────────────────────────────────────
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: jobs, error } = await supabase
      .from('import_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return reply.status(500).send({ error: error.message });
    return { data: jobs };
  });

  // ─── Create import job (upload CSV metadata) ──────────────────────
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateImportJobSchema.safeParse(request.body);

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

    const job = parsed.data;

    const { data, error } = await supabase
      .from('import_jobs')
      .insert({
        office_id: user.office_id,
        user_id: userId,
        source: job.source,
        entity_type: job.entityType,
        file_name: job.fileName,
        file_size: job.fileSize,
        status: 'uploaded',
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // ─── Get import job details ───────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: job, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return reply.status(404).send({ error: 'Import job not found' });
    return { data: job };
  });

  // ─── Preview import (detect columns & suggest mappings) ───────────
  fastify.post<{ Params: { id: string } }>('/:id/preview', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: job } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (!job) return reply.status(404).send({ error: 'Import job not found' });

    const csvData = request.body as { rows: Array<Record<string, string>> };

    if (!csvData.rows || !Array.isArray(csvData.rows) || csvData.rows.length === 0) {
      return reply.status(400).send({ error: 'CSV rows data is required' });
    }

    const engine = new ImportEngine(supabase);
    const preview = await engine.generatePreview(job, csvData.rows);

    // Update job status
    await supabase
      .from('import_jobs')
      .update({
        status: 'previewing',
        total_rows: csvData.rows.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return { data: preview };
  });

  // ─── Set field mappings ───────────────────────────────────────────
  fastify.put<{ Params: { id: string } }>('/:id/mappings', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateFieldMappingsSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { data, error } = await supabase
      .from('import_jobs')
      .update({
        field_mappings: parsed.data.fieldMappings,
        skip_duplicates: parsed.data.skipDuplicates,
        status: 'mapping',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── Execute import ───────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/execute', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: job } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (!job) return reply.status(404).send({ error: 'Import job not found' });

    if (!job.field_mappings || (job.field_mappings as unknown[]).length === 0) {
      return reply.status(400).send({ error: 'Field mappings must be set before executing' });
    }

    // Mark as processing
    await supabase
      .from('import_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);

    const csvData = request.body as { rows: Array<Record<string, string>> };

    if (!csvData.rows || !Array.isArray(csvData.rows)) {
      return reply.status(400).send({ error: 'CSV rows data is required' });
    }

    const engine = new ImportEngine(supabase);
    const result = await engine.execute(job, csvData.rows);

    // Update job with results
    await supabase
      .from('import_jobs')
      .update({
        status: result.errorCount > 0 && result.successCount === 0 ? 'failed' : 'completed',
        processed_rows: result.processedRows,
        success_count: result.successCount,
        error_count: result.errorCount,
        duplicate_count: result.duplicateCount,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return { data: result };
  });

  // ─── Get import errors ────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>('/:id/errors', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: errors, error } = await supabase
      .from('import_errors')
      .select('*')
      .eq('import_job_id', id)
      .order('row_number', { ascending: true })
      .limit(100);

    if (error) return reply.status(500).send({ error: error.message });
    return { data: errors };
  });

  // ─── Cancel import ────────────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>('/:id/cancel', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('import_jobs')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── Onboarding progress ─────────────────────────────────────────
  fastify.get('/onboarding', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data: user } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', request.headers['x-user-id'] as string)
      .single();

    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('office_id', user.office_id)
      .single();

    if (!progress) {
      // Create default onboarding progress
      const { data: newProgress, error } = await supabase
        .from('onboarding_progress')
        .insert({
          office_id: user.office_id,
          current_step: 'office_setup',
        })
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });
      return { data: newProgress };
    }

    return { data: progress };
  });

  fastify.put('/onboarding', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = UpdateOnboardingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { data: user } = await supabase
      .from('users')
      .select('office_id')
      .eq('id', request.headers['x-user-id'] as string)
      .single();

    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = {
      current_step: updates.currentStep,
      updated_at: new Date().toISOString(),
    };

    if (updates.completedSteps) updatePayload.completed_steps = updates.completedSteps;
    if (updates.skippedSteps) updatePayload.skipped_steps = updates.skippedSteps;
    if (updates.currentStep === 'complete') updatePayload.is_complete = true;

    const { data, error } = await supabase
      .from('onboarding_progress')
      .update(updatePayload)
      .eq('office_id', user.office_id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });
}
