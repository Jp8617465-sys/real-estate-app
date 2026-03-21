import {
  type ClientBrief,
  type Property,
  type PropertyMatch,
  type Inspection,
  type DueDiligenceChecklist,
  type DueDiligenceItem,
  type KeyDate,
  type Offer,
  type ConsolidationReportContent,
  type PropertyRanking,
  type MarketSnapshot,
  type ReportRiskItem,
  type RecommendedAction,
  type ConsolidationReportType,
} from '@realflow/shared';

// ─── Data Inputs ───────────────────────────────────────────────────

export interface ConsolidationDataInput {
  clientBrief: ClientBrief;
  propertyMatches: Array<PropertyMatch & { property: Property }>;
  inspections: Inspection[];
  dueDiligenceChecklists: Array<DueDiligenceChecklist & { items: DueDiligenceItem[] }>;
  keyDates: KeyDate[];
  offers: Offer[];
  marketData: MarketSnapshot[];
}

export interface ConsolidationOptions {
  reportType: ConsolidationReportType;
  includeMarketData: boolean;
  includeDueDiligence: boolean;
  includeInspections: boolean;
  propertyIds?: string[];
}

// ─── Research Consolidation Engine ─────────────────────────────────

/**
 * Consolidates data from multiple sources into structured reports
 * for buyer-agent client briefs and property assessments.
 *
 * This engine aggregates rule-based data from:
 * - PropertyMatchEngine scores
 * - Inspection logs
 * - Due diligence checklists
 * - Key dates
 * - Market data
 * - Offer history
 *
 * The structured output can be further enhanced by AI (via PropertyAnalysisService)
 * for narrative generation and deeper insights.
 */
export class ResearchConsolidationEngine {
  /**
   * Generate a full consolidated report from all data sources.
   */
  static consolidate(
    data: ConsolidationDataInput,
    options: ConsolidationOptions,
  ): ConsolidationReportContent {
    const filteredMatches = options.propertyIds
      ? data.propertyMatches.filter((m) => options.propertyIds!.includes(m.propertyId))
      : data.propertyMatches;

    const propertyRankings = this.buildPropertyRankings(filteredMatches, data.inspections);
    const risks = this.assessRisks(data);
    const recommendedActions = this.buildRecommendedActions(data);
    const searchProgress = this.buildSearchProgress(data);

    const content: ConsolidationReportContent = {
      executiveSummary: this.generateExecutiveSummary(data, filteredMatches),
      propertyRankings,
      risks,
      recommendedActions,
      searchProgress,
      rawDataSources: this.listDataSources(data, options),
    };

    if (options.includeMarketData && data.marketData.length > 0) {
      content.marketSnapshots = data.marketData;
    }

    if (options.includeDueDiligence && data.dueDiligenceChecklists.length > 0) {
      content.ddSummary = this.buildDDSummary(data.dueDiligenceChecklists);
    }

    return content;
  }

  /**
   * Build a client brief summary report (the "sacred document" view).
   */
  static consolidateBriefSummary(data: ConsolidationDataInput): ConsolidationReportContent {
    return this.consolidate(data, {
      reportType: 'client_brief_summary',
      includeMarketData: true,
      includeDueDiligence: false,
      includeInspections: true,
    });
  }

  /**
   * Build a property comparison report for multiple properties.
   */
  static consolidatePropertyComparison(
    data: ConsolidationDataInput,
    propertyIds: string[],
  ): ConsolidationReportContent {
    return this.consolidate(data, {
      reportType: 'property_comparison',
      includeMarketData: true,
      includeDueDiligence: true,
      includeInspections: true,
      propertyIds,
    });
  }

  /**
   * Build a search progress report (weekly/fortnightly client update).
   */
  static consolidateSearchProgress(data: ConsolidationDataInput): ConsolidationReportContent {
    return this.consolidate(data, {
      reportType: 'search_progress',
      includeMarketData: true,
      includeDueDiligence: false,
      includeInspections: true,
    });
  }

