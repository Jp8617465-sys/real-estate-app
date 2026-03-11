/**
 * Pre-built follow-up sequence templates for buyers agents.
 * These are seeded into the DB on startup via seedSequenceTemplates().
 */

import type { FollowUpSequence } from '@realflow/shared';

export const SEQUENCE_TEMPLATES: Omit<
  FollowUpSequence,
  'id' | 'createdBy' | 'isDeleted' | 'createdAt' | 'updatedAt'
>[] = [
  {
    name: 'New Enquiry Nurture',
    description:
      'Multi-touch sequence for new buyer enquiries — immediate response, follow-up call, check-in email, and re-engagement SMS.',
    category: 'lead_nurture',
    triggerType: 'new_lead',
    triggerConfig: {},
    isTemplate: true,
    isActive: true,
    steps: [
      {
        index: 0,
        dayOffset: 0,
        action: { type: 'send_email', templateId: 'new-enquiry-welcome', aiDraft: true },
        skipIfResponded: false,
        label: 'Day 0: Welcome email',
      },
      {
        index: 1,
        dayOffset: 0,
        action: { type: 'send_sms', templateId: 'new-enquiry-sms', aiDraft: true },
        skipIfResponded: false,
        label: 'Day 0: Welcome SMS',
      },
      {
        index: 2,
        dayOffset: 2,
        action: {
          type: 'create_task',
          taskTitle: 'Call new enquiry',
          taskType: 'call',
          priority: 'high',
        },
        skipIfResponded: false,
        label: 'Day 2: Follow-up call task',
      },
      {
        index: 3,
        dayOffset: 7,
        action: { type: 'send_email', templateId: 'check-in-email', aiDraft: true },
        skipIfResponded: true,
        label: 'Day 7: Check-in email (if no response)',
      },
      {
        index: 4,
        dayOffset: 14,
        action: { type: 'send_sms', templateId: 're-engage-sms', aiDraft: true },
        skipIfResponded: true,
        label: 'Day 14: Re-engagement SMS',
      },
    ],
  },

  {
    name: 'Post-Engagement Welcome',
    description:
      'Onboarding sequence after a client signs the engagement agreement — welcome, brief collection, and check-in.',
    category: 'onboarding',
    triggerType: 'stage_change',
    triggerConfig: { to: 'engaged' },
    isTemplate: true,
    isActive: true,
    steps: [
      {
        index: 0,
        dayOffset: 0,
        action: { type: 'send_email', templateId: 'engagement-welcome', aiDraft: true },
        skipIfResponded: false,
        label: 'Day 0: Welcome email',
      },
      {
        index: 1,
        dayOffset: 3,
        action: {
          type: 'create_task',
          taskTitle: 'Collect property brief',
          taskType: 'brief-review',
          priority: 'high',
        },
        skipIfResponded: false,
        label: 'Day 3: Brief collection task',
      },
      {
        index: 2,
        dayOffset: 7,
        action: { type: 'send_email', templateId: 'engagement-check-in', aiDraft: true },
        skipIfResponded: true,
        label: 'Day 7: Check-in email',
      },
    ],
  },

  {
    name: 'Property Match Alert',
    description:
      'Immediate notification when a high-scoring property match is found — push notification, email, then follow-up call task if no response.',
    category: 'property_match',
    triggerType: 'manual',
    triggerConfig: { minMatchScore: 75 },
    isTemplate: true,
    isActive: true,
    steps: [
      {
        index: 0,
        dayOffset: 0,
        action: {
          type: 'notify_agent',
          message: 'New high-scoring property match found — review and notify client.',
        },
        skipIfResponded: false,
        label: 'Immediate: Notify agent',
      },
      {
        index: 1,
        dayOffset: 0,
        action: { type: 'send_email', templateId: 'property-match-alert', aiDraft: true },
        skipIfResponded: false,
        label: 'Immediate: Email client',
      },
      {
        index: 2,
        dayOffset: 2,
        action: {
          type: 'create_task',
          taskTitle: 'Call client about property match',
          taskType: 'call',
          priority: 'high',
        },
        skipIfResponded: true,
        label: 'Day 2: Call task if no response',
      },
    ],
  },

  {
    name: 'Pre-Settlement Countdown',
    description:
      'Settlement preparation sequence — DD checklist, email reminders, urgent push notification, and final call task.',
    category: 'settlement',
    triggerType: 'date_approaching',
    triggerConfig: { dateType: 'settlement', daysBeforeCount: 14 },
    isTemplate: true,
    isActive: true,
    steps: [
      {
        index: 0,
        dayOffset: 0,
        action: {
          type: 'create_task',
          taskTitle: 'Review DD checklist — settlement in 14 days',
          taskType: 'due-diligence-check',
          priority: 'urgent',
        },
        skipIfResponded: false,
        label: 'D-14: DD checklist task',
      },
      {
        index: 1,
        dayOffset: 7,
        action: { type: 'send_email', templateId: 'settlement-reminder-7-days', aiDraft: true },
        skipIfResponded: false,
        label: 'D-7: Email reminder',
      },
      {
        index: 2,
        dayOffset: 11,
        action: {
          type: 'notify_agent',
          message: 'URGENT: Settlement in 3 days — confirm all checks complete.',
        },
        skipIfResponded: false,
        label: 'D-3: Urgent agent notification',
      },
      {
        index: 3,
        dayOffset: 13,
        action: {
          type: 'create_task',
          taskTitle: 'Final call before settlement',
          taskType: 'call',
          priority: 'urgent',
        },
        skipIfResponded: false,
        label: 'D-1: Final call task',
      },
    ],
  },

  {
    name: 'Stale Lead Re-engagement',
    description:
      'Re-engage leads with no activity in 30+ days — friendly email, SMS nudge, call task, and stale tag if still no response.',
    category: 'reengagement',
    triggerType: 'no_activity',
    triggerConfig: { daysInactive: 30 },
    isTemplate: true,
    isActive: true,
    steps: [
      {
        index: 0,
        dayOffset: 0,
        action: { type: 'send_email', templateId: 're-engagement-email', aiDraft: true },
        skipIfResponded: false,
        label: 'Day 0: Re-engagement email',
      },
      {
        index: 1,
        dayOffset: 7,
        action: { type: 'send_sms', templateId: 're-engagement-sms', aiDraft: true },
        skipIfResponded: true,
        label: 'Day 7: SMS nudge',
      },
      {
        index: 2,
        dayOffset: 14,
        action: {
          type: 'create_task',
          taskTitle: 'Call stale lead',
          taskType: 'call',
          priority: 'medium',
        },
        skipIfResponded: true,
        label: 'Day 14: Call task',
      },
      {
        index: 3,
        dayOffset: 21,
        action: { type: 'add_tag', tag: 'stale' },
        skipIfResponded: true,
        label: 'Day 21: Tag as stale',
      },
    ],
  },
];

/**
 * Seed the 5 template sequences into the DB (upsert by name + is_template).
 * Safe to call multiple times — idempotent.
 */
export async function seedSequenceTemplates(supabase: {
  from: (table: string) => {
    upsert: (
      data: Record<string, unknown>[],
      opts: { onConflict: string; ignoreDuplicates: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  };
}): Promise<void> {
  const rows = SEQUENCE_TEMPLATES.map((t) => ({
    name: t.name,
    description: t.description ?? null,
    category: t.category,
    trigger_type: t.triggerType,
    trigger_config: t.triggerConfig,
    steps: t.steps,
    is_template: true,
    is_active: true,
    created_by: null,
    is_deleted: false,
  }));

  const { error } = await supabase
    .from('follow_up_sequences')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: true });

  if (error) {
    console.warn('[sequence-templates] seed failed:', error.message);
  }
}
