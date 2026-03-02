import DomainIntegrationClient from './domain-integration-client';

export const metadata = {
  title: 'Domain Integration — RealFlow Settings',
  description: 'Connect and manage your Domain.com.au listing sync.',
};

export default function DomainIntegrationPage() {
  return <DomainIntegrationClient />;
}
