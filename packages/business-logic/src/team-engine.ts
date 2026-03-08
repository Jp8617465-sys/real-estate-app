import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LeadAssignmentRule,
  TeamPerformance,
  TeamMember,
  CreateLeadAssignmentRule,
  UpdateLeadAssignmentRule,
} from '@realflow/shared';

// ─── Internal DB Row Shapes ───────────────────────────────────────────────────

interface LeadAssignmentRuleRow {
  id: string;
  office_id: string;
  name: string;
  rule_type: string;
  conditions: Record<string, unknown>;
  priority: number;
  assignee_ids: string[];
  round_robin_idx: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface TeamSnapshotRow {
  agent_id: string;
  active_contacts: number;
  active_deals: number;
  deals_closed: number;
  avg_response_h: number | null;
  leads_received: number;
  leads_converted: number;
}

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapRule(row: LeadAssignmentRuleRow): LeadAssignmentRule {
  return {
    id: row.id,
    officeId: row.office_id,
    name: row.name,
    ruleType: row.rule_type as LeadAssignmentRule['ruleType'],
    conditions: row.conditions as LeadAssignmentRule['conditions'],
    priority: row.priority,
    assigneeIds: row.assignee_ids,
    roundRobinIdx: row.round_robin_idx,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

// ─── Team Engine ──────────────────────────────────────────────────────────────

export class TeamEngine {
  constructor(private readonly db: SupabaseClient) {}

  // ─── Team Members ──────────────────────────────────────────────────────────

  /**
   * List all active agents in an office.
   */
  async getTeamMembers(officeId: string): Promise<TeamMember[]> {
    const { data, error } = await this.db
      .from('users')
      .select('id, first_name, last_name, email, role, avatar_url, is_active')
      .eq('office_id', officeId)
      .eq('is_active', true)
      .order('first_name', { ascending: true });

    if (error) throw new Error(`Failed to get team members: ${error.message}`);

    return (data as UserRow[]).map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: row.role,
      avatarUrl: row.avatar_url,
      isActive: row.is_active,
    }));
  }

  // ─── Team Performance ──────────────────────────────────────────────────────

  /**
   * Get team performance stats for a date range.
   * Uses pre-computed snapshots when available, falls back to live counts.
   */
  async getTeamPerformance(
    officeId: string,
    from: Date,
    to: Date,
  ): Promise<TeamPerformance[]> {
    // Try snapshot table first (pre-aggregated daily)
    const { data: snapshots, error: snapErr } = await this.db
      .from('team_performance_snapshots')
      .select('agent_id, active_contacts, active_deals, deals_closed, avg_response_h, leads_received, leads_converted')
      .eq('office_id', officeId)
      .gte('snapshot_date', from.toISOString().split('T')[0])
      .lte('snapshot_date', to.toISOString().split('T')[0]);

    if (snapErr) throw new Error(`Failed to get performance snapshots: ${snapErr.message}`);

    // Aggregate across days per agent
    const byAgent = new Map<string, TeamSnapshotRow>();
    for (const snap of snapshots as TeamSnapshotRow[]) {
      const existing = byAgent.get(snap.agent_id);
      if (!existing) {
        byAgent.set(snap.agent_id, { ...snap });
      } else {
        existing.active_contacts = snap.active_contacts; // use latest
        existing.active_deals = snap.active_deals; // use latest
        existing.deals_closed += snap.deals_closed;
        existing.leads_received += snap.leads_received;
        existing.leads_converted += snap.leads_converted;
        if (snap.avg_response_h !== null) {
          existing.avg_response_h =
            existing.avg_response_h !== null
              ? (existing.avg_response_h + snap.avg_response_h) / 2
              : snap.avg_response_h;
        }
      }
    }

    // Get user names for all agents
    const agentIds = Array.from(byAgent.keys());
    if (agentIds.length === 0) return [];

    const { data: users, error: usersErr } = await this.db
      .from('users')
      .select('id, first_name, last_name')
      .in('id', agentIds);

    if (usersErr) throw new Error(`Failed to get agent names: ${usersErr.message}`);

    const nameMap = new Map<string, string>();
    for (const u of users as { id: string; first_name: string; last_name: string }[]) {
      nameMap.set(u.id, `${u.first_name} ${u.last_name}`.trim());
    }

    return Array.from(byAgent.entries()).map(([agentId, snap]) => ({
      agentId,
      agentName: nameMap.get(agentId) ?? 'Unknown',
      activeContacts: snap.active_contacts,
      activeDeals: snap.active_deals,
      dealsClosed: snap.deals_closed,
      avgResponseHours: snap.avg_response_h,
      leadsReceived: snap.leads_received,
      leadsConverted: snap.leads_converted,
      conversionRate:
        snap.leads_received > 0
          ? Math.round((snap.leads_converted / snap.leads_received) * 100)
          : 0,
    }));
  }

