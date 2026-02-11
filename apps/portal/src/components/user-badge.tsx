'use client';

import { useAuth } from '@/hooks/use-auth';

export function UserBadge() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (!user) return null;

  const email = user.email ?? '';
  const initials = email
    .split('@')[0]
    .split('.')
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
  const displayName = user.user_metadata?.full_name ?? email.split('@')[0] ?? 'Client';

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-portal-100">
        <span className="text-xs font-medium text-portal-700">{initials || 'U'}</span>
      </div>
      <span className="text-sm font-medium text-gray-700">{displayName}</span>
    </div>
  );
}
