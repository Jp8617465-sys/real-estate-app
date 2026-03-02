/**
 * Prompt templates for Anthropic Claude API calls.
 * Each function returns a { system, user } pair for the Messages API.
 */

interface PropertyAnalysisInput {
  listingDescription: string;
  mustHaves: string[];
  niceToHaves: string[];
  dealBreakers: string[];
  propertyContext?: {
    suburb: string;
    propertyType: string;
    bedrooms: number;
  };
}

interface LeadScoringInput {
  enquiryText: string;
  contactContext?: {
    name: string;
    source: string;
  };
}

interface BriefRefinementInput {
  brief: {
    mustHaves: string[];
    niceToHaves: string[];
    dealBreakers: string[];
    suburbs: string[];
    propertyTypes: string[];
    budget: { min: number; max: number };
  };
  searchHistory?: {
    rejectedProperties: number;
    averageScore: number;
    commonRejectionReasons: string[];
  };
}

export function buildPropertyAnalysisPrompt(input: PropertyAnalysisInput): {
  system: string;
  user: string;
} {
  const contextLine = input.propertyContext
    ? `\nProperty context: ${input.propertyContext.bedrooms}-bed ${input.propertyContext.propertyType} in ${input.propertyContext.suburb}`
    : '';

  return {
    system: `You are an Australian buyers agent analyst. Analyse property listing descriptions against buyer requirements.

You must respond with valid JSON matching this exact schema:
{
  "featureScore": <number 0-100>,
  "features": [
    {
      "feature": "<requirement text>",
      "status": "matched" | "not_matched" | "partial" | "unknown",
      "confidence": <number 0-1>,
      "explanation": "<brief explanation>",
      "source": "must_have" | "nice_to_have" | "deal_breaker"
    }
  ],
  "dealBreakerFlags": ["<string descriptions of confirmed deal breakers>"],
  "summary": "<2-3 sentence summary of how well the property matches>"
}

Scoring rules:
- Start at 50 (neutral baseline)
- Each matched must_have: +10 (up to 100)
- Each not_matched must_have: -15
- Each matched nice_to_have: +5
- Each confirmed deal_breaker: -25 (minimum score 0)
- If no information found for a requirement, mark as "unknown" with confidence 0.3
- Clamp final featureScore to 0-100`,

    user: `Analyse this property listing against the buyer's requirements.

Listing description:
${input.listingDescription}
${contextLine}

Must-haves (required features):
${input.mustHaves.length > 0 ? input.mustHaves.map((h, i) => `${i + 1}. ${h}`).join('\n') : '(none specified)'}

Nice-to-haves (preferred features):
${input.niceToHaves.length > 0 ? input.niceToHaves.map((h, i) => `${i + 1}. ${h}`).join('\n') : '(none specified)'}

Deal-breakers (must NOT have):
${input.dealBreakers.length > 0 ? input.dealBreakers.map((d, i) => `${i + 1}. ${d}`).join('\n') : '(none specified)'}

Respond with JSON only, no other text.`,
  };
}

export function buildLeadScoringPrompt(input: LeadScoringInput): {
  system: string;
  user: string;
} {
  const contextLine = input.contactContext
    ? `\nContact: ${input.contactContext.name} (source: ${input.contactContext.source})`
    : '';

  return {
    system: `You are an Australian real estate lead qualification specialist. Analyse enquiry text for buying signals.

You must respond with valid JSON matching this exact schema:
{
  "signals": [
    {
      "signal": "<signal description>",
      "impact": "positive" | "negative" | "neutral",
      "weight": <number 1-10>,
      "explanation": "<brief explanation>"
    }
  ],
  "urgencyLevel": "immediate" | "high" | "medium" | "low" | "none",
  "estimatedTimeline": "<e.g. '1-3 months' or null>",
  "budgetConfidence": "high" | "medium" | "low" | "unknown",
  "suggestedScore": <number 0-100>
}

Positive signals (increase score): pre-approval mention, specific budget, urgency language, property type preferences, suburb specificity, settlement timeline, solicitor details, inspection requests.
Negative signals (decrease score): vague enquiry, "just looking", no timeline, unrealistic expectations.
Australian context: "pre-approval", "finance ready", "settlement", "conveyancer", "stamp duty", "FHBG" (First Home Buyer Grant).`,

    user: `Analyse this property enquiry for lead quality signals.
${contextLine}

Enquiry text:
${input.enquiryText}

Respond with JSON only, no other text.`,
  };
}

interface MessageDraftInput {
  channel: 'email' | 'sms' | 'whatsapp';
  intent: string;
  toneHint?: 'formal' | 'friendly' | 'professional';
  contactContext?: {
    name: string;
    source?: string;
    pipelineStage?: string;
    recentActivities?: string[];
  };
}

