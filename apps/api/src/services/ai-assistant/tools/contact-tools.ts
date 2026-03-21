import type { SupabaseClient } from '@supabase/supabase-js';

export async function searchContacts(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
): Promise<string> {
  const query = input.query as string;
  if (!query) return JSON.stringify({ error: 'query is required' });

  const contactType = input.contact_type as string | undefined;
  const limit = Math.min((input.limit as number) ?? 10, 50);

  // Use ilike for basic search — pg_trgm index supports this
  const searchPattern = `%${query}%`;

  let builder = supabase
    .from('contacts')
    .select(
      'id, first_name, last_name, email, phone, types, source, lead_score, last_contact_date, address_suburb, assigned_agent_id',
    )
    .eq('is_deleted', false)
    .or(
      `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern}`,
    )
    .order('last_contact_date', { ascending: false })
    .limit(limit);

  if (contactType) {
    builder = builder.contains('types', [contactType]);
  }

  const { data, error } = await builder;

  if (error) {
    return JSON.stringify({ error: `Search failed: ${error.message}` });
  }

  return JSON.stringify({
    results: data ?? [],
    count: data?.length ?? 0,
  });
}

export async function getContactTimeline(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
): Promise<string> {
  const contactId = input.contact_id as string;
  if (!contactId) return JSON.stringify({ error: 'contact_id is required' });

  const limit = Math.min((input.limit as number) ?? 20, 50);

  const [contactResult, activitiesResult] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, types, lead_score, last_contact_date')
      .eq('id', contactId)
      .eq('is_deleted', false)
      .single(),
    supabase
      .from('activities')
      .select('id, type, title, description, created_at, created_by')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (contactResult.error) {
    return JSON.stringify({ error: `Contact not found: ${contactResult.error.message}` });
  }

  return JSON.stringify({
    contact: contactResult.data,
    timeline: activitiesResult.data ?? [],
  });
}
