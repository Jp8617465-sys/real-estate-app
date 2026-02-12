import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CreateClientBrief, UpdateClientBrief } from '@realflow/shared';
import { toDbSchema, fromDbSchema } from '@realflow/business-logic';

const supabase = createClient();

export function useClientBriefs(contactId?: string) {
  return useQuery({
    queryKey: ['client-briefs', contactId],
    queryFn: async () => {
      let query = supabase
        .from('client_briefs')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone)
        `)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (contactId) {
        query = query.eq('contact_id', contactId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data.map((row: any) => ({
        ...fromDbSchema(row),
        contact: row.contact, // Preserve joined relation
      }));
    },
  });
}

export function useClientBrief(id: string) {
  return useQuery({
    queryKey: ['client-briefs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_briefs')
        .select(`
          *,
          contact:contacts(id, first_name, last_name, email, phone)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return {
        ...fromDbSchema(data),
        contact: (data as any).contact, // Preserve joined relation
      };
    },
    enabled: !!id,
  });
}

export function useCreateClientBrief() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (brief: CreateClientBrief) => {
      // Manually map CreateClientBrief to DB schema (can't use toDbSchema as it expects full ClientBrief)
      const { data, error } = await supabase
        .from('client_briefs')
        .insert({
          contact_id: brief.contactId,
          transaction_id: brief.transactionId ?? null,
          purchase_type: brief.purchaseType,
          enquiry_type: brief.enquiryType,

          // Budget (flatten)
          budget_min: brief.budget.min,
          budget_max: brief.budget.max,
          budget_absolute_max: brief.budget.absoluteMax ?? null,
          stamp_duty_budgeted: brief.budget.stampDutyBudgeted,

          // Finance (flatten)
          pre_approved: brief.finance.preApproved,
          pre_approval_amount: brief.finance.preApprovalAmount ?? null,
          pre_approval_expiry: brief.finance.preApprovalExpiry ?? null,
          lender: brief.finance.lender ?? null,
          broker_name: brief.finance.brokerName ?? null,
          broker_phone: brief.finance.brokerPhone ?? null,
          broker_email: brief.finance.brokerEmail ?? null,
          deposit_available: brief.finance.depositAvailable ?? null,
          first_home_buyer: brief.finance.firstHomeBuyer,

          // Requirements - Property details (flatten)
          property_types: brief.requirements.propertyTypes,
          bedrooms_min: brief.requirements.bedrooms.min,
          bedrooms_ideal: brief.requirements.bedrooms.ideal ?? null,
          bathrooms_min: brief.requirements.bathrooms.min,
          bathrooms_ideal: brief.requirements.bathrooms.ideal ?? null,
          car_spaces_min: brief.requirements.carSpaces.min,
          car_spaces_ideal: brief.requirements.carSpaces.ideal ?? null,
          land_size_min: brief.requirements.landSize?.min ?? null,
          land_size_max: brief.requirements.landSize?.max ?? null,
          building_age_min: brief.requirements.buildingAge?.min ?? null,
          building_age_max: brief.requirements.buildingAge?.max ?? null,

          // Requirements - Location (JSONB/arrays)
          suburbs: brief.requirements.suburbs,
          max_commute: brief.requirements.maxCommute ?? null,
          school_zones: brief.requirements.schoolZones ?? null,

          // Requirements - Preferences
          must_haves: brief.requirements.mustHaves ?? [],
          nice_to_haves: brief.requirements.niceToHaves ?? [],
          deal_breakers: brief.requirements.dealBreakers ?? [],

          // Requirements - Investor criteria
          investor_criteria: brief.requirements.investorCriteria ?? null,

          // Timeline (flatten)
          urgency: brief.timeline.urgency,
          must_settle_before: brief.timeline.mustSettleBefore ?? null,
          ideal_settlement: brief.timeline.idealSettlement ?? null,

          // Communication (flatten)
          preferred_contact_method: brief.communication.preferredMethod ?? null,
          update_frequency: brief.communication.updateFrequency ?? null,
          best_time_to_call: brief.communication.bestTimeToCall ?? null,
          partner_name: brief.communication.partnerName ?? null,
          partner_phone: brief.communication.partnerPhone ?? null,
          partner_email: brief.communication.partnerEmail ?? null,

          // Solicitor (flatten)
          solicitor_firm: brief.solicitor?.firmName ?? null,
          solicitor_contact: brief.solicitor?.contactName ?? null,
          solicitor_phone: brief.solicitor?.phone ?? null,
          solicitor_email: brief.solicitor?.email ?? null,

          // Metadata
          brief_version: 1,
          client_signed_off: brief.clientSignedOff ?? false,
          created_by: brief.createdBy,
        })
        .select()
        .single();

      if (error) throw error;
      return fromDbSchema(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-briefs'] });
    },
  });
}

export function useUpdateClientBrief(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateClientBrief) => {
      // Fetch current brief to merge with updates
      const { data: current, error: fetchError } = await supabase
        .from('client_briefs')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

      if (fetchError || !current) {
        throw new Error('Client brief not found');
      }

      // Transform current DB row to nested structure
      const currentBrief = fromDbSchema(current);

      // Merge updates with current brief
      const mergedBrief = { ...currentBrief, ...updates };

      // Transform back to DB schema
      const dbUpdates = toDbSchema(mergedBrief);

      // Apply version increment
      const updatePayload = {
        ...dbUpdates,
        brief_version: ((current as any).brief_version as number) + 1,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('client_briefs')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return fromDbSchema(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-briefs'] });
      queryClient.invalidateQueries({ queryKey: ['client-briefs', id] });
    },
  });
}

export function useSignOffBrief(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('client_briefs')
        .update({
          client_signed_off: true,
          signed_off_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return fromDbSchema(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-briefs'] });
      queryClient.invalidateQueries({ queryKey: ['client-briefs', id] });
    },
  });
}
