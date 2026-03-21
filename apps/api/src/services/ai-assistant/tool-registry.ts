import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnthropicToolDefinition } from '@realflow/integrations';
import { getPipelineOverview, getDealDetails } from './tools/pipeline-tools';
import { searchContacts, getContactTimeline } from './tools/contact-tools';
import { searchProperties, getPropertyAlerts } from './tools/property-tools';
import { createTask } from './tools/task-tools';
import { getTodaysPriorities } from './tools/daily-action-tools';
import { getDealHealth, getSubscriptionStatus } from './tools/health-tools';

// ─── Tool Definitions (Anthropic format) ─────────────────────────────

export const TOOL_DEFINITIONS: AnthropicToolDefinition[] = [
  {
    name: 'get_pipeline_overview',
    description:
      "Get the agent's current pipeline with all deals, stages, and values. Use this to understand the agent's active workload.",
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_deal_details',
    description:
      'Get detailed info about a specific deal including recent activities and tasks.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The UUID of the deal/transaction' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'search_contacts',
    description: 'Search contacts by name, email, phone, or type.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term (name, email, or phone)' },
        contact_type: {
          type: 'string',
          description: 'Filter by contact type',
          enum: ['buyer', 'seller', 'investor', 'landlord', 'tenant', 'referral-source', 'past-client'],
        },
        limit: { type: 'number', description: 'Max results to return (default 10, max 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_contact_timeline',
    description: 'Get the activity timeline for a specific contact.',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'The UUID of the contact' },
        limit: { type: 'number', description: 'Max activities to return (default 20, max 50)' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'search_properties',
    description: 'Search properties by suburb, price range, bedrooms, or property type.',
    input_schema: {
      type: 'object',
      properties: {
        suburb: { type: 'string', description: 'Suburb name to filter by' },
        min_price: { type: 'number', description: 'Minimum listing price in AUD' },
        max_price: { type: 'number', description: 'Maximum listing price in AUD' },
        bedrooms: { type: 'number', description: 'Minimum number of bedrooms' },
        property_type: {
          type: 'string',
          description: 'Property type filter',
          enum: ['house', 'unit', 'townhouse', 'villa', 'land', 'rural', 'apartment', 'duplex', 'studio', 'acreage', 'retirement', 'commercial'],
        },
        limit: { type: 'number', description: 'Max results to return (default 10, max 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_todays_priorities',
    description:
      "Get the agent's prioritized action list for today, including overdue tasks, follow-ups, and key dates.",
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_property_alerts',
    description: 'Get active property alert subscriptions and recent alert events.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max subscriptions to return (default 10, max 50)' },
      },
      required: [],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task for the agent.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        due_date: { type: 'string', description: 'ISO 8601 due date (defaults to tomorrow)' },
        priority: {
          type: 'string',
          description: 'Task priority',
          enum: ['low', 'medium', 'high', 'urgent'],
        },
        contact_id: { type: 'string', description: 'Optional contact UUID to link the task to' },
        type: {
          type: 'string',
          description: 'Task type',
          enum: [
            'call', 'email', 'sms', 'meeting', 'inspection', 'follow-up',
            'document-review', 'appraisal', 'listing-preparation', 'marketing',
            'open-home', 'auction-prep', 'settlement-task', 'general',
          ],
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_deal_health',
    description:
      'Calculate the health score for a specific deal. Returns a grade (A-F), component scores, and recommendations.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'The UUID of the deal/transaction' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'get_subscription_status',
    description: "Get the current subscription tier, status, and limits for the agent's office.",
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ─── Tool Executor ──────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  try {
    switch (toolName) {
      case 'get_pipeline_overview':
        return await getPipelineOverview(supabase);
      case 'get_deal_details':
        return await getDealDetails(supabase, toolInput);
      case 'search_contacts':
        return await searchContacts(supabase, toolInput);
      case 'get_contact_timeline':
        return await getContactTimeline(supabase, toolInput);
      case 'search_properties':
        return await searchProperties(supabase, toolInput);
      case 'get_todays_priorities':
        return await getTodaysPriorities(supabase);
      case 'get_property_alerts':
        return await getPropertyAlerts(supabase, toolInput);
      case 'create_task':
        return await createTask(supabase, toolInput, userId);
      case 'get_deal_health':
        return await getDealHealth(supabase, toolInput);
      case 'get_subscription_status':
        return await getSubscriptionStatus(supabase);
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ error: `Tool execution failed: ${message}` });
  }
}
