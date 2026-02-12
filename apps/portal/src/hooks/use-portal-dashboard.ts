'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth, usePortalClient } from './use-auth';
import type { BuyersAgentStage } from '@realflow/shared';
import { fromDbSchema } from '@realflow/business-logic';

const supabase = createClient();

interface DashboardData {
  currentStage: BuyersAgentStage;
  transactionId: string | null;
  briefStat: string;
  propertiesCount: number;
  ddCompletion: number;
  keyDatesCount: number;
  documentsCount: number;
  unreadMessagesCount: number;
}

export function usePortalDashboard() {
  const { user } = useAuth();
  const { data: portalClient } = usePortalClient();

  return useQuery({
    queryKey: ['portal-dashboard', portalClient?.contact_id],
    queryFn: async (): Promise<DashboardData> => {
      const contactId = portalClient!.contact_id;
      const agentId = portalClient!.agent_id;

      // Fetch transaction
      const { data: transaction } = await supabase
        .from('transactions')
        .select('id, current_stage')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const transactionId = transaction?.id ?? null;
      const currentStage = (transaction?.current_stage ?? 'enquiry') as BuyersAgentStage;

      // Fetch brief stat
      const { data: briefData } = await supabase
        .from('client_briefs')
        .select('brief_version, client_signed_off')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const briefStat = briefData
        ? `v${briefData.brief_version} - ${briefData.client_signed_off ? 'Signed Off' : 'Draft'}`
        : 'Not started';

      // Fetch property matches count
      const { count: propertiesCount } = await supabase
        .from('property_matches')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', contactId);

      // Fetch DD completion
      let ddCompletion = 0;
      if (transactionId) {
        const { data: checklist } = await supabase
          .from('due_diligence_checklists')
          .select('completion_percentage')
          .eq('transaction_id', transactionId)
          .limit(1)
          .single();

        ddCompletion = checklist?.completion_percentage ?? 0;
      }

      // Fetch key dates count
      let keyDatesCount = 0;
      if (transactionId) {
        const { count } = await supabase
          .from('key_dates')
          .select('id', { count: 'exact', head: true })
          .eq('transaction_id', transactionId)
          .in('status', ['upcoming', 'due_soon']);

        keyDatesCount = count ?? 0;
      }

      // Fetch documents count
      const { count: documentsCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', contactId)
        .eq('is_deleted', false);

      // Fetch unread messages count
      const { count: unreadMessagesCount } = await supabase
        .from('conversation_messages')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', contactId)
        .eq('direction', 'inbound')
        .eq('is_read', false)
        .eq('is_deleted', false);

      return {
        currentStage,
        transactionId,
        briefStat,
        propertiesCount: propertiesCount ?? 0,
        ddCompletion,
        keyDatesCount,
        documentsCount: documentsCount ?? 0,
        unreadMessagesCount: unreadMessagesCount ?? 0,
      };
    },
    enabled: !!user?.id && !!portalClient?.contact_id,
  });
}
