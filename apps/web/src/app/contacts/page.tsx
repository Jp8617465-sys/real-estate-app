import { ContactsTable } from '@/components/contacts/contacts-table';
import { ContactFilters } from '@/components/contacts/contact-filters';

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your contacts and leads</p>
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
          + Add Contact
        </button>
      </div>

      <ContactFilters />
      <ContactsTable />
    </div>
  );
}
