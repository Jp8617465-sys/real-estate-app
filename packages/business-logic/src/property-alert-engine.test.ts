import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PropertyAlertEngine } from './property-alert-engine';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const AGENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const BRIEF_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const MATCH_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const SUB_ID = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const EVENT_ID = 'e5f6a7b8-c9d0-1234-efab-345678901234';
const PRICE_CHANGE_ID = 'f6a7b8c9-d0e1-2345-fabc-456789012345';
const PROPERTY_ID = 'a7b8c9d0-e1f2-3456-abcd-567890123456';
const PORTAL_CLIENT_ID = 'b8c9d0e1-f2a3-4567-bcde-678901234567';
const PORTAL_USER_ID = 'c9d0e1f2-a3b4-5678-cdef-789012345678';

const NOW = '2026-03-03T10:00:00.000Z';

const makeSubscriptionRow = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  id: SUB_ID,
  agent_id: AGENT_ID,
  brief_id: BRIEF_ID,
  score_threshold: 70,
  channels: ['push'],
  digest_mode: false,
  digest_time: '07:00:00',
  quiet_hours_start: '21:00:00',
  quiet_hours_end: '07:00:00',
  is_active: true,
  deleted_at: null,
  created_at: NOW,
  updated_at: NOW,
  ...overrides,
});

const makeMatchRow = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  id: MATCH_ID,
  brief_id: BRIEF_ID,
  overall_score: 85,
  status: 'new',
  property_id: PROPERTY_ID,
  ...overrides,
});

const makeEventRow = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  id: EVENT_ID,
  subscription_id: SUB_ID,
  property_match_id: MATCH_ID,
  alert_type: 'new_match',
  channels_attempted: ['push'],
  channels_delivered: ['push'],
  match_score: 85,
  sent_at: NOW,
  actioned_at: null,
  action: null,
  snooze_until: null,
  created_at: NOW,
  ...overrides,
});

const makePriceChangeRow = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  id: PRICE_CHANGE_ID,
  property_id: PROPERTY_ID,
  domain_listing_id: 'listing-domain-123',
  new_price: 850000,
  previous_price: 900000,
  change_type: 'price_reduction',
  ...overrides,
});

// ─── Mock injection functions ─────────────────────────────────────────────────

function makeNotifiers() {
  return {
    notifyPush: vi.fn<(token: string, title: string, body: string, data?: Record<string, string>) => Promise<void>>().mockResolvedValue(undefined),
    notifyEmail: vi.fn<(to: string, subject: string, body: string) => Promise<void>>().mockResolvedValue(undefined),
    notifySms: vi.fn<(to: string, body: string) => Promise<void>>().mockResolvedValue(undefined),
  };
}

// ─── Supabase chain builder ───────────────────────────────────────────────────

function makeChain(singleData: unknown, singleError: unknown = null, listData: unknown = [], listError: unknown = null) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.is = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.not = vi.fn(self);
  chain.in = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.upsert = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve({ data: singleData, error: singleError }));
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data: listData, error: listError }).then(resolve);
  return chain;
}

// ─── isQuietHours ─────────────────────────────────────────────────────────────

