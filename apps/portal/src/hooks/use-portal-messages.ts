'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth, usePortalClient } from './use-auth';

const supabase = createClient();

export interface PortalMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  content: {
    text?: string;
    html?: string;
    subject?: string;
    attachments?: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
    }>;
  };
  created_at: string;
  is_read: boolean;
}

export function usePortalMessages() {
  const { user } = useAuth();
  const { data: portalClient } = usePortalClient();

  return useQuery({
    queryKey: ['portal-messages', portalClient?.contact_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('id, direction, content, created_at, is_read')
        .eq('contact_id', portalClient!.contact_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as PortalMessage[];
    },
    enabled: !!user?.id && !!portalClient?.contact_id,
    refetchInterval: 30000, // Poll every 30 seconds for new messages
  });
}

interface SendMessageParams {
  text: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { data: portalClient } = usePortalClient();

  return useMutation({
    mutationFn: async ({ text }: SendMessageParams) => {
      const contactId = portalClient!.contact_id;
      const agentId = portalClient!.agent_id;

      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          channel: 'portal_notification',
          direction: 'outbound',
          contact_id: contactId,
          agent_id: agentId,
          content: { text },
          metadata: {},
          status: 'delivered',
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-messages'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    },
  });
}
