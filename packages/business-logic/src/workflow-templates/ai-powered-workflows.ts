import type { WorkflowTemplate } from './buyers-agent-workflows';

// ─── AI-Powered Workflow Templates ─────────────────────────────────
// These templates leverage AI triggers and actions to automate
// buyers-agent workflows with intelligent analysis.

export const AI_POWERED_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ── 1. AI Property Description Analysis ─────────────────────────
  {
    name: 'AI Property Description Analysis',
    description:
      'When a new high-scoring property match is detected, automatically runs AI analysis on the listing description to evaluate must-haves, deal-breakers, and nice-to-haves that the rule-based engine cannot assess from structured data alone.',
    trigger: {
      type: 'match_score_threshold',
      minScore: 65,
    },
    conditions: [],
    actions: [
      {
        type: 'ai_score_property',
        enhanceWithNLP: true,
      },
      {
        type: 'notify_agent',
        message: 'AI-enhanced scoring complete for property match — check updated results',
      },
    ],
    category: 'stage-automation',
  },

  // ── 2. Weekly Client Search Report ──────────────────────────────
  {
    name: 'Weekly Client Search Report',
    description:
      'Every Monday morning, auto-generates a consolidated search progress report for each active client. Aggregates property matches, inspections, market trends, and recommended actions. Can be auto-sent to client via portal.',
    trigger: {
      type: 'time_based',
      schedule: '0 8 * * 1', // Monday 8am
    },
    conditions: [
      {
        field: 'pipelineStage',
        operator: 'equals',
        value: 'active-search',
      },
    ],
    actions: [
      {
        type: 'generate_report',
        reportType: 'search_progress',
        autoSendToClient: false,
      },
      {
        type: 'create_task',
        taskTitle: 'Review and send weekly search report for {{contact.firstName}}',
        taskType: 'general',
        dueDaysFromNow: 0,
      },
    ],
    category: 'follow-up',
  },

  // ── 3. AI Market Shift Alert ────────────────────────────────────
  {
    name: 'AI Market Shift Alert',
    description:
      'Monitors market data for target suburbs. When the median price changes by more than 5%, triggers an AI analysis to assess impact on active client briefs and suggests brief adjustments.',
    trigger: {
      type: 'market_change',
      metric: 'median_price',
      threshold: 5,
      direction: 'change_percent',
    },
    conditions: [],
    actions: [
      {
        type: 'ai_analyze',
        analysisType: 'market_comparison',
      },
      {
        type: 'notify_agent',
        message: 'Market shift detected in {{suburb}} — AI analysis available',
      },
      {
        type: 'create_task',
        taskTitle: 'Review market shift impact on active briefs',
        taskType: 'general',
        dueDaysFromNow: 1,
      },
    ],
    category: 'stage-automation',
  },

  // ── 4. AI Brief Refinement Suggestion ───────────────────────────
  {
    name: 'AI Brief Refinement Suggestion',
    description:
      'After 14 days of active search with fewer than 3 properties scoring above 70, triggers AI analysis of the brief to suggest refinements. Helps agents and clients recalibrate expectations based on market reality.',
    trigger: {
      type: 'no_activity',
      days: 14,
    },
    conditions: [
      {
        field: 'pipelineStage',
        operator: 'equals',
        value: 'active-search',
      },
    ],
    actions: [
      {
        type: 'ai_analyze',
        analysisType: 'brief_refinement',
      },
      {
        type: 'notify_agent',
        message: 'AI suggests brief refinements for {{contact.firstName}} — limited matches found',
      },
      {
        type: 'create_task',
        taskTitle: 'Review AI brief refinement suggestions for {{contact.firstName}}',
        taskType: 'brief-review',
        dueDaysFromNow: 1,
      },
    ],
    category: 'follow-up',
  },

  // ── 5. Pre-Offer AI Risk Assessment ─────────────────────────────
  {
    name: 'Pre-Offer AI Risk Assessment',
    description:
      'When a deal moves to the offer-negotiate stage, auto-generates an AI risk assessment consolidating all research: property analysis, market comparisons, DD findings, and inspection notes. Helps agents prepare a stronger negotiation position.',
    trigger: {
      type: 'stage_change',
      to: 'offer-negotiate',
    },
    conditions: [],
    actions: [
      {
        type: 'ai_analyze',
        analysisType: 'risk_assessment',
      },
      {
        type: 'generate_report',
        reportType: 'property_comparison',
        autoSendToClient: false,
      },
      {
        type: 'notify_agent',
        message: 'AI risk assessment and property comparison ready for {{contact.firstName}} offer',
      },
    ],
    category: 'stage-automation',
  },

  // ── 6. AI-Drafted Client Update ─────────────────────────────────
  {
    name: 'AI-Drafted Client Update',
    description:
      'When a consolidation report is generated, auto-drafts a personalised email to the client summarising key findings and recommended next steps. The agent reviews and sends.',
    trigger: {
      type: 'consolidation_ready',
      reportType: 'search_progress',
    },
    conditions: [],
    actions: [
      {
        type: 'ai_draft_message',
        recipient: 'client',
        purpose: 'Weekly search progress update with consolidated findings',
        channel: 'email',
        autoSend: false,
      },
      {
        type: 'create_task',
        taskTitle: 'Review and send AI-drafted update to {{contact.firstName}}',
        taskType: 'general',
        dueDaysFromNow: 0,
      },
    ],
    category: 'follow-up',
  },

  // ── 7. Post-Inspection AI Summary ───────────────────────────────
  {
    name: 'Post-Inspection AI Summary',
    description:
      'When an inspection is logged, AI analyses the inspection notes, photos metadata, and voice note transcript to generate a structured property assessment. Automatically updates the property match status with AI insights.',
    trigger: {
      type: 'field_change',
      field: 'inspectionLogged',
    },
    conditions: [],
    actions: [
      {
        type: 'ai_analyze',
        analysisType: 'property_description',
      },
      {
        type: 'notify_agent',
        message: 'AI inspection summary ready for {{property.address}}',
      },
    ],
    category: 'stage-automation',
  },

  // ── 8. Settlement Outcome Report ────────────────────────────────
  {
    name: 'Settlement Outcome Report',
    description:
      'When a deal settles, auto-generates a comprehensive outcome report for the client. Summarises the entire journey: search duration, properties reviewed, offers made, final purchase details, and total costs. Published to client portal.',
    trigger: {
      type: 'stage_change',
      to: 'settled-nurture',
    },
    conditions: [],
    actions: [
      {
        type: 'generate_report',
        reportType: 'settlement_outcome',
        autoSendToClient: true,
      },
      {
        type: 'ai_draft_message',
        recipient: 'client',
        purpose: 'Congratulations and settlement outcome summary',
        channel: 'email',
        autoSend: false,
      },
      {
        type: 'notify_agent',
        message: 'Settlement outcome report generated for {{contact.firstName}}',
      },
    ],
    category: 'settlement',
  },

  // ── 9. AI Selling Agent Outreach ────────────────────────────────
  {
    name: 'AI Selling Agent Outreach',
    description:
      'When the client brief is signed off and search begins, AI drafts personalised outreach messages to selling agents in target suburbs. Agents review and send to maintain relationships and source off-market properties.',
    trigger: {
      type: 'stage_change',
      to: 'active-search',
    },
    conditions: [],
    actions: [
      {
        type: 'ai_draft_message',
        recipient: 'selling_agent',
        purpose: 'New buyer search notification — seeking off-market opportunities in target suburbs',
        channel: 'email',
        autoSend: false,
      },
      {
        type: 'create_task',
        taskTitle: 'Review AI-drafted selling agent outreach messages',
        taskType: 'general',
        dueDaysFromNow: 0,
      },
    ],
    category: 'stage-automation',
  },

  // ── 10. DD Completion AI Summary ────────────────────────────────
  {
    name: 'DD Completion AI Summary',
    description:
      'When due diligence reaches 100% completion, auto-generates a consolidated DD summary report highlighting any flagged issues, risk assessments, and a go/no-go recommendation for the agent and client.',
    trigger: {
      type: 'consolidation_ready',
      reportType: 'due_diligence_summary',
    },
    conditions: [],
    actions: [
      {
        type: 'generate_report',
        reportType: 'due_diligence_summary',
        autoSendToClient: false,
      },
      {
        type: 'ai_analyze',
        analysisType: 'risk_assessment',
      },
      {
        type: 'notify_agent',
        message: 'DD complete — AI summary and risk assessment ready for review',
      },
      {
        type: 'create_task',
        taskTitle: 'Review DD summary with client and solicitor',
        taskType: 'due-diligence-check',
        dueDaysFromNow: 1,
      },
    ],
    category: 'settlement',
  },
];
