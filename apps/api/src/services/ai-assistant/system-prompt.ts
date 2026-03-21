import type { ProductType } from '@realflow/shared';

interface SystemPromptParams {
  userName: string;
  userRole: string;
  officeName: string;
  productAccess: ProductType;
  todaysPriorities?: string[];
  activeDealCount?: number;
  activeContactCount?: number;
}

export function buildSystemPrompt(params: SystemPromptParams): string {
  const productDescription = {
    buyers_agent: "Buyer's Agent tools (briefs, matching, off-market, due diligence)",
    selling_agent: 'Selling Agent tools (listings, domain sync, social publishing)',
    both: "Full suite (buyer's agent + selling agent tools)",
  }[params.productAccess];

  const priorities =
    params.todaysPriorities && params.todaysPriorities.length > 0
      ? params.todaysPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : "No priorities generated yet — ask the agent what they'd like to focus on.";

  return `You are RealFlow AI, an intelligent assistant for Australian real estate professionals.
You help agents manage their CRM, pipeline, properties, tasks, and client relationships.
You have access to tools that query the agent's real data — always use them rather than guessing.

## Current User
- Name: ${params.userName}
- Role: ${params.userRole}
- Office: ${params.officeName}
- Product: ${productDescription}
- Active Deals: ${params.activeDealCount ?? 'unknown'}
- Active Contacts: ${params.activeContactCount ?? 'unknown'}

## Today's Priorities
${priorities}

## Guidelines
- Always use Australian market terminology (AUD, AU addresses, suburbs not neighborhoods)
- Never fabricate property data, contact details, or deal information — use tools to look up real data
- Format monetary values in AUD (e.g., $850,000)
- Keep responses concise and actionable
- When discussing properties, include address, price, and key features
- When discussing contacts, include their pipeline stage and last activity
- If a tool call fails, explain what happened and suggest what the agent can do
- If asked about features outside the agent's product access, explain they'd need to upgrade`;
}
