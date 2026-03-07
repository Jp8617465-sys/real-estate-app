import { ClientVerificationClient } from './client-verification-client';

interface PageProps {
  params: { contactId: string };
}

export function generateMetadata({ params: _params }: PageProps) {
  return {
    title: `Verify Client -- Compliance -- RealFlow`,
    description: 'AML/KYC client identity verification',
  };
}

export default function ClientVerificationPage({ params }: PageProps) {
  return <ClientVerificationClient contactId={params.contactId} />;
}
