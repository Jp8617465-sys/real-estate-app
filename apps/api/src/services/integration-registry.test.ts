import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Mock Integration Clients ──────────────────────────────────────

vi.mock('@realflow/integrations', () => ({
  GmailClient: vi.fn().mockImplementation((config: Record<string, unknown>) => ({
    config,
    sendMessage: vi.fn(),
  })),
  TwilioClient: vi.fn().mockImplementation((config: Record<string, unknown>) => ({
    config,
    sendSms: vi.fn(),
  })),
  WhatsAppClient: vi.fn().mockImplementation((config: Record<string, unknown>) => ({
    config,
    sendTextMessage: vi.fn(),
  })),
  MetaSocialClient: vi.fn().mockImplementation((config: Record<string, unknown>) => ({
    config,
    postToFacebook: vi.fn(),
    postToInstagram: vi.fn(),
  })),
}));

// ─── Import after mocks ───────────────────────────────────────────

import { IntegrationRegistry } from './integration-registry';
import type { FastifyRequest } from 'fastify';

const mockRequest = {} as FastifyRequest;
const userId = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Gmail Client Tests ────────────────────────────────────────────

describe('IntegrationRegistry.getGmailClient', () => {
  it('returns a GmailClient when OAuth token exists', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                access_token: 'gmail-access-token',
                refresh_token: 'gmail-refresh-token',
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const registry = new IntegrationRegistry(mockRequest, userId);
    const client = await registry.getGmailClient();

    expect(client).not.toBeNull();
  });

  it('returns null when no Gmail token exists', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      }),
    });

    const registry = new IntegrationRegistry(mockRequest, userId);
    const client = await registry.getGmailClient();

    expect(client).toBeNull();
  });
});

// ─── Twilio Client Tests ───────────────────────────────────────────

describe('IntegrationRegistry.getTwilioClient', () => {
  it('returns a TwilioClient when integration connection exists', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  config: {
                    accountSid: 'AC123',
                    authToken: 'auth-token',
                    fromNumber: '+61400000000',
                  },
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    const registry = new IntegrationRegistry(mockRequest, userId);
    const client = await registry.getTwilioClient();

    expect(client).not.toBeNull();
  });

  it('returns null when no Twilio connection exists', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        }),
      }),
    });

    const registry = new IntegrationRegistry(mockRequest, userId);
    const client = await registry.getTwilioClient();

    expect(client).toBeNull();
  });
});

// ─── Meta Client Tests ─────────────────────────────────────────────

describe('IntegrationRegistry.getMetaClient', () => {
  it('returns null when no Meta token exists', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      }),
    });

    const registry = new IntegrationRegistry(mockRequest, userId);
    const client = await registry.getMetaClient();

    expect(client).toBeNull();
  });
});
