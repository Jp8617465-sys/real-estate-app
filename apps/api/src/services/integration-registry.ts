import type { FastifyRequest } from 'fastify';
import { createSupabaseClient } from '../middleware/supabase';
import { GmailClient } from '@realflow/integrations/gmail/client';
import { TwilioClient } from '@realflow/integrations/twilio/client';
import { WhatsAppClient } from '@realflow/integrations/whatsapp/client';
import { MetaSocialClient } from '@realflow/integrations/meta/client';

/**
 * Integration Registry Service.
 *
 * Loads OAuth tokens and integration configs from the database
 * and instantiates the appropriate integration clients.
 * Returns null gracefully when tokens are missing (not connected).
 */
export class IntegrationRegistry {
  private supabase;
  private userId: string;

  constructor(request: FastifyRequest, userId: string) {
    this.supabase = createSupabaseClient(request);
    this.userId = userId;
  }

  /**
   * Get a Gmail client using stored OAuth tokens.
   * Returns null if no Gmail connection exists for the user.
   */
  async getGmailClient(): Promise<GmailClient | null> {
    const { data: token } = await this.supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', this.userId)
      .eq('provider', 'google')
      .single();

    if (!token) return null;

    return new GmailClient({
      accessToken: token.access_token as string,
      refreshToken: token.refresh_token as string | undefined,
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    });
  }

  /**
   * Get a Twilio client using stored integration connection config.
   * Returns null if no Twilio connection exists for the user.
   */
  async getTwilioClient(): Promise<TwilioClient | null> {
    const { data: connection } = await this.supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', this.userId)
      .eq('provider', 'twilio')
      .eq('is_active', true)
      .single();

    if (!connection) return null;

    const config = connection.config as Record<string, string>;

    return new TwilioClient({
      accountSid: config.accountSid ?? '',
      authToken: config.authToken ?? '',
      fromNumber: config.fromNumber ?? '',
    });
  }

  /**
   * Get a WhatsApp client using stored OAuth tokens.
   * Returns null if no WhatsApp connection exists for the user.
   */
  async getWhatsAppClient(): Promise<WhatsAppClient | null> {
    const { data: token } = await this.supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', this.userId)
      .eq('provider', 'whatsapp')
      .single();

    if (!token) return null;

    const { data: connection } = await this.supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', this.userId)
      .eq('provider', 'whatsapp')
      .eq('is_active', true)
      .single();

    const config = (connection?.config ?? {}) as Record<string, string>;

    return new WhatsAppClient({
      accessToken: token.access_token as string,
      phoneNumberId: config.phoneNumberId ?? '',
      businessAccountId: config.businessAccountId ?? '',
      webhookVerifyToken: config.webhookVerifyToken ?? '',
    });
  }

  /**
   * Get a Meta Social client using stored OAuth tokens.
   * Returns null if no Meta connection exists for the user.
   */
  async getMetaClient(): Promise<MetaSocialClient | null> {
    const { data: token } = await this.supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', this.userId)
      .eq('provider', 'meta')
      .single();

    if (!token) return null;

    const { data: connection } = await this.supabase
      .from('integration_connections')
      .select('*')
      .eq('user_id', this.userId)
      .in('provider', ['facebook', 'instagram'])
      .eq('is_active', true)
      .single();

    const config = (connection?.config ?? {}) as Record<string, string>;

    return new MetaSocialClient({
      pageAccessToken: token.access_token as string,
      pageId: config.pageId ?? '',
      instagramAccountId: config.instagramAccountId,
    });
  }
}
