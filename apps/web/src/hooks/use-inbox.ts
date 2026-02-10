import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
  ConversationMessage,
  InboxFilter,
  MessageChannel,
  SendMessageRequest,
} from '@realflow/shared';

const supabase = createClient();

// ─── Inbox Thread List ──────────────────────────────────────────────────

export function useInboxThreads(filters?: InboxFilter) {
  return useQuery({
    queryKey: ['inbox-threads', filters],
    queryFn: async () => {
      let query = supabase
        .from('inbox_thread_summaries')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (filters?.agentId) {
        query = query.eq('agent_id', filters.agentId);
      }

      if (filters?.channels?.length) {
        query = query.in('last_message_channel', filters.channels);
      }

      if (filters?.isRead === false) {
        query = query.gt('unread_count', 0);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Poll every 30s for new messages
  });
}

// ─── Contact Conversation Thread ────────────────────────────────────────

export function useConversationThread(contactId: string, channelFilter?: MessageChannel) {
  return useQuery({
    queryKey: ['conversation', contactId, channelFilter],
    queryFn: async () => {
      let query = supabase
        .from('conversation_messages')
        .select('*', { count: 'exact' })
        .eq('contact_id', contactId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (channelFilter) {
        query = query.eq('channel', channelFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { messages: data as ConversationMessage[], totalMessages: count ?? 0 };
    },
    enabled: !!contactId,
    refetchInterval: 15000, // Poll every 15s when viewing a conversation
  });
}

// ─── Send Message ───────────────────────────────────────────────────────

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (msg: SendMessageRequest) => {
      // Get current user
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .single();

      if (!userData) throw new Error('User not found');

      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          channel: msg.channel,
          direction: 'outbound',
          contact_id: msg.contactId,
          agent_id: userData.id,
          content: msg.content,
          metadata: {},
          property_id: msg.propertyId ?? null,
          transaction_id: msg.transactionId ?? null,
          status: 'delivered',
          is_read: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversation', data.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-unread'] });
    },
  });
}

// ─── Mark as Read ───────────────────────────────────────────────────────

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('conversation_messages')
        .update({ is_read: true })
        .eq('contact_id', contactId)
        .eq('direction', 'inbound')
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-threads'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-unread'] });
    },
  });
}

// ─── Unread Counts ──────────────────────────────────────────────────────

export function useUnreadCounts(agentId?: string) {
  return useQuery({
    queryKey: ['inbox-unread', agentId],
    queryFn: async () => {
      let query = supabase
        .from('conversation_messages')
        .select('channel')
        .eq('direction', 'inbound')
        .eq('is_read', false)
        .eq('is_deleted', false);

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const counts: Record<string, number> = {};
      let total = 0;

      for (const row of data ?? []) {
        const channel = (row as Record<string, unknown>).channel as string;
        counts[channel] = (counts[channel] ?? 0) + 1;
        total++;
      }

      return { counts, total };
    },
    refetchInterval: 15000,
  });
}

// ─── Search Messages ────────────────────────────────────────────────────

export function useSearchMessages(query: string) {
  return useQuery({
    queryKey: ['inbox-search', query],
    queryFn: async () => {
      if (!query) return [];

      const { data, error } = await supabase
        .from('conversation_messages')
        .select('*, contacts!inner(first_name, last_name)')
        .eq('is_deleted', false)
        .or(
          `content->>text.ilike.%${query}%,content->>subject.ilike.%${query}%`,
        )
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: query.length >= 2,
  });
}

// ─── Contact Channels ───────────────────────────────────────────────────

export function useContactChannels(contactId: string) {
  return useQuery({
    queryKey: ['contact-channels', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_channels')
        .select('*')
        .eq('contact_id', contactId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });
}
