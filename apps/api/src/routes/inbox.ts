import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  InboxFilterSchema,
  SendMessageRequestSchema,
  type MessageChannel,
} from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';
import { IntegrationRegistry } from '../services/integration-registry';

/**
 * Unified Inbox API routes.
 *
 * Provides endpoints for:
 * - Listing inbox threads (grouped by contact)
 * - Fetching conversation thread for a contact
 * - Sending messages on any channel
 * - Marking messages as read
 * - Searching across all conversations
 */
export async function inboxRoutes(fastify: FastifyInstance) {
  // ─── List Inbox Threads ─────────────────────────────────────────────
  // Returns conversations grouped by contact, with last message and unread count.
  fastify.get('/', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const filters = InboxFilterSchema.parse(request.query);

    // Use the inbox_thread_summaries view for efficient grouped queries
    let query = supabase
      .from('inbox_thread_summaries')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(50);

    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId);
    }

    if (filters.channels?.length) {
      query = query.in('last_message_channel', filters.channels);
    }

    if (filters.isRead === false) {
      query = query.gt('unread_count', 0);
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });

    return { data };
  });

  // ─── Get Conversation Thread ────────────────────────────────────────
  // Returns all messages for a specific contact, ordered chronologically.
  fastify.get<{ Params: { contactId: string } }>(
    '/contacts/:contactId',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { contactId } = request.params;
      const queryParams = request.query as Record<string, string>;
      const limit = parseInt(queryParams.limit ?? '50', 10);
      const offset = parseInt(queryParams.offset ?? '0', 10);

      let query = supabase
        .from('conversation_messages')
        .select('*', { count: 'exact' })
        .eq('contact_id', contactId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      // Optional channel filter
      if (queryParams.channel) {
        query = query.eq('channel', queryParams.channel);
      }

      const { data, error, count } = await query;
      if (error) return reply.status(500).send({ error: error.message });

      return {
        data: {
          contactId,
          messages: data,
          totalMessages: count ?? 0,
        },
      };
    },
  );

  // ─── Get Single Message ─────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/messages/:id',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { id } = request.params;

      const { data, error } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

      if (error) return reply.status(404).send({ error: 'Message not found' });
      return { data };
    },
  );

  // ─── Send Message ──────────────────────────────────────────────────
  // Sends a message on the specified channel and records it in the inbox.
  fastify.post('/send', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = SendMessageRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const msg = parsed.data;

    // Get the current user as the agent
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .single();

    if (!userData) {
      return reply.status(401).send({ error: 'User not found' });
    }

    // Dispatch to the appropriate channel sender
    const sendResult = await dispatchOutboundMessage(msg.channel, msg, fastify, request);

    // Record the outbound message in the conversation
    const { data, error } = await supabase
      .from('conversation_messages')
      .insert({
        channel: msg.channel,
        direction: 'outbound',
        contact_id: msg.contactId,
        agent_id: userData.id,
        content: msg.content,
        metadata: sendResult.metadata ?? {},
        property_id: msg.propertyId,
        transaction_id: msg.transactionId,
        status: sendResult.success ? 'delivered' : 'failed',
        is_read: true,
        external_message_id: sendResult.externalId,
      })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });

    // Log activity
    await supabase.from('activities').insert({
      contact_id: msg.contactId,
      type: getActivityType(msg.channel, 'outbound'),
      title: `Sent ${formatChannelName(msg.channel)}`,
      description: msg.content.subject ?? msg.content.text?.slice(0, 100),
      created_by: userData.id,
      metadata: { messageId: data.id, channel: msg.channel },
    });

    return reply.status(201).send({ data });
  });

  // ─── Mark Messages as Read ─────────────────────────────────────────
  fastify.post<{ Params: { contactId: string } }>(
    '/contacts/:contactId/read',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { contactId } = request.params;

      const { error } = await supabase
        .from('conversation_messages')
        .update({ is_read: true })
        .eq('contact_id', contactId)
        .eq('direction', 'inbound')
        .eq('is_read', false);

      if (error) return reply.status(500).send({ error: error.message });
      return { success: true };
    },
  );

  // ─── Mark Single Message as Read ───────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/messages/:id/read',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { id } = request.params;

      const { error } = await supabase
        .from('conversation_messages')
        .update({ is_read: true })
        .eq('id', id);

      if (error) return reply.status(500).send({ error: error.message });
      return { success: true };
    },
  );

  // ─── Search Messages ───────────────────────────────────────────────
  fastify.get('/search', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const queryParams = request.query as Record<string, string>;
    const searchQuery = queryParams.q ?? '';
    const limit = parseInt(queryParams.limit ?? '20', 10);

    if (!searchQuery) {
      return reply.status(400).send({ error: 'Search query "q" is required' });
    }

    // Search in message content text
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('*, contacts!inner(first_name, last_name)')
      .eq('is_deleted', false)
      .or(
        `content->>text.ilike.%${searchQuery}%,content->>subject.ilike.%${searchQuery}%`,
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── Get Unread Counts per Channel ─────────────────────────────────
  fastify.get('/unread-counts', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const queryParams = request.query as Record<string, string>;

    let query = supabase
      .from('conversation_messages')
      .select('channel', { count: 'exact' })
      .eq('direction', 'inbound')
      .eq('is_read', false)
      .eq('is_deleted', false);

    if (queryParams.agentId) {
      query = query.eq('agent_id', queryParams.agentId);
    }

    const { data, error } = await query;
    if (error) return reply.status(500).send({ error: error.message });

    // Group by channel
    const counts: Record<string, number> = {};
    let total = 0;

    if (data) {
      for (const row of data) {
        const channel = (row as Record<string, unknown>).channel as string;
        counts[channel] = (counts[channel] ?? 0) + 1;
        total++;
      }
    }

    return { data: { counts, total } };
  });

  // ─── Soft Delete Message ───────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/messages/:id',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { id } = request.params;

      const { error } = await supabase
        .from('conversation_messages')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) return reply.status(500).send({ error: error.message });
      return { success: true };
    },
  );

  // ─── Get Contact Channels ─────────────────────────────────────────
  fastify.get<{ Params: { contactId: string } }>(
    '/contacts/:contactId/channels',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { contactId } = request.params;

      const { data, error } = await supabase
        .from('contact_channels')
        .select('*')
        .eq('contact_id', contactId)
        .single();

      if (error) return reply.status(404).send({ error: 'Contact channels not found' });
      return { data };
    },
  );
}

