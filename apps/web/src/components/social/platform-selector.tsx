'use client';

import { cn } from '@/lib/utils';
import type { SocialPlatform } from '@realflow/shared';
import { PLATFORM_CHAR_LIMITS } from '@realflow/shared';

interface PlatformSelectorProps {
  selected: SocialPlatform[];
  onChange: (platforms: SocialPlatform[]) => void;
  disabled?: boolean;
}

const PLATFORMS: Array<{
  value: SocialPlatform;
  label: string;
  icon: string;
  color: string;
  activeColor: string;
  charLimit: number;
}> = [
  {
    value: 'facebook',
    label: 'Facebook',
    icon: 'FB',
    color: 'border-blue-200 text-blue-600 hover:border-blue-400',
    activeColor: 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500',
    charLimit: PLATFORM_CHAR_LIMITS.facebook,
  },
  {
    value: 'instagram',
    label: 'Instagram',
    icon: 'IG',
    color: 'border-pink-200 text-pink-600 hover:border-pink-400',
    activeColor: 'border-pink-500 bg-pink-50 text-pink-700 ring-1 ring-pink-500',
    charLimit: PLATFORM_CHAR_LIMITS.instagram,
  },
  {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: 'LI',
    color: 'border-sky-200 text-sky-600 hover:border-sky-400',
    activeColor: 'border-sky-500 bg-sky-50 text-sky-700 ring-1 ring-sky-500',
    charLimit: PLATFORM_CHAR_LIMITS.linkedin,
  },
];

export function PlatformSelector({ selected, onChange, disabled }: PlatformSelectorProps) {
  const toggle = (platform: SocialPlatform) => {
    if (disabled) return;
    if (selected.includes(platform)) {
      onChange(selected.filter((p) => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Platforms</label>
      <div className="flex flex-wrap gap-3">
        {PLATFORMS.map((platform) => {
          const isActive = selected.includes(platform.value);
          return (
            <button
              key={platform.value}
              type="button"
              onClick={() => toggle(platform.value)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all',
                isActive ? platform.activeColor : platform.color,
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="text-xs font-bold">{platform.icon}</span>
              <span>{platform.label}</span>
              {isActive && (
                <svg className="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-500">
          Max characters: {Math.min(...selected.map((p) => PLATFORM_CHAR_LIMITS[p]))}
          {selected.length > 1 && ' (limited by smallest platform)'}
        </p>
      )}
    </div>
  );
}
