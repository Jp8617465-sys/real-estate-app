import { useMutation } from '@tanstack/react-query';
import type { AIMessageDraftRequest, AIMessageDraftResult } from '@realflow/shared';

export function useDraftMessage() {
  return useMutation({
    mutationFn: async (params: AIMessageDraftRequest): Promise<AIMessageDraftResult> => {
      const response = await fetch('/api/v1/ai/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error((err as { error?: string }).error ?? 'Failed to draft message');
      }

      const json = await response.json();
      return json.data as AIMessageDraftResult;
    },
  });
}
