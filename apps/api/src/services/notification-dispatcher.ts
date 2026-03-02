/**
 * Notification Dispatcher
 *
 * Creates notification records in the DB and dispatches them:
 * - Immediately via Expo push if priority is critical/high AND outside quiet hours
 * - To digest queue if medium/low priority or inside quiet hours
 *
 * Deduplication is enforced via dedupKey (unique constraint in DB).
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import type { CreateNotification, NotificationPreferences } from '@realflow/shared';

// ─── Expo Push API ─────────────────────────────────────────────────────────────

interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export class NotificationDispatcher {
  private supabase;

  constructor() {
    this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }

  /**
   * Create a notification record.
   * If dedupKey already exists, silently returns without creating a duplicate.
   */
  async create(payload: CreateNotification): Promise<{ id: string } | null> {
    const insertData: Record<string, unknown> = {
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      priority: payload.priority ?? 'medium',
      category: payload.category,
      status: 'pending',
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
      action_primary: payload.actionPrimary ?? null,
      action_secondary: payload.actionSecondary ?? null,
      action_tertiary: payload.actionTertiary ?? null,
      dedup_key: payload.dedupKey ?? null,
      scheduled_for: payload.scheduledFor ?? null,
      is_digest_item: payload.isDigestItem ?? false,
      metadata: payload.metadata ?? null,
    };

    const { data, error } = await this.supabase
      .from('notifications')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      // Unique violation on dedup_key = already exists
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return null;
      }
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return { id: data.id as string };
  }

  /**
   * Dispatch a notification: evaluate push eligibility, send if eligible,
   * otherwise queue for digest.
   */
  async dispatch(notificationId: string): Promise<void> {
    const { data: notif, error } = await this.supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (error || !notif) return;

    const priority = notif.priority as string;
    const userId = notif.user_id as string;

    // Get user preferences
    const prefs = await this.getPreferences(userId);

    const shouldSendNow = this.isHighPriority(priority) && !this.isQuietHours(prefs);

    if (shouldSendNow) {
      await this.sendPush(userId, {
        title: notif.title as string,
        body: notif.body as string,
        data: {
          notificationId,
          entityType: notif.entity_type,
          entityId: notif.entity_id,
          actionPrimary: notif.action_primary,
        },
      });

      await this.supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', notificationId);
    } else {
      // Mark as digest item
      await this.supabase
        .from('notifications')
        .update({ is_digest_item: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId);
    }
  }

  /**
   * Convenience: create + dispatch in one call.
   */
  async createAndDispatch(payload: CreateNotification): Promise<void> {
    const result = await this.create(payload);
    if (result) {
      await this.dispatch(result.id);
    }
  }

  /**
   * Batch pending digest items for a user into a single summary push.
   * Called daily at configured digest_send_time.
   */
  async sendDigest(userId: string): Promise<void> {
    const { data: items } = await this.supabase
      .from('notifications')
      .select('id, title, category')
      .eq('user_id', userId)
      .eq('is_digest_item', true)
      .eq('is_deleted', false)
      .is('digest_sent_at', null)
      .in('status', ['pending', 'sent'])
      .order('created_at', { ascending: true })
      .limit(20);

    if (!items || items.length === 0) return;

    const count = items.length;
    const categories = [...new Set(items.map((i) => i.category as string))];
    const body = categories.length === 1
      ? `${count} update${count > 1 ? 's' : ''} in ${categories[0]}`
      : `${count} update${count > 1 ? 's' : ''} across ${categories.length} categories`;

    await this.sendPush(userId, {
      title: `${count} new update${count > 1 ? 's' : ''} today`,
      body,
      data: { type: 'digest', count },
    });

    const now = new Date().toISOString();
    const ids = items.map((i) => i.id as string);

    await this.supabase
      .from('notifications')
      .update({ digest_sent_at: now, status: 'sent', sent_at: now, updated_at: now })
      .in('id', ids);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    const { data } = await this.supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) return null;

    return {
      id: data.id as string,
      userId: data.user_id as string,
      quietHoursStart: data.quiet_hours_start as string,
      quietHoursEnd: data.quiet_hours_end as string,
      digestModeEnabled: data.digest_mode_enabled as boolean,
      digestSendTime: data.digest_send_time as string,
      notifyNewLead: data.notify_new_lead as boolean,
      notifyPropertyMatch: data.notify_property_match as boolean,
      notifyKeyDateReminder: data.notify_key_date_reminder as boolean,
      notifyPipelineUpdate: data.notify_pipeline_update as boolean,
      notifyFollowUpDue: data.notify_follow_up_due as boolean,
      notifyLowPriority: data.notify_low_priority as boolean,
      dailyActionListEnabled: data.daily_action_list_enabled as boolean,
      dailyActionListTime: data.daily_action_list_time as string,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }

  private isHighPriority(priority: string): boolean {
    return priority === 'critical' || priority === 'high';
  }

  private isQuietHours(prefs: NotificationPreferences | null): boolean {
    if (!prefs) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
    const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);
    const startMinutes = (startH ?? 21) * 60 + (startM ?? 0);
    const endMinutes = (endH ?? 7) * 60 + (endM ?? 0);

    // Handles overnight quiet hours (e.g. 21:00 - 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  private async sendPush(
    userId: string,
    message: Omit<ExpoPushMessage, 'to'>,
  ): Promise<void> {
    // Get all active push tokens for user
    const { data: tokens } = await this.supabase
      .from('push_device_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!tokens || tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token as string,
      sound: 'default',
      ...message,
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });

      if (!response.ok) return;

      const result = (await response.json()) as { data: ExpoPushTicket[] };

      // Deactivate tokens that returned DeviceNotRegistered
      const toDeactivate: string[] = [];
      result.data?.forEach((ticket, i) => {
        if (
          ticket.status === 'error' &&
          ticket.details?.error === 'DeviceNotRegistered' &&
          tokens[i]
        ) {
          toDeactivate.push(tokens[i]!.token as string);
        }
      });

      if (toDeactivate.length > 0) {
        await this.supabase
          .from('push_device_tokens')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('token', toDeactivate);
      }
    } catch {
      // Push failures are non-fatal
    }
  }
}

// Singleton instance
let _dispatcher: NotificationDispatcher | null = null;

export function getNotificationDispatcher(): NotificationDispatcher {
  if (!_dispatcher) {
    _dispatcher = new NotificationDispatcher();
  }
  return _dispatcher;
}
