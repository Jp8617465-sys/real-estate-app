import { PropertyGrid } from '@/components/properties/property-grid';

export default function PropertiesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <p className="mt-1 text-sm text-gray-500">Manage listings and property records</p>
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
          + Add Property
        </button>
      </div>

      <PropertyGrid />
    </div>
  );
}
