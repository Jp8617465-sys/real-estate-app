import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamEngine } from './team-engine';

// ─── UUIDs ───────────────────────────────────────────────────────────────────

const OFFICE_ID  = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const AGENT_A    = 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
const AGENT_B    = 'c1b2c3d4-e5f6-7890-abcd-ef1234567892';
const RULE_ID    = 'd1b2c3d4-e5f6-7890-abcd-ef1234567893';
const CONTACT_ID = 'e1b2c3d4-e5f6-7890-abcd-ef1234567894';
const WORKFLOW_ID = 'f1b2c3d4-e5f6-7890-abcd-ef1234567895';

const NOW = new Date().toISOString();
const TODAY = NOW.split('T')[0];

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeUserRow(id: string, overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id,
    first_name: 'Agent',
    last_name: 'Smith',
    email: `agent-${id.slice(0, 4)}@realflow.app`,
    role: 'agent',
    avatar_url: null,
    is_active: true,
    office_id: OFFICE_ID,
    ...overrides,
  };
}

function makeRuleRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: RULE_ID,
    office_id: OFFICE_ID,
    name: 'Facebook DM Round Robin',
    rule_type: 'round_robin',
    conditions: { leadSources: ['facebook_dm', 'instagram_dm'] },
    priority: 10,
    assignee_ids: [AGENT_A, AGENT_B],
    round_robin_idx: 0,
    is_active: true,
    created_by: AGENT_A,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    ...overrides,
  };
}

function makeSnapshotRow(agentId: string, overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    agent_id: agentId,
    active_contacts: 10,
    active_deals: 3,
    deals_closed: 1,
    avg_response_h: 2.5,
    leads_received: 5,
    leads_converted: 2,
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
  chain.in = vi.fn(self);
  chain.not = vi.fn(self);
  chain.neq = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.range = vi.fn(self);
  chain.update = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.upsert = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

// ─── TeamEngine.getTeamMembers ────────────────────────────────────────────────

describe('TeamEngine.getTeamMembers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of active agents in office', async () => {
    const rows = [makeUserRow(AGENT_A), makeUserRow(AGENT_B)];
    const supabase = { from: vi.fn(() => makeChain(rows)) };

    const engine = new TeamEngine(supabase as never);
    const members = await engine.getTeamMembers(OFFICE_ID);

    expect(members).toHaveLength(2);
    expect(members[0].id).toBe(AGENT_A);
    expect(members[0].firstName).toBe('Agent');
    expect(members[0].isActive).toBe(true);
  });

  it('throws when query fails', async () => {
    const supabase = { from: vi.fn(() => makeChain(null, { message: 'DB error' })) };

    const engine = new TeamEngine(supabase as never);
    await expect(engine.getTeamMembers(OFFICE_ID)).rejects.toThrow('Failed to get team members');
  });
});

// ─── TeamEngine.getTeamPerformance ────────────────────────────────────────────

