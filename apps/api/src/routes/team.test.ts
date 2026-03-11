import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { teamRoutes } from './team';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const AGENT_B = 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
const OFFICE_ID = 'c1b2c3d4-e5f6-7890-abcd-ef1234567892';
const RULE_ID = 'd1b2c3d4-e5f6-7890-abcd-ef1234567893';
const CONTACT_ID = 'e1b2c3d4-e5f6-7890-abcd-ef1234567894';
const WORKFLOW_ID = 'f1b2c3d4-e5f6-7890-abcd-ef1234567895';

const NOW = new Date().toISOString();

// ─── Engine mock ──────────────────────────────────────────────────────────────

const mockEngine = {
  getTeamMembers: vi.fn(),
  getTeamPerformance: vi.fn(),
  listAssignmentRules: vi.fn(),
  createAssignmentRule: vi.fn(),
  updateAssignmentRule: vi.fn(),
  deleteAssignmentRule: vi.fn(),
  assignLead: vi.fn(),
  shareWorkflowTemplate: vi.fn(),
  unshareWorkflowTemplate: vi.fn(),
  listTeamTemplates: vi.fn(),
  snapshotTeamPerformance: vi.fn(),
};

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: vi.fn(),
}));

vi.mock('@realflow/business-logic', () => {
  function TeamEngine() {
    return mockEngine;
  }
  return { TeamEngine };
});

import { createSupabaseClient } from '../middleware/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChainFor(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.then = (resolve: (v: { data: unknown; error: unknown }) => void) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

function makeSupabase(
  user: { id: string } | null = { id: AGENT_ID },
  officeRow: { office_id: string } | null = { office_id: OFFICE_ID },
) {
  return {
    from: vi.fn(() => makeChainFor(officeRow)),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user },
          error: user ? null : { message: 'Not authenticated' },
        }),
      ),
    },
  };
}

function makeRule(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: RULE_ID,
    officeId: OFFICE_ID,
    name: 'FB Round Robin',
    ruleType: 'round_robin',
    conditions: { leadSources: ['facebook_dm'] },
    priority: 10,
    assigneeIds: [AGENT_ID, AGENT_B],
    roundRobinIdx: 0,
    isActive: true,
    createdBy: AGENT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

function makeMember(id: string): Record<string, unknown> {
  return {
    id,
    firstName: 'Agent',
    lastName: 'Smith',
    email: `agent@test.com`,
    role: 'agent',
    avatarUrl: null,
    isActive: true,
  };
}

async function buildApp() {
  const app = Fastify();
  await app.register(teamRoutes);
  return app;
}

// ─── GET /team/members ────────────────────────────────────────────────────────

describe('GET /team/members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getTeamMembers.mockResolvedValue([makeMember(AGENT_ID), makeMember(AGENT_B)]);
  });

  it('returns 200 with team members', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/team/members' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/team/members' });

    expect(res.statusCode).toBe(401);
  });
});

// ─── GET /team/performance ────────────────────────────────────────────────────

describe('GET /team/performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.getTeamPerformance.mockResolvedValue([
      {
        agentId: AGENT_ID,
        agentName: 'Alice Chen',
        activeContacts: 10,
        activeDeals: 3,
        dealsClosed: 2,
        avgResponseHours: 1.5,
        leadsReceived: 8,
        leadsConverted: 4,
        conversionRate: 50,
      },
    ]);
  });

  it('returns 200 with performance data', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/team/performance' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data[0].agentName).toBe('Alice Chen');
    expect(body.data[0].conversionRate).toBe(50);
  });

  it('passes date range to engine', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    await app.inject({ method: 'GET', url: '/team/performance?from=2026-01-01&to=2026-01-31' });

    expect(mockEngine.getTeamPerformance).toHaveBeenCalledWith(
      OFFICE_ID,
      new Date('2026-01-01'),
      new Date('2026-01-31'),
    );
  });
});

// ─── GET /team/assignment-rules ───────────────────────────────────────────────

describe('GET /team/assignment-rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.listAssignmentRules.mockResolvedValue([makeRule()]);
  });

  it('returns 200 with rules list', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/team/assignment-rules' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data[0].id).toBe(RULE_ID);
    expect(body.data[0].ruleType).toBe('round_robin');
  });
});

// ─── POST /team/assignment-rules ──────────────────────────────────────────────

describe('POST /team/assignment-rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.createAssignmentRule.mockResolvedValue(makeRule());
  });

  it('returns 201 with created rule', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/team/assignment-rules',
      payload: {
        name: 'FB Round Robin',
        ruleType: 'round_robin',
        assigneeIds: [AGENT_ID, AGENT_B],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(RULE_ID);
  });

  it('returns 400 for missing required fields', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/team/assignment-rules',
      payload: { name: 'Rule' }, // missing ruleType and assigneeIds
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase(null) as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/team/assignment-rules',
      payload: { name: 'Rule', ruleType: 'round_robin', assigneeIds: [AGENT_ID] },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ─── PATCH /team/assignment-rules/:id ────────────────────────────────────────

describe('PATCH /team/assignment-rules/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.updateAssignmentRule.mockResolvedValue(
      makeRule({ is_active: false, isActive: false }),
    );
  });

  it('returns 200 with updated rule', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/team/assignment-rules/${RULE_ID}`,
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(200);
  });
});

// ─── DELETE /team/assignment-rules/:id ───────────────────────────────────────

describe('DELETE /team/assignment-rules/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.deleteAssignmentRule.mockResolvedValue(undefined);
  });

  it('returns 204 on success', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'DELETE', url: `/team/assignment-rules/${RULE_ID}` });

    expect(res.statusCode).toBe(204);
  });
});

// ─── POST /team/assignment-rules/test ────────────────────────────────────────

describe('POST /team/assignment-rules/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.assignLead.mockResolvedValue(AGENT_ID);
  });

  it('returns the assigned agent ID', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/team/assignment-rules/test',
      payload: { contactId: CONTACT_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.assigneeId).toBe(AGENT_ID);
  });

  it('returns 400 for invalid contactId', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/team/assignment-rules/test',
      payload: { contactId: 'not-a-uuid' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── GET /team/workflow-templates ─────────────────────────────────────────────

describe('GET /team/workflow-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.listTeamTemplates.mockResolvedValue([
      { id: WORKFLOW_ID, name: 'Buyer Onboarding', sharedAt: NOW, sharedBy: AGENT_ID },
    ]);
  });

  it('returns 200 with shared templates', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/team/workflow-templates' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data[0].name).toBe('Buyer Onboarding');
  });
});

// ─── POST /team/workflow-templates/:id/share ──────────────────────────────────

describe('POST /team/workflow-templates/:id/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.shareWorkflowTemplate.mockResolvedValue(undefined);
  });

  it('returns 204 on success', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: `/team/workflow-templates/${WORKFLOW_ID}/share`,
    });

    expect(res.statusCode).toBe(204);
    expect(mockEngine.shareWorkflowTemplate).toHaveBeenCalledWith(WORKFLOW_ID, AGENT_ID);
  });
});

// ─── DELETE /team/workflow-templates/:id/share ────────────────────────────────

describe('DELETE /team/workflow-templates/:id/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.unshareWorkflowTemplate.mockResolvedValue(undefined);
  });

  it('returns 204 on success', async () => {
    vi.mocked(createSupabaseClient).mockReturnValue(makeSupabase() as never);

    const app = await buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/team/workflow-templates/${WORKFLOW_ID}/share`,
    });

    expect(res.statusCode).toBe(204);
  });
});
