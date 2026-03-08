import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialLeadEngine } from './social-lead-engine';

// ─── UUIDs ───────────────────────────────────────────────────────────────────

const AGENT_ID   = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OFFICE_ID  = 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
const LEAD_ID    = 'c1b2c3d4-e5f6-7890-abcd-ef1234567892';
const CONTACT_ID = 'd1b2c3d4-e5f6-7890-abcd-ef1234567893';

const NOW = new Date().toISOString();

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeLeadRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: LEAD_ID,
    channel: 'facebook_dm',
    external_id: 'msg_abc123',
    sender_name: 'Jane Smith',
    sender_handle: 'janesmith',
    message_text: 'Interested in Paddington properties',
    raw_payload: null,
    status: 'pending',
    contact_id: null,
    agent_id: AGENT_ID,
    office_id: OFFICE_ID,
    created_at: NOW,
    deleted_at: null,
    ...overrides,
  };
}

// ─── Supabase chain builder ───────────────────────────────────────────────────

function makeChain(data: unknown, error: unknown = null): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.range = vi.fn(self);
  chain.update = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.upsert = vi.fn(self);
  chain.not = vi.fn(self);
  chain.in = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

// ─── SocialLeadEngine.ingestDm ────────────────────────────────────────────────

describe('SocialLeadEngine.ingestDm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new lead when external_id is unique', async () => {
    const row = makeLeadRow();
    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeChain(null)) // dedup check → not found
        .mockReturnValueOnce(makeChain(row)),  // insert
    };

    const engine = new SocialLeadEngine(supabase as never);
    const result = await engine.ingestDm(
      { channel: 'facebook_dm', externalId: 'msg_abc123', messageText: 'Interested in Paddington' },
      AGENT_ID,
      OFFICE_ID,
    );

    expect(result.id).toBe(LEAD_ID);
    expect(result.channel).toBe('facebook_dm');
    expect(result.status).toBe('pending');
    expect(result.agentId).toBe(AGENT_ID);
  });

  it('returns existing lead when external_id already ingested (idempotent)', async () => {
    const existing = makeLeadRow();
    const supabase = {
      from: vi.fn(() => makeChain(existing)),
    };

    const engine = new SocialLeadEngine(supabase as never);
    const result = await engine.ingestDm(
      { channel: 'facebook_dm', externalId: 'msg_abc123', messageText: 'Hello' },
      AGENT_ID,
      OFFICE_ID,
    );

    // Should not call insert — returns the existing record
    expect(result.id).toBe(LEAD_ID);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('throws when insert fails', async () => {
    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeChain(null))  // dedup → not found
        .mockReturnValueOnce(makeChain(null, { message: 'DB error' })),
    };

    const engine = new SocialLeadEngine(supabase as never);
    await expect(
      engine.ingestDm(
        { channel: 'instagram_dm', externalId: 'dm_xyz', messageText: 'Hi' },
        AGENT_ID,
        OFFICE_ID,
      ),
    ).rejects.toThrow('Failed to ingest DM: DB error');
  });
});

// ─── SocialLeadEngine.convertToContact ───────────────────────────────────────

describe('SocialLeadEngine.convertToContact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a contact from a pending lead', async () => {
    const pendingLead = makeLeadRow({ status: 'pending' });
    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeChain(pendingLead))                  // getById
        .mockReturnValueOnce(makeChain({ id: CONTACT_ID }))           // insert contact
        .mockReturnValueOnce(makeChain(null)),                        // update lead status
    };

    const engine = new SocialLeadEngine(supabase as never);
    const contactId = await engine.convertToContact(LEAD_ID, AGENT_ID);

    expect(contactId).toBe(CONTACT_ID);
  });

  it('returns existing contactId when lead is already converted', async () => {
    const convertedLead = makeLeadRow({ status: 'converted', contact_id: CONTACT_ID });
    const supabase = {
      from: vi.fn(() => makeChain(convertedLead)),
    };

    const engine = new SocialLeadEngine(supabase as never);
    const contactId = await engine.convertToContact(LEAD_ID, AGENT_ID);

    expect(contactId).toBe(CONTACT_ID);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('throws when attempting to convert a dismissed lead', async () => {
    const dismissedLead = makeLeadRow({ status: 'dismissed' });
    const supabase = {
      from: vi.fn(() => makeChain(dismissedLead)),
    };

    const engine = new SocialLeadEngine(supabase as never);
    await expect(engine.convertToContact(LEAD_ID, AGENT_ID)).rejects.toThrow(
      'Cannot convert a dismissed lead',
    );
  });

  it('applies overrides to the contact record', async () => {
    const pendingLead = makeLeadRow({ sender_name: 'Jane', status: 'pending' });
    const insertChain = makeChain({ id: CONTACT_ID });
    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeChain(pendingLead))
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(makeChain(null)),
    };

    const engine = new SocialLeadEngine(supabase as never);
    const contactId = await engine.convertToContact(LEAD_ID, AGENT_ID, {
      firstName: 'Jane',
      email: 'jane@example.com',
    });

    expect(contactId).toBe(CONTACT_ID);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com', first_name: 'Jane' }),
    );
  });
});