// ─── Helper Functions ──────────────────────────────────────────────────

/**
 * Look up a contact's communication details from the contacts table.
 */
async function getContactDetails(
  request: FastifyRequest,
  contactId: string,
): Promise<{ email: string | null; phone: string | null } | null> {
  const supabase = createSupabaseClient(request);
  const { data } = await supabase
    .from('contacts')
    .select('email, phone')
    .eq('id', contactId)
    .eq('is_deleted', false)
    .single();
  return data;
}

/**
 * Dispatch an outbound message to the appropriate integration client.
 * Looks up OAuth tokens from the DB via the IntegrationRegistry,
 * resolves the contact's email/phone, and sends via the real client.
 * Returns { success: false } gracefully if the integration is not connected.
 */
async function dispatchOutboundMessage(
  channel: MessageChannel,
  msg: { contactId: string; content: { text?: string; subject?: string; html?: string } },
  fastify: FastifyInstance,
  request: FastifyRequest,
): Promise<{ success: boolean; externalId?: string; metadata?: Record<string, unknown> }> {
  fastify.log.info({ channel }, 'Dispatching outbound message');

  // Get the authenticated user's ID for token lookup
  const supabase = createSupabaseClient(request);
  const { data: userData } = await supabase.from('users').select('id').single();
  if (!userData) return { success: false };

  const registry = new IntegrationRegistry(request, userData.id);
  const contact = await getContactDetails(request, msg.contactId);

  switch (channel) {
    case 'email': {
      const gmail = await registry.getGmailClient();
      if (!gmail) return { success: false };
      const recipientEmail = contact?.email;
      if (!recipientEmail) return { success: false };

      const result = await gmail.sendMessage({
        to: [recipientEmail],
        subject: msg.content.subject ?? '(No subject)',
        textBody: msg.content.text ?? '',
        htmlBody: msg.content.html,
      });
      return { success: true, externalId: result.id, metadata: { threadId: result.threadId } };
    }

    case 'sms': {
      const twilio = await registry.getTwilioClient();
      if (!twilio) return { success: false };
      const recipientPhone = contact?.phone;
      if (!recipientPhone) return { success: false };

      const result = await twilio.sendSms({
        to: recipientPhone,
        body: msg.content.text ?? '',
      });
      return { success: true, externalId: result.sid, metadata: { status: result.status } };
    }

    case 'whatsapp': {
      const whatsapp = await registry.getWhatsAppClient();
      if (!whatsapp) return { success: false };
      const recipientPhone = contact?.phone;
      if (!recipientPhone) return { success: false };

      const result = await whatsapp.sendTextMessage({
        to: recipientPhone,
        text: msg.content.text ?? '',
      });
      const messageId = result.messages?.[0]?.id;
      return { success: true, externalId: messageId };
    }

    case 'instagram_dm':
    case 'facebook_messenger': {
      const meta = await registry.getMetaClient();
      if (!meta) return { success: false };

      // Look up the contact's social conversation ID from contact_channels
      const { data: channels } = await supabase
        .from('contact_channels')
        .select('*')
        .eq('contact_id', msg.contactId)
        .single();

      const conversationId = channel === 'instagram_dm'
        ? (channels?.instagram_id as string | undefined)
        : (channels?.facebook_id as string | undefined);

      if (!conversationId) return { success: false };

      const result = await meta.sendPageMessage(conversationId, msg.content.text ?? '');
      return { success: true, externalId: result.id };
    }

    case 'phone_call': {
      const twilio = await registry.getTwilioClient();
      if (!twilio) return { success: false };
      const recipientPhone = contact?.phone;
      if (!recipientPhone) return { success: false };

      const twimlUrl = process.env.TWILIO_TWIML_URL ?? '';
      const result = await twilio.initiateCall({
        to: recipientPhone,
        twimlUrl,
      });
      return { success: true, externalId: result.sid, metadata: { status: result.status } };
    }

    case 'internal_note':
      // No external dispatch needed -- just stored in DB
      return { success: true };

    default:
      return { success: false };
  }
}

