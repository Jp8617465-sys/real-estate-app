import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Dashboard Stats ────────────────────────────────────────────────────

interface DashboardStats {
  activeLeads: number;
  activeLeadsChange: string;
  propertiesListed: number;
  propertiesChange: string;
  underContract: number;
  underContractValue: string;
  tasksDueToday: number;
  tasksOverdue: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Active leads: contacts with buyer type, not deleted
      const { count: activeLeads } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .contains('types', ['buyer']);

      // Leads created this week
      const { count: leadsThisWeek } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .contains('types', ['buyer'])
        .gte('created_at', weekAgo);

      // Properties listed (active)
      const { count: propertiesListed } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('listing_status', 'active');

      // Properties created this week
      const { count: propertiesThisWeek } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('listing_status', 'active')
        .gte('created_at', weekAgo);

      // Under contract transactions
      const { count: underContract } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('current_stage', 'under-contract');

      // Sum of offer amounts for under-contract
      const { data: contractData } = await supabase
        .from('transactions')
        .select('offer_amount')
        .eq('current_stage', 'under-contract');

      const totalContractValue = (contractData ?? []).reduce(
        (sum: number, row: Record<string, unknown>) => sum + ((row.offer_amount as number) ?? 0),
        0,
      );

      // Tasks due today
      const { count: tasksDueToday } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .gte('due_date', todayStart)
        .lt('due_date', todayEnd);

      // Overdue tasks
      const { count: tasksOverdue } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('due_date', todayStart);

      const formatCurrency = (amount: number): string => {
        if (amount >= 1_000_000) {
          return `$${(amount / 1_000_000).toFixed(1)}M`;
        }
        if (amount >= 1_000) {
          return `$${(amount / 1_000).toFixed(0)}K`;
        }
        return `$${amount}`;
      };

      return {
        activeLeads: activeLeads ?? 0,
        activeLeadsChange: `+${leadsThisWeek ?? 0} this week`,
        propertiesListed: propertiesListed ?? 0,
        propertiesChange: `+${propertiesThisWeek ?? 0} this week`,
        underContract: underContract ?? 0,
        underContractValue: `${formatCurrency(totalContractValue)} total`,
        tasksDueToday: tasksDueToday ?? 0,
        tasksOverdue: tasksOverdue ?? 0,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

// ─── Pipeline Overview ──────────────────────────────────────────────────

export function usePipelineOverview() {
  return useQuery({
    queryKey: ['pipeline-overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('current_stage');

      if (error) throw error;

      // Group by stage
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const stage = (row as Record<string, unknown>).current_stage as string;
        counts[stage] = (counts[stage] ?? 0) + 1;
      }

      return counts;
    },
    refetchInterval: 60000,
  });
}

// ─── Recent Activity ────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  created_at: string;
  created_by: string;
  agent_name?: string;
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*, users!created_by(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data ?? []).map((row: Record<string, unknown>) => {
        const user = row.users as Record<string, string> | null;
        const agentName = user ? `${user.first_name} ${user.last_name}` : 'Unknown';

        return {
          id: row.id as string,
          type: row.type as string,
          title: row.title as string,
          description: row.description as string | null,
          created_at: row.created_at as string,
          created_by: row.created_by as string,
          agent_name: agentName,
        } satisfies ActivityItem;
      });
    },
    refetchInterval: 30000,
  });
}

// ─── Upcoming Tasks ─────────────────────────────────────────────────────

interface UpcomingTask {
  id: string;
  title: string;
  priority: string;
  due_date: string;
  type: string;
  contact_name?: string;
}

export function useUpcomingTasks() {
  return useQuery({
    queryKey: ['upcoming-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, contacts!contact_id(first_name, last_name)')
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      return (data ?? []).map((row: Record<string, unknown>) => {
        const contact = row.contacts as Record<string, string> | null;
        const contactName = contact
          ? `${contact.first_name} ${contact.last_name}`
          : undefined;

        return {
          id: row.id as string,
          title: row.title as string,
          priority: row.priority as string,
          due_date: row.due_date as string,
          type: row.type as string,
          contact_name: contactName,
        } satisfies UpcomingTask;
      });
    },
    refetchInterval: 60000,
  });
}
