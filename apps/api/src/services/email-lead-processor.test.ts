import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EmailLeadProcessor,
  calculateLeadScore,
  extractLeadSignals,
  classifyLeadType,
  type InboundEmailPayload,
} from './email-lead-processor';

// ─── Mock Supabase Builder ──────────────────────────────────────────────

function createMockChain(resolvedValue: {
  data: Record<string, unknown> | Array<Record<string, unknown>> | null;
  error: { message: string } | null;
}) {
  const chain: Record<string, unknown> = {};

  const terminalMethods = {
    single: vi.fn().mockResolvedValue(resolvedValue),
  };

  const midMethods = {
    select: vi.fn().mockReturnValue(terminalMethods),
    eq: vi.fn().mockReturnValue({
      ...terminalMethods,
      eq: vi.fn().mockReturnValue(terminalMethods),
      select: vi.fn().mockReturnValue(terminalMethods),
    }),
    contains: vi.fn().mockResolvedValue(resolvedValue),
  };

  chain['insert'] = vi.fn().mockReturnValue(midMethods);
  chain['update'] = vi.fn().mockReturnValue(midMethods);
  chain['select'] = vi.fn().mockReturnValue(midMethods);

  return chain;
}

function buildMockSupabase(overrides?: {
  contacts?: ReturnType<typeof createMockChain>;
  contact_channels?: ReturnType<typeof createMockChain>;
  conversation_messages?: ReturnType<typeof createMockChain>;
  activities?: ReturnType<typeof createMockChain>;
}) {
  const defaults = {
    contacts: createMockChain({ data: null, error: null }),
    contact_channels: createMockChain({ data: null, error: null }),
    conversation_messages: createMockChain({ data: null, error: null }),
    activities: createMockChain({ data: null, error: null }),
  };

  const tables: Record<string, ReturnType<typeof createMockChain>> = {
    ...defaults,
    ...overrides,
  };

  return {
    from: vi.fn((table: string) => tables[table] ?? createMockChain({ data: null, error: null })),
  };
}

// ─── Fixtures ───────────────────────────────────────────────────────────

const domainEnquiryPayload: InboundEmailPayload = {
  from: 'noreply@domain.com.au',
  to: ['agent@realflow.com.au'],
  subject: 'New enquiry for 42 Ocean Street, Bondi NSW 2026',
  textBody: [
    'Name: Sarah Johnson',
    'Email: sarah@example.com',
    'Phone: 0412345678',
    'Message: I am very interested in this property. We have pre-approval for $1.2M and want to buy ASAP.',
    'Property: 42 Ocean Street, Bondi NSW 2026',
    'Listing ID: 12345',
  ].join('\n'),
  messageId: 'msg-domain-001',
  receivedAt: '2026-03-04T10:00:00.000Z',
};

const generalEmailPayload: InboundEmailPayload = {
  from: 'John Smith <john@example.com>',
  to: ['agent@realflow.com.au'],
  subject: 'Property inquiry',
  textBody: 'Hi, I saw your listing online and wanted to know more.',
  messageId: 'msg-general-001',
  receivedAt: '2026-03-04T11:00:00.000Z',
};

const sellerEmailPayload: InboundEmailPayload = {
  from: 'Jane Doe <jane@example.com>',
  to: ['agent@realflow.com.au'],
  subject: 'Selling my home',
  textBody: 'Hi, I am thinking of selling my house in Paddington. Could you provide an appraisal?',
  messageId: 'msg-seller-001',
  receivedAt: '2026-03-04T12:00:00.000Z',
};

// ─── Unit Tests: Lead Score Calculation ─────────────────────────────────

