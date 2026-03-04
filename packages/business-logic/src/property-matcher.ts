import {
  type ClientBrief,
  type Property,
  type MatchScoreBreakdown,
} from '@realflow/shared';
import { PropertyMatchEngine, type MatchResult } from './property-match-engine';

// ─── Matcher Configuration ──────────────────────────────────────────────────

export interface PropertyMatcherConfig {
  /** Minimum overall score to consider a property a match (0-100) */
  minimumScore: number;
  /** IDs of properties the client has already seen */
  seenPropertyIds: Set<string>;
  /** Whether to include description-based feature matching */
  enableDescriptionMatching: boolean;
}

const DEFAULT_CONFIG: PropertyMatcherConfig = {
  minimumScore: 40,
  seenPropertyIds: new Set(),
  enableDescriptionMatching: true,
};

// ─── Enhanced Match Result ──────────────────────────────────────────────────

export interface EnhancedMatchResult extends MatchResult {
  /** Individual feature match details */
  featureDetails: FeatureMatchDetail[];
  /** Whether all must-have criteria are satisfied */
  allMustHavesMet: boolean;
  /** Count of nice-to-haves that are present */
  niceToHaveCount: number;
  /** Whether any deal-breakers were detected */
  hasDealBreakers: boolean;
  /** List of detected deal-breakers */
  detectedDealBreakers: string[];
  /** List of matched must-haves */
  matchedMustHaves: string[];
  /** List of matched nice-to-haves */
  matchedNiceToHaves: string[];
  /** Whether this property was previously seen by the client */
  previouslySeen: boolean;
}

export interface FeatureMatchDetail {
  feature: string;
  category: 'must_have' | 'nice_to_have' | 'deal_breaker';
  matched: boolean;
  /** Source of the match (e.g., 'structured_data', 'description') */
  matchSource: string;
}

// ─── Property Matcher ───────────────────────────────────────────────────────

/**
 * Enhanced property matching engine that builds on PropertyMatchEngine
 * with additional capabilities:
 *
 * - Must-have vs nice-to-have distinction in scoring
 * - Deal-breaker detection from listing descriptions
 * - Already-seen property filtering
 * - Description-based feature matching using keyword analysis
 * - Detailed match breakdown for agent review
 *
 * Scoring weights:
 * - Price match:    30 points (from PropertyMatchEngine)
 * - Location match: 25 points (from PropertyMatchEngine)
 * - Size match:     20 points (from PropertyMatchEngine)
 * - Feature match:  15 points (enhanced with must-have/nice-to-have)
 * - Investor match: 10 points (when applicable, from PropertyMatchEngine)
 */
export class PropertyMatcher {
  private readonly config: PropertyMatcherConfig;

