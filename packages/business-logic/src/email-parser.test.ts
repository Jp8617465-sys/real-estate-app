import { describe, it, expect } from 'vitest';
import { EmailParser } from './email-parser';

describe('EmailParser', () => {
  describe('classifyEmail', () => {
    it('should classify Domain enquiry emails', () => {
      const result = EmailParser.classifyEmail({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'New enquiry for 42 Ocean Street, Bondi',
        textBody: 'You have received a new enquiry...',
        messageId: 'msg1',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('domain_enquiry');
    });

    it('should classify REA enquiry emails', () => {
      const result = EmailParser.classifyEmail({
        from: 'noreply@realestate.com.au',
        to: ['agent@example.com'],
        subject: 'New lead for 15 Park Avenue',
        textBody: 'A buyer has enquired...',
        messageId: 'msg2',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('rea_enquiry');
    });

    it('should classify Domain enquiry by subject pattern', () => {
      const result = EmailParser.classifyEmail({
        from: 'random@sender.com',
        to: ['agent@example.com'],
        subject: 'Enquiry via domain.com.au - 42 Ocean Street',
        textBody: 'Test',
        messageId: 'msg3',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('domain_enquiry');
    });

    it('should classify solicitor emails', () => {
      const result = EmailParser.classifyEmail({
        from: 'john@smithsolicitors.com.au',
        to: ['agent@example.com'],
        subject: 'Contract for 42 Ocean Street',
        textBody: 'Please find attached the contract...',
        messageId: 'msg4',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('solicitor');
    });

    it('should classify broker emails', () => {
      const result = EmailParser.classifyEmail({
        from: 'jane@mortgagebroker.com.au',
        to: ['agent@example.com'],
        subject: 'Pre-approval for client',
        textBody: 'Finance has been approved...',
        messageId: 'msg5',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('broker');
    });

    it('should classify general emails', () => {
      const result = EmailParser.classifyEmail({
        from: 'friend@personal.com',
        to: ['agent@example.com'],
        subject: 'Lunch tomorrow?',
        textBody: 'Free for lunch?',
        messageId: 'msg6',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('general');
    });
  });

  describe('parseDomainEnquiry', () => {
    it('should parse a standard Domain enquiry email', () => {
      const result = EmailParser.parseDomainEnquiry({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'New enquiry for 42 Ocean Street, Bondi NSW 2026',
        textBody: `
You have received a new enquiry for your listing.

Name: Sarah Johnson
Email: sarah.j@email.com
Phone: 0413 222 333
Message: I'm very interested in this property. Is it still available for inspection this weekend?

Property: 42 Ocean Street, Bondi NSW 2026
Listing ID: 2045678
        `.trim(),
        messageId: 'msg-domain-1',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('domain_enquiry');
      expect(result!.enquirerName).toBe('Sarah Johnson');
      expect(result!.enquirerEmail).toBe('sarah.j@email.com');
      expect(result!.enquirerPhone).toBe('0413 222 333');
      expect(result!.propertyAddress).toBe('42 Ocean Street, Bondi NSW 2026');
      expect(result!.propertyListingId).toBe('2045678');
      expect(result!.source).toBe('domain');
    });

    it('should return null if no email found', () => {
      const result = EmailParser.parseDomainEnquiry({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'System notification',
        textBody: 'No contact info here',
        messageId: 'msg-domain-2',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBeNull();
    });
  });

  describe('parseREAEnquiry', () => {
    it('should parse a standard REA enquiry email', () => {
      const result = EmailParser.parseREAEnquiry({
        from: 'noreply@realestate.com.au',
        to: ['agent@example.com'],
        subject: 'Enquiry: 15/28 Campbell Street, Surry Hills NSW 2010',
        textBody: `
New enquiry received.

Name: Michael Brown
Email: mike.b@gmail.com
Phone: 0422 111 444
Message: When is the next open home?

Address: 15/28 Campbell Street, Surry Hills NSW 2010
        `.trim(),
        messageId: 'msg-rea-1',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('rea_enquiry');
      expect(result!.enquirerName).toBe('Michael Brown');
      expect(result!.enquirerEmail).toBe('mike.b@gmail.com');
      expect(result!.enquirerPhone).toBe('0422 111 444');
      expect(result!.source).toBe('realestate.com.au');
    });
  });

  describe('processInboundEmail', () => {
    it('should process a Domain enquiry end-to-end', () => {
      const result = EmailParser.processInboundEmail({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'New enquiry for 42 Ocean Street, Bondi',
        textBody: `
Name: Test User
Email: test@example.com
Phone: 0400 111 222
Message: Interested in this property.

Listing ID: 12345
        `.trim(),
        messageId: 'msg-process-1',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result.classification).toBe('domain_enquiry');
      expect(result.portalEnquiry).toBeDefined();
      expect(result.normalisedMessage.channel).toBe('domain_enquiry');
      expect(result.normalisedMessage.senderEmail).toBe('test@example.com');
    });

    it('should process a general email', () => {
      const result = EmailParser.processInboundEmail({
        from: 'John Doe <john@example.com>',
        to: ['agent@example.com'],
        subject: 'Meeting next week',
        textBody: 'Shall we catch up on Tuesday?',
        messageId: 'msg-process-2',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result.classification).toBe('general');
      expect(result.portalEnquiry).toBeUndefined();
      expect(result.normalisedMessage.channel).toBe('email');
      expect(result.normalisedMessage.senderEmail).toBe('john@example.com');
      expect(result.normalisedMessage.senderName).toBe('John Doe');
    });
  });
});
