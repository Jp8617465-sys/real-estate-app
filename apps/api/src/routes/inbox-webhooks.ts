import type { FastifyInstance } from 'fastify';
import { MessageNormaliser, EmailParser } from '@realflow/business-logic';
import type { NormalisedInboundMessage } from '@realflow/shared';
import { createSupabaseClient } from '../middleware/supabase';

/**
 * Inbound webhook handlers for the unified inbox.
 *
 * Each channel provider sends webhooks to a specific endpoint.
 * The flow is:
 * 1. Receive raw webhook payload
 * 2. Queue it for reliable processing
 * 3. Normalise the payload
 * 4. Match to existing contact (or create new one)
 * 5. Store as ConversationMessage
 * 6. Trigger real-time notification
 */
export async function inboxWebhookRoutes(fastify: FastifyInstance) {
  // ─── Twilio SMS Inbound ─────────────────────────────────────────────
  fastify.post('/sms', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const payload = request.body as Record<string, string>;

    fastify.log.info({ from: payload['From'] }, 'Inbound SMS received');

    // Queue the raw payload for reliability
    await supabase.from('inbound_message_queue').insert({
      channel: 'sms',
      raw_payload: payload,
      processing_status: 'processing',
    });

    // Normalise
    const normalised = MessageNormaliser.normaliseSms({
      MessageSid: payload['MessageSid'] ?? '',
      From: payload['From'] ?? '',
      To: payload['To'] ?? '',
      Body: payload['Body'] ?? '',
      NumMedia: payload['NumMedia'],
      MediaUrl0: payload['MediaUrl0'],
      MediaContentType0: payload['MediaContentType0'],
    });

    // Match contact and store message
    await processInboundMessage(normalised, supabase, fastify);

    // Return TwiML empty response (Twilio expects XML)
    reply.type('text/xml');
    return '<Response></Response>';
  });

  // ─── Twilio Voice Status Callback ───────────────────────────────────
  fastify.post('/voice/status', async (_request, _reply) => {
    const supabase = createSupabaseClient(_request);
    const payload = _request.body as Record<string, string>;
    const callStatus = payload['CallStatus'] ?? '';

    fastify.log.info({ callSid: payload['CallSid'], status: callStatus }, 'Voice status update');

    // Only process completed calls
    const terminalStatuses = ['completed', 'busy', 'no-answer', 'canceled', 'failed'];
    if (!terminalStatuses.includes(callStatus)) {
      return { received: true };
    }

    const normalised = MessageNormaliser.normalisePhoneCall({
      CallSid: payload['CallSid'] ?? '',
      From: payload['From'] ?? '',
      To: payload['To'] ?? '',
      CallStatus: callStatus,
      CallDuration: payload['CallDuration'],
      RecordingUrl: payload['RecordingUrl'],
      TranscriptionText: payload['TranscriptionText'],
    });

    await processInboundMessage(normalised, supabase, fastify);
    return { received: true };
  });

  // ─── Meta (Instagram + Facebook) Messaging Webhook ──────────────────
  fastify.post('/meta/messaging', async (request, _reply) => {
    const supabase = createSupabaseClient(request);
    const payload = request.body as Record<string, unknown>;

    fastify.log.info('Meta messaging webhook received');

    const isInstagram = payload['object'] === 'instagram';

    // Queue raw payload
    await supabase.from('inbound_message_queue').insert({
      channel: isInstagram ? 'instagram_dm' : 'facebook_messenger',
      raw_payload: payload,
      processing_status: 'processing',
    });

    const channel = isInstagram ? 'instagram_dm' as const : 'facebook_messenger' as const;

    const normalisedMessages = MessageNormaliser.normaliseMetaMessage(
      payload as unknown as Parameters<typeof MessageNormaliser.normaliseMetaMessage>[0],
      channel,
    );

    for (const normalised of normalisedMessages) {
      await processInboundMessage(normalised, supabase, fastify);
    }

    return { received: true };
  });

  // ─── Meta Webhook Verification (GET) ────────────────────────────────
  fastify.get('/meta/messaging', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? '';

    if (mode === 'subscribe' && token === expectedToken) {
      fastify.log.info('Meta webhook verified');
      return reply.status(200).send(challenge);
    }

    return reply.status(403).send({ error: 'Verification failed' });
  });

  // ─── WhatsApp Inbound Webhook ──────────────────────────────────────
  fastify.post('/whatsapp', async (request, _reply) => {
    const supabase = createSupabaseClient(request);
    const payload = request.body as Record<string, unknown>;

    fastify.log.info('WhatsApp webhook received');

    await supabase.from('inbound_message_queue').insert({
      channel: 'whatsapp',
      raw_payload: payload,
      processing_status: 'processing',
    });

    const normalisedMessages = MessageNormaliser.normaliseWhatsApp(
      payload as unknown as Parameters<typeof MessageNormaliser.normaliseWhatsApp>[0],
    );

    for (const normalised of normalisedMessages) {
      await processInboundMessage(normalised, supabase, fastify);
    }

    return { received: true };
  });

  // ─── WhatsApp Webhook Verification (GET) ────────────────────────────
  fastify.get('/whatsapp', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? '';

    if (mode === 'subscribe' && token === expectedToken) {
      return reply.status(200).send(challenge);
    }

    return reply.status(403).send({ error: 'Verification failed' });
  });

  // ─── Gmail Push Notification (Pub/Sub) ──────────────────────────────
  fastify.post('/gmail/push', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const body = request.body as { message?: { data?: string; messageId?: string } };

    if (!body.message?.data) {
      return reply.status(400).send({ error: 'Missing message data' });
    }

    // Decode base64 Pub/Sub message
    const decoded = Buffer.from(body.message.data, 'base64').toString('utf-8');
    const gmailNotification = JSON.parse(decoded) as {
      emailAddress: string;
      historyId: string;
    };

    fastify.log.info({ emailAddress: gmailNotification.emailAddress }, 'Gmail push notification');

    // Queue for processing
    await supabase.from('inbound_message_queue').insert({
      channel: 'email',
      raw_payload: { ...gmailNotification, pubsubMessageId: body.message.messageId },
      processing_status: 'pending',
    });

    return reply.status(200).send({ received: true });
  });

  // ─── Email Forwarding Inbound (for portal enquiries) ────────────────
  fastify.post('/email/inbound', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const payload = request.body as {
      from: string;
      to: string[];
      subject: string;
      textBody: string;
      htmlBody?: string;
      messageId: string;
      threadId?: string;
      receivedAt?: string;
    };

    fastify.log.info({ from: payload.from, subject: payload.subject }, 'Inbound email received');

    // Process through email parser (detects portal enquiries)
    const { classification, normalisedMessage, portalEnquiry } =
      EmailParser.processInboundEmail({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        textBody: payload.textBody,
        htmlBody: payload.htmlBody,
        messageId: payload.messageId,
        threadId: payload.threadId,
        receivedAt: payload.receivedAt ?? new Date().toISOString(),
      });

    fastify.log.info({ classification }, 'Email classified');

    const result = await processInboundMessage(normalisedMessage, supabase, fastify);

    // If this is a portal enquiry, update the source detail
    if (portalEnquiry && result.contactId) {
      await supabase
        .from('contacts')
        .update({
          source_detail: `${portalEnquiry.source} enquiry: ${portalEnquiry.propertyAddress}`,
        })
        .eq('id', result.contactId);
    }

    return reply.status(200).send({
      received: true,
      classification,
      contactId: result.contactId,
      messageId: result.messageId,
      isNewContact: result.isNewContact,
    });
  });
}

