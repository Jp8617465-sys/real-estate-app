import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type {
  CreateAmlCheck,
  UpdateAmlCheck,
  CompleteAmlCheck,
  AddAmlDocument,
  CreateAmlSmr,
  GenerateAUSTRACReport,
} from '@realflow/shared';

const supabase = createClient();

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

interface ComplianceDashboardData {
  totalClients: number;
  verified: number;
  pending: number;
  expired: number;
  failed: number;
  expiringWithin90Days: number;
  recentVerifications: Array<{
    id: string;
    contactId: string;
    contactName: string;
    type: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  }>;
  pendingQueue: Array<{
    contactId: string;
    contactName: string;
    verificationType: string;
    status: string;
    createdAt: string;
  }>;
}

export function useComplianceDashboard() {
  return useQuery({
    queryKey: ['compliance-dashboard'],
    queryFn: async (): Promise<ComplianceDashboardData> => {
      const now = new Date();
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      // All AML checks
      const { data: allChecks, error: checksError } = await supabase
        .from('aml_checks')
        .select('*, contacts!contact_id(first_name, last_name)')
        .order('created_at', { ascending: false });

      if (checksError) throw checksError;

      const checks = allChecks ?? [];

      const totalClients = new Set(checks.map((c: Record<string, unknown>) => c.contact_id)).size;
      const verified = checks.filter((c: Record<string, unknown>) => c.status === 'passed').length;
      const pending = checks.filter(
        (c: Record<string, unknown>) => c.status === 'pending' || c.status === 'in_progress',
      ).length;
      const expired = checks.filter((c: Record<string, unknown>) => c.status === 'expired').length;
      const failed = checks.filter((c: Record<string, unknown>) => c.status === 'failed').length;

      const expiringWithin90Days = checks.filter((c: Record<string, unknown>) => {
        if (c.status !== 'passed' || !c.expiry_date) return false;
        const expiryDate = new Date(c.expiry_date as string);
        return expiryDate <= ninetyDaysFromNow && expiryDate > now;
      }).length;

      const recentVerifications = checks.slice(0, 10).map((c: Record<string, unknown>) => {
        const contact = c.contacts as Record<string, string> | null;
        const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown';
        return {
          id: c.id as string,
          contactId: c.contact_id as string,
          contactName,
          type: 'identity' as const,
          status: c.status as string,
          createdAt: c.created_at as string,
          completedAt: c.completed_at as string | null,
        };
      });

      const pendingQueue = checks
        .filter(
          (c: Record<string, unknown>) => c.status === 'pending' || c.status === 'in_progress',
        )
        .map((c: Record<string, unknown>) => {
          const contact = c.contacts as Record<string, string> | null;
          const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown';
          return {
            contactId: c.contact_id as string,
            contactName,
            verificationType: 'identity' as const,
            status: c.status as string,
            createdAt: c.created_at as string,
          };
        });

      return {
        totalClients,
        verified,
        pending,
        expired,
        failed,
        expiringWithin90Days,
        recentVerifications,
        pendingQueue,
      };
    },
    refetchInterval: 60000,
  });
}

// ─── Verifications (AML Checks) ──────────────────────────────────────────────

