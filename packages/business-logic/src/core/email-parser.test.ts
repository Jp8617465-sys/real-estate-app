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

  // ─── Additional Classification Tests ───────────────────────────

  describe('classifyEmail — extended coverage', () => {
    it('classifies Domain notifications sender', () => {
      const result = EmailParser.classifyEmail({
        from: 'notifications@domain.com.au',
        to: ['agent@example.com'],
        subject: 'Your listing has been viewed',
        textBody: 'Your listing has new views',
        messageId: 'msg-ext-1',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('domain_enquiry');
    });

    it('classifies REA leads sender', () => {
      const result = EmailParser.classifyEmail({
        from: 'leads@realestate.com.au',
        to: ['agent@example.com'],
        subject: 'New lead received',
        textBody: 'A new lead has been received',
        messageId: 'msg-ext-2',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('rea_enquiry');
    });

    it('classifies REA enquiry by subject pattern', () => {
      const result = EmailParser.classifyEmail({
        from: 'random@sender.com',
        to: ['agent@example.com'],
        subject: 'New enquiry via realestate.com.au',
        textBody: 'Test body',
        messageId: 'msg-ext-3',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('rea_enquiry');
    });

    it('classifies conveyancer emails as solicitor', () => {
      const result = EmailParser.classifyEmail({
        from: 'jane@conveyancing.com.au',
        to: ['agent@example.com'],
        subject: 'Settlement documents',
        textBody: 'Please find attached...',
        messageId: 'msg-ext-4',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('solicitor');
    });

    it('classifies emails from legal firms as solicitor', () => {
      const result = EmailParser.classifyEmail({
        from: 'info@abclegal.com.au',
        to: ['agent@example.com'],
        subject: 'Contract review complete',
        textBody: 'Review complete',
        messageId: 'msg-ext-5',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('solicitor');
    });

    it('classifies finance-related emails as broker', () => {
      const result = EmailParser.classifyEmail({
        from: 'advisor@financecorp.com',
        to: ['agent@example.com'],
        subject: 'Loan pre-approval update',
        textBody: 'The pre-approval has been extended',
        messageId: 'msg-ext-6',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('broker');
    });

    it('classifies home loan emails as broker', () => {
      const result = EmailParser.classifyEmail({
        from: 'support@homeloan.com.au',
        to: ['agent@example.com'],
        subject: 'Rate update',
        textBody: 'Interest rates have changed',
        messageId: 'msg-ext-7',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('broker');
    });

    it('classifies selling agent emails by subject pattern — inspection', () => {
      const result = EmailParser.classifyEmail({
        from: 'agent@remax.com.au',
        to: ['agent@example.com'],
        subject: 'Inspection time confirmed for Saturday',
        textBody: 'The inspection is at 10am',
        messageId: 'msg-ext-8',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('selling_agent_reply');
    });

    it('classifies selling agent emails by subject pattern — open home', () => {
      const result = EmailParser.classifyEmail({
        from: 'agent@ljhooker.com.au',
        to: ['agent@example.com'],
        subject: 'Open home this weekend',
        textBody: 'Open for inspection Saturday and Sunday',
        messageId: 'msg-ext-9',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('selling_agent_reply');
    });

    it('classifies selling agent emails by subject pattern — auction', () => {
      const result = EmailParser.classifyEmail({
        from: 'agent@raywhite.com.au',
        to: ['agent@example.com'],
        subject: 'Auction details for 42 Ocean Street',
        textBody: 'The auction will be held on...',
        messageId: 'msg-ext-10',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('selling_agent_reply');
    });

    it('is case-insensitive for sender patterns', () => {
      const result = EmailParser.classifyEmail({
        from: 'NoReply@DOMAIN.COM.AU',
        to: ['agent@example.com'],
        subject: 'Test',
        textBody: 'Test',
        messageId: 'msg-ext-11',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('domain_enquiry');
    });
  });

  // ─── Domain Enquiry Parsing — Extended ─────────────────────────

  describe('parseDomainEnquiry — extended', () => {
    it('extracts enquiry message from body', () => {
      const result = EmailParser.parseDomainEnquiry({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'New enquiry for 10 Beach Rd, Coogee NSW 2034',
        textBody: `
Name: Alex Turner
Email: alex@test.com
Phone: 0411 555 666
Message: We have been pre-approved and would love to inspect this property ASAP.

Listing ID: 9876543
        `.trim(),
        messageId: 'msg-ext-domain-1',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).not.toBeNull();
      expect(result!.message).toContain('pre-approved');
      expect(result!.enquirerPhone).toBe('0411 555 666');
    });

    it('extracts address from body when subject has no address', () => {
      const result = EmailParser.parseDomainEnquiry({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'You have a new property enquiry',
        textBody: `
Name: Chris Wong
Email: chris@gmail.com
Property: 7/15 Harbour View Drive, Mosman NSW 2088
        `.trim(),
        messageId: 'msg-ext-domain-2',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).not.toBeNull();
      expect(result!.propertyAddress).toContain('Harbour View Drive');
    });

    it('handles enquiry with missing phone number', () => {
      const result = EmailParser.parseDomainEnquiry({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'New enquiry for 5 Park Ave, Sydney NSW 2000',
        textBody: `
Name: No Phone
Email: nophone@test.com
Message: Please contact me via email only.
        `.trim(),
        messageId: 'msg-ext-domain-3',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).not.toBeNull();
      expect(result!.enquirerPhone).toBeUndefined();
      expect(result!.enquirerEmail).toBe('nophone@test.com');
    });

    it('handles enquiry with E-mail label (alternate format)', () => {
      const result = EmailParser.parseDomainEnquiry({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'New enquiry for 1 Test St, Sydney',
        textBody: `
Name: Alt Format
E-mail: alt.format@test.com
Message: Testing alternate format
        `.trim(),
        messageId: 'msg-ext-domain-4',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).not.toBeNull();
      expect(result!.enquirerEmail).toBe('alt.format@test.com');
    });
  });

  // ─── REA Enquiry Parsing — Extended ────────────────────────────

  describe('parseREAEnquiry — extended', () => {
    it('extracts address from subject with enquiry prefix', () => {
      const result = EmailParser.parseREAEnquiry({
        from: 'noreply@realestate.com.au',
        to: ['agent@example.com'],
        subject: 'Enquiry: 3/42 Oxford Street, Paddington NSW 2021',
        textBody: `
Name: Lisa Chen
Email: lisa.chen@email.com
Phone: 0433 987 654
Message: Is this still available?
        `.trim(),
        messageId: 'msg-ext-rea-1',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).not.toBeNull();
      expect(result!.propertyAddress).toBe('3/42 Oxford Street, Paddington NSW 2021');
      expect(result!.enquirerName).toBe('Lisa Chen');
    });

    it('returns null when REA enquiry has no email address', () => {
      const result = EmailParser.parseREAEnquiry({
        from: 'noreply@realestate.com.au',
        to: ['agent@example.com'],
        subject: 'Enquiry: 1 Test St',
        textBody: 'Name: No Email\nMessage: Just a message',
        messageId: 'msg-ext-rea-2',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBeNull();
    });

    it('extracts address from body when subject has no address', () => {
      const result = EmailParser.parseREAEnquiry({
        from: 'noreply@realestate.com.au',
        to: ['agent@example.com'],
        subject: 'You have a new property notification',
        textBody: `
Name: Tom Smith
Email: tom@email.com
Address: 88 George Street, Sydney NSW 2000
        `.trim(),
        messageId: 'msg-ext-rea-3',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).not.toBeNull();
      expect(result!.propertyAddress).toContain('George Street');
    });
  });

  // ─── processInboundEmail — Extended ────────────────────────────

  describe('processInboundEmail — extended', () => {
    it('processes REA enquiry end-to-end', () => {
      const result = EmailParser.processInboundEmail({
        from: 'noreply@realestate.com.au',
        to: ['agent@example.com'],
        subject: 'Enquiry: 5 Beach Road, Coogee NSW 2034',
        textBody: `
Name: Emily Davis
Email: emily.d@test.com
Phone: 0455 111 222
Message: Is there an open home this weekend?
        `.trim(),
        messageId: 'msg-process-rea-1',
        receivedAt: '2024-02-01T10:00:00.000Z',
      });

      expect(result.classification).toBe('rea_enquiry');
      expect(result.portalEnquiry).toBeDefined();
      expect(result.portalEnquiry!.source).toBe('realestate.com.au');
      expect(result.normalisedMessage.channel).toBe('rea_enquiry');
      expect(result.normalisedMessage.senderEmail).toBe('emily.d@test.com');
      expect(result.normalisedMessage.senderName).toBe('Emily Davis');
    });

    it('normalised message includes metadata for portal enquiries', () => {
      const result = EmailParser.processInboundEmail({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'New enquiry for 42 Ocean Street, Bondi NSW 2026',
        textBody: `
Name: Metadata Test
Email: meta@test.com
Listing ID: 99999
        `.trim(),
        messageId: 'msg-meta-1',
        receivedAt: '2024-02-01T10:00:00.000Z',
      });

      expect(result.normalisedMessage.metadata.portalSource).toBe('domain');
      expect(result.normalisedMessage.metadata.portalListingId).toBe('99999');
      expect(result.normalisedMessage.metadata.emailMessageId).toBe('msg-meta-1');
    });

    it('normalised message includes content for general emails', () => {
      const result = EmailParser.processInboundEmail({
        from: 'someone@gmail.com',
        to: ['agent@example.com'],
        subject: 'Quick question',
        textBody: 'Can you call me about the property?',
        htmlBody: '<p>Can you call me about the property?</p>',
        messageId: 'msg-general-1',
        receivedAt: '2024-02-01T10:00:00.000Z',
      });

      expect(result.normalisedMessage.content.text).toBe('Can you call me about the property?');
      expect(result.normalisedMessage.content.html).toBe(
        '<p>Can you call me about the property?</p>',
      );
      expect(result.normalisedMessage.content.subject).toBe('Quick question');
    });

    it('processes solicitor email as general with correct classification', () => {
      const result = EmailParser.processInboundEmail({
        from: 'john@smithlegal.com.au',
        to: ['agent@example.com'],
        subject: 'Contract exchange',
        textBody: 'Contracts have been exchanged successfully.',
        messageId: 'msg-solicitor-1',
        receivedAt: '2024-02-01T10:00:00.000Z',
      });

      expect(result.classification).toBe('solicitor');
      expect(result.portalEnquiry).toBeUndefined();
      expect(result.normalisedMessage.channel).toBe('email');
    });

    it('processes broker email as general with correct classification', () => {
      const result = EmailParser.processInboundEmail({
        from: 'advisor@mortgagebroker.com.au',
        to: ['agent@example.com'],
        subject: 'Pre-approval confirmed',
        textBody: 'Pre-approval has been confirmed for $1.5M.',
        messageId: 'msg-broker-1',
        receivedAt: '2024-02-01T10:00:00.000Z',
      });

      expect(result.classification).toBe('broker');
      expect(result.portalEnquiry).toBeUndefined();
      expect(result.normalisedMessage.channel).toBe('email');
    });

    it('handles email with bare address (no angle brackets)', () => {
      const result = EmailParser.processInboundEmail({
        from: 'bare@email.com',
        to: ['agent@example.com'],
        subject: 'Test',
        textBody: 'Test body',
        messageId: 'msg-bare-1',
        receivedAt: '2024-02-01T10:00:00.000Z',
      });

      expect(result.normalisedMessage.senderEmail).toBe('bare@email.com');
      expect(result.normalisedMessage.senderName).toBeUndefined();
    });

    it('preserves threadId in normalised message metadata', () => {
      const result = EmailParser.processInboundEmail({
        from: 'test@example.com',
        to: ['agent@example.com'],
        subject: 'Re: Property discussion',
        textBody: 'Following up on our discussion',
        messageId: 'msg-thread-2',
        threadId: 'thread-123',
        receivedAt: '2024-02-01T10:00:00.000Z',
      });

      expect(result.normalisedMessage.metadata.emailThreadId).toBe('thread-123');
    });

    it('handles Domain enquiry that fails to parse (no email in body)', () => {
      const result = EmailParser.processInboundEmail({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'System alert',
        textBody: 'No contact information in this alert.',
        messageId: 'msg-fail-parse',
        receivedAt: '2024-02-01T10:00:00.000Z',
      });

      // Classification is domain_enquiry from sender, but parse fails
      // so it falls through to general email handling
      expect(result.normalisedMessage.channel).toBe('email');
      expect(result.portalEnquiry).toBeUndefined();
    });
  });

  // ─── Australian Property Portal Formats ────────────────────────

  describe('Australian property portal email formats', () => {
    it('handles Domain enquiry with Australian mobile format (04xx xxx xxx)', () => {
      const result = EmailParser.parseDomainEnquiry({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'New enquiry for 1 Test St, Melbourne VIC 3000',
        textBody: `
Name: Victorian Buyer
Email: vic@buyer.com
Phone: 0412 345 678
Message: Is this property still available?
        `.trim(),
        messageId: 'msg-au-1',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).not.toBeNull();
      expect(result!.enquirerPhone).toBe('0412 345 678');
    });

    it('handles Domain enquiry with unit/apartment address format', () => {
      const result = EmailParser.parseDomainEnquiry({
        from: 'noreply@domain.com.au',
        to: ['agent@example.com'],
        subject: 'New enquiry for 15/28 Campbell Street, Surry Hills NSW 2010',
        textBody: `
Name: Apartment Buyer
Email: apt@buyer.com
Phone: 0433 111 222
Message: Looking for 2 bed apartments.

Property: 15/28 Campbell Street, Surry Hills NSW 2010
        `.trim(),
        messageId: 'msg-au-2',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).not.toBeNull();
      expect(result!.propertyAddress).toBe('15/28 Campbell Street, Surry Hills NSW 2010');
    });

    it('handles REA enquiry from no-reply sender', () => {
      const result = EmailParser.classifyEmail({
        from: 'no-reply@realestate.com.au',
        to: ['agent@example.com'],
        subject: 'New enquiry',
        textBody: 'An enquiry has been received',
        messageId: 'msg-au-3',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('rea_enquiry');
    });

    it('handles enquiry from enquiry@domain.com.au sender', () => {
      const result = EmailParser.classifyEmail({
        from: 'enquiry@domain.com.au',
        to: ['agent@example.com'],
        subject: 'Property enquiry',
        textBody: 'You have a new enquiry',
        messageId: 'msg-au-4',
        receivedAt: '2024-01-15T10:00:00.000Z',
      });

      expect(result).toBe('domain_enquiry');
    });
  });
});
