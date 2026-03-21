import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactMatcher } from './contact-matcher';
import type { NormalisedInboundMessage } from '@realflow/shared';

// ─── UUIDs ────────────────────────────────────────────────────────────────────
// Rule: ALL fixture IDs must be proper UUIDs — never 'contact-1' style strings

const CONTACT_ID_A = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const CONTACT_ID_B = 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeInboundMessage(
  overrides: Partial<NormalisedInboundMessage> = {},
): NormalisedInboundMessage {
  return {
    channel: 'email',
    direction: 'inbound',
    content: { text: 'Hello', type: 'text' },
    metadata: {},
    receivedAt: new Date().toISOString(),
    ...overrides,
  } as NormalisedInboundMessage;
}

function makeContactChannelRecord(
  overrides: Partial<{
    contactId: string;
    emails: string[];
    phones: string[];
    instagramId: string | null;
    facebookId: string | null;
    whatsappNumber: string | null;
  }> = {},
) {
  return {
    contactId: CONTACT_ID_A,
    emails: [],
    phones: [],
    instagramId: null,
    facebookId: null,
    whatsappNumber: null,
    ...overrides,
  };
}

/** Build a minimal Supabase-shaped client that returns `data` from any query. */
function makeSupabase(data: unknown[] | null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    contains: vi.fn().mockResolvedValue({ data, error: null }),
    eq: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return {
    from: vi.fn(() => chain),
    _chain: chain,
  };
}

// ─── matchContact — email match ───────────────────────────────────────────────

describe('ContactMatcher.matchContact — email match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a matched result when the email is found in contact_channels', async () => {
    const record = makeContactChannelRecord({
      emails: ['jane@example.com'],
    });
    const supabase = makeSupabase([record]);

    const message = makeInboundMessage({
      channel: 'email',
      senderEmail: 'jane@example.com',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.contactId).toBe(CONTACT_ID_A);
      expect(result.matchedBy).toBe('email');
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    }
  });

  it('normalises email to lowercase before matching', async () => {
    const record = makeContactChannelRecord({
      emails: ['jane@example.com'],
    });
    const supabase = makeSupabase([record]);

    const message = makeInboundMessage({
      channel: 'email',
      senderEmail: 'JANE@EXAMPLE.COM',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    // The contains call should have been made with the lowercase variant
    expect(supabase._chain.contains).toHaveBeenCalledWith('emails', ['jane@example.com']);
    expect(result.matched).toBe(true);
  });

  it('falls through to no-match when email is not found', async () => {
    const supabase = makeSupabase([]);

    const message = makeInboundMessage({
      channel: 'email',
      senderEmail: 'unknown@example.com',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.suggestedContact.email).toBe('unknown@example.com');
      expect(result.suggestedContact.source).toBe('website');
    }
  });
});

// ─── matchContact — phone match ───────────────────────────────────────────────

