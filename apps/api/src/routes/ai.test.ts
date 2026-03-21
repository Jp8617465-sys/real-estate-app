import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockGetUser = vi.fn();
const mockSupabase = {
  from: mockFrom,
  auth: { getUser: mockGetUser },
};

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock AI Service Factory ───────────────────────────────────────

const mockIsAIEnabled = vi.fn();
const mockGetAICacheStats = vi.fn();
const mockCheckAIRateLimit = vi.fn();
const mockGetAnthropicClientOrNull = vi.fn();
const mockGetAIPropertyMatchingService = vi.fn();
const mockGetAILeadScoringService = vi.fn();

vi.mock('../services/ai-service-factory', () => ({
  isAIEnabled: () => mockIsAIEnabled(),
  getAICacheStats: () => mockGetAICacheStats(),
  checkAIRateLimit: (userId: string) => mockCheckAIRateLimit(userId),
  getAnthropicClientOrNull: () => mockGetAnthropicClientOrNull(),
  getAIPropertyMatchingService: () => mockGetAIPropertyMatchingService(),
  getAILeadScoringService: () => mockGetAILeadScoringService(),
}));

// ─── Mock business-logic ──────────────────────────────────────────

vi.mock('@realflow/business-logic', () => ({
  fromDbSchema: (data: unknown) => data,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { aiRoutes } from './ai';

// ─── Test setup ───────────────────────────────────────────────────

// A valid JWT with 3 parts (the payload decodes to { sub: 'test-user-id' })
const VALID_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQifQ.abc123';
const BEARER = `Bearer ${VALID_JWT}`;

async function buildApp() {
  const app = Fastify();
  await app.register(aiRoutes, { prefix: '/api/v1/ai' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: rate limit passes
  mockCheckAIRateLimit.mockReturnValue(true);
  mockIsAIEnabled.mockReturnValue(true);
  mockGetAICacheStats.mockReturnValue({ size: 0, hits: 0, misses: 0 });
});

// ─── GET /status ──────────────────────────────────────────────────

describe('GET /api/v1/ai/status', () => {
  it('returns AI status when authenticated', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/status',
      headers: { authorization: BEARER },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty('enabled');
    expect(body).toHaveProperty('cacheStats');
  });

  it('returns 401 without auth header', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/ai/status',
    });

    expect(response.statusCode).toBe(401);
  });
});

// ─── POST /analyze-match ──────────────────────────────────────────

describe('POST /api/v1/ai/analyze-match', () => {
  const propertyId = '00000000-0000-0000-0000-000000000001';
  const clientBriefId = '00000000-0000-0000-0000-000000000002';

  it('returns match score successfully', async () => {
    const mockProperty = { id: propertyId, bedrooms: 3 };
    const mockBrief = { id: clientBriefId };
    const mockScore = { overallScore: 85, breakdown: {} };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'properties') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProperty, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'client_briefs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockBrief, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const mockService = { scoreProperty: vi.fn().mockResolvedValue(mockScore) };
    mockGetAIPropertyMatchingService.mockReturnValue(mockService);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/analyze-match',
      headers: { authorization: BEARER },
      payload: { propertyId, clientBriefId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
  });

  it('returns 400 when propertyId is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/analyze-match',
      headers: { authorization: BEARER },
      payload: { clientBriefId },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when clientBriefId is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/analyze-match',
      headers: { authorization: BEARER },
      payload: { propertyId },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when property not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/analyze-match',
      headers: { authorization: BEARER },
      payload: { propertyId, clientBriefId },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockCheckAIRateLimit.mockReturnValue(false);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/analyze-match',
      headers: { authorization: BEARER },
      payload: { propertyId, clientBriefId },
    });

    expect(response.statusCode).toBe(429);
  });
});

// ─── POST /score-lead ─────────────────────────────────────────────

describe('POST /api/v1/ai/score-lead', () => {
  const contactId = '00000000-0000-0000-0000-000000000003';

  it('returns lead score successfully', async () => {
    const mockContact = { id: contactId, first_name: 'Jane' };
    const mockScore = { score: 72, label: 'warm' };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockContact, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
    });

    const mockService = { enhancedScore: vi.fn().mockResolvedValue(mockScore) };
    mockGetAILeadScoringService.mockReturnValue(mockService);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/score-lead',
      headers: { authorization: BEARER },
      payload: { contactId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
  });

  it('returns 400 when contactId is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/score-lead',
      headers: { authorization: BEARER },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when contact not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/score-lead',
      headers: { authorization: BEARER },
      payload: { contactId },
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST /refine-brief ───────────────────────────────────────────

describe('POST /api/v1/ai/refine-brief', () => {
  const clientBriefId = '00000000-0000-0000-0000-000000000004';

  it('returns 503 when AI is not enabled', async () => {
    mockIsAIEnabled.mockReturnValue(false);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/refine-brief',
      headers: { authorization: BEARER },
      payload: { clientBriefId },
    });

    expect(response.statusCode).toBe(503);
  });

  it('returns 400 when clientBriefId is missing', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/refine-brief',
      headers: { authorization: BEARER },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when client brief not found', async () => {
    mockIsAIEnabled.mockReturnValue(true);

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/refine-brief',
      headers: { authorization: BEARER },
      payload: { clientBriefId },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 503 when anthropic client is null', async () => {
    mockIsAIEnabled.mockReturnValue(true);

    const mockBrief = {
      id: clientBriefId,
      budget: { min: 500000, max: 800000 },
      requirements: {
        mustHaves: [],
        niceToHaves: [],
        dealBreakers: [],
        suburbs: [],
        propertyTypes: [],
      },
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockBrief, error: null }),
              }),
            }),
          }),
        };
      }
      // property_matches query
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    mockGetAnthropicClientOrNull.mockReturnValue(null);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/refine-brief',
      headers: { authorization: BEARER },
      payload: { clientBriefId },
    });

    expect(response.statusCode).toBe(503);
  });
});

