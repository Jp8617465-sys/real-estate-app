import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSupabaseServiceClient } from '../middleware/supabase';
import {
  validateWebhookSignature,
  createWebhookGuards,
} from '../middleware/webhook-validation';
import {
  EmailLeadProcessor,
  type EmailLeadProcessingResult,
} from '../services/email-lead-processor';
import { evaluateTrigger, runWorkflow } from '@realflow/business-logic';
import type { WorkflowEvent, WorkflowContext } from '@realflow/business-logic';

// ─── Zod Schemas for Webhook Payloads ──────────────────────────────────

/**
 * SendGrid Inbound Parse webhook payload schema.
 * Covers the key fields from the SendGrid inbound parse format.
 */
const SendGridInboundSchema = z.object({
  from: z.string().min(1, 'Sender address is required'),
  to: z.string().min(1, 'Recipient address is required'),
  subject: z.string().default('(No subject)'),
  text: z.string().default(''),
  html: z.string().optional(),
  headers: z.string().optional(),
  envelope: z.string().optional(),
  SPF: z.string().optional(),
});

/**
 * Mailgun inbound webhook payload schema.
 * Covers the key fields from the Mailgun routes/forward format.
 */
const MailgunInboundSchema = z.object({
  sender: z.string().min(1, 'Sender address is required'),
  recipient: z.string().min(1, 'Recipient address is required'),
  from: z.string().min(1, 'From header is required'),
  subject: z.string().default('(No subject)'),
  'body-plain': z.string().default(''),
  'body-html': z.string().optional(),
  'Message-Id': z.string().optional(),
  'In-Reply-To': z.string().optional(),
  timestamp: z.string().optional(),
  token: z.string().optional(),
  signature: z.object({
    timestamp: z.string(),
    token: z.string(),
    signature: z.string(),
  }).optional(),
});

/**
 * Generic/normalised inbound email schema.
 * This is the preferred format for direct integrations.
 */
const NormalisedEmailWebhookSchema = z.object({
  from: z.string().min(1, 'Sender address is required'),
  to: z.union([z.string(), z.array(z.string())]).transform((val) =>
    Array.isArray(val) ? val : [val],
  ),
  subject: z.string().default('(No subject)'),
  textBody: z.string().default(''),
  htmlBody: z.string().optional(),
  messageId: z.string().min(1, 'Message ID is required'),
  threadId: z.string().optional(),
  receivedAt: z.string().datetime().optional(),
  provider: z.enum(['sendgrid', 'mailgun', 'generic']).default('generic'),
});
type NormalisedEmailWebhook = z.infer<typeof NormalisedEmailWebhookSchema>;

// ─── Webhook Guards (singleton) ─────────────────────────────────────────

const { rateLimiter, idempotencyGuard } = createWebhookGuards();

// ─── Helper: Extract Message-ID from headers ───────────────────────────

function extractMessageIdFromHeaders(headers: string): string {
  const match = headers.match(/Message-Id:\s*<?([^>\s]+)>?/i);
  return match?.[1] ?? crypto.randomUUID();
}

// ─── Helper: Normalise SendGrid payload ─────────────────────────────────

function normaliseSendGrid(parsed: z.infer<typeof SendGridInboundSchema>): NormalisedEmailWebhook {
  const messageId = parsed.headers
    ? extractMessageIdFromHeaders(parsed.headers)
    : crypto.randomUUID();

  return {
    from: parsed.from,
    to: [parsed.to],
    subject: parsed.subject,
    textBody: parsed.text,
    htmlBody: parsed.html,
    messageId,
    receivedAt: new Date().toISOString(),
    provider: 'sendgrid',
  };
}

// ─── Helper: Normalise Mailgun payload ──────────────────────────────────

function normaliseMailgun(parsed: z.infer<typeof MailgunInboundSchema>): NormalisedEmailWebhook {
  return {
    from: parsed.from,
    to: [parsed.recipient],
    subject: parsed.subject,
    textBody: parsed['body-plain'],
    htmlBody: parsed['body-html'],
    messageId: parsed['Message-Id'] ?? crypto.randomUUID(),
    threadId: parsed['In-Reply-To'],
    receivedAt: parsed.timestamp
      ? new Date(parseInt(parsed.timestamp, 10) * 1000).toISOString()
      : new Date().toISOString(),
    provider: 'mailgun',
  };
}

// ─── Workflow Dispatch (async, fire-and-forget) ─────────────────────────

