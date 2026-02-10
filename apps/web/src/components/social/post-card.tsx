'use client';

import { cn } from '@/lib/utils';

interface PostCardProps {
  post: Record<string, unknown>;
}

const platformIcons: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  linkedin: 'LI',
};

const platformColors: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  linkedin: 'bg-sky-100 text-sky-700',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export function PostCard({ post }: PostCardProps) {
  const platform = post.platform as string;
  const content = post.content as string;
  const status = post.status as string;
  const scheduledAt = post.scheduled_at as string | null;
  const likesCount = (post.likes_count as number) ?? 0;
  const commentsCount = (post.comments_count as number) ?? 0;
  const sharesCount = (post.shares_count as number) ?? 0;

  const truncatedContent = content && content.length > 60
    ? content.slice(0, 60) + '...'
    : content;

  const timeLabel = scheduledAt
    ? new Date(scheduledAt).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm transition-shadow hover:shadow-md">
      {/* Header: Platform + Status */}
      <div className="flex items-center justify-between gap-1">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold',
            platformColors[platform] ?? 'bg-gray-100 text-gray-600',
          )}
        >
          {platformIcons[platform] ?? platform}
        </span>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize',
            statusColors[status] ?? 'bg-gray-100 text-gray-600',
          )}
        >
          {status}
        </span>
      </div>

      {/* Content preview */}
      <p className="mt-1 text-xs text-gray-700 leading-tight">{truncatedContent}</p>

      {/* Time */}
      {timeLabel && (
        <p className="mt-1 text-[10px] text-gray-400">{timeLabel}</p>
      )}

      {/* Engagement metrics (if published) */}
      {status === 'published' && (likesCount > 0 || commentsCount > 0 || sharesCount > 0) && (
        <div className="mt-1 flex gap-2 text-[10px] text-gray-500">
          {likesCount > 0 && <span>{likesCount} likes</span>}
          {commentsCount > 0 && <span>{commentsCount} comments</span>}
          {sharesCount > 0 && <span>{sharesCount} shares</span>}
        </div>
      )}
    </div>
  );
}