// ─── POST /narrative ──────────────────────────────────────────────

describe('POST /api/v1/ai/narrative', () => {
  const clientId = '00000000-0000-0000-0000-000000000010';

  it('returns 503 when AI not configured', async () => {
    mockGetAnthropicClientOrNull.mockReturnValue(null);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/narrative',
      headers: { authorization: BEARER },
      payload: { clientId },
    });

    expect(response.statusCode).toBe(503);
  });

  it('returns 400 for invalid payload (missing clientId)', async () => {
    mockGetAnthropicClientOrNull.mockReturnValue({ generateSearchNarrative: vi.fn() });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/narrative',
      headers: { authorization: BEARER },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when client contact not found', async () => {
    mockGetAnthropicClientOrNull.mockReturnValue({ generateSearchNarrative: vi.fn() });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/narrative',
      headers: { authorization: BEARER },
      payload: { clientId },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockCheckAIRateLimit.mockReturnValue(false);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/narrative',
      headers: { authorization: BEARER },
      payload: { clientId },
    });

    expect(response.statusCode).toBe(429);
  });

  it('returns 200 narrative with full data including brief and matches', async () => {
    const mockAnthropicClient = {
      generateSearchNarrative: vi.fn().mockResolvedValue({
        narrative: 'We have reviewed 5 properties for you...',
        tokenUsage: { input: 200, output: 100 },
      }),
    };
    mockGetAnthropicClientOrNull.mockReturnValue(mockAnthropicClient);

    const mockContact = { first_name: 'John', last_name: 'Smith' };
    const mockBrief = {
      budget: { min: 500000, max: 800000 },
      requirements: { suburbs: [{ suburb: 'Bondi' }, { suburb: 'Manly' }] },
    };
    const mockMatches = [
      { overall_score: 85, status: 'shortlisted', agent_notes: 'Great property', property: { address: { street_address: '1 Ocean St', suburb: 'Bondi', state: 'NSW' } } },
    ];
    const mockCount = { count: 10, data: null, error: null };

    let callIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      callIndex++;
      if (table === 'contacts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockContact, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'client_briefs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: mockBrief, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'property_matches') {
        // First call = matches query, second call = count query
        if (callIndex <= 3) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: mockMatches, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockCount),
          }),
        };
      }
      return {};
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/narrative',
      headers: { authorization: BEARER },
      payload: { clientId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.clientId).toBe(clientId);
    expect(body.data.narrative).toBeDefined();
  });

  it('returns 200 narrative with propertyIds filter applied', async () => {
    const mockAnthropicClient = {
      generateSearchNarrative: vi.fn().mockResolvedValue({
        narrative: 'Filtered narrative',
        tokenUsage: { input: 100, output: 50 },
      }),
    };
    mockGetAnthropicClientOrNull.mockReturnValue(mockAnthropicClient);

    const mockContact = { first_name: 'Jane', last_name: 'Doe' };

    let callIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      callIndex++;
      if (table === 'contacts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockContact, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'client_briefs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      // property_matches with in filter
      if (table === 'property_matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 0, data: null, error: null }),
        }),
      };
    });

    const propertyId = '00000000-0000-0000-0000-000000000099';
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/narrative',
      headers: { authorization: BEARER },
      payload: { clientId, propertyIds: [propertyId] },
    });

    expect(response.statusCode).toBe(200);
  });
});

// ─── POST /draft-message ──────────────────────────────────────────

