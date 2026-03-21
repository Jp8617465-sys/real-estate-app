import type { SupabaseClient } from '@supabase/supabase-js';

export async function getTodaysPriorities(supabase: SupabaseClient): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_action_items')
    .select(
      'id, rank, category, title, subtitle, urgency_score, composite_score, is_completed, contact_id, transaction_id, task_id',
    )
    .eq('date', today)
    .eq('is_completed', false)
    .order('rank', { ascending: true })
    .limit(20);

  if (error) {
    return JSON.stringify({ error: `Failed to fetch priorities: ${error.message}` });
  }

  if (!data || data.length === 0) {
    return JSON.stringify({
      message: 'No priorities generated for today yet. Ask the agent what they would like to focus on.',
      items: [],
    });
  }

  return JSON.stringify({
    date: today,
    items: data,
    totalRemaining: data.length,
  });
}
