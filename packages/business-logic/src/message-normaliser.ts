import type {
  MessageChannel,
  MessageContent,
  MessageMetadata,
  NormalisedInboundMessage,
} from '@realflow/shared';

// ─── Raw Webhook Payloads ────────────────────────────────────────────────

interface RawTwilioSmsPayload {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

interface RawTwilioVoicePayload {
  CallSid: string;
  From: string;
  To: string;
  CallStatus: string;
  CallDuration?: string;
  RecordingUrl?: string;
  TranscriptionText?: string;
}

interface RawMetaMessagingPayload {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
          type: string;
          payload: { url: string };
        }>;
      };
    }>;
  }>;
}

interface RawGmailPushPayload {
  emailAddress: string;
  historyId: string;
}

interface RawWhatsAppPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; caption?: string };
          document?: { id: string; mime_type: string; filename: string };
        }>;
      };
      field: string;
    }>;
  }>;
}

// ─── Message Normaliser ─────────────────────────────────────────────────

/**
 * Normalises raw webhook payloads from different channels into a
 * consistent NormalisedInboundMessage format for the unified inbox.
 *
 * Each channel has its own raw payload format. This class provides
 * a method per channel to transform raw data into normalised messages.
 */
export class MessageNormaliser {
  /**
   * Normalise a Twilio SMS webhook payload.
   */
  static normaliseSms(payload: RawTwilioSmsPayload): NormalisedInboundMessage {
    const attachments = [];
    const numMedia = parseInt(payload.NumMedia ?? '0', 10);

    if (numMedia > 0 && payload.MediaUrl0) {
      attachments.push({
        id: crypto.randomUUID(),
        fileName: 'mms-attachment',
        mimeType: payload.MediaContentType0 ?? 'application/octet-stream',
        sizeBytes: 0,
        url: payload.MediaUrl0,
      });
    }

    const content: MessageContent = {
      text: payload.Body,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const metadata: MessageMetadata = {
      twilioSid: payload.MessageSid,
      phoneFrom: payload.From,
      phoneTo: payload.To,
    };

    return {
      channel: 'sms',
      direction: 'inbound',
      senderPhone: MessageNormaliser.normaliseAustralianPhone(payload.From),
      content,
      metadata,
      externalMessageId: payload.MessageSid,
      receivedAt: new Date().toISOString(),
    };
  }

  /**
   * Normalise a Twilio Voice webhook payload (call completed).
   */
  static normalisePhoneCall(payload: RawTwilioVoicePayload): NormalisedInboundMessage {
    const callOutcome = MessageNormaliser.mapTwilioCallStatus(payload.CallStatus);

    const content: MessageContent = {
      text: payload.TranscriptionText ?? `Phone call (${callOutcome})`,
    };

    const metadata: MessageMetadata = {
      twilioSid: payload.CallSid,
      phoneFrom: payload.From,
      phoneTo: payload.To,
      callDuration: payload.CallDuration ? parseInt(payload.CallDuration, 10) : undefined,
      callRecordingUrl: payload.RecordingUrl,
      callTranscription: payload.TranscriptionText,
      callOutcome,
    };

    return {
      channel: 'phone_call',
      direction: 'inbound',
      senderPhone: MessageNormaliser.normaliseAustralianPhone(payload.From),
      content,
      metadata,
      externalMessageId: payload.CallSid,
      receivedAt: new Date().toISOString(),
    };
  }

  /**
   * Normalise a Meta (Instagram/Facebook) messaging webhook.
   */
  static normaliseMetaMessage(
    payload: RawMetaMessagingPayload,
    channel: 'instagram_dm' | 'facebook_messenger',
  ): NormalisedInboundMessage[] {
    const messages: NormalisedInboundMessage[] = [];

    for (const entry of payload.entry) {
      if (!entry.messaging) continue;

      for (const event of entry.messaging) {
        if (!event.message) continue;

        const attachments = event.message.attachments?.map((att) => ({
          id: crypto.randomUUID(),
          fileName: `${att.type}-attachment`,
          mimeType: att.type === 'image' ? 'image/jpeg' : 'application/octet-stream',
          sizeBytes: 0,
          url: att.payload.url,
        }));

        const content: MessageContent = {
          text: event.message.text,
          attachments: attachments?.length ? attachments : undefined,
        };

        const metadata: MessageMetadata = {
          ...(channel === 'instagram_dm'
            ? { instagramIgsid: event.sender.id }
            : { facebookPsid: event.sender.id }),
        };

        messages.push({
          channel,
          direction: 'inbound',
          senderSocialId: event.sender.id,
          content,
          metadata,
          externalMessageId: event.message.mid,
          receivedAt: new Date(event.timestamp * 1000).toISOString(),
        });
      }
    }

    return messages;
  }

  /**
   * Normalise a WhatsApp Cloud API webhook.
   */
  static normaliseWhatsApp(payload: RawWhatsAppPayload): NormalisedInboundMessage[] {
    const messages: NormalisedInboundMessage[] = [];

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        if (!value.messages) continue;

        const contactInfo = value.contacts?.[0];

        for (const msg of value.messages) {
          const content: MessageContent = {};

          if (msg.type === 'text' && msg.text) {
            content.text = msg.text.body;
          } else if (msg.type === 'image' && msg.image) {
            content.text = msg.image.caption;
            content.attachments = [{
              id: crypto.randomUUID(),
              fileName: 'whatsapp-image',
              mimeType: msg.image.mime_type,
              sizeBytes: 0,
              url: `whatsapp://media/${msg.image.id}`,
            }];
          } else if (msg.type === 'document' && msg.document) {
            content.attachments = [{
              id: crypto.randomUUID(),
              fileName: msg.document.filename,
              mimeType: msg.document.mime_type,
              sizeBytes: 0,
              url: `whatsapp://media/${msg.document.id}`,
            }];
          }

          const metadata: MessageMetadata = {
            whatsappMessageId: msg.id,
            phoneFrom: msg.from,
            phoneTo: value.metadata.display_phone_number,
          };

          messages.push({
            channel: 'whatsapp',
            direction: 'inbound',
            senderPhone: MessageNormaliser.normaliseAustralianPhone(msg.from),
            senderName: contactInfo?.profile.name,
            content,
            metadata,
            externalMessageId: msg.id,
            receivedAt: new Date(parseInt(msg.timestamp, 10) * 1000).toISOString(),
          });
        }
      }
    }

