import type { WorkflowTrigger, WorkflowAction, WorkflowCondition } from '@realflow/shared';

// ─── Workflow Template Interface ──────────────────────────────────────────────
// Templates are pure data definitions representing pre-built workflow automations.
// They are instantiated into Workflow records when an agent activates a template.

export interface WorkflowTemplate {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  category: 'lead-response' | 'follow-up' | 'stage-automation' | 'settlement' | 'nurture';
}

// ─── Buyers Agent Workflow Templates ──────────────────────────────────────────

export const BUYERS_AGENT_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ── 1. Instant Lead Response ───────────────────────────────────────────────
  {
    name: 'Instant Lead Response',
    description:
      'Immediately acknowledges new leads with an SMS and email, creates a call task for the agent, and sends a notification. Ensures no lead waits more than a few minutes for initial contact.',
    trigger: {
      type: 'new_lead',
    },
    conditions: [],
    actions: [
      {
        type: 'send_sms',
        templateId: 'new-lead-acknowledgement-sms',
      },
      {
        type: 'send_email',
        templateId: 'new-lead-welcome-email',
      },
      {
        type: 'create_task',
        taskTitle: 'Call new lead within 1 hour',
        taskType: 'call',
        dueDaysFromNow: 0,
      },
      {
        type: 'notify_agent',
        message: 'New lead: {{contact.firstName}} from {{contact.source}}',
      },
    ],
    category: 'lead-response',
  },

  // ── 2. Lead Follow-Up (No Contact) ────────────────────────────────────────
  {
    name: 'Lead Follow-Up (No Contact)',
    description:
      'Triggers when a lead in the enquiry stage has had no activity for 2 days. Creates a follow-up task and warns the agent so leads do not go cold.',
    trigger: {
      type: 'no_activity',
      days: 2,
    },
    conditions: [
      {
        field: 'pipelineStage',
        operator: 'equals',
        value: 'enquiry',
      },
    ],
    actions: [
      {
        type: 'create_task',
        taskTitle: 'Follow up with {{contact.firstName}} - no contact in 2 days',
        taskType: 'follow-up',
        dueDaysFromNow: 0,
      },
      {
        type: 'notify_agent',
        message: 'Warning: No contact with {{contact.firstName}} for 2 days',
      },
    ],
    category: 'follow-up',
  },

  // ── 3. Post-Consultation Follow-Up ────────────────────────────────────────
  {
    name: 'Post-Consultation Follow-Up',
    description:
      'Fires when a contact moves to the consult-qualify stage. Sends a consultation summary email, creates a task to send the engagement agreement, and schedules a follow-up if the agreement is not signed within 3 days.',
    trigger: {
      type: 'stage_change',
      to: 'consult-qualify',
    },
    conditions: [],
    actions: [
      {
        type: 'send_email',
        templateId: 'post-consultation-summary-email',
      },
      {
        type: 'create_task',
        taskTitle: 'Send engagement agreement to {{contact.firstName}}',
        taskType: 'document-review',
        dueDaysFromNow: 1,
      },
      {
        type: 'create_follow_up',
        daysFromNow: 3,
        taskType: 'follow-up',
      },
    ],
    category: 'stage-automation',
  },

  // ── 4. Engagement Welcome Pack ────────────────────────────────────────────
  {
    name: 'Engagement Welcome Pack',
    description:
      'Triggers when a buyer officially engages. Sends a welcome pack email, and creates tasks for setting up portal access, collecting a detailed client brief, and verifying finance pre-approval.',
    trigger: {
      type: 'stage_change',
      to: 'engaged',
    },
    conditions: [],
    actions: [
      {
        type: 'send_email',
        templateId: 'engagement-welcome-pack-email',
      },
      {
        type: 'create_task',
        taskTitle: 'Set up client portal access for {{contact.firstName}}',
        taskType: 'client-portal-update',
        dueDaysFromNow: 0,
      },
      {
        type: 'create_task',
        taskTitle: 'Collect detailed client brief',
        taskType: 'brief-review',
        dueDaysFromNow: 3,
      },
      {
        type: 'create_task',
        taskTitle: 'Verify finance pre-approval',
        taskType: 'document-review',
        dueDaysFromNow: 5,
      },
    ],
    category: 'stage-automation',
  },

  // ── 5. Brief Signed Off - Activate Search ─────────────────────────────────
  {
    name: 'Brief Signed Off - Activate Search',
    description:
      'Fires when the client brief is signed off. Notifies the agent, creates a task to configure property matching alerts, and schedules outreach to selling agents in target suburbs.',
    trigger: {
      type: 'field_change',
      field: 'clientBriefSignedOff',
    },
    conditions: [
      {
        field: 'clientBriefSignedOff',
        operator: 'equals',
        value: true,
      },
    ],
    actions: [
      {
        type: 'notify_agent',
        message: 'Brief signed off for {{contact.firstName}} - search activated',
      },
      {
        type: 'create_task',
        taskTitle: 'Set up property matching alerts',
        taskType: 'general',
        dueDaysFromNow: 0,
      },
      {
        type: 'create_task',
        taskTitle: 'Contact selling agent network for target suburbs',
        taskType: 'call',
        dueDaysFromNow: 1,
      },
    ],
    category: 'stage-automation',
  },

  // ── 6. Property Match Alert ───────────────────────────────────────────────
  {
    name: 'Property Match Alert',
    description:
      'Triggers when a new property match is detected. If the match score is 80% or above, notifies the agent and creates a task to review the property and arrange an inspection.',
    trigger: {
      type: 'field_change',
      field: 'newPropertyMatch',
    },
    conditions: [
      {
        field: 'matchScore',
        operator: 'greater_than',
        value: 79,
      },
    ],
    actions: [
      {
        type: 'notify_agent',
        message: 'High-score match ({{matchScore}}%) found for {{contact.firstName}}',
      },
      {
        type: 'create_task',
        taskTitle: 'Review property match for {{contact.firstName}}',
        taskType: 'inspection',
        dueDaysFromNow: 0,
      },
    ],
    category: 'stage-automation',
  },

  // ── 7. Pre-Approval Expiry Warning ────────────────────────────────────────
  {
    name: 'Pre-Approval Expiry Warning',
    description:
      'Fires 30 days before the finance pre-approval expires. Notifies the agent, creates a task to call the client about renewal, and sends a reminder email.',
    trigger: {
      type: 'date_approaching',
      field: 'preApprovalExpiry',
      daysBefore: 30,
    },
    conditions: [],
    actions: [
      {
        type: 'notify_agent',
        message: 'Pre-approval expiring in 30 days for {{contact.firstName}}',
      },
      {
        type: 'create_task',
        taskTitle: 'Remind {{contact.firstName}} about pre-approval renewal',
        taskType: 'call',
        dueDaysFromNow: 0,
      },
      {
        type: 'send_email',
        templateId: 'pre-approval-expiry-reminder-email',
      },
    ],
    category: 'follow-up',
  },

  // ── 8. Under Contract - Due Diligence Kickoff ─────────────────────────────
  {
    name: 'Under Contract - Due Diligence Kickoff',
    description:
      'Fires when a deal moves to the under-contract stage. Generates the due diligence checklist, schedules building and pest inspections, confirms solicitor engagement, sends a congratulations email, and notifies the agent.',
    trigger: {
      type: 'stage_change',
      to: 'under-contract',
    },
    conditions: [],
    actions: [
      {
        type: 'create_task',
        taskTitle: 'Generate due diligence checklist',
        taskType: 'due-diligence-check',
        dueDaysFromNow: 0,
      },
      {
        type: 'create_task',
        taskTitle: 'Coordinate building & pest inspection',
        taskType: 'inspection',
        dueDaysFromNow: 1,
      },
      {
        type: 'create_task',
        taskTitle: 'Confirm solicitor has contracts',
        taskType: 'document-review',
        dueDaysFromNow: 0,
      },
      {
        type: 'send_email',
        templateId: 'under-contract-congratulations-email',
      },
      {
        type: 'notify_agent',
        message: '{{contact.firstName}} under contract - DD checklist auto-generated',
      },
    ],
    category: 'settlement',
  },

  // ── 9. Settlement Countdown (7 Days) ──────────────────────────────────────
  {
    name: 'Settlement Countdown (7 Days)',
    description:
      'Triggers 7 days before the settlement date. Creates a pre-settlement inspection task, notifies the agent, and sends the client a settlement preparation email.',
    trigger: {
      type: 'date_approaching',
      field: 'settlementDate',
      daysBefore: 7,
    },
    conditions: [],
    actions: [
      {
        type: 'create_task',
        taskTitle: 'Arrange pre-settlement inspection',
        taskType: 'pre-settlement-inspection',
        dueDaysFromNow: 5,
      },
      {
        type: 'notify_agent',
        message: 'Settlement in 7 days for {{contact.firstName}}',
      },
      {
        type: 'send_email',
        templateId: 'settlement-preparation-email',
      },
    ],
    category: 'settlement',
  },

  // ── 10. Post-Settlement Nurture ───────────────────────────────────────────
  {
    name: 'Post-Settlement Nurture',
    description:
      'Fires when a deal moves to settled-nurture. Sends a congratulations email, waits 7 days then requests a Google review, waits another 7 days then requests a testimonial, schedules a 30-day check-in call, and a 6-month market update follow-up. Tags the contact as a past client.',
    trigger: {
      type: 'stage_change',
      to: 'settled-nurture',
    },
    conditions: [],
    actions: [
      {
        type: 'send_email',
        templateId: 'settlement-congratulations-email',
      },
      {
        type: 'wait',
        duration: '7d',
      },
      {
        type: 'send_email',
        templateId: 'google-review-request-email',
      },
      {
        type: 'wait',
        duration: '7d',
      },
      {
        type: 'send_email',
        templateId: 'testimonial-request-email',
      },
      {
        type: 'create_task',
        taskTitle: '30-day check-in with {{contact.firstName}}',
        taskType: 'call',
        dueDaysFromNow: 30,
      },
      {
        type: 'create_follow_up',
        daysFromNow: 180,
        taskType: 'follow-up',
      },
      {
        type: 'add_tag',
        tag: 'past-client',
      },
    ],
    category: 'nurture',
  },
];
