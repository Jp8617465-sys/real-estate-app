import type { SupabaseClient } from '@supabase/supabase-js';

export async function createTask(
  supabase: SupabaseClient,
  input: Record<string, unknown>,
  userId: string,
): Promise<string> {
  const title = input.title as string;
  if (!title) return JSON.stringify({ error: 'title is required' });

  const dueDate = (input.due_date as string) ?? new Date(Date.now() + 86400_000).toISOString();
  const priority = (input.priority as string) ?? 'medium';
  const contactId = input.contact_id as string | undefined;
  const taskType = (input.type as string) ?? 'general';

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title,
      type: taskType,
      priority,
      status: 'pending',
      due_date: dueDate,
      assigned_to: userId,
      created_by: userId,
      ...(contactId && { contact_id: contactId }),
    })
    .select('id, title, type, priority, status, due_date')
    .single();

  if (error) {
    return JSON.stringify({ error: `Failed to create task: ${error.message}` });
  }

  return JSON.stringify({ success: true, task: data });
}
