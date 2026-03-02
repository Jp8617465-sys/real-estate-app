'use client';

import type { SequenceStep } from '@realflow/shared';

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  send_email: { label: 'Send Email', icon: '📧' },
  send_sms: { label: 'Send SMS', icon: '💬' },
  create_task: { label: 'Create Task', icon: '✅' },
  notify_agent: { label: 'Notify Agent', icon: '🔔' },
  add_tag: { label: 'Add Tag', icon: '🏷️' },
  update_field: { label: 'Update Field', icon: '✏️' },
};

interface SequenceStepListProps {
  steps: SequenceStep[];
}

export function SequenceStepList({ steps }: SequenceStepListProps) {
  if (steps.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">No steps configured</p>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 pl-6 space-y-6">
      {steps.map((step, index) => {
        const actionType = step.action?.type ?? '';
        const actionMeta = ACTION_LABELS[actionType] ?? { label: actionType, icon: '⚙️' };

        const dayLabel =
          step.dayOffset === 0
            ? 'Immediately'
            : step.dayOffset < 0
            ? `${Math.abs(step.dayOffset)} day${Math.abs(step.dayOffset) !== 1 ? 's' : ''} before`
            : `Day ${step.dayOffset}`;

        return (
          <li key={index} className="relative">
            {/* Timeline dot */}
            <div className="absolute -left-[25px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand-100 shadow-sm">
              <span className="text-[10px] font-bold text-brand-700">{index + 1}</span>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              {/* Step header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{actionMeta.icon}</span>
                  <span className="text-sm font-semibold text-gray-900">{actionMeta.label}</span>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {dayLabel}
                </span>
              </div>

              {/* Action details */}
              {actionType === 'send_email' && step.action && (() => {
                const emailAction = step.action as Record<string, unknown>;
                return (emailAction.subject || emailAction.useAiContent) ? (
                  <div className="mt-2 space-y-1">
                    {!!emailAction.subject && (
                      <p className="text-xs text-gray-700">
                        <span className="font-medium">Subject:</span> {String(emailAction.subject)}
                      </p>
                    )}
                    {!!emailAction.useAiContent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        ✨ AI-generated content
                      </span>
                    )}
                  </div>
                ) : null;
              })()}

              {actionType === 'send_sms' && step.action && (() => {
                const smsAction = step.action as Record<string, unknown>;
                return smsAction.useAiContent ? (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      ✨ AI-generated content
                    </span>
                  </div>
                ) : null;
              })()}

              {actionType === 'create_task' && step.action && 'taskTitle' in step.action && (
                <p className="mt-2 text-xs text-gray-700">
                  <span className="font-medium">Task:</span> {step.action.taskTitle}
                </p>
              )}

              {actionType === 'add_tag' && step.action && 'tag' in step.action && (
                <p className="mt-2">
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {step.action.tag}
                  </span>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
