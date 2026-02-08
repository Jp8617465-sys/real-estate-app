import { cn } from '@/lib/utils';

const tasks = [
  { id: '1', title: 'Call Michael re: second inspection of 42 Ocean St', type: 'call', priority: 'high', status: 'pending', contact: 'Michael Johnson', dueDate: 'Today', agent: 'James Chen' },
  { id: '2', title: 'Schedule Lisa private inspection at 8 View Rd', type: 'inspection', priority: 'high', status: 'pending', contact: 'Lisa Nguyen', dueDate: 'Today', agent: 'Emily Taylor' },
  { id: '3', title: 'Send property shortlist to Priya', type: 'email', priority: 'medium', status: 'pending', contact: 'Priya Patel', dueDate: 'Tomorrow', agent: 'James Chen' },
  { id: '4', title: 'Prepare vendor report for David Williams', type: 'general', priority: 'high', status: 'pending', contact: 'David Williams', dueDate: 'Wed', agent: 'Emily Taylor' },
  { id: '5', title: 'Follow up with Robert Clarke referral', type: 'follow-up', priority: 'medium', status: 'pending', contact: 'Robert Clarke', dueDate: 'Thu', agent: 'Sarah Mitchell' },
  { id: '6', title: 'Update listing photos for 42 Ocean St', type: 'marketing', priority: 'low', status: 'pending', contact: 'David Williams', dueDate: 'Fri', agent: 'James Chen' },
];

const priorityColors: Record<string, string> = {
  urgent: 'text-red-700 bg-red-50',
  high: 'text-orange-700 bg-orange-50',
  medium: 'text-yellow-700 bg-yellow-50',
  low: 'text-gray-600 bg-gray-50',
};

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your to-do list and follow-ups</p>
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
          + Add Task
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-6 py-3" />
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Task</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Due</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                  <p className="text-xs capitalize text-gray-500">{task.type}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{task.contact}</td>
                <td className="px-6 py-4">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      priorityColors[task.priority],
                    )}
                  >
                    {task.priority}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{task.dueDate}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{task.agent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
