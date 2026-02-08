import type { FastifyInstance } from 'fastify';
import { CreateContactSchema, ContactSearchSchema } from '@realflow/shared';
import { DuplicateDetector } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';

export async function contactRoutes(fastify: FastifyInstance) {
  // List / Search contacts
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const search = ContactSearchSchema.parse(request.query);

    let query = supabase
      .from('contacts')
      .select('*')
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (search.query) {
      query = query.or(
        `first_name.ilike.%${search.query}%,last_name.ilike.%${search.query}%,email.ilike.%${search.query}%,phone.ilike.%${search.query}%`,
      );
    }

    if (search.types?.length) {
      query = query.overlaps('types', search.types);
    }

    if (search.assignedAgentId) {
      query = query.eq('assigned_agent_id', search.assignedAgentId);
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });

    return { data };
  });

  // Get single contact
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return reply.status(404).send({ error: 'Contact not found' });
    return { data };
  });

  // Create contact (with duplicate detection)
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateContactSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const contact = parsed.data;

    // Check for duplicates
    const { data: existing } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, secondary_phone')
      .eq('is_deleted', false);

    if (existing) {
      const duplicates = DuplicateDetector.findDuplicates(
        {
          phone: contact.phone,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
        },
        existing.map((c) => ({
          id: c.id,
          phone: c.phone,
          email: c.email ?? '',
          firstName: c.first_name,
          lastName: c.last_name,
          secondaryPhone: c.secondary_phone,
        })),
      );

      if (DuplicateDetector.hasHighConfidenceDuplicate(duplicates)) {
        return reply.status(409).send({
          error: 'Potential duplicate detected',
          duplicates: duplicates.filter((d) => d.score >= 50),
        });
      }
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        types: contact.types,
        first_name: contact.firstName,
        last_name: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        secondary_phone: contact.secondaryPhone,
        source: contact.source,
        source_detail: contact.sourceDetail,
        assigned_agent_id: contact.assignedAgentId,
        buyer_profile: contact.buyerProfile,
        seller_profile: contact.sellerProfile,
        tags: contact.tags ?? [],
        communication_preference: contact.communicationPreference,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Soft delete contact
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { error } = await supabase
      .from('contacts')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return reply.status(500).send({ error: error.message });
    return { success: true };
  });
}
