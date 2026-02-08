import { cn } from '@/lib/utils';

const tasks = [
  {
    id: '1',
    title: 'Call Michael re: second inspection',
    priority: 'high',
    dueLabel: 'Today',
    contact: 'Michael Johnson',
    type: 'call',
  },
  {
    id: '2',
    title: 'Schedule Lisa private inspection',
    priority: 'high',
    dueLabel: 'Today',
    contact: 'Lisa Nguyen',
    type: 'inspection',
  },
  {
    id: '3',
    title: 'Send property shortlist to Priya',
    priority: 'medium',
    dueLabel: 'Tomorrow',
    contact: 'Priya Patel',
    type: 'email',
  },
  {
    id: '4',
    title: 'Prepare vendor report for David',
    priority: 'high',
    dueLabel: 'Wed',
    contact: 'David Williams',
    type: 'general',
  },
  {
    id: '5',
    title: 'Follow up with Robert Clarke referral',
    priority: 'medium',
    dueLabel: 'Thu',
    contact: 'Robert Clarke',
    type: 'follow-up',
  },
];

const priorityColors: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-gray-300',
};

export function UpcomingTasks() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming Tasks</h2>
        <a href="/tasks" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          View all
        </a>
      </div>

      <div className="mt-4 space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              'rounded-lg border border-gray-200 border-l-4 bg-white p-3',
              priorityColors[task.priority],
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{task.contact}</p>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {task.dueLabel}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
