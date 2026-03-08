import { createClient } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';
import { env } from '../config/env';

/**
 * Create a Supabase client scoped to the authenticated user's JWT.
 * Throws HTTP 401 if the Authorization header is missing or not a Bearer token.
 * Use this for all user-facing routes — RLS policies apply.
 */
export function createSupabaseClient(request: FastifyRequest) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }

  const token = authHeader.slice(7);
  // A JWT must have exactly 3 dot-separated parts; reject early to avoid
  // passing a malformed token to Supabase (which would surface as 500).
  if (token.split('.').length !== 3) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

/**
 * Create a service-role Supabase client that bypasses RLS.
 * Use ONLY for webhook handlers and internal scheduler operations
 * where there is no user JWT (e.g. inbound webhook from Domain, Meta).
 * Never use this in user-facing request handlers.
 */
export function createSupabaseServiceClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
