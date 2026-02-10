import type { NormalisedInboundMessage, MessageContent, MessageMetadata } from '@realflow/shared';

// ─── Raw Email Interface ────────────────────────────────────────────────

interface RawEmail {
  from: string;
  to: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  messageId: string;
  threadId?: string;
  receivedAt: string;
}

// ─── Parsed Portal Enquiry ──────────────────────────────────────────────

interface ParsedPortalEnquiry {
  type: 'domain_enquiry' | 'rea_enquiry';
  propertyAddress: string;
  propertyListingId?: string;
  enquirerName: string;
  enquirerEmail: string;
  enquirerPhone?: string;
  message?: string;
  source: 'domain' | 'realestate.com.au';
}

// ─── Email Type Classification ──────────────────────────────────────────

type EmailClassification =
  | 'domain_enquiry'
  | 'rea_enquiry'
  | 'selling_agent_reply'
  | 'solicitor'
  | 'broker'
  | 'client'
  | 'general';

/**
 * Parses inbound emails to identify and extract structured data from
 * portal enquiry emails (Domain.com.au and realestate.com.au).
 *
 * Domain and REA both send enquiry notifications via email to the
 * listing agent. This parser recognises these emails and extracts
 * the enquirer's details and the property reference.
 */
export class EmailParser {
  // ─── Known Sender Patterns ────────────────────────────────────────

  private static readonly DOMAIN_SENDER_PATTERNS = [
    'noreply@domain.com.au',
    'enquiry@domain.com.au',
    'notifications@domain.com.au',
  ];

  private static readonly REA_SENDER_PATTERNS = [
    'noreply@realestate.com.au',
    'enquiry@realestate.com.au',
    'no-reply@realestate.com.au',
    'leads@realestate.com.au',
  ];

  private static readonly SOLICITOR_PATTERNS = [
    'solicitor',
    'lawyer',
    'legal',
    'conveyancer',
    'conveyancing',
    'law.com.au',
    'legal.com.au',
  ];

  private static readonly BROKER_PATTERNS = [
    'broker',
    'mortgage',
    'finance',
    'lending',
    'homeloan',
    'home-loan',
  ];

  // ─── Email Classification ─────────────────────────────────────────

  /**
   * Classify an email based on sender and subject patterns.
   */
  static classifyEmail(email: RawEmail): EmailClassification {
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();

    // Check for Domain enquiry
    if (EmailParser.DOMAIN_SENDER_PATTERNS.some((p) => fromLower.includes(p))) {
      return 'domain_enquiry';
    }
    if (subjectLower.includes('domain.com.au') && subjectLower.includes('enquiry')) {
      return 'domain_enquiry';
    }

    // Check for REA enquiry
    if (EmailParser.REA_SENDER_PATTERNS.some((p) => fromLower.includes(p))) {
      return 'rea_enquiry';
    }
    if (subjectLower.includes('realestate.com.au') && subjectLower.includes('enquiry')) {
      return 'rea_enquiry';
    }

    // Check for solicitor
    if (EmailParser.SOLICITOR_PATTERNS.some((p) => fromLower.includes(p) || subjectLower.includes(p))) {
      return 'solicitor';
    }

    // Check for broker
    if (EmailParser.BROKER_PATTERNS.some((p) => fromLower.includes(p) || subjectLower.includes(p))) {
      return 'broker';
    }

    // Check for selling agent patterns
    if (
      subjectLower.includes('listing') ||
      subjectLower.includes('inspection') ||
      subjectLower.includes('open home') ||
      subjectLower.includes('auction')
    ) {
      return 'selling_agent_reply';
    }

    return 'general';
  }

  // ─── Domain Enquiry Parsing ───────────────────────────────────────

