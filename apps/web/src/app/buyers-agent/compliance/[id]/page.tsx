export const dynamic = 'force-dynamic';

import ComplianceDetailClient from './compliance-detail-client';

export default function ComplianceDetailPage({ params }: { params: { id: string } }) {
  return <ComplianceDetailClient id={params.id} />;
}