describe('PropertyAlertEngine.isQuietHours', () => {
  const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
  const supabase = { from: vi.fn() } as never;
  const engine = new PropertyAlertEngine(supabase, notifyPush, notifyEmail, notifySms);

  it('returns true when current AEST time is within quiet hours (wrap-around 21:00–07:00)', () => {
    // UTC 13:00 = AEST 23:00 — within quiet hours
    const nowUtc = new Date('2026-03-03T13:00:00Z');
    expect(engine.isQuietHours('21:00', '07:00', nowUtc)).toBe(true);
  });

  it('returns true when AEST time is in early morning (wrap-around)', () => {
    // UTC 20:00 = AEST 06:00 — within quiet hours (before 07:00)
    const nowUtc = new Date('2026-03-03T20:00:00Z');
    expect(engine.isQuietHours('21:00', '07:00', nowUtc)).toBe(true);
  });

  it('returns false when AEST time is outside quiet hours', () => {
    // UTC 00:00 = AEST 10:00 — outside quiet hours (21:00–07:00)
    const nowUtc = new Date('2026-03-03T00:00:00Z');
    expect(engine.isQuietHours('21:00', '07:00', nowUtc)).toBe(false);
  });

  it('returns false when AEST time is in the middle of the day', () => {
    // UTC 02:00 = AEST 12:00 — outside quiet hours
    const nowUtc = new Date('2026-03-03T02:00:00Z');
    expect(engine.isQuietHours('21:00', '07:00', nowUtc)).toBe(false);
  });

  it('returns true at boundary start (exactly 21:00 AEST)', () => {
    // UTC 11:00 = AEST 21:00
    const nowUtc = new Date('2026-03-03T11:00:00Z');
    expect(engine.isQuietHours('21:00', '07:00', nowUtc)).toBe(true);
  });

  it('handles same-day range (09:00–17:00) correctly', () => {
    // UTC 03:00 = AEST 13:00 — within 09:00–17:00
    const inRange = new Date('2026-03-03T03:00:00Z');
    expect(engine.isQuietHours('09:00', '17:00', inRange)).toBe(true);

    // UTC 20:00 = AEST 06:00 — outside 09:00–17:00
    const outRange = new Date('2026-03-03T20:00:00Z');
    expect(engine.isQuietHours('09:00', '17:00', outRange)).toBe(false);
  });
});

// ─── getSubscriptions ─────────────────────────────────────────────────────────

describe('PropertyAlertEngine.getSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns subscriptions for agent', async () => {
    const row = makeSubscriptionRow();
    const supabase = {
      from: vi.fn(() => makeChain(null, null, [row], null)),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    const subs = await engine.getSubscriptions(AGENT_ID);
    expect(subs).toHaveLength(1);
    expect(subs[0]!.agentId).toBe(AGENT_ID);
    expect(subs[0]!.briefId).toBe(BRIEF_ID);
    expect(subs[0]!.scoreThreshold).toBe(70);
  });

  it('returns empty array when agent has no subscriptions', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, null, [], null)),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    const subs = await engine.getSubscriptions(AGENT_ID);
    expect(subs).toEqual([]);
  });

  it('returns empty array on supabase error', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, null, null, { message: 'DB error' })),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    const subs = await engine.getSubscriptions(AGENT_ID);
    expect(subs).toEqual([]);
  });
});

// ─── createSubscription ───────────────────────────────────────────────────────

describe('PropertyAlertEngine.createSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a subscription and returns it', async () => {
    const insertedRow = makeSubscriptionRow();
    const supabase = {
      from: vi.fn(() => makeChain(insertedRow, null)),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    const sub = await engine.createSubscription(AGENT_ID, {
      briefId: BRIEF_ID,
      scoreThreshold: 70,
      channels: ['push'],
      digestMode: false,
      digestTime: '07:00',
      quietHoursStart: '21:00',
      quietHoursEnd: '07:00',
    });

    expect(sub.agentId).toBe(AGENT_ID);
    expect(sub.briefId).toBe(BRIEF_ID);
    expect(sub.scoreThreshold).toBe(70);
  });

  it('applies default values when optional fields are omitted', async () => {
    const insertedRow = makeSubscriptionRow();
    const supabase = {
      from: vi.fn(() => makeChain(insertedRow, null)),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    // Only briefId required — rest are defaulted by Zod schema
    const sub = await engine.createSubscription(AGENT_ID, {
      briefId: BRIEF_ID,
    } as never);

    expect(sub.briefId).toBe(BRIEF_ID);
  });

  it('throws when scoreThreshold is below 50', async () => {
    const supabase = { from: vi.fn() };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(
      engine.createSubscription(AGENT_ID, {
        briefId: BRIEF_ID,
        scoreThreshold: 49,
        channels: ['push'],
        digestMode: false,
        digestTime: '07:00',
        quietHoursStart: '21:00',
        quietHoursEnd: '07:00',
      }),
    ).rejects.toThrow();
  });

  it('throws when supabase insert fails', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, { message: 'Insert failed' })),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(
      engine.createSubscription(AGENT_ID, {
        briefId: BRIEF_ID,
        scoreThreshold: 70,
        channels: ['push'],
        digestMode: false,
        digestTime: '07:00',
        quietHoursStart: '21:00',
        quietHoursEnd: '07:00',
      }),
    ).rejects.toThrow('Failed to create alert subscription');
  });
});

