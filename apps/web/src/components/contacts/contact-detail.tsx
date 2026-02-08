'use client';

import { cn } from '@/lib/utils';

interface ContactDetailProps {
  contactId: string;
}

export function ContactDetail({ contactId }: ContactDetailProps) {
  // In production, this would fetch from Supabase via React Query
  const contact = {
    id: contactId,
    firstName: 'Michael',
    lastName: 'Johnson',
    email: 'michael.j@email.com',
    phone: '0413 111 001',
    types: ['buyer'] as string[],
    source: 'domain',
    assignedAgent: 'James Chen',
    communicationPreference: 'phone',
    tags: ['hot-lead', 'pre-approved'],
    buyerProfile: {
      budgetMin: 800000,
      budgetMax: 1200000,
      preApproved: true,
      preApprovalAmount: 1100000,
      suburbs: ['Bondi', 'Coogee', 'Randwick'],
      propertyTypes: ['house', 'townhouse'],
      bedrooms: { min: 3 },
      bathrooms: { min: 2 },
      carSpaces: { min: 1 },
      mustHaves: ['north-facing', 'outdoor space'],
      dealBreakers: ['main road'],
    },
    score: 82,
  };

  const activities = [
    { id: '1', type: 'inspection', title: 'Inspected 42 Ocean St, Bondi', time: '2 hours ago', description: 'Very interested. Wants to do second inspection.' },
    { id: '2', type: 'property-sent', title: 'Sent 5 property matches', time: '2 days ago', description: 'Properties in Bondi, Coogee matching criteria' },
    { id: '3', type: 'call', title: 'Initial discovery call', time: '5 days ago', description: 'Discussed budget, preferences. Pre-approved for $1.1M.' },
  ];

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
            {contact.firstName[0]}{contact.lastName[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {contact.firstName} {contact.lastName}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              {contact.types.map((type) => (
                <span
                  key={type}
                  className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium capitalize text-green-700"
                >
                  {type}
                </span>
              ))}
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  contact.score >= 75 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700',
                )}
              >
                Score: {contact.score}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Edit
          </button>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Log Activity
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Contact Info */}
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Contact Info</h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs text-gray-500">Email</dt>
                <dd className="text-sm text-gray-900">{contact.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Phone</dt>
                <dd className="text-sm text-gray-900">{contact.phone}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Source</dt>
                <dd className="text-sm capitalize text-gray-900">{contact.source}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Assigned Agent</dt>
                <dd className="text-sm text-gray-900">{contact.assignedAgent}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Preference</dt>
                <dd className="text-sm capitalize text-gray-900">{contact.communicationPreference}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {contact.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Buyer Profile */}
          {contact.buyerProfile && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Buyer Profile</h2>
              <dl className="mt-4 space-y-3">
                <div>
                  <dt className="text-xs text-gray-500">Budget</dt>
                  <dd className="text-sm text-gray-900">
                    {formatCurrency(contact.buyerProfile.budgetMin)} – {formatCurrency(contact.buyerProfile.budgetMax)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Pre-Approval</dt>
                  <dd className="text-sm text-gray-900">
                    {contact.buyerProfile.preApproved ? formatCurrency(contact.buyerProfile.preApprovalAmount) : 'Not pre-approved'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Property Types</dt>
                  <dd className="text-sm capitalize text-gray-900">
                    {contact.buyerProfile.propertyTypes.join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Bedrooms</dt>
                  <dd className="text-sm text-gray-900">{contact.buyerProfile.bedrooms.min}+</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Suburbs</dt>
                  <dd className="text-sm text-gray-900">{contact.buyerProfile.suburbs.join(', ')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Must Haves</dt>
                  <dd className="text-sm text-gray-900">{contact.buyerProfile.mustHaves.join(', ')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Deal Breakers</dt>
                  <dd className="text-sm text-red-600">{contact.buyerProfile.dealBreakers.join(', ')}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Activity Timeline</h2>
            <div className="mt-4 space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex gap-3 border-l-2 border-gray-200 pl-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    {activity.description && (
                      <p className="mt-0.5 text-sm text-gray-600">{activity.description}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