describe('calculateLeadScore', () => {
  it('returns base score of 10 for minimal signals', () => {
    const score = calculateLeadScore({
      hasPhone: false,
      hasMessage: false,
      isPortalEnquiry: false,
      mentionsBudget: false,
      mentionsUrgency: false,
      mentionsPreApproval: false,
    });
    expect(score).toBe(10);
  });

  it('adds 20 for portal enquiry', () => {
    const score = calculateLeadScore({
      hasPhone: false,
      hasMessage: false,
      isPortalEnquiry: true,
      mentionsBudget: false,
      mentionsUrgency: false,
      mentionsPreApproval: false,
    });
    expect(score).toBe(30);
  });

  it('adds 15 for phone number', () => {
    const score = calculateLeadScore({
      hasPhone: true,
      hasMessage: false,
      isPortalEnquiry: false,
      mentionsBudget: false,
      mentionsUrgency: false,
      mentionsPreApproval: false,
    });
    expect(score).toBe(25);
  });

  it('caps score at 100', () => {
    const score = calculateLeadScore({
      hasPhone: true,
      hasMessage: true,
      isPortalEnquiry: true,
      mentionsBudget: true,
      mentionsUrgency: true,
      mentionsPreApproval: true,
    });
    expect(score).toBe(100);
  });

  it('accumulates all signals correctly', () => {
    // base(10) + portal(20) + phone(15) + message(10) = 55
    const score = calculateLeadScore({
      hasPhone: true,
      hasMessage: true,
      isPortalEnquiry: true,
      mentionsBudget: false,
      mentionsUrgency: false,
      mentionsPreApproval: false,
    });
    expect(score).toBe(55);
  });
});

// ─── Unit Tests: Lead Signal Extraction ─────────────────────────────────

describe('extractLeadSignals', () => {
  it('detects budget mention', () => {
    const signals = extractLeadSignals('We have a budget of $1.2M', false, false);
    expect(signals.mentionsBudget).toBe(true);
  });

  it('detects urgency language', () => {
    const signals = extractLeadSignals('We need to move ASAP', false, false);
    expect(signals.mentionsUrgency).toBe(true);
  });

  it('detects pre-approval mention', () => {
    const signals = extractLeadSignals('We have pre-approval for $900k', false, false);
    expect(signals.mentionsPreApproval).toBe(true);
  });

  it('returns false for all text signals when body is empty', () => {
    const signals = extractLeadSignals('', false, false);
    expect(signals.mentionsBudget).toBe(false);
    expect(signals.mentionsUrgency).toBe(false);
    expect(signals.mentionsPreApproval).toBe(false);
    expect(signals.hasMessage).toBe(false);
  });

  it('passes through phone and portal flags', () => {
    const signals = extractLeadSignals('test', true, true);
    expect(signals.hasPhone).toBe(true);
    expect(signals.isPortalEnquiry).toBe(true);
  });
});

// ─── Unit Tests: Lead Type Classification ───────────────────────────────

describe('classifyLeadType', () => {
  it('returns buyer_inquiry for domain_enquiry classification', () => {
    expect(classifyLeadType('domain_enquiry', '')).toBe('buyer_inquiry');
  });

  it('returns buyer_inquiry for rea_enquiry classification', () => {
    expect(classifyLeadType('rea_enquiry', '')).toBe('buyer_inquiry');
  });

  it('returns seller_inquiry when text mentions selling', () => {
    expect(classifyLeadType('general', 'I want to sell my house')).toBe('seller_inquiry');
  });

  it('returns seller_inquiry for appraisal requests', () => {
    expect(classifyLeadType('general', 'Can I get an appraisal?')).toBe('seller_inquiry');
  });

  it('returns general for unclassified emails', () => {
    expect(classifyLeadType('general', 'Just following up on our conversation')).toBe('general');
  });
});

// ─── Integration Tests: EmailLeadProcessor ──────────────────────────────