async function dispatchWorkflowEvents(
  events: WorkflowEvent[],
  fastify: FastifyInstance,
): Promise<void> {
  if (events.length === 0) return;

  const supabase = createSupabaseServiceClient();

  // Fetch all active workflows
  const { data: workflows, error } = await (supabase
    .from('workflows')
    .select('*') as unknown as {
      eq: (field: string, value: unknown) => {
        eq: (field: string, value: unknown) => Promise<{
          data: Array<Record<string, unknown>> | null;
          error: { message: string } | null;
        }>;
      };
    })
    .eq('is_active', true)
    .eq('is_deleted', false);

  if (error || !workflows || workflows.length === 0) {
    if (error) {
      fastify.log.error({ error }, 'Failed to fetch workflows for event dispatch');
    }
    return;
  }

  for (const event of events) {
    for (const wf of workflows) {
      const workflow = {
        id: wf['id'] as string,
        name: wf['name'] as string,
        description: wf['description'] as string | undefined,
        trigger: wf['trigger'] as Parameters<typeof evaluateTrigger>[0],
        conditions: wf['conditions'] as { field: string; operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'; value?: unknown }[],
        actions: wf['actions'] as { type: string }[],
        isActive: wf['is_active'] as boolean,
        createdBy: wf['created_by'] as string,
        createdAt: wf['created_at'] as string,
        updatedAt: wf['updated_at'] as string,
      };

      if (!evaluateTrigger(workflow.trigger, event)) continue;

      // Fetch entity data for condition evaluation
      let entityData: Record<string, unknown> = {};
      if (event.contactId) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', event.contactId)
          .single();
        if (contact) entityData = contact as Record<string, unknown>;
      }

      const context: WorkflowContext = {
        contactId: event.contactId,
        transactionId: event.transactionId,
        entityData,
        supabase: supabase as unknown as WorkflowContext['supabase'],
      };

      try {
        const result = await runWorkflow(
          workflow as Parameters<typeof runWorkflow>[0],
          event,
          context,
        );
        fastify.log.info(
          { workflowId: workflow.id, status: result.status, actionsExecuted: result.actionsExecuted },
          'Workflow executed from email lead',
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown workflow error';
        fastify.log.error({ workflowId: workflow.id, error: message }, 'Workflow execution failed');
      }
    }
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────

/**
 * Inbound email webhook routes for the Email Lead Capture Pipeline.
 *
 * POST /email          - Generic/normalised inbound email webhook
 * POST /email/sendgrid - SendGrid Inbound Parse webhook
 * POST /email/mailgun  - Mailgun inbound webhook
 *
 * All endpoints:
 *  1. Validate webhook signature (when secret is configured)
 *  2. Apply rate limiting per IP
 *  3. Check idempotency (prevent duplicate processing)
 *  4. Validate payload with Zod
 *  5. Process through EmailLeadProcessor
 *  6. Trigger workflow events asynchronously
 *  7. Return 200 quickly
 */
export async function inboxEmailRoutes(fastify: FastifyInstance) {
  // ─── POST /email — Generic normalised format ────────────────────────
  fastify.post('/email', async (request, reply) => {
    // Rate limit
    const clientIp = request.ip;
    if (!rateLimiter.check(clientIp)) {
      return reply.status(429).send({ error: 'Too many requests' });
    }

    // Validate payload
    const parsed = NormalisedEmailWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const payload = parsed.data;

    // Idempotency check
    if (idempotencyGuard.isDuplicate(payload.messageId)) {
      return reply.status(200).send({
        received: true,
        duplicate: true,
        messageId: payload.messageId,
      });
    }

    // Process the email lead
    const supabase = createSupabaseServiceClient();
    const processor = new EmailLeadProcessor(supabase as unknown as ConstructorParameters<typeof EmailLeadProcessor>[0]);

    let result: EmailLeadProcessingResult;
    try {
      result = await processor.process({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        textBody: payload.textBody,
        htmlBody: payload.htmlBody,
        messageId: payload.messageId,
        threadId: payload.threadId,
        receivedAt: payload.receivedAt ?? new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      fastify.log.error({ error: message }, 'Email lead processing failed');
      return reply.status(500).send({ error: message });
    }

    // Fire workflow events asynchronously (do not block response)
    dispatchWorkflowEvents(result.workflowEvents, fastify).catch((err) => {
      const message = err instanceof Error ? err.message : 'Workflow dispatch failed';
      fastify.log.error({ error: message }, 'Async workflow dispatch failed');
    });

    return reply.status(200).send({
      received: true,
      contactId: result.contactId,
      messageId: result.messageId,
      isNewContact: result.isNewContact,
      leadType: result.leadType,
      leadScore: result.leadScore,
      classification: result.classification,
    });
  });

  // ─── POST /email/sendgrid — SendGrid Inbound Parse format ──────────
  fastify.post('/email/sendgrid', async (request, reply) => {
    // Rate limit
    const clientIp = request.ip;
    if (!rateLimiter.check(clientIp)) {
      return reply.status(429).send({ error: 'Too many requests' });
    }

    // Signature verification
    const sendgridSecret = process.env.SENDGRID_WEBHOOK_SECRET;
    if (!validateWebhookSignature('sendgrid', request, sendgridSecret)) {
      fastify.log.warn('SendGrid webhook signature validation failed');
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }

    // Validate payload
    const parsed = SendGridInboundSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    // Normalise to common format
    const normalised = normaliseSendGrid(parsed.data);

    // Idempotency check
    if (idempotencyGuard.isDuplicate(normalised.messageId)) {
      return reply.status(200).send({
        received: true,
        duplicate: true,
        messageId: normalised.messageId,
      });
    }

    // Process
    const supabase = createSupabaseServiceClient();
    const processor = new EmailLeadProcessor(supabase as unknown as ConstructorParameters<typeof EmailLeadProcessor>[0]);

    let result: EmailLeadProcessingResult;
    try {
      result = await processor.process({
        from: normalised.from,
        to: normalised.to,
        subject: normalised.subject,
        textBody: normalised.textBody,
        htmlBody: normalised.htmlBody,
        messageId: normalised.messageId,
        threadId: normalised.threadId,
        receivedAt: normalised.receivedAt ?? new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      fastify.log.error({ error: message }, 'SendGrid email processing failed');
      return reply.status(500).send({ error: message });
    }

    // Fire workflow events asynchronously
    dispatchWorkflowEvents(result.workflowEvents, fastify).catch((err) => {
      const message = err instanceof Error ? err.message : 'Workflow dispatch failed';
      fastify.log.error({ error: message }, 'Async workflow dispatch failed');
    });

    return reply.status(200).send({
      received: true,
      contactId: result.contactId,
      messageId: result.messageId,
      isNewContact: result.isNewContact,
      leadType: result.leadType,
      leadScore: result.leadScore,
      classification: result.classification,
    });
  });

  // ─── POST /email/mailgun — Mailgun inbound format ──────────────────
  fastify.post('/email/mailgun', async (request, reply) => {
    // Rate limit
    const clientIp = request.ip;
    if (!rateLimiter.check(clientIp)) {
      return reply.status(429).send({ error: 'Too many requests' });
    }

    // Signature verification
    const mailgunSecret = process.env.MAILGUN_WEBHOOK_SECRET;
    if (!validateWebhookSignature('mailgun', request, mailgunSecret)) {
      fastify.log.warn('Mailgun webhook signature validation failed');
      return reply.status(401).send({ error: 'Invalid webhook signature' });
    }

    // Validate payload
    const parsed = MailgunInboundSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    // Normalise to common format
    const normalised = normaliseMailgun(parsed.data);

    // Idempotency check
    if (idempotencyGuard.isDuplicate(normalised.messageId)) {
      return reply.status(200).send({
        received: true,
        duplicate: true,
        messageId: normalised.messageId,
      });
    }

    // Process
    const supabase = createSupabaseServiceClient();
    const processor = new EmailLeadProcessor(supabase as unknown as ConstructorParameters<typeof EmailLeadProcessor>[0]);

    let result: EmailLeadProcessingResult;
    try {
      result = await processor.process({
        from: normalised.from,
        to: normalised.to,
        subject: normalised.subject,
        textBody: normalised.textBody,
        htmlBody: normalised.htmlBody,
        messageId: normalised.messageId,
        threadId: normalised.threadId,
        receivedAt: normalised.receivedAt ?? new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      fastify.log.error({ error: message }, 'Mailgun email processing failed');
      return reply.status(500).send({ error: message });
    }

    // Fire workflow events asynchronously
    dispatchWorkflowEvents(result.workflowEvents, fastify).catch((err) => {
      const message = err instanceof Error ? err.message : 'Workflow dispatch failed';
      fastify.log.error({ error: message }, 'Async workflow dispatch failed');
    });

    return reply.status(200).send({
      received: true,
      contactId: result.contactId,
      messageId: result.messageId,
      isNewContact: result.isNewContact,
      leadType: result.leadType,
      leadScore: result.leadScore,
      classification: result.classification,
    });
  });
}
