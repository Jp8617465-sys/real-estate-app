import { z } from 'zod';

export const SocialPlatformSchema = z.enum(['instagram', 'facebook', 'linkedin']);
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

export const SocialPostStatusSchema = z.enum(['draft', 'scheduled', 'published', 'failed']);
export type SocialPostStatus = z.infer<typeof SocialPostStatusSchema>;

export const SocialPostSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  platform: SocialPlatformSchema,
  externalPostId: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().url().optional(),
  status: SocialPostStatusSchema.default('draft'),
  scheduledAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
  likesCount: z.number().int().nonnegative().default(0),
  commentsCount: z.number().int().nonnegative().default(0),
  sharesCount: z.number().int().nonnegative().default(0),
  createdBy: z.string().uuid(),
  isDeleted: z.boolean().default(false),
  deletedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SocialPost = z.infer<typeof SocialPostSchema>;

export const CreateSocialPostSchema = z.object({
  propertyId: z.string().uuid().optional(),
  platform: SocialPlatformSchema,
  content: z.string().min(1),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
});
export type CreateSocialPost = z.infer<typeof CreateSocialPostSchema>;

export const UpdateSocialPostSchema = z.object({
  content: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
  status: SocialPostStatusSchema.optional(),
});
export type UpdateSocialPost = z.infer<typeof UpdateSocialPostSchema>;