describe('TeamEngine.getTeamPerformance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregates snapshots per agent', async () => {
    const snapshots = [
      makeSnapshotRow(AGENT_A),
      makeSnapshotRow(AGENT_A, { deals_closed: 2, leads_received: 3, leads_converted: 1 }),
      makeSnapshotRow(AGENT_B),
    ];
    const users = [
      { id: AGENT_A, first_name: 'Alice', last_name: 'Chen' },
      { id: AGENT_B, first_name: 'Bob', last_name: 'Lee' },
    ];

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeChain(snapshots)) // snapshots query
        .mockReturnValueOnce(makeChain(users)),     // user names
    };

    const engine = new TeamEngine(supabase as never);
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');
    const performance = await engine.getTeamPerformance(OFFICE_ID, from, to);

    expect(performance).toHaveLength(2);
    const agentA = performance.find(p => p.agentId === AGENT_A);
    expect(agentA).toBeDefined();
    expect(agentA?.agentName).toBe('Alice Chen');
    expect(agentA?.dealsClosed).toBe(3); // 1 + 2 aggregated
  });

  it('returns empty array when no snapshots exist', async () => {
    const supabase = { from: vi.fn(() => makeChain([])) };

    const engine = new TeamEngine(supabase as never);
    const performance = await engine.getTeamPerformance(OFFICE_ID, new Date(), new Date());

    expect(performance).toHaveLength(0);
  });

  it('calculates conversion rate correctly', async () => {
    const snapshots = [makeSnapshotRow(AGENT_A, { leads_received: 10, leads_converted: 4 })];
    const users = [{ id: AGENT_A, first_name: 'Alice', last_name: 'Chen' }];

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeChain(snapshots))
        .mockReturnValueOnce(makeChain(users)),
    };

    const engine = new TeamEngine(supabase as never);
    const performance = await engine.getTeamPerformance(OFFICE_ID, new Date(), new Date());

    expect(performance[0].conversionRate).toBe(40); // 4/10 = 40%
  });
});

// ─── TeamEngine.createAssignmentRule ──────────────────────────────────────────

describe('TeamEngine.createAssignmentRule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a round-robin rule', async () => {
    const rule = makeRuleRow();
    const supabase = { from: vi.fn(() => makeChain(rule)) };

    const engine = new TeamEngine(supabase as never);
    const result = await engine.createAssignmentRule(
      OFFICE_ID,
      {
        name: 'Facebook DM Round Robin',
        ruleType: 'round_robin',
        conditions: { leadSources: ['facebook_dm'] },
        assigneeIds: [AGENT_A, AGENT_B],
      },
      AGENT_A,
    );

    expect(result.id).toBe(RULE_ID);
    expect(result.ruleType).toBe('round_robin');
    expect(result.assigneeIds).toHaveLength(2);
  });

  it('throws when insert fails', async () => {
    const supabase = { from: vi.fn(() => makeChain(null, { message: 'Insert failed' })) };

    const engine = new TeamEngine(supabase as never);
    await expect(
      engine.createAssignmentRule(
        OFFICE_ID,
        { name: 'Rule', ruleType: 'manual', assigneeIds: [AGENT_A] },
        AGENT_A,
      ),
    ).rejects.toThrow('Failed to create assignment rule');
  });
});

// ─── TeamEngine.updateAssignmentRule ─────────────────────────────────────────

describe('TeamEngine.updateAssignmentRule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates rule fields', async () => {
    const updated = makeRuleRow({ is_active: false });
    const supabase = { from: vi.fn(() => makeChain(updated)) };

    const engine = new TeamEngine(supabase as never);
    const result = await engine.updateAssignmentRule(RULE_ID, { isActive: false });

    expect(result.isActive).toBe(false);
  });
});

// ─── TeamEngine.deleteAssignmentRule ─────────────────────────────────────────

describe('TeamEngine.deleteAssignmentRule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('soft-deletes the rule', async () => {
    const chain = makeChain(null);
    const supabase = { from: vi.fn(() => chain) };

    const engine = new TeamEngine(supabase as never);
    await engine.deleteAssignmentRule(RULE_ID);

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String), is_active: false }),
    );
  });
});

// ─── TeamEngine.assignLead (round-robin) ──────────────────────────────────────

