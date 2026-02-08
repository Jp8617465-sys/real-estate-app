'use client';

import { useState } from 'react';

const contactTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'buyer', label: 'Buyers' },
  { value: 'seller', label: 'Sellers' },
  { value: 'investor', label: 'Investors' },
  { value: 'landlord', label: 'Landlords' },
  { value: 'tenant', label: 'Tenants' },
  { value: 'referral-source', label: 'Referral Sources' },
  { value: 'past-client', label: 'Past Clients' },
];

const sources = [
  { value: 'all', label: 'All Sources' },
  { value: 'domain', label: 'Domain' },
  { value: 'rea', label: 'REA' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'referral', label: 'Referral' },
  { value: 'website', label: 'Website' },
  { value: 'open-home', label: 'Open Home' },
];

export function ContactFilters() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {contactTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>

      <select
        value={sourceFilter}
        onChange={(e) => setSourceFilter(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {sources.map((source) => (
          <option key={source.value} value={source.value}>
            {source.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Search contacts..."
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
