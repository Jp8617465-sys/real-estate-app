import { z } from 'zod';

// ─── Configuration ──────────────────────────────────────────────────────

const TwilioConfigSchema = z.object({
  accountSid: z.string(),
  authToken: z.string(),
  messagingServiceSid: z.string().optional(),
  fromNumber: z.string(),
});

type TwilioConfig = z.infer<typeof TwilioConfigSchema>;

// ─── Twilio API Types ───────────────────────────────────────────────────

interface TwilioMessageResponse {
  sid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  date_created: string;
  date_sent: string | null;
  error_code: number | null;
  error_message: string | null;
}

interface TwilioCallResponse {
  sid: string;
  status: string;
  to: string;
  from: string;
  duration: string | null;
  start_time: string | null;
  end_time: string | null;
}

/**
 * Twilio client for SMS messaging and voice calls.
 *
 * Handles:
 * - Sending SMS/MMS messages
 * - Initiating voice calls (click-to-call)
 * - Webhook signature validation
 * - Message status tracking
 */
export class TwilioClient {
  private config: TwilioConfig;
  private baseUrl: string;

  constructor(config: TwilioConfig) {
    this.config = TwilioConfigSchema.parse(config);
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}`;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.config.accountSid}:${this.config.authToken}`,
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Twilio API error: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Send an SMS message.
   */
  async sendSms(params: {
    to: string;
    body: string;
    mediaUrl?: string;
    statusCallback?: string;
  }): Promise<TwilioMessageResponse> {
    const formData = new URLSearchParams();
    formData.set('To', params.to);
    formData.set('Body', params.body);

    if (this.config.messagingServiceSid) {
      formData.set('MessagingServiceSid', this.config.messagingServiceSid);
    } else {
      formData.set('From', this.config.fromNumber);
    }

    if (params.mediaUrl) {
      formData.set('MediaUrl', params.mediaUrl);
    }

    if (params.statusCallback) {
      formData.set('StatusCallback', params.statusCallback);
    }

    return this.request('/Messages.json', {
      method: 'POST',
      body: formData.toString(),
    });
  }

  /**
   * Initiate an outbound voice call (click-to-call).
   * The twimlUrl should point to TwiML instructions for the call.
   */
  async initiateCall(params: {
    to: string;
    twimlUrl: string;
    statusCallback?: string;
    record?: boolean;
    recordingStatusCallback?: string;
  }): Promise<TwilioCallResponse> {
    const formData = new URLSearchParams();
    formData.set('To', params.to);
    formData.set('From', this.config.fromNumber);
    formData.set('Url', params.twimlUrl);

    if (params.statusCallback) {
      formData.set('StatusCallback', params.statusCallback);
      formData.set('StatusCallbackEvent', 'initiated ringing answered completed');
    }

    if (params.record) {
      formData.set('Record', 'true');
      if (params.recordingStatusCallback) {
        formData.set('RecordingStatusCallback', params.recordingStatusCallback);
      }
    }

    return this.request('/Calls.json', {
      method: 'POST',
      body: formData.toString(),
    });
  }

  /**
   * Get message delivery status.
   */
  async getMessageStatus(messageSid: string): Promise<TwilioMessageResponse> {
    return this.request(`/Messages/${messageSid}.json`);
  }

  /**
   * Get call details.
   */
  async getCallDetails(callSid: string): Promise<TwilioCallResponse> {
    return this.request(`/Calls/${callSid}.json`);
  }

  /**
   * Validate a Twilio webhook signature for security.
   * This should be called on every inbound webhook to verify
   * the request actually came from Twilio.
   */
  static validateWebhookSignature(params: {
    signature: string;
    url: string;
    body: Record<string, string>;
    authToken: string;
  }): boolean {
    // Twilio signs webhooks using HMAC-SHA1
    // In production, use the twilio package's validateRequest
    // This is a simplified implementation for the architecture
    const { signature, url, body, authToken } = params;

    // Build the data string: URL + sorted params
    let data = url;
    const sortedKeys = Object.keys(body).sort();
    for (const key of sortedKeys) {
      data += key + body[key];
    }

    // HMAC-SHA1 hash
    const crypto = require('crypto') as typeof import('crypto');
    const expected = crypto
      .createHmac('sha1', authToken)
      .update(data)
      .digest('base64');

    return signature === expected;
  }
}
