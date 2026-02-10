'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth, usePortalClient } from './use-auth';

const supabase = createClient();

export interface DueDiligenceData {
  completion: number;
  items: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    assigned_to: string;
    is_blocking: boolean;
    notes: string | null;
  }>;
}

export function usePortalDueDiligence() {
  const { user } = useAuth();
  const { data: portalClient } = usePortalClient();

  return useQuery({
    queryKey: ['portal-due-diligence', portalClient?.contact_id],
    queryFn: async (): Promise<DueDiligenceData> => {
      const contactId = portalClient!.contact_id;

      // Get active transaction
      const { data: transaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!transaction) {
        return { completion: 0, items: [] };
      }

      // Get checklist with items
      const { data: checklist } = await supabase
        .from('due_diligence_checklists')
        .select('id, completion_percentage')
        .eq('transaction_id', transaction.id)
        .limit(1)
        .single();

      if (!checklist) {
        return { completion: 0, items: [] };
      }

      const { data: items, error } = await supabase
        .from('due_diligence_items')
        .select('id, name, category, status, assigned_to, is_blocking, notes')
        .eq('checklist_id', checklist.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Compute completion if not stored
      const completedCount = (items ?? []).filter(
        (i) => i.status === 'completed' || i.status === 'not_applicable',
      ).length;
      const totalCount = (items ?? []).length;
      const computedCompletion =
        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        completion: checklist.completion_percentage ?? computedCompletion,
        items: items ?? [],
      };
    },
    enabled: !!user?.id && !!portalClient?.contact_id,
  });
}
