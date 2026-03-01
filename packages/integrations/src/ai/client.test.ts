import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicClient } from './client';
import { AnthropicAPIError } from '../errors';

// ─── Setup ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();

const validConfig = {
  apiKey: 'sk-ant-test-key',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1024,
  rateLimitPerMinute: 60,
};

function mockAnthropicResponse(text: string, inputTokens = 100, outputTokens = 50) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text }],
      model: validConfig.model,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    }),
  });
}

function mockErrorResponse(status: number, statusText: string, errorType = 'api_error') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    json: async () => ({ type: 'error', error: { type: errorType, message: statusText } }),
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Constructor ───────────────────────────────────────────────────

describe('AnthropicClient constructor', () => {
  it('creates client with valid config', () => {
    const client = new AnthropicClient(validConfig);
    expect(client).toBeDefined();
  });

  it('throws on missing apiKey', () => {
    expect(() => new AnthropicClient({ ...validConfig, apiKey: '' })).toThrow();
  });

  it('uses default model when not specified', () => {
    const client = new AnthropicClient({ apiKey: 'sk-ant-test' });
    expect(client).toBeDefined();
  });

  it('uses default maxTokens when not specified', () => {
    const client = new AnthropicClient({ apiKey: 'sk-ant-test' });
    expect(client).toBeDefined();
  });
});

// ─── Request Format ─────────────────────────────────────────────────

describe('AnthropicClient request format', () => {
  it('sends x-api-key header (not Bearer)', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      featureScore: 80,
      features: [],
      dealBreakerFlags: [],
      summary: 'Good match',
    }));

    await client.analyzePropertyMatch({
      listingDescription: 'Modern 4-bed house with pool',
      mustHaves: ['pool'],
      niceToHaves: [],
      dealBreakers: [],
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0]!;
    expect(options.headers['x-api-key']).toBe('sk-ant-test-key');
    expect(options.headers['Authorization']).toBeUndefined();
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('sends correct model in request body', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      featureScore: 60,
      features: [],
      dealBreakerFlags: [],
      summary: 'Partial match',
    }));

    await client.analyzePropertyMatch({
      listingDescription: 'Nice property',
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
    });

    const [, options] = mockFetch.mock.calls[0]!;
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe(validConfig.model);
    expect(body.max_tokens).toBe(validConfig.maxTokens);
  });

  it('posts to correct Anthropic endpoint', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      featureScore: 50,
      features: [],
      dealBreakerFlags: [],
      summary: 'Neutral',
    }));

    await client.analyzePropertyMatch({
      listingDescription: 'Property',
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
    });

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
  });
});

// ─── analyzePropertyMatch ──────────────────────────────────────────

describe('AnthropicClient.analyzePropertyMatch', () => {
  it('returns featureScore clamped 0-100', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      featureScore: 150, // out of range
      features: [],
      dealBreakerFlags: [],
      summary: 'Test',
    }));

    const result = await client.analyzePropertyMatch({
      listingDescription: 'Test property',
      mustHaves: ['pool'],
      niceToHaves: [],
      dealBreakers: [],
    });

    expect(result.featureScore).toBe(100);
  });

  it('parses feature matches and deal breaker flags', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      featureScore: 75,
      features: [
        {
          feature: 'pool',
          status: 'matched',
          confidence: 0.9,
          explanation: 'Pool mentioned in listing',
          source: 'must_have',
        },
      ],
      dealBreakerFlags: [],
      summary: 'Pool found in listing.',
    }));

    const result = await client.analyzePropertyMatch({
      listingDescription: 'Stunning home with heated pool',
      mustHaves: ['pool'],
      niceToHaves: [],
      dealBreakers: [],
    });

    expect(result.featureScore).toBe(75);
    expect(result.features).toHaveLength(1);
    expect(result.features[0]?.feature).toBe('pool');
    expect(result.features[0]?.status).toBe('matched');
    expect(result.summary).toBe('Pool found in listing.');
  });

  it('returns token usage with cost estimate', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      featureScore: 70,
      features: [],
      dealBreakerFlags: [],
      summary: 'Good',
    }), 500, 200);

    const result = await client.analyzePropertyMatch({
      listingDescription: 'Nice property',
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
    });

    expect(result.tokenUsage.inputTokens).toBe(500);
    expect(result.tokenUsage.outputTokens).toBe(200);
    expect(result.tokenUsage.estimatedCostAud).toBeGreaterThan(0);
    expect(result.tokenUsage.model).toBe(validConfig.model);
  });

  it('strips markdown code fences from response', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse('```json\n{"featureScore":70,"features":[],"dealBreakerFlags":[],"summary":"Good"}\n```');

    const result = await client.analyzePropertyMatch({
      listingDescription: 'Nice property',
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
    });

    expect(result.featureScore).toBe(70);
  });
});

