const activities = [
  {
    id: '1',
    type: 'inspection',
    title: 'Michael Johnson inspected 42 Ocean St, Bondi',
    time: '2 hours ago',
    agent: 'James Chen',
  },
  {
    id: '2',
    type: 'new-lead',
    title: 'New enquiry from Domain: Sarah Peters',
    time: '3 hours ago',
    agent: 'Emily Taylor',
  },
  {
    id: '3',
    type: 'offer',
    title: 'Offer submitted on 15/3 Crown St, Surry Hills',
    time: '5 hours ago',
    agent: 'James Chen',
  },
  {
    id: '4',
    type: 'stage-change',
    title: 'Lisa Nguyen moved to Property Shortlisted',
    time: '1 day ago',
    agent: 'Emily Taylor',
  },
  {
    id: '5',
    type: 'call',
    title: 'Called David Williams re: listing update',
    time: '1 day ago',
    agent: 'Emily Taylor',
  },
];

const typeIcons: Record<string, string> = {
  inspection: '🔍',
  'new-lead': '🆕',
  offer: '💰',
  'stage-change': '📈',
  call: '📞',
};

export function RecentActivity() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
      <p className="mt-1 text-sm text-gray-500">Latest actions across the team</p>

      <div className="mt-4 divide-y divide-gray-100">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 text-lg">{typeIcons[activity.type] ?? '📌'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">{activity.title}</p>
              <p className="text-xs text-gray-500">
                {activity.agent} &middot; {activity.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
