import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSupabaseClient } from '../middleware/supabase';

const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

/**
 * Settings API routes.
 *
 * Provides endpoints for:
 * - Getting / updating the current user's profile
 * - Listing integration connection statuses
 * - Initiating OAuth flows for integrations
 * - Disconnecting integrations
 */
export async function settingsRoutes(fastify: FastifyInstance) {
  // ─── Get Current User Profile ──────────────────────────────────
  fastify.get('/profile', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── Update Current User Profile ───────────────────────────────
  fastify.patch('/profile', async (request, reply) => {
    const supabase = createSupabaseClient(request);
    const parsed = UpdateProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.firstName) updates.first_name = parsed.data.firstName;
    if (parsed.data.lastName) updates.last_name = parsed.data.lastName;
    if (parsed.data.email) updates.email = parsed.data.email;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
    updates.updated_at = new Date().toISOString();

    // Get the current user's ID first
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .single();

    if (!userData) return reply.status(401).send({ error: 'User not found' });

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userData.id)
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return { data };
  });

  // ─── List Integration Connections ──────────────────────────────
  fastify.get('/integrations', async (request, reply) => {
    const supabase = createSupabaseClient(request);

    // Get current user
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .single();

    if (!userData) return reply.status(401).send({ error: 'User not found' });

    // Get integration connections
    const { data: connections, error: connError } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', userData.id);

    if (connError) return reply.status(500).send({ error: connError.message });

    // Get OAuth tokens to show connection status
    const { data: tokens, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('provider, account_email, expires_at')
      .eq('user_id', userData.id);

    if (tokenError) return reply.status(500).send({ error: tokenError.message });

    // Merge token status into connections for a unified view
    const providers = [
      { name: 'Domain.com.au', provider: 'domain' },
      { name: 'realestate.com.au', provider: 'rea' },
      { name: 'Instagram', provider: 'instagram' },
      { name: 'Facebook', provider: 'facebook' },
      { name: 'Google Calendar', provider: 'google_calendar' },
      { name: 'Gmail', provider: 'gmail' },
      { name: 'Twilio (SMS)', provider: 'twilio' },
      { name: 'WhatsApp', provider: 'whatsapp' },
    ];

    const integrations = providers.map((p) => {
      const connection = (connections ?? []).find(
        (c: Record<string, unknown>) => c.provider === p.provider,
      );
      const token = (tokens ?? []).find(
        (t: Record<string, unknown>) => t.provider === p.provider,
      );

      const isActive = connection
        ? (connection as Record<string, unknown>).is_active === true
        : false;
      const hasToken = !!token;

      return {
        name: p.name,
        provider: p.provider,
        connected: isActive || hasToken,
        status: isActive || hasToken ? 'Connected' : 'Not connected',
        accountEmail: token
          ? (token as Record<string, unknown>).account_email
          : undefined,
        lastSyncAt: connection
          ? (connection as Record<string, unknown>).last_sync_at
          : undefined,
      };
    });

    return { data: integrations };
  });

  // ─── Initiate OAuth Flow ───────────────────────────────────────
  fastify.post<{ Params: { provider: string } }>(
    '/integrations/:provider/connect',
    async (request, reply) => {
      const { provider } = request.params;

      // Build OAuth URL based on provider
      const oauthUrls: Record<string, string> = {
        gmail: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI ?? '')}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly')}&access_type=offline&prompt=consent`,
        google_calendar: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI ?? '')}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/calendar')}&access_type=offline&prompt=consent`,
        facebook: `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI ?? '')}&scope=pages_manage_posts,pages_messaging,instagram_basic,instagram_content_publish`,
        instagram: `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI ?? '')}&scope=instagram_basic,instagram_content_publish`,
        domain: `https://auth.domain.com.au/v1/connect/authorize?client_id=${process.env.DOMAIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DOMAIN_REDIRECT_URI ?? '')}&response_type=code&scope=api_listings_read api_listings_write`,
      };

      const oauthUrl = oauthUrls[provider];
      if (!oauthUrl) {
        return reply.status(400).send({ error: `Unsupported provider: ${provider}` });
      }

      return { data: { oauthUrl } };
    },
  );

  // ─── Disconnect Integration ────────────────────────────────────
  fastify.delete<{ Params: { provider: string } }>(
    '/integrations/:provider',
    async (request, reply) => {
      const supabase = createSupabaseClient(request);
      const { provider } = request.params;

      // Get current user
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .single();

      if (!userData) return reply.status(401).send({ error: 'User not found' });

      // Delete OAuth tokens for this provider
      await supabase
        .from('oauth_tokens')
        .delete()
        .eq('user_id', userData.id)
        .eq('provider', provider);

      // Set integration connection to inactive
      const { error } = await supabase
        .from('integration_connections')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userData.id)
        .eq('provider', provider);

      if (error) return reply.status(500).send({ error: error.message });
      return { success: true };
    },
  );
}
