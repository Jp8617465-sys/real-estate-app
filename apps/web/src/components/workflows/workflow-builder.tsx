'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { WorkflowTrigger, WorkflowCondition, WorkflowAction } from '@realflow/shared';

// ─── Trigger Type Options ─────────────────────────────────────────

const TRIGGER_TYPES = [
  { value: 'stage_change', label: 'Stage Change' },
  { value: 'new_lead', label: 'New Lead' },
  { value: 'time_based', label: 'Scheduled (Time Based)' },
  { value: 'field_change', label: 'Field Change' },
  { value: 'no_activity', label: 'No Activity' },
  { value: 'date_approaching', label: 'Date Approaching' },
  { value: 'form_submitted', label: 'Form Submitted' },
] as const;

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
] as const;

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'create_task', label: 'Create Task' },
  { value: 'assign_contact', label: 'Assign Contact' },
  { value: 'update_field', label: 'Update Field' },
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'notify_agent', label: 'Notify Agent' },
  { value: 'post_social', label: 'Post to Social' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'wait', label: 'Wait' },
  { value: 'create_follow_up', label: 'Create Follow-Up' },
] as const;

// ─── Props ────────────────────────────────────────────────────────

interface WorkflowBuilderProps {
  initialTrigger?: WorkflowTrigger;
  initialConditions?: WorkflowCondition[];
  initialActions?: WorkflowAction[];
  initialName?: string;
  initialDescription?: string;
  onSave: (data: {
    name: string;
    description: string;
    trigger: WorkflowTrigger;
    conditions: WorkflowCondition[];
    actions: WorkflowAction[];
  }) => void;
  isSaving?: boolean;
}

// ─── Component ────────────────────────────────────────────────────

