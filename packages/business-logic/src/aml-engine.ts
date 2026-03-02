import type {
  AmlIdentityDocument,
  AmlCheck,
  AmlValidationResult,
  ComplianceReport,
  AmlDocumentType,
} from '@realflow/shared';
import { AML_DOCUMENT_POINTS, AML_DOCUMENT_CATEGORIES, AmlCheckSchema } from '@realflow/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Internal DB Row Types ────────────────────────────────────────────────────

interface AmlCheckRow {
  id: string;
  contact_id: string;
  agent_id: string;
  status: string;
  verification_method: string | null;
  total_points: number;
  points_required: number;
  full_legal_name: string | null;
  date_of_birth: string | null;
  residential_address: string | null;
  address_verified: boolean;
  started_at: string | null;
  completed_at: string | null;
  expiry_date: string | null;
  last_reviewed_at: string | null;
  verified_by_user_id: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AmlIdentityDocumentRow {
  id: string;
  check_id: string;
  document_id: string | null;
  document_type: string;
  points: number;
  document_number: string | null;
  issuing_authority: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  is_expired: boolean;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapCheckRowToAmlCheck(row: AmlCheckRow): AmlCheck {
  return AmlCheckSchema.parse({
    id: row.id,
    contactId: row.contact_id,
    agentId: row.agent_id,
    status: row.status,
    verificationMethod: row.verification_method,
    totalPoints: row.total_points,
    pointsRequired: row.points_required,
    fullLegalName: row.full_legal_name,
    dateOfBirth: row.date_of_birth,
    residentialAddress: row.residential_address,
    addressVerified: row.address_verified,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    expiryDate: row.expiry_date,
    lastReviewedAt: row.last_reviewed_at,
    verifiedByUserId: row.verified_by_user_id,
    rejectionReason: row.rejection_reason,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

// ─── AmlEngine ────────────────────────────────────────────────────────────────

export class AmlEngine {
  /**
   * Calculate the total points from a set of identity documents.
   * Expired documents do not contribute points.
   */
  static calculatePoints(
    documents: Pick<AmlIdentityDocument, 'documentType' | 'points' | 'isExpired'>[],
  ): number {
    return documents.reduce((sum, doc) => {
      if (doc.isExpired) return sum;
      return sum + doc.points;
    }, 0);
  }

  /**
   * Validate that the document set satisfies Australian 100-point check rules:
   * 1. Total valid points >= 100
   * 2. Must include at least one primary or secondary_a category document
   * 3. Duplicate document types produce a warning (and do not add additional points)
   * 4. Expired documents are excluded from point calculations
   */
  static validateDocumentSet(
    documents: Pick<AmlIdentityDocument, 'documentType' | 'points' | 'isExpired'>[],
  ): AmlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Track seen types for duplicate detection
    const seenTypes = new Set<AmlDocumentType>();
    const duplicateTypes: AmlDocumentType[] = [];
    let hasPrimaryOrSecondaryA = false;
    let totalPoints = 0;

    for (const doc of documents) {
      const type = doc.documentType as AmlDocumentType;

      // Check for duplicates regardless of expiry — subsequent entries do NOT earn points
      if (seenTypes.has(type)) {
        if (!duplicateTypes.includes(type)) {
          duplicateTypes.push(type);
        }
        continue; // Duplicate type: skip points calculation entirely
      }

      seenTypes.add(type);

      // Only count non-expired documents for points and category checks
      if (!doc.isExpired) {
        totalPoints += doc.points;
        const category = AML_DOCUMENT_CATEGORIES[type];
        if (category === 'primary' || category === 'secondary_a') {
          hasPrimaryOrSecondaryA = true;
        }
      }
    }

    // Emit duplicate warnings
    for (const type of duplicateTypes) {
      warnings.push(`Duplicate document type: ${type} (will not increase points)`);
    }

    // Validate point threshold
    if (totalPoints < 100) {
      errors.push(`Insufficient points: ${totalPoints}/100`);
    }

    // Validate primary / secondary_a presence
    if (!hasPrimaryOrSecondaryA) {
      errors.push(
        "Must include at least one primary or secondary category document (passport, driver's licence, etc.)",
      );
    }

    return {
      isValid: errors.length === 0,
      totalPoints,
      hasPrimaryOrSecondaryA,
      errors,
      warnings,
    };
  }

  /**
   * Attempt to auto-complete an AML check.
   *
   * Prerequisites:
   * - The check must have 100+ valid points (via validateDocumentSet)
   * - fullLegalName, dateOfBirth, and residentialAddress must all be present
   *
   * If conditions are met, updates the check status to 'passed', sets
   * completed_at to now, and sets expiry_date two years from now.
   *
   * Returns the updated AmlCheck or null if conditions are not satisfied.
   */
  static async tryAutoComplete(
    checkId: string,
    supabase: SupabaseClient,
  ): Promise<AmlCheck | null> {
    // Fetch the check
    const { data: checkRow, error: checkError } = await supabase
      .from('aml_checks')
      .select('*')
      .eq('id', checkId)
      .single();

    if (checkError || !checkRow) return null;

    const check = checkRow as AmlCheckRow;

    // Skip if already completed
    if (check.status === 'passed' || check.status === 'failed' || check.status === 'waived') {
      return mapCheckRowToAmlCheck(check);
    }

    // Fetch associated active (non-deleted) documents
    const { data: docRows, error: docsError } = await supabase
      .from('aml_identity_documents')
      .select('document_type, points, is_expired')
      .eq('check_id', checkId)
      .is('deleted_at', null);

    if (docsError) return null;

    const docs = (docRows ?? []) as Pick<
      AmlIdentityDocumentRow,
      'document_type' | 'points' | 'is_expired'
    >[];

    const mappedDocs = docs.map((d) => ({
      documentType: d.document_type as AmlDocumentType,
      points: d.points,
      isExpired: d.is_expired,
    }));

    const validation = AmlEngine.validateDocumentSet(mappedDocs);

    // Require valid documents AND all identity fields
    const hasIdentityFields =
      check.full_legal_name !== null &&
      check.full_legal_name.trim() !== '' &&
      check.date_of_birth !== null &&
      check.residential_address !== null &&
      check.residential_address.trim() !== '';

    if (!validation.isValid || !hasIdentityFields) return null;

    // Auto-complete: set passed, completed_at, expiry_date (+2 years)
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setFullYear(expiryDate.getFullYear() + 2);

    const { data: updatedRow, error: updateError } = await supabase
      .from('aml_checks')
      .update({
        status: 'passed',
        completed_at: now.toISOString(),
        expiry_date: expiryDate.toISOString().split('T')[0],
        updated_at: now.toISOString(),
      })
      .eq('id', checkId)
      .select()
      .single();

    if (updateError || !updatedRow) return null;

    return mapCheckRowToAmlCheck(updatedRow as AmlCheckRow);
  }

  /**
   * Return all AML checks for a given agent that expire within daysAhead days.
   * Only 'passed' checks are relevant for expiry warnings.
   */
  static async getExpiringChecks(
    agentId: string,
    daysAhead: number,
    supabase: SupabaseClient,
  ): Promise<AmlCheck[]> {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + daysAhead);

    const todayStr = today.toISOString().split('T')[0] as string;
    const cutoffStr = cutoff.toISOString().split('T')[0] as string;

    const { data, error } = await supabase
      .from('aml_checks')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'passed')
      .gte('expiry_date', todayStr)
      .lte('expiry_date', cutoffStr)
      .order('expiry_date', { ascending: true });

    if (error || !data) return [];

    return (data as AmlCheckRow[]).map(mapCheckRowToAmlCheck);
  }

  /**
   * Generate a compliance report for the given agent over a date period.
   * Includes check counts by status, expiring within 90 days, and SMR count.
   */
  static async generateComplianceReport(
    agentId: string,
    periodFrom: Date,
    periodTo: Date,
    supabase: SupabaseClient,
  ): Promise<ComplianceReport> {
    const fromStr = periodFrom.toISOString().split('T')[0] as string;
    const toStr = periodTo.toISOString().split('T')[0] as string;
    const generatedAt = new Date().toISOString();

    // Fetch agent name from users table
    const { data: userRow } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', agentId)
      .single();

    const agentName = (userRow as { full_name?: string } | null)?.full_name ?? 'Unknown Agent';

    // Fetch all checks for this agent within the period
    const { data: checkRows, error: checkError } = await supabase
      .from('aml_checks')
      .select('*')
      .eq('agent_id', agentId)
      .gte('created_at', periodFrom.toISOString())
      .lte('created_at', periodTo.toISOString())
      .order('created_at', { ascending: false });

    const checks = checkError ? [] : (checkRows as AmlCheckRow[]) ?? [];
    const mappedChecks = checks.map(mapCheckRowToAmlCheck);

    // Count by status
    const passedChecks = checks.filter((c) => c.status === 'passed').length;
    const failedChecks = checks.filter((c) => c.status === 'failed').length;
    const pendingChecks = checks.filter(
      (c) => c.status === 'pending' || c.status === 'in_progress',
    ).length;

    // Expiring within 90 days (regardless of period filter)
    const today = new Date();
    const ninetyDays = new Date(today);
    ninetyDays.setDate(ninetyDays.getDate() + 90);

    const { data: expiringRows } = await supabase
      .from('aml_checks')
      .select('id')
      .eq('agent_id', agentId)
      .eq('status', 'passed')
      .gte('expiry_date', today.toISOString().split('T')[0])
      .lte('expiry_date', ninetyDays.toISOString().split('T')[0]);

    const expiringWithin90Days = (expiringRows ?? []).length;

    // Count SMRs in period
    const { data: smrRows } = await supabase
      .from('aml_suspicious_matter_reports')
      .select('id')
      .eq('agent_id', agentId)
      .gte('report_date', fromStr)
      .lte('report_date', toStr);

    const smrCount = (smrRows ?? []).length;

    return {
      agentId,
      agentName,
      periodFrom: fromStr,
      periodTo: toStr,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      pendingChecks,
      expiringWithin90Days,
      smrCount,
      generatedAt,
      checks: mappedChecks,
    };
  }
}
