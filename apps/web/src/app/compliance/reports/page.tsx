import { AustracReportsClient } from './austrac-reports-client';

export const metadata = {
  title: 'AUSTRAC Reports -- Compliance -- RealFlow',
  description: 'AUSTRAC compliance reporting and suspicious matter reports',
};

export default function AustracReportsPage() {
  return <AustracReportsClient />;
}