// ─── SocialLeadEngine.dismissLead ────────────────────────────────────────────

describe('SocialLeadEngine.dismissLead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks a lead as dismissed', async () => {
    const chain = makeChain(null);
    const supabase = { from: vi.fn(() => chain) };

    const engine = new SocialLeadEngine(supabase as never);
    await engine.dismissLead(LEAD_ID);

    expect(chain.update).toHaveBeenCalledWith({ status: 'dismissed' });
  });

  it('throws when update fails', async () => {
    const chain = makeChain(null, { message: 'Update failed' });
    const supabase = { from: vi.fn(() => chain) };

    const engine = new SocialLeadEngine(supabase as never);
    await expect(engine.dismissLead(LEAD_ID)).rejects.toThrow('Failed to dismiss lead');
  });
});

// ─── SocialLeadEngine.getLeadStats ───────────────────────────────────────────

describe('SocialLeadEngine.getLeadStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns correct stats from raw rows', async () => {
    const rows = [
      { channel: 'facebook_dm', status: 'converted' },
      { channel: 'facebook_dm', status: 'converted' },
      { channel: 'instagram_dm', status: 'pending' },
      { channel: 'linkedin_dm', status: 'dismissed' },
    ];
    const supabase = { from: vi.fn(() => makeChain(rows)) };

    const engine = new SocialLeadEngine(supabase as never);
    const stats = await engine.getLeadStats(AGENT_ID, new Date('2026-01-01'), new Date());

    expect(stats.total).toBe(4);
    expect(stats.converted).toBe(2);
    expect(stats.pending).toBe(1);
    expect(stats.dismissed).toBe(1);
    expect(stats.conversionRate).toBe(50);
    expect(stats.byChannel.facebook_dm).toBe(2);
    expect(stats.byChannel.instagram_dm).toBe(1);
    expect(stats.byChannel.linkedin_dm).toBe(1);
  });

  it('returns 0% conversion rate when no leads exist', async () => {
    const supabase = { from: vi.fn(() => makeChain([])) };

    const engine = new SocialLeadEngine(supabase as never);
    const stats = await engine.getLeadStats(AGENT_ID, new Date('2026-01-01'), new Date());

    expect(stats.total).toBe(0);
    expect(stats.conversionRate).toBe(0);
  });
});

// ─── SocialLeadEngine.listLeads ──────────────────────────────────────────────

describe('SocialLeadEngine.listLeads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of leads for agent', async () => {
    const rows = [makeLeadRow(), makeLeadRow({ id: 'e1b2c3d4-e5f6-7890-abcd-ef1234567899' })];
    const supabase = { from: vi.fn(() => makeChain(rows)) };

    const engine = new SocialLeadEngine(supabase as never);
    const leads = await engine.listLeads(AGENT_ID);

    expect(leads).toHaveLength(2);
    expect(leads[0].agentId).toBe(AGENT_ID);
  });

  it('throws when query fails', async () => {
    const supabase = { from: vi.fn(() => makeChain(null, { message: 'Query failed' })) };

    const engine = new SocialLeadEngine(supabase as never);
    await expect(engine.listLeads(AGENT_ID)).rejects.toThrow('Failed to list leads');
  });
});
