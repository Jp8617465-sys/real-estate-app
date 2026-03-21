import { Suspense } from 'react';
import DashboardClient from './dashboard-client';
import { DailyActionList } from '@/components/dashboard/daily-action-list';
import { RestrictedBanner } from './restricted-banner';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Suspense>
        <RestrictedBanner />
      </Suspense>
      <DailyActionList />
      <DashboardClient />
    </div>
  );
}