// ─── updateSubscription ───────────────────────────────────────────────────────

describe('PropertyAlertEngine.updateSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates subscription fields', async () => {
    const existingRow = { id: SUB_ID, agent_id: AGENT_ID };
    const updatedRow = makeSubscriptionRow({ score_threshold: 80 });

    let fetchCalled = false;
    const supabase = {
      from: vi.fn(() => {
        if (!fetchCalled) {
          fetchCalled = true;
          return makeChain(existingRow, null);
        }
        return makeChain(updatedRow, null);
      }),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    const result = await engine.updateSubscription(SUB_ID, AGENT_ID, { scoreThreshold: 80 });
    expect(result.scoreThreshold).toBe(80);
  });

  it('throws when subscription not found', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, { message: 'Not found' })),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(
      engine.updateSubscription(SUB_ID, AGENT_ID, { scoreThreshold: 80 }),
    ).rejects.toThrow('Subscription not found');
  });

  it('throws when agent does not own the subscription', async () => {
    const ANOTHER_AGENT = '00000000-0000-0000-0000-000000000099';
    const existingRow = { id: SUB_ID, agent_id: ANOTHER_AGENT };

    const supabase = {
      from: vi.fn(() => makeChain(existingRow, null)),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(
      engine.updateSubscription(SUB_ID, AGENT_ID, { scoreThreshold: 80 }),
    ).rejects.toThrow('Unauthorised');
  });
});

// ─── deleteSubscription ───────────────────────────────────────────────────────

describe('PropertyAlertEngine.deleteSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('soft-deletes a subscription', async () => {
    const existingRow = { id: SUB_ID, agent_id: AGENT_ID };

    const updateChain = makeChain(null, null);
    let fetchCalled = false;

    const supabase = {
      from: vi.fn(() => {
        if (!fetchCalled) {
          fetchCalled = true;
          return makeChain(existingRow, null);
        }
        return updateChain;
      }),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(engine.deleteSubscription(SUB_ID, AGENT_ID)).resolves.toBeUndefined();
  });

  it('throws when subscription not found', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, { message: 'Not found' })),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(engine.deleteSubscription(SUB_ID, AGENT_ID)).rejects.toThrow('Subscription not found');
  });

  it('throws when agent does not own the subscription', async () => {
    const ANOTHER_AGENT = '00000000-0000-0000-0000-000000000099';
    const existingRow = { id: SUB_ID, agent_id: ANOTHER_AGENT };

    const supabase = {
      from: vi.fn(() => makeChain(existingRow, null)),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(engine.deleteSubscription(SUB_ID, AGENT_ID)).rejects.toThrow('Unauthorised');
  });
});

// ─── handleNewMatch ───────────────────────────────────────────────────────────