  /**
   * Build a due diligence summary report for a specific transaction.
   */
  static consolidateDDSummary(data: ConsolidationDataInput): ConsolidationReportContent {
    return this.consolidate(data, {
      reportType: 'due_diligence_summary',
      includeMarketData: false,
      includeDueDiligence: true,
      includeInspections: false,
    });
  }

  // ─── Internal Builders ───────────────────────────────────────────

  private static buildPropertyRankings(
    matches: Array<PropertyMatch & { property: Property }>,
    inspections: Inspection[],
  ): PropertyRanking[] {
    const sorted = [...matches].sort((a, b) => b.overallScore - a.overallScore);

    return sorted.map((match, index) => {
      const inspection = inspections.find((i) => i.propertyId === match.propertyId);
      const pros = this.identifyPros(match);
      const cons = this.identifyCons(match);

      return {
        propertyId: match.propertyId,
        address: this.formatAddress(match.property),
        rank: index + 1,
        overallScore: match.overallScore,
        pros,
        cons,
        recommendation: this.generatePropertyRecommendation(match, pros, cons),
        inspectionSummary: inspection ? this.summarizeInspection(inspection) : undefined,
      };
    });
  }

  private static identifyPros(match: PropertyMatch & { property: Property }): string[] {
    const pros: string[] = [];
    const { scoreBreakdown } = match;

    if (scoreBreakdown.priceMatch >= 80) pros.push('Within budget range');
    if (scoreBreakdown.priceMatch === 100) pros.push('Price is ideal for budget');
    if (scoreBreakdown.locationMatch >= 80) pros.push('In preferred suburb');
    if (scoreBreakdown.sizeMatch >= 80) pros.push('Size meets requirements');
    if (scoreBreakdown.featureMatch >= 70) pros.push('Good feature match');
    if (scoreBreakdown.investorMatch && scoreBreakdown.investorMatch >= 70) {
      pros.push('Strong investment potential');
    }
    if (match.overallScore >= 85) pros.push('Top-tier overall match');

    return pros;
  }

  private static identifyCons(match: PropertyMatch & { property: Property }): string[] {
    const cons: string[] = [];
    const { scoreBreakdown } = match;

    if (scoreBreakdown.priceMatch < 50) cons.push('Over budget');
    if (scoreBreakdown.priceMatch === 0) cons.push('Significantly over budget');
    if (scoreBreakdown.locationMatch < 50) cons.push('Not in preferred suburb');
    if (scoreBreakdown.sizeMatch < 50) cons.push('Size does not meet minimum requirements');
    if (scoreBreakdown.featureMatch < 40) cons.push('Missing key features');

    return cons;
  }

  private static generatePropertyRecommendation(
    match: PropertyMatch & { property: Property },
    pros: string[],
    cons: string[],
  ): string {
    if (match.overallScore >= 85) {
      return 'Strongly recommend — proceed with inspection or offer';
    }
    if (match.overallScore >= 70) {
      return cons.length > 0
        ? `Good prospect with caveats: ${cons[0]}`
        : 'Worth inspecting — solid overall match';
    }
    if (match.overallScore >= 50) {
      return 'Marginal match — review if alternatives are limited';
    }
    return 'Not recommended — significant mismatches with brief';
  }

  private static summarizeInspection(inspection: Inspection): string {
    const parts: string[] = [];
    parts.push(`Impression: ${inspection.overallImpression}`);
    parts.push(`Suitability: ${inspection.clientSuitability}`);
    if (inspection.conditionNotes) {
      parts.push(`Condition: ${inspection.conditionNotes.substring(0, 100)}`);
    }
    if (inspection.agentNotes) {
      parts.push(`Notes: ${inspection.agentNotes.substring(0, 100)}`);
    }
    return parts.join('. ');
  }

