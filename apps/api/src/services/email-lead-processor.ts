import { EmailParser } from '@realflow/business-logic';
import type { NormalisedInboundMessage, LeadSource, MessageChannel } from '@realflow/shared';
import type { WorkflowEvent } from '@realflow/business-logic';

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * The raw email payload as received from a SendGrid/Mailgun inbound webhook.
 * Matches the RawEmail interface used by EmailParser.
 */
export interface InboundEmailPayload {
  from: string;
  to: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  messageId: string;
  threadId?: string;
  receivedAt: string;
}

/**
 * Minimal Supabase client interface for testability.
 * Matches the shape returned by createSupabaseServiceClient().
 */
export interface SupabaseServiceClient {
  from: (table: string) => {
    insert: (data: Record<string, unknown>) => {
      select: () => {
        single: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
      };
    };
    update: (data: Record<string, unknown>) => {
      eq: (field: string, value: unknown) => {
        eq?: (field: string, value: unknown) => Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
        select?: () => {
          single: () => Promise<{
            data: Record<string, unknown> | null;
            error: { message: string } | null;
          }>;
        };
      } & Promise<{
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      }>;
    };
    select: (columns?: string) => {
      eq: (field: string, value: unknown) => {
        eq?: (field: string, value: unknown) => {
          single: () => Promise<{
            data: Record<string, unknown> | null;
            error: { message: string } | null;
          }>;
        };
        single: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
        contains?: (field: string, value: unknown) => {
          data?: Array<Record<string, unknown>> | null;
          error?: { message: string } | null;
        } & Promise<{
          data: Array<Record<string, unknown>> | null;
          error: { message: string } | null;
        }>;
      };
      contains: (field: string, value: unknown) => Promise<{
        data: Array<Record<string, unknown>> | null;
        error: { message: string } | null;
      }>;
      eq: (field: string, value: unknown) => {
        eq: (field: string, value: unknown) => {
          single: () => Promise<{
            data: Record<string, unknown> | null;
            error: { message: string } | null;
          }>;
          is_active?: boolean;
          is_deleted?: boolean;
        };
        single: () => Promise<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

/**
 * Lead type classification derived from email content and parser results.
 */
export type LeadType = 'buyer_inquiry' | 'seller_inquiry' | 'general';

/**
 * Lead score signals extracted from email content analysis.
 */
interface LeadScoreSignals {
  hasPhone: boolean;
  hasMessage: boolean;
  isPortalEnquiry: boolean;
  mentionsBudget: boolean;
  mentionsUrgency: boolean;
  mentionsPreApproval: boolean;
}

/**
 * Result of processing a single inbound email through the lead pipeline.
 */
export interface EmailLeadProcessingResult {
  contactId: string;
  messageId: string;
  isNewContact: boolean;
  leadType: LeadType;
  leadScore: number;
  classification: string;
  workflowEvents: WorkflowEvent[];
}

// ─── Lead Score Calculation ─────────────────────────────────────────────

const BUDGET_PATTERNS = [
  /budget/i,
  /afford/i,
  /price\s+range/i,
  /\$\d+/,
  /pre[- ]?approv/i,
  /finance/i,
  /loan/i,
];

const URGENCY_PATTERNS = [
  /urgent/i,
  /asap/i,
  /as\s+soon\s+as/i,
  /immediately/i,
  /right\s+away/i,
  /this\s+week/i,
  /this\s+month/i,
  /deadline/i,
  /moving\s+soon/i,
  /relocat/i,
];

const PRE_APPROVAL_PATTERNS = [
  /pre[- ]?approv/i,
  /finance\s+ready/i,
  /approved\s+for/i,
  /loan\s+approved/i,
];

const SELLER_PATTERNS = [
  /sell(?:ing)?\s+(?:my|our|the)\s+(?:home|house|property|apartment|unit)/i,
  /appraisal/i,
  /market\s+value/i,
  /list(?:ing)?\s+(?:my|our)/i,
  /want\s+to\s+sell/i,
  /thinking\s+(?:of|about)\s+sell/i,
];

/**
 * Analyse email content for buying/selling signals and compute a lead score.
 *
 * Score range: 0-100
 *  - Base 10 for any inbound email
 *  - +20 for portal enquiry (Domain/REA)
 *  - +15 for including phone number
 *  - +10 for including a message body
 *  - +15 for mentioning budget/price
 *  - +15 for urgency language
 *  - +15 for pre-approval mention
 */
export function calculateLeadScore(
  signals: LeadScoreSignals,
): number {
  let score = 10; // base score for any inbound email

  if (signals.isPortalEnquiry) score += 20;
  if (signals.hasPhone) score += 15;
  if (signals.hasMessage) score += 10;
  if (signals.mentionsBudget) score += 15;
  if (signals.mentionsUrgency) score += 15;
  if (signals.mentionsPreApproval) score += 15;

  return Math.min(100, score);
}

/**
 * Extract lead score signals from email text content.
 */
export function extractLeadSignals(
  textBody: string,
  hasPhone: boolean,
  isPortalEnquiry: boolean,
): LeadScoreSignals {
  return {
    hasPhone,
    hasMessage: textBody.trim().length > 0,
    isPortalEnquiry,
    mentionsBudget: BUDGET_PATTERNS.some((p) => p.test(textBody)),
    mentionsUrgency: URGENCY_PATTERNS.some((p) => p.test(textBody)),
    mentionsPreApproval: PRE_APPROVAL_PATTERNS.some((p) => p.test(textBody)),
  };
}

/**
 * Determine the lead type from the email classification.
 */
export function classifyLeadType(
  classification: string,
  textBody: string,
): LeadType {
  if (classification === 'domain_enquiry' || classification === 'rea_enquiry') {
    return 'buyer_inquiry';
  }

  if (SELLER_PATTERNS.some((p) => p.test(textBody))) {
    return 'seller_inquiry';
  }

  return 'general';
}

// ─── Contact Deduplication ──────────────────────────────────────────────

interface DeduplicationMatch {
  contactId: string;
  matchedBy: 'email' | 'phone';
}

/**
 * Search for an existing contact by email address or phone number.
 * Checks the contact_channels table for matches.
 */
async function findExistingContact(
  supabase: SupabaseServiceClient,
  email: string | undefined,
  phone: string | undefined,
): Promise<DeduplicationMatch | null> {
  // 1. Try email match
  if (email) {
    const emailLower = email.toLowerCase();
    const { data } = await supabase
      .from('contact_channels')
      .select('contact_id')
      .contains('emails', [emailLower]);

    const first = data?.[0];
    if (first) {
      return { contactId: first['contact_id'] as string, matchedBy: 'email' };
    }
  }

  // 2. Try phone match (with Australian format variants)
  if (phone) {
    const cleaned = phone.replace(/[^\d+]/g, '');
    const variants = getPhoneVariants(cleaned);

    for (const variant of variants) {
      const { data } = await supabase
        .from('contact_channels')
        .select('contact_id')
        .contains('phones', [variant]);

      const first = data?.[0];
      if (first) {
        return { contactId: first['contact_id'] as string, matchedBy: 'phone' };
      }
    }
  }

  return null;
}

function getPhoneVariants(cleaned: string): string[] {
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

// ─── Channel-to-Source Mapping ──────────────────────────────────────────

function channelToLeadSource(channel: MessageChannel): LeadSource {
  const map: Record<string, LeadSource> = {
    email: 'website',
    domain_enquiry: 'domain',
    rea_enquiry: 'rea',
  };
  return map[channel] ?? 'other';
}

// ─── Email Lead Processor ───────────────────────────────────────────────

/**
 * EmailLeadProcessor orchestrates the full inbound email lead capture pipeline:
 *
 * 1. Parse the email using EmailParser (classifies + extracts portal enquiry data)
 * 2. Deduplicate against existing contacts (by email, phone)
 * 3. Create or update the contact record
 * 4. Create a conversation message record
 * 5. Score the lead based on email content signals
 * 6. Create an activity timeline entry
 * 7. Build workflow trigger events for downstream automation
 *
 * This service is designed to be called from the webhook route and returns
 * all the data needed for the route to respond and fire async events.
 */
export class EmailLeadProcessor {
  private supabase: SupabaseServiceClient;

  constructor(supabase: SupabaseServiceClient) {
    this.supabase = supabase;
  }

  /**
   * Process a single inbound email through the full lead pipeline.
   */
  async process(payload: InboundEmailPayload): Promise<EmailLeadProcessingResult> {
    // Step 1: Parse email with EmailParser
    const { classification, normalisedMessage, portalEnquiry } =
      EmailParser.processInboundEmail({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        textBody: payload.textBody,
        htmlBody: payload.htmlBody,
        messageId: payload.messageId,
        threadId: payload.threadId,
        receivedAt: payload.receivedAt,
      });

    // Step 2: Determine lead type
    const leadType = classifyLeadType(classification, payload.textBody);

    // Step 3: Extract lead signals and compute score
    const isPortalEnquiry = classification === 'domain_enquiry' || classification === 'rea_enquiry';
    const senderPhone = portalEnquiry?.enquirerPhone ?? normalisedMessage.senderPhone;
    const senderEmail = portalEnquiry?.enquirerEmail ?? normalisedMessage.senderEmail;

    const signals = extractLeadSignals(
      payload.textBody,
      !!senderPhone,
      isPortalEnquiry,
    );
    const leadScore = calculateLeadScore(signals);

    // Step 4: Deduplicate against existing contacts
    const existingContact = await findExistingContact(
      this.supabase,
      senderEmail,
      senderPhone,
    );

    let contactId: string;
    let isNewContact = false;

    if (existingContact) {
      contactId = existingContact.contactId;

      // Update lead score and last contact date on existing contact
      await this.supabase
        .from('contacts')
        .update({
          lead_score: leadScore,
          last_contact_date: new Date().toISOString(),
        })
        .eq('id', contactId);
    } else {
      // Step 5: Create new contact
      const name = portalEnquiry?.enquirerName ?? normalisedMessage.senderName ?? 'Unknown';
      const parts = name.split(' ');
      const firstName = parts[0] ?? 'Unknown';
      const lastName = parts.slice(1).join(' ') || 'Unknown';

      const contactTypes = leadType === 'seller_inquiry' ? ['seller'] : ['buyer'];
      const source = channelToLeadSource(normalisedMessage.channel);

      const tags = ['new-lead', `source-${normalisedMessage.channel}`];
      if (isPortalEnquiry && portalEnquiry) {
        tags.push(`portal-${portalEnquiry.source}`);
      }

      const { data: newContact, error: contactError } = await this.supabase
        .from('contacts')
        .insert({
          types: contactTypes,
          first_name: firstName,
          last_name: lastName,
          email: senderEmail,
          phone: senderPhone ?? '',
          source,
          source_detail: portalEnquiry
            ? `${portalEnquiry.source} enquiry: ${portalEnquiry.propertyAddress}`
            : undefined,
          assigned_agent_id: '00000000-0000-0000-0000-000000000000',
          tags,
          communication_preference: 'any',
          lead_score: leadScore,
        })
        .select()
        .single();

      if (contactError || !newContact) {
        throw new Error(`Failed to create contact: ${contactError?.message ?? 'Unknown error'}`);
      }

      contactId = newContact['id'] as string;
      isNewContact = true;

      // Create contact_channels record for future deduplication
      await this.supabase
        .from('contact_channels')
        .insert({
          contact_id: contactId,
          emails: senderEmail ? [senderEmail.toLowerCase()] : [],
          phones: senderPhone ? [senderPhone] : [],
        })
        .select()
        .single();
    }

    // Step 6: Get the assigned agent
    const { data: contactRecord } = await this.supabase
      .from('contacts')
      .select('assigned_agent_id')
      .eq('id', contactId)
      .single();

    const agentId = (contactRecord?.['assigned_agent_id'] as string)
      ?? '00000000-0000-0000-0000-000000000000';

    // Step 7: Store conversation message
    const { data: message, error: msgError } = await this.supabase
      .from('conversation_messages')
      .insert({
        channel: normalisedMessage.channel,
        direction: 'inbound',
        contact_id: contactId,
        agent_id: agentId,
        content: normalisedMessage.content,
        metadata: normalisedMessage.metadata,
        property_id: null,
        status: 'delivered',
        is_read: false,
        external_message_id: normalisedMessage.externalMessageId,
      })
      .select()
      .single();

    if (msgError || !message) {
      // Check for duplicate external_message_id (idempotency at DB level)
      if (msgError?.message?.includes('unique') || msgError?.message?.includes('duplicate')) {
        return {
          contactId,
          messageId: '',
          isNewContact,
          leadType,
          leadScore,
          classification,
          workflowEvents: [],
        };
      }
      throw new Error(`Failed to store conversation message: ${msgError?.message ?? 'Unknown error'}`);
    }

    const messageId = message['id'] as string;

    // Step 8: Create activity timeline entry
    const activityType = isPortalEnquiry ? 'email-received' : 'email-received';
    const activityTitle = isPortalEnquiry
      ? `${portalEnquiry?.source === 'domain' ? 'Domain' : 'REA'} enquiry received`
      : 'Email received';

    await this.supabase
      .from('activities')
      .insert({
        contact_id: contactId,
        type: activityType,
        title: activityTitle,
        description: normalisedMessage.content.subject
          ?? normalisedMessage.content.text?.slice(0, 200),
        created_by: agentId,
        metadata: {
          messageId,
          channel: normalisedMessage.channel,
          classification,
          leadScore,
          leadType,
          isNewContact,
          portalSource: portalEnquiry?.source,
          portalPropertyAddress: portalEnquiry?.propertyAddress,
        },
      })
      .select()
      .single();

    // Step 9: Build workflow events
    const workflowEvents: WorkflowEvent[] = [];

    // Always fire an email_received event (not a trigger type in the engine yet,
    // but we include it for future extensibility)

    // Fire new_lead event for new contacts
    if (isNewContact) {
      const newLeadEvent: WorkflowEvent = {
        type: 'new_lead',
        contactId,
        data: {
          source: channelToLeadSource(normalisedMessage.channel),
          channel: normalisedMessage.channel,
          classification,
          leadType,
          leadScore,
          portalSource: portalEnquiry?.source,
          propertyAddress: portalEnquiry?.propertyAddress,
          enquirerName: portalEnquiry?.enquirerName ?? normalisedMessage.senderName,
          enquirerEmail: senderEmail,
          enquirerPhone: senderPhone,
        },
      };
      workflowEvents.push(newLeadEvent);
    }

    // Fire a field_change event for lead score updates on existing contacts
    if (!isNewContact) {
      const fieldChangeEvent: WorkflowEvent = {
        type: 'field_change',
        contactId,
        data: {
          field: 'lead_score',
          newValue: leadScore,
          source: 'email_lead_processor',
        },
      };
      workflowEvents.push(fieldChangeEvent);
    }

    return {
      contactId,
      messageId,
      isNewContact,
      leadType,
      leadScore,
      classification,
      workflowEvents,
    };
  }
}