  /**
   * Parse a Domain.com.au enquiry email into structured data.
   *
   * Domain enquiry emails typically contain:
   * - Subject: "New enquiry for [address]" or "Enquiry from [name]"
   * - Body contains: name, email, phone, message, property address, listing ID
   */
  static parseDomainEnquiry(email: RawEmail): ParsedPortalEnquiry | null {
    const body = email.textBody;
    const subject = email.subject;

    // Extract property address from subject
    const addressFromSubject = EmailParser.extractDomainAddress(subject);

    // Extract enquirer name
    const name = EmailParser.extractPattern(body, [
      /Name:\s*(.+?)(?:\n|$)/i,
      /From:\s*(.+?)(?:\n|$)/i,
      /Enquirer:\s*(.+?)(?:\n|$)/i,
      /enquiry from\s+(.+?)(?:\s+for|\s+about|\s*$)/i,
    ]) ?? 'Unknown';

    // Extract enquirer email
    const enquirerEmail = EmailParser.extractPattern(body, [
      /Email:\s*([\w.+-]+@[\w.-]+\.\w+)/i,
      /E-mail:\s*([\w.+-]+@[\w.-]+\.\w+)/i,
      /([\w.+-]+@[\w.-]+\.\w+)/,
    ]);

    if (!enquirerEmail) return null;

    // Extract enquirer phone
    const enquirerPhone = EmailParser.extractPattern(body, [
      /Phone:\s*([\d\s+()-]+)/i,
      /Mobile:\s*([\d\s+()-]+)/i,
      /Tel:\s*([\d\s+()-]+)/i,
      /Contact:\s*([\d\s+()-]+)/i,
    ]);

    // Extract message content
    const enquiryMessage = EmailParser.extractPattern(body, [
      /Message:\s*(.+?)(?:\n\n|\n-|$)/is,
      /Comments?:\s*(.+?)(?:\n\n|\n-|$)/is,
      /Enquiry:\s*(.+?)(?:\n\n|\n-|$)/is,
    ]);

    // Extract listing ID
    const listingId = EmailParser.extractPattern(body, [
      /Listing ID:\s*(\d+)/i,
      /listing\/(\d+)/i,
      /Property ID:\s*(\d+)/i,
    ]);

    // Extract property address from body (if not from subject)
    const addressFromBody = EmailParser.extractPattern(body, [
      /Property:\s*(.+?)(?:\n|$)/i,
      /Address:\s*(.+?)(?:\n|$)/i,
      /(?:for|about|at)\s+(\d+\s+[A-Z].+?,\s*\w+)/i,
    ]);

    return {
      type: 'domain_enquiry',
      propertyAddress: addressFromSubject ?? addressFromBody ?? 'Unknown',
      propertyListingId: listingId ?? undefined,
      enquirerName: name.trim(),
      enquirerEmail: enquirerEmail.trim(),
      enquirerPhone: enquirerPhone?.trim(),
      message: enquiryMessage?.trim(),
      source: 'domain',
    };
  }

  // ─── REA Enquiry Parsing ──────────────────────────────────────────

  /**
   * Parse a realestate.com.au enquiry email into structured data.
   *
   * REA enquiry emails typically contain:
   * - Subject: "New lead for [address]" or "Enquiry: [address]"
   * - Body contains: name, email, phone, message, property details
   */
  static parseREAEnquiry(email: RawEmail): ParsedPortalEnquiry | null {
    const body = email.textBody;
    const subject = email.subject;

    // Extract property address
    const addressFromSubject = EmailParser.extractREAAddress(subject);

    // Extract enquirer name
    const name = EmailParser.extractPattern(body, [
      /Name:\s*(.+?)(?:\n|$)/i,
      /From:\s*(.+?)(?:\n|$)/i,
      /Contact name:\s*(.+?)(?:\n|$)/i,
    ]) ?? 'Unknown';

    // Extract email
    const enquirerEmail = EmailParser.extractPattern(body, [
      /Email:\s*([\w.+-]+@[\w.-]+\.\w+)/i,
      /E-mail:\s*([\w.+-]+@[\w.-]+\.\w+)/i,
      /([\w.+-]+@[\w.-]+\.\w+)/,
    ]);

    if (!enquirerEmail) return null;

    // Extract phone
    const enquirerPhone = EmailParser.extractPattern(body, [
      /Phone:\s*([\d\s+()-]+)/i,
      /Mobile:\s*([\d\s+()-]+)/i,
    ]);

    // Extract message
    const enquiryMessage = EmailParser.extractPattern(body, [
      /Message:\s*(.+?)(?:\n\n|\n-|$)/is,
      /Comments?:\s*(.+?)(?:\n\n|\n-|$)/is,
    ]);

    // Extract address from body
    const addressFromBody = EmailParser.extractPattern(body, [
      /Property:\s*(.+?)(?:\n|$)/i,
      /Address:\s*(.+?)(?:\n|$)/i,
    ]);

    return {
      type: 'rea_enquiry',
      propertyAddress: addressFromSubject ?? addressFromBody ?? 'Unknown',
      enquirerName: name.trim(),
      enquirerEmail: enquirerEmail.trim(),
      enquirerPhone: enquirerPhone?.trim(),
      message: enquiryMessage?.trim(),
      source: 'realestate.com.au',
    };
  }

  // ─── Portal Enquiry to Normalised Message ─────────────────────────

