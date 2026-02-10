'use client';

import { StatCard } from '@/components/dashboard/stat-card';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { PipelineOverview } from '@/components/dashboard/pipeline-overview';
import { UpcomingTasks } from '@/components/dashboard/upcoming-tasks';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { useProfile } from '@/hooks/use-settings';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: profile } = useProfile();

  const firstName = profile?.first_name ?? '';
  const overdueLabel = stats?.tasksOverdue
    ? `${stats.tasksOverdue} overdue`
    : 'None overdue';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back{firstName ? `, ${firstName}` : ''}. Here&apos;s your overview.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white shadow-sm" />
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Active Leads"
              value={String(stats?.activeLeads ?? 0)}
              change={stats?.activeLeadsChange ?? '+0 this week'}
              changeType="positive"
            />
            <StatCard
              title="Properties Listed"
              value={String(stats?.propertiesListed ?? 0)}
              change={stats?.propertiesChange ?? '+0 this week'}
              changeType="positive"
            />
            <StatCard
              title="Under Contract"
              value={String(stats?.underContract ?? 0)}
              change={stats?.underContractValue ?? '$0 total'}
              changeType="neutral"
            />
            <StatCard
              title="Tasks Due Today"
              value={String(stats?.tasksDueToday ?? 0)}
              change={overdueLabel}
              changeType={stats?.tasksOverdue ? 'negative' : 'neutral'}
            />
          </>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <PipelineOverview />
          <RecentActivity />
        </div>
        <div>
          <UpcomingTasks />
        </div>
      </div>
    </div>
  );
}
