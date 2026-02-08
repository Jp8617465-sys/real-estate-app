import type { Contact, Activity } from '@realflow/shared';

interface ScoringWeights {
  hasEmail: number;
  hasPhone: number;
  hasPreApproval: number;
  recentActivity: number;
  inspectionAttended: number;
  emailOpened: number;
  callCompleted: number;
  daysSinceLastContact: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  hasEmail: 5,
  hasPhone: 5,
  hasPreApproval: 20,
  recentActivity: 10,
  inspectionAttended: 15,
  emailOpened: 3,
  callCompleted: 5,
  daysSinceLastContact: -2, // penalty per day
};

export class ContactScoring {
  /**
   * Calculate a lead warmth score (0-100) for a contact based on
   * their profile completeness and recent engagement.
   */
  static calculateScore(
    contact: Contact,
    recentActivities: Activity[],
    weights: Partial<ScoringWeights> = {},
  ): number {
    const w = { ...DEFAULT_WEIGHTS, ...weights };
    let score = 0;

    // Profile completeness
    if (contact.email) score += w.hasEmail;
    if (contact.phone) score += w.hasPhone;
    if (contact.buyerProfile?.preApproved) score += w.hasPreApproval;

    // Activity-based scoring (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOnes = recentActivities.filter(
      (a) => new Date(a.createdAt) >= thirtyDaysAgo,
    );

    for (const activity of recentOnes) {
      switch (activity.type) {
        case 'inspection':
        case 'open-home':
          score += w.inspectionAttended;
          break;
        case 'email-sent':
        case 'email-received':
          score += w.emailOpened;
          break;
        case 'call':
          score += w.callCompleted;
          break;
        default:
          score += w.recentActivity;
      }
    }

    // Recency penalty
    if (contact.lastContactDate) {
      const daysSince = Math.floor(
        (Date.now() - new Date(contact.lastContactDate).getTime()) / (1000 * 60 * 60 * 24),
      );
      score += daysSince * w.daysSinceLastContact;
    }

    // Clamp to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Classify a score into a warmth label.
   */
  static getWarmthLabel(score: number): 'hot' | 'warm' | 'cool' | 'cold' {
    if (score >= 75) return 'hot';
    if (score >= 50) return 'warm';
    if (score >= 25) return 'cool';
    return 'cold';
  }
}