  private static assessRisks(data: ConsolidationDataInput): ReportRiskItem[] {
    const risks: ReportRiskItem[] = [];

    // Budget risk: properties priced above the absolute max
    const overBudgetCount = data.propertyMatches.filter(
      (m) => m.scoreBreakdown.priceMatch === 0,
    ).length;
    if (overBudgetCount > 0) {
      risks.push({
        category: 'financial',
        severity: 'high',
        description: `${overBudgetCount} properties exceed the maximum budget`,
        mitigationAction: 'Review budget expectations or refine search criteria',
      });
    }

    // Pre-approval expiry
    if (data.clientBrief.finance.preApprovalExpiry) {
      const expiry = new Date(data.clientBrief.finance.preApprovalExpiry);
      const daysUntilExpiry = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 30) {
        risks.push({
          category: 'financial',
          severity: daysUntilExpiry <= 7 ? 'high' : 'medium',
          description: `Pre-approval expires in ${daysUntilExpiry} days`,
          mitigationAction: 'Contact broker to arrange pre-approval renewal',
        });
      }
    }

    // DD risks: critical items pending
    for (const checklist of data.dueDiligenceChecklists) {
      const criticalPending = checklist.items.filter(
        (item) => item.isCritical && item.status !== 'completed',
      );
      if (criticalPending.length > 0) {
        risks.push({
          category: 'legal',
          severity: 'high',
          description: `${criticalPending.length} critical due diligence items pending`,
          mitigationAction: 'Prioritise outstanding DD items before proceeding',
        });
      }
    }

    // Key date risks: overdue or due soon
    const overdueDates = data.keyDates.filter((d) => d.status === 'overdue');
    if (overdueDates.length > 0) {
      risks.push({
        category: 'timeline',
        severity: 'high',
        description: `${overdueDates.length} key dates are overdue`,
        mitigationAction: 'Immediate action required on overdue dates',
      });
    }

    const dueSoonDates = data.keyDates.filter((d) => d.status === 'due_soon');
    if (dueSoonDates.length > 0) {
      risks.push({
        category: 'timeline',
        severity: 'medium',
        description: `${dueSoonDates.length} key dates approaching`,
      });
    }

    // Search duration risk
    if (data.clientBrief.timeline.urgency === 'asap' && data.propertyMatches.length === 0) {
      risks.push({
        category: 'market',
        severity: 'medium',
        description: 'Urgent search with no matching properties found yet',
        mitigationAction: 'Consider broadening search criteria or suburbs',
      });
    }

