import type { FastifyInstance } from 'fastify';
import { CreateKeyDateSchema, UpdateKeyDateSchema } from '@realflow/shared';
import { KeyDatesEngine } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';

export async function keyDateRoutes(fastify: FastifyInstance) {
  // List key dates for a transaction
  fastify.get<{ Params: { transactionId: string } }>(
    '/transaction/:transactionId',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { transactionId } = request.params;

      const { data, error } = await supabase
        .from('key_dates')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('date', { ascending: true });

      if (error) return reply.status(500).send({ error: error.message });
      return { data };
    },
  );

  // Create key date
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateKeyDateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const keyDate = parsed.data;

    const { data, error } = await supabase
      .from('key_dates')
      .insert({
        transaction_id: keyDate.transactionId,
        label: keyDate.label,
        date: keyDate.date,
        is_critical: keyDate.isCritical,
        reminder_days_before: keyDate.reminderDaysBefore,
        status: keyDate.status,
        notes: keyDate.notes,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Auto-generate key dates from contract details
  fastify.post<{
    Body: {
      transactionId: string;
      exchangeDate: string;
      settlementDate: string;
      state: string;
      coolingOffDays?: number;
      financeApprovalDays?: number;
      buildingPestDays?: number;
      depositDueDays?: number;
    };
  }>('/generate', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const {
      transactionId,
      exchangeDate,
      settlementDate,
      state,
      coolingOffDays,
      financeApprovalDays,
      buildingPestDays,
      depositDueDays,
    } = request.body;

    if (!transactionId || !exchangeDate || !settlementDate || !state) {
      return reply.status(400).send({
        error: 'transactionId, exchangeDate, settlementDate, and state are required',
      });
    }

    const contractDetails = {
      exchangeDate: new Date(exchangeDate),
      settlementDate: new Date(settlementDate),
      coolingOffDays,
      financeApprovalDays,
      buildingPestDays,
      depositDueDays,
    };

    const generatedDates = KeyDatesEngine.generateKeyDates(contractDetails, state);

    // Insert all generated dates
    const datesToInsert = generatedDates.map((kd) => ({
      transaction_id: transactionId,
      label: kd.label,
      date: kd.date.toISOString(),
      is_critical: kd.isCritical,
      reminder_days_before: kd.reminderDaysBefore,
      status: 'upcoming',
    }));

    const { data, error } = await supabase
      .from('key_dates')
      .insert(datesToInsert)
      .select();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Update key date
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateKeyDateSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.label !== undefined) updatePayload.label = updates.label;
    if (updates.date !== undefined) updatePayload.date = updates.date;
    if (updates.isCritical !== undefined) updatePayload.is_critical = updates.isCritical;
    if (updates.reminderDaysBefore !== undefined) updatePayload.reminder_days_before = updates.reminderDaysBefore;
    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.completedAt !== undefined) updatePayload.completed_at = updates.completedAt;
    if (updates.notes !== undefined) updatePayload.notes = updates.notes;

    // Auto-set completedAt when status is set to completed
    if (updates.status === 'completed' && !updates.completedAt) {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('key_dates')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });
}
