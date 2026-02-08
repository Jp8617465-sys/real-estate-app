import Link from 'next/link';
import { cn } from '@/lib/utils';

const properties = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    address: '42 Ocean Street, Bondi NSW 2026',
    type: 'House',
    beds: 4,
    baths: 2,
    cars: 2,
    landSize: 450,
    status: 'active',
    priceGuide: 'Auction',
    listPrice: 1800000,
    agent: 'James Chen',
    vendor: 'David Williams',
    enquiries: 12,
    inspections: 8,
  },
  {
    id: 'e0000000-0000-0000-0000-000000000002',
    address: '3/15 Crown Street, Surry Hills NSW 2010',
    type: 'Apartment',
    beds: 2,
    baths: 1,
    cars: 1,
    landSize: null,
    status: 'active',
    priceGuide: '$680,000',
    listPrice: 680000,
    agent: 'Emily Taylor',
    vendor: null,
    enquiries: 6,
    inspections: 3,
  },
  {
    id: 'e0000000-0000-0000-0000-000000000003',
    address: '8 View Road, Mosman NSW 2088',
    type: 'House',
    beds: 5,
    baths: 3,
    cars: 2,
    landSize: 650,
    status: 'pre-market',
    priceGuide: '$2.8M - $3.0M',
    listPrice: null,
    agent: 'Emily Taylor',
    vendor: null,
    enquiries: 0,
    inspections: 0,
  },
];

const statusColors: Record<string, string> = {
  'pre-market': 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  'under-offer': 'bg-blue-100 text-blue-700',
  sold: 'bg-purple-100 text-purple-700',
  withdrawn: 'bg-gray-100 text-gray-600',
};

export function PropertyGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {properties.map((property) => (
        <Link
          key={property.id}
          href={`/properties/${property.id}`}
          className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          {/* Placeholder image */}
          <div className="aspect-[16/10] bg-gradient-to-br from-gray-200 to-gray-300">
            <div className="flex h-full items-center justify-center text-4xl text-gray-400">
              🏠
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-gray-900 group-hover:text-brand-600">
                  {property.address}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">{property.type}</p>
              </div>
              <span
                className={cn(
                  'ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                  statusColors[property.status],
                )}
              >
                {property.status.replace('-', ' ')}
              </span>
            </div>

            {/* Features */}
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
              <span>{property.beds} bed</span>
              <span>{property.baths} bath</span>
              <span>{property.cars} car</span>
              {property.landSize && <span>{property.landSize}m²</span>}
            </div>

            {/* Price */}
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {property.priceGuide}
            </p>

            {/* Stats */}
            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500">{property.agent}</span>
              <div className="flex gap-3 text-xs text-gray-400">
                <span>{property.enquiries} enquiries</span>
                <span>{property.inspections} inspections</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
