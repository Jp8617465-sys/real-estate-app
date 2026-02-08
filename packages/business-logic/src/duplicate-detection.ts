import type { Contact } from '@realflow/shared';

interface DuplicateMatch {
  contactId: string;
  score: number; // 0-100 confidence
  matchedOn: string[];
}

/**
 * Duplicate detection for contacts.
 * Matches on phone number, email, and name similarity.
 * This is a critical feature — AgentBox's #1 selling point.
 */
export class DuplicateDetector {
  /**
   * Normalize an Australian phone number to a canonical form.
   * Handles: 0412345678, +61412345678, 61412345678, 04 1234 5678
   */
  static normalizePhone(phone: string): string {
    // Strip all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Handle +61 or 61 prefix
    if (digits.startsWith('61') && digits.length === 11) {
      return '0' + digits.slice(2);
    }

    // Already starts with 0
    if (digits.startsWith('0') && digits.length === 10) {
      return digits;
    }

    return digits;
  }

  /**
   * Normalize an email address for comparison.
   */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Find potential duplicates for a new contact against existing contacts.
   * Returns matches sorted by confidence score (highest first).
   */
  static findDuplicates(
    newContact: { phone?: string; email?: string; firstName?: string; lastName?: string },
    existingContacts: Pick<Contact, 'id' | 'phone' | 'email' | 'firstName' | 'lastName' | 'secondaryPhone'>[],
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];
    const normalizedPhone = newContact.phone
      ? this.normalizePhone(newContact.phone)
      : undefined;
    const normalizedEmail = newContact.email
      ? this.normalizeEmail(newContact.email)
      : undefined;

    for (const existing of existingContacts) {
      let score = 0;
      const matchedOn: string[] = [];

      // Phone match (highest confidence)
      if (normalizedPhone && existing.phone) {
        if (this.normalizePhone(existing.phone) === normalizedPhone) {
          score += 50;
          matchedOn.push('phone');
        }
      }

      // Secondary phone match
      if (normalizedPhone && existing.secondaryPhone) {
        if (this.normalizePhone(existing.secondaryPhone) === normalizedPhone) {
          score += 40;
          matchedOn.push('secondary-phone');
        }
      }

      // Email match (high confidence)
      if (normalizedEmail && existing.email) {
        if (this.normalizeEmail(existing.email) === normalizedEmail) {
          score += 45;
          matchedOn.push('email');
        }
      }

      // Name match (lower confidence, supports phone/email match)
      if (newContact.firstName && newContact.lastName) {
        const nameMatch =
          existing.firstName.toLowerCase() === newContact.firstName.toLowerCase() &&
          existing.lastName.toLowerCase() === newContact.lastName.toLowerCase();
        if (nameMatch) {
          score += 20;
          matchedOn.push('name');
        }
      }

      if (score > 0) {
        matches.push({
          contactId: existing.id,
          score: Math.min(100, score),
          matchedOn,
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Check if any match is above the auto-merge threshold.
   */
  static hasHighConfidenceDuplicate(matches: DuplicateMatch[], threshold = 80): boolean {
    return matches.some((m) => m.score >= threshold);
  }
}
