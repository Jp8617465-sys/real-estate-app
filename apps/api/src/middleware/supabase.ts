import { createClient } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';
import { env } from '../config/env';

/**
 * Create a Supabase client for API routes.
 * For webhook routes, uses the service role key (no RLS).
 * For authenticated routes, uses the user's JWT from the Authorization header.
 */
export function createSupabaseClient(request: FastifyRequest) {
  const authHeader = request.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    // Authenticated request — create client with user's JWT
    const token = authHeader.slice(7);
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });
  }

  // Service role client for webhooks and internal operations
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
