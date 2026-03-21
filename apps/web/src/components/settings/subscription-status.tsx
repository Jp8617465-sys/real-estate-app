'use client';

import {
  useSubscriptionStatus,
  useCreateCheckout,
  useCreatePortal,
} from '@/hooks/use-subscription';
import type { SubscriptionTier } from '@realflow/shared';

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  past_due: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export function SubscriptionStatus() {
  const { data, isLoading, error } = useSubscriptionStatus();
  const checkout = useCreateCheckout();
  const portal = useCreatePortal();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-32 rounded bg-gray-100 dark:bg-gray-700" />
        <div className="h-4 w-48 rounded bg-gray-100 dark:bg-gray-700" />
        <div className="h-10 w-36 rounded bg-gray-100 dark:bg-gray-700" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Failed to load subscription status.
      </p>
    );
  }

  const tier = data?.tier ?? 'free';
  const status = data?.status ?? 'inactive';
  const subscription = data?.subscription;
  const isActive = data?.isActive ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {TIER_LABELS[tier]} Plan
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.inactive}`}
        >
          {status.replace('_', ' ')}
        </span>
      </div>

      {isActive && subscription?.currentPeriodEnd && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Current period ends{' '}
          {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {subscription.cancelAtPeriodEnd && (
            <span className="ml-1 text-yellow-600 dark:text-yellow-400">
              (cancels at period end)
            </span>
          )}
        </p>
      )}

      {subscription && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {subscription.seatCount} {subscription.seatCount === 1 ? 'seat' : 'seats'}
        </p>
      )}

      <div className="flex gap-3">
        {tier === 'free' ? (
          <button
            onClick={() => checkout.mutate()}
            disabled={checkout.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {checkout.isPending ? 'Loading...' : 'Upgrade to Professional'}
          </button>
        ) : (
          <button
            onClick={() => portal.mutate()}
            disabled={portal.isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {portal.isPending ? 'Loading...' : 'Manage Subscription'}
          </button>
        )}
      </div>
    </div>
  );
}