// ─── Shared Message Processing Pipeline ────────────────────────────────

interface ProcessResult {
  contactId: string;
  messageId: string;
  isNewContact: boolean;
}

async function processInboundMessage(
  normalised: NormalisedInboundMessage,
  supabase: ReturnType<typeof createSupabaseClient>,
  fastify: FastifyInstance,
): Promise<ProcessResult> {
  let contactId: string;
  let isNewContact = false;

  // 1. Match to existing contact by phone, email, or social ID
  const matched = await matchContactFromMessage(normalised, supabase);

  if (matched) {
    contactId = matched.contactId;
    fastify.log.info(
      { contactId, matchedBy: matched.matchedBy },
      'Contact matched',
    );
  } else {
    // Create new contact
    const name = normalised.senderName ?? 'Unknown';
    const parts = name.split(' ');
    const firstName = parts[0] ?? 'Unknown';
    const lastName = parts.slice(1).join(' ') || 'Unknown';

    const channelToSource: Record<string, string> = {
      email: 'website',
      sms: 'other',
      phone_call: 'cold-call',
      whatsapp: 'other',
      instagram_dm: 'instagram',
      facebook_messenger: 'facebook',
      domain_enquiry: 'domain',
      rea_enquiry: 'rea',
    };

    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        types: ['buyer'],
        first_name: firstName,
        last_name: lastName,
        email: normalised.senderEmail,
        phone: normalised.senderPhone ?? '',
        source: channelToSource[normalised.channel] ?? 'other',
        assigned_agent_id: '00000000-0000-0000-0000-000000000000',
        tags: ['new-lead', `source-${normalised.channel}`],
        communication_preference: 'any',
      })
      .select()
      .single();

    if (error || !newContact) {
      fastify.log.error({ error }, 'Failed to create contact from inbound message');
      throw new Error(`Failed to create contact: ${error?.message}`);
    }

    contactId = newContact.id as string;
    isNewContact = true;

    // Create contact channels record
    await supabase.from('contact_channels').insert({
      contact_id: contactId,
      emails: normalised.senderEmail ? [normalised.senderEmail.toLowerCase()] : [],
      phones: normalised.senderPhone ? [normalised.senderPhone] : [],
      instagram_id: normalised.channel === 'instagram_dm' ? normalised.senderSocialId : null,
      facebook_id: normalised.channel === 'facebook_messenger' ? normalised.senderSocialId : null,
      whatsapp_number: normalised.channel === 'whatsapp' ? normalised.senderPhone : null,
    });

    fastify.log.info({ contactId, name: `${firstName} ${lastName}` }, 'New contact created');
  }

  // 2. Determine the agent (assigned agent for this contact)
  const { data: contact } = await supabase
    .from('contacts')
    .select('assigned_agent_id')
    .eq('id', contactId)
    .single();

  const agentId = (contact?.assigned_agent_id as string) ?? '00000000-0000-0000-0000-000000000000';

  // 3. Store the conversation message
  const { data: message, error: msgError } = await supabase
    .from('conversation_messages')
    .insert({
      channel: normalised.channel,
      direction: 'inbound',
      contact_id: contactId,
      agent_id: agentId,
      content: normalised.content,
      metadata: normalised.metadata,
      property_id: null,
      status: 'delivered',
      is_read: false,
      external_message_id: normalised.externalMessageId,
    })
    .select()
    .single();

  if (msgError || !message) {
    // Check if this is a duplicate (external_message_id unique constraint)
    if (msgError?.message?.includes('unique') || msgError?.message?.includes('duplicate')) {
      fastify.log.info({ externalId: normalised.externalMessageId }, 'Duplicate message ignored');
      return { contactId, messageId: '', isNewContact };
    }
    fastify.log.error({ error: msgError }, 'Failed to store conversation message');
    throw new Error(`Failed to store message: ${msgError?.message}`);
  }

  const messageId = message.id as string;

  // 4. Update last contact date on the contact record
  await supabase
    .from('contacts')
    .update({ last_contact_date: new Date().toISOString() })
    .eq('id', contactId);

  // 5. Log activity
  const activityType = getActivityTypeForChannel(normalised.channel);
  await supabase.from('activities').insert({
    contact_id: contactId,
    type: activityType,
    title: `${formatChannelLabel(normalised.channel)} received`,
    description: normalised.content.subject ?? normalised.content.text?.slice(0, 200),
    created_by: agentId,
    metadata: {
      messageId,
      channel: normalised.channel,
      isNewContact,
    },
  });

  fastify.log.info(
    { messageId, channel: normalised.channel, contactId },
    'Inbound message processed',
  );

  return { contactId, messageId, isNewContact };
}

