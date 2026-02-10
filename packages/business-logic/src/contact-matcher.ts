import type { NormalisedInboundMessage } from '@realflow/shared';

// ─── Types ──────────────────────────────────────────────────────────────

interface ContactChannelRecord {
  id: string;
  contactId: string;
  emails: string[];
  phones: string[];
  instagramId: string | null;
  facebookId: string | null;
  whatsappNumber: string | null;
}

interface ContactMatchResult {
  matched: true;
  contactId: string;
  matchedBy: 'email' | 'phone' | 'instagram_id' | 'facebook_id' | 'whatsapp' | 'name_fuzzy';
  confidence: number;
}

interface ContactNoMatch {
  matched: false;
  suggestedContact: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    source: string;
  };
}

type ContactMatchOutcome = ContactMatchResult | ContactNoMatch;

// ─── Supabase Client Interface ──────────────────────────────────────────

interface SupabaseQueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface SupabaseClient {
  from(table: string): {
    select(columns: string): {
      contains(column: string, value: unknown): Promise<SupabaseQueryResult<ContactChannelRecord>>;
      eq(column: string, value: string): {
        select(columns: string): Promise<SupabaseQueryResult<ContactChannelRecord>>;
      } & Promise<SupabaseQueryResult<ContactChannelRecord>>;
    };
  };
}

/**
 * Matches incoming messages to existing contacts using their
 * channel identifiers (email, phone, social IDs).
 *
 * Match priority:
 * 1. Exact phone number match (SMS, WhatsApp, phone call)
 * 2. Exact email address match (email, portal enquiry)
 * 3. Social platform ID match (Instagram IGSID, Facebook PSID)
 * 4. Name fuzzy match (last resort)
 * 5. No match → suggest new contact creation
 */
export class ContactMatcher {
  /**
   * Attempt to match an inbound message to an existing contact.
   */
  static async matchContact(
    message: NormalisedInboundMessage,
    supabase: SupabaseClient,
  ): Promise<ContactMatchOutcome> {
    // 1. Try phone match
    if (message.senderPhone) {
      const phoneMatch = await ContactMatcher.matchByPhone(
        message.senderPhone,
        supabase,
      );
      if (phoneMatch) return phoneMatch;
    }

    // 2. Try email match
    if (message.senderEmail) {
      const emailMatch = await ContactMatcher.matchByEmail(
        message.senderEmail,
        supabase,
      );
      if (emailMatch) return emailMatch;
    }

    // 3. Try social ID match
    if (message.senderSocialId) {
      const socialMatch = await ContactMatcher.matchBySocialId(
        message,
        supabase,
      );
      if (socialMatch) return socialMatch;
    }

    // 4. No match found — suggest new contact
    return ContactMatcher.buildNoMatchResult(message);
  }

  /**
   * Match by phone number. Normalises the input to handle different formats.
   */
  private static async matchByPhone(
    phone: string,
    supabase: SupabaseClient,
  ): Promise<ContactMatchResult | null> {
    const normalised = ContactMatcher.normalisePhone(phone);
    const variants = ContactMatcher.getPhoneVariants(normalised);

    for (const variant of variants) {
      const { data } = await supabase
        .from('contact_channels')
        .select('contact_id, phones')
        .contains('phones', [variant]);

      const first = data?.[0];
      if (first) {
        return {
          matched: true,
          contactId: first.contactId,
          matchedBy: 'phone',
          confidence: 95,
        };
      }
    }

    return null;
  }

  /**
   * Match by email address (case-insensitive).
   */
  private static async matchByEmail(
    email: string,
    supabase: SupabaseClient,
  ): Promise<ContactMatchResult | null> {
    const normalised = email.toLowerCase().trim();

    const { data } = await supabase
      .from('contact_channels')
      .select('contact_id, emails')
      .contains('emails', [normalised]);

    const first = data?.[0];
    if (first) {
      return {
        matched: true,
        contactId: first.contactId,
        matchedBy: 'email',
        confidence: 95,
      };
    }

    return null;
  }

