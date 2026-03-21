import type { SupabaseClient } from '@supabase/supabase-js';

export async function searchProperties(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
): Promise<string> {
  const limit = Math.min((input.limit as number) ?? 10, 50);

  let builder = supabase
    .from('properties')
    .select(
      'id, address_street_number, address_street_name, address_unit_number, address_suburb, address_state, address_postcode, property_type, bedrooms, bathrooms, car_spaces, list_price, listing_status, sale_type, portal_views, enquiry_count',
    )
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (input.suburb) {
    builder = builder.ilike('address_suburb', `%${input.suburb as string}%`);
  }
  if (input.min_price) {
    builder = builder.gte('list_price', input.min_price as number);
  }
  if (input.max_price) {
    builder = builder.lte('list_price', input.max_price as number);
  }
  if (input.bedrooms) {
    builder = builder.gte('bedrooms', input.bedrooms as number);
  }
  if (input.property_type) {
    builder = builder.eq('property_type', input.property_type as string);
  }

  const { data, error } = await builder;

  if (error) {
    return JSON.stringify({ error: `Property search failed: ${error.message}` });
  }

  return JSON.stringify({
    results: (data ?? []).map((p) => ({
      ...p,
      address: [p.address_unit_number, p.address_street_number, p.address_street_name, p.address_suburb, p.address_state, p.address_postcode]
        .filter(Boolean)
        .join(' '),
    })),
    count: data?.length ?? 0,
  });
}

export async function getPropertyAlerts(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
): Promise<string> {
  const limit = Math.min((input.limit as number) ?? 10, 50);

  const { data: subs, error: subsError } = await supabase
    .from('property_alert_subscriptions')
    .select(
      'id, score_threshold, channels, digest_mode, is_active, brief_id, client_briefs(id, contact_id, contacts(first_name, last_name))',
    )
    .is('deleted_at', null)
    .eq('is_active', true)
    .limit(limit);

  if (subsError) {
    return JSON.stringify({ error: `Failed to fetch alerts: ${subsError.message}` });
  }

  // Get recent alert events for active subscriptions
  const subIds = (subs ?? []).map((s) => s.id);
  let recentEvents: unknown[] = [];

  if (subIds.length > 0) {
    const { data: events } = await supabase
      .from('property_alert_events')
      .select('id, subscription_id, alert_type, match_score, sent_at, action, created_at')
      .in('subscription_id', subIds)
      .order('created_at', { ascending: false })
      .limit(20);

    recentEvents = events ?? [];
  }

  return JSON.stringify({
    activeSubscriptions: subs ?? [],
    recentEvents,
  });
}
