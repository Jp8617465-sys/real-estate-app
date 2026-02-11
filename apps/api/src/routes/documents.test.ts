import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase ─────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockStorage = {
  from: vi.fn().mockReturnValue({
    createSignedUploadUrl: vi.fn(),
    createSignedUrl: vi.fn(),
    upload: vi.fn(),
  }),
};
const mockAuth = {
  getUser: vi.fn().mockResolvedValue({
    data: { user: { id: 'user-1' } },
  }),
};

const mockSupabase = {
  from: mockFrom,
  storage: mockStorage,
  auth: mockAuth,
};

vi.mock('../middleware/supabase', () => ({
  createSupabaseClient: () => mockSupabase,
}));

// ─── Import after mocks ───────────────────────────────────────────

import Fastify from 'fastify';
import { documentRoutes } from './documents';

// ─── Test setup ───────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(documentRoutes, { prefix: '/api/v1/documents' });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
  });
});

// ─── GET / - List documents ──────────────────────────────────────

describe('GET /api/v1/documents', () => {
  it('returns document list', async () => {
    const documents = [
      { id: '1', name: 'Contract.pdf', category: 'contracts' },
      { id: '2', name: 'Report.pdf', category: 'inspections' },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: documents, error: null }),
            then: (r: Function) => r({ data: documents, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/documents',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toHaveLength(2);
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'DB connection failed' },
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/documents',
    });

    expect(response.statusCode).toBe(500);
  });
});

// ─── GET /:id - Get single document ─────────────────────────────

describe('GET /api/v1/documents/:id', () => {
  it('returns a single document', async () => {
    const doc = { id: '1', name: 'Contract.pdf', category: 'contracts' };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: doc, error: null }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/documents/1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.name).toBe('Contract.pdf');
  });

  it('returns 404 when document not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found', code: 'PGRST116' },
            }),
          }),
        }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/documents/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── POST / - Create document ─────────────────────────────────────

describe('POST /api/v1/documents', () => {
  const validBody = {
    name: 'Contract.pdf',
    filePath: 'documents/general/123_Contract.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    category: 'contracts',
  };

  it('creates a document successfully', async () => {
    const insertMock = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-1', ...validBody },
            error: null,
          }),
        }),
      }),
    };

    mockFrom.mockReturnValue(insertMock);

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/documents',
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.data.name).toBe('Contract.pdf');
  });

  it('returns 400 for invalid input', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/documents',
      payload: { name: 'Contract.pdf' }, // Missing required fields
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── POST /upload-url - Generate signed upload URL ───────────────

describe('POST /api/v1/documents/upload-url', () => {
  it('returns a signed upload URL', async () => {
    mockStorage.from.mockReturnValue({
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        data: {
          signedUrl: 'https://example.com/signed-url',
          path: 'documents/general/123_file.pdf',
          token: 'upload-token',
        },
        error: null,
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/upload-url',
      payload: {
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.signedUrl).toBeDefined();
  });

  it('returns 400 for invalid input', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/documents/upload-url',
      payload: {}, // Missing required fields
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── GET /:id/download-url - Generate signed download URL ────────

describe('GET /api/v1/documents/:id/download-url', () => {
  it('returns a signed download URL', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { file_path: 'documents/general/file.pdf' },
              error: null,
            }),
          }),
        }),
      }),
    });

    mockStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/download-url' },
        error: null,
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/documents/1/download-url',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.signedUrl).toBeDefined();
  });

  it('returns 404 when document not found', async () => {
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

    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/documents/nonexistent/download-url',
    });

    expect(response.statusCode).toBe(404);
  });
});

// ─── DELETE /:id - Soft delete document ──────────────────────────

describe('DELETE /api/v1/documents/:id', () => {
  it('soft deletes a document', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/documents/1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
  });

  it('returns 500 on delete error', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      }),
    });

    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/documents/1',
    });

    expect(response.statusCode).toBe(500);
  });
});