describe('ContactMatcher.matchContact — phone match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a matched result when the phone is found (E.164 format)', async () => {
    const record = makeContactChannelRecord({
      contactId: CONTACT_ID_B,
      phones: ['+61412345678'],
    });
    const supabase = makeSupabase([record]);

    const message = makeInboundMessage({
      channel: 'sms',
      senderPhone: '+61412345678',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.matchedBy).toBe('phone');
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    }
  });

  it('normalises Australian local format (0412...) to E.164 before matching', async () => {
    const record = makeContactChannelRecord({
      phones: ['+61412345678'],
    });
    const supabase = makeSupabase([record]);

    const message = makeInboundMessage({
      channel: 'sms',
      senderPhone: '0412345678',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    // contains should have been called with the normalised E.164 variant
    expect(supabase._chain.contains).toHaveBeenCalledWith(
      'phones',
      expect.arrayContaining(['+61412345678']),
    );
    expect(result.matched).toBe(true);
  });

  it('phone match has higher priority than email match (phone tried first)', async () => {
    const phoneRecord = makeContactChannelRecord({
      contactId: CONTACT_ID_A,
      phones: ['+61412345678'],
    });
    // Email record belongs to a different contact
    const emailRecord = makeContactChannelRecord({
      contactId: CONTACT_ID_B,
      emails: ['shared@example.com'],
    });

    // The supabase mock always returns the phone record for any query;
    // so the first contains() call (phone) should win.
    const supabase = makeSupabase([phoneRecord]);

    const message = makeInboundMessage({
      channel: 'email',
      senderPhone: '+61412345678',
      senderEmail: 'shared@example.com',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    expect(result.matched).toBe(true);
    if (result.matched) {
      // Phone is tried first; it matches CONTACT_ID_A
      expect(result.matchedBy).toBe('phone');
      expect(result.contactId).toBe(CONTACT_ID_A);
    }
  });
});

// ─── matchContact — social ID match ──────────────────────────────────────────

describe('ContactMatcher.matchContact — social ID match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches by Instagram IGSID', async () => {
    const record = makeContactChannelRecord({
      instagramId: 'ig-user-999',
    });
    const supabase = makeSupabase([record]);

    const message = makeInboundMessage({
      channel: 'instagram_dm',
      senderSocialId: 'ig-user-999',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.matchedBy).toBe('instagram_id');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    }
  });

  it('matches by Facebook PSID', async () => {
    const record = makeContactChannelRecord({
      facebookId: 'fb-psid-888',
    });
    const supabase = makeSupabase([record]);

    const message = makeInboundMessage({
      channel: 'facebook_messenger',
      senderSocialId: 'fb-psid-888',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.matchedBy).toBe('facebook_id');
    }
  });

  it('matches by WhatsApp number', async () => {
    const record = makeContactChannelRecord({
      whatsappNumber: '+61412000001',
    });
    const supabase = makeSupabase([record]);

    const message = makeInboundMessage({
      channel: 'whatsapp',
      senderSocialId: '+61412000001',
      senderPhone: '+61412000001',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    // Phone check runs first and succeeds when supabase returns the record
    expect(result.matched).toBe(true);
  });

  it('returns no-match for an unsupported social channel', async () => {
    const supabase = makeSupabase([]);

    const message = makeInboundMessage({
      channel: 'linkedin',
      senderSocialId: 'linkedin-user-123',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.suggestedContact.source).toBe('other');
    }
  });
});

// ─── matchContact — no match / suggested contact ──────────────────────────────

describe('ContactMatcher.matchContact — no match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds suggestedContact from sender name and email', async () => {
    const supabase = makeSupabase([]);

    const message = makeInboundMessage({
      channel: 'domain_enquiry',
      senderName: 'John Smith',
      senderEmail: 'john@smith.com',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.suggestedContact.firstName).toBe('John');
      expect(result.suggestedContact.lastName).toBe('Smith');
      expect(result.suggestedContact.email).toBe('john@smith.com');
      expect(result.suggestedContact.source).toBe('domain');
    }
  });

  it('uses Unknown as first and last name when senderName is absent', async () => {
    const supabase = makeSupabase([]);

    const message = makeInboundMessage({
      channel: 'sms',
      senderPhone: '+61499999999',
    });
    // Remove senderName (it's optional)
    delete (message as Partial<NormalisedInboundMessage>).senderName;

    // phone lookup returns empty — no match
    const supabase2 = makeSupabase([]);

    const result = await ContactMatcher.matchContact(message, supabase2 as never);

    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.suggestedContact.firstName).toBe('Unknown');
      expect(result.suggestedContact.lastName).toBe('Unknown');
    }
  });

  it('maps rea_enquiry channel to source "rea"', async () => {
    const supabase = makeSupabase([]);

    const message = makeInboundMessage({
      channel: 'rea_enquiry',
      senderName: 'Test Person',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.suggestedContact.source).toBe('rea');
    }
  });

  it('maps phone_call channel to source "cold-call"', async () => {
    const supabase = makeSupabase([]);

    const message = makeInboundMessage({
      channel: 'phone_call',
      senderName: 'Caller',
    });

    const result = await ContactMatcher.matchContact(message, supabase as never);

    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.suggestedContact.source).toBe('cold-call');
    }
  });
});

// ─── enrichContactChannels ────────────────────────────────────────────────────

describe('ContactMatcher.enrichContactChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exits early when no contact_channels record exists', async () => {
    const supabase = makeSupabase(null);

    const message = makeInboundMessage({
      channel: 'email',
      senderEmail: 'new@example.com',
    });

    // Should not throw
    await expect(
      ContactMatcher.enrichContactChannels(CONTACT_ID_A, message, supabase as never),
    ).resolves.toBeUndefined();
  });

  it('exits early when data array is empty', async () => {
    const supabase = makeSupabase([]);

    const message = makeInboundMessage({
      channel: 'email',
      senderEmail: 'new@example.com',
    });

    await expect(
      ContactMatcher.enrichContactChannels(CONTACT_ID_A, message, supabase as never),
    ).resolves.toBeUndefined();
  });

  it('returns undefined (no-op) even when record has email updates to make', async () => {
    const record = makeContactChannelRecord({ emails: ['existing@example.com'] });
    const supabase = makeSupabase([record]);

    const message = makeInboundMessage({
      channel: 'email',
      senderEmail: 'new@example.com',
    });

    const result = await ContactMatcher.enrichContactChannels(
      CONTACT_ID_A,
      message,
      supabase as never,
    );

    // The method is a no-op by design (comment in source says caller handles update)
    expect(result).toBeUndefined();
  });
});
