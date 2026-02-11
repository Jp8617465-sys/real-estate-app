'use client';

import { useRecentActivity } from '@/hooks/use-dashboard';

const typeIcons: Record<string, string> = {
  inspection: '🔍',
  'inspection-logged': '🔍',
  'new-lead': '🆕',
  'offer-submitted': '💰',
  'offer-round': '💰',
  'stage-change': '📈',
  call: '📞',
  'email-sent': '📧',
  'email-received': '📧',
  'sms-sent': '💬',
  'sms-received': '💬',
  meeting: '🤝',
  'note-added': '📝',
  'task-completed': '✅',
  'document-uploaded': '📄',
  'contract-exchanged': '📋',
  'settlement-completed': '🏠',
  'social-dm-sent': '📱',
  'social-dm-received': '📱',
  'property-matched': '🎯',
  system: '⚙️',
};

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function RecentActivity() {
  const { data: activities, isLoading } = useRecentActivity();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
      <p className="mt-1 text-sm text-gray-500">Latest actions across the team</p>

      {isLoading ? (
        <div className="mt-4 animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-gray-100">
          {(activities ?? []).length === 0 ? (
            <p className="py-4 text-sm text-gray-400">No recent activity</p>
          ) : (
            (activities ?? []).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 text-lg">{typeIcons[activity.type] ?? '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.title}</p>
                  <p className="text-xs text-gray-500">
                    {activity.agent_name} &middot; {formatTimeAgo(activity.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
