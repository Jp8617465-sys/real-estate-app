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

// ─── suggestBriefRefinements ──────────────────────────────────────

describe('AnthropicClient.suggestBriefRefinements', () => {
  it('returns suggestions, completeness score, and missing fields', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      suggestions: [
        {
          field: 'suburbs',
          currentValue: 'Bondi',
          suggestedValue: 'Bondi, Coogee, Bronte',
          reason: 'Expanding search to nearby beachside suburbs increases options',
          confidence: 0.85,
        },
      ],
      completenessScore: 72,
      missingFields: ['investorCriteria', 'maxCommute'],
    }));

    const result = await client.suggestBriefRefinements({
      brief: {
        mustHaves: ['pool', 'garden'],
        niceToHaves: ['ocean views'],
        dealBreakers: ['main road'],
        suburbs: ['Bondi'],
        propertyTypes: ['house'],
        budget: { min: 1800000, max: 2200000 },
      },
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.field).toBe('suburbs');
    expect(result.completenessScore).toBe(72);
    expect(result.missingFields).toContain('investorCriteria');
    expect(result.tokenUsage).toBeDefined();
  });

  it('clamps completeness score to 0-100', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      suggestions: [],
      completenessScore: -20,
      missingFields: [],
    }));

    const result = await client.suggestBriefRefinements({
      brief: {
        mustHaves: [],
        niceToHaves: [],
        dealBreakers: [],
        suburbs: [],
        propertyTypes: [],
        budget: { min: 0, max: 0 },
      },
    });

    expect(result.completenessScore).toBe(0);
  });

  it('defaults missing fields to safe values', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({}));

    const result = await client.suggestBriefRefinements({
      brief: {
        mustHaves: [],
        niceToHaves: [],
        dealBreakers: [],
        suburbs: [],
        propertyTypes: [],
        budget: { min: 0, max: 0 },
      },
    });

    expect(result.suggestions).toEqual([]);
    expect(result.completenessScore).toBe(50);
    expect(result.missingFields).toEqual([]);
  });

  it('includes search history context when provided', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      suggestions: [
        {
          field: 'budget.max',
          suggestedValue: '2500000',
          reason: 'Most rejections due to budget — consider increasing',
          confidence: 0.9,
        },
      ],
      completenessScore: 80,
      missingFields: [],
    }));

    const result = await client.suggestBriefRefinements({
      brief: {
        mustHaves: ['pool'],
        niceToHaves: [],
        dealBreakers: [],
        suburbs: ['Mosman'],
        propertyTypes: ['house'],
        budget: { min: 1800000, max: 2200000 },
      },
      searchHistory: {
        rejectedProperties: 15,
        averageScore: 55,
        commonRejectionReasons: ['Over budget', 'Not in preferred suburb'],
      },
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.field).toBe('budget.max');
  });
});

// ─── generateDailyActionInsights ──────────────────────────────────

describe('AnthropicClient.generateDailyActionInsights', () => {
  it('returns empty array for empty candidates', async () => {
    const client = new AnthropicClient(validConfig);
    const result = await client.generateDailyActionInsights([]);

    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns indexed subtitles for candidates', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      items: [
        { index: 0, subtitle: 'Pre-approval expiring in 5 days' },
        { index: 1, subtitle: 'High-value lead waiting 3 days for callback' },
      ],
    }));

    const result = await client.generateDailyActionInsights([
      { category: 'follow_up', title: 'Follow up', contactName: 'Sarah Smith', daysOverdue: 5, compositeScore: 85 },
      { category: 'new_lead', title: 'Call back', contactName: 'Mike Jones', daysUntilDeadline: 1, compositeScore: 90 },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]?.index).toBe(0);
    expect(result[0]?.subtitle).toBe('Pre-approval expiring in 5 days');
    expect(result[0]?.tokenUsage).toBeDefined();
  });

  it('handles missing items in response gracefully', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({}));

    const result = await client.generateDailyActionInsights([
      { category: 'task', title: 'Test', contactName: 'Test', compositeScore: 50 },
    ]);

    expect(result).toEqual([]);
  });
});

// ─── generateSequenceContent ──────────────────────────────────────

