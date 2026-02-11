import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  PORT: z
    .string()
    .default('3001')
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Optional integration credentials
  DOMAIN_CLIENT_ID: z.string().optional(),
  DOMAIN_CLIENT_SECRET: z.string().optional(),
  DOMAIN_WEBHOOK_SECRET: z.string().optional(),
  META_PAGE_ACCESS_TOKEN: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  META_INSTAGRAM_ACCOUNT_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
});

// In test environment, use mock values if env vars not set
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

const testDefaults = {
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};

// Parse and validate environment variables at startup
export const env = envSchema.parse(
  isTest ? { ...testDefaults, ...process.env } : process.env
);

// Export type for use throughout the application
export type Env = z.infer<typeof envSchema>;