describe('EmailLeadProcessor', () => {
  let mockSupabase: ReturnType<typeof buildMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── New Contact Creation from Domain Enquiry ───────────────────────

  it('creates a new contact from a Domain portal enquiry', async () => {
    // contact_channels.select().contains() returns empty (no existing match)
    const contactChannelsChain = createMockChain({ data: [], error: null });
    // Override contains to return empty array (no match)
    const selectFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      contains: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    contactChannelsChain['select'] = selectFn;
    contactChannelsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'cc-1' }, error: null }),
      }),
    });

    // contacts
    const contactsChain = createMockChain({ data: null, error: null });
    contactsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'contact-new-1', first_name: 'Sarah', last_name: 'Johnson' },
          error: null,
        }),
      }),
    });
    contactsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { assigned_agent_id: 'agent-1' },
          error: null,
        }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { assigned_agent_id: 'agent-1' },
            error: null,
          }),
        }),
      }),
    });

    // conversation_messages
    const messagesChain = createMockChain({ data: null, error: null });
    messagesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'msg-1' },
          error: null,
        }),
      }),
    });

    // activities
    const activitiesChain = createMockChain({ data: null, error: null });
    activitiesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'act-1' }, error: null }),
      }),
    });

    mockSupabase = buildMockSupabase({
      contacts: contactsChain,
      contact_channels: contactChannelsChain,
      conversation_messages: messagesChain,
      activities: activitiesChain,
    });

    const processor = new EmailLeadProcessor(mockSupabase as never);
    const result = await processor.process(domainEnquiryPayload);

    expect(result.isNewContact).toBe(true);
    expect(result.contactId).toBe('contact-new-1');
    expect(result.classification).toBe('domain_enquiry');
    expect(result.leadType).toBe('buyer_inquiry');
    expect(result.leadScore).toBeGreaterThan(0);
    expect(result.messageId).toBe('msg-1');

    // Should have fired a new_lead workflow event
    expect(result.workflowEvents).toHaveLength(1);
    expect(result.workflowEvents[0]?.type).toBe('new_lead');
    expect(result.workflowEvents[0]?.contactId).toBe('contact-new-1');
  });

  // ─── Deduplication: Existing Contact by Email ─────────────────────

  it('matches an existing contact by email and updates lead score', async () => {
    // contact_channels.select().contains() returns existing match
    const contactChannelsChain = createMockChain({ data: null, error: null });
    contactChannelsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      contains: vi.fn().mockResolvedValue({
        data: [{ contact_id: 'existing-contact-1' }],
        error: null,
      }),
    });

    // contacts
    const contactsChain = createMockChain({ data: null, error: null });
    contactsChain['update'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    contactsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { assigned_agent_id: 'agent-1' },
          error: null,
        }),
      }),
    });

    // conversation_messages
    const messagesChain = createMockChain({ data: null, error: null });
    messagesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'msg-2' },
          error: null,
        }),
      }),
    });

    // activities
    const activitiesChain = createMockChain({ data: null, error: null });
    activitiesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'act-2' }, error: null }),
      }),
    });

    mockSupabase = buildMockSupabase({
      contacts: contactsChain,
      contact_channels: contactChannelsChain,
      conversation_messages: messagesChain,
      activities: activitiesChain,
    });

    const processor = new EmailLeadProcessor(mockSupabase as never);
    const result = await processor.process(generalEmailPayload);

    expect(result.isNewContact).toBe(false);
    expect(result.contactId).toBe('existing-contact-1');

    // Should fire field_change event, not new_lead
    expect(result.workflowEvents).toHaveLength(1);
    expect(result.workflowEvents[0]?.type).toBe('field_change');
  });

  // ─── Seller Inquiry Classification ───────────────────────────────

  it('classifies seller inquiry emails correctly', async () => {
    // No existing contact
    const contactChannelsChain = createMockChain({ data: null, error: null });
    contactChannelsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      contains: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    contactChannelsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'cc-2' }, error: null }),
      }),
    });

    const contactsChain = createMockChain({ data: null, error: null });
    contactsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'contact-seller-1' },
          error: null,
        }),
      }),
    });
    contactsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { assigned_agent_id: 'agent-1' },
          error: null,
        }),
      }),
    });

    const messagesChain = createMockChain({ data: null, error: null });
    messagesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'msg-3' }, error: null }),
      }),
    });

    const activitiesChain = createMockChain({ data: null, error: null });
    activitiesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'act-3' }, error: null }),
      }),
    });

    mockSupabase = buildMockSupabase({
      contacts: contactsChain,
      contact_channels: contactChannelsChain,
      conversation_messages: messagesChain,
      activities: activitiesChain,
    });

    const processor = new EmailLeadProcessor(mockSupabase as never);
    const result = await processor.process(sellerEmailPayload);

    expect(result.leadType).toBe('seller_inquiry');
    expect(result.isNewContact).toBe(true);
  });

  // ─── Duplicate Message Handling (DB unique constraint) ─────────────

  it('handles duplicate message IDs gracefully', async () => {
    // No existing contact
    const contactChannelsChain = createMockChain({ data: null, error: null });
    contactChannelsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      contains: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    contactChannelsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'cc-3' }, error: null }),
      }),
    });

    const contactsChain = createMockChain({ data: null, error: null });
    contactsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'contact-dup-1' },
          error: null,
        }),
      }),
    });
    contactsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { assigned_agent_id: 'agent-1' },
          error: null,
        }),
      }),
    });

    // conversation_messages: simulate unique constraint violation
    const messagesChain = createMockChain({ data: null, error: null });
    messagesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'duplicate key value violates unique constraint' },
        }),
      }),
    });

    const activitiesChain = createMockChain({ data: null, error: null });

    mockSupabase = buildMockSupabase({
      contacts: contactsChain,
      contact_channels: contactChannelsChain,
      conversation_messages: messagesChain,
      activities: activitiesChain,
    });

    const processor = new EmailLeadProcessor(mockSupabase as never);
    const result = await processor.process(generalEmailPayload);

    // Should not throw, should return empty messageId
    expect(result.messageId).toBe('');
    expect(result.workflowEvents).toHaveLength(0);
  });

  // ─── Contact Creation Failure ──────────────────────────────────────

  it('throws when contact creation fails', async () => {
    const contactChannelsChain = createMockChain({ data: null, error: null });
    contactChannelsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      contains: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const contactsChain = createMockChain({ data: null, error: null });
    contactsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database unavailable' },
        }),
      }),
    });

    mockSupabase = buildMockSupabase({
      contacts: contactsChain,
      contact_channels: contactChannelsChain,
    });

    const processor = new EmailLeadProcessor(mockSupabase as never);

    await expect(processor.process(generalEmailPayload)).rejects.toThrow(
      'Failed to create contact: Database unavailable',
    );
  });

  // ─── High Lead Score for Portal Enquiry with Signals ───────────────

  it('produces a high lead score for portal enquiry with budget and urgency', async () => {
    const contactChannelsChain = createMockChain({ data: null, error: null });
    contactChannelsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      contains: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    contactChannelsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'cc-4' }, error: null }),
      }),
    });

    const contactsChain = createMockChain({ data: null, error: null });
    contactsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'contact-high-score' },
          error: null,
        }),
      }),
    });
    contactsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { assigned_agent_id: 'agent-1' },
          error: null,
        }),
      }),
    });

    const messagesChain = createMockChain({ data: null, error: null });
    messagesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'msg-high' }, error: null }),
      }),
    });

    const activitiesChain = createMockChain({ data: null, error: null });
    activitiesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'act-high' }, error: null }),
      }),
    });

    mockSupabase = buildMockSupabase({
      contacts: contactsChain,
      contact_channels: contactChannelsChain,
      conversation_messages: messagesChain,
      activities: activitiesChain,
    });

    const processor = new EmailLeadProcessor(mockSupabase as never);
    const result = await processor.process(domainEnquiryPayload);

    // Domain enquiry with phone, message, budget ($1.2M), urgency (ASAP), pre-approval
    // base(10) + portal(20) + phone(15) + message(10) + budget(15) + urgency(15) + preapproval(15) = 100
    expect(result.leadScore).toBe(100);
  });

  // ─── Workflow Event Structure ──────────────────────────────────────

  it('includes correct data in new_lead workflow event', async () => {
    const contactChannelsChain = createMockChain({ data: null, error: null });
    contactChannelsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      contains: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    contactChannelsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'cc-5' }, error: null }),
      }),
    });

    const contactsChain = createMockChain({ data: null, error: null });
    contactsChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'contact-wf-1' },
          error: null,
        }),
      }),
    });
    contactsChain['select'] = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { assigned_agent_id: 'agent-1' },
          error: null,
        }),
      }),
    });

    const messagesChain = createMockChain({ data: null, error: null });
    messagesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'msg-wf' }, error: null }),
      }),
    });

    const activitiesChain = createMockChain({ data: null, error: null });
    activitiesChain['insert'] = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'act-wf' }, error: null }),
      }),
    });

    mockSupabase = buildMockSupabase({
      contacts: contactsChain,
      contact_channels: contactChannelsChain,
      conversation_messages: messagesChain,
      activities: activitiesChain,
    });

    const processor = new EmailLeadProcessor(mockSupabase as never);
    const result = await processor.process(domainEnquiryPayload);

    const event = result.workflowEvents[0];
    expect(event).toBeDefined();
    expect(event?.type).toBe('new_lead');
    expect(event?.contactId).toBe('contact-wf-1');
    expect(event?.data['source']).toBe('domain');
    expect(event?.data['classification']).toBe('domain_enquiry');
    expect(event?.data['leadType']).toBe('buyer_inquiry');
    expect(event?.data['portalSource']).toBe('domain');
  });
});
