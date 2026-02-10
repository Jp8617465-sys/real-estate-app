'use client';

import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { ErrorToast } from '@/components/error-toast';

interface ToastError {
  id: string;
  message: string;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<ToastError[]>([]);

  const addError = useCallback((message: string) => {
    const id = crypto.randomUUID();
    setErrors((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setErrors((prev) => prev.filter((e) => e.id !== id));
    }, 8000);
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            // Only show toast for queries that have already loaded data (background refetch failures)
            // Initial load errors are handled by component-level error states
            if (query.state.data !== undefined) {
              console.error('[RealFlow] Background query error:', {
                queryKey: query.queryKey,
                error: error.message,
              });
              addError(`Failed to refresh data: ${error.message}`);
            } else {
              console.error('[RealFlow] Query error:', {
                queryKey: query.queryKey,
                error: error.message,
              });
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            console.error('[RealFlow] Mutation error:', {
              mutationKey: mutation.options.mutationKey,
              error: error.message,
            });
            addError(error.message);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {errors.map((err) => (
          <ErrorToast key={err.id} message={err.message} onDismiss={() => dismissError(err.id)} />
        ))}
      </div>
    </QueryClientProvider>
  );
}
