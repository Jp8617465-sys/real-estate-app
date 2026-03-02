import DashboardClient from './dashboard-client';
import { DailyActionList } from '@/components/dashboard/daily-action-list';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <DailyActionList />
      <DashboardClient />
    </div>
  );
}
