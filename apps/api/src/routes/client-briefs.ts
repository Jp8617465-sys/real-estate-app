import type { FastifyInstance } from 'fastify';
import { CreateClientBriefSchema, UpdateClientBriefSchema } from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

export async function clientBriefRoutes(fastify: FastifyInstance) {
  // List briefs (optionally filter by contactId)
  fastify.get<{ Querystring: { contactId?: string } }>('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { contactId } = request.query;

    let query = supabase
      .from('client_briefs')
      .select('*')
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });

    return { data };
  });

  // Get single brief
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('client_briefs')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error) return reply.status(404).send({ error: 'Client brief not found' });
    return { data };
  });

  // Create brief
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateClientBriefSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const brief = parsed.data;

    const { data, error } = await supabase
      .from('client_briefs')
      .insert({
        contact_id: brief.contactId,
        transaction_id: brief.transactionId,
        purchase_type: brief.purchaseType,
        enquiry_type: brief.enquiryType,
        budget: brief.budget,
        finance: brief.finance,
        requirements: brief.requirements,
        timeline: brief.timeline,
        communication: brief.communication,
        solicitor: brief.solicitor,
        brief_version: 1,
        client_signed_off: brief.clientSignedOff ?? false,
        created_by: brief.createdBy,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Update brief (increment brief_version)
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateClientBriefSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;

    // Fetch current brief to get the current version
    const { data: current, error: fetchError } = await supabase
      .from('client_briefs')
      .select('brief_version')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !current) {
      return reply.status(404).send({ error: 'Client brief not found' });
    }

    const updatePayload: Record<string, unknown> = {
      brief_version: (current.brief_version as number) + 1,
      updated_at: new Date().toISOString(),
    };

    if (updates.contactId !== undefined) updatePayload.contact_id = updates.contactId;
    if (updates.transactionId !== undefined) updatePayload.transaction_id = updates.transactionId;
    if (updates.purchaseType !== undefined) updatePayload.purchase_type = updates.purchaseType;
    if (updates.enquiryType !== undefined) updatePayload.enquiry_type = updates.enquiryType;
    if (updates.budget !== undefined) updatePayload.budget = updates.budget;
    if (updates.finance !== undefined) updatePayload.finance = updates.finance;
    if (updates.requirements !== undefined) updatePayload.requirements = updates.requirements;
    if (updates.timeline !== undefined) updatePayload.timeline = updates.timeline;
    if (updates.communication !== undefined) updatePayload.communication = updates.communication;
    if (updates.solicitor !== undefined) updatePayload.solicitor = updates.solicitor;
    if (updates.clientSignedOff !== undefined) updatePayload.client_signed_off = updates.clientSignedOff;
    if (updates.createdBy !== undefined) updatePayload.created_by = updates.createdBy;

    const { data, error } = await supabase
      .from('client_briefs')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // Sign-off brief
  fastify.post<{ Params: { id: string } }>('/:id/sign-off', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('client_briefs')
      .update({
        client_signed_off: true,
        signed_off_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // Soft delete brief
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('client_briefs')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });
}
