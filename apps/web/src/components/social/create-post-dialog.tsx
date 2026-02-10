'use client';

import { useState } from 'react';
import { useCreateSocialPost } from '@/hooks/use-social-posts';
import type { SocialPlatform } from '@realflow/shared';

interface CreatePostDialogProps {
  onClose: () => void;
}

const PLATFORMS: Array<{ value: SocialPlatform; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const MAX_CHAR_COUNTS: Record<string, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
};

export function CreatePostDialog({ onClose }: CreatePostDialogProps) {
  const createPost = useCreateSocialPost();

  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [publishNow, setPublishNow] = useState(false);

  const togglePlatform = (platform: SocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  };

  const minCharLimit = selectedPlatforms.length > 0
    ? Math.min(...selectedPlatforms.map((p) => MAX_CHAR_COUNTS[p] ?? 3000))
    : 3000;

  const handleSubmit = async () => {
    if (selectedPlatforms.length === 0 || !content.trim()) return;

    // Create a post for each selected platform
    for (const platform of selectedPlatforms) {
      await createPost.mutateAsync({
        platform,
        content: content.trim(),
        imageUrl: imageUrl.trim() || undefined,
        scheduledAt: publishNow ? undefined : (scheduledAt || undefined),
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Create Post</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-4">
          {/* Platform Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Platforms</label>
            <div className="mt-2 flex gap-3">
              {PLATFORMS.map((platform) => (
                <label
                  key={platform.value}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(platform.value)}
                    onChange={() => togglePlatform(platform.value)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-700">{platform.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={minCharLimit}
              rows={4}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Write your post content..."
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {content.length} / {minCharLimit}
            </p>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Image URL</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Schedule */}
          <div>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={publishNow}
                  onChange={(e) => setPublishNow(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-700">Save as draft</span>
              </label>
            </div>
            {!publishNow && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700">Schedule for</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          {/* Preview */}
          {content.trim() && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500">Preview</p>
              <div className="mt-2">
                {imageUrl && (
                  <div className="mb-2 h-32 w-full rounded-lg bg-gray-200 flex items-center justify-center text-xs text-gray-400">
                    Image preview
                  </div>
                )}
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{content}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedPlatforms.length === 0 || !content.trim() || createPost.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createPost.isPending ? 'Creating...' : publishNow ? 'Save Draft' : 'Schedule Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