// ─── analyzeLeadEnquiry ────────────────────────────────────────────

describe('AnthropicClient.analyzeLeadEnquiry', () => {
  it('returns signals and urgency level', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      signals: [
        { signal: 'Has pre-approval', impact: 'positive', weight: 8, explanation: 'Mentioned pre-approved' },
      ],
      urgencyLevel: 'high',
      estimatedTimeline: '1-2 months',
      budgetConfidence: 'high',
      suggestedScore: 80,
    }));

    const result = await client.analyzeLeadEnquiry({
      enquiryText: 'Hi, we are pre-approved to $1.2M and looking to buy in the next 6 weeks.',
    });

    expect(result.signals).toHaveLength(1);
    expect(result.urgencyLevel).toBe('high');
    expect(result.estimatedTimeline).toBe('1-2 months');
    expect(result.budgetConfidence).toBe('high');
    expect(result.suggestedScore).toBe(80);
  });

  it('clamps suggestedScore to 0-100', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      signals: [],
      urgencyLevel: 'none',
      estimatedTimeline: null,
      budgetConfidence: 'unknown',
      suggestedScore: 999,
    }));

    const result = await client.analyzeLeadEnquiry({ enquiryText: 'Hello' });
    expect(result.suggestedScore).toBe(100);
  });

  it('defaults to none urgency and unknown budget confidence on missing fields', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({ suggestedScore: 50 }));

    const result = await client.analyzeLeadEnquiry({ enquiryText: 'Just browsing' });
    expect(result.urgencyLevel).toBe('none');
    expect(result.budgetConfidence).toBe('unknown');
    expect(result.signals).toEqual([]);
  });
});

// ─── Error Handling ────────────────────────────────────────────────

describe('AnthropicClient error handling', () => {
  it('throws AnthropicAPIError on 401', async () => {
    const client = new AnthropicClient(validConfig);
    mockErrorResponse(401, 'Unauthorized', 'authentication_error');

    await expect(
      client.analyzePropertyMatch({
        listingDescription: 'Test',
        mustHaves: [],
        niceToHaves: [],
        dealBreakers: [],
      }),
    ).rejects.toThrow(AnthropicAPIError);
  });

  it('throws on invalid JSON response', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse('not valid json at all');

    await expect(
      client.analyzePropertyMatch({
        listingDescription: 'Test',
        mustHaves: [],
        niceToHaves: [],
        dealBreakers: [],
      }),
    ).rejects.toThrow(AnthropicAPIError);
  });

  it('retries on 429 rate limit and succeeds', async () => {
    const client = new AnthropicClient({ ...validConfig, maxRetries: 2, retryBaseDelayMs: 0 });

    // First call: 429
    mockErrorResponse(429, 'Too Many Requests', 'rate_limit_error');
    // Second call: success
    mockAnthropicResponse(JSON.stringify({
      featureScore: 70,
      features: [],
      dealBreakerFlags: [],
      summary: 'Retried successfully',
    }));

    const result = await client.analyzePropertyMatch({
      listingDescription: 'Test',
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
    });

    expect(result.featureScore).toBe(70);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on 429', async () => {
    const client = new AnthropicClient({ ...validConfig, maxRetries: 1, retryBaseDelayMs: 0 });

    mockErrorResponse(429, 'Too Many Requests', 'rate_limit_error');
    mockErrorResponse(429, 'Too Many Requests', 'rate_limit_error');

    await expect(
      client.analyzePropertyMatch({
        listingDescription: 'Test',
        mustHaves: [],
        niceToHaves: [],
        dealBreakers: [],
      }),
    ).rejects.toThrow(AnthropicAPIError);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400 client error', async () => {
    const client = new AnthropicClient({ ...validConfig, maxRetries: 3 });
    mockErrorResponse(400, 'Bad Request', 'invalid_request_error');

    await expect(
      client.analyzePropertyMatch({
        listingDescription: 'Test',
        mustHaves: [],
        niceToHaves: [],
        dealBreakers: [],
      }),
    ).rejects.toThrow(AnthropicAPIError);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─── Cost Calculation ──────────────────────────────────────────────

describe('AnthropicClient cost calculation', () => {
  it('calculates non-zero cost for tokens used', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      featureScore: 60,
      features: [],
      dealBreakerFlags: [],
      summary: 'Test',
    }), 1000, 500);

    const result = await client.analyzePropertyMatch({
      listingDescription: 'Test',
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
    });

    expect(result.tokenUsage.estimatedCostAud).toBeGreaterThan(0);
    // 1000 input + 500 output for claude-sonnet-4 ≈ $0.0048 + $0.012 = $0.0168 AUD
    expect(result.tokenUsage.estimatedCostAud).toBeCloseTo(0.0168, 3);
  });
});

