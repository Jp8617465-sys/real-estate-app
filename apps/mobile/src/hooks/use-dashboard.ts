import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  activeContacts: number;
  listedProperties: number;
  underContract: number;
  tasksDueToday: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const todayISO = today.toISOString();

      const [contactsResult, propertiesResult, contractsResult, tasksResult] = await Promise.all([
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('is_deleted', false),
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('is_deleted', false)
          .eq('listing_status', 'active'),
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('is_deleted', false)
          .eq('current_stage', 'under-contract'),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('is_deleted', false)
          .eq('status', 'pending')
          .lte('due_date', todayISO),
      ]);

      if (contactsResult.error) throw contactsResult.error;
      if (propertiesResult.error) throw propertiesResult.error;
      if (contractsResult.error) throw contractsResult.error;
      if (tasksResult.error) throw tasksResult.error;

      return {
        activeContacts: contactsResult.count ?? 0,
        listedProperties: propertiesResult.count ?? 0,
        underContract: contractsResult.count ?? 0,
        tasksDueToday: tasksResult.count ?? 0,
      } as DashboardStats;
    },
  });
}