describe('TeamEngine.assignLead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assigns lead using round-robin rule and increments index', async () => {
    const contact = { id: CONTACT_ID, lead_source: 'facebook_dm', buyer_profile: null };
    const rules = [makeRuleRow({ round_robin_idx: 0 })];

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeChain(contact))   // fetch contact
        .mockReturnValueOnce(makeChain(rules)),     // list rules
      // rpc returns the assignee atomically
      rpc: vi.fn().mockResolvedValue({ data: { assignee_id: AGENT_A, next_idx: 1 }, error: null }),
    };

    const engine = new TeamEngine(supabase as never);
    const assigneeId = await engine.assignLead(CONTACT_ID, OFFICE_ID);

    // idx 0 → returns AGENT_A (first in list)
    expect(assigneeId).toBe(AGENT_A);
    expect(supabase.rpc).toHaveBeenCalledWith('claim_round_robin_assignee', { rule_id: RULE_ID });
  });

  it('rotates to next agent on second call', async () => {
    const contact = { id: CONTACT_ID, lead_source: 'facebook_dm', buyer_profile: null };
    // Simulates the state after first call (idx now 1)
    const rulesAtIdx1 = [makeRuleRow({ round_robin_idx: 1 })];

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeChain(contact))
        .mockReturnValueOnce(makeChain(rulesAtIdx1)),
      // rpc returns AGENT_B atomically (idx 1 → second agent)
      rpc: vi.fn().mockResolvedValue({ data: { assignee_id: AGENT_B, next_idx: 0 }, error: null }),
    };

    const engine = new TeamEngine(supabase as never);
    const assigneeId = await engine.assignLead(CONTACT_ID, OFFICE_ID);

    // idx 1 → returns AGENT_B (second in list)
    expect(assigneeId).toBe(AGENT_B);
  });

  it('returns null when no rules match', async () => {
    const contact = { id: CONTACT_ID, lead_source: 'walk-in', buyer_profile: null };
    // Rule only applies to facebook_dm — walk-in won't match
    const rules = [makeRuleRow({ conditions: { leadSources: ['facebook_dm'] } })];

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeChain(contact))
        .mockReturnValueOnce(makeChain(rules)),
    };

    const engine = new TeamEngine(supabase as never);
    const assigneeId = await engine.assignLead(CONTACT_ID, OFFICE_ID);

    expect(assigneeId).toBeNull();
  });

  it('returns null when no active rules exist', async () => {
    const contact = { id: CONTACT_ID, lead_source: 'facebook_dm', buyer_profile: null };
    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeChain(contact))
        .mockReturnValueOnce(makeChain([])), // no rules
    };

    const engine = new TeamEngine(supabase as never);
    const assigneeId = await engine.assignLead(CONTACT_ID, OFFICE_ID);

    expect(assigneeId).toBeNull();
  });
});

// ─── TeamEngine.shareWorkflowTemplate ────────────────────────────────────────

describe('TeamEngine.shareWorkflowTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks workflow as team template', async () => {
    const chain = makeChain(null);
    const supabase = { from: vi.fn(() => chain) };

    const engine = new TeamEngine(supabase as never);
    await engine.shareWorkflowTemplate(WORKFLOW_ID, AGENT_A);

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_team_template: true, shared_by_agent_id: AGENT_A }),
    );
  });
});

// ─── TeamEngine.unshareWorkflowTemplate ──────────────────────────────────────

describe('TeamEngine.unshareWorkflowTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears team template flags', async () => {
    const chain = makeChain(null);
    const supabase = { from: vi.fn(() => chain) };

    const engine = new TeamEngine(supabase as never);
    await engine.unshareWorkflowTemplate(WORKFLOW_ID, AGENT_A);

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_team_template: false,
        shared_by_agent_id: null,
        shared_at: null,
      }),
    );
  });
});

// ─── TeamEngine.listTeamTemplates ─────────────────────────────────────────────

describe('TeamEngine.listTeamTemplates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns shared templates for the office', async () => {
    const rows = [
      { id: WORKFLOW_ID, name: 'New Buyer Onboarding', shared_at: NOW, shared_by_agent_id: AGENT_A },
    ];
    const supabase = { from: vi.fn(() => makeChain(rows)) };

    const engine = new TeamEngine(supabase as never);
    const templates = await engine.listTeamTemplates(OFFICE_ID);

    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('New Buyer Onboarding');
    expect(templates[0].sharedBy).toBe(AGENT_A);
  });
});
