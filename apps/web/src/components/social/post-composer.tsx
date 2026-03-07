'use client';

import { useState, useCallback } from 'react';
import { useCreatePost, usePublishPost } from '@/hooks/use-social';
import { PlatformSelector } from './platform-selector';
import { PostPreview } from './post-preview';
import type { SocialPlatform } from '@realflow/shared';
import { PLATFORM_CHAR_LIMITS } from '@realflow/shared';

interface PostComposerProps {
  onClose: () => void;
  initialPropertyId?: string;
  initialContent?: string;
  initialMediaUrls?: string[];
  initialPlatforms?: SocialPlatform[];
}

export function PostComposer({
  onClose,
  initialPropertyId,
  initialContent = '',
  initialMediaUrls = [],
  initialPlatforms = [],
}: PostComposerProps) {
  const createPost = useCreatePost();
  const publishPost = usePublishPost();

  const [platforms, setPlatforms] = useState<SocialPlatform[]>(initialPlatforms);
  const [content, setContent] = useState(initialContent);
  const [mediaUrls, setMediaUrls] = useState<string[]>(initialMediaUrls);
  const [mediaInput, setMediaInput] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [mode, setMode] = useState<'draft' | 'schedule' | 'publish'>('draft');
  const [previewPlatform, setPreviewPlatform] = useState<SocialPlatform | undefined>(undefined);
  const [showPreview, setShowPreview] = useState(false);

  const charLimit = platforms.length > 0
    ? Math.min(...platforms.map((p) => PLATFORM_CHAR_LIMITS[p]))
    : 3000;

  const isValid = platforms.length > 0 && content.trim().length > 0 && content.length <= charLimit;

  const addMediaUrl = useCallback(() => {
    const trimmed = mediaInput.trim();
    if (trimmed && !mediaUrls.includes(trimmed)) {
      setMediaUrls((prev) => [...prev, trimmed]);
      setMediaInput('');
    }
  }, [mediaInput, mediaUrls]);

  const removeMediaUrl = useCallback((url: string) => {
    setMediaUrls((prev) => prev.filter((u) => u !== url));
  }, []);

  const handleSubmit = async () => {
    if (!isValid) return;

    const postData = {
      platforms,
      content: content.trim(),
      mediaUrls,
      propertyId: initialPropertyId,
      scheduledAt: mode === 'schedule' && scheduledAt
        ? new Date(scheduledAt).toISOString()
        : undefined,
    };

    const result = await createPost.mutateAsync(postData);

    // If publishing immediately, trigger publish
    if (mode === 'publish' && result.data) {
      const postId = (result.data as Record<string, unknown>).id as string;
      await publishPost.mutateAsync(postId);
    }

    onClose();
  };

  const isPending = createPost.isPending || publishPost.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Create Social Post</h2>
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
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {/* Platform Selector */}
          <PlatformSelector
            selected={platforms}
            onChange={setPlatforms}
            disabled={isPending}
          />

          {/* Content Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              disabled={isPending}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-brand-500 disabled:opacity-50"
              placeholder="Write your post content..."
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-gray-400">
                {platforms.length > 1 && 'Character limit based on most restrictive platform'}
              </span>
              <span className={content.length > charLimit ? 'font-medium text-red-600' : 'text-gray-400'}>
                {content.length} / {charLimit}
              </span>
            </div>
          </div>

          {/* Media URLs */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Media</label>
            <div className="mt-1 flex gap-2">
              <input
                type="url"
                value={mediaInput}
                onChange={(e) => setMediaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMediaUrl(); } }}
                disabled={isPending}
                className="block flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-brand-500"
                placeholder="https://example.com/image.jpg"
              />
              <button
                type="button"
                onClick={addMediaUrl}
                disabled={isPending || !mediaInput.trim()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {mediaUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {mediaUrls.map((url) => (
                  <div
                    key={url}
                    className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                  >
                    <span className="max-w-[200px] truncate">{url}</span>
                    <button
                      onClick={() => removeMediaUrl(url)}
                      className="ml-1 text-gray-400 hover:text-red-500"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {platforms.includes('instagram') && mediaUrls.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Instagram posts require at least one image
              </p>
            )}
          </div>

          {/* Publish Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700">When to publish</label>
            <div className="mt-2 flex gap-2">
              {([
                { value: 'draft', label: 'Save as Draft' },
                { value: 'schedule', label: 'Schedule' },
                { value: 'publish', label: 'Publish Now' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  disabled={isPending}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    mode === option.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {mode === 'schedule' && (
              <div className="mt-3">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  disabled={isPending}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-brand-500"
                />
              </div>
            )}
          </div>

          {/* Preview Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>

          {/* Preview */}
          {showPreview && content.trim() && (
            <div className="space-y-3">
              {platforms.length > 1 && (
                <div className="flex gap-1">
                  {platforms.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPreviewPlatform(p)}
                      className={`rounded-md px-2 py-1 text-xs font-medium ${
                        (previewPlatform ?? platforms[0]) === p
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              <PostPreview
                content={content}
                mediaUrls={mediaUrls}
                platforms={platforms}
                activePlatform={previewPlatform}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isPending || (mode === 'schedule' && !scheduledAt)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isPending
              ? 'Processing...'
              : mode === 'publish'
                ? 'Publish Now'
                : mode === 'schedule'
                  ? 'Schedule Post'
                  : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
