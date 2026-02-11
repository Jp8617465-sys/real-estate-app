'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth, usePortalClient } from './use-auth';
import type { KeyDateStatus } from '@realflow/shared';

const supabase = createClient();

export interface TimelineKeyDate {
  id: string;
  label: string;
  date: string;
  is_critical: boolean;
  status: KeyDateStatus;
  notes: string | null;
}

function computeStatus(date: string, currentStatus: string): KeyDateStatus {
  if (currentStatus === 'completed') return 'completed';

  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'due_soon';
  return 'upcoming';
}

export function useTimeline() {
  const { user } = useAuth();
  const { data: portalClient } = usePortalClient();

  return useQuery({
    queryKey: ['portal-timeline', portalClient?.contact_id],
    queryFn: async (): Promise<TimelineKeyDate[]> => {
      const contactId = portalClient!.contact_id;

      // Get active transaction
      const { data: transaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!transaction) return [];

      const { data, error } = await supabase
        .from('key_dates')
        .select('id, label, date, is_critical, status, notes')
        .eq('transaction_id', transaction.id)
        .order('date', { ascending: true });

      if (error) throw error;

      // Compute actual status based on current date
      return (data ?? []).map((kd) => ({
        ...kd,
        status: computeStatus(kd.date, kd.status),
      }));
    },
    enabled: !!user?.id && !!portalClient?.contact_id,
  });
}
