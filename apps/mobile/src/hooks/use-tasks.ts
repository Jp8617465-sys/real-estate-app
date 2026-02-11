import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Task, CreateTask, UpdateTask, TaskStatus, TaskPriority } from '@realflow/shared';

export interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  dueDate?: string;
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
      if (filter?.dueDate) {
        query = query.lte('due_date', filter.dueDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
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
        .single();
      if (error) throw error;
      return data as Task;
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
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
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
      return data as Task;
    },
    onMutate: async () => {
      // Optimistic update: cancel outgoing queries and update cache
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      queryClient.setQueriesData<Task[]>(
        { queryKey: ['tasks'] },
        (old) =>
          old?.map((task) =>
            task.id === id
              ? { ...task, status: 'completed' as const, completedAt: new Date().toISOString() }
              : task,
          ),
      );

      return { previousTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueriesData({ queryKey: ['tasks'] }, context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateTask) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.title) updatePayload.title = updates.title;
      if (updates.description !== undefined) updatePayload.description = updates.description;
      if (updates.type) updatePayload.type = updates.type;
      if (updates.priority) updatePayload.priority = updates.priority;
      if (updates.status) updatePayload.status = updates.status;
      if (updates.contactId) updatePayload.contact_id = updates.contactId;
      if (updates.propertyId) updatePayload.property_id = updates.propertyId;
      if (updates.assignedTo) updatePayload.assigned_to = updates.assignedTo;
      if (updates.dueDate) updatePayload.due_date = updates.dueDate;
      if (updates.reminderAt !== undefined) updatePayload.reminder_at = updates.reminderAt;

      const { data, error } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });
}
