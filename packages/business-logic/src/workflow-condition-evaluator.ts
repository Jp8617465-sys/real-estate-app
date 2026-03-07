import type {
  WorkflowCondition,
  CompoundCondition,
  ConditionNode,
  ConditionOperator,
} from '@realflow/shared';
import type { WorkflowContext } from './workflow-engine';

// ─── Helpers ─────────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function isCompoundCondition(node: ConditionNode): node is CompoundCondition {
  return 'logic' in node;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ─── Operator Evaluators ─────────────────────────────────────────────

type OperatorEvaluator = (fieldValue: unknown, conditionValue: unknown) => boolean;

const OPERATOR_EVALUATORS: Record<ConditionOperator, OperatorEvaluator> = {
  equals: (fieldValue, conditionValue) => fieldValue === conditionValue,

  not_equals: (fieldValue, conditionValue) => fieldValue !== conditionValue,

  contains: (fieldValue, conditionValue) =>
    String(fieldValue ?? '').includes(String(conditionValue ?? '')),

  starts_with: (fieldValue, conditionValue) =>
    String(fieldValue ?? '').startsWith(String(conditionValue ?? '')),

  greater_than: (fieldValue, conditionValue) =>
    toNumber(fieldValue) > toNumber(conditionValue),

  less_than: (fieldValue, conditionValue) =>
    toNumber(fieldValue) < toNumber(conditionValue),

  is_empty: (fieldValue) =>
    fieldValue === null || fieldValue === undefined || fieldValue === '',

  is_not_empty: (fieldValue) =>
    fieldValue !== null && fieldValue !== undefined && fieldValue !== '',

  // ─── Date Operators ──────────────────────────────────────────────

  before: (fieldValue, conditionValue) => {
    const fieldDate = toDate(fieldValue);
    const compareDate = toDate(conditionValue);
    if (!fieldDate || !compareDate) return false;
    return fieldDate.getTime() < compareDate.getTime();
  },

  after: (fieldValue, conditionValue) => {
    const fieldDate = toDate(fieldValue);
    const compareDate = toDate(conditionValue);
    if (!fieldDate || !compareDate) return false;
    return fieldDate.getTime() > compareDate.getTime();
  },

  within_days: (fieldValue, conditionValue) => {
    const fieldDate = toDate(fieldValue);
    if (!fieldDate) return false;
    const days = toNumber(conditionValue);
    const now = new Date();
    const diffMs = Math.abs(fieldDate.getTime() - now.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  },

  // ─── Contact-Specific Operators ──────────────────────────────────

  has_tag: (fieldValue, conditionValue) => {
    if (!Array.isArray(fieldValue)) return false;
    return fieldValue.includes(String(conditionValue ?? ''));
  },

  in_stage: (fieldValue, conditionValue) => {
    if (typeof conditionValue === 'string') {
      return fieldValue === conditionValue;
    }
    if (Array.isArray(conditionValue)) {
      return conditionValue.includes(fieldValue as string);
    }
    return false;
  },

  lead_score_above: (fieldValue, conditionValue) =>
    toNumber(fieldValue) > toNumber(conditionValue),

  // ─── Property-Specific Operators ─────────────────────────────────

  price_range: (fieldValue, conditionValue) => {
    const price = toNumber(fieldValue);
    if (
      conditionValue !== null &&
      typeof conditionValue === 'object' &&
      !Array.isArray(conditionValue)
    ) {
      const range = conditionValue as Record<string, unknown>;
      const min = range.min !== undefined ? toNumber(range.min) : -Infinity;
      const max = range.max !== undefined ? toNumber(range.max) : Infinity;
      return price >= min && price <= max;
    }
    return false;
  },

  suburb_match: (fieldValue, conditionValue) => {
    const fieldSuburb = String(fieldValue ?? '').toLowerCase().trim();
    if (typeof conditionValue === 'string') {
      return fieldSuburb === conditionValue.toLowerCase().trim();
    }
    if (Array.isArray(conditionValue)) {
      return conditionValue.some(
        (s) => String(s).toLowerCase().trim() === fieldSuburb,
      );
    }
    return false;
  },

  days_on_market: (fieldValue, conditionValue) => {
    const listedDate = toDate(fieldValue);
    if (!listedDate) return false;
    const now = new Date();
    const diffMs = now.getTime() - listedDate.getTime();
    const daysOnMarket = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (
      conditionValue !== null &&
      typeof conditionValue === 'object' &&
      !Array.isArray(conditionValue)
    ) {
      const config = conditionValue as Record<string, unknown>;
      const min = config.min !== undefined ? toNumber(config.min) : 0;
      const max = config.max !== undefined ? toNumber(config.max) : Infinity;
      return daysOnMarket >= min && daysOnMarket <= max;
    }
    return daysOnMarket > toNumber(conditionValue);
  },
};

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Evaluate a single field-level condition against the workflow context.
 */
export function evaluateFieldCondition(
  condition: WorkflowCondition,
  context: WorkflowContext,
): boolean {
  const value = getNestedValue(context.entityData, condition.field);
  const evaluator = OPERATOR_EVALUATORS[condition.operator];

  if (!evaluator) {
    return false;
  }

  return evaluator(value, condition.value);
}

/**
 * Evaluate a condition node which may be a simple condition or a compound
 * (AND/OR/NOT) expression tree.
 */
export function evaluateConditionNode(
  node: ConditionNode,
  context: WorkflowContext,
): boolean {
  if (!isCompoundCondition(node)) {
    return evaluateFieldCondition(node, context);
  }

  switch (node.logic) {
    case 'AND':
      return node.conditions.every((child) =>
        evaluateConditionNode(child, context),
      );

    case 'OR':
      return node.conditions.some((child) =>
        evaluateConditionNode(child, context),
      );

    case 'NOT':
      return !evaluateConditionNode(node.condition, context);

    default:
      return false;
  }
}

/**
 * Evaluate an array of conditions using AND logic (backwards compatible
 * with the existing evaluateConditions behaviour).
 */
export function evaluateConditionNodes(
  conditions: ConditionNode[],
  context: WorkflowContext,
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((condition) =>
    evaluateConditionNode(condition, context),
  );
}
