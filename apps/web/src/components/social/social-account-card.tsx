'use client';

import { cn } from '@/lib/utils';
import type { SocialPlatform } from '@realflow/shared';

interface SocialAccountCardProps {
  account: Record<string, unknown>;
  onDisconnect?: (accountId: string) => void;
}

const platformConfig: Record<SocialPlatform, {
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  facebook: {
    label: 'Facebook',
    icon: 'FB',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  instagram: {
    label: 'Instagram',
    icon: 'IG',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-200',
  },
  linkedin: {
    label: 'LinkedIn',
    icon: 'LI',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-200',
  },
};

export function SocialAccountCard({ account, onDisconnect }: SocialAccountCardProps) {
  const platform = account.platform as SocialPlatform;
  const accountName = account.account_name as string;
  const isActive = account.is_active as boolean;
  const expiresAt = account.expires_at as string | null;
  const config = platformConfig[platform] ?? platformConfig.facebook;

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const expiresIn = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className={cn(
      'rounded-lg border p-4 transition-shadow hover:shadow-md',
      isActive && !isExpired ? config.borderColor : 'border-gray-200',
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold',
            config.bgColor,
            config.textColor,
          )}>
            {config.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{config.label}</p>
            <p className="text-xs text-gray-500">{accountName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpired ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Expired
            </span>
          ) : isActive ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Connected
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              Inactive
            </span>
          )}
        </div>
      </div>

      {/* Token expiry warning */}
      {expiresIn !== null && expiresIn > 0 && expiresIn <= 7 && (
        <p className="mt-2 text-xs text-amber-600">
          Token expires in {expiresIn} day{expiresIn !== 1 ? 's' : ''} - reconnect soon
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        {isExpired && (
          <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            Reconnect
          </button>
        )}
        {onDisconnect && (
          <button
            onClick={() => onDisconnect(account.id as string)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
