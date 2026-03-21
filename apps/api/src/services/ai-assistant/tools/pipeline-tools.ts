import type { SupabaseClient } from '@supabase/supabase-js';

export async function getPipelineOverview(supabase: SupabaseClient): Promise<string> {
  const { data: deals, error } = await supabase
    .from('transactions')
    .select(
      'id, pipeline_type, current_stage, offer_amount, contract_price, created_at, updated_at, contact_id, contacts(first_name, last_name, email, phone), properties(address_street_number, address_street_name, address_suburb, address_state, list_price)',
    )
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false });

  if (error) {
    return JSON.stringify({ error: `Failed to fetch pipeline: ${error.message}` });
  }

  const summary = {
    totalDeals: deals?.length ?? 0,
    deals: (deals ?? []).map((d) => ({
      id: d.id,
      type: d.pipeline_type,
      stage: d.current_stage,
      value: d.contract_price ?? d.offer_amount ?? null,
      contact: d.contacts,
      property: d.properties,
      updatedAt: d.updated_at,
    })),
  };

  return JSON.stringify(summary);
}

export async function getDealDetails(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
): Promise<string> {
  const dealId = input.deal_id as string;
  if (!dealId) return JSON.stringify({ error: 'deal_id is required' });

  const [dealResult, activitiesResult, tasksResult] = await Promise.all([
    supabase
      .from('transactions')
      .select(
        '*, contacts(first_name, last_name, email, phone), properties(address_street_number, address_street_name, address_suburb, address_state, address_postcode, property_type, bedrooms, bathrooms, list_price)',
      )
      .eq('id', dealId)
      .eq('is_deleted', false)
      .single(),
    supabase
      .from('activities')
      .select('id, type, title, description, created_at')
      .eq('transaction_id', dealId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('tasks')
      .select('id, title, type, priority, status, due_date')
      .eq('transaction_id', dealId)
      .order('due_date', { ascending: true })
      .limit(10),
  ]);

  if (dealResult.error) {
    return JSON.stringify({ error: `Deal not found: ${dealResult.error.message}` });
  }

  return JSON.stringify({
    deal: dealResult.data,
    recentActivities: activitiesResult.data ?? [],
    tasks: tasksResult.data ?? [],
  });
}
