import { StatCard } from '@/components/dashboard/stat-card';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { PipelineOverview } from '@/components/dashboard/pipeline-overview';
import { UpcomingTasks } from '@/components/dashboard/upcoming-tasks';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome back, Sarah. Here&apos;s your overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Leads"
          value="24"
          change="+3 this week"
          changeType="positive"
        />
        <StatCard
          title="Properties Listed"
          value="8"
          change="+1 this week"
          changeType="positive"
        />
        <StatCard
          title="Under Contract"
          value="3"
          change="$2.4M total"
          changeType="neutral"
        />
        <StatCard
          title="Tasks Due Today"
          value="7"
          change="2 overdue"
          changeType="negative"
        />
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