function getActivityType(
  channel: MessageChannel,
  direction: 'inbound' | 'outbound',
): string {
  const map: Record<string, Record<string, string>> = {
    email: { inbound: 'email-received', outbound: 'email-sent' },
    sms: { inbound: 'sms-received', outbound: 'sms-sent' },
    phone_call: { inbound: 'call', outbound: 'call' },
    instagram_dm: { inbound: 'social-dm-received', outbound: 'social-dm-sent' },
    facebook_messenger: { inbound: 'social-dm-received', outbound: 'social-dm-sent' },
    whatsapp: { inbound: 'sms-received', outbound: 'sms-sent' },
    internal_note: { inbound: 'note-added', outbound: 'note-added' },
    domain_enquiry: { inbound: 'email-received', outbound: 'email-sent' },
    rea_enquiry: { inbound: 'email-received', outbound: 'email-sent' },
  };

  return map[channel]?.[direction] ?? 'system';
}

function formatChannelName(channel: MessageChannel): string {
  const names: Record<string, string> = {
    email: 'email',
    sms: 'SMS',
    phone_call: 'phone call',
    whatsapp: 'WhatsApp message',
    instagram_dm: 'Instagram DM',
    facebook_messenger: 'Facebook message',
    internal_note: 'internal note',
    domain_enquiry: 'Domain enquiry reply',
    rea_enquiry: 'REA enquiry reply',
  };

  return names[channel] ?? channel;
}