export function WorkflowBuilder({
  initialTrigger,
  initialConditions,
  initialActions,
  initialName,
  initialDescription,
  onSave,
  isSaving,
}: WorkflowBuilderProps) {
  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [triggerType, setTriggerType] = useState<string>(initialTrigger?.type ?? 'new_lead');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>(() => {
    if (!initialTrigger) return {};
    const config: Record<string, string> = {};
    Object.entries(initialTrigger).forEach(([key, val]) => {
      if (key !== 'type' && val !== undefined) config[key] = String(val);
    });
    return config;
  });

  const [conditions, setConditions] = useState<WorkflowCondition[]>(initialConditions ?? []);
  const [actions, setActions] = useState<Array<{ type: string; config: Record<string, string> }>>(() => {
    if (!initialActions?.length) return [];
    return initialActions.map((action) => {
      const config: Record<string, string> = {};
      Object.entries(action).forEach(([key, val]) => {
        if (key !== 'type' && val !== undefined) {
          config[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
      });
      return { type: action.type, config };
    });
  });

  // ─── Trigger Builder ────────────────────────────────────────────

  function buildTrigger(): WorkflowTrigger {
    switch (triggerType) {
      case 'stage_change':
        return {
          type: 'stage_change',
          to: triggerConfig.to ?? '',
          ...(triggerConfig.from ? { from: triggerConfig.from } : {}),
        };
      case 'new_lead':
        return {
          type: 'new_lead',
          ...(triggerConfig.source ? { source: triggerConfig.source as 'domain' } : {}),
        };
      case 'time_based':
        return { type: 'time_based', schedule: triggerConfig.schedule ?? '0 9 * * *' };
      case 'field_change':
        return { type: 'field_change', field: triggerConfig.field ?? '' };
      case 'no_activity':
        return { type: 'no_activity', days: parseInt(triggerConfig.days ?? '2', 10) };
      case 'date_approaching':
        return {
          type: 'date_approaching',
          field: triggerConfig.field ?? '',
          daysBefore: parseInt(triggerConfig.daysBefore ?? '7', 10),
        };
      case 'form_submitted':
        return { type: 'form_submitted', formId: triggerConfig.formId ?? '' };
      default:
        return { type: 'new_lead' };
    }
  }

  // ─── Build Actions ──────────────────────────────────────────────

  function buildActions(): WorkflowAction[] {
    return actions.map((a) => {
      switch (a.type) {
        case 'send_email':
          return { type: 'send_email' as const, templateId: a.config.templateId ?? '' };
        case 'send_sms':
          return { type: 'send_sms' as const, templateId: a.config.templateId ?? '' };
        case 'create_task':
          return {
            type: 'create_task' as const,
            taskTitle: a.config.taskTitle ?? '',
            taskType: a.config.taskType ?? 'general',
            dueDaysFromNow: parseInt(a.config.dueDaysFromNow ?? '0', 10),
          };
        case 'assign_contact':
          return { type: 'assign_contact' as const, agentId: a.config.agentId ?? '' };
        case 'update_field':
          return { type: 'update_field' as const, field: a.config.field ?? '', value: a.config.value ?? '' };
        case 'add_tag':
          return { type: 'add_tag' as const, tag: a.config.tag ?? '' };
        case 'notify_agent':
          return { type: 'notify_agent' as const, message: a.config.message ?? '' };
        case 'post_social':
          return {
            type: 'post_social' as const,
            platforms: (a.config.platforms ?? 'facebook').split(',').map((p) => p.trim()),
            templateId: a.config.templateId ?? '',
          };
        case 'webhook':
          return {
            type: 'webhook' as const,
            url: a.config.url ?? '',
            payload: JSON.parse(a.config.payload || '{}'),
          };
        case 'wait':
          return { type: 'wait' as const, duration: a.config.duration ?? '1d' };
        case 'create_follow_up':
          return {
            type: 'create_follow_up' as const,
            daysFromNow: parseInt(a.config.daysFromNow ?? '7', 10),
            taskType: a.config.taskType ?? 'follow-up',
          };
        default:
          return { type: 'notify_agent' as const, message: '' };
      }
    });
  }

  // ─── Condition Handlers ─────────────────────────────────────────

  function addCondition() {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  }

  function removeCondition(index: number) {
    setConditions(conditions.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, updates: Partial<WorkflowCondition>) {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  }

  // ─── Action Handlers ───────────────────────────────────────────

  function addAction() {
    setActions([...actions, { type: 'notify_agent', config: {} }]);
  }

  function removeAction(index: number) {
    setActions(actions.filter((_, i) => i !== index));
  }

  function updateAction(index: number, updates: { type?: string; config?: Record<string, string> }) {
    setActions(
      actions.map((a, i) => {
        if (i !== index) return a;
        return {
          type: updates.type ?? a.type,
          config: updates.config ?? a.config,
        };
      }),
    );
  }

  function moveAction(index: number, direction: 'up' | 'down') {
    const newActions = [...actions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newActions.length) return;
    [newActions[index]!, newActions[newIndex]!] = [newActions[newIndex]!, newActions[index]!];
    setActions(newActions);
  }

  // ─── Submit ─────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name,
      description,
      trigger: buildTrigger(),
      conditions,
      actions: buildActions(),
    });
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Name & Description */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Workflow Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="e.g., New Lead Auto-Response"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="What does this workflow do?"
          />
        </div>
      </div>

      {/* Trigger */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Trigger</h3>
        <p className="text-xs text-gray-500">When should this workflow fire?</p>
        <select
          value={triggerType}
          onChange={(e) => {
            setTriggerType(e.target.value);
            setTriggerConfig({});
          }}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {TRIGGER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Type-specific trigger fields */}
        {triggerType === 'stage_change' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500">From Stage (optional)</label>
              <input
                type="text"
                value={triggerConfig.from ?? ''}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, from: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g., offer-made"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">To Stage</label>
              <input
                type="text"
                value={triggerConfig.to ?? ''}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, to: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g., under-contract"
              />
            </div>
          </div>
        )}

        {triggerType === 'field_change' && (
          <div>
            <label className="block text-xs text-gray-500">Field Name</label>
            <input
              type="text"
              value={triggerConfig.field ?? ''}
              onChange={(e) => setTriggerConfig({ ...triggerConfig, field: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g., clientBriefSignedOff"
            />
          </div>
        )}

        {triggerType === 'no_activity' && (
          <div>
            <label className="block text-xs text-gray-500">Days of Inactivity</label>
            <input
              type="number"
              value={triggerConfig.days ?? '2'}
              onChange={(e) => setTriggerConfig({ ...triggerConfig, days: e.target.value })}
              min={1}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        {triggerType === 'date_approaching' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500">Date Field</label>
              <input
                type="text"
                value={triggerConfig.field ?? ''}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, field: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g., settlementDate"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Days Before</label>
              <input
                type="number"
                value={triggerConfig.daysBefore ?? '7'}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, daysBefore: e.target.value })}
                min={1}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {triggerType === 'form_submitted' && (
          <div>
            <label className="block text-xs text-gray-500">Form ID</label>
            <input
              type="text"
              value={triggerConfig.formId ?? ''}
              onChange={(e) => setTriggerConfig({ ...triggerConfig, formId: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g., contact-form-1"
            />
          </div>
        )}

        {triggerType === 'time_based' && (
          <div>
            <label className="block text-xs text-gray-500">Cron Schedule</label>
            <input
              type="text"
              value={triggerConfig.schedule ?? '0 9 * * *'}
              onChange={(e) => setTriggerConfig({ ...triggerConfig, schedule: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="0 9 * * * (9am daily)"
            />
          </div>
        )}

        {triggerType === 'new_lead' && (
          <div>
            <label className="block text-xs text-gray-500">Source Filter (optional)</label>
            <input
              type="text"
              value={triggerConfig.source ?? ''}
              onChange={(e) => setTriggerConfig({ ...triggerConfig, source: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g., domain, rea, manual"
            />
          </div>
        )}
      </div>

      {/* Conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Conditions</h3>
            <p className="text-xs text-gray-500">All conditions must be true (AND logic)</p>
          </div>
          <button
            type="button"
            onClick={addCondition}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            + Add Condition
          </button>
        </div>

        {conditions.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
            No conditions - workflow will run every time the trigger fires.
          </p>
        )}

        {conditions.map((condition, index) => (
          <div key={index} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <input
              type="text"
              value={condition.field}
              onChange={(e) => updateCondition(index, { field: e.target.value })}
              className="block w-1/3 rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="Field name"
            />
            <select
              value={condition.operator}
              onChange={(e) => updateCondition(index, { operator: e.target.value as WorkflowCondition['operator'] })}
              className="block rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              {CONDITION_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            {condition.operator !== 'is_empty' && condition.operator !== 'is_not_empty' && (
              <input
                type="text"
                value={String(condition.value ?? '')}
                onChange={(e) => updateCondition(index, { value: e.target.value })}
                className="block flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Value"
              />
            )}
            <button
              type="button"
              onClick={() => removeCondition(index)}
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            >
              X
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Actions</h3>
            <p className="text-xs text-gray-500">Steps executed in order when triggered</p>
          </div>
          <button
            type="button"
            onClick={addAction}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            + Add Action
          </button>
        </div>

        {actions.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
            Add at least one action.
          </p>
        )}

        {actions.map((action, index) => (
          <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {index + 1}
              </span>
              <select
                value={action.type}
                onChange={(e) => updateAction(index, { type: e.target.value, config: {} })}
                className="block flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {ACTION_TYPES.map((at) => (
                  <option key={at.value} value={at.value}>{at.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveAction(index, 'up')}
                  disabled={index === 0}
                  className="rounded p-1 text-gray-400 hover:bg-gray-200 disabled:opacity-30"
                >
                  ^
                </button>
                <button
                  type="button"
                  onClick={() => moveAction(index, 'down')}
                  disabled={index === actions.length - 1}
                  className="rounded p-1 text-gray-400 hover:bg-gray-200 disabled:opacity-30"
                >
                  v
                </button>
                <button
                  type="button"
                  onClick={() => removeAction(index)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                >
                  X
                </button>
              </div>
            </div>

            {/* Type-specific action fields */}
            <div className="mt-2 space-y-2">
              {(action.type === 'send_email' || action.type === 'send_sms') && (
                <input
                  type="text"
                  value={action.config.templateId ?? ''}
                  onChange={(e) => updateAction(index, { config: { ...action.config, templateId: e.target.value } })}
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="Template ID"
                />
              )}

              {action.type === 'create_task' && (
                <>
                  <input
                    type="text"
                    value={action.config.taskTitle ?? ''}
                    onChange={(e) => updateAction(index, { config: { ...action.config, taskTitle: e.target.value } })}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Task title"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={action.config.taskType ?? 'general'}
                      onChange={(e) => updateAction(index, { config: { ...action.config, taskType: e.target.value } })}
                      className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="Task type"
                    />
                    <input
                      type="number"
                      value={action.config.dueDaysFromNow ?? '0'}
                      onChange={(e) => updateAction(index, { config: { ...action.config, dueDaysFromNow: e.target.value } })}
                      className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="Due in days"
                      min={0}
                    />
                  </div>
                </>
              )}

              {action.type === 'notify_agent' && (
                <input
                  type="text"
                  value={action.config.message ?? ''}
                  onChange={(e) => updateAction(index, { config: { ...action.config, message: e.target.value } })}
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="Notification message"
                />
              )}

              {action.type === 'add_tag' && (
                <input
                  type="text"
                  value={action.config.tag ?? ''}
                  onChange={(e) => updateAction(index, { config: { ...action.config, tag: e.target.value } })}
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="Tag name"
                />
              )}

              {action.type === 'wait' && (
                <input
                  type="text"
                  value={action.config.duration ?? '1d'}
                  onChange={(e) => updateAction(index, { config: { ...action.config, duration: e.target.value } })}
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="Duration (e.g., 7d, 24h, 30m)"
                />
              )}

              {action.type === 'create_follow_up' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={action.config.daysFromNow ?? '7'}
                    onChange={(e) => updateAction(index, { config: { ...action.config, daysFromNow: e.target.value } })}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Days from now"
                    min={1}
                  />
                  <input
                    type="text"
                    value={action.config.taskType ?? 'follow-up'}
                    onChange={(e) => updateAction(index, { config: { ...action.config, taskType: e.target.value } })}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Task type"
                  />
                </div>
              )}

              {action.type === 'assign_contact' && (
                <input
                  type="text"
                  value={action.config.agentId ?? ''}
                  onChange={(e) => updateAction(index, { config: { ...action.config, agentId: e.target.value } })}
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="Agent ID (UUID)"
                />
              )}

              {action.type === 'update_field' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={action.config.field ?? ''}
                    onChange={(e) => updateAction(index, { config: { ...action.config, field: e.target.value } })}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Field name"
                  />
                  <input
                    type="text"
                    value={action.config.value ?? ''}
                    onChange={(e) => updateAction(index, { config: { ...action.config, value: e.target.value } })}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="New value"
                  />
                </div>
              )}

              {action.type === 'webhook' && (
                <>
                  <input
                    type="url"
                    value={action.config.url ?? ''}
                    onChange={(e) => updateAction(index, { config: { ...action.config, url: e.target.value } })}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Webhook URL"
                  />
                  <textarea
                    value={action.config.payload ?? '{}'}
                    onChange={(e) => updateAction(index, { config: { ...action.config, payload: e.target.value } })}
                    rows={2}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
                    placeholder="JSON payload"
                  />
                </>
              )}

              {action.type === 'post_social' && (
                <>
                  <input
                    type="text"
                    value={action.config.platforms ?? 'facebook'}
                    onChange={(e) => updateAction(index, { config: { ...action.config, platforms: e.target.value } })}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Platforms (comma-separated)"
                  />
                  <input
                    type="text"
                    value={action.config.templateId ?? ''}
                    onChange={(e) => updateAction(index, { config: { ...action.config, templateId: e.target.value } })}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    placeholder="Template ID"
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving || !name || actions.length === 0}
          className={cn(
            'rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700',
            (isSaving || !name || actions.length === 0) && 'opacity-50 cursor-not-allowed',
          )}
        >
          {isSaving ? 'Saving...' : 'Save Workflow'}
        </button>
      </div>
    </form>
  );
}
