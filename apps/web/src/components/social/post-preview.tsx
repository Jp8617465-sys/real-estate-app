'use client';

import { cn } from '@/lib/utils';
import type { SocialPlatform } from '@realflow/shared';
import { PLATFORM_CHAR_LIMITS } from '@realflow/shared';

interface PostPreviewProps {
  content: string;
  mediaUrls: string[];
  platforms: SocialPlatform[];
  activePlatform?: SocialPlatform;
}

const platformStyles: Record<SocialPlatform, {
  name: string;
  icon: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  facebook: {
    name: 'Facebook',
    icon: 'FB',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  instagram: {
    name: 'Instagram',
    icon: 'IG',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-200',
  },
  linkedin: {
    name: 'LinkedIn',
    icon: 'LI',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-200',
  },
};

export function PostPreview({ content, mediaUrls, platforms, activePlatform }: PostPreviewProps) {
  const platform = activePlatform ?? platforms[0];
  if (!platform) return null;

  const style = platformStyles[platform];
  const charLimit = PLATFORM_CHAR_LIMITS[platform];
  const isOverLimit = content.length > charLimit;
  const displayContent = isOverLimit ? content.slice(0, charLimit) : content;

  return (
    <div className={cn('rounded-lg border', style.borderColor, style.bgColor, 'p-4')}>
      {/* Platform header */}
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('rounded px-1.5 py-0.5 text-xs font-bold', style.bgColor, style.textColor)}>
          {style.icon}
        </span>
        <span className={cn('text-sm font-medium', style.textColor)}>
          {style.name} Preview
        </span>
      </div>

      {/* Mock post frame */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        {/* Author line */}
        <div className="mb-2 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gray-200" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Your Agency</p>
            <p className="text-xs text-gray-500">Just now</p>
          </div>
        </div>

        {/* Content */}
        <p className="whitespace-pre-wrap text-sm text-gray-800">
          {displayContent}
        </p>

        {isOverLimit && (
          <p className="mt-1 text-xs text-red-500">
            Content exceeds {platform} limit by {content.length - charLimit} characters
          </p>
        )}

        {/* Media */}
        {mediaUrls.length > 0 && (
          <div className={cn(
            'mt-3 grid gap-1',
            mediaUrls.length === 1 && 'grid-cols-1',
            mediaUrls.length === 2 && 'grid-cols-2',
            mediaUrls.length >= 3 && 'grid-cols-2',
          )}>
            {mediaUrls.slice(0, 4).map((url, idx) => (
              <div
                key={idx}
                className={cn(
                  'relative overflow-hidden rounded-lg bg-gray-100',
                  mediaUrls.length === 1 ? 'h-48' : 'h-32',
                  idx === 0 && mediaUrls.length === 3 && 'row-span-2 h-full',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Media ${idx + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {idx === 3 && mediaUrls.length > 4 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-bold text-white">
                    +{mediaUrls.length - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Engagement bar (mock) */}
        <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-2 text-xs text-gray-500">
          <span>Like</span>
          <span>Comment</span>
          <span>Share</span>
        </div>
      </div>

      {/* Character count */}
      <div className="mt-2 flex items-center justify-between">
        <span className={cn(
          'text-xs',
          isOverLimit ? 'font-medium text-red-600' : 'text-gray-500',
        )}>
          {content.length} / {charLimit} characters
        </span>
      </div>
    </div>
  );
}
