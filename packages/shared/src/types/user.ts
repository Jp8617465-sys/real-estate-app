import { z } from 'zod';

// ─── User Role ──────────────────────────────────────────────────────
export const UserRoleSchema = z.enum(['agent', 'principal', 'admin', 'assistant']);
export type UserRole = z.infer<typeof UserRoleSchema>;

// ─── User ───────────────────────────────────────────────────────────
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: UserRoleSchema,
  avatarUrl: z.string().url().optional(),
  officeId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

// ─── Office ─────────────────────────────────────────────────────────
export const OfficeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Office = z.infer<typeof OfficeSchema>;

// ─── Team ───────────────────────────────────────────────────────────
export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  officeId: z.string().uuid(),
  leadAgentId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Team = z.infer<typeof TeamSchema>;
