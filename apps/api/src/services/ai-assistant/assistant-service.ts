import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnthropicClient, ConversationMessage, ContentBlock, StreamEvent } from '@realflow/integrations';
import type { AITokenUsage, ProductType } from '@realflow/shared';
import { ConversationStore, type AiConversation, type AiMessage } from './conversation-store';
import { TOOL_DEFINITIONS, executeTool } from './tool-registry';
import { buildSystemPrompt } from './system-prompt';

// ─── Types ──────────────────────────────────────────────────────────

export interface AssistantChatParams {
  conversationId?: string;
  userMessage: string;
  userId: string;
  productAccess: ProductType;
}

export interface AssistantResponse {
  conversationId: string;
  message: string;
  toolCalls: Array<{ name: string; input: unknown; result: string }>;
  tokenUsage: AITokenUsage;
}

export interface AssistantStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
  text?: string;
  name?: string;
  success?: boolean;
  conversationId?: string;
  tokenUsage?: AITokenUsage;
  message?: string;
}

const MAX_TOOL_ITERATIONS = 5;
const MAX_HISTORY_MESSAGES = 20;

// ─── AssistantService ───────────────────────────────────────────────

export class AssistantService {
  private store: ConversationStore;

  constructor(
    private anthropicClient: AnthropicClient,
    private supabase: SupabaseClient,
  ) {
    this.store = new ConversationStore(supabase);
  }

  async chat(params: AssistantChatParams): Promise<AssistantResponse> {
    const { userId, userMessage, productAccess } = params;

    // Get or create conversation
    let conversationId = params.conversationId;
    if (!conversationId) {
      const conv = await this.store.createConversation(userId);
      conversationId = conv.id;
    }

    // Load conversation history
    const history = await this.store.getMessages(conversationId, MAX_HISTORY_MESSAGES);

    // Build system prompt with user context
    const systemPrompt = await this.buildContextualSystemPrompt(userId, productAccess);

    // Save user message
    await this.store.addMessage(conversationId, {
      role: 'user',
      content: userMessage,
    });

    // Convert DB messages to API format
    const messages = this.buildConversationMessages(history, userMessage);

    // Tool-calling loop
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostAud = 0;
    let model = '';
    const toolCallLog: Array<{ name: string; input: unknown; result: string }> = [];

    let currentMessages = messages;
    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      const response = await this.anthropicClient.chat({
        system: systemPrompt,
        messages: currentMessages,
        tools: TOOL_DEFINITIONS,
      });

      totalInputTokens += response.tokenUsage.inputTokens;
      totalOutputTokens += response.tokenUsage.outputTokens;
      totalCostAud += response.tokenUsage.estimatedCostAud;
      model = response.tokenUsage.model;

      if (response.stopReason !== 'tool_use') {
        // Final response — extract text
        const text = response.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text)
          .join('');

        // Save assistant message
        await this.store.addMessage(conversationId, {
          role: 'assistant',
          content: text,
          token_usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, model, estimatedCostAud: totalCostAud },
        });

        // Update conversation stats
        const messageCount = history.length + 2 + toolCallLog.length * 2; // user + assistant + tool pairs
        await this.updateConversationStats(conversationId, totalInputTokens, totalOutputTokens, totalCostAud, messageCount, userMessage);

