'use client';

import Link from 'next/link';
import {
  FileText,
  Home,
  ClipboardCheck,
  Calendar,
  FolderOpen,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type { BuyersAgentStage } from '@realflow/shared';
import { BUYERS_AGENT_STAGE_LABELS, BUYERS_AGENT_STAGE_ORDER } from '@realflow/shared';
import { usePortalClient } from '@/hooks/use-auth';
import { usePortalDashboard } from '@/hooks/use-portal-dashboard';

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

export default function PortalDashboard() {
  const { data: portalClient, isLoading: isClientLoading } = usePortalClient();
  const { data: dashboard, isLoading: isDashboardLoading } = usePortalDashboard();

  const isLoading = isClientLoading || isDashboardLoading;

  const clientName =
    portalClient?.contact?.first_name ?? 'there';
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
      label: 'Property Shortlist',
      description: 'Properties matched to your brief',
      href: '/properties',
      icon: Home,
      stat: dashboard ? `${dashboard.propertiesCount} properties` : 'Loading...',
    },
    {
      label: 'Due Diligence',
      description: 'Check progress on active property',
      href: '/due-diligence',
      icon: ClipboardCheck,
      stat: dashboard ? `${dashboard.ddCompletion}% complete` : 'Loading...',
    },
    {
      label: 'Key Dates',
      description: 'Important upcoming dates',
      href: '/timeline',
      icon: Calendar,
      stat: dashboard ? `${dashboard.keyDatesCount} upcoming` : 'Loading...',
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-portal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Welcome back, {clientName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here is an overview of your property search progress.
        </p>
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
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
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

      {/* Quick links grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-portal-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-portal-50 text-portal-600 transition-colors group-hover:bg-portal-100">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-portal-500" />
              </div>
              <h3 className="mt-3 font-semibold text-gray-900">{link.label}</h3>
              <p className="mt-1 text-sm text-gray-500">{link.description}</p>
              {link.stat && (
                <p className="mt-3 text-xs font-medium text-portal-600">{link.stat}</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
