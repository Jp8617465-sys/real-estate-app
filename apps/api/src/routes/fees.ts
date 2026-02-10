import type { FastifyInstance } from 'fastify';
import {
  CreateFeeStructureSchema,
  UpdateFeeStructureSchema,
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
} from '@realflow/shared';
import { FeeCalculator } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';

export async function feeRoutes(fastify: FastifyInstance) {
  // Get fee structure for a client
  fastify.get<{ Params: { clientId: string } }>('/client/:clientId', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { clientId } = request.params;

    const { data: feeStructure, error } = await supabase
      .from('fee_structures')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return reply.status(404).send({ error: 'Fee structure not found' });

    // Fetch invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('fee_structure_id', feeStructure.id)
      .order('created_at', { ascending: false });

    // Fetch referral fees
    const { data: referralFees } = await supabase
      .from('referral_fees')
      .select('*')
      .eq('fee_structure_id', feeStructure.id);

    return {
      data: {
        ...feeStructure,
        invoices: invoices ?? [],
        referralFees: referralFees ?? [],
      },
    };
  });

  // Create fee structure
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateFeeStructureSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const fee = parsed.data;

    const { data, error } = await supabase
      .from('fee_structures')
      .insert({
        client_id: fee.clientId,
        transaction_id: fee.transactionId,
        retainer_fee: fee.retainerFee,
        retainer_paid_date: fee.retainerPaidDate,
        success_fee_type: fee.successFeeType,
        success_fee_flat_amount: fee.successFeeFlatAmount,
        success_fee_percentage: fee.successFeePercentage,
        success_fee_tiers: fee.successFeeTiers,
        success_fee_due_date: fee.successFeeDueDate,
        success_fee_paid: fee.successFeePaid,
        gst_included: fee.gstIncluded,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // Update fee structure
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateFeeStructureSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.clientId !== undefined) updatePayload.client_id = updates.clientId;
    if (updates.transactionId !== undefined) updatePayload.transaction_id = updates.transactionId;
    if (updates.retainerFee !== undefined) updatePayload.retainer_fee = updates.retainerFee;
    if (updates.retainerPaidDate !== undefined) updatePayload.retainer_paid_date = updates.retainerPaidDate;
    if (updates.successFeeType !== undefined) updatePayload.success_fee_type = updates.successFeeType;
    if (updates.successFeeFlatAmount !== undefined) updatePayload.success_fee_flat_amount = updates.successFeeFlatAmount;
    if (updates.successFeePercentage !== undefined) updatePayload.success_fee_percentage = updates.successFeePercentage;
    if (updates.successFeeTiers !== undefined) updatePayload.success_fee_tiers = updates.successFeeTiers;
    if (updates.successFeeDueDate !== undefined) updatePayload.success_fee_due_date = updates.successFeeDueDate;
    if (updates.successFeePaid !== undefined) updatePayload.success_fee_paid = updates.successFeePaid;
    if (updates.gstIncluded !== undefined) updatePayload.gst_included = updates.gstIncluded;

    const { data, error } = await supabase
      .from('fee_structures')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // Create invoice for a fee structure
  fastify.post<{ Params: { id: string } }>('/:id/invoices', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = CreateInvoiceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const invoice = parsed.data;

    // Verify fee structure exists
    const { data: feeStructure, error: feeError } = await supabase
      .from('fee_structures')
      .select('id')
      .eq('id', id)
      .single();

    if (feeError || !feeStructure) {
      return reply.status(404).send({ error: 'Fee structure not found' });
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        fee_structure_id: id,
        client_id: invoice.clientId,
        type: invoice.type,
        amount: invoice.amount,
        gst_amount: invoice.gstAmount,
        status: invoice.status,
        due_date: invoice.dueDate,
        stripe_invoice_id: invoice.stripeInvoiceId,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // List invoices for a fee structure
  fastify.get<{ Params: { id: string } }>('/:id/invoices', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('fee_structure_id', id)
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // Update invoice status
  fastify.put<{ Params: { invoiceId: string } }>(
    '/invoices/:invoiceId',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { invoiceId } = request.params;
      const parsed = UpdateInvoiceSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const updates = parsed.data;
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status !== undefined) updatePayload.status = updates.status;
      if (updates.paidDate !== undefined) updatePayload.paid_date = updates.paidDate;
      if (updates.stripeInvoiceId !== undefined) updatePayload.stripe_invoice_id = updates.stripeInvoiceId;

      // Auto-set paidDate when status is set to paid
      if (updates.status === 'paid' && !updates.paidDate) {
        updatePayload.paid_date = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('invoices')
        .update(updatePayload)
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) return reply.status(500).send({ error: error.message });
      return { data };
    },
  );

  // Calculate total fees
  fastify.post<{
    Body: {
      purchasePrice: number;
      retainerFee: number;
      successFeeType: 'flat' | 'percentage' | 'tiered';
      successFeeFlatAmount?: number;
      successFeePercentage?: number;
      successFeeTiers?: Array<{ upTo: number; fee: number }>;
      gstIncluded: boolean;
    };
  }>('/calculate', async (request, reply) => {
    const {
      purchasePrice,
      retainerFee,
      successFeeType,
      successFeeFlatAmount,
      successFeePercentage,
      successFeeTiers,
      gstIncluded,
    } = request.body;

    if (purchasePrice === undefined || retainerFee === undefined || !successFeeType || gstIncluded === undefined) {
      return reply.status(400).send({
        error: 'purchasePrice, retainerFee, successFeeType, and gstIncluded are required',
      });
    }

    const result = FeeCalculator.calculateTotalFees(purchasePrice, {
      retainerFee,
      successFeeType,
      successFeeFlatAmount,
      successFeePercentage,
      successFeeTiers,
      gstIncluded,
    });

    return { data: result };
  });
}
