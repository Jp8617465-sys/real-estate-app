import {
  type ClientBrief,
  type Property,
  type MatchScoreBreakdown,
} from '@realflow/shared';

// ─── Match Result ───────────────────────────────────────────────────

export interface MatchResult {
  propertyId: string;
  clientBriefId: string;
  clientId: string;
  overallScore: number;
  scoreBreakdown: MatchScoreBreakdown;
  flags: string[];
}

// ─── Property Match Engine ──────────────────────────────────────────

export class PropertyMatchEngine {
  /**
   * Score a single property against a client brief.
   * Returns 0-100 overall score with breakdown.
   */
  static scoreProperty(property: Property, brief: ClientBrief): MatchResult {
    const breakdown: MatchScoreBreakdown = {
      priceMatch: this.scorePriceMatch(property, brief),
      locationMatch: this.scoreLocationMatch(property, brief),
      sizeMatch: this.scoreSizeMatch(property, brief),
      featureMatch: this.scoreFeatureMatch(property, brief),
    };

    // Add investor match if applicable
    if (brief.requirements.investorCriteria) {
      breakdown.investorMatch = this.scoreInvestorMatch(property, brief);
    }

    const flags = this.detectFlags(property, brief);

    // Weighted average
    const weights = {
      priceMatch: 30,
      locationMatch: 25,
      sizeMatch: 20,
      featureMatch: 15,
      investorMatch: 10,
    };

    const hasInvestor = breakdown.investorMatch !== undefined;
    const totalWeight = hasInvestor ? 100 : 90;

    let weightedSum =
      breakdown.priceMatch * weights.priceMatch +
      breakdown.locationMatch * weights.locationMatch +
      breakdown.sizeMatch * weights.sizeMatch +
      breakdown.featureMatch * weights.featureMatch;

    if (hasInvestor && breakdown.investorMatch !== undefined) {
      weightedSum += breakdown.investorMatch * weights.investorMatch;
    }

    const overallScore = Math.round(weightedSum / totalWeight);

    return {
      propertyId: property.id,
      clientBriefId: brief.id,
      clientId: brief.contactId,
      overallScore,
      scoreBreakdown: breakdown,
      flags,
    };
  }

