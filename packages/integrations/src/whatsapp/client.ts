import { z } from 'zod';

// ─── Configuration ──────────────────────────────────────────────────────

const WhatsAppConfigSchema = z.object({
  accessToken: z.string(),
  phoneNumberId: z.string(),
  businessAccountId: z.string(),
  apiVersion: z.string().default('v19.0'),
  webhookVerifyToken: z.string(),
});

type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>;

// ─── WhatsApp API Types ─────────────────────────────────────────────────

interface WhatsAppSendResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document';
    text?: string;
    image?: { link: string };
    document?: { link: string; filename: string };
  }>;
}

/**
 * WhatsApp Business Platform (Cloud API) client.
 *
 * Handles:
 * - Sending text messages (within 24hr window)
 * - Sending template messages (anytime, pre-approved by Meta)
 * - Sending media messages (images, documents)
 * - Webhook verification
 * - Message status tracking
 *
 * Pricing: Conversation-based. First 1,000 conversations/month free.
 * Rate limits: 80 messages/second, 1,000 unique recipients/24hr (Tier 1).
 */
export class WhatsAppClient {
  private config: WhatsAppConfig;
  private baseUrl: string;

  constructor(config: WhatsAppConfig) {
    this.config = WhatsAppConfigSchema.parse(config);
    this.baseUrl = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}`;
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

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Send a text message to a WhatsApp number.
   * Only works within 24hrs of the user's last message (messaging window).
   */
  async sendTextMessage(params: {
    to: string;
    text: string;
    previewUrl?: boolean;
  }): Promise<WhatsAppSendResponse> {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.to,
        type: 'text',
        text: {
          preview_url: params.previewUrl ?? false,
          body: params.text,
        },
      }),
    });
  }

  /**
   * Send a template message (can be sent anytime, must be pre-approved).
   * Used for notifications, follow-ups, and messages outside the 24hr window.
   */
  async sendTemplateMessage(params: {
    to: string;
    templateName: string;
    languageCode: string;
    components?: WhatsAppTemplateComponent[];
  }): Promise<WhatsAppSendResponse> {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.to,
        type: 'template',
        template: {
          name: params.templateName,
          language: { code: params.languageCode },
          components: params.components,
        },
      }),
    });
  }

  /**
   * Send an image message (e.g., property photos).
   */
  async sendImageMessage(params: {
    to: string;
    imageUrl: string;
    caption?: string;
  }): Promise<WhatsAppSendResponse> {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.to,
        type: 'image',
        image: {
          link: params.imageUrl,
          caption: params.caption,
        },
      }),
    });
  }

  /**
   * Send a document message (e.g., property reports, contracts).
   */
  async sendDocumentMessage(params: {
    to: string;
    documentUrl: string;
    filename: string;
    caption?: string;
  }): Promise<WhatsAppSendResponse> {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.to,
        type: 'document',
        document: {
          link: params.documentUrl,
          filename: params.filename,
          caption: params.caption,
        },
      }),
    });
  }

  /**
   * Mark a message as read (sends read receipt to the sender).
   */
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
  }

  /**
   * Verify a webhook subscription request from Meta.
   * Called when Meta sends a GET request to verify the webhook URL.
   */
  static verifyWebhook(params: {
    mode: string;
    token: string;
    challenge: string;
    expectedToken: string;
  }): { valid: boolean; challenge?: string } {
    if (
      params.mode === 'subscribe' &&
      params.token === params.expectedToken
    ) {
      return { valid: true, challenge: params.challenge };
    }
    return { valid: false };
  }
}