// ─── draftMessage ──────────────────────────────────────────────────

describe('AnthropicClient.draftMessage', () => {
  it('returns subject, body, tone, and alternative phrasings for email', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      subject: 'Following up on your inspection',
      body: 'Hi Sarah, just wanted to follow up on your inspection yesterday.',
      suggestedTone: 'friendly',
      alternativePhrasing: [
        'Hi Sarah, I hope the inspection met your expectations.',
        'Dear Sarah, thank you for taking the time to inspect the property.',
      ],
    }));

    const result = await client.draftMessage({
      channel: 'email',
      intent: 'Follow up after inspection',
      contactContext: { name: 'Sarah Smith', pipelineStage: 'active-search' },
    });

    expect(result.subject).toBe('Following up on your inspection');
    expect(result.body).toContain('Sarah');
    expect(result.suggestedTone).toBe('friendly');
    expect(result.alternativePhrasing).toHaveLength(2);
    expect(result.tokenUsage.inputTokens).toBe(100);
  });

  it('defaults to professional tone and empty alternativePhrasing on missing fields', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({ body: 'Hi there' }));

    const result = await client.draftMessage({
      channel: 'sms',
      intent: 'Quick check-in',
    });

    expect(result.body).toBe('Hi there');
    expect(result.suggestedTone).toBe('professional');
    expect(result.alternativePhrasing).toEqual([]);
    expect(result.subject).toBeUndefined();
  });

  it('includes token usage in result', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      body: 'Message body',
      suggestedTone: 'formal',
      alternativePhrasing: [],
    }), 300, 150);

    const result = await client.draftMessage({ channel: 'whatsapp', intent: 'Send update' });

    expect(result.tokenUsage.inputTokens).toBe(300);
    expect(result.tokenUsage.outputTokens).toBe(150);
    expect(result.tokenUsage.estimatedCostAud).toBeGreaterThan(0);
  });
});

// ─── extractEmailSignals ───────────────────────────────────────────

describe('AnthropicClient.extractEmailSignals', () => {
  it('returns full signal extraction from a buying enquiry', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      intent: 'buy',
      urgency: 'high',
      budgetMin: 800000,
      budgetMax: 1100000,
      financeStatus: 'pre_approved',
      estimatedTimeline: '4-6 weeks',
      propertyPreferences: ['Bondi', 'Coogee', '3 bedrooms'],
      signals: [
        { signal: 'Pre-approval mentioned', impact: 'positive', confidence: 0.95 },
        { signal: 'Specific suburb preference', impact: 'positive', confidence: 0.9 },
      ],
      overallConfidence: 0.88,
    }));

    const result = await client.extractEmailSignals({
      subject: 'Enquiry about properties in Bondi',
      body: 'We are pre-approved to $1.1M and looking for a 3 bed in Bondi or Coogee. Need to buy in 4-6 weeks.',
      fromEmail: 'buyer@example.com',
    });

    expect(result.intent).toBe('buy');
    expect(result.urgency).toBe('high');
    expect(result.budgetMin).toBe(800000);
    expect(result.budgetMax).toBe(1100000);
    expect(result.financeStatus).toBe('pre_approved');
    expect(result.estimatedTimeline).toBe('4-6 weeks');
    expect(result.propertyPreferences).toContain('Bondi');
    expect(result.signals).toHaveLength(2);
    expect(result.overallConfidence).toBeCloseTo(0.88);
    expect(result.tokenUsage.inputTokens).toBe(100);
  });

  it('defaults missing fields to safe fallback values', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({ overallConfidence: 0.3 }));

    const result = await client.extractEmailSignals({
      subject: 'Hello',
      body: 'Just looking around',
    });

    expect(result.intent).toBe('unknown');
    expect(result.urgency).toBe('none');
    expect(result.budgetMin).toBeUndefined();
    expect(result.budgetMax).toBeUndefined();
    expect(result.financeStatus).toBeUndefined();
    expect(result.estimatedTimeline).toBeNull();
    expect(result.propertyPreferences).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(result.overallConfidence).toBeCloseTo(0.3);
  });

  it('includes token usage and clamps confidence to 0-1', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      intent: 'invest',
      urgency: 'medium',
      estimatedTimeline: null,
      propertyPreferences: [],
      signals: [],
      overallConfidence: 1.5, // out-of-range — should be clamped to 1
    }), 250, 120);

    const result = await client.extractEmailSignals({
      subject: 'Investment query',
      body: 'Looking for investment properties',
    });

    expect(result.intent).toBe('invest');
    expect(result.overallConfidence).toBe(1);
    expect(result.tokenUsage.inputTokens).toBe(250);
    expect(result.tokenUsage.outputTokens).toBe(120);
  });
});
