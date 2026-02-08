import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetaSocialClient } from './client';

// ─── Setup ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();

const validConfig = {
  pageAccessToken: 'test-page-token',
  pageId: 'page-123',
  instagramAccountId: 'ig-456',
  apiVersion: 'v19.0',
};

function mockApiResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
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

describe('MetaSocialClient constructor', () => {
  it('creates client with valid config', () => {
    const client = new MetaSocialClient(validConfig);
    expect(client).toBeDefined();
  });

  it('throws on missing pageAccessToken', () => {
    expect(
      () => new MetaSocialClient({ ...validConfig, pageAccessToken: undefined } as never),
    ).toThrow();
  });

  it('works without instagramAccountId', () => {
    const client = new MetaSocialClient({
      pageAccessToken: 'token',
      pageId: 'page-123',
    });
    expect(client).toBeDefined();
  });
});

// ─── postToFacebook ────────────────────────────────────────────────

describe('MetaSocialClient.postToFacebook', () => {
  it('posts a text message to feed', async () => {
    const client = new MetaSocialClient(validConfig);
    mockApiResponse({ id: 'post-789' });

    const result = await client.postToFacebook({ message: 'New listing!' });

    expect(result.id).toBe('post-789');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/page-123/feed');
    expect(url).toContain('access_token=test-page-token');
    expect(options?.method).toBe('POST');
    const body = JSON.parse(options?.body as string);
    expect(body.message).toBe('New listing!');
  });

  it('posts a link to feed', async () => {
    const client = new MetaSocialClient(validConfig);
    mockApiResponse({ id: 'post-link' });

    await client.postToFacebook({
      message: 'Check out this property',
      link: 'https://realflow.com/property/123',
    });

    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/page-123/feed');
    const body = JSON.parse(options?.body as string);
    expect(body.link).toBe('https://realflow.com/property/123');
  });

  it('posts a photo when photoUrl is provided', async () => {
    const client = new MetaSocialClient(validConfig);
    mockApiResponse({ id: 'photo-post' });

    await client.postToFacebook({
      message: 'Beautiful home',
      photoUrl: 'https://example.com/photo.jpg',
    });

    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/page-123/photos');
    const body = JSON.parse(options?.body as string);
    expect(body.url).toBe('https://example.com/photo.jpg');
    expect(body.message).toBe('Beautiful home');
  });

  it('throws on API error', async () => {
    const client = new MetaSocialClient(validConfig);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    await expect(
      client.postToFacebook({ message: 'test' }),
    ).rejects.toThrow('Meta API error: 403 Forbidden');
  });
});

// ─── postToInstagram ───────────────────────────────────────────────

describe('MetaSocialClient.postToInstagram', () => {
  it('creates media container then publishes', async () => {
    const client = new MetaSocialClient(validConfig);
    // Step 1: create container
    mockApiResponse({ id: 'container-123' });
    // Step 2: publish
    mockApiResponse({ id: 'ig-post-456' });

    const result = await client.postToInstagram({
      imageUrl: 'https://example.com/listing.jpg',
      caption: 'Stunning 3-bed in Paddington',
    });

    expect(result.id).toBe('ig-post-456');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify step 1: create container
    const [url1, opts1] = mockFetch.mock.calls[0]!;
    expect(url1).toContain('/ig-456/media');
    const body1 = JSON.parse(opts1?.body as string);
    expect(body1.image_url).toBe('https://example.com/listing.jpg');
    expect(body1.caption).toBe('Stunning 3-bed in Paddington');

    // Verify step 2: publish
    const [url2, opts2] = mockFetch.mock.calls[1]!;
    expect(url2).toContain('/ig-456/media_publish');
    const body2 = JSON.parse(opts2?.body as string);
    expect(body2.creation_id).toBe('container-123');
  });

  it('throws if Instagram account ID is not configured', async () => {
    const client = new MetaSocialClient({
      pageAccessToken: 'token',
      pageId: 'page-123',
    });

    await expect(
      client.postToInstagram({ imageUrl: 'https://example.com/img.jpg', caption: 'test' }),
    ).rejects.toThrow('Instagram account ID not configured');
  });
});

// ─── getLeadAdLeads ────────────────────────────────────────────────

describe('MetaSocialClient.getLeadAdLeads', () => {
  it('calls correct endpoint', async () => {
    const client = new MetaSocialClient(validConfig);
    mockApiResponse({ data: [{ id: 'lead-1' }] });

    const result = await client.getLeadAdLeads('form-abc');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/form-abc/leads');
    expect(result).toEqual({ data: [{ id: 'lead-1' }] });
  });
});

// ─── getConversations ──────────────────────────────────────────────

describe('MetaSocialClient.getConversations', () => {
  it('fetches conversations with default limit', async () => {
    const client = new MetaSocialClient(validConfig);
    mockApiResponse({ data: [] });

    await client.getConversations();

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('/page-123/conversations');
    expect(url).toContain('limit=25');
  });

  it('accepts custom limit', async () => {
    const client = new MetaSocialClient(validConfig);
    mockApiResponse({ data: [] });

    await client.getConversations(10);

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain('limit=10');
  });
});
