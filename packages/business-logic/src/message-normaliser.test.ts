import { describe, it, expect } from 'vitest';
import { MessageNormaliser } from './message-normaliser';

describe('MessageNormaliser', () => {
  describe('normaliseSms', () => {
    it('should normalise a Twilio SMS payload', () => {
      const result = MessageNormaliser.normaliseSms({
        MessageSid: 'SM123',
        From: '+61412345678',
        To: '+61298765432',
        Body: 'Hi, I saw the listing on Domain',
      });

      expect(result.channel).toBe('sms');
      expect(result.direction).toBe('inbound');
      expect(result.senderPhone).toBe('+61412345678');
      expect(result.content.text).toBe('Hi, I saw the listing on Domain');
      expect(result.metadata.twilioSid).toBe('SM123');
      expect(result.externalMessageId).toBe('SM123');
    });

    it('should normalise local AU phone numbers to E.164', () => {
      const result = MessageNormaliser.normaliseSms({
        MessageSid: 'SM456',
        From: '0412345678',
        To: '+61298765432',
        Body: 'Test',
      });

      expect(result.senderPhone).toBe('+61412345678');
    });

    it('should handle MMS attachments', () => {
      const result = MessageNormaliser.normaliseSms({
        MessageSid: 'SM789',
        From: '+61412345678',
        To: '+61298765432',
        Body: 'Check out this property',
        NumMedia: '1',
        MediaUrl0: 'https://example.com/image.jpg',
        MediaContentType0: 'image/jpeg',
      });

      expect(result.content.attachments).toHaveLength(1);
      expect(result.content.attachments![0].mimeType).toBe('image/jpeg');
    });
  });

  describe('normalisePhoneCall', () => {
    it('should normalise a completed call', () => {
      const result = MessageNormaliser.normalisePhoneCall({
        CallSid: 'CA123',
        From: '+61412345678',
        To: '+61298765432',
        CallStatus: 'completed',
        CallDuration: '180',
      });

      expect(result.channel).toBe('phone_call');
      expect(result.metadata.callOutcome).toBe('answered');
      expect(result.metadata.callDuration).toBe(180);
    });

    it('should handle missed calls', () => {
      const result = MessageNormaliser.normalisePhoneCall({
        CallSid: 'CA456',
        From: '+61412345678',
        To: '+61298765432',
        CallStatus: 'busy',
      });

      expect(result.metadata.callOutcome).toBe('missed');
    });
  });

  describe('normaliseMetaMessage', () => {
    it('should normalise an Instagram DM', () => {
      const payload = {
        object: 'instagram',
        entry: [
          {
            id: 'page123',
            time: 1700000000,
            messaging: [
              {
                sender: { id: 'igsid_456' },
                recipient: { id: 'page123' },
                timestamp: 1700000000,
                message: {
                  mid: 'mid_abc',
                  text: 'Love the listing!',
                },
              },
            ],
          },
        ],
      };

      const results = MessageNormaliser.normaliseMetaMessage(payload, 'instagram_dm');

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('instagram_dm');
      expect(results[0].content.text).toBe('Love the listing!');
      expect(results[0].senderSocialId).toBe('igsid_456');
      expect(results[0].metadata.instagramIgsid).toBe('igsid_456');
    });

    it('should normalise a Facebook Messenger message', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page123',
            time: 1700000000,
            messaging: [
              {
                sender: { id: 'psid_789' },
                recipient: { id: 'page123' },
                timestamp: 1700000000,
                message: {
                  mid: 'mid_def',
                  text: 'Is this property still available?',
                },
              },
            ],
          },
        ],
      };

      const results = MessageNormaliser.normaliseMetaMessage(payload, 'facebook_messenger');

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('facebook_messenger');
      expect(results[0].metadata.facebookPsid).toBe('psid_789');
    });
  });

  describe('normaliseWhatsApp', () => {
    it('should normalise a WhatsApp text message', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'waba123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '61298765432',
                    phone_number_id: 'pn123',
                  },
                  contacts: [
                    { profile: { name: 'Jane Smith' }, wa_id: '61412345678' },
                  ],
                  messages: [
                    {
                      id: 'wamid.abc',
                      from: '61412345678',
                      timestamp: '1700000000',
                      type: 'text',
                      text: { body: 'Interested in the Bondi property' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const results = MessageNormaliser.normaliseWhatsApp(payload);

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('whatsapp');
      expect(results[0].content.text).toBe('Interested in the Bondi property');
      expect(results[0].senderName).toBe('Jane Smith');
      expect(results[0].senderPhone).toBe('+61412345678');
    });
  });

  describe('normaliseEmail', () => {
    it('should normalise a standard email', () => {
      const result = MessageNormaliser.normaliseEmail({
        from: 'John Doe <john@example.com>',
        to: ['agent@realflow.com'],
        subject: 'Re: 42 Ocean Street inspection',
        textBody: 'Yes, Saturday at 10am works for me.',
        messageId: '<msg123@mail.example.com>',
        threadId: 'thread456',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result.channel).toBe('email');
      expect(result.senderEmail).toBe('john@example.com');
      expect(result.senderName).toBe('John Doe');
      expect(result.content.subject).toBe('Re: 42 Ocean Street inspection');
      expect(result.metadata.emailThreadId).toBe('thread456');
    });

    it('should handle bare email address (no display name)', () => {
      const result = MessageNormaliser.normaliseEmail({
        from: 'john@example.com',
        to: ['agent@realflow.com'],
        subject: 'Test',
        textBody: 'Test body',
        messageId: '<msg456@mail.example.com>',
        threadId: 'thread789',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result.senderEmail).toBe('john@example.com');
      expect(result.senderName).toBeUndefined();
    });
  });

  describe('normaliseAustralianPhone', () => {
    it('should pass through E.164 format', () => {
      expect(MessageNormaliser.normaliseAustralianPhone('+61412345678')).toBe('+61412345678');
    });

    it('should convert local format', () => {
      expect(MessageNormaliser.normaliseAustralianPhone('0412345678')).toBe('+61412345678');
    });

    it('should handle spaces', () => {
      expect(MessageNormaliser.normaliseAustralianPhone('0412 345 678')).toBe('+61412345678');
    });

    it('should handle 61 prefix without +', () => {
      expect(MessageNormaliser.normaliseAustralianPhone('61412345678')).toBe('+61412345678');
    });
  });
});