  /**
   * Score multiple properties against a brief, sorted by score descending.
   */
  static scoreProperties(properties: Property[], brief: ClientBrief): MatchResult[] {
    return properties
      .map(p => this.scoreProperty(p, brief))
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Filter properties that meet a minimum score threshold.
   */
  static filterByMinScore(results: MatchResult[], minScore: number): MatchResult[] {
    return results.filter(r => r.overallScore >= minScore);
  }

  // ─── Scoring Functions ──────────────────────────────────────────────

  private static scorePriceMatch(property: Property, brief: ClientBrief): number {
    const price = property.listPrice;
    if (!price) return 50; // No price listed, neutral score

    const { min, max, absoluteMax } = brief.budget;

    // Over absolute max = 0
    if (absoluteMax && price > absoluteMax) return 0;

    // Within budget range = 100
    if (price >= min && price <= max) return 100;

    // Below min = still good (under budget)
    if (price < min) {
      // Score decreases if WAY under budget (might indicate quality concerns)
      const ratio = price / min;
      if (ratio >= 0.8) return 90;
      if (ratio >= 0.6) return 70;
      return 50;
    }

    // Above max but below absolute max
    if (absoluteMax && price > max && price <= absoluteMax) {
      // Linear decay from max to absoluteMax
      const overBudgetRatio = (price - max) / (absoluteMax - max);
      return Math.round(70 * (1 - overBudgetRatio));
    }

    // Above max (no absoluteMax set), degrade gracefully
    const overBudgetPercent = ((price - max) / max) * 100;
    if (overBudgetPercent <= 5) return 60;
    if (overBudgetPercent <= 10) return 40;
    if (overBudgetPercent <= 20) return 20;
    return 0;
  }

  private static scoreLocationMatch(property: Property, brief: ClientBrief): number {
    const propertySuburb = property.address.suburb.toLowerCase();
    const briefSuburbs = brief.requirements.suburbs;

    if (briefSuburbs.length === 0) return 50; // No preference

    // Check if property suburb is in brief suburbs (case insensitive)
    const matchedSuburb = briefSuburbs.find(
      s => s.suburb.toLowerCase() === propertySuburb
    );

    if (matchedSuburb) {
      // Ranked match: top choice = 100, lower ranks get less
      if (matchedSuburb.rank) {
        const maxRank = Math.max(...briefSuburbs.map(s => s.rank ?? 999));
        if (matchedSuburb.rank === 1) return 100;
        if (matchedSuburb.rank <= 3) return 90;
        // Scale based on position
        return Math.max(60, Math.round(100 - (matchedSuburb.rank / maxRank) * 40));
      }
      return 100; // No rank = all equally good
    }

    // Not in list = 0
    return 0;
  }

  private static scoreSizeMatch(property: Property, brief: ClientBrief): number {
    let totalScore = 0;
    let factors = 0;

    // Bedrooms
    const { bedrooms, bathrooms, carSpaces } = brief.requirements;

    totalScore += this.scoreMinIdeal(property.bedrooms, bedrooms.min, bedrooms.ideal);
    factors++;

    // Bathrooms
    totalScore += this.scoreMinIdeal(property.bathrooms, bathrooms.min, bathrooms.ideal);
    factors++;

    // Car spaces
    totalScore += this.scoreMinIdeal(property.carSpaces, carSpaces.min, carSpaces.ideal);
    factors++;

    // Land size (if specified)
    if (brief.requirements.landSize && property.landSize) {
      const { min: lMin, max: lMax } = brief.requirements.landSize;
      if (lMin !== undefined && lMax !== undefined) {
        if (property.landSize >= lMin && property.landSize <= lMax) {
          totalScore += 100;
        } else if (property.landSize >= (lMin ?? 0) * 0.9) {
          totalScore += 70;
        } else {
          totalScore += 30;
        }
      } else if (lMin !== undefined) {
        totalScore += property.landSize >= lMin ? 100 : (property.landSize >= lMin * 0.8 ? 60 : 20);
      } else {
        totalScore += 80; // Only max specified, just having land data is fine
      }
      factors++;
    }

    // Property type match
    const propertyTypes = brief.requirements.propertyTypes;
    if (propertyTypes.length > 0) {
      totalScore += propertyTypes.includes(property.propertyType) ? 100 : 0;
      factors++;
    }

    return factors > 0 ? Math.round(totalScore / factors) : 50;
  }

  private static scoreMinIdeal(actual: number, min: number, ideal?: number): number {
    if (actual >= (ideal ?? min)) return 100;
    if (actual >= min) return 80;
    if (actual === min - 1) return 40;
    return 0;
  }

  private static scoreFeatureMatch(property: Property, brief: ClientBrief): number {
    // Feature match works on deal breakers and must-haves
    // Since we can't inspect property features from structured data alone,
    // this returns a neutral-to-good score based on what we CAN check

    const { dealBreakers, mustHaves, niceToHaves } = brief.requirements;

    // If no preferences set, neutral
    if (dealBreakers.length === 0 && mustHaves.length === 0 && niceToHaves.length === 0) {
      return 50;
    }

    // Building age check (if specified)
    if (brief.requirements.buildingAge && property.yearBuilt) {
      const { min: yearMin, max: yearMax } = brief.requirements.buildingAge;
      if (yearMin && property.yearBuilt < yearMin) return 20; // Too old
      if (yearMax && property.yearBuilt > yearMax) return 20; // Too new
    }

    // Without NLP on listing descriptions, we can't fully evaluate text-based
    // must-haves and deal-breakers. Return 50 (neutral) as baseline.
    // In production, this would integrate with listing description analysis.
    return 50;
  }

  private static scoreInvestorMatch(_property: Property, _brief: ClientBrief): number {
    // Investor scoring requires rental yield data which isn't in Property schema yet
    // Placeholder that returns neutral score
    // TODO: integrate with rental data when available
    return 50;
  }

  // ─── Flag Detection ──────────────────────────────────────────────

  private static detectFlags(property: Property, brief: ClientBrief): string[] {
    const flags: string[] = [];
    const price = property.listPrice;

    if (price) {
      if (price > brief.budget.max) flags.push('over_budget');
      if (brief.budget.absoluteMax && price > brief.budget.absoluteMax) {
        flags.push('over_absolute_max');
      }
      if (price < brief.budget.min * 0.7) flags.push('significantly_under_budget');
    }

    // Property type not in brief
    if (
      brief.requirements.propertyTypes.length > 0 &&
      !brief.requirements.propertyTypes.includes(property.propertyType)
    ) {
      flags.push('wrong_property_type');
    }

    // Suburb not in brief
    const propertySuburb = property.address.suburb.toLowerCase();
    const inBriefSuburbs = brief.requirements.suburbs.some(
      s => s.suburb.toLowerCase() === propertySuburb
    );
    if (brief.requirements.suburbs.length > 0 && !inBriefSuburbs) {
      flags.push('outside_target_suburbs');
    }

    // Bedrooms below minimum
    if (property.bedrooms < brief.requirements.bedrooms.min) {
      flags.push('below_min_bedrooms');
    }

    return flags;
  }
}
