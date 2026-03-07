import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SocialDmLead,
  SocialDmWebhook,
  SocialLeadStats,
} from '@realflow/shared';

// ─── Internal DB Row Shape ────────────────────────────────────────────────────

interface SocialDmLeadRow {
  id: string;
  channel: string;
  external_id: string;
  sender_name: string | null;
  sender_handle: string | null;
  message_text: string | null;
  raw_payload: Record<string, unknown> | null;
  status: string;
  contact_id: string | null;
  agent_id: string;
  office_id: string;
  created_at: string;
  deleted_at: string | null;
}

function mapRow(row: SocialDmLeadRow): SocialDmLead {
  return {
    id: row.id,
    channel: row.channel as SocialDmLead['channel'],
    externalId: row.external_id,
    senderName: row.sender_name,
    senderHandle: row.sender_handle,
    messageText: row.message_text,
    rawPayload: row.raw_payload,
    status: row.status as SocialDmLead['status'],
    contactId: row.contact_id,
    agentId: row.agent_id,
    officeId: row.office_id,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

// ─── Social Lead Engine ───────────────────────────────────────────────────────

export class SocialLeadEngine {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Ingest an inbound DM webhook payload.
   * Idempotent: duplicate (channel, externalId) combinations are ignored and the
   * existing record is returned.
   */
  async ingestDm(
    payload: SocialDmWebhook,
    agentId: string,
    officeId: string,
  ): Promise<SocialDmLead> {
    // Dedup check first
    const existing = await this.findByExternalId(payload.channel, payload.externalId);
    if (existing) return existing;

    const { data, error } = await this.db
      .from('social_dm_leads')
      .insert({
        channel: payload.channel,
        external_id: payload.externalId,
        sender_name: payload.senderName ?? null,
        sender_handle: payload.senderHandle ?? null,
        message_text: payload.messageText,
        raw_payload: payload.rawPayload ?? null,
        status: 'pending',
        agent_id: agentId,
        office_id: officeId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to ingest DM: ${error.message}`);
    return mapRow(data as SocialDmLeadRow);
  }

  /**
   * Convert a pending DM lead into a CRM contact.
   * Sets the lead status to 'converted' and creates a contact record.
   */
  async convertToContact(
    leadId: string,
    agentId: string,
    overrides?: { firstName?: string; lastName?: string; email?: string; phone?: string },
  ): Promise<string> {
    const lead = await this.getById(leadId);
    if (lead.status === 'converted') {
      if (!lead.contactId) throw new Error('Lead marked converted but has no contactId');
      return lead.contactId;
    }
    if (lead.status === 'dismissed') {
      throw new Error('Cannot convert a dismissed lead');
    }

    // Parse sender name into first/last
    const nameParts = (lead.senderName ?? '').split(' ');
    const firstName = overrides?.firstName ?? nameParts[0] ?? 'Unknown';
    const lastName = overrides?.lastName ?? (nameParts.slice(1).join(' ') || null);

    // Create contact
    const { data: contact, error: contactErr } = await this.db
      .from('contacts')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: overrides?.email ?? null,
        phone: overrides?.phone ?? null,
        lead_source: lead.channel,
        social_lead_id: leadId,
        assigned_agent_id: agentId,
        is_deleted: false,
      })
      .select('id')
      .single();

    if (contactErr) throw new Error(`Failed to create contact: ${contactErr.message}`);

    // Mark lead as converted
    const { error: updateErr } = await this.db
      .from('social_dm_leads')
      .update({ status: 'converted', contact_id: contact.id })
      .eq('id', leadId);

    if (updateErr) throw new Error(`Failed to update lead status: ${updateErr.message}`);

    return contact.id as string;
  }

  /**
   * Dismiss a pending DM lead (mark as not worth following up).
   */
  async dismissLead(leadId: string): Promise<void> {
    const { error } = await this.db
      .from('social_dm_leads')
      .update({ status: 'dismissed' })
      .eq('id', leadId)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to dismiss lead: ${error.message}`);
  }

  /**
   * Get aggregated lead stats for an agent over a date range.
   */
  async getLeadStats(agentId: string, from: Date, to: Date): Promise<SocialLeadStats> {
    const { data, error } = await this.db
      .from('social_dm_leads')
      .select('channel, status')
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString());

    if (error) throw new Error(`Failed to get lead stats: ${error.message}`);

    const rows = data as { channel: string; status: string }[];
    const total = rows.length;
    const pending = rows.filter(r => r.status === 'pending').length;
    const converted = rows.filter(r => r.status === 'converted').length;
    const dismissed = rows.filter(r => r.status === 'dismissed').length;

    const byChannel = {
      facebook_dm: rows.filter(r => r.channel === 'facebook_dm').length,
      instagram_dm: rows.filter(r => r.channel === 'instagram_dm').length,
      linkedin_dm: rows.filter(r => r.channel === 'linkedin_dm').length,
    };

    return {
      total,
      pending,
      converted,
      dismissed,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      byChannel,
    };
  }

  /**
   * List leads for an agent, optionally filtered by status.
   */
  async listLeads(
    agentId: string,
    options?: { status?: SocialDmLead['status']; limit?: number; offset?: number },
  ): Promise<SocialDmLead[]> {
    let query = this.db
      .from('social_dm_leads')
      .select('*')
      .eq('agent_id', agentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 50)
      .range(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? 50) - 1);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list leads: ${error.message}`);
    return (data as SocialDmLeadRow[]).map(mapRow);
  }

  /**
   * Get a single lead by ID.
   */
  async getById(leadId: string): Promise<SocialDmLead> {
    const { data, error } = await this.db
      .from('social_dm_leads')
      .select('*')
      .eq('id', leadId)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(`Lead not found: ${error.message}`);
    return mapRow(data as SocialDmLeadRow);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async findByExternalId(
    channel: string,
    externalId: string,
  ): Promise<SocialDmLead | null> {
    const { data } = await this.db
      .from('social_dm_leads')
      .select('*')
      .eq('channel', channel)
      .eq('external_id', externalId)
      .is('deleted_at', null)
      .maybeSingle();

    return data ? mapRow(data as SocialDmLeadRow) : null;
  }
}
