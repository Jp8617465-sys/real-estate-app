import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CreateAlertSubscriptionSchema,
  PropertyAlertSubscriptionSchema,
  PropertyAlertEventSchema,
} from '@realflow/shared';
import type {
  PropertyAlertSubscription,
  PropertyAlertEvent,
  CreateAlertSubscription,
  UpdateAlertSubscription,
  AlertChannel,
} from '@realflow/shared';

// ─── Internal DB Row Types ────────────────────────────────────────────────────

interface PropertyAlertSubscriptionRow {
  id: string;
  agent_id: string;
  brief_id: string;
  score_threshold: number;
  channels: string[];
  digest_mode: boolean;
  digest_time: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PropertyAlertEventRow {
  id: string;
  subscription_id: string;
  property_match_id: string | null;
  alert_type: string;
  channels_attempted: string[];
  channels_delivered: string[];
  match_score: number;
  sent_at: string | null;
  actioned_at: string | null;
  action: string | null;
  snooze_until: string | null;
  created_at: string;
}

interface PropertyMatchRow {
  id: string;
  brief_id: string;
  overall_score: number;
  status: string;
  property_id: string | null;
}

interface PriceChangeRow {
  id: string;
  property_id: string | null;
  domain_listing_id: string | null;
  new_price: number | null;
  previous_price: number | null;
  change_type: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapSubscriptionRow(row: PropertyAlertSubscriptionRow): PropertyAlertSubscription {
  return PropertyAlertSubscriptionSchema.parse({
    id: row.id,
    agentId: row.agent_id,
    briefId: row.brief_id,
    scoreThreshold: row.score_threshold,
    channels: row.channels as AlertChannel[],
    digestMode: row.digest_mode,
    digestTime: row.digest_time.substring(0, 5), // HH:MM:SS → HH:MM
    quietHoursStart: row.quiet_hours_start.substring(0, 5),
    quietHoursEnd: row.quiet_hours_end.substring(0, 5),
    isActive: row.is_active,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapEventRow(row: PropertyAlertEventRow): PropertyAlertEvent {
  return PropertyAlertEventSchema.parse({
    id: row.id,
    subscriptionId: row.subscription_id,
    propertyMatchId: row.property_match_id,
    alertType: row.alert_type,
    channelsAttempted: row.channels_attempted as AlertChannel[],
    channelsDelivered: row.channels_delivered as AlertChannel[],
    matchScore: row.match_score,
    sentAt: row.sent_at,
    actionedAt: row.actioned_at,
    action: row.action as PropertyAlertEvent['action'],
    snoozeUntil: row.snooze_until,
    createdAt: row.created_at,
  });
}

// ─── PropertyAlertEngine ──────────────────────────────────────────────────────

export class PropertyAlertEngine {
  constructor(
    private supabase: SupabaseClient,
    private notifyPush: (
      token: string,
      title: string,
      body: string,
      data?: Record<string, string>,
    ) => Promise<void>,
    private notifyEmail: (to: string, subject: string, body: string) => Promise<void>,
    private notifySms: (to: string, body: string) => Promise<void>,
  ) {}

  // ─── isQuietHours ────────────────────────────────────────────────────────────

  /**
   * Determine whether the current AEST time falls within the defined quiet hours.
   * AEST is UTC+10 (UTC+11 during DST). Uses static UTC+10 offset for simplicity.
   * Returns true when the agent should NOT be disturbed.
   *
   * Handles wrap-around: e.g. quietStart=21:00, quietEnd=07:00 means
   * any time >= 21:00 OR <= 07:00 is within quiet hours.
   */
  isQuietHours(quietStart: string, quietEnd: string, nowUtc: Date): boolean {
    // Convert to AEST (UTC+10)
    const AEST_OFFSET_MS = 10 * 60 * 60 * 1000;
    const aestMs = nowUtc.getTime() + AEST_OFFSET_MS;
    const aestDate = new Date(aestMs);

    const currentMinutes = aestDate.getUTCHours() * 60 + aestDate.getUTCMinutes();

    const [startHH, startMM] = quietStart.split(':').map(Number) as [number, number];
    const [endHH, endMM] = quietEnd.split(':').map(Number) as [number, number];
    const startMinutes = startHH * 60 + startMM;
    const endMinutes = endHH * 60 + endMM;

    if (startMinutes <= endMinutes) {
      // Same-day range: e.g. 09:00–17:00
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Wrap-around: e.g. 21:00–07:00 spans midnight
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  // ─── handleNewMatch ──────────────────────────────────────────────────────────

  /**
   * Called when a new property_match row is created.
   * Finds active subscriptions for the match's brief where score >= threshold,
   * checks quiet hours and digest mode, dispatches alerts, and logs events.
   */
  async handleNewMatch(propertyMatchId: string): Promise<void> {
    // Fetch the property match
    const { data: matchRow, error: matchError } = await this.supabase
      .from('property_matches')
      .select('id, brief_id, overall_score, status, property_id')
      .eq('id', propertyMatchId)
      .single();

    if (matchError || !matchRow) {
      console.error(`[PropertyAlertEngine] handleNewMatch: match not found: ${propertyMatchId}`);
      return;
    }

    const match = matchRow as PropertyMatchRow;

    // Find active subscriptions for this brief that meet the score threshold
    const { data: subsData, error: subsError } = await this.supabase
      .from('property_alert_subscriptions')
      .select('*')
      .eq('brief_id', match.brief_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .lte('score_threshold', match.overall_score);

    if (subsError) {
      console.error(
        `[PropertyAlertEngine] handleNewMatch: error fetching subscriptions: ${subsError.message}`,
      );
      return;
    }

    const subs = (subsData ?? []) as PropertyAlertSubscriptionRow[];
    const now = new Date();

    for (const subRow of subs) {
      const sub = mapSubscriptionRow(subRow);
      const title = 'New Property Match';
      const body = `A new property matches your client brief with a score of ${match.overall_score}.`;
      const data: Record<string, string> = {
        matchId: propertyMatchId,
        briefId: match.brief_id,
        score: String(match.overall_score),
      };

      const inQuiet = this.isQuietHours(sub.quietHoursStart, sub.quietHoursEnd, now);

      if (sub.digestMode || inQuiet) {
        // Queue for digest or skip — log event with no sent_at
        await this.supabase.from('property_alert_events').insert({
          subscription_id: sub.id,
          property_match_id: propertyMatchId,
          alert_type: 'new_match',
          channels_attempted: [],
          channels_delivered: [],
          match_score: match.overall_score,
          sent_at: null,
        });
        continue;
      }

      const delivered = await this.dispatch(sub, match.overall_score, title, body, data);

      await this.supabase.from('property_alert_events').insert({
        subscription_id: sub.id,
        property_match_id: propertyMatchId,
        alert_type: 'new_match',
        channels_attempted: sub.channels,
        channels_delivered: delivered,
        match_score: match.overall_score,
        sent_at: delivered.length > 0 ? now.toISOString() : null,
      });
    }
  }

  // ─── handlePriceChange ───────────────────────────────────────────────────────

  /**
   * Called when a price change is detected for a property.
   * Finds all active matches for the property (not rejected/purchased),
   * then dispatches price_drop alerts to subscribed agents.
   */
  async handlePriceChange(priceChangeId: string): Promise<void> {
    // Fetch the price change record
    const { data: pcRow, error: pcError } = await this.supabase
      .from('property_price_changes')
      .select('id, property_id, domain_listing_id, new_price, previous_price, change_type')
      .eq('id', priceChangeId)
      .single();

    if (pcError || !pcRow) {
      console.error(
        `[PropertyAlertEngine] handlePriceChange: price change not found: ${priceChangeId}`,
      );
      return;
    }

    const priceChange = pcRow as PriceChangeRow;

    if (!priceChange.property_id) return;

    // Find active property matches for this property
    const { data: matchesData, error: matchesError } = await this.supabase
      .from('property_matches')
      .select('id, brief_id, overall_score, status, property_id')
      .eq('property_id', priceChange.property_id)
      .not('status', 'in', '("rejected","purchased")');

    if (matchesError || !matchesData || matchesData.length === 0) return;

    const matches = matchesData as PropertyMatchRow[];
    const now = new Date();

    // PERF: Batch-fetch all subscriptions for all matched briefs in a single query
    // instead of querying per-match inside the loop (N+1 fix).
    const allBriefIds = [...new Set(matches.map((m) => m.brief_id))];
    const { data: allSubsData, error: allSubsError } = await this.supabase
      .from('property_alert_subscriptions')
      .select('*')
      .in('brief_id', allBriefIds)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (allSubsError || !allSubsData) return;

    // Group subscriptions by brief_id for fast lookup
    const subsByBrief = new Map<string, PropertyAlertSubscriptionRow[]>();
    for (const row of allSubsData as PropertyAlertSubscriptionRow[]) {
      const existing = subsByBrief.get(row.brief_id);
      if (existing) {
        existing.push(row);
      } else {
        subsByBrief.set(row.brief_id, [row]);
      }
    }

    for (const match of matches) {
      const subs = subsByBrief.get(match.brief_id) ?? [];

      for (const subRow of subs) {
        const sub = mapSubscriptionRow(subRow);
        const title = 'Price Drop Alert';
        const body = `A property in your client's brief has dropped in price.`;
        const data: Record<string, string> = {
          matchId: match.id,
          briefId: match.brief_id,
          priceChangeId,
        };

        const inQuiet = this.isQuietHours(sub.quietHoursStart, sub.quietHoursEnd, now);

        if (sub.digestMode || inQuiet) {
          await this.supabase.from('property_alert_events').insert({
            subscription_id: sub.id,
            property_match_id: match.id,
            alert_type: 'price_drop',
            channels_attempted: [],
            channels_delivered: [],
            match_score: match.overall_score,
            sent_at: null,
          });
          continue;
        }

        const delivered = await this.dispatch(sub, match.overall_score, title, body, data);

        await this.supabase.from('property_alert_events').insert({
          subscription_id: sub.id,
          property_match_id: match.id,
          alert_type: 'price_drop',
          channels_attempted: sub.channels,
          channels_delivered: delivered,
          match_score: match.overall_score,
          sent_at: delivered.length > 0 ? now.toISOString() : null,
        });
      }
    }
  }

  // ─── dispatch ────────────────────────────────────────────────────────────────

  /**
   * Send alert via each channel in the subscription.
   * Per-channel errors are caught so a failed email doesn't block push.
   * Returns the list of channels that successfully delivered.
   */
  private async dispatch(
    sub: PropertyAlertSubscription,
    matchScore: number,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<string[]> {
    const delivered: string[] = [];

    for (const channel of sub.channels) {
      try {
        if (channel === 'push') {
          // Look up push token for agent
          const { data: tokenRow } = await this.supabase
            .from('push_device_tokens')
            .select('token')
            .eq('user_id', sub.agentId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (tokenRow) {
            const token = (tokenRow as { token: string }).token;
            await this.notifyPush(token, title, body, { ...data, score: String(matchScore) });
            delivered.push('push');
          }
        } else if (channel === 'email') {
          // Look up agent email
          const { data: userRow } = await this.supabase
            .from('users')
            .select('email')
            .eq('id', sub.agentId)
            .single();

          if (userRow) {
            const email = (userRow as { email: string }).email;
            await this.notifyEmail(email, title, body);
            delivered.push('email');
          }
        } else if (channel === 'sms') {
          // Look up agent phone
          const { data: userRow } = await this.supabase
            .from('users')
            .select('phone')
            .eq('id', sub.agentId)
            .single();

          if (userRow) {
            const phone = (userRow as { phone: string | null }).phone;
            if (phone) {
              await this.notifySms(phone, `${title}: ${body}`);
              delivered.push('sms');
            }
          }
        }
      } catch (err) {
        console.error(
          `[PropertyAlertEngine] dispatch: channel=${channel} error:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return delivered;
  }

  // ─── sendMatchToClient ───────────────────────────────────────────────────────

  /**
   * Mark a match as sent to the portal client.
   * Verifies the agent owns the match via the brief.
   * Creates a notification record for the portal client.
   */
  async sendMatchToClient(matchId: string, agentId: string): Promise<void> {
    // Fetch match and verify agent ownership via brief
    const { data: matchRow, error: matchError } = await this.supabase
      .from('property_matches')
      .select('id, brief_id, overall_score, status, property_id')
      .eq('id', matchId)
      .single();

    if (matchError || !matchRow) {
      throw new Error('Property match not found');
    }

    const match = matchRow as PropertyMatchRow;

    // Verify the agent owns this brief
    const { data: briefRow, error: briefError } = await this.supabase
      .from('client_briefs')
      .select('id, created_by')
      .eq('id', match.brief_id)
      .single();

    if (briefError || !briefRow) {
      throw new Error('Client brief not found');
    }

    const brief = briefRow as { id: string; created_by: string };

    if (brief.created_by !== agentId) {
      throw new Error('Unauthorised: agent does not own this match');
    }

    // Update match status
    const { error: updateError } = await this.supabase
      .from('property_matches')
      .update({ status: 'sent_to_client', updated_at: new Date().toISOString() })
      .eq('id', matchId);

    if (updateError) {
      throw new Error(`Failed to update match status: ${updateError.message}`);
    }

    // Create notification for portal client (look up portal_clients for this brief)
    const { data: portalClientRow } = await this.supabase
      .from('portal_clients')
      .select('id, user_id')
      .eq('brief_id', match.brief_id)
      .single();

    if (portalClientRow) {
      const portalClient = portalClientRow as { id: string; user_id: string | null };
      if (portalClient.user_id) {
        await this.supabase.from('notifications').insert({
          user_id: portalClient.user_id,
          title: 'New Property to Review',
          body: 'Your agent has sent you a property match to review.',
          priority: 'high',
          category: 'property_match',
          status: 'pending',
          entity_type: 'property_match',
          entity_id: matchId,
          is_digest_item: false,
          is_deleted: false,
        });
      }
    }
  }

  // ─── getSubscriptions ────────────────────────────────────────────────────────

  /**
   * Return all active (non-deleted) subscriptions for the given agent.
   */
  async getSubscriptions(agentId: string): Promise<PropertyAlertSubscription[]> {
    const { data, error } = await this.supabase
      .from('property_alert_subscriptions')
      .select('*')
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`[PropertyAlertEngine] getSubscriptions error: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => mapSubscriptionRow(row as PropertyAlertSubscriptionRow));
  }

  // ─── createSubscription ──────────────────────────────────────────────────────

  /**
   * Validate and insert a new alert subscription for the given agent.
   */
  async createSubscription(
    agentId: string,
    data: CreateAlertSubscription,
  ): Promise<PropertyAlertSubscription> {
    const parsed = CreateAlertSubscriptionSchema.parse(data);

    const { data: inserted, error } = await this.supabase
      .from('property_alert_subscriptions')
      .insert({
        agent_id: agentId,
        brief_id: parsed.briefId,
        score_threshold: parsed.scoreThreshold,
        channels: parsed.channels,
        digest_mode: parsed.digestMode,
        digest_time: parsed.digestTime,
        quiet_hours_start: parsed.quietHoursStart,
        quiet_hours_end: parsed.quietHoursEnd,
        is_active: true,
      })
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to create alert subscription: ${error?.message ?? 'unknown error'}`);
    }

    return mapSubscriptionRow(inserted as PropertyAlertSubscriptionRow);
  }

  // ─── updateSubscription ──────────────────────────────────────────────────────

  /**
   * Update fields on an existing subscription. Verifies agent ownership.
   */
  async updateSubscription(
    id: string,
    agentId: string,
    data: UpdateAlertSubscription,
  ): Promise<PropertyAlertSubscription> {
    // Verify ownership
    const { data: existing, error: fetchError } = await this.supabase
      .from('property_alert_subscriptions')
      .select('id, agent_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      throw new Error('Subscription not found');
    }

    const row = existing as { id: string; agent_id: string };
    if (row.agent_id !== agentId) {
      throw new Error('Unauthorised: agent does not own this subscription');
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.scoreThreshold !== undefined) payload.score_threshold = data.scoreThreshold;
    if (data.channels !== undefined) payload.channels = data.channels;
    if (data.digestMode !== undefined) payload.digest_mode = data.digestMode;
    if (data.digestTime !== undefined) payload.digest_time = data.digestTime;
    if (data.quietHoursStart !== undefined) payload.quiet_hours_start = data.quietHoursStart;
    if (data.quietHoursEnd !== undefined) payload.quiet_hours_end = data.quietHoursEnd;

    const { data: updated, error: updateError } = await this.supabase
      .from('property_alert_subscriptions')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update subscription: ${updateError?.message ?? 'unknown error'}`);
    }

    return mapSubscriptionRow(updated as PropertyAlertSubscriptionRow);
  }

  // ─── deleteSubscription ──────────────────────────────────────────────────────

  /**
   * Soft-delete a subscription. Verifies agent ownership.
   */
  async deleteSubscription(id: string, agentId: string): Promise<void> {
    // Verify ownership
    const { data: existing, error: fetchError } = await this.supabase
      .from('property_alert_subscriptions')
      .select('id, agent_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      throw new Error('Subscription not found');
    }

    const row = existing as { id: string; agent_id: string };
    if (row.agent_id !== agentId) {
      throw new Error('Unauthorised: agent does not own this subscription');
    }

    const { error: deleteError } = await this.supabase
      .from('property_alert_subscriptions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Failed to delete subscription: ${deleteError.message}`);
    }
  }

  // ─── getAlertEvents ──────────────────────────────────────────────────────────

  /**
   * Return recent alert events for the given agent, ordered newest first.
   * Joins through subscriptions to verify ownership.
   */
  async getAlertEvents(agentId: string, limit = 50): Promise<PropertyAlertEvent[]> {
    // First get all subscription IDs for this agent
    const { data: subsData, error: subsError } = await this.supabase
      .from('property_alert_subscriptions')
      .select('id')
      .eq('agent_id', agentId)
      .is('deleted_at', null);

    if (subsError || !subsData || subsData.length === 0) return [];

    const subIds = (subsData as { id: string }[]).map((s) => s.id);

    const { data, error } = await this.supabase
      .from('property_alert_events')
      .select('*')
      .in('subscription_id', subIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`[PropertyAlertEngine] getAlertEvents error: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => mapEventRow(row as PropertyAlertEventRow));
  }
}
