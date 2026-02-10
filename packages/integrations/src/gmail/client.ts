import { z } from 'zod';

// ─── Configuration ──────────────────────────────────────────────────────

const GmailConfigSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  clientId: z.string(),
  clientSecret: z.string(),
});

type GmailConfig = z.infer<typeof GmailConfigSchema>;

// ─── Gmail API Response Types ───────────────────────────────────────────

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    mimeType: string;
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string; size: number };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string; size: number; attachmentId?: string };
      filename?: string;
      headers?: Array<{ name: string; value: string }>;
    }>;
  };
  internalDate: string;
}

interface GmailMessageList {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate: number;
}

interface GmailThread {
  id: string;
  messages: GmailMessage[];
}

interface GmailWatchResponse {
  historyId: string;
  expiration: string;
}

interface GmailHistoryList {
  history?: Array<{
    id: string;
    messagesAdded?: Array<{ message: { id: string; threadId: string; labelIds: string[] } }>;
  }>;
  nextPageToken?: string;
  historyId: string;
}

interface ParsedEmail {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  receivedAt: string;
  messageId: string;
  attachments: Array<{
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    attachmentId: string;
  }>;
}

/**
 * Gmail API client for reading and sending emails.
 * Used for bidirectional email sync in the unified inbox.
 *
 * Key features:
 * - Read inbox messages
 * - Send emails (appears in agent's Sent folder)
 * - Watch for new emails via Pub/Sub push
 * - Fetch email history for sync
 */
export class GmailClient {
  private config: GmailConfig;
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1';

  constructor(config: GmailConfig) {
    this.config = GmailConfigSchema.parse(config);
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      throw new Error('Gmail token expired — needs refresh');
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gmail API error: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * List messages in the user's inbox.
   */
  async listMessages(params?: {
    query?: string;
    maxResults?: number;
    pageToken?: string;
    labelIds?: string[];
  }): Promise<GmailMessageList> {
    const searchParams = new URLSearchParams();
    if (params?.query) searchParams.set('q', params.query);
    if (params?.maxResults) searchParams.set('maxResults', String(params.maxResults));
    if (params?.pageToken) searchParams.set('pageToken', params.pageToken);
    if (params?.labelIds) {
      for (const label of params.labelIds) {
        searchParams.append('labelIds', label);
      }
    }

    const queryString = searchParams.toString();
    return this.request(`/users/me/messages${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get a single message with full content.
   */
  async getMessage(messageId: string): Promise<GmailMessage> {
    return this.request(`/users/me/messages/${messageId}?format=full`);
  }

  /**
   * Get a thread with all messages.
   */
  async getThread(threadId: string): Promise<GmailThread> {
    return this.request(`/users/me/threads/${threadId}?format=full`);
  }

  /**
   * Send an email message.
   * The raw message must be base64url encoded RFC 2822 format.
   */
  async sendMessage(params: {
    to: string[];
    cc?: string[];
    subject: string;
    textBody: string;
    htmlBody?: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string;
  }): Promise<{ id: string; threadId: string }> {
    const raw = GmailClient.buildRawEmail(params);
    const encodedRaw = GmailClient.base64urlEncode(raw);

    return this.request('/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        raw: encodedRaw,
        threadId: params.threadId,
      }),
    });
  }

  /**
   * Set up push notifications for new emails via Google Cloud Pub/Sub.
   * The topicName should be a fully-qualified Pub/Sub topic.
   */
  async watchInbox(topicName: string, labelIds?: string[]): Promise<GmailWatchResponse> {
    return this.request('/users/me/watch', {
      method: 'POST',
      body: JSON.stringify({
        topicName,
        labelIds: labelIds ?? ['INBOX'],
        labelFilterBehavior: 'INCLUDE',
      }),
    });
  }

  /**
   * Stop push notifications.
   */
  async stopWatch(): Promise<void> {
    await this.request('/users/me/stop', { method: 'POST' });
  }

  /**
   * Get history of changes since a given historyId.
   * Used to process push notification callbacks.
   */
  async getHistory(
    startHistoryId: string,
    historyTypes?: string[],
  ): Promise<GmailHistoryList> {
    const params = new URLSearchParams({ startHistoryId });
    if (historyTypes) {
      for (const type of historyTypes) {
        params.append('historyTypes', type);
      }
    }
    return this.request(`/users/me/history?${params.toString()}`);
  }

  /**
   * Modify message labels (e.g., mark as read).
   */
  async modifyLabels(
    messageId: string,
    addLabels?: string[],
    removeLabels?: string[],
  ): Promise<GmailMessage> {
    return this.request(`/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({
        addLabelIds: addLabels ?? [],
        removeLabelIds: removeLabels ?? [],
      }),
    });
  }

  /**
   * Mark a message as read (remove UNREAD label).
   */
  async markAsRead(messageId: string): Promise<GmailMessage> {
    return this.modifyLabels(messageId, undefined, ['UNREAD']);
  }

  /**
   * Parse a Gmail API message into a structured format.
   */
  static parseMessage(msg: GmailMessage): ParsedEmail {
    const headers = msg.payload.headers;
    const getHeader = (name: string): string =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

    const from = getHeader('From');
    const to = getHeader('To').split(',').map((s) => s.trim()).filter(Boolean);
    const cc = getHeader('Cc').split(',').map((s) => s.trim()).filter(Boolean);
    const subject = getHeader('Subject');
    const messageId = getHeader('Message-ID') || msg.id;

    let textBody = '';
    let htmlBody: string | undefined;
    const attachments: ParsedEmail['attachments'] = [];

    // Extract body from parts
    if (msg.payload.parts) {
      for (const part of msg.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          textBody = GmailClient.base64urlDecode(part.body.data);
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = GmailClient.base64urlDecode(part.body.data);
        } else if (part.filename && part.body?.attachmentId) {
          attachments.push({
            fileName: part.filename,
            mimeType: part.mimeType,
            sizeBytes: part.body.size ?? 0,
            attachmentId: part.body.attachmentId,
          });
        }
      }
    } else if (msg.payload.body?.data) {
      // Single part message
      if (msg.payload.mimeType === 'text/html') {
        htmlBody = GmailClient.base64urlDecode(msg.payload.body.data);
      } else {
        textBody = GmailClient.base64urlDecode(msg.payload.body.data);
      }
    }

    return {
      id: msg.id,
      threadId: msg.threadId,
      from,
      to,
      cc,
      subject,
      textBody,
      htmlBody,
      messageId,
      receivedAt: new Date(parseInt(msg.internalDate, 10)).toISOString(),
      attachments,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Build an RFC 2822 email message.
   */
  private static buildRawEmail(params: {
    to: string[];
    cc?: string[];
    subject: string;
    textBody: string;
    htmlBody?: string;
    inReplyTo?: string;
    references?: string;
  }): string {
    const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`;
    const lines: string[] = [];

    lines.push(`To: ${params.to.join(', ')}`);
    if (params.cc?.length) lines.push(`Cc: ${params.cc.join(', ')}`);
    lines.push(`Subject: ${params.subject}`);
    if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`);
    if (params.references) lines.push(`References: ${params.references}`);
    lines.push('MIME-Version: 1.0');

    if (params.htmlBody) {
      lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      lines.push('');
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('');
      lines.push(params.textBody);
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('');
      lines.push(params.htmlBody);
      lines.push(`--${boundary}--`);
    } else {
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('');
      lines.push(params.textBody);
    }

    return lines.join('\r\n');
  }

  private static base64urlEncode(str: string): string {
    return Buffer.from(str, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private static base64urlDecode(str: string): string {
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  }
}