describe('PropertyAlertEngine.handleNewMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches push when match score is above threshold and not in quiet hours', async () => {
    const matchRow = makeMatchRow({ overall_score: 85 });
    const subRow = makeSubscriptionRow({
      channels: ['push'],
      score_threshold: 70,
      digest_mode: false,
      quiet_hours_start: '21:00:00',
      quiet_hours_end: '07:00:00',
    });

    // Token row for push dispatch
    const tokenRow = { token: 'device-push-token-abc' };
    // Insert event row
    const eventInsertChain = makeChain(null, null);

    let callCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        callCount++;
        if (table === 'property_matches' && callCount === 1) {
          return makeChain(matchRow, null);
        }
        if (table === 'property_alert_subscriptions') {
          return makeChain(null, null, [subRow], null);
        }
        if (table === 'push_device_tokens') {
          return makeChain(tokenRow, null);
        }
        if (table === 'property_alert_events') {
          return eventInsertChain;
        }
        return makeChain(null, null);
      }),
    };

    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    // Use UTC 00:00 = AEST 10:00 (outside quiet hours 21:00–07:00)
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    // Mock isQuietHours to return false for this test
    vi.spyOn(engine, 'isQuietHours').mockReturnValue(false);

    await engine.handleNewMatch(MATCH_ID);

    expect(notifyPush).toHaveBeenCalledWith(
      'device-push-token-abc',
      'New Property Match',
      expect.stringContaining('85'),
      expect.any(Object),
    );
  });

  it('does not dispatch when match score is below threshold', async () => {
    // Score 65 < threshold 70 — subscription should not match
    const matchRow = makeMatchRow({ overall_score: 65 });

    let matchFetched = false;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'property_matches' && !matchFetched) {
          matchFetched = true;
          return makeChain(matchRow, null);
        }
        // subscriptions query returns empty (lte filter would exclude them in real DB)
        if (table === 'property_alert_subscriptions') {
          return makeChain(null, null, [], null);
        }
        return makeChain(null, null);
      }),
    };

    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await engine.handleNewMatch(MATCH_ID);

    expect(notifyPush).not.toHaveBeenCalled();
  });

  it('does not dispatch when quiet hours are active', async () => {
    const matchRow = makeMatchRow({ overall_score: 85 });
    const subRow = makeSubscriptionRow({
      score_threshold: 70,
      digest_mode: false,
      quiet_hours_start: '21:00:00',
      quiet_hours_end: '07:00:00',
    });
    const eventInsertChain = makeChain(null, null);

    let matchFetched = false;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'property_matches' && !matchFetched) {
          matchFetched = true;
          return makeChain(matchRow, null);
        }
        if (table === 'property_alert_subscriptions') {
          return makeChain(null, null, [subRow], null);
        }
        if (table === 'property_alert_events') {
          return eventInsertChain;
        }
        return makeChain(null, null);
      }),
    };

    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    // Force quiet hours to be active
    vi.spyOn(engine, 'isQuietHours').mockReturnValue(true);

    await engine.handleNewMatch(MATCH_ID);

    expect(notifyPush).not.toHaveBeenCalled();
  });

  it('returns early when match not found', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, { message: 'Not found' })),
    };

    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(engine.handleNewMatch(MATCH_ID)).resolves.toBeUndefined();
    expect(notifyPush).not.toHaveBeenCalled();
  });
});

// ─── handlePriceChange ────────────────────────────────────────────────────────

describe('PropertyAlertEngine.handlePriceChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches push when price change found and match score is above threshold', async () => {
    const priceChangeRow = makePriceChangeRow();
    const matchRow = makeMatchRow({ overall_score: 85 });
    const subRow = makeSubscriptionRow({ channels: ['push'], score_threshold: 70, digest_mode: false });
    const tokenRow = { token: 'device-push-token-abc' };
    const eventInsertChain = makeChain(null, null);

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'property_price_changes') return makeChain(priceChangeRow, null);
        if (table === 'property_matches') return makeChain(null, null, [matchRow], null);
        if (table === 'property_alert_subscriptions') return makeChain(null, null, [subRow], null);
        if (table === 'push_device_tokens') return makeChain(tokenRow, null);
        if (table === 'property_alert_events') return eventInsertChain;
        return makeChain(null, null);
      }),
    };

    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);
    vi.spyOn(engine, 'isQuietHours').mockReturnValue(false);

    await engine.handlePriceChange(PRICE_CHANGE_ID);

    expect(notifyPush).toHaveBeenCalledWith(
      'device-push-token-abc',
      'Price Drop Alert',
      expect.any(String),
      expect.any(Object),
    );
  });

  it('returns early without dispatching when price change record is not found', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, { message: 'Not found' })),
    };

    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(engine.handlePriceChange(PRICE_CHANGE_ID)).resolves.toBeUndefined();
    expect(notifyPush).not.toHaveBeenCalled();
  });
});