export function useVerifications(contactId?: string) {
  return useQuery({
    queryKey: ['verifications', contactId],
    queryFn: async () => {
      let query = supabase
        .from('aml_checks')
        .select('*, contacts!contact_id(first_name, last_name)')
        .order('created_at', { ascending: false });

      if (contactId) {
        query = query.eq('contact_id', contactId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVerification(checkId: string) {
  return useQuery({
    queryKey: ['verification', checkId],
    queryFn: async () => {
      const { data: check, error: checkError } = await supabase
        .from('aml_checks')
        .select('*, contacts!contact_id(first_name, last_name, email, phone, address)')
        .eq('id', checkId)
        .single();

      if (checkError) throw checkError;

      const { data: documents, error: docsError } = await supabase
        .from('aml_identity_documents')
        .select('*')
        .eq('check_id', checkId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (docsError) throw docsError;

      return { ...check, documents: documents ?? [] };
    },
    enabled: !!checkId,
  });
}

export function useCreateVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAmlCheck) => {
      const { data, error } = await supabase
        .from('aml_checks')
        .insert({
          contact_id: input.contactId,
          verification_method: input.verificationMethod,
          full_legal_name: input.fullLegalName,
          date_of_birth: input.dateOfBirth,
          residential_address: input.residentialAddress,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-dashboard'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function useUpdateVerification(checkId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateAmlCheck) => {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.verificationMethod !== undefined)
        payload.verification_method = updates.verificationMethod;
      if (updates.fullLegalName !== undefined) payload.full_legal_name = updates.fullLegalName;
      if (updates.dateOfBirth !== undefined) payload.date_of_birth = updates.dateOfBirth;
      if (updates.residentialAddress !== undefined)
        payload.residential_address = updates.residentialAddress;
      if (updates.addressVerified !== undefined) payload.address_verified = updates.addressVerified;
      if (updates.notes !== undefined) payload.notes = updates.notes;

      const { data, error } = await supabase
        .from('aml_checks')
        .update(payload)
        .eq('id', checkId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
      queryClient.invalidateQueries({ queryKey: ['verification', checkId] });
      queryClient.invalidateQueries({ queryKey: ['compliance-dashboard'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function useCompleteVerification(checkId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CompleteAmlCheck) => {
      const now = new Date();
      const payload: Record<string, unknown> = {
        status: input.outcome,
        completed_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      if (input.outcome === 'passed') {
        const expiryDate = new Date(now);
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
        payload.expiry_date = expiryDate.toISOString().split('T')[0];
      }

      if (input.outcome === 'failed') {
        payload.rejection_reason = input.rejectionReason;
      }

      const { data, error } = await supabase
        .from('aml_checks')
        .update(payload)
        .eq('id', checkId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
      queryClient.invalidateQueries({ queryKey: ['verification', checkId] });
      queryClient.invalidateQueries({ queryKey: ['compliance-dashboard'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

// ─── Identity Documents ──────────────────────────────────────────────────────

export function useAddDocument(checkId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddAmlDocument) => {
      const { data, error } = await supabase
        .from('aml_identity_documents')
        .insert({
          check_id: checkId,
          document_type: input.documentType,
          document_number: input.documentNumber ?? null,
          issuing_authority: input.issuingAuthority ?? null,
          issue_date: input.issueDate ?? null,
          expiry_date: input.expiryDate ?? null,
          notes: input.notes ?? null,
          points: (() => {
            const { AML_DOCUMENT_POINTS } = require('@realflow/shared');
            return AML_DOCUMENT_POINTS[input.documentType];
          })(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification', checkId] });
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

export function useRemoveDocument(checkId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from('aml_identity_documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification', checkId] });
      queryClient.invalidateQueries({ queryKey: ['verifications'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

// ─── Compliance Reports ──────────────────────────────────────────────────────

export function useComplianceReports() {
  return useQuery({
    queryKey: ['compliance-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('austrac_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateAUSTRACReport) => {
      const { data, error } = await supabase
        .from('austrac_reports')
        .insert({
          type: input.type,
          period_start: input.periodStart,
          period_end: input.periodEnd,
          status: 'draft',
          generated_at: new Date().toISOString(),
          data: {},
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-reports'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

// ─── Suspicious Matter Reports ───────────────────────────────────────────────

export function useSuspiciousMatterReports() {
  return useQuery({
    queryKey: ['smr-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aml_suspicious_matter_reports')
        .select('*, contacts!contact_id(first_name, last_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateSmr() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAmlSmr) => {
      const { data, error } = await supabase
        .from('aml_suspicious_matter_reports')
        .insert({
          contact_id: input.contactId ?? null,
          transaction_id: input.transactionId ?? null,
          description: input.description,
          suspicion_basis: input.suspicionBasis,
          amount_aud: input.amountAud ?? null,
          report_date: new Date().toISOString().split('T')[0],
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smr-reports'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-reports'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-dashboard'] });
    },
    onError: (error: Error) => {
      console.error('Mutation failed:', error);
    },
  });
}

// ─── Expiring Checks ─────────────────────────────────────────────────────────

export function useExpiringChecks(daysAhead: number = 90) {
  return useQuery({
    queryKey: ['expiring-checks', daysAhead],
    queryFn: async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('aml_checks')
        .select('*, contacts!contact_id(first_name, last_name)')
        .eq('status', 'passed')
        .not('expiry_date', 'is', null)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .gte('expiry_date', now.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}
