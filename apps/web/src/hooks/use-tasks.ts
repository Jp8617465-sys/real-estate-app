import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CreateTask, UpdateTask } from '@realflow/shared';

const supabase = createClient();

interface TaskFilter {
  status?: string;
  priority?: string;
  assignedTo?: string;
  contactId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export function useTasks(filter?: TaskFilter) {
  return useQuery({
    queryKey: ['tasks', filter],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('is_deleted', false)
        .order('due_date', { ascending: true });

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }
      if (filter?.priority) {
        query = query.eq('priority', filter.priority);
      }
      if (filter?.assignedTo) {
        query = query.eq('assigned_to', filter.assignedTo);
      }
      if (filter?.contactId) {
        query = query.eq('contact_id', filter.contactId);
      }
      if (filter?.dueDateFrom) {
        query = query.gte('due_date', filter.dueDateFrom);
      }
      if (filter?.dueDateTo) {
        query = query.lte('due_date', filter.dueDateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: CreateTask) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: task.title,
          description: task.description,
          type: task.type,
          priority: task.priority,
          status: task.status,
          contact_id: task.contactId,
          property_id: task.propertyId,
          transaction_id: task.transactionId,
          assigned_to: task.assignedTo,
          due_date: task.dueDate,
          reminder_at: task.reminderAt,
          workflow_id: task.workflowId,
          is_automated: task.isAutomated,
          created_by: task.createdBy,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateTask) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.title !== undefined) updatePayload.title = updates.title;
      if (updates.description !== undefined) updatePayload.description = updates.description;
      if (updates.type !== undefined) updatePayload.type = updates.type;
      if (updates.priority !== undefined) updatePayload.priority = updates.priority;
      if (updates.status !== undefined) updatePayload.status = updates.status;
      if (updates.contactId !== undefined) updatePayload.contact_id = updates.contactId;
      if (updates.propertyId !== undefined) updatePayload.property_id = updates.propertyId;
      if (updates.transactionId !== undefined) updatePayload.transaction_id = updates.transactionId;
      if (updates.assignedTo !== undefined) updatePayload.assigned_to = updates.assignedTo;
      if (updates.dueDate !== undefined) updatePayload.due_date = updates.dueDate;
      if (updates.reminderAt !== undefined) updatePayload.reminder_at = updates.reminderAt;

      const { data, error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });
}

export function useCompleteTask(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });
}

export function useDeleteTask(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tasks')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