describe('POST /api/v1/ai/draft-message', () => {
  const contactId = '00000000-0000-0000-0000-000000000020';

  it('returns 503 when AI not configured', async () => {
    mockGetAnthropicClientOrNull.mockReturnValue(null);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/draft-message',
      headers: { authorization: BEARER },
      payload: { contactId, channel: 'email', intent: 'follow-up' },
    });

    expect(response.statusCode).toBe(503);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockCheckAIRateLimit.mockReturnValue(false);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/draft-message',
      headers: { authorization: BEARER },
      payload: { contactId, channel: 'email', intent: 'follow-up' },
    });

    expect(response.statusCode).toBe(429);
  });

  it('returns 400 for invalid payload (missing channel)', async () => {
    mockGetAnthropicClientOrNull.mockReturnValue({ draftMessage: vi.fn() });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/draft-message',
      headers: { authorization: BEARER },
      payload: { contactId, intent: 'follow-up' }, // missing channel
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when contact not found', async () => {
    mockGetAnthropicClientOrNull.mockReturnValue({ draftMessage: vi.fn() });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/draft-message',
      headers: { authorization: BEARER },
      payload: { contactId, channel: 'email', intent: 'follow-up' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 200 with drafted message', async () => {
    const mockDraftResult = {
      subject: 'Following up on your property search',
      body: 'Dear John, I wanted to follow up...',
      suggestedTone: 'professional',
      alternativePhrasing: ['Hi John,'],
      tokenUsage: { input: 150, output: 80 },
    };
    mockGetAnthropicClientOrNull.mockReturnValue({
      draftMessage: vi.fn().mockResolvedValue(mockDraftResult),
    });

    let callIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      callIndex++;
      if (table === 'contacts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { first_name: 'John', last_name: 'Smith', source: 'web', pipeline_stage: 'brief' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'activities') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ title: 'Called client' }, { title: 'Sent property list' }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/draft-message',
      headers: { authorization: BEARER },
      payload: { contactId, channel: 'sms', intent: 'property-update', toneHint: 'friendly' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.subject).toBe('Following up on your property search');
    expect(body.data.body).toBeDefined();
  });
});

// ─── POST /refine-brief — with search history branch ──────────────

describe('POST /api/v1/ai/refine-brief — search history', () => {
  const clientBriefId = '00000000-0000-0000-0000-000000000030';

  it('calls suggestBriefRefinements and returns 200 when data found with rejection history', async () => {
    const mockAnthropicClient = {
      suggestBriefRefinements: vi.fn().mockResolvedValue({
        suggestions: ['Consider adding more suburbs'],
        completenessScore: 75,
        missingFields: ['bedrooms'],
        tokenUsage: { input: 200, output: 100 },
      }),
    };
    mockGetAnthropicClientOrNull.mockReturnValue(mockAnthropicClient);
    mockIsAIEnabled.mockReturnValue(true);

    const mockBrief = {
      id: clientBriefId,
      budget: { min: 500000, max: 800000 },
      requirements: {
        mustHaves: ['garage'],
        niceToHaves: ['pool'],
        dealBreakers: ['noisy street'],
        suburbs: [{ suburb: 'Bondi' }],
        propertyTypes: ['house'],
      },
    };

    const mockRejectedMatches = [
      { overall_score: 40, rejection_reason: 'Too small' },
      { overall_score: 35, rejection_reason: 'Over budget' },
      { overall_score: 30, rejection_reason: null },
    ];

    let callIndex = 0;
    mockFrom.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // client_briefs fetch
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockBrief, error: null }),
              }),
            }),
          }),
        };
      }
      // property_matches rejection history
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockRejectedMatches, error: null }),
          }),
        }),
      };
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/refine-brief',
      headers: { authorization: BEARER },
      payload: { clientBriefId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.suggestions).toBeDefined();
    expect(body.data.completenessScore).toBe(75);
  });
});

// ─── POST /extract-email-signals ──────────────────────────────────

describe('POST /api/v1/ai/extract-email-signals', () => {
  it('returns 401 without auth header', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/extract-email-signals',
      payload: { subject: 'Test', body: 'Test body' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 503 when AI not configured', async () => {
    mockGetAnthropicClientOrNull.mockReturnValue(null);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/extract-email-signals',
      headers: { authorization: BEARER },
      payload: { subject: 'Test', body: 'Test body' },
    });

    expect(response.statusCode).toBe(503);
  });

  it('returns 400 for invalid payload', async () => {
    mockGetAnthropicClientOrNull.mockReturnValue({ extractEmailSignals: vi.fn() });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/extract-email-signals',
      headers: { authorization: BEARER },
      payload: {}, // missing required subject and body
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 200 with extracted signals', async () => {
    const mockSignals = {
      intent: 'buy',
      urgency: 'high',
      budgetMin: 500000,
      budgetMax: 800000,
      financeStatus: 'approved',
      estimatedTimeline: '3 months',
      propertyPreferences: [],
      signals: [],
      overallConfidence: 0.9,
      tokenUsage: { input: 100, output: 50 },
    };

    mockGetAnthropicClientOrNull.mockReturnValue({
      extractEmailSignals: vi.fn().mockResolvedValue(mockSignals),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/extract-email-signals',
      headers: { authorization: BEARER },
      payload: { subject: 'Looking to buy', body: 'I want to buy a house in Sydney' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.intent).toBe('buy');
  });
});