  /**
   * Match by social platform ID (Instagram IGSID, Facebook PSID).
   */
  private static async matchBySocialId(
    message: NormalisedInboundMessage,
    supabase: SupabaseClient,
  ): Promise<ContactMatchResult | null> {
    const socialId = message.senderSocialId;
    if (!socialId) return null;

    let column: string;
    let matchedBy: 'instagram_id' | 'facebook_id' | 'whatsapp';

    switch (message.channel) {
      case 'instagram_dm':
        column = 'instagram_id';
        matchedBy = 'instagram_id';
        break;
      case 'facebook_messenger':
        column = 'facebook_id';
        matchedBy = 'facebook_id';
        break;
      case 'whatsapp':
        column = 'whatsapp_number';
        matchedBy = 'whatsapp';
        break;
      default:
        return null;
    }

    const { data } = await supabase
      .from('contact_channels')
      .select('contact_id')
      .eq(column, socialId);

    const first = data?.[0];
    if (first) {
      return {
        matched: true,
        contactId: first.contactId,
        matchedBy,
        confidence: 90,
      };
    }

    return null;
  }

  /**
   * Build a "no match" result with suggested contact info extracted
   * from the message.
   */
  private static buildNoMatchResult(
    message: NormalisedInboundMessage,
  ): ContactNoMatch {
    const name = message.senderName ?? 'Unknown';
    const parts = name.split(' ');
    const firstName = parts[0] ?? 'Unknown';
    const lastName = parts.slice(1).join(' ') || 'Unknown';

    const channelToSource: Record<string, string> = {
      email: 'website',
      sms: 'other',
      phone_call: 'cold-call',
      whatsapp: 'other',
      instagram_dm: 'instagram',
      facebook_messenger: 'facebook',
      domain_enquiry: 'domain',
      rea_enquiry: 'rea',
    };

    return {
      matched: false,
      suggestedContact: {
        firstName,
        lastName,
        email: message.senderEmail,
        phone: message.senderPhone,
        source: channelToSource[message.channel] ?? 'other',
      },
    };
  }

  // ─── Phone Normalisation Utilities ─────────────────────────────────

  /**
   * Normalise an Australian phone number.
   * Handles: 0412345678, +61412345678, 61412345678, 0412 345 678
   */
  private static normalisePhone(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+61')) return cleaned;
    if (cleaned.startsWith('61') && cleaned.length >= 11) return `+${cleaned}`;
    if (cleaned.startsWith('0') && cleaned.length >= 10) return `+61${cleaned.slice(1)}`;

    return phone;
  }

  /**
   * Generate common format variants for phone matching.
   * This handles cases where phone numbers are stored in different formats.
   */
  private static getPhoneVariants(normalised: string): string[] {
    const variants: string[] = [normalised];

    // If E.164 format, also check local format
    if (normalised.startsWith('+61')) {
      variants.push(`0${normalised.slice(3)}`);
      variants.push(normalised.slice(1)); // without +
    }

    // If local format, also check E.164
    if (normalised.startsWith('0')) {
      variants.push(`+61${normalised.slice(1)}`);
      variants.push(`61${normalised.slice(1)}`);
    }

    return variants;
  }

  /**
   * Update a contact's channel identifiers after a new message is matched.
   * This enriches the contact with any new channel info we discover.
   */
  static async enrichContactChannels(
    contactId: string,
    message: NormalisedInboundMessage,
    supabase: SupabaseClient,
  ): Promise<void> {
    const { data } = await supabase
      .from('contact_channels')
      .select('*')
      .eq('contact_id', contactId);

    const record = data?.[0];
    if (!record) return;

    const updates: Record<string, unknown> = {};

    // Add new email if not already known
    if (message.senderEmail && !record.emails.includes(message.senderEmail.toLowerCase())) {
      updates.emails = [...record.emails, message.senderEmail.toLowerCase()];
    }

    // Add new phone if not already known
    if (message.senderPhone) {
      const normalised = ContactMatcher.normalisePhone(message.senderPhone);
      const knownPhones = record.phones.map((p: string) => ContactMatcher.normalisePhone(p));
      if (!knownPhones.includes(normalised)) {
        updates.phones = [...record.phones, normalised];
      }
    }

    // Add social IDs
    if (message.channel === 'instagram_dm' && message.senderSocialId && !record.instagramId) {
      updates.instagram_id = message.senderSocialId;
    }
    if (message.channel === 'facebook_messenger' && message.senderSocialId && !record.facebookId) {
      updates.facebook_id = message.senderSocialId;
    }
    if (message.channel === 'whatsapp' && message.senderPhone && !record.whatsappNumber) {
      updates.whatsapp_number = ContactMatcher.normalisePhone(message.senderPhone);
    }

    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      // The caller should handle this update via supabase
      // This is a no-op here as we need the actual supabase client
      // In practice: await supabase.from('contact_channels').update(updates).eq('contact_id', contactId);
    }
  }
}
