import type { FastifyInstance } from 'fastify';
import {
  PortalBriefAcknowledgementSchema,
  PortalPropertyFeedbackSchema,
  PortalInspectionFeedbackSchema,
} from '@realflow/shared';
import { PortalEngine } from '@realflow/business-logic';
import { createSupabaseClient, createSupabaseServiceClient } from '../middleware/supabase';
import { z } from 'zod';
import { GmailClient } from '@realflow/integrations';
import { env } from '../config/env';

export async function portalRoutes(fastify: FastifyInstance) {
  // ─── GET /me ──────────────────────────────────────────────────────────────
  // Get authenticated portal client profile
  fastify.get('/me', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { data, error } = await supabase
      .from('portal_clients')
      .select(
        `
        id,
        auth_id,
        contact_id,
        agent_id,
        is_active,
        contact:contacts!contact_id (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        agent:users!agent_id (
          id,
          full_name,
          email
        )
      `,
      )
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return reply.status(404).send({ error: 'Portal client not found' });
      }
      request.log.error(error, 'handler failed');
      return reply.status(500).send({ error: error.message });
    }

    return { data };
  });

  // ─── GET /transaction ─────────────────────────────────────────────────────
  // Get the active transaction for this portal client
  fastify.get('/transaction', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    // Get portal client to find contact_id
    const { data: portalClient, error: pcError } = await supabase
      .from('portal_clients')
      .select('contact_id')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single();

    if (pcError || !portalClient) {
      return reply.status(404).send({ error: 'Portal client not found' });
    }

    // Get active transaction for this contact
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('contact_id', portalClient.contact_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return reply.status(404).send({ error: 'No active transaction found' });
      }
      request.log.error(error, 'handler failed');
      return reply.status(500).send({ error: error.message });
    }

    return { data };
  });

  // ─── GET /agent ───────────────────────────────────────────────────────────
  // Get the client's assigned agent info
  fastify.get('/agent', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { data: portalClient, error: pcError } = await supabase
      .from('portal_clients')
      .select('agent_id')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single();

    if (pcError || !portalClient) {
      return reply.status(404).send({ error: 'Portal client not found' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, avatar_url')
      .eq('id', portalClient.agent_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return reply.status(404).send({ error: 'Agent not found' });
      }
      request.log.error(error, 'handler failed');
      return reply.status(500).send({ error: error.message });
    }

    return { data };
  });

  // ─── POST /brief/acknowledge ──────────────────────────────────────────────
  // Client acknowledges (signs off) their brief.
  fastify.post('/brief/acknowledge', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const parsed = PortalBriefAcknowledgementSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { clientBriefId, ipAddress } = parsed.data;

    try {
      const engine = new PortalEngine(supabase);
      await engine.acknowledgeBrief(clientBriefId, user.id, ipAddress);
      return reply.status(200).send({ data: { acknowledged: true } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found') || message.includes('Not found')) {
        return reply.status(404).send({ error: message });
      }
      if (message.includes('Forbidden')) {
        return reply.status(403).send({ error: message });
      }
      request.log.error(err, 'handler failed');
      return reply.status(500).send({ error: message });
    }
  });

  // ─── GET /properties ──────────────────────────────────────────────────────
  // Returns property matches with status='sent_to_client' for this portal client's brief.
  // Requires query param: briefId
  fastify.get<{ Querystring: { briefId?: string } }>('/properties', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { briefId } = request.query;
    if (!briefId) {
      return reply.status(400).send({ error: "'briefId' query parameter is required" });
    }

    try {
      const engine = new PortalEngine(supabase);
      const matches = await engine.getSentMatches(briefId);
      return { data: matches };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      request.log.error(err, 'handler failed');
      return reply.status(500).send({ error: message });
    }
  });

  // ─── POST /properties/:id/feedback ───────────────────────────────────────
  // Client provides feedback on a property match (interested/not_interested/ask_agent).
  fastify.post<{ Params: { id: string } }>('/properties/:id/feedback', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { id: matchId } = request.params;

    // Merge the matchId into the body for schema validation
    const bodyWithId = { ...(request.body as Record<string, unknown>), propertyMatchId: matchId };
    const parsed = PortalPropertyFeedbackSchema.safeParse(bodyWithId);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const engine = new PortalEngine(supabase);
      await engine.recordMatchFeedback(matchId, parsed.data, user.id);
      return reply.status(200).send({ data: { recorded: true } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found') || message.includes('Not found')) {
        return reply.status(404).send({ error: message });
      }
      if (message.includes('Forbidden')) {
        return reply.status(403).send({ error: message });
      }
      request.log.error(err, 'handler failed');
      return reply.status(500).send({ error: message });
    }
  });

  // ─── GET /inspections ─────────────────────────────────────────────────────
  // List inspections for this portal client's contact.
  fastify.get('/inspections', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    // Resolve contact_id from portal client
    const { data: portalClient, error: pcError } = await supabase
      .from('portal_clients')
      .select('contact_id')
      .eq('auth_id', user.id)
      .eq('is_active', true)
      .single();

    if (pcError || !portalClient) {
      return reply.status(404).send({ error: 'Portal client not found' });
    }

    const { data, error } = await supabase
      .from('inspections')
      .select(
        `
        id,
        inspection_date,
        overall_impression,
        client_rating,
        client_feedback,
        client_feedback_at,
        agent_notes,
        property:properties!property_id (
          id,
          address
        )
      `,
      )
      .eq('contact_id', (portalClient as { contact_id: string }).contact_id)
      .order('inspection_date', { ascending: false });

    if (error) {
      request.log.error(error, 'handler failed');
      return reply.status(500).send({ error: error.message });
    }

    return { data: data ?? [] };
  });

  // ─── POST /inspections/:id/feedback ──────────────────────────────────────
  // Client provides star rating and text feedback on a completed inspection.
  fastify.post<{ Params: { id: string } }>('/inspections/:id/feedback', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { id: inspectionId } = request.params;

    // Merge inspectionId into body for validation
    const bodyWithId = { ...(request.body as Record<string, unknown>), inspectionId };
    const parsed = PortalInspectionFeedbackSchema.safeParse(bodyWithId);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const engine = new PortalEngine(supabase);
      await engine.recordInspectionFeedback(inspectionId, parsed.data, user.id);
      return reply.status(200).send({ data: { recorded: true } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found') || message.includes('Not found')) {
        return reply.status(404).send({ error: message });
      }
      if (message.includes('Forbidden')) {
        return reply.status(403).send({ error: message });
      }
      request.log.error(err, 'handler failed');
      return reply.status(500).send({ error: message });
    }
  });

  // ─── POST /invite ──────────────────────────────────────────────────────────
  // Agent sends a portal invite (magic link) to a contact.
  const PortalInviteSchema = z.object({
    contactId: z.string().uuid(),
    email: z.string().email(),
  });

  fastify.post('/invite', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    // Authenticate the agent making the request
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const parsed = PortalInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { contactId, email } = parsed.data;
    const agentId = user.id;

    // Upsert the portal_clients record — one record per contact/agent pair
    const { data: portalClient, error: upsertError } = await supabase
      .from('portal_clients')
      .upsert(
        { contact_id: contactId, agent_id: agentId, is_active: true },
        { onConflict: 'contact_id,agent_id' },
      )
      .select('id')
      .single();

    if (upsertError || !portalClient) {
      request.log.error(upsertError, 'handler failed');
      return reply
        .status(500)
        .send({ error: upsertError?.message ?? 'Failed to create portal client' });
    }

    // Generate magic link using the Supabase admin client (service role)
    const supabaseAdmin = createSupabaseServiceClient();

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: process.env.PORTAL_URL ?? 'http://localhost:3002' },
    });

    if (linkError) {
      request.log.error(linkError, 'handler failed');
      return reply.status(500).send({ error: linkError.message });
    }

    // Log the magic link in non-production environments for easy testing
    if (env.NODE_ENV !== 'production') {
      fastify.log.debug(
        { magicLink: linkData.properties.action_link },
        '[Portal invite] Magic link',
      );
    }

    // Optionally send via GmailClient if agent's Gmail credentials are configured.
    // Email failure must not fail the invite — the magic link is logged above as fallback.
    try {
      const gmailAccessToken = process.env.GMAIL_ACCESS_TOKEN;
      const gmailClientId = process.env.GMAIL_CLIENT_ID;
      const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;

      if (gmailAccessToken && gmailClientId && gmailClientSecret) {
        const gmail = new GmailClient({
          accessToken: gmailAccessToken,
          clientId: gmailClientId,
          clientSecret: gmailClientSecret,
        });

        await gmail.sendMessage({
          to: [email],
          subject: 'Your RealFlow client portal invitation',
          textBody: `You have been invited to your RealFlow client portal.\n\nClick the link below to access your portal:\n\n${linkData.properties.action_link}\n\nThis link expires in 24 hours.\n\nIf you did not expect this invitation, please ignore this email.`,
          htmlBody: `<p>You have been invited to your RealFlow client portal.</p><p><a href="${linkData.properties.action_link}">Click here to access your portal</a></p><p>This link expires in 24 hours.</p><p>If you did not expect this invitation, please ignore this email.</p>`,
        });
      }
    } catch (emailErr) {
      // Email failure is non-fatal — magic link was logged above
      fastify.log.warn({ emailErr }, '[Portal invite] Failed to send invitation email');
    }

    return reply.status(200).send({ success: true, portalClientId: portalClient.id });
  });
}
