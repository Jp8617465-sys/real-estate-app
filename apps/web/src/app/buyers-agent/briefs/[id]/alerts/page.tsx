import { BriefAlertsClient } from './alerts-client';

export default async function BriefAlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BriefAlertsClient briefId={id} />;
}
