'use client';

import Link from 'next/link';
import {
  FileText,
  Home,
  FolderOpen,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Eye,
  Star,
  Gavel,
} from 'lucide-react';
import type { BuyersAgentStage } from '@realflow/shared';
import { BUYERS_AGENT_STAGE_LABELS, BUYERS_AGENT_STAGE_ORDER } from '@realflow/shared';
import { usePortalClient } from '@/hooks/use-auth';
import { usePortalDashboard } from '@/hooks/use-portal-dashboard';
import { LoadingSpinner } from '@/components/loading-spinner';

interface QuickLink {
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  stat?: string;
}

const ALL_STAGES = Object.entries(BUYERS_AGENT_STAGE_ORDER)
  .sort(([, a], [, b]) => a - b)
  .map(([stage]) => stage as BuyersAgentStage);

export default function DashboardPage() {
  const { data: portalClient, isLoading: isClientLoading } = usePortalClient();
  const { data: dashboard, isLoading: isDashboardLoading } = usePortalDashboard();

  const isLoading = isClientLoading || isDashboardLoading;

  if (isLoading) {
    return <LoadingSpinner message="Loading your dashboard..." />;
  }

  const clientName = portalClient?.contact?.first_name ?? 'there';
  const currentStage: BuyersAgentStage = dashboard?.currentStage ?? 'enquiry';
  const currentStageIndex = ALL_STAGES.indexOf(currentStage);

  const quickLinks: QuickLink[] = [
    {
      label: 'My Brief',
      description: 'View your property search criteria',
      href: '/brief',
      icon: FileText,
      stat: dashboard?.briefStat ?? 'Loading...',
    },
    {
      label: 'Properties',
      description: 'Properties matched to your brief',
      href: '/properties',
      icon: Home,
      stat: dashboard ? `${dashboard.propertiesCount} properties` : 'Loading...',
    },
    {
      label: 'Progress',
      description: 'Your search journey timeline',
      href: '/progress',
      icon: GitBranch,
      stat: dashboard ? `${dashboard.keyDatesCount} upcoming dates` : 'Loading...',
    },
    {
      label: 'Documents',
      description: 'Contracts, reports, and files',
      href: '/documents',
      icon: FolderOpen,
      stat: dashboard ? `${dashboard.documentsCount} files` : 'Loading...',
    },
    {
      label: 'Messages',
      description: 'Chat with your buyers agent',
      href: '/messages',
      icon: MessageSquare,
      stat: dashboard
        ? dashboard.unreadMessagesCount > 0
          ? `${dashboard.unreadMessagesCount} unread`
          : 'All read'
        : 'Loading...',
    },
  ];

  // Quick stats
  const stats = [
    {
      label: 'Properties Viewed',
      value: dashboard?.propertiesCount ?? 0,
      icon: Eye,
    },
    {
      label: 'Shortlisted',
      value: Math.max(0, (dashboard?.propertiesCount ?? 0) - 2),
      icon: Star,
    },
    {
      label: 'Offers Made',
      value: currentStageIndex >= ALL_STAGES.indexOf('offer-negotiate') ? 1 : 0,
      icon: Gavel,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Welcome back, {clientName}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Here is an overview of your property search progress.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <StatIcon className="h-4 w-4 text-portal-500" aria-hidden="true" />
                <span className="text-xs font-medium text-gray-500 sm:text-sm">{stat.label}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Pipeline progress */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Search Progress
        </h2>
        <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-2 sm:gap-2">
          {ALL_STAGES.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;

            return (
              <div key={stage} className="flex items-center gap-1 sm:gap-2">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold
                      ${
                        isCompleted
                          ? 'bg-green-100 text-green-700'
                          : isCurrent
                            ? 'bg-portal-600 text-white ring-4 ring-portal-100'
                            : 'bg-gray-100 text-gray-400'
                      }
                    `}
                    aria-label={`${BUYERS_AGENT_STAGE_LABELS[stage]}${
                      isCompleted ? ' - completed' : isCurrent ? ' - current stage' : ''
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`
                      mt-1.5 hidden text-center text-[10px] leading-tight sm:block sm:max-w-[80px]
                      ${
                        isCurrent
                          ? 'font-semibold text-portal-700'
                          : isCompleted
                            ? 'text-green-600'
                            : 'text-gray-400'
                      }
                    `}
                  >
                    {BUYERS_AGENT_STAGE_LABELS[stage]}
                  </span>
                </div>
                {index < ALL_STAGES.length - 1 && (
                  <div
                    className={`
                      hidden h-0.5 w-4 sm:block lg:w-8
                      ${index < currentStageIndex ? 'bg-green-300' : 'bg-gray-200'}
                    `}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-gray-600 sm:hidden">
          Current stage:{' '}
          <span className="font-semibold text-portal-700">
            {BUYERS_AGENT_STAGE_LABELS[currentStage]}
          </span>
        </p>
      </div>

      {/* Recent updates / activity placeholder */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Recent Activity
        </h2>
        <div className="mt-4 space-y-3">
          {dashboard?.unreadMessagesCount && dashboard.unreadMessagesCount > 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-portal-50 px-4 py-3">
              <MessageSquare className="h-5 w-5 text-portal-600" aria-hidden="true" />
              <p className="text-sm text-portal-700">
                You have{' '}
                <span className="font-semibold">{dashboard.unreadMessagesCount} unread</span>{' '}
                message{dashboard.unreadMessagesCount !== 1 ? 's' : ''} from your agent.
              </p>
              <Link
                href="/messages"
                className="ml-auto text-sm font-medium text-portal-600 hover:text-portal-700"
              >
                View
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No recent updates. Check back soon.</p>
          )}
        </div>
      </div>

      {/* Quick links grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-portal-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-500 focus-visible:ring-offset-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-portal-50 text-portal-600 transition-colors group-hover:bg-portal-100">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <ArrowRight
                  className="h-4 w-4 text-gray-300 transition-colors group-hover:text-portal-500"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-3 font-semibold text-gray-900">{link.label}</h3>
              <p className="mt-1 text-sm text-gray-500">{link.description}</p>
              {link.stat && <p className="mt-3 text-xs font-medium text-portal-600">{link.stat}</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
