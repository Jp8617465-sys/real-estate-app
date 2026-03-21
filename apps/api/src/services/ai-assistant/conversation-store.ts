import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────────────────

export interface AiConversation {
  id: string;
  user_id: string;
  title: string | null;
  model: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_aud: number;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool_result';
  content: string | null;
  tool_calls: unknown[] | null;
  tool_results: unknown[] | null;
  token_usage: Record<string, unknown> | null;
  created_at: string;
}

export interface NewMessage {
  role: 'user' | 'assistant' | 'tool_result';
  content?: string;
  tool_calls?: unknown[];
  tool_results?: unknown[];
  token_usage?: Record<string, unknown>;
}

// ─── Conversation Store ─────────────────────────────────────────────

export class ConversationStore {
  constructor(private supabase: SupabaseClient) {}

  async createConversation(userId: string, title?: string): Promise<AiConversation> {
    const { data, error } = await this.supabase
      .from('ai_conversations')
      .insert({ user_id: userId, title: title ?? null })
      .select()
      .single();

    if (error) throw new Error(`Failed to create conversation: ${error.message}`);
    return data as AiConversation;
  }

  async getConversation(conversationId: string): Promise<AiConversation | null> {
    const { data, error } = await this.supabase
      .from('ai_conversations')
      .select()
      .eq('id', conversationId)
      .single();

    if (error) return null;
    return data as AiConversation;
  }

  async listConversations(userId: string, limit = 50): Promise<AiConversation[]> {
    const { data, error } = await this.supabase
      .from('ai_conversations')
      .select()
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to list conversations: ${error.message}`);
    return (data ?? []) as AiConversation[];
  }

  async updateConversation(
    conversationId: string,
    updates: Partial<Pick<AiConversation, 'title' | 'total_input_tokens' | 'total_output_tokens' | 'total_cost_aud' | 'message_count'>>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('ai_conversations')
      .update(updates)
      .eq('id', conversationId);

    if (error) throw new Error(`Failed to update conversation: ${error.message}`);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
  }

  async addMessage(conversationId: string, message: NewMessage): Promise<AiMessage> {
    const { data, error } = await this.supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: message.role,
        content: message.content ?? null,
        tool_calls: message.tool_calls ?? null,
        tool_results: message.tool_results ?? null,
        token_usage: message.token_usage ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add message: ${error.message}`);
    return data as AiMessage;
  }

  async getMessages(conversationId: string, limit = 100): Promise<AiMessage[]> {
    const { data, error } = await this.supabase
      .from('ai_messages')
      .select()
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Failed to get messages: ${error.message}`);
    return (data ?? []) as AiMessage[];
  }
}
