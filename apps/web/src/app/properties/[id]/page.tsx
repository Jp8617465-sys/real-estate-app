interface PropertyPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Property Detail</h1>
      <p className="text-sm text-gray-500">Property ID: {id}</p>
      <p className="text-sm text-gray-500">
        Full property detail view with photos, listing info, interested buyers, inspection history,
        and vendor reports will be built here.
      </p>
    </div>
  );
}