  /**
   * Convert a parsed portal enquiry into a NormalisedInboundMessage.
   */
  static enquiryToNormalisedMessage(
    enquiry: ParsedPortalEnquiry,
    originalEmail: RawEmail,
  ): NormalisedInboundMessage {
    const channel = enquiry.source === 'domain' ? 'domain_enquiry' : 'rea_enquiry';

    const content: MessageContent = {
      text: enquiry.message ?? `New enquiry for ${enquiry.propertyAddress}`,
      subject: originalEmail.subject,
    };

    const metadata: MessageMetadata = {
      portalSource: enquiry.source,
      portalPropertyAddress: enquiry.propertyAddress,
      portalListingId: enquiry.propertyListingId,
      emailMessageId: originalEmail.messageId,
      emailThreadId: originalEmail.threadId,
      from: `${enquiry.enquirerName} <${enquiry.enquirerEmail}>`,
    };

    return {
      channel,
      direction: 'inbound',
      senderEmail: enquiry.enquirerEmail,
      senderPhone: enquiry.enquirerPhone,
      senderName: enquiry.enquirerName,
      content,
      metadata,
      propertyRef: enquiry.propertyAddress,
      externalMessageId: originalEmail.messageId,
      receivedAt: originalEmail.receivedAt,
    };
  }

  /**
   * Process an inbound email: classify it, parse if it's a portal enquiry,
   * and return a NormalisedInboundMessage.
   */
  static processInboundEmail(email: RawEmail): {
    classification: EmailClassification;
    normalisedMessage: NormalisedInboundMessage;
    portalEnquiry?: ParsedPortalEnquiry;
  } {
    const classification = EmailParser.classifyEmail(email);

    if (classification === 'domain_enquiry') {
      const enquiry = EmailParser.parseDomainEnquiry(email);
      if (enquiry) {
        return {
          classification,
          normalisedMessage: EmailParser.enquiryToNormalisedMessage(enquiry, email),
          portalEnquiry: enquiry,
        };
      }
    }

    if (classification === 'rea_enquiry') {
      const enquiry = EmailParser.parseREAEnquiry(email);
      if (enquiry) {
        return {
          classification,
          normalisedMessage: EmailParser.enquiryToNormalisedMessage(enquiry, email),
          portalEnquiry: enquiry,
        };
      }
    }

    // For non-portal emails, create a standard email message
    const emailMatch = email.from.match(/<([^>]+)>/);
    const senderEmail = emailMatch?.[1] ?? email.from;
    const nameMatch = email.from.match(/^([^<]+)</);
    const senderName = nameMatch?.[1]?.trim();

    const content: MessageContent = {
      text: email.textBody,
      html: email.htmlBody,
      subject: email.subject,
    };

    const metadata: MessageMetadata = {
      emailMessageId: email.messageId,
      emailThreadId: email.threadId,
      from: email.from,
      to: email.to,
    };

    return {
      classification,
      normalisedMessage: {
        channel: 'email',
        direction: 'inbound',
        senderEmail,
        senderName,
        content,
        metadata,
        externalMessageId: email.messageId,
        receivedAt: email.receivedAt,
      },
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Extract a string using the first matching regex from a list.
   */
  private static extractPattern(text: string, patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1] !== undefined) return match[1] as string;
    }
    return null;
  }

  /**
   * Extract property address from a Domain enquiry email subject.
   * E.g.: "New enquiry for 42 Ocean Street, Bondi NSW 2026"
   */
  private static extractDomainAddress(subject: string): string | null {
    const patterns = [
      /(?:enquiry|inquiry)\s+(?:for|about|on)\s+(.+?)(?:\s*-\s*Domain|\s*$)/i,
      /New lead[:\s]+(.+?)(?:\s*-\s*Domain|\s*$)/i,
    ];

    for (const pattern of patterns) {
      const match = subject.match(pattern);
      const captured = match?.[1];
      if (captured) return captured.trim();
    }

    return null;
  }

  /**
   * Extract property address from a REA enquiry email subject.
   * E.g.: "Enquiry: 15/28 Campbell Street, Surry Hills NSW 2010"
   */
  private static extractREAAddress(subject: string): string | null {
    const patterns = [
      /(?:enquiry|lead|inquiry)[:\s]+(.+?)(?:\s*-\s*realestate|\s*$)/i,
      /New enquiry for\s+(.+?)(?:\s*-|\s*$)/i,
    ];

    for (const pattern of patterns) {
      const match = subject.match(pattern);
      const captured = match?.[1];
      if (captured) return captured.trim();
    }

    return null;
  }
}