interface EmailSignalExtractionInput {
  subject: string;
  body: string;
  fromEmail?: string;
  classifiedType?: string;
}

export function buildMessageDraftPrompt(input: MessageDraftInput): {
  system: string;
  user: string;
} {
  const channelGuidance =
    input.channel === 'sms'
      ? 'Channel: SMS — keep body under 160 characters, casual and direct, no subject line.'
      : input.channel === 'whatsapp'
        ? 'Channel: WhatsApp — conversational and warm, up to 500 characters, no subject line. Supports plain text only (no markdown).'
        : 'Channel: Email — include a subject line, professional structure, can be multi-paragraph.';

  const toneGuidance = input.toneHint
    ? `Requested tone: ${input.toneHint}.`
    : 'Use professional tone by default.';

  const contactSection = input.contactContext
    ? `Contact: ${input.contactContext.name}${input.contactContext.source ? ` (source: ${input.contactContext.source})` : ''}${input.contactContext.pipelineStage ? `, stage: ${input.contactContext.pipelineStage}` : ''}.${input.contactContext.recentActivities?.length ? `\nRecent activity: ${input.contactContext.recentActivities.slice(0, 3).join('; ')}.` : ''}`
    : '';

  return {
    system: `You are an Australian real estate communication specialist drafting messages for buyers agents.

${channelGuidance}
${toneGuidance}

You must respond with valid JSON matching this exact schema:
{
  "subject": "<email subject line, omit for SMS/WhatsApp>",
  "body": "<message body>",
  "suggestedTone": "formal" | "friendly" | "professional",
  "alternativePhrasing": ["<alternative version 1>", "<alternative version 2>"]
}

Guidelines:
- Use Australian English spelling (realise, programme, etc.)
- Reference AU real estate norms (settlement, exchange, stamp duty, solicitor/conveyancer)
- Keep SMS/WhatsApp under 160 characters in body
- Provide exactly 2 alternative phrasings
- Omit "subject" key entirely for SMS/WhatsApp channels`,

    user: `Draft a ${input.channel} message with intent: "${input.intent}".${contactSection ? `\n\n${contactSection}` : ''}

Respond with JSON only, no other text.`,
  };
}

export function buildEmailSignalExtractionPrompt(input: EmailSignalExtractionInput): {
  system: string;
  user: string;
} {
  const classifiedLine = input.classifiedType
    ? `\nRule-based classification: ${input.classifiedType}`
    : '';

  return {
    system: `You are an Australian real estate lead qualification specialist. Extract buying signals and intent from inbound emails.

You must respond with valid JSON matching this exact schema:
{
  "intent": "buy" | "sell" | "invest" | "general" | "unknown",
  "urgency": "immediate" | "high" | "medium" | "low" | "none",
  "budgetMin": <number or omit if unknown>,
  "budgetMax": <number or omit if unknown>,
  "financeStatus": "pre_approved" | "self_funded" | "seeking" | "unknown",
  "estimatedTimeline": "<e.g. '1-3 months' or null>",
  "propertyPreferences": ["<suburb>", "<property type>", "<feature>"],
  "signals": [
    {
      "signal": "<signal description>",
      "impact": "positive" | "negative" | "neutral",
      "confidence": <number 0-1>
    }
  ],
  "overallConfidence": <number 0-1>
}

AU real estate context: "pre-approval", "finance ready", "settlement", "conveyancer", "stamp duty", "FHBG", "LVR", "strata", "body corporate". Budget figures are in AUD.`,

    user: `Extract lead signals from this inbound email.
From: ${input.fromEmail ?? 'unknown'}
Subject: ${input.subject}${classifiedLine}

Body:
${input.body}

Respond with JSON only, no other text.`,
  };
}

// ─── Daily Action Insights ────────────────────────────────────────────────────

export interface DailyActionCandidateInput {
  category: string;
  title: string;
  contactName?: string;
  daysOverdue?: number;
  daysUntilDeadline?: number;
  compositeScore: number;
}

