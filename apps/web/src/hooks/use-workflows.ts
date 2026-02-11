import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { WorkflowTrigger, WorkflowCondition, WorkflowAction } from '@realflow/shared';

const supabase = createClient();

interface WorkflowFilter {
  isActive?: boolean;
}

interface CreateWorkflowPayload {
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  isActive?: boolean;
  createdBy: string;
}

interface UpdateWorkflowPayload {
  name?: string;
  description?: string;
  trigger?: WorkflowTrigger;
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
  isActive?: boolean;
}

export function useWorkflows(filter?: WorkflowFilter) {
  return useQuery({
    queryKey: ['workflows', filter],
    queryFn: async () => {
      let query = supabase
        .from('workflows')
        .select('*')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (filter?.isActive !== undefined) {
        query = query.eq('is_active', filter.isActive);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflows')
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

export function useWorkflowRuns(workflowId: string) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_runs')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workflowId,
  });
}

export function useWorkflowTemplates() {
  return useQuery({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      const response = await fetch('/api/v1/workflows/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const json = await response.json();
      return json.data;
    },
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateWorkflowPayload) => {
      const { data, error } = await supabase
        .from('workflows')
        .insert({
          name: payload.name,
          description: payload.description,
          trigger: payload.trigger,
          conditions: payload.conditions,
          actions: payload.actions,
          is_active: payload.isActive ?? true,
          created_by: payload.createdBy,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useCreateWorkflowFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, createdBy }: { templateId: number; createdBy: string }) => {
      const response = await fetch('/api/v1/workflows/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, createdBy }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Failed to create workflow from template');
      }
      const json = await response.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useUpdateWorkflow(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateWorkflowPayload) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.name !== undefined) updatePayload.name = updates.name;
      if (updates.description !== undefined) updatePayload.description = updates.description;
      if (updates.trigger !== undefined) updatePayload.trigger = updates.trigger;
      if (updates.conditions !== undefined) updatePayload.conditions = updates.conditions;
      if (updates.actions !== undefined) updatePayload.actions = updates.actions;
      if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive;

      const { data, error } = await supabase
        .from('workflows')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflows', id] });
    },
  });
}

export function useToggleWorkflow(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (isActive: boolean) => {
      const { data, error } = await supabase
        .from('workflows')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflows', id] });
    },
  });
}

export function useDeleteWorkflow(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('workflows')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}