  /**
   * Compute and persist a daily snapshot for all agents in an office.
   * Designed to be called by a cron job each morning.
   */
  async snapshotTeamPerformance(officeId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Get all active agents
    const members = await this.getTeamMembers(officeId);

    for (const member of members) {
      // Active contacts (not deleted)
      const { count: activeContacts } = await this.db
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', member.id)
        .eq('is_deleted', false);

      // Active deals
      const { count: activeDeals } = await this.db
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', member.id)
        .eq('is_deleted', false)
        .neq('current_stage', 'settlement');

      // Deals closed this month
      const monthStart = new Date();
      monthStart.setDate(1);
      const { count: dealsClosed } = await this.db
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', member.id)
        .eq('current_stage', 'settlement')
        .gte('updated_at', monthStart.toISOString());

      await this.db.from('team_performance_snapshots').upsert(
        {
          office_id: officeId,
          agent_id: member.id,
          snapshot_date: today,
          active_contacts: activeContacts ?? 0,
          active_deals: activeDeals ?? 0,
          deals_closed: dealsClosed ?? 0,
          leads_received: 0, // populated from contacts table in next iteration
          leads_converted: 0,
        },
        { onConflict: 'office_id,agent_id,snapshot_date' },
      );
    }
  }

  // ─── Lead Assignment Rules ─────────────────────────────────────────────────

