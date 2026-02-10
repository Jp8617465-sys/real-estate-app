import { describe, it, expect } from 'vitest';
import {
  ConversationMessageSchema,
  CreateConversationMessageSchema,
  MessageChannelSchema,
  InboxFilterSchema,
  SendMessageRequestSchema,
  ContactChannelsSchema,
  NormalisedInboundMessageSchema,
} from './conversation';

describe('Conversation Types', () => {
  describe('MessageChannelSchema', () => {
    it('should validate all channel types', () => {
      const channels = [
        'email', 'sms', 'phone_call', 'whatsapp', 'instagram_dm',
        'facebook_messenger', 'domain_enquiry', 'rea_enquiry',
        'linkedin', 'internal_note', 'portal_notification',
      ];

      for (const channel of channels) {
        expect(MessageChannelSchema.parse(channel)).toBe(channel);
      }
    });

    it('should reject invalid channels', () => {
      expect(() => MessageChannelSchema.parse('telegram')).toThrow();
    });
  });

  describe('ConversationMessageSchema', () => {
    it('should validate a complete message', () => {
      const message = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        channel: 'email',
        direction: 'inbound',
        contactId: '550e8400-e29b-41d4-a716-446655440001',
        agentId: '550e8400-e29b-41d4-a716-446655440002',
        content: {
          text: 'Hello, I am interested in the property.',
          subject: 'Property Enquiry',
        },
        metadata: {
          emailMessageId: '<msg123@mail.example.com>',
          from: 'buyer@example.com',
          to: ['agent@realflow.com'],
        },
        status: 'delivered',
        isRead: false,
        isDeleted: false,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const parsed = ConversationMessageSchema.parse(message);
      expect(parsed.channel).toBe('email');
      expect(parsed.content.text).toBe('Hello, I am interested in the property.');
    });
  });

  describe('CreateConversationMessageSchema', () => {
    it('should validate a create message without id/timestamps', () => {
      const message = {
        channel: 'sms',
        direction: 'outbound',
        contactId: '550e8400-e29b-41d4-a716-446655440001',
        agentId: '550e8400-e29b-41d4-a716-446655440002',
        content: { text: 'Hi! Just confirming our inspection tomorrow at 10am.' },
        metadata: { twilioSid: 'SM123', phoneTo: '+61412345678' },
        status: 'pending',
      };

      const parsed = CreateConversationMessageSchema.parse(message);
      expect(parsed.channel).toBe('sms');
      expect(parsed.direction).toBe('outbound');
    });
  });

  describe('InboxFilterSchema', () => {
    it('should validate filters with channels', () => {
      const filter = {
        channels: ['email', 'sms'],
        isRead: false,
      };

      const parsed = InboxFilterSchema.parse(filter);
      expect(parsed.channels).toEqual(['email', 'sms']);
      expect(parsed.isRead).toBe(false);
    });

    it('should validate empty filters', () => {
      const parsed = InboxFilterSchema.parse({});
      expect(parsed.channels).toBeUndefined();
    });
  });

  describe('SendMessageRequestSchema', () => {
    it('should validate a send message request', () => {
      const request = {
        contactId: '550e8400-e29b-41d4-a716-446655440001',
        channel: 'whatsapp',
        content: { text: 'Property photos attached' },
      };

      const parsed = SendMessageRequestSchema.parse(request);
      expect(parsed.channel).toBe('whatsapp');
    });

    it('should reject missing contactId', () => {
      expect(() =>
        SendMessageRequestSchema.parse({
          channel: 'email',
          content: { text: 'Hello' },
        }),
      ).toThrow();
    });
  });

  describe('ContactChannelsSchema', () => {
    it('should validate contact channels', () => {
      const channels = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        contactId: '550e8400-e29b-41d4-a716-446655440001',
        emails: ['buyer@example.com'],
        phones: ['+61412345678'],
        instagramId: 'igsid_123',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const parsed = ContactChannelsSchema.parse(channels);
      expect(parsed.emails).toEqual(['buyer@example.com']);
      expect(parsed.instagramId).toBe('igsid_123');
    });
  });

  describe('NormalisedInboundMessageSchema', () => {
    it('should validate an inbound SMS message', () => {
      const message = {
        channel: 'sms',
        direction: 'inbound' as const,
        senderPhone: '+61412345678',
        content: { text: 'Interested in the listing' },
        metadata: { twilioSid: 'SM123' },
        externalMessageId: 'SM123',
        receivedAt: '2024-01-15T10:00:00.000Z',
      };

      const parsed = NormalisedInboundMessageSchema.parse(message);
      expect(parsed.channel).toBe('sms');
      expect(parsed.senderPhone).toBe('+61412345678');
    });

    it('should validate an inbound Instagram DM', () => {
      const message = {
        channel: 'instagram_dm',
        direction: 'inbound' as const,
        senderSocialId: 'igsid_456',
        content: { text: 'Love the listing!' },
        metadata: { instagramIgsid: 'igsid_456' },
        externalMessageId: 'mid_abc',
        receivedAt: '2024-01-15T10:00:00.000Z',
      };

      const parsed = NormalisedInboundMessageSchema.parse(message);
      expect(parsed.senderSocialId).toBe('igsid_456');
    });
  });
});
