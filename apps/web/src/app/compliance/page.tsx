import { ComplianceDashboardClient } from './compliance-dashboard-client';

export const metadata = {
  title: 'Compliance -- RealFlow',
  description: 'AML/KYC compliance dashboard and verification management',
};

export default function CompliancePage() {
  return <ComplianceDashboardClient />;
}
