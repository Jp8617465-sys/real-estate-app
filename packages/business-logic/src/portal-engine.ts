import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PortalClient,
  PropertyMatch,
  PortalPropertyFeedback,
  PortalInspectionFeedback,
} from '@realflow/shared';
import { PortalPropertyFeedbackSchema, PortalInspectionFeedbackSchema } from '@realflow/shared';

// ─── Internal DB Row Types ────────────────────────────────────────────────────

interface PortalClientRow {
  id: string;
  auth_id: string;
  contact_id: string;
  agent_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PropertyMatchRow {
  id: string;
  property_id: string;
  brief_id: string;
  client_id: string;
  overall_score: number;
  score_breakdown: Record<string, unknown>;
  status: string;
  rejection_reason: string | null;
  agent_notes: string | null;
  client_feedback: string | null;
  client_feedback_at: string | null;
  client_feedback_note: string | null;
  matched_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapPortalClientRow(row: PortalClientRow): PortalClient {
  return {
    id: row.id,
    authId: row.auth_id,
    contactId: row.contact_id,
    agentId: row.agent_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPropertyMatchRow(row: PropertyMatchRow): PropertyMatch {
  return {
    id: row.id,
    propertyId: row.property_id,
    clientBriefId: row.brief_id,
    clientId: row.client_id,
    overallScore: row.overall_score,
    scoreBreakdown: row.score_breakdown as PropertyMatch['scoreBreakdown'],
    status: row.status as PropertyMatch['status'],
    rejectionReason: row.rejection_reason ?? undefined,
    agentNotes: row.agent_notes ?? undefined,
    matchedAt: row.matched_at,
    updatedAt: row.updated_at,
  };
}

// ─── PortalEngine ─────────────────────────────────────────────────────────────

export class PortalEngine {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Fetch the active portal_clients row for the given Supabase auth user ID.
   * Returns null if the portal client does not exist (PGRST116).
   * Throws on other database errors.
   */
  async getPortalClient(authId: string): Promise<PortalClient | null> {
    try {
      const { data, error } = await this.supabase
        .from('portal_clients')
        .select('*')
        .eq('auth_id', authId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch portal client: ${error.message}`);
      }
      if (!data) return null;

      return mapPortalClientRow(data as PortalClientRow);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`Failed to fetch portal client: ${String(err)}`);
    }
  }

  /**
   * Record the client's acknowledgement of their brief.
   * Verifies portal client ownership before updating.
   */
  async acknowledgeBrief(briefId: string, authId: string, ip?: string): Promise<void> {
    try {
      // Verify ownership: fetch portal client and the brief's contact_id
      const portalClient = await this.getPortalClient(authId);
      if (!portalClient) throw new Error('Not found: portal client');

      const { data: brief, error: briefError } = await this.supabase
        .from('client_briefs')
        .select('id, contact_id')
        .eq('id', briefId)
        .single();

      if (briefError || !brief) {
        throw new Error(`Brief not found: ${briefId}`);
      }

      const briefRow = brief as { id: string; contact_id: string };
      if (briefRow.contact_id !== portalClient.contactId) {
        throw new Error('Forbidden: brief does not belong to this portal client');
      }

      const now = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
        acknowledged_at: now,
        updated_at: now,
      };
      if (ip) {
        updatePayload.acknowledged_ip = ip;
      }

      const { error: updateError } = await this.supabase
        .from('client_briefs')
        .update(updatePayload)
        .eq('id', briefId);

      if (updateError) {
        throw new Error(`Failed to acknowledge brief: ${updateError.message}`);
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`Failed to acknowledge brief: ${String(err)}`);
    }
  }

  /**
   * Return all property_matches with status='sent_to_client' for a given brief,
   * ordered by created_at descending.
   */
  async getSentMatches(briefId: string): Promise<PropertyMatch[]> {
    try {
      const { data, error } = await this.supabase
        .from('property_matches')
        .select('*')
        .eq('brief_id', briefId)
        .eq('status', 'sent_to_client')
        .order('matched_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch sent matches: ${error.message}`);
      }

      return ((data ?? []) as PropertyMatchRow[]).map(mapPropertyMatchRow);
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`Failed to fetch sent matches: ${String(err)}`);
    }
  }

  /**
   * Record client feedback (interested / not_interested / ask_agent) on a property match.
   * Verifies portal client ownership of the match's brief before updating.
   */
  async recordMatchFeedback(
    matchId: string,
    feedback: PortalPropertyFeedback,
    authId: string,
  ): Promise<void> {
    try {
      // Validate the feedback input
      PortalPropertyFeedbackSchema.parse(feedback);

      // Fetch the match to verify ownership
      const { data: match, error: matchError } = await this.supabase
        .from('property_matches')
        .select('id, brief_id, status')
        .eq('id', matchId)
        .single();

      if (matchError || !match) {
        throw new Error(`Property match not found: ${matchId}`);
      }

      const matchRow = match as { id: string; brief_id: string; status: string };

      // Verify the brief belongs to this portal client
      const portalClient = await this.getPortalClient(authId);
      if (!portalClient) throw new Error('Not found: portal client');

      const { data: brief, error: briefError } = await this.supabase
        .from('client_briefs')
        .select('id, contact_id')
        .eq('id', matchRow.brief_id)
        .single();

      if (briefError || !brief) {
        throw new Error(`Brief not found for match: ${matchId}`);
      }

      const briefRow = brief as { id: string; contact_id: string };
      if (briefRow.contact_id !== portalClient.contactId) {
        throw new Error('Forbidden: match does not belong to this portal client');
      }

      const now = new Date().toISOString();
      const { error: updateError } = await this.supabase
        .from('property_matches')
        .update({
          client_feedback: feedback.feedback,
          client_feedback_at: now,
          client_feedback_note: feedback.notes ?? null,
          updated_at: now,
        })
        .eq('id', matchId);

      if (updateError) {
        throw new Error(`Failed to record match feedback: ${updateError.message}`);
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`Failed to record match feedback: ${String(err)}`);
    }
  }

  /**
   * Record client rating and feedback on a completed inspection.
   * Verifies portal client ownership before updating.
   */
  async recordInspectionFeedback(
    inspectionId: string,
    feedback: PortalInspectionFeedback,
    authId: string,
  ): Promise<void> {
    try {
      // Validate input
      PortalInspectionFeedbackSchema.parse(feedback);

      // Fetch inspection to verify ownership
      const { data: inspection, error: inspectionError } = await this.supabase
        .from('inspections')
        .select('id, contact_id')
        .eq('id', inspectionId)
        .single();

      if (inspectionError || !inspection) {
        throw new Error(`Inspection not found: ${inspectionId}`);
      }

      const inspectionRow = inspection as { id: string; contact_id: string };

      // Verify portal client owns this inspection's contact
      const portalClient = await this.getPortalClient(authId);
      if (!portalClient) throw new Error('Not found: portal client');

      if (inspectionRow.contact_id !== portalClient.contactId) {
        throw new Error('Forbidden: inspection does not belong to this portal client');
      }

      const now = new Date().toISOString();
      const { error: updateError } = await this.supabase
        .from('inspections')
        .update({
          client_rating: feedback.rating,
          client_feedback: feedback.feedback ?? null,
          client_feedback_at: now,
          updated_at: now,
        })
        .eq('id', inspectionId);

      if (updateError) {
        throw new Error(`Failed to record inspection feedback: ${updateError.message}`);
      }
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error(`Failed to record inspection feedback: ${String(err)}`);
    }
  }
}
