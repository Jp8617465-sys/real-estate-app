'use client';

import { useRouter } from 'next/navigation';
import { useComplianceDashboard, useExpiringChecks } from '@/hooks/use-compliance';
import { ComplianceStatCard } from '@/components/compliance/compliance-stat-card';
import { VerificationStatusBadge } from '@/components/compliance/verification-status-badge';
import { formatDate, formatRelativeTime } from '@/lib/utils';

export function ComplianceDashboardClient() {
  const router = useRouter();
  const { data: dashboardData, isLoading, error } = useComplianceDashboard();
  const { data: expiringChecks } = useExpiringChecks(90);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
          <p className="mt-1 text-sm text-gray-500">AML/KYC verification and AUSTRAC reporting</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-gray-200 bg-gray-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
          <p className="mt-1 text-sm text-gray-500">AML/KYC verification and AUSTRAC reporting</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Failed to load compliance data. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  const stats = dashboardData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
          <p className="mt-1 text-sm text-gray-500">AML/KYC verification and AUSTRAC reporting</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/compliance/reports')}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            AUSTRAC Reports
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ComplianceStatCard
          title="Total Clients"
          value={stats?.totalClients ?? 0}
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
          }
        />
        <ComplianceStatCard
          title="Verified"
          value={stats?.verified ?? 0}
          variant="success"
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
              />
            </svg>
          }
        />
        <ComplianceStatCard
          title="Pending"
          value={stats?.pending ?? 0}
          variant="warning"
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <ComplianceStatCard
          title="Expired"
          value={stats?.expired ?? 0}
          variant="danger"
          subtitle={
            (stats?.expiringWithin90Days ?? 0) > 0
              ? `${stats?.expiringWithin90Days} expiring within 90 days`
              : undefined
          }
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          }
        />
        <ComplianceStatCard
          title="Failed"
          value={stats?.failed ?? 0}
          variant="danger"
          icon={
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          }
        />
      </div>

      {/* Expiring Checks Alert */}
      {(expiringChecks?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-orange-800">Upcoming Expiration Alerts</h3>
              <p className="mt-1 text-sm text-orange-700">
                {expiringChecks?.length} verification
                {(expiringChecks?.length ?? 0) !== 1 ? 's' : ''} expiring within the next 90 days.
                Re-verification is required before expiry.
              </p>
              <ul className="mt-2 space-y-1" role="list">
                {expiringChecks?.slice(0, 5).map((check: Record<string, unknown>) => {
                  const contact = check.contacts as Record<string, string> | null;
                  const contactName = contact
                    ? `${contact.first_name} ${contact.last_name}`
                    : 'Unknown';
                  return (
                    <li key={check.id as string} className="text-sm text-orange-700">
                      <button
                        onClick={() => router.push(`/compliance/verify/${check.contact_id}`)}
                        className="font-medium underline hover:text-orange-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                      >
                        {contactName}
                      </button>
                      {' -- expires '}
                      {formatDate(check.expiry_date as string)}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Verification Queue */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Verification Queue</h2>
            <p className="mt-0.5 text-xs text-gray-500">Clients awaiting identity verification</p>
          </div>
          <div className="divide-y divide-gray-100">
            {!stats?.pendingQueue || stats.pendingQueue.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg
                  className="mx-auto h-10 w-10 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-500">No clients pending verification</p>
              </div>
            ) : (
              stats.pendingQueue.map((item) => (
                <button
                  key={item.contactId}
                  onClick={() => router.push(`/compliance/verify/${item.contactId}`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{item.contactName}</p>
                    <p className="text-xs text-gray-500">
                      Added {formatRelativeTime(item.createdAt)}
                    </p>
                  </div>
                  <VerificationStatusBadge status={item.status} size="sm" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Recent Verifications */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Recent Verifications</h2>
            <p className="mt-0.5 text-xs text-gray-500">Latest AML/KYC verification activity</p>
          </div>
          <div className="divide-y divide-gray-100">
            {!stats?.recentVerifications || stats.recentVerifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg
                  className="mx-auto h-10 w-10 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-500">No recent verification activity</p>
              </div>
            ) : (
              stats.recentVerifications.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/compliance/verify/${item.contactId}`)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{item.contactName}</p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(item.createdAt)}</p>
                  </div>
                  <VerificationStatusBadge status={item.status} size="sm" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