// ─── Contact Matching (using direct Supabase queries) ──────────────────

async function matchContactFromMessage(
  normalised: NormalisedInboundMessage,
  supabase: ReturnType<typeof createSupabaseClient>,
): Promise<{ contactId: string; matchedBy: string } | null> {
  // 1. Match by phone number
  if (normalised.senderPhone) {
    const phone = normalised.senderPhone;
    // Try different phone formats
    const variants = getPhoneVariants(phone);

    for (const variant of variants) {
      const { data } = await supabase
        .from('contact_channels')
        .select('contact_id')
        .contains('phones', [variant]);

      const first = data?.[0];
      if (first) {
        return { contactId: first.contact_id as string, matchedBy: 'phone' };
      }
    }
  }

  // 2. Match by email
  if (normalised.senderEmail) {
    const emailLower = normalised.senderEmail.toLowerCase();
    const { data } = await supabase
      .from('contact_channels')
      .select('contact_id')
      .contains('emails', [emailLower]);

    const first = data?.[0];
    if (first) {
      return { contactId: first.contact_id as string, matchedBy: 'email' };
    }
  }

  // 3. Match by social ID
  if (normalised.senderSocialId) {
    let column: string | null = null;
    if (normalised.channel === 'instagram_dm') column = 'instagram_id';
    else if (normalised.channel === 'facebook_messenger') column = 'facebook_id';

    if (column) {
      const { data } = await supabase
        .from('contact_channels')
        .select('contact_id')
        .eq(column, normalised.senderSocialId);

      const first = data?.[0];
      if (first) {
        return { contactId: first.contact_id as string, matchedBy: column };
      }
    }
  }

  return null;
}

function getPhoneVariants(phone: string): string[] {
  const cleaned = phone.replace(/[^\d+]/g, '');
  const variants: string[] = [cleaned];

  if (cleaned.startsWith('+61')) {
    variants.push(`0${cleaned.slice(3)}`);
    variants.push(cleaned.slice(1));
  } else if (cleaned.startsWith('0') && cleaned.length >= 10) {
    variants.push(`+61${cleaned.slice(1)}`);
    variants.push(`61${cleaned.slice(1)}`);
  }

  return variants;
}

function getActivityTypeForChannel(channel: string): string {
  const map: Record<string, string> = {
    email: 'email-received',
    sms: 'sms-received',
    phone_call: 'call',
    whatsapp: 'sms-received',
    instagram_dm: 'social-dm-received',
    facebook_messenger: 'social-dm-received',
    domain_enquiry: 'email-received',
    rea_enquiry: 'email-received',
  };
  return map[channel] ?? 'system';
}

function formatChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    email: 'Email',
    sms: 'SMS',
    phone_call: 'Phone call',
    whatsapp: 'WhatsApp message',
    instagram_dm: 'Instagram DM',
    facebook_messenger: 'Facebook message',
    domain_enquiry: 'Domain enquiry',
    rea_enquiry: 'REA enquiry',
  };
  return labels[channel] ?? channel;
}