export function buildDailyActionsPrompt(candidates: DailyActionCandidateInput[]): {
  system: string;
  user: string;
} {
  const candidateList = candidates
    .map(
      (c, i) =>
        `${i + 1}. [${c.category.toUpperCase()}] ${c.title}${c.contactName ? ` — contact: ${c.contactName}` : ''}${c.daysOverdue != null && c.daysOverdue > 0 ? ` (${c.daysOverdue} days overdue)` : ''}${c.daysUntilDeadline != null ? ` (deadline in ${c.daysUntilDeadline} days)` : ''} | score: ${c.compositeScore.toFixed(0)}`,
    )
    .join('\n');

  return {
    system: `You are an Australian buyers agent AI assistant generating the daily action list for a buyers agent.
For each action item, write a concise subtitle (max 15 words) explaining WHY this item is urgent today.
Be specific and actionable. Use Australian real estate context.

You must respond with valid JSON matching this exact schema:
{
  "items": [
    {
      "index": <number — 1-based index matching input>,
      "subtitle": "<why now, max 15 words, specific>"
    }
  ]
}

Examples of good subtitles:
- "Pre-approval expires in 4 days, 2 active inspections this week"
- "No contact in 9 days, lead score 87 — high intent buyer"
- "Finance approval deadline tomorrow — solicitor needs confirmation"
- "Stale lead, last message 14 days ago — re-engage now"`,

    user: `Generate "why now" subtitles for these ${candidates.length} action items:

${candidateList}

Respond with JSON only, no other text.`,
  };
}

// ─── Follow-Up Sequence Content ───────────────────────────────────────────────

export interface SequenceContentInput {
  stepAction: 'send_email' | 'send_sms';
  stepLabel?: string;
  dayOffset: number;
  contactContext: {
    name: string;
    pipelineStage?: string;
    source?: string;
    recentActivities?: string[];
  };
  sequenceName: string;
}

export function buildSequenceContentPrompt(input: SequenceContentInput): {
  system: string;
  user: string;
} {
  const channelGuidance =
    input.stepAction === 'send_sms'
      ? 'Channel: SMS — body under 160 characters, casual and direct, no subject line.'
      : 'Channel: Email — include a subject line, professional structure, 2-3 short paragraphs.';

  const timing =
    input.dayOffset === 0 ? 'immediately upon enrollment' : `${input.dayOffset} days after initial contact`;

  return {
    system: `You are an Australian real estate communication specialist drafting automated sequence messages for buyers agents.
${channelGuidance}
Use Australian English spelling. Reference AU real estate norms (settlement, exchange, stamp duty, conveyancer).

You must respond with valid JSON:
{
  "subject": "<email subject, omit for SMS>",
  "body": "<message body>",
  "suggestedTone": "formal" | "friendly" | "professional"
}`,

    user: `Draft a ${input.stepAction === 'send_sms' ? 'SMS' : 'email'} for the "${input.sequenceName}" sequence.
This message is sent ${timing}.
Contact: ${input.contactContext.name}${input.contactContext.pipelineStage ? `, stage: ${input.contactContext.pipelineStage}` : ''}${input.contactContext.source ? `, source: ${input.contactContext.source}` : ''}.${input.contactContext.recentActivities?.length ? `\nRecent activity: ${input.contactContext.recentActivities.slice(0, 2).join('; ')}.` : ''}

Respond with JSON only, no other text.`,
  };
}

export function buildBriefRefinementPrompt(input: BriefRefinementInput): {
  system: string;
  user: string;
} {
  const historySection = input.searchHistory
    ? `\nSearch history:
- Rejected properties: ${input.searchHistory.rejectedProperties}
- Average match score: ${input.searchHistory.averageScore}%
- Common rejection reasons: ${input.searchHistory.commonRejectionReasons.join(', ') || 'none recorded'}`
    : '';

  return {
    system: `You are an Australian buyers agent advisor. Suggest improvements to a client's property brief based on their requirements and search history.

You must respond with valid JSON matching this exact schema:
{
  "suggestions": [
    {
      "field": "<field name e.g. 'suburbs', 'budget.max', 'mustHaves'>",
      "currentValue": "<current value or null>",
      "suggestedValue": "<suggested change>",
      "reason": "<why this change would help>",
      "confidence": <number 0-1>
    }
  ],
  "completenessScore": <number 0-100>,
  "missingFields": ["<field names that should be filled in>"]
}

Consider Australian market norms: typical suburb groupings, realistic price expectations, common property features in different price ranges.`,

    user: `Analyse this buyer's brief and suggest refinements.

Budget: $${input.brief.budget.min.toLocaleString()} - $${input.brief.budget.max.toLocaleString()} AUD
Property types: ${input.brief.propertyTypes.join(', ') || 'not specified'}
Suburbs: ${input.brief.suburbs.join(', ') || 'not specified'}
Must-haves: ${input.brief.mustHaves.join(', ') || 'none'}
Nice-to-haves: ${input.brief.niceToHaves.join(', ') || 'none'}
Deal-breakers: ${input.brief.dealBreakers.join(', ') || 'none'}
${historySection}

Respond with JSON only, no other text.`,
  };
}
