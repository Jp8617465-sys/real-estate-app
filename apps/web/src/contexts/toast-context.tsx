'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ToastContextValue, ToastPayload } from '@realflow/ui';

interface ToastEntry extends ToastPayload {
  id: string;
  open: boolean;
}

interface ToastInternalContextValue extends ToastContextValue {
  toasts: ToastEntry[];
  setToastOpen: (id: string, open: boolean) => void;
}

export const ToastContext = createContext<ToastInternalContextValue | undefined>(undefined);

export function ToastContextProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const toast = useCallback((payload: ToastPayload): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...payload, id, open: true }]);
    return id;
  }, []);

  const dismiss = useCallback((toastId: string) => {
    setToasts((prev) => prev.map((t) => (t.id === toastId ? { ...t, open: false } : t)));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts((prev) => prev.map((t) => ({ ...t, open: false })));
  }, []);

  const setToastOpen = useCallback((id: string, open: boolean) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open } : t)));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, dismissAll, setToastOpen }}>
      {children}
    </ToastContext.Provider>
  );
}

/** Call anywhere inside <ToastProvider> to fire a toast notification. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return { toast: ctx.toast, dismiss: ctx.dismiss, dismissAll: ctx.dismissAll };
}