describe('AnthropicClient.generateSequenceContent', () => {
  it('returns subject, body, and tone for email sequence', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      subject: 'Quick update on your property search',
      body: 'Hi Sarah, just a quick update on properties matching your brief this week.',
      suggestedTone: 'friendly',
    }));

    const result = await client.generateSequenceContent({
      stepAction: 'send_email',
      stepLabel: 'Weekly Update',
      dayOffset: 7,
      contactContext: { name: 'Sarah', pipelineStage: 'active-search', source: 'domain' },
      sequenceName: 'Weekly Update Sequence',
    });

    expect(result.subject).toBe('Quick update on your property search');
    expect(result.body).toContain('Sarah');
    expect(result.suggestedTone).toBe('friendly');
    expect(result.tokenUsage).toBeDefined();
  });

  it('defaults to professional tone when not specified in response', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      body: 'Update message',
    }));

    const result = await client.generateSequenceContent({
      stepAction: 'send_sms',
      dayOffset: 3,
      contactContext: { name: 'Test' },
      sequenceName: 'Check-in Sequence',
    });

    expect(result.suggestedTone).toBe('professional');
    expect(result.body).toBe('Update message');
    expect(result.subject).toBeUndefined();
  });
});

// ─── generateSearchNarrative ──────────────────────────────────────

describe('AnthropicClient.generateSearchNarrative', () => {
  it('returns narrative text (not JSON) and token usage', async () => {
    const client = new AnthropicClient(validConfig);
    const narrativeText = 'Over the past fortnight, we reviewed 8 new properties across Bondi and Coogee. Three properties scored above 80 and warrant your attention.';
    mockAnthropicResponse(narrativeText, 400, 200);

    const result = await client.generateSearchNarrative({
      clientName: 'Sarah Smith',
      briefSummary: 'Looking for 3-4 bed house in Bondi or Coogee, $1.8M-$2.2M',
      properties: [
        { address: '42 Ocean St, Bondi NSW 2026', score: 88, status: 'inspection_booked' },
        { address: '10 Beach Rd, Coogee NSW 2034', score: 72, status: 'new' },
      ],
      totalSearched: 8,
    });

    expect(result.narrative).toBe(narrativeText);
    expect(result.tokenUsage.inputTokens).toBe(400);
    expect(result.tokenUsage.outputTokens).toBe(200);
    expect(result.tokenUsage.estimatedCostAud).toBeGreaterThan(0);
  });

  it('trims whitespace from narrative', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse('  Some narrative with whitespace  ');

    const result = await client.generateSearchNarrative({
      clientName: 'Test',
      briefSummary: 'Looking for property in Sydney',
      properties: [],
      totalSearched: 0,
    });

    expect(result.narrative).toBe('Some narrative with whitespace');
  });
});

// ─── Retry Logic (429 and 529) ────────────────────────────────────

describe('AnthropicClient retry logic', () => {
  it('retries on 529 overloaded and succeeds', async () => {
    const client = new AnthropicClient({ ...validConfig, maxRetries: 2, retryBaseDelayMs: 0 });

    mockErrorResponse(529, 'Overloaded', 'overloaded_error');
    mockAnthropicResponse(JSON.stringify({
      featureScore: 65,
      features: [],
      dealBreakerFlags: [],
      summary: 'Recovered from overload',
    }));

    const result = await client.analyzePropertyMatch({
      listingDescription: 'Test',
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: [],
    });

    expect(result.featureScore).toBe(65);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 500 server error', async () => {
    const client = new AnthropicClient({ ...validConfig, maxRetries: 3 });
    mockErrorResponse(500, 'Internal Server Error', 'server_error');

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

// ─── featureScore edge cases ──────────────────────────────────────

describe('AnthropicClient.analyzePropertyMatch edge cases', () => {
  it('clamps negative featureScore to 0', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      featureScore: -10,
      features: [],
      dealBreakerFlags: [],
      summary: 'No match',
    }));

    const result = await client.analyzePropertyMatch({
      listingDescription: 'Empty lot',
      mustHaves: ['house'],
      niceToHaves: [],
      dealBreakers: [],
    });

    expect(result.featureScore).toBe(0);
  });

  it('rounds featureScore to integer', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      featureScore: 73.7,
      features: [],
      dealBreakerFlags: [],
      summary: 'Partial match',
    }));

    const result = await client.analyzePropertyMatch({
      listingDescription: 'House with garden',
      mustHaves: ['garden'],
      niceToHaves: [],
      dealBreakers: [],
    });

    expect(result.featureScore).toBe(74);
    expect(Number.isInteger(result.featureScore)).toBe(true);
  });

  it('handles deal breaker flags from response', async () => {
    const client = new AnthropicClient(validConfig);
    mockAnthropicResponse(JSON.stringify({
      featureScore: 20,
      features: [],
      dealBreakerFlags: ['On main road', 'Near flood zone'],
      summary: 'Deal breakers identified',
    }));

    const result = await client.analyzePropertyMatch({
      listingDescription: 'House on busy road near creek',
      mustHaves: [],
      niceToHaves: [],
      dealBreakers: ['main road', 'flood zone'],
    });

    expect(result.dealBreakerFlags).toHaveLength(2);
    expect(result.dealBreakerFlags).toContain('On main road');
    expect(result.dealBreakerFlags).toContain('Near flood zone');
  });
});
