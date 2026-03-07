import { z } from 'zod';

// ─── Platform & Status Enums ──────────────────────────────────────────

export const SocialPlatformSchema = z.enum(['facebook', 'instagram', 'linkedin']);
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

export const PostStatusSchema = z.enum(['draft', 'scheduled', 'publishing', 'published', 'failed']);
export type PostStatus = z.infer<typeof PostStatusSchema>;

// Keep backward compat alias
export const SocialPostStatusSchema = PostStatusSchema;
export type SocialPostStatus = PostStatus;

// ─── Character Limits (per platform) ──────────────────────────────────

export const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
};

// ─── Social Analytics ─────────────────────────────────────────────────

export const SocialAnalyticsSchema = z.object({
  impressions: z.number().int().nonnegative().default(0),
  reach: z.number().int().nonnegative().default(0),
  engagement: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  shares: z.number().int().nonnegative().default(0),
  comments: z.number().int().nonnegative().default(0),
});
export type SocialAnalytics = z.infer<typeof SocialAnalyticsSchema>;

// ─── Per-Platform Publish Result ──────────────────────────────────────

export const PlatformPublishResultSchema = z.object({
  platform: SocialPlatformSchema,
  status: PostStatusSchema,
  externalPostId: z.string().optional(),
  errorMessage: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
});
export type PlatformPublishResult = z.infer<typeof PlatformPublishResultSchema>;

// ─── Social Post ──────────────────────────────────────────────────────

export const SocialPostSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  platforms: z.array(SocialPlatformSchema).min(1),
  content: z.string().min(1),
  mediaUrls: z.array(z.string().url()).default([]),
  scheduledAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
  status: PostStatusSchema.default('draft'),
  analytics: SocialAnalyticsSchema.optional(),
  platformResults: z.array(PlatformPublishResultSchema).default([]),
  retryCount: z.number().int().nonnegative().default(0),
  maxRetries: z.number().int().nonnegative().default(3),
  lastError: z.string().optional(),
  createdBy: z.string().uuid(),
  isDeleted: z.boolean().default(false),
  deletedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SocialPost = z.infer<typeof SocialPostSchema>;

// ─── Create Social Post ───────────────────────────────────────────────

export const CreateSocialPostSchema = z.object({
  propertyId: z.string().uuid().optional(),
  platforms: z.array(SocialPlatformSchema).min(1),
  content: z.string().min(1),
  mediaUrls: z.array(z.string().url()).default([]),
  scheduledAt: z.string().datetime().optional(),
});
export type CreateSocialPost = z.infer<typeof CreateSocialPostSchema>;

// Backward compat: keep single-platform create schema for existing code
export const CreateSinglePlatformPostSchema = z.object({
  propertyId: z.string().uuid().optional(),
  platform: SocialPlatformSchema,
  content: z.string().min(1),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
});
export type CreateSinglePlatformPost = z.infer<typeof CreateSinglePlatformPostSchema>;

// ─── Update Social Post ───────────────────────────────────────────────

export const UpdateSocialPostSchema = z.object({
  content: z.string().min(1).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: PostStatusSchema.optional(),
  platforms: z.array(SocialPlatformSchema).min(1).optional(),
  // Legacy field mapping
  imageUrl: z.string().url().optional(),
});
export type UpdateSocialPost = z.infer<typeof UpdateSocialPostSchema>;

// ─── Social Account ──────────────────────────────────────────────────

export const SocialAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platform: SocialPlatformSchema,
  accountName: z.string().min(1),
  accountId: z.string().optional(),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime(),
  scopes: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  profileImageUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SocialAccount = z.infer<typeof SocialAccountSchema>;

// ─── Connect Social Account ──────────────────────────────────────────

export const ConnectSocialAccountSchema = z.object({
  platform: SocialPlatformSchema,
  authCode: z.string().min(1),
  redirectUri: z.string().url(),
});
export type ConnectSocialAccount = z.infer<typeof ConnectSocialAccountSchema>;

// ─── Auto-Generate Post from Property ─────────────────────────────────

export const AutoGeneratePostSchema = z.object({
  propertyId: z.string().uuid(),
  platforms: z.array(SocialPlatformSchema).min(1),
  tone: z.enum(['professional', 'casual', 'luxury', 'investment']).default('professional'),
});
export type AutoGeneratePost = z.infer<typeof AutoGeneratePostSchema>;

// ─── Optimal Posting Times ────────────────────────────────────────────

export const OptimalPostingTimeSchema = z.object({
  platform: SocialPlatformSchema,
  dayOfWeek: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  engagementScore: z.number().nonnegative(),
});
export type OptimalPostingTime = z.infer<typeof OptimalPostingTimeSchema>;

// ─── Social Post Filters ──────────────────────────────────────────────

export const SocialPostFiltersSchema = z.object({
  status: PostStatusSchema.optional(),
  platform: SocialPlatformSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  propertyId: z.string().uuid().optional(),
});
export type SocialPostFilters = z.infer<typeof SocialPostFiltersSchema>;