    return risks;
  }

  private static buildRecommendedActions(data: ConsolidationDataInput): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    // New high-score matches need review
    const newHighMatches = data.propertyMatches.filter(
      (m) => m.status === 'new' && m.overallScore >= 75,
    );
    if (newHighMatches.length > 0) {
      actions.push({
        action: `Review ${newHighMatches.length} new high-scoring property matches`,
        priority: 'high',
        assignee: 'agent',
        completed: false,
      });
    }

    // Properties with inspection_booked status
    const inspectionBooked = data.propertyMatches.filter((m) => m.status === 'inspection_booked');
    if (inspectionBooked.length > 0) {
      actions.push({
        action: `${inspectionBooked.length} inspections to attend`,
        priority: 'high',
        assignee: 'agent',
        completed: false,
      });
    }

    // Client-interested properties needing offers
    const clientInterested = data.propertyMatches.filter((m) => m.status === 'client_interested');
    if (clientInterested.length > 0) {
      actions.push({
        action: `Prepare offer strategy for ${clientInterested.length} client-approved properties`,
        priority: 'high',
        assignee: 'agent',
        completed: false,
      });
    }

    // Active offers needing follow-up
    const activeOffers = data.offers.filter(
      (o) => o.status === 'submitted' || o.status === 'countered',
    );
    if (activeOffers.length > 0) {
      actions.push({
        action: `Follow up on ${activeOffers.length} active offers`,
        priority: 'high',
        assignee: 'agent',
        completed: false,
      });
    }

    // Pre-approval renewal
    if (data.clientBrief.finance.preApprovalExpiry) {
      const expiry = new Date(data.clientBrief.finance.preApprovalExpiry);
      const daysLeft = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30 && daysLeft > 0) {
        actions.push({
          action: 'Arrange pre-approval renewal with broker',
          priority: daysLeft <= 14 ? 'high' : 'medium',
          assignee: 'client',
          deadline: new Date(expiry.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          completed: false,
        });
      }
    }

    // Brief incomplete check
    if (!data.clientBrief.clientSignedOff) {
      actions.push({
        action: 'Get client sign-off on brief',
        priority: 'medium',
        assignee: 'agent',
        completed: false,
      });
    }

    // Market research for preferred suburbs
    if (data.marketData.length === 0 && data.clientBrief.requirements.suburbs.length > 0) {
      actions.push({
        action: 'Gather market data for target suburbs',
        priority: 'medium',
        assignee: 'agent',
        completed: false,
      });
    }

    return actions;
  }

  private static buildSearchProgress(
    data: ConsolidationDataInput,
  ): ConsolidationReportContent['searchProgress'] {
    const briefCreated = new Date(data.clientBrief.createdAt);
    const daysInSearch = Math.floor((Date.now() - briefCreated.getTime()) / (1000 * 60 * 60 * 24));

    return {
      propertiesReviewed: data.propertyMatches.length,
      inspectionsCompleted: data.inspections.length,
      offersMade: data.offers.length,
      daysInSearch: Math.max(0, daysInSearch),
    };
  }

  private static buildDDSummary(
    checklists: Array<DueDiligenceChecklist & { items: DueDiligenceItem[] }>,
  ): NonNullable<ConsolidationReportContent['ddSummary']> {
    let totalItems = 0;
    let completedItems = 0;
    let criticalPending = 0;

    for (const checklist of checklists) {
      for (const item of checklist.items) {
        totalItems++;
        if (item.status === 'completed') {
          completedItems++;
        } else if (item.isCritical) {
          criticalPending++;
        }
      }
    }

    return {
      totalItems,
      completedItems,
      criticalPending,
      completionPercent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
    };
  }

  private static generateExecutiveSummary(
    data: ConsolidationDataInput,
    matches: Array<PropertyMatch & { property: Property }>,
  ): string {
    const topMatches = matches.filter((m) => m.overallScore >= 75).length;
    const inspected = data.inspections.length;
    const activeOffers = data.offers.filter(
      (o) => o.status === 'submitted' || o.status === 'countered',
    ).length;

    const parts: string[] = [];

    parts.push(
      `Search for ${data.clientBrief.requirements.suburbs.map((s) => s.suburb).join(', ') || 'target suburbs'}: ` +
        `${matches.length} properties reviewed, ${topMatches} strong matches identified.`,
    );

    if (inspected > 0) {
      parts.push(`${inspected} inspections completed.`);
    }

    if (activeOffers > 0) {
      parts.push(`${activeOffers} active offers in progress.`);
    }

    if (data.clientBrief.timeline.urgency === 'asap') {
      parts.push('Client timeline is urgent.');
    }

    return parts.join(' ');
  }

  private static formatAddress(property: Property): string {
    const { streetNumber, streetName, unitNumber, suburb, state, postcode } = property.address;
    const unit = unitNumber ? `${unitNumber}/` : '';
    const street = `${unit}${streetNumber} ${streetName}`;
    return `${street}, ${suburb} ${state} ${postcode}`;
  }

  private static listDataSources(
    data: ConsolidationDataInput,
    options: ConsolidationOptions,
  ): string[] {
    const sources: string[] = ['client_brief', 'property_matches'];

    if (options.includeInspections && data.inspections.length > 0) {
      sources.push('inspections');
    }
    if (options.includeDueDiligence && data.dueDiligenceChecklists.length > 0) {
      sources.push('due_diligence');
    }
    if (options.includeMarketData && data.marketData.length > 0) {
      sources.push('market_data');
    }
    if (data.offers.length > 0) {
      sources.push('offers');
    }
    if (data.keyDates.length > 0) {
      sources.push('key_dates');
    }

    return sources;
  }
}