  /**
   * List active assignment rules for an office, ordered by priority.
   */
  async listAssignmentRules(officeId: string): Promise<LeadAssignmentRule[]> {
    const { data, error } = await this.db
      .from('lead_assignment_rules')
      .select('*')
      .eq('office_id', officeId)
      .is('deleted_at', null)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to list assignment rules: ${error.message}`);
    return (data as LeadAssignmentRuleRow[]).map(mapRule);
  }

  /**
   * Create a new lead assignment rule.
   */
  async createAssignmentRule(
    officeId: string,
    data: CreateLeadAssignmentRule,
    createdBy: string,
  ): Promise<LeadAssignmentRule> {
    const { data: row, error } = await this.db
      .from('lead_assignment_rules')
      .insert({
        office_id: officeId,
        name: data.name,
        rule_type: data.ruleType,
        conditions: data.conditions ?? {},
        priority: data.priority ?? 0,
        assignee_ids: data.assigneeIds,
        is_active: data.isActive ?? true,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create assignment rule: ${error.message}`);
    return mapRule(row as LeadAssignmentRuleRow);
  }

  /**
   * Update an existing assignment rule.
   */
  async updateAssignmentRule(
    ruleId: string,
    data: UpdateLeadAssignmentRule,
  ): Promise<LeadAssignmentRule> {
    const updatePayload: Record<string, unknown> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.ruleType !== undefined) updatePayload.rule_type = data.ruleType;
    if (data.conditions !== undefined) updatePayload.conditions = data.conditions;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.assigneeIds !== undefined) updatePayload.assignee_ids = data.assigneeIds;
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive;
    updatePayload.updated_at = new Date().toISOString();

    const { data: row, error } = await this.db
      .from('lead_assignment_rules')
      .update(updatePayload)
      .eq('id', ruleId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`Failed to update assignment rule: ${error.message}`);
    return mapRule(row as LeadAssignmentRuleRow);
  }

  /**
   * Soft-delete an assignment rule.
   */
  async deleteAssignmentRule(ruleId: string): Promise<void> {
    const { error } = await this.db
      .from('lead_assignment_rules')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', ruleId)
      .is('deleted_at', null);

    if (error) throw new Error(`Failed to delete assignment rule: ${error.message}`);
  }

  /**
   * Evaluate all active rules for a contact and return the assigned agent ID.
   * Rules are evaluated in priority order; first match wins.
   * For round_robin rules, the index is atomically incremented in the DB.
   */
  async assignLead(
    contactId: string,
    officeId: string,
  ): Promise<string | null> {
    // Fetch the contact to evaluate against conditions
    const { data: contact, error: contactErr } = await this.db
      .from('contacts')
      .select('id, lead_source, buyer_profile')
      .eq('id', contactId)
      .single();

    if (contactErr) throw new Error(`Contact not found: ${contactErr.message}`);

    const rules = await this.listAssignmentRules(officeId);

    for (const rule of rules) {
      if (!rule.isActive || rule.assigneeIds.length === 0) continue;

      // Check conditions
      if (!this.ruleMatchesContact(rule, contact as Record<string, unknown>)) continue;

      // Rule matches — assign
      if (rule.ruleType === 'round_robin') {
        return await this.assignRoundRobin(rule);
      }

      // For other types, return the first assignee
      return rule.assigneeIds[0] ?? null;
    }

    return null; // No rule matched
  }

  // ─── Workflow Templates ────────────────────────────────────────────────────

  /**
   * Share a workflow template team-wide.
   */
  async shareWorkflowTemplate(workflowId: string, agentId: string): Promise<void> {
    const { error } = await this.db
      .from('workflows')
      .update({
        is_team_template: true,
        shared_by_agent_id: agentId,
        shared_at: new Date().toISOString(),
      })
      .eq('id', workflowId)
      .eq('created_by', agentId);

    if (error) throw new Error(`Failed to share workflow template: ${error.message}`);
  }

  /**
   * Unshare a workflow template (back to personal only).
   */
  async unshareWorkflowTemplate(workflowId: string, agentId: string): Promise<void> {
    const { error } = await this.db
      .from('workflows')
      .update({
        is_team_template: false,
        shared_by_agent_id: null,
        shared_at: null,
      })
      .eq('id', workflowId)
      .eq('created_by', agentId);

    if (error) throw new Error(`Failed to unshare workflow template: ${error.message}`);
  }

  /**
   * List workflow templates shared within an office.
   */
  async listTeamTemplates(officeId: string): Promise<{ id: string; name: string; sharedAt: string; sharedBy: string }[]> {
    const { data, error } = await this.db
      .from('workflows')
      .select('id, name, shared_at, shared_by_agent_id')
      .eq('office_id', officeId)
      .eq('is_team_template', true)
      .eq('is_deleted', false)
      .order('shared_at', { ascending: false });

    if (error) throw new Error(`Failed to list team templates: ${error.message}`);

    return (data as { id: string; name: string; shared_at: string; shared_by_agent_id: string }[]).map(
      row => ({
        id: row.id,
        name: row.name,
        sharedAt: row.shared_at,
        sharedBy: row.shared_by_agent_id,
      }),
    );
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private ruleMatchesContact(
    rule: LeadAssignmentRule,
    contact: Record<string, unknown>,
  ): boolean {
    const conditions = rule.conditions;

    // Lead source filter
    if (conditions.leadSources && Array.isArray(conditions.leadSources) && conditions.leadSources.length > 0) {
      if (!conditions.leadSources.includes(contact.lead_source as string)) return false;
    }

    return true; // No blocking conditions matched
  }

  private async assignRoundRobin(rule: LeadAssignmentRule): Promise<string> {
    // Use DB function to atomically claim the next assignee (avoids read-modify-write race).
    const { data, error } = await this.db.rpc('claim_round_robin_assignee', { rule_id: rule.id });
    if (error) throw new Error(`Failed to assign round-robin: ${error.message}`);
    return (data as { assignee_id: string } | null)?.assignee_id ?? rule.assigneeIds[0] ?? '';
  }
}
