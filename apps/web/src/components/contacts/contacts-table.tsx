import Link from 'next/link';
import { cn } from '@/lib/utils';

const contacts = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    firstName: 'Michael',
    lastName: 'Johnson',
    email: 'michael.j@email.com',
    phone: '0413 111 001',
    types: ['buyer'],
    source: 'domain',
    agent: 'James Chen',
    stage: 'Active Search',
    score: 82,
    lastContact: '2 hours ago',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    firstName: 'Priya',
    lastName: 'Patel',
    email: 'priya.p@email.com',
    phone: '0413 111 002',
    types: ['buyer', 'investor'],
    source: 'referral',
    agent: 'James Chen',
    stage: 'Qualified Lead',
    score: 45,
    lastContact: '3 days ago',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    firstName: 'David',
    lastName: 'Williams',
    email: 'david.w@email.com',
    phone: '0413 111 003',
    types: ['seller'],
    source: 'website',
    agent: 'Emily Taylor',
    stage: 'On Market',
    score: 70,
    lastContact: '1 day ago',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    firstName: 'Lisa',
    lastName: 'Nguyen',
    email: 'lisa.n@email.com',
    phone: '0413 111 004',
    types: ['buyer'],
    source: 'open-home',
    agent: 'Emily Taylor',
    stage: 'Property Shortlisted',
    score: 90,
    lastContact: '1 day ago',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000005',
    firstName: 'Robert',
    lastName: 'Clarke',
    email: 'robert.c@lawfirm.com.au',
    phone: '0413 111 005',
    types: ['referral-source'],
    source: 'referral',
    agent: 'Sarah Mitchell',
    stage: '-',
    score: 0,
    lastContact: '1 week ago',
  },
];

function ScoreBadge({ score }: { score: number }) {
  if (score === 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        score >= 75 && 'bg-red-100 text-red-700',
        score >= 50 && score < 75 && 'bg-yellow-100 text-yellow-700',
        score >= 25 && score < 50 && 'bg-blue-100 text-blue-700',
        score < 25 && 'bg-gray-100 text-gray-600',
      )}
    >
      {score >= 75 ? 'Hot' : score >= 50 ? 'Warm' : score >= 25 ? 'Cool' : 'Cold'}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    buyer: 'bg-green-100 text-green-700',
    seller: 'bg-purple-100 text-purple-700',
    investor: 'bg-blue-100 text-blue-700',
    landlord: 'bg-orange-100 text-orange-700',
    tenant: 'bg-teal-100 text-teal-700',
    'referral-source': 'bg-pink-100 text-pink-700',
    'past-client': 'bg-gray-100 text-gray-600',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        colors[type] ?? 'bg-gray-100 text-gray-600',
      )}
    >
      {type.replace('-', ' ')}
    </span>
  );
}

export function ContactsTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Source
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Stage
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Score
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Agent
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Last Contact
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {contacts.map((contact) => (
            <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
              <td className="whitespace-nowrap px-6 py-4">
                <Link
                  href={`/contacts/${contact.id}`}
                  className="group flex items-center"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-brand-600">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{contact.phone}</p>
                  </div>
                </Link>
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <div className="flex gap-1">
                  {contact.types.map((type) => (
                    <TypeBadge key={type} type={type} />
                  ))}
                </div>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm capitalize text-gray-600">
                {contact.source}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                {contact.stage}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <ScoreBadge score={contact.score} />
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                {contact.agent}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {contact.lastContact}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