  constructor(config?: Partial<PropertyMatcherConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── Main Matching Method ───────────────────────────────────────────────────

  /**
   * Match properties against a client brief with enhanced scoring.
   * Returns results sorted by score, filtered by minimum threshold,
   * and excluding already-seen properties.
   */
  matchProperties(
    properties: Property[],
    brief: ClientBrief,
  ): EnhancedMatchResult[] {
    return properties
      .filter((p) => !this.config.seenPropertyIds.has(p.id))
      .map((p) => this.enhancedScore(p, brief))
      .filter((r) => r.overallScore >= this.config.minimumScore)
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Match properties including already-seen ones (marked but not filtered).
   * Useful when agents want to review all potential matches.
   */
  matchPropertiesIncludingSeen(
    properties: Property[],
    brief: ClientBrief,
  ): EnhancedMatchResult[] {
    return properties
      .map((p) => this.enhancedScore(p, brief))
      .filter((r) => r.overallScore >= this.config.minimumScore)
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Score a single property with enhanced feature matching.
   */
  enhancedScore(property: Property, brief: ClientBrief): EnhancedMatchResult {
    // Get base scores from PropertyMatchEngine
    const baseResult = PropertyMatchEngine.scoreProperty(property, brief);

    // Enhanced feature analysis
    const featureAnalysis = this.analyseFeatures(property, brief);

    // Recalculate feature match score using enhanced analysis
    const enhancedFeatureScore = this.calculateEnhancedFeatureScore(featureAnalysis, brief);

    // Recalculate overall score with enhanced feature score
    const breakdown: MatchScoreBreakdown = {
      ...baseResult.scoreBreakdown,
      featureMatch: enhancedFeatureScore,
    };

    const hasInvestor = breakdown.investorMatch !== undefined;
    const weights = {
      priceMatch: 30,
      locationMatch: 25,
      sizeMatch: 20,
      featureMatch: 15,
      investorMatch: 10,
    };
    const totalWeight = hasInvestor ? 100 : 90;

    let weightedSum =
      breakdown.priceMatch * weights.priceMatch +
      breakdown.locationMatch * weights.locationMatch +
      breakdown.sizeMatch * weights.sizeMatch +
      breakdown.featureMatch * weights.featureMatch;

    if (hasInvestor && breakdown.investorMatch !== undefined) {
      weightedSum += breakdown.investorMatch * weights.investorMatch;
    }

    let overallScore = Math.round(weightedSum / totalWeight);

    // Apply deal-breaker penalty: if any deal-breaker is detected, cap score at 30
    if (featureAnalysis.hasDealBreakers) {
      overallScore = Math.min(overallScore, 30);
    }

    // Bonus for meeting all must-haves (up to +5)
    if (featureAnalysis.allMustHavesMet && brief.requirements.mustHaves.length > 0) {
      overallScore = Math.min(100, overallScore + 5);
    }

    return {
      propertyId: property.id,
      clientBriefId: brief.id,
      clientId: brief.contactId,
      overallScore,
      scoreBreakdown: breakdown,
      flags: [
        ...baseResult.flags,
        ...(featureAnalysis.hasDealBreakers ? ['deal_breaker_detected'] : []),
        ...(featureAnalysis.allMustHavesMet && brief.requirements.mustHaves.length > 0
          ? ['all_must_haves_met']
          : []),
      ],
      featureDetails: featureAnalysis.details,
      allMustHavesMet: featureAnalysis.allMustHavesMet,
      niceToHaveCount: featureAnalysis.matchedNiceToHaves.length,
      hasDealBreakers: featureAnalysis.hasDealBreakers,
      detectedDealBreakers: featureAnalysis.detectedDealBreakers,
      matchedMustHaves: featureAnalysis.matchedMustHaves,
      matchedNiceToHaves: featureAnalysis.matchedNiceToHaves,
      previouslySeen: this.config.seenPropertyIds.has(property.id),
    };
  }

  // ─── Feature Analysis ───────────────────────────────────────────────────────

  private analyseFeatures(
    property: Property,
    brief: ClientBrief,
  ): {
    details: FeatureMatchDetail[];
    allMustHavesMet: boolean;
    matchedMustHaves: string[];
    matchedNiceToHaves: string[];
    hasDealBreakers: boolean;
    detectedDealBreakers: string[];
  } {
    const details: FeatureMatchDetail[] = [];
    const matchedMustHaves: string[] = [];
    const matchedNiceToHaves: string[] = [];
    const detectedDealBreakers: string[] = [];

    const description = (property.listingDescription ?? '').toLowerCase();
    const hasDescription = description.length > 0 && this.config.enableDescriptionMatching;

    // Check must-haves
    for (const mustHave of brief.requirements.mustHaves) {
      const structuredMatch = this.checkStructuredData(property, mustHave);
      const descriptionMatch = hasDescription && this.checkDescription(description, mustHave);
      const matched = structuredMatch || descriptionMatch;

      details.push({
        feature: mustHave,
        category: 'must_have',
        matched,
        matchSource: structuredMatch ? 'structured_data' : descriptionMatch ? 'description' : 'none',
      });

      if (matched) {
        matchedMustHaves.push(mustHave);
      }
    }

    // Check nice-to-haves
    for (const niceToHave of brief.requirements.niceToHaves) {
      const structuredMatch = this.checkStructuredData(property, niceToHave);
      const descriptionMatch = hasDescription && this.checkDescription(description, niceToHave);
      const matched = structuredMatch || descriptionMatch;

      details.push({
        feature: niceToHave,
        category: 'nice_to_have',
        matched,
        matchSource: structuredMatch ? 'structured_data' : descriptionMatch ? 'description' : 'none',
      });

      if (matched) {
        matchedNiceToHaves.push(niceToHave);
      }
    }

    // Check deal-breakers
    for (const dealBreaker of brief.requirements.dealBreakers) {
      const structuredMatch = this.checkStructuredDealBreaker(property, dealBreaker);
      const descriptionMatch = hasDescription && this.checkDescription(description, dealBreaker);
      const matched = structuredMatch || descriptionMatch;

      details.push({
        feature: dealBreaker,
        category: 'deal_breaker',
        matched,
        matchSource: structuredMatch ? 'structured_data' : descriptionMatch ? 'description' : 'none',
      });

      if (matched) {
        detectedDealBreakers.push(dealBreaker);
      }
    }

    const allMustHavesMet =
      brief.requirements.mustHaves.length === 0 ||
      matchedMustHaves.length === brief.requirements.mustHaves.length;

    return {
      details,
      allMustHavesMet,
      matchedMustHaves,
      matchedNiceToHaves,
      hasDealBreakers: detectedDealBreakers.length > 0,
      detectedDealBreakers,
    };
  }

  private calculateEnhancedFeatureScore(
    analysis: {
      allMustHavesMet: boolean;
      matchedMustHaves: string[];
      matchedNiceToHaves: string[];
      hasDealBreakers: boolean;
    },
    brief: ClientBrief,
  ): number {
    const totalMustHaves = brief.requirements.mustHaves.length;
    const totalNiceToHaves = brief.requirements.niceToHaves.length;

    // If no preferences, return neutral
    if (totalMustHaves === 0 && totalNiceToHaves === 0 && brief.requirements.dealBreakers.length === 0) {
      return 50;
    }

    // Deal-breaker detected: floor at 0
    if (analysis.hasDealBreakers) {
      return 0;
    }

    let score = 0;
    const maxScore = 100;

    // Must-haves contribute up to 70% of the feature score
    if (totalMustHaves > 0) {
      const mustHaveRatio = analysis.matchedMustHaves.length / totalMustHaves;
      score += mustHaveRatio * 70;
    } else {
      score += 50; // No must-haves = neutral base
    }

    // Nice-to-haves contribute up to 30% of the feature score
    if (totalNiceToHaves > 0) {
      const niceToHaveRatio = analysis.matchedNiceToHaves.length / totalNiceToHaves;
      score += niceToHaveRatio * 30;
    } else if (totalMustHaves > 0) {
      // If there are must-haves but no nice-to-haves, give remaining to must-haves
      score += 15;
    }

    // Building age check (if specified)
    // Note: this is handled in the base PropertyMatchEngine

    return Math.min(maxScore, Math.round(score));
  }

  // ─── Structured Data Checks ─────────────────────────────────────────────────

  /**
   * Check if a feature requirement is met by structured property data.
   * Handles common real estate requirements that can be verified
   * from property fields rather than description text.
   */
  private checkStructuredData(property: Property, feature: string): boolean {
    const lower = feature.toLowerCase();

    // Parking-related
    if (lower.includes('garage') || lower.includes('parking') || lower.includes('car space')) {
      return property.carSpaces >= 1;
    }
    if (lower.includes('double garage') || lower.includes('2 car')) {
      return property.carSpaces >= 2;
    }

    // Size-related
    if (lower.includes('large block') || lower.includes('big block') || lower.includes('large land')) {
      return (property.landSize ?? 0) >= 600;
    }

    // Year-related
    if (lower.includes('new build') || lower.includes('newly built') || lower.includes('brand new')) {
      return property.yearBuilt !== undefined && property.yearBuilt >= new Date().getFullYear() - 2;
    }

    return false;
  }

  /**
   * Check if a deal-breaker condition is present in structured data.
   */
  private checkStructuredDealBreaker(property: Property, dealBreaker: string): boolean {
    const lower = dealBreaker.toLowerCase();

    // No parking deal-breaker
    if (lower.includes('no parking') || lower.includes('no garage')) {
      return property.carSpaces === 0;
    }

    // Small block deal-breaker
    if (lower.includes('small block') || lower.includes('small land')) {
      return property.landSize !== undefined && property.landSize < 300;
    }

    return false;
  }

  // ─── Description Text Matching ──────────────────────────────────────────────

  /**
   * Check if a feature keyword or phrase appears in the listing description.
   * Uses keyword expansion to handle common variations.
   */
  private checkDescription(description: string, feature: string): boolean {
    const lower = feature.toLowerCase();
    const keywords = this.expandKeywords(lower);
    return keywords.some((keyword) => description.includes(keyword));
  }

  /**
   * Expand a feature requirement into multiple keyword variations.
   * Handles Australian real estate terminology.
   */
  private expandKeywords(feature: string): string[] {
    const keywords = [feature];

    // Common Australian real estate keyword expansions
    const expansions: Record<string, string[]> = {
      'pool': ['pool', 'swimming pool', 'inground pool', 'plunge pool'],
      'study': ['study', 'home office', 'office nook', 'study nook'],
      'renovated kitchen': ['renovated kitchen', 'modern kitchen', 'new kitchen', 'designer kitchen', 'gourmet kitchen'],
      'renovated bathroom': ['renovated bathroom', 'modern bathroom', 'new bathroom', 'designer bathroom'],
      'renovated': ['renovated', 'updated', 'refurbished', 'modernised', 'modernized'],
      'north-facing': ['north-facing', 'north facing', 'northern aspect', 'northerly'],
      'backyard': ['backyard', 'back yard', 'rear yard', 'garden'],
      'air conditioning': ['air conditioning', 'air con', 'a/c', 'ducted air', 'split system'],
      'solar': ['solar', 'solar panels', 'solar system'],
      'granny flat': ['granny flat', 'secondary dwelling', 'dual occupancy'],
      'water views': ['water views', 'water view', 'harbour view', 'harbor view', 'ocean view', 'bay view', 'river view'],
      'city views': ['city views', 'city view', 'skyline view', 'cbd view'],
      'balcony': ['balcony', 'terrace', 'verandah', 'veranda', 'deck'],
      'courtyard': ['courtyard', 'court yard', 'private courtyard'],
      'ensuite': ['ensuite', 'en-suite', 'en suite', 'master ensuite'],
      'walk-in wardrobe': ['walk-in wardrobe', 'walk in wardrobe', 'walk-in robe', 'walk in robe', 'wir'],
      'flood zone': ['flood zone', 'flood risk', 'flood prone', 'flood overlay', 'flooding'],
      'main road': ['main road', 'main road frontage', 'busy road', 'arterial road', 'highway'],
      'flight path': ['flight path', 'aircraft noise', 'plane noise', 'airport noise'],
      'heritage': ['heritage', 'heritage listed', 'heritage overlay'],
      'strata': ['strata', 'body corporate', 'owners corporation'],
      'pet friendly': ['pet friendly', 'pets allowed', 'pet-friendly'],
    };

    for (const [key, values] of Object.entries(expansions)) {
      if (feature.includes(key)) {
        keywords.push(...values);
      }
    }

    return [...new Set(keywords)];
  }

  // ─── Utility Methods ────────────────────────────────────────────────────────

  /**
   * Get the top N matches from a set of properties.
   */
  getTopMatches(
    properties: Property[],
    brief: ClientBrief,
    count: number,
  ): EnhancedMatchResult[] {
    return this.matchProperties(properties, brief).slice(0, count);
  }

  /**
   * Check if a single property meets the minimum match criteria.
   */
  isMatch(property: Property, brief: ClientBrief): boolean {
    const result = this.enhancedScore(property, brief);
    return result.overallScore >= this.config.minimumScore && !result.hasDealBreakers;
  }

  /**
   * Update the set of seen property IDs.
   */
  markAsSeen(propertyIds: string[]): void {
    for (const id of propertyIds) {
      this.config.seenPropertyIds.add(id);
    }
  }

  /**
   * Clear the seen property IDs set.
   */
  clearSeen(): void {
    this.config.seenPropertyIds.clear();
  }
}
