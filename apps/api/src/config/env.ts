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
  // Optional AI credentials (system functions without these — graceful degradation)
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  ANTHROPIC_MAX_TOKENS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  ANTHROPIC_RATE_LIMIT_PER_MINUTE: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  // Optional integration credentials
  DOMAIN_CLIENT_ID: z.string().optional(),
  DOMAIN_CLIENT_SECRET: z.string().optional(),
  DOMAIN_WEBHOOK_SECRET: z.string().optional(),
  META_PAGE_ACCESS_TOKEN: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  META_INSTAGRAM_ACCOUNT_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  // LinkedIn integration
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  // Optional Stripe billing
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_ENTERPRISE_PRICE_ID: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().optional(),
  STRIPE_CANCEL_URL: z.string().url().optional(),
  // Optional Redis cache
  REDIS_URL: z.string().optional(),
  // Observability
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

// In test environment, use mock values if env vars not set
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

const testDefaults = {
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};

// Parse and validate environment variables at startup
export const env = envSchema.parse(isTest ? { ...testDefaults, ...process.env } : process.env);

// Export type for use throughout the application
export type Env = z.infer<typeof envSchema>;