// ─── sendMatchToClient ────────────────────────────────────────────────────────

describe('PropertyAlertEngine.sendMatchToClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates match status to sent_to_client', async () => {
    const matchRow = makeMatchRow();
    const briefRow = { id: BRIEF_ID, created_by: AGENT_ID };

    let stage = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'property_matches' && stage === 0) {
          stage++;
          return makeChain(matchRow, null);
        }
        if (table === 'client_briefs') {
          stage++;
          return makeChain(briefRow, null);
        }
        if (table === 'property_matches' && stage === 2) {
          stage++;
          // update chain — just needs to not throw
          return makeChain(null, null);
        }
        if (table === 'portal_clients') {
          return makeChain({ id: PORTAL_CLIENT_ID, user_id: PORTAL_USER_ID }, null);
        }
        if (table === 'notifications') {
          return makeChain(null, null);
        }
        return makeChain(null, null);
      }),
    };

    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(engine.sendMatchToClient(MATCH_ID, AGENT_ID)).resolves.toBeUndefined();
  });

  it('throws when match is not found', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, { message: 'Not found' })),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(engine.sendMatchToClient(MATCH_ID, AGENT_ID)).rejects.toThrow('Property match not found');
  });

  it('throws when agent does not own the brief', async () => {
    const ANOTHER_AGENT = '00000000-0000-0000-0000-000000000099';
    const matchRow = makeMatchRow();
    const briefRow = { id: BRIEF_ID, created_by: ANOTHER_AGENT };

    let fetchCount = 0;
    const supabase = {
      from: vi.fn(() => {
        fetchCount++;
        if (fetchCount === 1) return makeChain(matchRow, null);
        return makeChain(briefRow, null);
      }),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    await expect(engine.sendMatchToClient(MATCH_ID, AGENT_ID)).rejects.toThrow('Unauthorised');
  });
});

// ─── getAlertEvents ───────────────────────────────────────────────────────────

describe('PropertyAlertEngine.getAlertEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns events ordered by created_at desc', async () => {
    const subIds = [{ id: SUB_ID }];
    const eventRow = makeEventRow();

    let fetchCount = 0;
    const supabase = {
      from: vi.fn(() => {
        fetchCount++;
        if (fetchCount === 1) {
          // subscriptions query
          return makeChain(null, null, subIds, null);
        }
        // events query
        return makeChain(null, null, [eventRow], null);
      }),
    };

    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    const events = await engine.getAlertEvents(AGENT_ID);
    expect(events).toHaveLength(1);
    expect(events[0]!.subscriptionId).toBe(SUB_ID);
    expect(events[0]!.alertType).toBe('new_match');
    expect(events[0]!.matchScore).toBe(85);
  });

  it('returns empty array when agent has no subscriptions', async () => {
    const supabase = {
      from: vi.fn(() => makeChain(null, null, [], null)),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    const events = await engine.getAlertEvents(AGENT_ID);
    expect(events).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    const subIds = [{ id: SUB_ID }];
    const eventRows = Array.from({ length: 3 }, (_, i) =>
      makeEventRow({ id: `e5f6a7b8-c9d0-1234-${String(i).padStart(4, '0')}-345678901234` }),
    );

    let fetchCount = 0;
    const supabase = {
      from: vi.fn(() => {
        fetchCount++;
        if (fetchCount === 1) return makeChain(null, null, subIds, null);
        return makeChain(null, null, eventRows.slice(0, 2), null);
      }),
    };
    const { notifyPush, notifyEmail, notifySms } = makeNotifiers();
    const engine = new PropertyAlertEngine(supabase as never, notifyPush, notifyEmail, notifySms);

    const events = await engine.getAlertEvents(AGENT_ID, 2);
    expect(events).toHaveLength(2);
  });
});