        return {
          conversationId,
          message: text,
          toolCalls: toolCallLog,
          tokenUsage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            model,
            estimatedCostAud: totalCostAud,
          },
        };
      }

      // Process tool calls
      const toolUseBlocks = response.content.filter(
        (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
          b.type === 'tool_use',
      );

      // Save assistant message with tool calls
      await this.store.addMessage(conversationId, {
        role: 'assistant',
        tool_calls: toolUseBlocks.map((b) => ({ id: b.id, name: b.name, input: b.input })),
      });

      // Execute tools and build results
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      for (const block of toolUseBlocks) {
        const result = await executeTool(block.name, block.input, this.supabase, params.userId);
        toolCallLog.push({ name: block.name, input: block.input, result });
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }

      // Save tool results
      await this.store.addMessage(conversationId, {
        role: 'tool_result',
        tool_results: toolResults.map((r) => ({ tool_use_id: r.tool_use_id, content: r.content })),
      });

      // Append assistant + tool_result to conversation for next iteration
      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ];

      iteration++;
    }

    // Max iterations reached — return whatever text we have
    const fallbackText = 'I was working on your request but hit the tool iteration limit. Please try again with a more specific question.';
    await this.store.addMessage(conversationId, { role: 'assistant', content: fallbackText });

    return {
      conversationId,
      message: fallbackText,
      toolCalls: toolCallLog,
      tokenUsage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        model,
        estimatedCostAud: totalCostAud,
      },
    };
  }

  async *streamChat(params: AssistantChatParams): AsyncGenerator<AssistantStreamEvent> {
    const { userId, userMessage, productAccess } = params;

    let conversationId = params.conversationId;
    if (!conversationId) {
      const conv = await this.store.createConversation(userId);
      conversationId = conv.id;
    }

    const history = await this.store.getMessages(conversationId, MAX_HISTORY_MESSAGES);
    const systemPrompt = await this.buildContextualSystemPrompt(userId, productAccess);

    await this.store.addMessage(conversationId, { role: 'user', content: userMessage });

    let currentMessages: ConversationMessage[] = this.buildConversationMessages(history, userMessage);
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostAud = 0;
    let model = '';
    let iteration = 0;

    while (iteration < MAX_TOOL_ITERATIONS) {
      let fullText = '';
      const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
      let stopReason = 'end_turn';

      for await (const event of this.anthropicClient.streamChat({
        system: systemPrompt,
        messages: currentMessages,
        tools: TOOL_DEFINITIONS,
      })) {
        if (event.type === 'text') {
          fullText += event.text;
          yield { type: 'text', text: event.text };
        } else if (event.type === 'tool_use') {
          toolUseBlocks.push({ id: event.id, name: event.name, input: event.input });
          yield { type: 'tool_call', name: event.name };
          stopReason = 'tool_use';
        } else if (event.type === 'message_stop') {
          totalInputTokens += event.tokenUsage.inputTokens;
          totalOutputTokens += event.tokenUsage.outputTokens;
          totalCostAud += event.tokenUsage.estimatedCostAud;
          model = event.tokenUsage.model;
        } else if (event.type === 'error') {
          yield { type: 'error', message: event.error };
          return;
        }
      }

      if (stopReason !== 'tool_use') {
        // Final response
        await this.store.addMessage(conversationId, {
          role: 'assistant',
          content: fullText,
          token_usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, model, estimatedCostAud: totalCostAud },
        });

        const messageCount = history.length + 2;
        await this.updateConversationStats(conversationId, totalInputTokens, totalOutputTokens, totalCostAud, messageCount, userMessage);

        yield {
          type: 'done',
          conversationId,
          tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, model, estimatedCostAud: totalCostAud },
        };
        return;
      }

      // Process tool calls
      await this.store.addMessage(conversationId, {
        role: 'assistant',
        tool_calls: toolUseBlocks.map((b) => ({ id: b.id, name: b.name, input: b.input })),
      });

      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];
      for (const block of toolUseBlocks) {
        const result = await executeTool(block.name, block.input, this.supabase, params.userId);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        yield { type: 'tool_result', name: block.name, success: !result.includes('"error"') };
      }

      await this.store.addMessage(conversationId, {
        role: 'tool_result',
        tool_results: toolResults.map((r) => ({ tool_use_id: r.tool_use_id, content: r.content })),
      });

      // Build content blocks for the assistant message
      const assistantContent: ContentBlock[] = [];
      if (fullText) {
        assistantContent.push({ type: 'text', text: fullText });
      }
      for (const block of toolUseBlocks) {
        assistantContent.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: assistantContent },
        { role: 'user' as const, content: toolResults },
      ];

      iteration++;
    }

    yield { type: 'error', message: 'Tool iteration limit reached' };
  }

  async getConversations(userId: string): Promise<AiConversation[]> {
    return this.store.listConversations(userId);
  }

  async getConversationMessages(conversationId: string): Promise<AiMessage[]> {
    return this.store.getMessages(conversationId);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.store.deleteConversation(conversationId);
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private async buildContextualSystemPrompt(userId: string, productAccess: ProductType): Promise<string> {
    // Fetch user context in parallel
    const [userResult, dealCountResult, contactCountResult, prioritiesResult] = await Promise.all([
      this.supabase
        .from('users')
        .select('first_name, last_name, role, offices(name)')
        .eq('id', userId)
        .single(),
      this.supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false),
      this.supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', false),
      this.supabase
        .from('daily_action_items')
        .select('title')
        .eq('date', new Date().toISOString().split('T')[0])
        .eq('is_completed', false)
        .order('rank', { ascending: true })
        .limit(5),
    ]);

    const user = userResult.data;
    const officeName =
      user && typeof user.offices === 'object' && user.offices !== null && 'name' in user.offices
        ? (user.offices as { name: string }).name
        : 'Unknown Office';

    return buildSystemPrompt({
      userName: user ? `${user.first_name} ${user.last_name}` : 'Agent',
      userRole: user?.role ?? 'agent',
      officeName,
      productAccess,
      activeDealCount: dealCountResult.count ?? undefined,
      activeContactCount: contactCountResult.count ?? undefined,
      todaysPriorities: (prioritiesResult.data ?? []).map((p) => p.title),
    });
  }

  private buildConversationMessages(
    history: AiMessage[],
    newUserMessage: string,
  ): ConversationMessage[] {
    const messages: ConversationMessage[] = [];

    for (const msg of history) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content ?? '' });
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          // Assistant message with tool calls
          const content: ContentBlock[] = [];
          if (msg.content) {
            content.push({ type: 'text', text: msg.content });
          }
          for (const tc of msg.tool_calls as Array<{ id: string; name: string; input: Record<string, unknown> }>) {
            content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
          }
          messages.push({ role: 'assistant', content });
        } else {
          messages.push({ role: 'assistant', content: msg.content ?? '' });
        }
      } else if (msg.role === 'tool_result') {
        if (msg.tool_results && Array.isArray(msg.tool_results)) {
          messages.push({
            role: 'user',
            content: (msg.tool_results as Array<{ tool_use_id: string; content: string }>).map((r) => ({
              type: 'tool_result' as const,
              tool_use_id: r.tool_use_id,
              content: r.content,
            })),
          });
        }
      }
    }

    messages.push({ role: 'user', content: newUserMessage });
    return messages;
  }

  private async updateConversationStats(
    conversationId: string,
    inputTokens: number,
    outputTokens: number,
    costAud: number,
    messageCount: number,
    firstMessage?: string,
  ): Promise<void> {
    const conv = await this.store.getConversation(conversationId);
    const updates: Record<string, unknown> = {
      total_input_tokens: (conv?.total_input_tokens ?? 0) + inputTokens,
      total_output_tokens: (conv?.total_output_tokens ?? 0) + outputTokens,
      total_cost_aud: (conv?.total_cost_aud ?? 0) + costAud,
      message_count: messageCount,
    };

    // Auto-generate title from first message
    if (!conv?.title && firstMessage) {
      updates.title = firstMessage.slice(0, 100) + (firstMessage.length > 100 ? '...' : '');
    }

    await this.store.updateConversation(conversationId, updates);
  }
}