    return messages;
  }

  /**
   * Normalise an inbound email (from Gmail API push notification).
   * Note: This only handles the push notification. The full email content
   * must be fetched separately via the Gmail API using the historyId.
   */
  static normaliseGmailPush(payload: RawGmailPushPayload): {
    emailAddress: string;
    historyId: string;
  } {
    return {
      emailAddress: payload.emailAddress,
      historyId: payload.historyId,
    };
  }

  /**
   * Normalise a fully-fetched email into a NormalisedInboundMessage.
   */
  static normaliseEmail(params: {
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    textBody: string;
    htmlBody?: string;
    messageId: string;
    threadId: string;
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
    }>;
    receivedAt: string;
  }): NormalisedInboundMessage {
    const content: MessageContent = {
      text: params.textBody,
      html: params.htmlBody,
      subject: params.subject,
      attachments: params.attachments?.map((a) => ({
        id: crypto.randomUUID(),
        ...a,
      })),
    };

    const metadata: MessageMetadata = {
      emailMessageId: params.messageId,
      emailThreadId: params.threadId,
      from: params.from,
      to: params.to,
      cc: params.cc,
    };

    // Extract email address from "Name <email>" format
    const emailMatch = params.from.match(/<([^>]+)>/);
    const senderEmail = emailMatch?.[1] ?? params.from;

    // Extract name from "Name <email>" format
    const nameMatch = params.from.match(/^([^<]+)</);
    const senderName = nameMatch?.[1]?.trim();

    return {
      channel: 'email',
      direction: 'inbound',
      senderEmail,
      senderName,
      content,
      metadata,
      externalMessageId: params.messageId,
      receivedAt: params.receivedAt,
    };
  }

  // ─── Utility Methods ─────────────────────────────────────────────────

  /**
   * Normalise an Australian phone number to E.164 format (+614XXXXXXXX).
   * Handles: 0412345678, +61412345678, 61412345678, 0412 345 678
   */
  static normaliseAustralianPhone(phone: string): string {
    // Remove all non-digit characters except leading +
    const cleaned = phone.replace(/[^\d+]/g, '');

    // Already E.164 format
    if (cleaned.startsWith('+61')) return cleaned;

    // Missing + prefix
    if (cleaned.startsWith('61') && cleaned.length >= 11) return `+${cleaned}`;

    // Local format starting with 0
    if (cleaned.startsWith('0') && cleaned.length >= 10) {
      return `+61${cleaned.slice(1)}`;
    }

    // Return as-is if we can't normalise
    return phone;
  }

  /**
   * Map Twilio call status to our CallOutcome enum.
   */
  private static mapTwilioCallStatus(
    status: string,
  ): 'answered' | 'missed' | 'voicemail' | 'no_answer' {
    switch (status) {
      case 'completed':
        return 'answered';
      case 'busy':
      case 'canceled':
        return 'missed';
      case 'no-answer':
        return 'no_answer';
      default:
        return 'no_answer';
    }
  }
}
