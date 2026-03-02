import type { FastifyInstance } from 'fastify';
import {
  CreateAmlCheckSchema,
  UpdateAmlCheckSchema,
  AddAmlDocumentSchema,
  CompleteAmlCheckSchema,
  AML_DOCUMENT_POINTS,
} from '@realflow/shared';
import { AmlEngine } from '@realflow/business-logic';
import { createSupabaseClient } from '../middleware/supabase';

export async function complianceRoutes(fastify: FastifyInstance) {
  // ─── GET /checks ───────────────────────────────────────────────────────────
  // List AML checks for the authenticated agent. Optional query params:
  //   status   — filter by check status
  //   contactId — filter by contact
  fastify.get<{
    Querystring: { status?: string; contactId?: string };
  }>('/checks', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { status, contactId } = request.query;

    let query = supabase
      .from('aml_checks')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (contactId) {
      query = query.eq('contact_id', contactId);
    }

    const { data, error } = await query;

    if (error) return reply.status(500).send({ error: error.message });
    return { data: data ?? [] };
  });

  // ─── POST /checks ──────────────────────────────────────────────────────────
  // Create a new AML/KYC check for a contact.
  fastify.post('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = CreateAmlCheckSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { contactId, verificationMethod, fullLegalName, dateOfBirth, residentialAddress } =
      parsed.data;

    // Retrieve agent id from the auth session (RLS enforces agent ownership)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorised' });
    }

    const { data, error } = await supabase
      .from('aml_checks')
      .insert({
        contact_id: contactId,
        agent_id: user.id,
        status: 'in_progress',
        verification_method: verificationMethod,
        full_legal_name: fullLegalName,
        date_of_birth: dateOfBirth,
        residential_address: residentialAddress,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ data });
  });

  // ─── GET /checks/:id ───────────────────────────────────────────────────────
  // Fetch a single AML check with its associated identity documents.
  fastify.get<{ Params: { id: string } }>('/checks/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;

    const { data: check, error: checkError } = await supabase
      .from('aml_checks')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !check) {
      return reply.status(404).send({ error: 'AML check not found' });
    }

    const { data: documents, error: docsError } = await supabase
      .from('aml_identity_documents')
      .select('*')
      .eq('check_id', id)
      .order('created_at', { ascending: true });

    if (docsError) return reply.status(500).send({ error: docsError.message });

    return { data: { ...check, documents: documents ?? [] } };
  });

  // ─── PATCH /checks/:id ────────────────────────────────────────────────────
  // Update identity fields, notes, or verification method on an existing check.
  fastify.patch<{ Params: { id: string } }>('/checks/:id', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = UpdateAmlCheckSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.verificationMethod !== undefined) payload.verification_method = updates.verificationMethod;
    if (updates.fullLegalName !== undefined) payload.full_legal_name = updates.fullLegalName;
    if (updates.dateOfBirth !== undefined) payload.date_of_birth = updates.dateOfBirth;
    if (updates.residentialAddress !== undefined) payload.residential_address = updates.residentialAddress;
    if (updates.addressVerified !== undefined) payload.address_verified = updates.addressVerified;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { data, error } = await supabase
      .from('aml_checks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── POST /checks/:id/documents ───────────────────────────────────────────
  // Add an identity document to an AML check, recalculate points,
  // and attempt auto-completion if the check now meets 100+ points.
  fastify.post<{ Params: { id: string } }>('/checks/:id/documents', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id: checkId } = request.params;
    const parsed = AddAmlDocumentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { documentType, documentNumber, issuingAuthority, issueDate, expiryDate, notes } =
      parsed.data;

    // Verify the check exists and belongs to this agent (RLS enforces ownership)
    const { data: checkRow, error: checkError } = await supabase
      .from('aml_checks')
      .select('id, status')
      .eq('id', checkId)
      .single();

    if (checkError || !checkRow) {
      return reply.status(404).send({ error: 'AML check not found' });
    }

    // Look up canonical point value from the shared constant
    const points = AML_DOCUMENT_POINTS[documentType];

    // Determine whether the document is already expired
    const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;

    const { data: document, error: docError } = await supabase
      .from('aml_identity_documents')
      .insert({
        check_id: checkId,
        document_type: documentType,
        points,
        document_number: documentNumber ?? null,
        issuing_authority: issuingAuthority ?? null,
        issue_date: issueDate ?? null,
        expiry_date: expiryDate ?? null,
      })
      .select()
      .single();

    if (docError) return reply.status(500).send({ error: docError.message });

    // Recalculate total points from all documents for this check
    const { data: allDocs } = await supabase
      .from('aml_identity_documents')
      .select('points, is_expired')
      .eq('check_id', checkId);

    const totalPoints = (allDocs ?? []).reduce(
      (sum: number, d: { points: number; is_expired: boolean }) => {
        return d.is_expired ? sum : sum + d.points;
      },
      0,
    );

    // Update total_points on the check
    await supabase
      .from('aml_checks')
      .update({ total_points: totalPoints, updated_at: new Date().toISOString() })
      .eq('id', checkId);

    // Attempt auto-completion — sets status to 'passed' if all conditions met
    const updatedCheck = await AmlEngine.tryAutoComplete(checkId, supabase);

    // Return the newly inserted document and the (possibly updated) check
    const { data: finalCheck } = await supabase
      .from('aml_checks')
      .select('*')
      .eq('id', checkId)
      .single();

    return reply.status(201).send({
      data: {
        document: { ...document, isExpired },
        check: updatedCheck ?? finalCheck,
      },
    });
  });

  // ─── DELETE /checks/:id/documents/:docId ──────────────────────────────────
  // Remove a document from an AML check and recalculate total points.
  fastify.delete<{ Params: { id: string; docId: string } }>(
    '/checks/:id/documents/:docId',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { id: checkId, docId } = request.params;

      // Verify the document exists on this check (RLS enforces ownership via check)
      const { data: docRow, error: fetchError } = await supabase
        .from('aml_identity_documents')
        .select('id')
        .eq('id', docId)
        .eq('check_id', checkId)
        .single();

      if (fetchError || !docRow) {
        return reply.status(404).send({ error: 'Document not found on this check' });
      }

      const { error: deleteError } = await supabase
        .from('aml_identity_documents')
        .delete()
        .eq('id', docId);

      if (deleteError) return reply.status(500).send({ error: deleteError.message });

      // Recalculate total points from remaining documents
      const { data: remainingDocs } = await supabase
        .from('aml_identity_documents')
        .select('points, is_expired')
        .eq('check_id', checkId);

      const totalPoints = (remainingDocs ?? []).reduce(
        (sum: number, d: { points: number; is_expired: boolean }) => {
          return d.is_expired ? sum : sum + d.points;
        },
        0,
      );

      const { data: updatedCheck, error: updateError } = await supabase
        .from('aml_checks')
        .update({ total_points: totalPoints, updated_at: new Date().toISOString() })
        .eq('id', checkId)
        .select()
        .single();

      if (updateError) return reply.status(500).send({ error: updateError.message });

      return { data: { check: updatedCheck } };
    },
  );

  // ─── POST /checks/:id/complete ────────────────────────────────────────────
  // Manually finalise an AML check as passed or failed.
  fastify.post<{ Params: { id: string } }>('/checks/:id/complete', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { id } = request.params;
    const parsed = CompleteAmlCheckSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { outcome, rejectionReason } = parsed.data;

    // Verify check exists
    const { data: existingCheck, error: fetchError } = await supabase
      .from('aml_checks')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existingCheck) {
      return reply.status(404).send({ error: 'AML check not found' });
    }

    const now = new Date();
    const payload: Record<string, unknown> = {
      status: outcome,
      completed_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    if (outcome === 'passed') {
      const expiryDate = new Date(now);
      expiryDate.setFullYear(expiryDate.getFullYear() + 2);
      payload.expiry_date = expiryDate.toISOString().split('T')[0];
    }

    if (outcome === 'failed' && rejectionReason) {
      payload.rejection_reason = rejectionReason;
    }

    const { data, error } = await supabase
      .from('aml_checks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── GET /report ──────────────────────────────────────────────────────────
  // Generate a compliance report for the authenticated agent over a date range.
  // Query params: from (ISO date), to (ISO date)
  fastify.get<{
    Querystring: { from: string; to: string };
  }>('/report', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const { from, to } = request.query;

    if (!from || !to) {
      return reply.status(400).send({ error: "'from' and 'to' query parameters are required" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return reply.status(400).send({ error: "'from' and 'to' must be valid ISO date strings" });
    }

    if (fromDate > toDate) {
      return reply.status(400).send({ error: "'from' must be before 'to'" });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorised' });
    }

    const report = await AmlEngine.generateComplianceReport(
      user.id,
      fromDate,
      toDate,
      supabase,
    );

    return { data: report };
  });

  // ─── GET /expiring ────────────────────────────────────────────────────────
  // Return AML checks expiring within daysAhead days (default 90).
  // Useful for the compliance dashboard warning banner.
  fastify.get<{
    Querystring: { daysAhead?: string };
  }>('/expiring', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const daysAhead = parseInt(request.query.daysAhead ?? '90', 10);

    if (isNaN(daysAhead) || daysAhead < 1 || daysAhead > 365) {
      return reply.status(400).send({ error: "'daysAhead' must be a number between 1 and 365" });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Unauthorised' });
    }

    const checks = await AmlEngine.getExpiringChecks(user.id, daysAhead, supabase);
    return { data: checks };
  });
}
